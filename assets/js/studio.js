(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const key = 'sfx_project_attribution';
  let context = {};
  try { context = JSON.parse(sessionStorage.getItem(key) || '{}'); } catch (_) { /* Storage is optional. */ }
  const incoming = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'].forEach(function (field) {
    const value = params.get(field);
    if (value) incoming[field] = value.slice(0, 200);
  });
  let externalReferrer = '';
  try { if (document.referrer && new URL(document.referrer).origin !== location.origin) externalReferrer = document.referrer; } catch (_) { /* Ignore invalid referrers. */ }
  if (Object.keys(incoming).length) context = Object.assign({ referrer: externalReferrer }, incoming);
  else if (!Object.keys(context).length && externalReferrer) context = { referrer: externalReferrer };
  try { sessionStorage.setItem(key, JSON.stringify(context)); } catch (_) { /* The form works without storage. */ }

  function track(name, details) {
    if (typeof window.gtag === 'function') window.gtag('event', name, Object.assign({ page_path: location.pathname }, details));
  }
  document.querySelectorAll('[data-sfx-cta]').forEach(function (link) {
    link.addEventListener('click', function () {
      track(/^(mailto:|tel:|https:\/\/wa\.me)/.test(link.href) ? 'contact_click' : 'select_content', { cta_name: link.dataset.sfxCta });
    });
  });
  document.querySelectorAll('.sfx-mobile-nav a').forEach(function (link) {
    link.addEventListener('click', function () { link.closest('details').removeAttribute('open'); });
  });
  const form = document.querySelector('[data-project-form]');
  if (!form) return;
  const status = form.querySelector('[data-project-status]');
  const button = form.querySelector('button[type="submit"]');
  const topic = params.get('service');
  if (topic && Array.from(form.elements.topic.options).some(function (option) { return option.value === topic; })) form.elements.topic.value = topic;
  let started = false;
  form.addEventListener('input', function (event) {
    event.target.removeAttribute('aria-invalid');
    if (!started) { started = true; track('form_start', { form_name: 'development_enquiry' }); }
  });
  function feedback(message, state) { status.textContent = message; status.dataset.state = state || ''; }
  function invalid(field, message) { field.setAttribute('aria-invalid', 'true'); field.focus(); feedback(message, 'error'); }
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (button.disabled) return;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const name = String(data.get('name') || '').trim();
    const email = String(data.get('email') || '').trim();
    const message = String(data.get('message') || '').trim();
    const phone = String(data.get('phone') || '').trim();
    if (name.length < 2) return invalid(form.elements.name, 'Please enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return invalid(form.elements.email, 'Please enter a valid email address.');
    if (phone && (phone.replace(/\D/g, '').length < 8 || phone.replace(/\D/g, '').length > 15)) return invalid(form.elements.phone, 'Please check the phone number, or leave it empty.');
    if (message.length < 15) return invalid(form.elements.message, 'Please add a little detail about what you need help with.');
    const isCommunity = data.get('topic') === 'Community or resource question';
    const payload = {
      product: 'contact', form: isCommunity ? 'community_enquiry' : 'development_enquiry',
      name: name, email: email, phone: phone, company: String(data.get('company') || '').trim(),
      topic: String(data.get('topic') || ''), website: String(data.get('website') || ''),
      message: ('Budget: ' + (data.get('budget') || 'To discuss') + '\nTiming: ' + (data.get('timing') || 'To discuss') + '\n\n' + message).slice(0, 1000),
      utmSource: context.utm_source || '', utmMedium: context.utm_medium || '', utmCampaign: context.utm_campaign || '',
      utmTerm: context.utm_term || '', utmContent: context.utm_content || '', gclid: context.gclid || '',
      referrer: context.referrer || '', pagePath: location.pathname
    };
    button.disabled = true;
    feedback('Sending your enquiry…');
    const controller = new AbortController();
    const timeout = setTimeout(function () { controller.abort(); }, 18000);
    try {
      const response = await fetch('https://leads.sfxsupport.com/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify(payload), signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'Your enquiry could not be saved. Please try again or use the email link.');
      feedback('Thank you, ' + name.split(/\s+/)[0] + '. Your enquiry has been received. We’ll reply by email to discuss the next step.', 'success');
      if (!result.duplicate && !payload.website) track('generate_lead', { form_name: payload.form, service: payload.topic, campaign_source: context.utm_source || 'direct' });
      form.reset();
      started = false;
    } catch (error) {
      feedback(error.name === 'AbortError' ? 'We couldn’t confirm delivery. Your details are still here. Please retry, or email founders@sfxsupport.com.' : 'We couldn’t send your enquiry. Your details are still here. ' + (error.message || 'Please retry or email founders@sfxsupport.com.'), 'error');
    } finally { clearTimeout(timeout); button.disabled = false; }
  });
})();
