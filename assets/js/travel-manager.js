(function () {
  'use strict';

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

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var data = new FormData(form);
    var name = String(data.get('name') || '').trim();
    var phone = String(data.get('phone') || '').trim();
    var email = String(data.get('email') || '').trim();
    var businessType = String(data.get('business_type') || '').trim();
    var fleetSize = String(data.get('fleet_size') || '').trim();
    var businessName = String(data.get('business_name') || '').trim();
    var message = String(data.get('message') || '').trim();

    if (name.length < 2) return invalidate(form.elements.name, 'Please enter your name.');
    if (phone.replace(/\D/g, '').length < 7) return invalidate(form.elements.phone, 'Please enter a valid phone or WhatsApp number.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return invalidate(form.elements.email, 'Please enter a valid email address.');
    if (!businessType) return invalidate(form.elements.business_type, 'Please choose your business type.');
    if (!fleetSize) return invalidate(form.elements.fleet_size, 'Please choose the number of vehicles you manage.');

    submit.disabled = true;
    setStatus('Sending your request…');

    var details = [];
    if (businessName) details.push('Business: ' + businessName);
    details.push('Business type: ' + businessType);
    details.push('Fleet size: ' + fleetSize);
    if (message) details.push('Requirement: ' + message);

    var payload = {
      product: 'travel-manager',
      form: 'demo_enquiry',
      topic: 'SFX Travel Manager demo',
      name: name,
      phone: phone,
      email: email,
      background: businessType,
      message: details.join('\n'),
      website: String(data.get('website') || ''),
      utmSource: params.get('utm_source') || '',
      utmMedium: params.get('utm_medium') || '',
      utmCampaign: params.get('utm_campaign') || '',
      utmTerm: params.get('utm_term') || '',
      utmContent: params.get('utm_content') || '',
      gclid: params.get('gclid') || '',
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
        setStatus('Thanks, ' + name.split(' ')[0] + '! Your demo request is registered. Our team will contact you shortly.', 'success');
        form.reset();
        if (!json.duplicate && typeof window.gtag === 'function') {
          window.gtag('event', 'generate_lead', {
            form_name: 'travel_manager_demo',
            lead_business_type: businessType,
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
