/* ==========================================================================
   SHADESTATE · shared shell
   Topbar (colour probe), clip menu, page transition, char-roll, magnetic,
   cursor, footer, clocks, reveal, orbit CTA, enquiry form.
   No dependencies. Every set piece is guarded by prefers-reduced-motion.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hover = window.matchMedia('(hover: hover)').matches;

  /* ── arrival ─────────────────────────────────────────────────────────── */
  function arrive() {
    var html = document.documentElement;
    if (!html.classList.contains('is-arriving')) return;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        html.classList.remove('is-arriving');
        html.classList.add('is-arrived');
        if (location.hash.length > 1) {
          var t = document.getElementById(location.hash.slice(1));
          if (t) t.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
      });
    });
  }

  /* ── page transition ─────────────────────────────────────────────────── */
  function initTransition() {
    if (reduced) return;
    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest('a[href]');
      if (!a || a.target || a.hasAttribute('download') || a.hasAttribute('data-no-transition')) return;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#') return;
      var url;
      try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.hash) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (!/\.html?$|\/$/.test(url.pathname)) return;
      e.preventDefault();
      var html = document.documentElement;
      html.classList.add('is-transitioning');
      var main = document.querySelector('main');
      if (main) { main.style.transition = 'transform .45s var(--ease-transition), opacity .45s'; main.style.transform = 'scale(.992)'; main.style.opacity = '.35'; }
      try { sessionStorage.setItem('shade-nav', '1'); } catch (err) {}
      setTimeout(function () { location.href = url.href; }, 430);
    });
  }

  /* ── topbar: colour probe, scroll state, hide on scroll down ─────────── */
  function initTopbar() {
    var bar = $('[data-topbar]');
    if (!bar) return;
    var lastY = window.pageYOffset;
    var ticking = false;

    function luminance(el) {
      var bg = '';
      try { bg = getComputedStyle(el).backgroundColor; } catch (err) {}
      var m = /rgba?\(([^)]+)\)/.exec(bg);
      if (!m) return -1;
      var n = m[1].split(',').map(parseFloat);
      var a = n.length > 3 ? n[3] : 1;
      if (a < 0.55) return -1;
      return (n[0] * 0.2126 + n[1] * 0.7152 + n[2] * 0.0722) / 255;
    }

    function sync() {
      var y = window.pageYOffset;
      bar.classList.toggle('is-scrolled', y > 30);
      if (!document.body.classList.contains('menu-open')) {
        if (y > 360 && y > lastY + 4) bar.classList.add('is-hidden');
        else if (y < lastY - 4 || y < 120) bar.classList.remove('is-hidden');
      }
      lastY = y;

      /* BCG's nav probe: read what sits under the bar, not which section is "active" */
      var probeY = Math.min(bar.offsetHeight + 2, window.innerHeight - 2);
      var els = [];
      try { els = document.elementsFromPoint(window.innerWidth * 0.5, probeY); } catch (err) {}
      var dark = false;
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el === bar || bar.contains(el) || (el.closest && el.closest('.topbar, .menu, .page-transition, .cursor, .lightbox'))) continue;
        if (el.closest && el.closest('[data-navbar-dark]')) { dark = true; break; }
        var l = luminance(el);
        if (l >= 0) { dark = l < 0.36; break; }
      }
      bar.classList.toggle('is-on-dark', dark);
      ticking = false;
    }

    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(sync); }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    sync();
  }

  /* ── clip menu ───────────────────────────────────────────────────────── */
  function initMenu() {
    var toggle = $('[data-menu-toggle]');
    var menu = $('#menu');
    if (!toggle || !menu) return;
    var isOpen = false;
    var lastFocus = null;

    function lock(on) {
      document.body.classList.toggle('menu-open', on);
      document.body.classList.toggle('is-locked', on);
      if (window.__lenis) { on ? window.__lenis.stop() : window.__lenis.start(); }
    }

    function open() {
      lastFocus = document.activeElement;
      menu.hidden = false;
      isOpen = true;
      toggle.setAttribute('aria-expanded', 'true');
      lock(true);
      var top = $('[data-topbar]');
      if (top) top.classList.remove('is-hidden');
      requestAnimationFrame(function () { requestAnimationFrame(function () { menu.classList.add('is-open'); }); });
      var first = $('.menu__nav a', menu);
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 420);
    }

    function close(restore) {
      isOpen = false;
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      lock(false);
      setTimeout(function () { if (!isOpen) menu.hidden = true; }, 860);
      if (restore && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }

    toggle.addEventListener('click', function () { isOpen ? close(true) : open(); });
    $$('.menu__close, [data-menu-close]', menu).forEach(function (b) {
      b.addEventListener('click', function () { close(true); });
    });
    $$('.menu__nav a', menu).forEach(function (a) {
      a.addEventListener('click', function () { close(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && isOpen) close(true);
    });
    /* simple focus trap while open */
    menu.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab' || !isOpen) return;
      var f = $$('a[href], button:not([disabled])', menu).filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ── char roll ───────────────────────────────────────────────────────── */
  function initRoll() {
    $$('[data-roll]').forEach(function (el) {
      if (el.querySelector('.roll__face')) return;
      var text = el.getAttribute('data-roll') || el.textContent.trim();
      el.textContent = '';
      el.classList.add('roll');
      ['', 'roll__face--clone'].forEach(function (mod, faceIndex) {
        var face = document.createElement('span');
        face.className = 'roll__face' + (mod ? ' ' + mod : '');
        if (faceIndex) face.setAttribute('aria-hidden', 'true');
        for (var i = 0; i < text.length; i++) {
          var ch = document.createElement('span');
          ch.className = 'ch';
          ch.style.setProperty('--i', i);
          ch.textContent = text[i] === ' ' ? '\u00A0' : text[i];
          face.appendChild(ch);
        }
        el.appendChild(face);
      });
    });
  }

  /* ── magnetic ────────────────────────────────────────────────────────── */
  function initMagnetic() {
    if (reduced || !hover) return;
    $$('.magnetic').forEach(function (el) {
      var strength = parseFloat(el.getAttribute('data-magnetic-strength')) || 16;
      var tx = 0, ty = 0, cx = 0, cy = 0, raf = null, active = false;
      function loop() {
        cx += (tx - cx) * 0.14;
        cy += (ty - cy) * 0.14;
        el.style.transform = 'translate3d(' + cx.toFixed(2) + 'px,' + cy.toFixed(2) + 'px,0)';
        if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) raf = requestAnimationFrame(loop);
        else raf = null;
      }
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        tx = (e.clientX - (r.left + r.width / 2)) * strength / 16;
        ty = (e.clientY - (r.top + r.height / 2)) * strength / 16;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      el.addEventListener('mouseleave', function () {
        tx = 0; ty = 0; active = false;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      void active;
    });
  }

  /* ── cursor ──────────────────────────────────────────────────────────── */
  function initCursor() {
    if (reduced || !hover) return;
    var cursor = $('#cursor');
    if (!cursor) return;
    var dot = $('.cursor__dot', cursor);
    var label = $('.cursor__label', cursor);
    var mx = 0, my = 0, x = 0, y = 0;
    document.addEventListener('mousemove', function (e) {
      mx = e.clientX; my = e.clientY;
      cursor.classList.add('is-active');
    }, { passive: true });
    (function move() {
      x += (mx - x) * 0.2; y += (my - y) * 0.2;
      cursor.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      requestAnimationFrame(move);
    })();
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest('[data-cursor]');
      if (t) {
        cursor.classList.add('is-view');
        if (label) label.textContent = t.getAttribute('data-cursor') || 'View';
      } else if (e.target.closest('a, button, input, textarea, select, label')) {
        cursor.classList.remove('is-view');
        if (dot) dot.style.opacity = '0';
      }
    });
    document.addEventListener('mouseout', function (e) {
      if (!e.relatedTarget) { cursor.classList.remove('is-active'); return; }
      var t = e.target.closest('[data-cursor]');
      if (t) cursor.classList.remove('is-view');
      if (dot) dot.style.opacity = '';
    });
    void dot;
  }

  /* ── footer: letters + skyline ───────────────────────────────────────── */
  function initFooter() {
    $$('[data-footer-letters]').forEach(function (el) {
      if (el.children.length) return;
      var text = el.getAttribute('data-footer-letters') || el.textContent.trim();
      el.textContent = '';
      for (var i = 0; i < text.length; i++) {
        var s = document.createElement('span');
        s.style.setProperty('--i', i);
        s.textContent = text[i];
        el.appendChild(s);
      }
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) { el.classList.add('is-in'); io.disconnect(); }
          });
        }, { rootMargin: '0px 0px -8% 0px' });
        io.observe(el);
      } else el.classList.add('is-in');
    });

    $$('[data-skyline]').forEach(function (box) {
      if (box.querySelector('svg')) return;
      var w = 1200, h = 180;
      var seed = 7;
      function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
      var parts = [];
      parts.push('<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">');
      parts.push('<defs><linearGradient id="skyfade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7F4EF" stop-opacity=".13"/><stop offset="1" stop-color="#F7F4EF" stop-opacity=".02"/></linearGradient></defs>');
      var x = 0;
      while (x < w) {
        var bw = 12 + rnd() * 26;
        var bh = 18 + rnd() * 74;
        if (rnd() > 0.86) bh = 96 + rnd() * 62;
        parts.push('<rect x="' + x.toFixed(1) + '" y="' + (h - bh).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="url(#skyfade)"/>');
        if (rnd() > 0.8) parts.push('<rect x="' + (x + bw * 0.4).toFixed(1) + '" y="' + (h - bh - 14).toFixed(1) + '" width="' + (bw * 0.2).toFixed(1) + '" height="14" fill="url(#skyfade)"/>');
        x += bw + 4 + rnd() * 16;
      }
      /* one tapered tower for Dubai, one for Riyadh */
      parts.push('<path d="M420 180 L420 96 L426 60 L432 40 L438 60 L444 96 L444 180 Z" fill="url(#skyfade)"/>');
      parts.push('<path d="M820 180 L820 118 L830 118 L834 92 L840 92 L844 118 L854 118 L854 180 Z" fill="url(#skyfade)"/>');
      parts.push('<line x1="0" y1="179" x2="' + w + '" y2="179" stroke="rgba(247,244,239,.18)" stroke-width="1"/>');
      parts.push('</svg>');
      box.innerHTML = parts.join('');
    });
  }

  /* ── clocks ──────────────────────────────────────────────────────────── */
  function initClocks() {
    var nodes = $$('[data-clock]');
    if (!nodes.length) return;
    var zones = { dubai: 'Asia/Dubai', riyadh: 'Asia/Riyadh', jeddah: 'Asia/Riyadh' };
    var fmts = {};
    function tick() {
      nodes.forEach(function (el) {
        var z = zones[el.getAttribute('data-clock')] || 'Asia/Dubai';
        if (!fmts[z]) {
          try { fmts[z] = new Intl.DateTimeFormat('en-GB', { timeZone: z, hour: '2-digit', minute: '2-digit', hour12: false }); }
          catch (err) { fmts[z] = null; }
        }
        var d = new Date();
        el.textContent = fmts[z] ? fmts[z].format(d) : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      });
    }
    tick();
    setInterval(tick, 20000);
  }

  /* ── reveal ──────────────────────────────────────────────────────────── */
  function initReveal() {
    var els = $$('.reveal');
    if (!els.length) return;
    if (!('IntersectionObserver' in window) || reduced) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ── masked display lines: a CSS-guaranteed reveal ───────────────────── */
  function initSplitReveal() {
    var els = $$('[data-split]').filter(function (el) { return !el.closest('.hero'); });
    if (!els.length) return;
    function show(el) { el.classList.add('is-revealed'); }
    if (!('IntersectionObserver' in window)) { els.forEach(show); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { show(en.target); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    els.forEach(function (el) { io.observe(el); });
    /* headings already in view on arrival */
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.94 && r.bottom > 0) show(el);
    });
  }

  /* ── orbit CTA: reveal at the end of the 360° take ───────────────────── */
  function initOrbitCta() {
    var section = document.querySelector('.walkthrough');
    var cta = $('[data-orbit-cta]');
    if (!section || !cta) return;
    var ticking = false;
    function sync() {
      var r = section.getBoundingClientRect();
      var total = section.offsetHeight - window.innerHeight;
      var p = total <= 0 ? 0 : Math.min(1, Math.max(0, -r.top / total));
      cta.classList.toggle('is-visible', p >= 0.88);
      cta.setAttribute('aria-hidden', p >= 0.88 ? 'false' : 'true');
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(sync); }
    }, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }

  /* ── enquiry form (client-side demonstration only) ───────────────────── */
  function initViewingForms() {
    $$('[data-viewing-form]').forEach(function (form) {
      var ok = $('[data-viewing-ok]', form.parentElement) || $('[data-viewing-ok]', form);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = $('[name="name"]', form);
        var email = $('[name="email"]', form);
        var bad = false;
        [name, email].forEach(function (f) {
          if (!f) return;
          var invalid = !f.value.trim() || (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value));
          f.style.borderColor = invalid ? '#C9A55A' : '';
          if (invalid) bad = true;
        });
        if (bad) return;
        if (ok) {
          var who = (name && name.value.trim().split(' ')[0]) || 'thank you';
          ok.hidden = false;
          var t = $('[data-viewing-name]', ok);
          if (t) t.textContent = who;
          ok.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
        }
        form.reset();
      });
    });
  }

  /* ── newsletter ──────────────────────────────────────────────────────── */
  function initNewsletter() {
    $$('[data-news]').forEach(function (form) {
      var msg = $('[data-news-msg]', form);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = $('input[type="email"]', form);
        if (!input || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value)) {
          if (msg) msg.textContent = 'Please enter a valid email address.';
          return;
        }
        if (msg) msg.textContent = 'Thank you. You are on the list.';
        form.reset();
      });
    });
  }

  /* ── smooth in-page anchors with header offset ───────────────────────── */
  function initAnchors() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute('href') === '#') return;
      var t = document.getElementById(a.getAttribute('href').slice(1));
      if (!t) return;
      e.preventDefault();
      var top = t.getBoundingClientRect().top + window.pageYOffset - (parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h'), 10) || 72) - 4;
      if (window.__lenis) window.__lenis.scrollTo(top, { duration: 1.2 });
      else window.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  function init() {
    arrive();
    initTransition();
    initTopbar();
    initMenu();
    initRoll();
    initMagnetic();
    initCursor();
    initFooter();
    initClocks();
    initReveal();
    initSplitReveal();
    initOrbitCta();
    initViewingForms();
    initNewsletter();
    initAnchors();
    document.documentElement.classList.add('js-ready');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.ShadeShell = { roll: initRoll, reveal: initReveal, orbit: initOrbitCta };
})();
