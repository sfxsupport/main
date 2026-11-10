(function () {
  'use strict';

  var groveOrigin = 'https://grove.sfxsupport.com';
  // Every SFX form sends to the one lead inbox (~/sfx-leads).
  var leadsEndpoint = 'https://leads.sfxsupport.com/api/leads';
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
      term: params.get('utm_term') || '',
      content: params.get('utm_content') || '',
      gclid: params.get('gclid') || '',
      // The site the visitor came from, before any click inside our site.
      referrer: document.referrer && document.referrer.indexOf(window.location.origin) !== 0 ? document.referrer : ''
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
        // A tap on WhatsApp, email or call is interest, not a lead: many people
        // open WhatsApp and never send anything. Only a submitted enquiry form
        // fires generate_lead (see wireLeadForm), so ad reports count real leads.
        var isContactAction = /whatsapp|email|call/.test(ctaName);
        track(isContactAction ? 'contact_click' : 'select_content', {
          cta_name: ctaName,
          content_type: isContactAction ? 'contact_action' : 'campaign_link',
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
      var avatarHue = person.name.split('').reduce(function (total, character) { return total + character.charCodeAt(0); }, 0) % 360;
      var avatar = person.avatarUrl || '';
      var avatarUrl = avatar.indexOf('/') === 0 ? groveOrigin + avatar : avatar;
      var media = '<span class="contributor-card__avatar" style="--avatar-hue:' + avatarHue + '">' +
        '<span class="contributor-card__initials" aria-hidden="true">' + safeText(initials) + '</span>' +
        (avatarUrl ? '<img class="contributor-card__photo" src="' + safeText(avatarUrl) + '" alt="" width="62" height="62" loading="lazy" data-contributor-photo>' : '') +
        '</span>';
      return '<a class="contributor-card" href="' + groveOrigin + '/u/' + encodeURIComponent(person.userId) + '" target="_blank" rel="noopener">' +
        media +
        '<strong>' + safeText(person.name) + '</strong>' +
        '<small>' + Number(person.projectCount || 0) + ' projects · ' + Number(person.badgeCount || 0) + ' badges</small>' +
        '</a>';
    }).join('');

    grid.querySelectorAll('[data-contributor-photo]').forEach(function (photo) {
      function showPhoto() { if (photo.naturalWidth > 0) photo.classList.add('is-ready'); }
      function removeBrokenPhoto() { photo.remove(); }
      photo.addEventListener('load', showPhoto, { once: true });
      photo.addEventListener('error', removeBrokenPhoto, { once: true });
      if (photo.complete) {
        if (photo.naturalWidth > 0) showPhoto();
        else removeBrokenPhoto();
      }
    });
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

  function wireLeadForm(context) {
    var form = document.querySelector('[data-lead-form]');
    if (!form) return;
    var status = form.querySelector('[data-lead-status]');
    var submit = form.querySelector('[data-lead-submit]');
    var started = false;

    function setStatus(message, kind) {
      status.textContent = message;
      status.className = 'lead-form__status' + (kind ? ' is-' + kind : '');
    }

    function markInvalid(field, message) {
      field.setAttribute('aria-invalid', 'true');
      field.focus();
      setStatus(message, 'error');
    }

    form.addEventListener('input', function (event) {
      event.target.removeAttribute('aria-invalid');
      if (!started) {
        started = true;
        track('form_start', { form_name: 'batch_enquiry', page_path: window.location.pathname });
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var data = new FormData(form);
      var name = String(data.get('name') || '').trim();
      var phoneDigits = String(data.get('phone') || '').replace(/\D/g, '');
      var email = String(data.get('email') || '').trim();

      if (name.length < 2) return markInvalid(form.elements.name, 'Please enter your name.');
      if (phoneDigits.length < 8 || phoneDigits.length > 15) return markInvalid(form.elements.phone, 'Please enter a valid WhatsApp number.');
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return markInvalid(form.elements.email, 'That email address doesn’t look right.');
      if (!data.get('background')) return markInvalid(form.elements.background, 'Please choose where you are right now.');

      submit.disabled = true;
      setStatus('Sending…');

      var payload = {
        product: 'grove',
        form: 'batch_enquiry',
        batch: '2026-12-01',
        batchFee: 'INR 6000',
        name: name,
        phone: String(data.get('phone') || ''),
        email: email,
        background: String(data.get('background') || ''),
        message: String(data.get('message') || ''),
        website: String(data.get('website') || ''),
        utmSource: context.source || '',
        utmMedium: context.medium || '',
        utmCampaign: context.campaign || '',
        utmTerm: context.term || '',
        utmContent: context.content || '',
        gclid: context.gclid || '',
        referrer: context.referrer || '',
        pagePath: window.location.pathname
      };

      // text/plain keeps this a "simple" cross-origin request (no preflight).
      fetch(leadsEndpoint, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(payload)
      })
        .then(function (response) {
          return response.json().catch(function () { return {}; }).then(function (json) {
            if (!response.ok) throw new Error(json.error || 'Something went wrong. Please try WhatsApp instead.');
            return json;
          });
        })
        .then(function (json) {
          form.classList.add('is-done');
          setStatus('Thanks, ' + name.split(' ')[0] + '! We’ll message you on WhatsApp soon.', 'success');
          if (!json.duplicate) {
            track('generate_lead', {
              form_name: 'batch_enquiry',
              lead_background: payload.background,
              campaign_source: context.source || 'direct',
              campaign_name: context.campaign || 'none',
              page_path: window.location.pathname
            });
            var adsConversion = document.body.getAttribute('data-ads-lead-conversion');
            if (adsConversion) track('conversion', { send_to: adsConversion });
          }
        })
        .catch(function (error) {
          submit.disabled = false;
          setStatus(error.message || 'Something went wrong. Please try WhatsApp instead.', 'error');
        });
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
  wireLeadForm(campaignContext);
  loadLiveProof();
  wireYouTube();
  wireReveals();
  wireHeader();
})();
