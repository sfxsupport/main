(function () {
  'use strict';

  function track(name, details) {
    if (typeof window.gtag !== 'function') return;
    window.gtag('event', name, details || {});
  }

  function trackConversion() {
    var adsConversion = document.body.getAttribute('data-ads-lead-conversion');
    if (adsConversion) track('conversion', { send_to: adsConversion });
  }

  // WhatsApp, call and email taps count as leads too.
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href');
    var type = href.indexOf('wa.me/') !== -1 ? 'whatsapp' : href.indexOf('tel:') === 0 ? 'call' : href.indexOf('mailto:') === 0 ? 'email' : '';
    if (!type) return;
    track('contact_click', { method: type, link_text: link.textContent.trim().slice(0, 60), page_path: window.location.pathname });
    if (type !== 'email') trackConversion();
  });

  var form = document.getElementById('travel-manager-lead-form');
  if (!form) return;

  var endpoint = 'https://leads.sfxsupport.com/api/leads';
  var submit = form.querySelector('button[type="submit"]');
  var status = document.getElementById('travel-manager-form-status');
  var params = new URLSearchParams(window.location.search);
  var referrer = document.referrer && document.referrer.indexOf(window.location.origin) !== 0 ? document.referrer : '';

  function setStatus(message, type) {
    status.textContent = message;
    status.className = 'tm-form-status' + (type ? ' is-' + type : '');
  }

  function invalidate(field, message) {
    field.setAttribute('aria-invalid', 'true');
    setStatus(message, 'error');
    field.focus();
  }

  form.addEventListener('input', function (event) {
    if (event.target.removeAttribute) event.target.removeAttribute('aria-invalid');
  });

  // keep the ad / campaign source for the whole visit, as the app's welcome page does
  var source = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'].forEach(function (k) { if (params.get(k)) source[k] = params.get(k); });
  try {
    if (Object.keys(source).length) sessionStorage.setItem('sfx-tm-src', JSON.stringify(source));
    else source = JSON.parse(sessionStorage.getItem('sfx-tm-src') || '{}');
  } catch (e) {}

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var data = new FormData(form);
    var name = String(data.get('name') || '').trim();
    var phone = String(data.get('phone') || '').trim();
    var email = String(data.get('email') || '').trim();
    var company = String(data.get('company') || '').trim();
    var city = String(data.get('city') || '').trim();
    var fleetSize = String(data.get('fleet_size') || '').trim();
    var message = String(data.get('message') || '').trim();
    var digits = phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');

    if (name.length < 2) return invalidate(form.elements.name, 'Please enter your name.');
    if (!/^[6-9]\d{9}$/.test(digits)) return invalidate(form.elements.phone, 'Please enter a 10-digit mobile number.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return invalidate(form.elements.email, 'Please check the email address, or leave it empty.');

    submit.disabled = true;
    setStatus('Sending your request…');

    var details = [];
    if (fleetSize) details.push('Fleet size: ' + fleetSize);
    if (message) details.push('Requirement: ' + message);

    var payload = {
      product: 'travel_manager',
      form: 'demo_request',
      topic: 'SFX Travel Manager demo',
      name: name,
      phone: digits,
      email: email,
      company: company,
      city: city,
      background: fleetSize ? 'Fleet ' + fleetSize : '',
      message: details.join('\n'),
      website: String(data.get('website') || ''),
      utmSource: source.utm_source || '',
      utmMedium: source.utm_medium || '',
      utmCampaign: source.utm_campaign || '',
      utmTerm: source.utm_term || '',
      utmContent: source.utm_content || '',
      gclid: source.gclid || '',
      referrer: referrer,
      pagePath: window.location.pathname
    };

    fetch(endpoint, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload)
    })
      .then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (json) {
          if (!response.ok) throw new Error(json.error || 'We could not send the request. Please try WhatsApp instead.');
          return json;
        });
      })
      .then(function (json) {
        setStatus('Thanks, ' + name.split(' ')[0] + '! We will call you to fix a demo time, usually within a few hours on working days.', 'success');
        form.reset();
        submit.disabled = false;
        if (!json.duplicate) {
          trackConversion();
          track('generate_lead', {
            form_name: 'travel_manager_demo',
            lead_fleet_size: fleetSize,
            page_path: window.location.pathname
          });
        }
      })
      .catch(function (error) {
        submit.disabled = false;
        setStatus(error.message || 'We could not send the request. Please try WhatsApp instead.', 'error');
      });
  });
})();
