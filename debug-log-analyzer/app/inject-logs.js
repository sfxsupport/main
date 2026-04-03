/**
 * Chrome Extension Bridge — runs directly on the analyzer extension page.
 * Extension pages have full chrome.* access, so we can read pendingLogs
 * from storage and post them into the React app via window.postMessage.
 */
(function () {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;

  const FRESHNESS_MS = 5 * 60 * 1000; // 5 minutes

  function tryInject() {
    chrome.storage.local.get(['pendingLogs', 'pendingLogsTimestamp', 'sfUserName'], function (result) {
      // Send user's display name so the analyzer can greet them
      if (result.sfUserName) {
        window.postMessage({ type: 'SET_DISPLAY_NAME', payload: result.sfUserName }, '*');
      }
      const logs = result.pendingLogs;
      const ts   = result.pendingLogsTimestamp || 0;

      if (!logs || logs.length === 0) return;

      if (Date.now() - ts > FRESHNESS_MS) {
        chrome.storage.local.remove(['pendingLogs', 'pendingLogsTimestamp']);
        return;
      }

      // Stagger each log by 150ms so the React store processes them sequentially
      logs.forEach(function (log, i) {
        setTimeout(function () {
          window.postMessage({
            type: 'INJECT_LOG',
            payload: {
              content:  log.content,
              filename: log.filename,
              orgName:  log.orgName,
            },
          }, '*');
        }, i * 150);
      });

      chrome.storage.local.remove(['pendingLogs', 'pendingLogsTimestamp']);
    });
  }

  // Wait for React to mount, then inject
  setTimeout(tryInject, 800);

  // Also handle the case where the analyzer tab was already open —
  // background.js sends an 'injectLogs' runtime message instead of opening a new tab
  chrome.runtime.onMessage.addListener(function (request) {
    if (request.action === 'injectLogs' && Array.isArray(request.logs)) {
      request.logs.forEach(function (log, i) {
        setTimeout(function () {
          window.postMessage({
            type: 'INJECT_LOG',
            payload: {
              content:  log.content,
              filename: log.filename,
              orgName:  log.orgName,
            },
          }, '*');
        }, i * 150);
      });
    }
  });
})();
