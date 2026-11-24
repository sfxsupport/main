(function () {
  'use strict';

  // Every SFX form sends to the one lead inbox (~/sfx-leads).
  var leadsEndpoint = 'https://leads.sfxsupport.com/api/leads';

  function track(name, details) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, details || {});
  }

  function getContext() {
    var params = new URLSearchParams(window.location.search);
    return {
      source: params.get('utm_source') || '',
      medium: params.get('utm_medium') || '',
      campaign: params.get('utm_campaign') || '',
      term: params.get('utm_term') || '',
      content: params.get('utm_content') || '',
      gclid: params.get('gclid') || '',
      referrer: document.referrer && document.referrer.indexOf(window.location.origin) !== 0 ? document.referrer : ''
    };
  }

  function wireTracking(context) {
    document.querySelectorAll('[data-cta]').forEach(function (link) {
      link.addEventListener('click', function () {
        var ctaName = link.getAttribute('data-cta');
        var isContactAction = /whatsapp|email|call/.test(ctaName);
        track(isContactAction ? 'contact_click' : 'select_content', {
          cta_name: ctaName,
          content_type: isContactAction ? 'contact_action' : 'services_link',
          campaign_source: context.source || 'direct',
          page_path: window.location.pathname
        });
      });
    });
  }

  function wireForm(context) {
    var form = document.querySelector('[data-services-form]');
    if (!form) return;
    var status = form.querySelector('[data-services-status]');
    var submit = form.querySelector('[data-services-submit]');
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
        track('form_start', { form_name: 'services_enquiry', page_path: window.location.pathname });
      }
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var data = new FormData(form);
      var name = String(data.get('name') || '').trim();
      var email = String(data.get('email') || '').trim();
      var company = String(data.get('company') || '').trim();
      var phone = String(data.get('phone') || '').trim();
      var message = String(data.get('message') || '').trim();
      var budget = String(data.get('budget') || '');

      if (name.length < 2) return markInvalid(form.elements.name, 'Please enter your name.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return markInvalid(form.elements.email, 'Please enter a valid email address.');
      if (company.length < 2) return markInvalid(form.elements.company, 'Please enter your company name.');
      var digits = phone.replace(/\D/g, '');
      if (phone && (digits.length < 8 || digits.length > 15)) return markInvalid(form.elements.phone, 'That phone number doesn’t look right.');
      if (!data.get('need')) return markInvalid(form.elements.need, 'Please choose what you need.');
      if (!data.get('timeline')) return markInvalid(form.elements.timeline, 'Please choose when you need it.');
      if (message.length < 10) return markInvalid(form.elements.message, 'Please describe the problem in a sentence or two.');

      submit.disabled = true;
      setStatus('Sending…');

      var payload = {
        product: 'contact',
        form: 'services_enquiry',
        name: name,
        email: email,
        phone: phone,
        company: company,
        topic: String(data.get('need') || ''),
        background: String(data.get('timeline') || ''),
        message: (budget ? 'Budget: ' + budget + '\n\n' : '') + message,
        website: String(data.get('website') || ''),
        utmSource: context.source,
        utmMedium: context.medium,
        utmCampaign: context.campaign,
        utmTerm: context.term,
        utmContent: context.content,
        gclid: context.gclid,
        referrer: context.referrer,
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
            if (!response.ok) throw new Error(json.error || 'Something went wrong. Please email founders@sfxsupport.com instead.');
            return json;
          });
        })
        .then(function (json) {
          form.classList.add('is-done');
          setStatus('Thanks, ' + name.split(' ')[0] + '. We’ve got your project details and will reply within one working day.', 'success');
          if (!json.duplicate) {
            track('generate_lead', {
              form_name: 'services_enquiry',
              service_need: payload.topic,
              campaign_source: context.source || 'direct',
              page_path: window.location.pathname
            });
          }
        })
        .catch(function (error) {
          submit.disabled = false;
          setStatus(error.message || 'Something went wrong. Please email founders@sfxsupport.com instead.', 'error');
        });
    });
  }

  function wireHeader() {
    var header = document.querySelector('[data-campaign-header]');
    if (!header) return;
    function update() { header.classList.toggle('is-scrolled', window.scrollY > 8); }
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  function wireReveals() {
    document.querySelectorAll('.reveal').forEach(function (node) { node.classList.add('is-visible'); });
  }

  // Hide the sticky phone bar while the hero buttons or the form are on screen.
  function wireMobileCta() {
    var bar = document.querySelector('[data-mobile-cta]');
    var targets = [document.querySelector('.hero__actions'), document.getElementById('enquire')].filter(Boolean);
    if (!bar || !targets.length || !('IntersectionObserver' in window)) return;
    var visible = new Set();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.add(entry.target); else visible.delete(entry.target);
      });
      bar.classList.toggle('is-hidden', visible.size > 0);
    }, { threshold: 0 });
    targets.forEach(function (target) { observer.observe(target); });
  }

  var context = getContext();
  wireTracking(context);
  wireForm(context);
  wireHeader();
  wireReveals();
  wireMobileCta();
})();
