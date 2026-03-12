// ================================================================
// chatbot.js — Ask Krrish · Gemini-style UI
// ================================================================

import { getStatus, loadHistory, clearHistory, sendMessage } from "./conversationManager.js";

let messagesEl, inputEl, sendBtn, usageBarEl, usageTextEl,
    limitBannerEl, clearBtn, typingEl, welcomeEl;

let currentUserId    = null;
let currentUserName  = null;
let currentUserEmail = null;
let isStreaming       = false;
let abortController  = null;

// ── Init ───────────────────────────────────────────────────────
export async function initChat(user) {
  currentUserId    = user.uid;
  currentUserName  = user.displayName || "Anonymous";
  currentUserEmail = user.email || "";

  messagesEl    = document.getElementById("chat-messages");
  inputEl       = document.getElementById("chat-input");
  sendBtn       = document.getElementById("chat-send-btn");
  usageBarEl    = document.getElementById("usage-bar");
  usageTextEl   = document.getElementById("usage-text");
  limitBannerEl = document.getElementById("limit-banner");
  clearBtn      = document.getElementById("clear-chat-btn");
  typingEl      = document.getElementById("typing-indicator");
  welcomeEl     = document.getElementById("welcome-state");

  sendBtn.addEventListener("click", () => {
    if (isStreaming) { abortController?.abort(); return; }
    handleSend();
  });
  inputEl.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
  inputEl.addEventListener("input", autoResize);
  clearBtn?.addEventListener("click", handleClear);

  // ── Mobile keyboard: scroll to latest message when keyboard opens ──
  inputEl.addEventListener("focus", () => {
    setTimeout(scrollBottom, 350);
  });
  // visualViewport fires on every keyboard resize (Android + iOS)
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scrollBottom);
  }

  // ── Clear modal handlers ──
  document.getElementById("clear-cancel-btn")?.addEventListener("click", hideClearModal);
  document.getElementById("clear-confirm-btn")?.addEventListener("click", async () => {
    hideClearModal();
    await clearHistory(currentUserId);
    Array.from(messagesEl.children).forEach(c => {
      if (!c.classList.contains("msgs-wrap")) c.remove();
    });
    showWelcome();
    showToast("Conversation cleared");
  });
  document.getElementById("clear-modal")?.addEventListener("click", e => {
    if (e.target.id === "clear-modal") hideClearModal();
  });

  const [status, history] = await Promise.all([
    getStatus(currentUserId),
    loadHistory(currentUserId)
  ]);

  updateUsage(status.used, status.limit);

  if (history.length > 0) {
    hideWelcome();
    const divider = document.createElement("div");
    divider.className = "history-divider";
    divider.innerHTML = `<div class="hdiv-line"></div><span class="hdiv-label"><i class="bi bi-clock-history"></i> Previous conversation</span><div class="hdiv-line"></div>`;
    messagesEl.appendChild(divider);
    history.forEach(msg => appendMessage(msg.role, msg.content, false));
    messagesEl.querySelectorAll(".code-wrap code").forEach(el => hljs?.highlightElement(el));
    scrollBottom();
  }

  if (status.remaining <= 0) showLimitBanner(status.resetAt);
  inputEl.focus();

  // ── Prefill from homepage redirect (?q=...) ──────────────────
  const urlParams = new URLSearchParams(window.location.search);
  const prefill   = urlParams.get('q');
  if (prefill) {
    inputEl.value = prefill;
    autoResize();
    // Clean URL so refresh doesn't re-send
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);
    // Auto-send after tiny delay so UI is ready
    setTimeout(() => handleSend(), 280);
  }
}

// ── Send ───────────────────────────────────────────────────────
async function handleSend() {
  if (isStreaming) return;
  const text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = "";
  autoResize();
  hideWelcome();

  appendMessage("user", text, true);
  scrollBottom();
  setTyping(true);
  setLocked(true);

  const bubble = createBotBubble();
  let fullReply = "";

  abortController = new AbortController();

  // Safety timeout — force-stop if stream never finishes after 45s
  const streamTimeout = setTimeout(() => {
    if (isStreaming) abortController?.abort();
  }, 45000);

  await sendMessage(currentUserId, text, {
    onChunk(chunk) {
      setTyping(false);
      fullReply += chunk;
      renderChunk(bubble, fullReply, true);
      scrollBottom();
    },
    onDone(usage) {
      clearTimeout(streamTimeout);
      setTyping(false);
      setLocked(false);
      isStreaming = false;
      abortController = null;
      renderChunk(bubble, fullReply, false);
      // Remove any lingering cursors
      document.querySelectorAll(".stream-cursor").forEach(el => el.remove());
      bubble.querySelectorAll(".code-wrap code").forEach(el => hljs?.highlightElement(el));
      if (usage?.used != null) {
        updateUsage(usage.used, usage.limit ?? 15);
        if (usage.remaining <= 0) showLimitBanner(null);
      }
      scrollBottom();
    },
    onError(err) {
      clearTimeout(streamTimeout);
      setTyping(false);
      setLocked(false);
      isStreaming = false;
      abortController = null;
      if (err.type === "limit") {
        bubble.closest(".msg-row")?.remove();
        showLimitBanner(err.resetAt);
        updateUsage(err.limit ?? 15, err.limit ?? 15);
      } else {
        bubble.innerHTML = `<span style="color:#f28b82;">⚠ ${err.message || "Something went wrong."}</span>`;
      }
      scrollBottom();
    }
  }, abortController.signal);
}

// ── Clear ──────────────────────────────────────────────────────
function handleClear() {
  if (isStreaming) return;
  showClearModal();
}
function showClearModal() { document.getElementById("clear-modal")?.classList.add("show"); }
function hideClearModal()  { document.getElementById("clear-modal")?.classList.remove("show"); }

// ── Toast ───────────────────────────────────────────────────────
function showToast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.querySelector(".toast-msg").textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2800);
}

// ── Append message ─────────────────────────────────────────────
// Gemini style:
// User   → right-aligned pill, no avatar
// Bot    → full width, small avatar, clean text
export function appendMessage(role, content, animate = true) {
  const row = document.createElement("div");
  row.className = `msg-row w-full${animate ? " msg-animate" : ""}`;

  if (role === "user") {
    row.innerHTML = `
      <div style="display:flex; justify-content:flex-end; padding: 0.4rem 0; max-width:740px; margin:0 auto; width:100%;">
        <div class="user-bubble">${escHtml(content)}</div>
      </div>`;
  } else {
    row.innerHTML = `
      <div style="display:flex; gap:14px; padding: 0.85rem 0; max-width:740px; margin:0 auto; width:100%;">
        <div class="bot-av-sm">K</div>
        <div class="bot-text" style="flex:1; word-break:break-word;">${fmtContent(content)}</div>
      </div>`;
  }

  messagesEl.appendChild(row);
  return row;
}

// ── Create empty bot bubble ────────────────────────────────────
function createBotBubble() {
  isStreaming = true;
  const row = document.createElement("div");
  row.className = "msg-row msg-animate w-full";
  row.innerHTML = `
    <div style="display:flex; gap:14px; padding: 0.85rem 0; max-width:740px; margin:0 auto; width:100%;">
      <div class="bot-av-sm">K</div>
      <div class="bot-text bot-content" style="flex:1; word-break:break-word;"></div>
    </div>`;
  messagesEl.appendChild(row);
  return row.querySelector(".bot-content");
}

// ── Stream chunk ───────────────────────────────────────────────
function renderChunk(el, text, cursor) {
  el.innerHTML = fmtContent(text) + (cursor ? '<span class="stream-cursor"></span>' : "");
}

// ── Usage ──────────────────────────────────────────────────────
function updateUsage(used, limit) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  if (usageBarEl) usageBarEl.style.width = pct + "%";
  if (usageTextEl) usageTextEl.textContent = `${used}/${limit}`;
}

// ── Limit banner ───────────────────────────────────────────────
function showLimitBanner(resetAt) {
  limitBannerEl?.classList.add("show");
  setLocked(true);
  if (resetAt) {
    const t  = new Date(resetAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
    const el = document.getElementById("limit-reset-time");
    if (el) el.textContent = `at ${t}`;
  }
  showRatingWidget();
}

// ── Helpers ────────────────────────────────────────────────────
function setTyping(on)   { typingEl?.classList.toggle("hidden", !on); }
function setLocked(lock) {
  if (inputEl) inputEl.disabled = lock;
  if (!sendBtn) return;
  if (lock) {
    sendBtn.innerHTML = '<i class="bi bi-stop-fill"></i>';
    sendBtn.disabled = false;
    sendBtn.classList.add("stop-mode");
  } else {
    sendBtn.innerHTML = '<i class="bi bi-arrow-up"></i>';
    sendBtn.disabled = (inputEl?.value.trim().length === 0);
    sendBtn.classList.remove("stop-mode");
  }
}
function hideWelcome() {
  if (welcomeEl) { welcomeEl.style.display = "none"; }
}
function showWelcome() {
  if (welcomeEl) { welcomeEl.style.display = "flex"; welcomeEl.style.flexDirection = "column"; }
}
function scrollBottom() {
  if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
}
function autoResize() {
  if (!inputEl) return;
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
}

// ── Format content ─────────────────────────────────────────────
function fmtContent(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/```([\w]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      const label    = lang ? lang.toLowerCase() : "code";
      const hljsLang = { apex: "java", soql: "sql", visualforce: "html" }[label] || label;
      const safeCode = code.replace(/\n/g, "&#10;");
      return `<div class="code-wrap"><div class="code-header"><span class="code-lang">${label}</span><button class="copy-btn" onclick="sfxCopyCode(this)"><i class="bi bi-clipboard"></i><span>Copy</span></button></div><pre class="code-block"><code class="language-${hljsLang}">${safeCode}</code></pre></div>`;
    })
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, "<br>");
}

// ── Copy code button handler ────────────────────────────────────
window.sfxCopyCode = function(btn) {
  const code = btn.closest(".code-wrap").querySelector("code").textContent;
  navigator.clipboard.writeText(code).then(() => {
    btn.innerHTML = '<i class="bi bi-check2"></i><span>Copied!</span>';
    btn.classList.add("copied");
    setTimeout(() => {
      btn.innerHTML = '<i class="bi bi-clipboard"></i><span>Copy</span>';
      btn.classList.remove("copied");
    }, 2000);
  }).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = code;
    ta.style.cssText = "position:fixed;opacity:0;";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    btn.innerHTML = '<i class="bi bi-check2"></i><span>Copied!</span>';
    btn.classList.add("copied");
    setTimeout(() => {
      btn.innerHTML = '<i class="bi bi-clipboard"></i><span>Copy</span>';
      btn.classList.remove("copied");
    }, 2000);
  });
};

// ── Rating widget ───────────────────────────────────────────────
let selectedRating = 0;
let ratingWidgetReady = false;

function setupRatingWidget() {
  if (ratingWidgetReady) return;
  ratingWidgetReady = true;
  const widget = document.getElementById("rating-widget");
  if (!widget) return;

  widget.querySelectorAll(".star-btn").forEach(star => {
    star.addEventListener("click", () => {
      selectedRating = parseInt(star.dataset.val);
      highlightStars(selectedRating);
    });
  });

  document.getElementById("rating-close-btn")?.addEventListener("click", () => {
    widget.classList.remove("show");
  });

  document.getElementById("rating-submit-btn").addEventListener("click", async () => {
    if (!selectedRating) return;
    const experience = document.getElementById("rating-experience").value.trim();
    const btn = document.getElementById("rating-submit-btn");
    btn.disabled = true;
    btn.textContent = "Submitting…";
    try {
      await submitVote(currentUserId, {
        name: currentUserName, email: currentUserEmail,
        rating: selectedRating, experience
      });
      widget.innerHTML = `
        <div class="rating-inner">
          <div class="rating-thanks">
            <i class="bi bi-check-circle" style="color:#4ade80;font-size:1.4rem;"></i>
            <div>
              <div style="font-weight:500;color:var(--t);">Thanks for your feedback!</div>
              <div style="font-size:.78rem;color:var(--t3);margin-top:2px;">Your response has been recorded.</div>
            </div>
          </div>
        </div>`;
      setTimeout(() => widget.classList.remove("show"), 2500);
    } catch {
      btn.disabled = false;
      btn.textContent = "Submit Feedback";
    }
  });
}

function highlightStars(val) {
  document.querySelectorAll("#rating-widget .star-btn").forEach(s => {
    s.classList.toggle("active", parseInt(s.dataset.val) <= val);
  });
  document.querySelectorAll(".fstar").forEach(s => {
    s.classList.toggle("active", parseInt(s.dataset.val) <= val);
  });
}

function showRatingWidget() {
  setupRatingWidget();
  const widget = document.getElementById("rating-widget");
  widget?.classList.add("show");
}

window.sfxOpenRating = function(val) {
  selectedRating = val;
  showRatingWidget();
  highlightStars(val);
  document.getElementById("rating-widget")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
};

async function submitVote(userId, { name, email, rating, experience }) {
  const res = await fetch("https://krrishchatbot.krrishjoshijoshi.workers.dev/vote", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "X-User-Id": userId },
    body:    JSON.stringify({ name, email, rating, experience })
  });
  if (!res.ok) throw new Error("Vote failed");
}

function escHtml(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}