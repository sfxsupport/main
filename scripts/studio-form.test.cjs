const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync(require('node:path').join(__dirname, '../assets/js/studio.js'), 'utf8');
function fixture({ response = { ok: true, duplicate: false }, httpOk = true, reject, values = {}, search = '', stored = '{}', storageThrows = false } = {}) {
  const fields = { name: 'Test Person', email: 'test@example.invalid', phone: '', company: 'Example', topic: 'Salesforce development', budget: 'To discuss', timing: 'Within 2 weeks', message: 'Please help fix a record-triggered flow.', website: '', ...values };
  const events = {}; const status = { dataset: {}, textContent: '' }; const button = { disabled: false }; const calls = []; const analytics = [];
  const elements = Object.fromEntries(Object.keys(fields).map(key => [key, { value: fields[key], setAttribute() {}, focus() {} }]));
  elements.topic.options = [{ value: 'Salesforce development' }, { value: 'Apex or Flow fix' }];
  const form = { elements, querySelector: selector => selector === '[data-project-status]' ? status : button, addEventListener: (type, handler) => events[type] = handler, reportValidity: () => true, reset() { this.resetCalled = true; } };
  const sessionStorage = { getItem() { if (storageThrows) throw Error('blocked'); return stored; }, setItem(k, v) { if (storageThrows) throw Error('blocked'); stored = v; } };
  const document = { referrer: '', querySelectorAll: () => [], querySelector: () => form };
  const fetch = async (url, init) => { calls.push({ url, payload: JSON.parse(init.body), init }); if (reject) throw reject; return { ok: httpOk, json: async () => response }; };
  const ctx = { document, location: { search, pathname: '/contact/', origin: 'https://sfxsupport.com' }, sessionStorage, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, fetch, FormData: class { get(key) { return key === 'topic' ? elements.topic.value : fields[key]; } }, window: { gtag: (...args) => analytics.push(args) } };
  vm.runInNewContext(code, ctx);
  return { fields, elements, form, status, button, calls, analytics, stored: () => JSON.parse(stored), submit: () => events.submit({ preventDefault() {} }) };
}
test('successful enquiry uses the existing API contract and only then records a lead', async () => {
  const f = fixture(); await f.submit(); assert.equal(f.calls.length, 1); assert.equal(f.calls[0].payload.product, 'contact'); assert.equal(f.calls[0].payload.form, 'development_enquiry'); assert.ok(f.calls[0].payload.message.includes('Within 2 weeks')); assert.equal(f.status.dataset.state, 'success'); assert.ok(f.form.resetCalled); assert.equal(f.button.disabled, false); assert.equal(f.analytics.filter(a => a[1] === 'generate_lead').length, 1); assert.ok(!JSON.stringify(f.analytics).includes('test@example.invalid'));
});
test('a duplicate success does not inflate lead counts', async () => { const f = fixture({ response: { ok: true, duplicate: true } }); await f.submit(); assert.equal(f.status.dataset.state, 'success'); assert.equal(f.analytics.length, 0); });
test('API errors preserve the form, re-enable retry, and never record a lead', async () => { const f = fixture({ response: { error: 'Please retry' }, httpOk: false }); await f.submit(); assert.equal(f.status.dataset.state, 'error'); assert.ok(!f.form.resetCalled); assert.equal(f.button.disabled, false); assert.equal(f.analytics.length, 0); });
test('an unconfirmed 200 response cannot falsely show success', async () => { const f = fixture({ response: {} }); await f.submit(); assert.equal(f.status.dataset.state, 'error'); assert.ok(!f.form.resetCalled); });
test('network failure and timeout retain the visitor’s details', async () => { for (const error of [new Error('Offline'), Object.assign(new Error('Timeout'), { name: 'AbortError' })]) { const f = fixture({ reject: error }); await f.submit(); assert.equal(f.status.dataset.state, 'error'); assert.ok(!f.form.resetCalled); assert.equal(f.button.disabled, false); assert.equal(f.analytics.length, 0); } });
test('short message, bad phone, bad email, and short name never submit', async () => { for (const values of [{ message: 'Hi' }, { phone: '12' }, { email: 'bad' }, { name: 'A' }]) { const f = fixture({ values }); await f.submit(); assert.equal(f.calls.length, 0); assert.equal(f.status.dataset.state, 'error'); } });
test('attribution survives internal navigation and service links preselect the form', async () => { const f = fixture({ search: '?service=Apex+or+Flow+fix', stored: JSON.stringify({ utm_source: 'linkedin', utm_campaign: 'first_client' }) }); await f.submit(); assert.equal(f.calls[0].payload.topic, 'Apex or Flow fix'); assert.equal(f.calls[0].payload.utmSource, 'linkedin'); assert.equal(f.calls[0].payload.utmCampaign, 'first_client'); });
test('new campaign replaces previous campaign without stale parameters', async () => { const f = fixture({ search: '?utm_source=referral', stored: JSON.stringify({ utm_source: 'old', gclid: 'stale' }) }); await f.submit(); assert.equal(f.calls[0].payload.utmSource, 'referral'); assert.equal(f.calls[0].payload.gclid, ''); });
test('blocked session storage does not stop enquiries', async () => { const f = fixture({ storageThrows: true }); await f.submit(); assert.equal(f.status.dataset.state, 'success'); });
test('community enquiries are classified separately', async () => { const f = fixture({ values: { topic: 'Community or resource question' } }); await f.submit(); assert.equal(f.calls[0].payload.form, 'community_enquiry'); });
test('unknown service links cannot inject a form option', async () => { const f = fixture({ search: '?service=evil' }); await f.submit(); assert.equal(f.calls[0].payload.topic, 'Salesforce development'); });
