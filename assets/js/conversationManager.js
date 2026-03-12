// ================================================================
// conversationManager.js
// Handles all communication with the Cloudflare Worker:
//   - Daily usage status
//   - Conversation history (load / clear)
//   - Sending messages (streaming)
// ================================================================

// 🔧 Replace with your deployed Cloudflare Worker URL
const WORKER_URL = "https://krrishchatbot.krrishjoshijoshi.workers.dev";

// ── Get today's usage status for a user ────────────────────────
export async function getStatus(userId) {
  try {
    const res = await fetch(`${WORKER_URL}/status`, {
      headers: { "X-User-Id": userId }
    });
    if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`);
    return await res.json();
    // Returns: { used, limit, remaining, resetAt }
  } catch (err) {
    console.error("[ConvManager] getStatus error:", err);
    return { used: 0, limit: 15, remaining: 15, resetAt: null };
  }
}

// ── Load conversation history for a user ───────────────────────
export async function loadHistory(userId) {
  try {
    const res = await fetch(`${WORKER_URL}/history`, {
      headers: { "X-User-Id": userId }
    });
    if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
    const data = await res.json();
    return data.history || [];
    // Returns: array of { role: "user"|"assistant", content: string }
  } catch (err) {
    console.error("[ConvManager] loadHistory error:", err);
    return [];
  }
}

// ── Clear conversation history for a user ──────────────────────
export async function clearHistory(userId) {
  try {
    const res = await fetch(`${WORKER_URL}/history`, {
      method:  "DELETE",
      headers: { "X-User-Id": userId }
    });
    return res.ok;
  } catch (err) {
    console.error("[ConvManager] clearHistory error:", err);
    return false;
  }
}

// ── Send a message and stream the response ─────────────────────
// onChunk(text)      — called for each streamed text chunk
// onDone(usageInfo)  — called when stream finishes { used, remaining }
// onError(message)   — called on error
export async function sendMessage(userId, message, { onChunk, onDone, onError }, signal) {
  try {
    const res = await fetch(`${WORKER_URL}/chat`, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Id":    userId
      },
      body: JSON.stringify({ message }),
      signal
    });

    // Handle rate limit (429) or other errors
    if (!res.ok) {
      let errData;
      try { errData = await res.json(); } catch { errData = {}; }

      if (res.status === 429 && errData.limitReached) {
        onError?.({ type: "limit", message: errData.error, resetAt: errData.resetAt, limit: errData.limit });
      } else {
        onError?.({ type: "error", message: errData.error || "Request failed." });
      }
      return;
    }

    // ── Read SSE stream ───────────────────────────────────────
    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        try {
          const parsed = JSON.parse(raw);

          if (parsed.error) {
            onError?.({ type: "error", message: parsed.error });
            return;
          }

          if (parsed.content) {
            onChunk?.(parsed.content);
          }

          if (parsed.done) {
            onDone?.({ used: parsed.used, remaining: parsed.remaining, limit: parsed.limit });
          }

        } catch {
          // Skip malformed SSE lines
        }
      }
    }

  } catch (err) {
    if (err.name === "AbortError") {
      onDone?.({});
      return;
    }
    console.error("[ConvManager] sendMessage error:", err);
    onError?.({ type: "error", message: "Network error. Please check your connection." });
  }
}