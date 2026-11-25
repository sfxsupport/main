/* SFX tracking: AI-assistant referrals and key engagement events, sent to GA4. */
(function () {
  function send(name, params) {
    try { if (typeof window.gtag === 'function') window.gtag('event', name, params || {}); } catch (e) {}
  }
  var path = location.pathname;

  // 1. Visits that come from AI assistants and answer engines
  var AI = [
    ['chatgpt', /(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$|^openai\.com$/],
    ['perplexity', /(^|\.)perplexity\.ai$/],
    ['gemini', /^gemini\.google\.com$|^bard\.google\.com$/],
    ['copilot', /^copilot\.microsoft\.com$|^edgeservices\.bing\.com$/],
    ['claude', /(^|\.)claude\.ai$/],
    ['deepseek', /(^|\.)deepseek\.com$/],
    ['meta_ai', /^www\.meta\.ai$|^meta\.ai$/],
    ['grok', /^grok\.com$|^x\.ai$/],
    ['you', /(^|\.)you\.com$/],
    ['phind', /(^|\.)phind\.com$/]
  ];
  var src = '', host = '';
  try { host = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
  var utm = (new URLSearchParams(location.search).get('utm_source') || '').toLowerCase();
  for (var i = 0; i < AI.length && !src; i++) {
    if (AI[i][1].test(host) || (utm && utm.indexOf(AI[i][0].replace('_', '')) !== -1)) src = AI[i][0];
  }
  if (!src && /openai|chatgpt/.test(utm)) src = 'chatgpt';
  if (src) {
    send('ai_referral', { ai_source: src, landing_page: path, referrer_host: host || '(utm)' });
    try { sessionStorage.setItem('sfx_ai_src', src); } catch (e) {}
  }
  var aiSession = ''; try { aiSession = sessionStorage.getItem('sfx_ai_src') || ''; } catch (e) {}

  document.addEventListener('DOMContentLoaded', function () {
    // 2. Code copied from a guide
    document.addEventListener('copy', function () {
      var sel = window.getSelection && window.getSelection();
      var node = sel && sel.anchorNode;
      var el = node && (node.nodeType === 1 ? node : node.parentElement);
      if (el && el.closest && el.closest('pre, code')) send('code_copy', { page: path, ai_source: aiSession });
    });
    // 3. FAQ questions opened
    document.querySelectorAll('details').forEach(function (d) {
      d.addEventListener('toggle', function () {
        if (!d.open) return;
        var s = d.querySelector('summary');
        send('faq_open', { page: path, question: s ? s.textContent.trim().slice(0, 100) : '' });
      });
    });
    // 4. Clicks to products, services, training and contact
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      var h = a.getAttribute('href') || '', kind = '';
      if (/grove\.sfxsupport\.com/.test(h)) kind = 'grove';
      else if (/forge\.sfxsupport\.com/.test(h)) kind = 'forge';
      else if (/^\/chatbot\//.test(h)) kind = 'ask_krrish';
      else if (/^\/debug-log-analyzer\//.test(h)) kind = 'debug_analyzer';
      else if (/^\/travel-manager\//.test(h)) kind = 'travel_manager';
      else if (/^\/services\//.test(h)) kind = 'services';
      else if (/^\/salesforce-training\//.test(h)) kind = 'training';
      else if (/wa\.me\/|^mailto:|^tel:|^\/contact\//.test(h)) kind = 'contact';
      if (kind) send('cta_click', { target: kind, page: path, ai_source: aiSession });
    }, true);
  });
})();
