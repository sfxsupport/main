(function () {
  var grove = 'https://grove.sfxsupport.com';
  function esc(v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

  // Ask Krrish: chips fill the box, form opens the chatbot with the question
  var form = document.querySelector('[data-chat-form]');
  var input = form && form.querySelector('input');
  document.querySelectorAll('[data-chat-chips] button').forEach(function (b) {
    b.addEventListener('click', function () { input.value = b.textContent; input.focus(); });
  });
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = input.value.trim();
    window.location.href = '/chatbot/' + (q ? '?q=' + encodeURIComponent(q) : '');
  });

  // Live numbers from SFX Grove
  fetch(grove + '/api/public/stats').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
    var n = document.querySelector('[data-learner-count]');
    if (n && Number(d.totalLearners) > 0) n.textContent = Number(d.totalLearners).toLocaleString('en-IN');
  }).catch(function () {});

  var grid = document.querySelector('[data-contributor-grid]');
  fetch(grove + '/api/public/contributors').then(function (r) { if (!r.ok) throw 0; return r.json(); }).then(function (d) {
    var all = (Array.isArray(d) ? d : d.contributors || []).filter(function (p) { return p && p.userId && p.name && p.name !== 'SFX Support'; });
    var c = document.querySelector('[data-contributor-count]');
    if (c && all.length) c.textContent = all.length.toLocaleString('en-IN');
    if (!grid || !all.length) throw 0;
    all.sort(function (a, b) { return ((b.projectCount || 0) + (b.badgeCount || 0)) - ((a.projectCount || 0) + (a.badgeCount || 0)); });
    grid.innerHTML = all.slice(0, 12).map(function (p) {
      var ini = p.name.split(/\s+/).slice(0, 2).map(function (s) { return s.charAt(0); }).join('').toUpperCase();
      var hue = p.name.split('').reduce(function (t, ch) { return t + ch.charCodeAt(0); }, 0) % 360;
      var av = p.avatarUrl ? (p.avatarUrl.indexOf('/') === 0 ? grove + p.avatarUrl : p.avatarUrl) : '';
      return '<a class="contributor-card" href="' + grove + '/u/' + encodeURIComponent(p.userId) + '" target="_blank" rel="noopener">' +
        '<span class="contributor-card__avatar" style="--avatar-hue:' + hue + '"><span class="contributor-card__initials" aria-hidden="true">' + esc(ini) + '</span>' +
        (av ? '<img class="contributor-card__photo" src="' + esc(av) + '" alt="" width="62" height="62" loading="lazy" data-photo>' : '') + '</span>' +
        '<strong>' + esc(p.name) + '</strong><small>' + Number(p.projectCount || 0) + ' projects · ' + Number(p.badgeCount || 0) + ' badges</small></a>';
    }).join('');
    grid.querySelectorAll('[data-photo]').forEach(function (img) {
      img.addEventListener('load', function () { if (img.naturalWidth) img.classList.add('is-ready'); }, { once: true });
      img.addEventListener('error', function () { img.remove(); }, { once: true });
      if (img.complete) { if (img.naturalWidth) img.classList.add('is-ready'); else img.remove(); }
    });
  }).catch(function () {
    if (grid) grid.innerHTML = '<p class="home-more"><a href="/contributors/">See every public contributor profile →</a></p>';
  });
})();
