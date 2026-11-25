(function () {
  var nav = document.querySelector('[data-site-nav]');
  var burger = document.querySelector('[data-burger]');
  var groups = Array.prototype.slice.call(document.querySelectorAll('[data-dropdown]'));
  var desktop = window.matchMedia('(min-width: 981px)');
  var hoverTimer;

  function setOpen(group, open) {
    var btn = group.querySelector('button');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    group.classList.toggle('is-open', open);
  }
  function closeAll(except) { groups.forEach(function (g) { if (g !== except) setOpen(g, false); }); }

  groups.forEach(function (g) {
    var btn = g.querySelector('button');
    btn.addEventListener('click', function () { if (g.dataset.hovered === '1') { g.dataset.hovered = ''; closeAll(g); setOpen(g, true); return; } var o = !g.classList.contains('is-open'); closeAll(g); setOpen(g, o); });
    g.addEventListener('mouseenter', function () { if (!desktop.matches) return; clearTimeout(hoverTimer); closeAll(g); setOpen(g, true); g.dataset.hovered = '1'; setTimeout(function () { g.dataset.hovered = ''; }, 400); });
    g.addEventListener('mouseleave', function () { if (!desktop.matches) return; hoverTimer = setTimeout(function () { setOpen(g, false); }, 150); });
  });

  function setMenu(open) {
    if (!burger || !nav) return;
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.documentElement.classList.toggle('menu-open', open);
    if (open) { var f = nav.querySelector('a, button'); if (f) f.focus(); } else { burger.focus(); }
  }
  if (burger) burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });

  // focus trap inside the open mobile menu
  document.addEventListener('keydown', function (e) {
    var menuOpen = document.documentElement.classList.contains('menu-open');
    if (e.key === 'Escape') {
      var openG = groups.filter(function (g) { return g.classList.contains('is-open'); })[0];
      if (openG && desktop.matches) { setOpen(openG, false); openG.querySelector('button').focus(); return; }
      if (menuOpen) setMenu(false);
      return;
    }
    if (e.key === 'Tab' && menuOpen) {
      var items = [burger].concat(Array.prototype.slice.call(nav.querySelectorAll('a, button'))).filter(function (el) { return el.offsetParent !== null; });
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('[data-dropdown]')) closeAll(); });
  if (nav) nav.addEventListener('click', function (e) { if (e.target.closest('a') && document.documentElement.classList.contains('menu-open')) { document.documentElement.classList.remove('menu-open'); burger.setAttribute('aria-expanded', 'false'); } });
  desktop.addEventListener('change', function () { closeAll(); if (desktop.matches) document.documentElement.classList.remove('menu-open'); });
})();
