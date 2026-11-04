(function () {
  'use strict';

  var groveOrigin = 'https://grove.sfxsupport.com';
  var campaignKey = 'sfx_campaign_context';

  function safeText(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getCampaignContext() {
    var params = new URLSearchParams(window.location.search);
    var current = {
      source: params.get('utm_source') || '',
      medium: params.get('utm_medium') || '',
      campaign: params.get('utm_campaign') || '',
      term: params.get('utm_term') || ''
    };
    var hasCurrent = Object.keys(current).some(function (key) { return current[key]; });

    if (hasCurrent) {
      try { sessionStorage.setItem(campaignKey, JSON.stringify(current)); } catch (error) { /* storage can be unavailable */ }
      return current;
    }

    try {
      return JSON.parse(sessionStorage.getItem(campaignKey) || '{}');
    } catch (error) {
      return {};
    }
  }

  function addContextToWhatsApp(context) {
    var details = [];
    if (context.source) details.push('source: ' + context.source);
    if (context.campaign) details.push('campaign: ' + context.campaign);
    if (context.term) details.push('keyword: ' + context.term);
    if (!details.length) return;

    document.querySelectorAll('a[href*="wa.me/919414849173"]').forEach(function (link) {
      var url = new URL(link.href);
      var message = url.searchParams.get('text') || 'Hi SFX Support, I want to know about the next Salesforce batch.';
      url.searchParams.set('text', message + '\n\nCampaign context — ' + details.join(', '));
      link.href = url.toString();
    });
  }

  function track(name, details) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, details || {});
  }

  function wireTracking(context) {
    document.querySelectorAll('[data-cta]').forEach(function (link) {
      link.addEventListener('click', function () {
        var ctaName = link.getAttribute('data-cta');
        var isLeadAction = /whatsapp|email|call/.test(ctaName);
        track(isLeadAction ? 'generate_lead' : 'select_content', {
          cta_name: ctaName,
          content_type: isLeadAction ? 'contact_action' : 'campaign_link',
          campaign_source: context.source || 'direct',
          campaign_name: context.campaign || 'none',
          page_path: window.location.pathname
        });
      });
    });

    document.querySelectorAll('[data-track-video]').forEach(function (video) {
      var recorded = false;
      video.addEventListener('play', function () {
        if (recorded) return;
        recorded = true;
        track('video_start', { video_name: video.getAttribute('data-track-video'), page_path: window.location.pathname });
      });
    });
  }

  function renderContributors(contributors) {
    var grid = document.querySelector('[data-contributor-grid]');
    if (!grid) return;

    var selected = contributors
      .filter(function (person) { return person && person.userId && person.name && person.name !== 'SFX Support'; })
      .sort(function (a, b) {
        return ((b.projectCount || 0) + (b.badgeCount || 0)) - ((a.projectCount || 0) + (a.badgeCount || 0));
      })
      .slice(0, 12);

    if (!selected.length) throw new Error('No public contributors returned');

    grid.innerHTML = selected.map(function (person) {
      var initials = person.name.split(/\s+/).slice(0, 2).map(function (part) { return part.charAt(0); }).join('').toUpperCase();
      var avatar = person.avatarUrl || '';
      var avatarUrl = avatar.indexOf('/') === 0 ? groveOrigin + avatar : avatar;
      var media = avatarUrl
        ? '<img src="' + safeText(avatarUrl) + '" alt="" width="62" height="62" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="contributor-card__initials" hidden>' + safeText(initials) + '</span>'
        : '<span class="contributor-card__initials">' + safeText(initials) + '</span>';
      return '<a class="contributor-card" href="' + groveOrigin + '/u/' + encodeURIComponent(person.userId) + '" target="_blank" rel="noopener">' +
        media +
        '<strong>' + safeText(person.name) + '</strong>' +
        '<small>' + Number(person.projectCount || 0) + ' projects · ' + Number(person.badgeCount || 0) + ' badges</small>' +
        '</a>';
    }).join('');
  }

  function loadLiveProof() {
    var statsRequest = fetch(groveOrigin + '/api/public/stats', { mode: 'cors' })
      .then(function (response) { if (!response.ok) throw new Error('Stats unavailable'); return response.json(); })
      .then(function (data) {
        var learnerNode = document.querySelector('[data-learner-count]');
        if (learnerNode && Number(data.totalLearners)) learnerNode.textContent = Number(data.totalLearners).toLocaleString('en-IN');
      });

    var contributorsRequest = fetch(groveOrigin + '/api/public/contributors', { mode: 'cors' })
      .then(function (response) { if (!response.ok) throw new Error('Contributors unavailable'); return response.json(); })
      .then(function (data) {
        var contributors = Array.isArray(data) ? data : (data.contributors || []);
        var countNode = document.querySelector('[data-contributor-count]');
        if (countNode && contributors.length) countNode.textContent = contributors.length.toLocaleString('en-IN');
        renderContributors(contributors);
      });

    Promise.allSettled([statsRequest, contributorsRequest]).then(function (results) {
      if (results[1].status === 'rejected') {
        var grid = document.querySelector('[data-contributor-grid]');
        if (grid) {
          grid.className = 'contributor-grid is-fallback';
          grid.innerHTML = '<p>The live profile feed is temporarily unavailable. <a href="/contributors/">View all public contributors on the contributors page.</a></p>';
        }
      }
    });
  }

  function wireYouTube() {
    var container = document.querySelector('[data-youtube-playlist]');
    var button = document.querySelector('[data-youtube-load]');
    if (!container || !button) return;

    button.addEventListener('click', function () {
      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/videoseries?list=UUc1viN8c8g9PRCNX4RJU5HQ&autoplay=1';
      iframe.title = 'SFX Support Salesforce technical sessions playlist';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.allowFullscreen = true;
      container.innerHTML = '';
      container.appendChild(iframe);
      track('video_start', { video_name: 'youtube_playlist', page_path: window.location.pathname });
    }, { once: true });
  }

  function wireReveals() {
    var nodes = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(function (node) { node.classList.add('is-visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: '0px 0px -40px' });
    nodes.forEach(function (node) { observer.observe(node); });
  }

  function wireHeader() {
    var header = document.querySelector('[data-campaign-header]');
    if (!header) return;
    function update() { header.classList.toggle('is-scrolled', window.scrollY > 8); }
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  var campaignContext = getCampaignContext();
  addContextToWhatsApp(campaignContext);
  wireTracking(campaignContext);
  loadLiveProof();
  wireYouTube();
  wireReveals();
  wireHeader();
})();
