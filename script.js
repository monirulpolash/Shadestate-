/* ==========================================================================
   Shadestate — Architectural Residences
   Interaction & motion layer
   --------------------------------------------------------------------------
   • No build step. GSAP + ScrollTrigger + Lenis load from CDN; if they are
     unreachable the local copies in assets/vendor/ take over.
   • Every interaction (filters, modal, residences explorer, inquiry form,
     menu, clock) works without the motion layer.
   • prefers-reduced-motion gets the finished page with no animation at all.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ */
  /*  0. Helpers                                                        */
  /* ------------------------------------------------------------------ */
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wantsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var state = { motion: false, lenis: null, gsap: null, revealAll: false };
  var header = $('#siteHeader');
  var headerH = function () { return header ? header.offsetHeight : 72; };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ------------------------------------------------------------------ */
  /*  1. Development data — one source for modal + residences explorer  */
  /* ------------------------------------------------------------------ */
  var DEVELOPMENTS = {
    'casa-da-luz': {
      name: 'Casa da Luz',
      location: 'Comporta, Portugal',
      year: '2026',
      status: 'Available',
      statusKey: 'available',
      image: 'assets/project-1.jpg',
      alt: 'Courtyard of Casa da Luz with travertine walls, a still pool and an olive tree.',
      caption: 'Casa da Luz — courtyard and reflecting pool',
      description: 'Eight low houses arranged around a shared olive grove, each opening onto its own walled courtyard and pool. The travertine comes from a single quarry batch, so every façade carries the same grain — and will weather at the same pace.',
      specs: [
        ['Completion', 'Q3 2026'],
        ['Residences', '8 houses'],
        ['Typology', '4–5 bedrooms'],
        ['Architect', 'Estúdio Almeida'],
        ['Interiors', 'Marta Reis'],
        ['Tenure', 'Freehold']
      ],
      amenities: ['Private pool', 'Olive grove', 'Cellar', 'Concierge', 'Staff studio', 'Beach club access'],
      price: 'Guide prices from €3.85M',
      types: [
        {
          id: 'garden-villa', name: 'Garden Villa', beds: 4, interior: 412, terrace: 96, plot: 640,
          orientation: 'South-west', deg: 225, price: '€3.85M – €4.2M', from: 'From €3.85M',
          sub: '4 bedrooms · ground floor · private pool',
          note: 'A single-storey house set back behind its own olive tree, with the pool held in the garden wall.',
          plan: {
            outer: [25, 32, 198, 176],
            walls: [[124, 32, 124, 208], [25, 120, 124, 120], [124, 152, 223, 152]],
            terrace: [238, 32, 78, 176], pool: [248, 78, 58, 60],
            labels: [{ x: 74, y: 74, t: 'Living' }, { x: 74, y: 168, t: 'Suite' }, { x: 174, y: 92, t: 'Kitchen' }, { x: 174, y: 184, t: 'Bed' }]
          }
        },
        {
          id: 'courtyard-villa', name: 'Courtyard Villa', beds: 5, interior: 486, terrace: 120, plot: 810,
          orientation: 'South', deg: 180, price: '€4.6M – €5.1M', from: 'From €4.6M',
          sub: '5 bedrooms · walled courtyard · pool',
          note: 'Rooms wrap a private court, so every window looks into green rather than at a neighbour.',
          plan: {
            outer: [25, 32, 198, 176],
            walls: [[25, 116, 223, 116], [112, 116, 112, 208]],
            terrace: [238, 32, 78, 176], pool: [248, 78, 58, 60],
            court: [142, 132, 66, 58],
            labels: [{ x: 74, y: 72, t: 'Living' }, { x: 175, y: 72, t: 'Dining' }, { x: 68, y: 168, t: 'Suite' }, { x: 175, y: 186, t: 'Bed' }]
          }
        }
      ]
    },

    'alto-principe': {
      name: 'Alto Príncipe',
      location: 'Príncipe Real, Lisbon',
      year: '2027',
      status: 'Upcoming',
      statusKey: 'upcoming',
      image: 'assets/project-2.jpg',
      alt: 'Double-height penthouse living room with linen curtains and oak floors.',
      caption: 'Alto Príncipe — penthouse living room',
      description: 'A 1920s palace rebuilt from the inside: six apartments and duplexes arranged around a planted lightwell, with the original stone stair restored and a new bronze lift core dropped into the centre. Sales open in spring 2027; the showroom is open now by appointment.',
      specs: [
        ['Completion', 'Q2 2027'],
        ['Residences', '6 apartments'],
        ['Typology', '3–4 bedrooms'],
        ['Architect', 'Nuno Falcão'],
        ['Interiors', 'Inês Falcão'],
        ['Tenure', 'Freehold']
      ],
      amenities: ['Planted lightwell', 'Bronze lift', 'Concierge', 'Garage for two cars', 'Wine room', 'Original stone stair'],
      price: 'Guide prices from €2.95M',
      types: [
        {
          id: 'garden-apartment', name: 'Garden Apartment', beds: 3, interior: 212, terrace: 38, plot: 0,
          orientation: 'East', deg: 90, price: '€2.95M', from: 'From €2.95M',
          sub: '3 bedrooms · raised ground floor · planted terrace',
          note: 'The old carriage entrance becomes a private garden room, three steps above the street.',
          plan: {
            outer: [44, 52, 176, 156],
            walls: [[44, 120, 220, 120], [128, 120, 128, 208]],
            terrace: [234, 52, 82, 156],
            labels: [{ x: 96, y: 84, t: 'Living' }, { x: 86, y: 168, t: 'Suite' }, { x: 176, y: 168, t: 'Kitchen' }]
          }
        },
        {
          id: 'penthouse-duplex', name: 'Penthouse Duplex', beds: 4, interior: 342, terrace: 74, plot: 0,
          orientation: 'West', deg: 270, price: '€3.4M – €3.9M', from: 'From €3.4M',
          sub: '4 bedrooms · two levels · roof terrace',
          note: 'Two floors under the old roof, with the stair kept where the palace had it.',
          plan: {
            outer: [28, 44, 204, 164],
            walls: [[28, 124, 232, 124], [136, 44, 136, 124]],
            terrace: [248, 44, 68, 164],
            labels: [{ x: 82, y: 84, t: 'Living' }, { x: 184, y: 84, t: 'Study' }, { x: 88, y: 172, t: 'Suite' }]
          }
        }
      ]
    },

    'mare-residences': {
      name: 'Maré Residences',
      location: 'Cascais, Portugal',
      year: '2028',
      status: 'Upcoming',
      statusKey: 'upcoming',
      image: 'assets/project-3.jpg',
      alt: 'Stepped stone and bronze residence with planted terraces above the sea.',
      caption: 'Maré Residences — the sea elevation at dusk',
      description: 'Fourteen apartments stepping down toward the Cascais shoreline, each with a planted terrace deep enough to eat on. The building sits back behind the coastal road, so the sound of the water arrives before the traffic does.',
      specs: [
        ['Completion', '2028'],
        ['Residences', '14 apartments'],
        ['Typology', '2–3 bedrooms'],
        ['Architect', 'Atelier Sousa'],
        ['Interiors', 'Marta Reis'],
        ['Tenure', 'Freehold']
      ],
      amenities: ['Sea-facing terraces', 'Residents’ pool', 'Gym', 'Garage', 'Landscaped gardens', 'Beach path'],
      price: 'Guide prices from €1.45M',
      types: [
        {
          id: 'sea-apartment', name: 'Sea Apartment', beds: 2, interior: 128, terrace: 24, plot: 0,
          orientation: 'South', deg: 180, price: '€1.45M – €1.6M', from: 'From €1.45M',
          sub: '2 bedrooms · first floor · sea-facing terrace',
          note: 'The smaller plan, with the living room turned fully to the water.',
          plan: {
            outer: [46, 56, 168, 150],
            walls: [[46, 128, 214, 128], [136, 56, 136, 128]],
            terrace: [226, 56, 88, 150],
            labels: [{ x: 90, y: 92, t: 'Living' }, { x: 90, y: 172, t: 'Suite' }, { x: 176, y: 92, t: 'Bath' }]
          }
        },
        {
          id: 'terrace-apartment', name: 'Terrace Apartment', beds: 3, interior: 186, terrace: 48, plot: 0,
          orientation: 'South-west', deg: 225, price: '€1.9M – €2.3M', from: 'From €1.9M',
          sub: '3 bedrooms · corner · wraparound terrace',
          note: 'A corner plan, so the terrace runs along two elevations and takes both suns.',
          plan: {
            outer: [34, 48, 186, 160],
            walls: [[34, 124, 220, 124], [118, 48, 118, 124]],
            terrace: [232, 48, 84, 160],
            labels: [{ x: 76, y: 84, t: 'Living' }, { x: 168, y: 84, t: 'Dining' }, { x: 100, y: 172, t: 'Suite' }]
          }
        }
      ]
    },

    'quinta-do-vale': {
      name: 'Quinta do Vale',
      location: 'Alentejo, Portugal',
      year: '2023',
      status: 'Completed',
      statusKey: 'completed',
      image: 'assets/project-4.jpg',
      alt: 'Stone and timber house at blue hour behind lavender and olive planting.',
      caption: 'Quinta do Vale — the north house at blue hour',
      description: 'Five estate houses on a working cork and olive farm, built from stone quarried on the property itself. Completed in 2023 and fully sold; the farm and its houses remain under our long-term care.',
      specs: [
        ['Completed', '2023'],
        ['Residences', '5 houses'],
        ['Typology', '4 bedrooms'],
        ['Architect', 'Estúdio Almeida'],
        ['Interiors', 'Inês Falcão'],
        ['Tenure', 'Freehold']
      ],
      amenities: ['Private well', 'Cork and olive farm', 'Pool', 'Guest annexe', 'Estate manager', 'Stables'],
      price: 'Completed and fully sold',
      types: [
        {
          id: 'farmhouse', name: 'Farmhouse', beds: 4, interior: 364, terrace: 0, plot: 1200,
          orientation: 'South', deg: 180, price: 'Sold — 2023', from: 'Sold',
          sub: '4 bedrooms · estate garden · private well',
          note: 'Thick stone walls, a deep veranda, and the old threshing floor kept as the garden terrace.',
          plan: {
            outer: [22, 44, 216, 164],
            walls: [[22, 112, 238, 112], [104, 112, 104, 208], [178, 44, 178, 112]],
            terrace: [248, 44, 66, 164],
            labels: [{ x: 64, y: 78, t: 'Living' }, { x: 140, y: 78, t: 'Study' }, { x: 62, y: 162, t: 'Suite' }, { x: 208, y: 162, t: 'Guest' }]
          }
        }
      ]
    },

    'miradouro-terrace': {
      name: 'Miradouro Terrace',
      location: 'Graça, Lisbon',
      year: '2025',
      status: 'Available',
      statusKey: 'available',
      image: 'assets/project-6.jpg',
      alt: 'Travertine rooftop terrace with linen seating and an olive tree above the Lisbon skyline.',
      caption: 'Miradouro Terrace — the roof terrace at golden hour',
      description: 'Three penthouses above Graça, each with a travertine roof terrace facing the castle and the river. The last remaining residence is offered with its furniture, made for the house by a workshop in Sintra.',
      specs: [
        ['Completed', '2025'],
        ['Residences', '3 penthouses'],
        ['Typology', '3 bedrooms'],
        ['Architect', 'Nuno Falcão'],
        ['Interiors', 'Marta Reis'],
        ['Tenure', 'Freehold']
      ],
      amenities: ['Private roof terrace', 'River views', 'Furnished by commission', 'Lift', 'Garage', 'Concierge'],
      price: 'Guide price from €5.6M',
      types: [
        {
          id: 'roof-penthouse', name: 'Roof Penthouse', beds: 3, interior: 248, terrace: 96, plot: 0,
          orientation: 'South-west', deg: 225, price: '€5.6M', from: 'From €5.6M',
          sub: '3 bedrooms · top floor · 96 m² roof terrace',
          note: 'The roof is the garden: an olive tree in a stone planter, and the castle at eye level.',
          plan: {
            outer: [26, 40, 212, 168],
            walls: [[26, 118, 238, 118], [126, 118, 126, 208]],
            terrace: [248, 40, 66, 168],
            labels: [{ x: 80, y: 80, t: 'Living' }, { x: 182, y: 80, t: 'Kitchen' }, { x: 80, y: 164, t: 'Suite' }]
          }
        }
      ]
    },

    'shadestate-house': {
      name: 'Shadestate House',
      location: 'Comporta, Portugal',
      year: '2019',
      status: 'Completed',
      statusKey: 'completed',
      image: 'assets/hero-architecture.jpg',
      alt: 'Shadestate House: limestone and timber villa with olive trees and a reflecting pool.',
      caption: 'Shadestate House — the reflecting pool',
      description: 'The house we built for ourselves: a single residence hidden behind timber screens, with a reflecting pool that doubles as the roof of the archive below. Completed in 2019 and privately sold; it remains the reference for everything we have drawn since.',
      specs: [
        ['Completed', '2019'],
        ['Residences', '1 house'],
        ['Typology', '6 bedrooms'],
        ['Architect', 'Tomás Shadestate'],
        ['Interiors', 'Inês Falcão'],
        ['Tenure', 'Private sale']
      ],
      amenities: ['Reflecting pool', 'Archive', 'Olive grove', 'Guest wing', 'Staff quarters', 'Sea path'],
      price: 'Privately sold in 2019',
      types: [
        {
          id: 'principal-house', name: 'Principal House', beds: 6, interior: 612, terrace: 140, plot: 2400,
          orientation: 'West', deg: 270, price: 'Sold — 2019', from: 'Sold',
          sub: '6 bedrooms · 2.4 ha plot · guest wing',
          note: 'Three wings around the pool, with the archive set into the ground beneath it.',
          plan: {
            outer: [20, 38, 224, 172],
            walls: [[20, 116, 244, 116], [104, 38, 104, 208], [176, 38, 176, 116]],
            terrace: [252, 38, 62, 172], pool: [258, 68, 50, 54],
            labels: [{ x: 62, y: 78, t: 'Living' }, { x: 140, y: 78, t: 'Kitchen' }, { x: 62, y: 166, t: 'Suite' }, { x: 210, y: 166, t: 'Guest' }]
          }
        }
      ]
    }
  };

  var RES_LABELS = {
    'general': 'your enquiry',
    'casa-da-luz': 'Casa da Luz',
    'alto-principe': 'Alto Príncipe',
    'mare-residences': 'Maré Residences',
    'quinta-do-vale': 'Quinta do Vale',
    'miradouro-terrace': 'Miradouro Terrace',
    'shadestate-house': 'Shadestate House'
  };

  /* ------------------------------------------------------------------ */
  /*  2. Small shared UI: clock, scroll lock, smooth anchors            */
  /* ------------------------------------------------------------------ */
  function lockScroll(lock) {
    document.body.classList.toggle('is-locked', lock);
    if (state.lenis) { lock ? state.lenis.stop() : state.lenis.start(); }
  }

  function initClock() {
    var els = [$('#lisbonTime'), $('#lisbonTimeMenu'), $('#lisbonTimeCard')].filter(Boolean);
    if (!els.length) return;
    var fmt;
    try {
      fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit', hour12: false
      });
    } catch (e) { fmt = null; }
    var tick = function () {
      var now = new Date();
      var text = fmt ? fmt.format(now) : String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      els.forEach(function (el) { el.textContent = text; });
    };
    tick();
    setInterval(tick, 20000);
  }

  function scrollToTarget(target) {
    if (!target) return;
    var top = target.getBoundingClientRect().top + window.pageYOffset - headerH() - 6;
    if (target.id === 'top') top = 0;
    if (state.lenis) {
      state.lenis.scrollTo(top, { duration: 1.3, easing: function (t) { return 1 - Math.pow(1 - t, 3); } });
    } else {
      window.scrollTo({ top: Math.max(top, 0), behavior: reduced ? 'auto' : 'smooth' });
    }
    if (history.replaceState) history.replaceState(null, '', '#' + (target.id || 'top'));
  }

  function initAnchors() {
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var href = a.getAttribute('href');
        if (!href || href === '#') return;
        var target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        scrollToTarget(target);
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        setTimeout(function () { target.focus({ preventScroll: true }); }, 500);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  3. Header, menu, rail, progress                                   */
  /* ------------------------------------------------------------------ */
  function initHeader() {
    var navLinks = $$('.nav a');
    var sections = navLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);

    if ('IntersectionObserver' in window && sections.length) {
      var navObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          navLinks.forEach(function (a) {
            if (a.getAttribute('href') !== '#' + entry.target.id) return;
            a.classList.toggle('is-active', entry.isIntersecting);
          });
        });
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
      sections.forEach(function (s) { navObs.observe(s); });
    }

    var railLinks = $$('[data-rail]');
    if ('IntersectionObserver' in window && railLinks.length) {
      var railObs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          railLinks.forEach(function (a) {
            if (a.getAttribute('href') !== '#' + entry.target.id) return;
            a.classList.toggle('is-active', entry.isIntersecting);
          });
        });
      }, { rootMargin: '-42% 0px -52% 0px', threshold: 0 });
      railLinks.forEach(function (a) {
        var s = document.querySelector(a.getAttribute('href'));
        if (s) railObs.observe(s);
      });
    }
  }

  function initMenu() {
    var toggle = $('#navToggle');
    var menu = $('#mobileMenu');
    if (!toggle || !menu) return;

    function open() {
      menu.hidden = false;
      document.body.classList.add('menu-open');
      window.requestAnimationFrame(function () { menu.classList.add('is-open'); });
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close menu');
      lockScroll(true);
      var first = $('.menu__nav a', menu);
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 320);
    }

    function close(restore) {
      menu.classList.remove('is-open');
      document.body.classList.remove('menu-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      if (!document.body.classList.contains('modal-open')) lockScroll(false);
      setTimeout(function () {
        if (!menu.classList.contains('is-open')) menu.hidden = true;
      }, 820);
      if (restore) toggle.focus({ preventScroll: true });
    }

    toggle.addEventListener('click', function () {
      if (toggle.getAttribute('aria-expanded') === 'true') close(true); else open();
    });

    $$('.menu__nav a', menu).forEach(function (a) {
      a.addEventListener('click', function () { close(false); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) close(true);
    });
  }

  function initProgress() {
    var bar = $('#progressBar');
    if (!bar || !state.gsap) return;
    var st = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: function (self) { bar.style.transform = 'scaleX(' + self.progress.toFixed(4) + ')'; }
    });
    return st;
  }

  /* ------------------------------------------------------------------ */
  /*  4. Splitting display type into masked lines                       */
  /* ------------------------------------------------------------------ */
  var splitRegistry = new Map();

  function doSplit(el) {
    var units = [];
    (function walk(node, em) {
      Array.prototype.forEach.call(node.childNodes, function (n) {
        if (n.nodeType === 3) {
          n.textContent.split(/\s+/).forEach(function (t) { if (t) units.push({ text: t, em: em }); });
        } else if (n.nodeType === 1) {
          var tag = n.tagName.toLowerCase();
          if (tag === 'br') { units.push({ br: true }); return; }
          var isEm = em || tag === 'em' || tag === 'i' || n.classList.contains('em');
          walk(n, isEm);
        }
      });
    })(el, false);

    el.innerHTML = '';
    var words = [];
    var plain = units.filter(function (u) { return !u.br; }).map(function (u) { return u.text; }).join(' ');
    units.forEach(function (u) {
      if (u.br) { el.appendChild(document.createElement('br')); return; }
      var w = document.createElement('span');
      w.className = 'w' + (u.em ? ' is-em' : '');
      w.textContent = u.text;
      el.appendChild(w);
      el.appendChild(document.createTextNode(' '));
      words.push(w);
    });

    var elTop = el.getBoundingClientRect().top;
    var lines = [];
    words.forEach(function (w) {
      var top = w.getBoundingClientRect().top - elTop;
      var line = null;
      for (var i = 0; i < lines.length; i++) {
        if (Math.abs(lines[i].top - top) < 5) { line = lines[i]; break; }
      }
      if (!line) { line = { top: top, words: [] }; lines.push(line); }
      line.words.push(w);
    });
    lines.sort(function (a, b) { return a.top - b.top; });

    var frag = document.createDocumentFragment();
    var inners = [];
    lines.forEach(function (line) {
      var outer = document.createElement('span');
      outer.className = 'line';
      outer.setAttribute('aria-hidden', 'true');
      var inner = document.createElement('span');
      inner.className = 'line__inner';
      line.words.forEach(function (w, i) {
        inner.appendChild(w);
        if (i < line.words.length - 1) inner.appendChild(document.createTextNode(' '));
      });
      outer.appendChild(inner);
      frag.appendChild(outer);
      inners.push(inner);
    });

    el.innerHTML = '';
    el.appendChild(frag);
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', plain);
    return inners;
  }

  function buildSplit(el) {
    if (!el.dataset.raw) el.dataset.raw = el.innerHTML;
    else el.innerHTML = el.dataset.raw;
    el.removeAttribute('aria-label');
    var entry = splitRegistry.get(el) || { revealed: false };
    entry.inners = doSplit(el);
    splitRegistry.set(el, entry);
    if (state.revealAll || entry.revealed) {
      state.gsap.set(entry.inners, { yPercent: 0 });
    } else {
      state.gsap.set(entry.inners, { yPercent: 112 });
    }
    return entry;
  }

  function revealSplit(el, delay) {
    var entry = splitRegistry.get(el);
    if (!entry || !entry.inners || !entry.inners.length) return;
    if (entry.revealed && !state.revealAll) return;
    entry.revealed = true;
    state.gsap.to(entry.inners, {
      yPercent: 0,
      duration: 1.25,
      ease: 'expo.out',
      stagger: 0.085,
      delay: delay || 0
    });
  }

  function resplitAll() {
    if (!state.motion) return;
    splitRegistry.forEach(function (entry, el) {
      if (!el.isConnected) return;
      buildSplit(el);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  5. Boot the motion layer                                          */
  /* ------------------------------------------------------------------ */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function ensureLibs() {
    var started = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        var ready = window.gsap && window.ScrollTrigger;
        if (ready || Date.now() - started > 4200) return resolve(ready);
        setTimeout(check, 60);
      })();
    }).then(function (ready) {
      if (ready) return Promise.resolve();
      return loadScript('assets/vendor/gsap.min.js')
        .then(function () { return loadScript('assets/vendor/ScrollTrigger.min.js'); })
        .catch(function () { return Promise.reject(); });
    }).then(function () {
      if (window.Lenis) return;
      return loadScript('assets/vendor/lenis.min.js').catch(function () {});
    });
  }

  function hideCurtain() {
    var c = $('#curtain');
    if (c) { c.style.display = 'none'; }
  }

  function bootMotion() {
    if (reduced) { hideCurtain(); return; }
    ensureLibs().then(function () {
      if (!window.gsap || !window.ScrollTrigger) {
        hideCurtain();
        return;
      }

      var gsap = window.gsap;
      state.gsap = gsap;
      state.motion = true;
      gsap.registerPlugin(window.ScrollTrigger);
      window.ScrollTrigger.config({ ignoreMobileResize: true });

      initLenis();
      initSplits();
      initScrollMotion();
      initProgress();
      intro();

      /* Split text bakes its line breaks from measured metrics, so wait for the
         two faces it actually sets before measuring again. */
      if (document.fonts && document.fonts.load) {
        Promise.all([
          document.fonts.load('700 1em "Plus Jakarta Sans"'),
          document.fonts.load('italic 400 1em "Cormorant Garamond"'),
          document.fonts.load('400 1em "Cormorant Garamond"')
        ]).then(function () { return document.fonts.ready; }).then(function () {
          resplitAll();
          window.ScrollTrigger.refresh();
        }).catch(function () {});
      }
    }).catch(function () {
      hideCurtain();
    });
  }

  function initLenis() {
    if (!window.Lenis) return;
    state.lenis = new window.Lenis({
      duration: 1.15,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      touchMultiplier: 1.6
    });
    state.lenis.on('scroll', window.ScrollTrigger.update);
    state.gsap.ticker.add(function (time) { state.lenis.raf(time * 1000); });
    state.gsap.ticker.lagSmoothing(0);
    window.__lenis = state.lenis;
  }

  function initSplits() {
    $$('[data-split]').forEach(function (el) { buildSplit(el); });
  }

  /* ------------------------------------------------------------------ */
  /*  6. Intro: wordmark, fast counter, clip reveal                     */
  /* ------------------------------------------------------------------ */
  function intro() {
    var gsap = state.gsap;
    var curtain = $('#curtain');
    var word = $$('.curtain__word span, .curtain__word em');
    var inner = $('.curtain__inner');
    var countEl = $('#curtainCount');
    var bar = $('#curtainBar');
    var fade = $$('[data-hero-fade]');

    var seen = false;
    try { seen = sessionStorage.getItem('sh-seen') === '1'; sessionStorage.setItem('sh-seen', '1'); } catch (e) {}

    gsap.set(fade, { y: 24, autoAlpha: 0 });

    if (!curtain || seen) {
      hideCurtain();
      heroTitleIn(0.05);
      gsap.to(fade, { y: 0, autoAlpha: 1, duration: 1, ease: 'power3.out', stagger: 0.08, delay: 0.05 });
      heroIntro();
      if (!seen) finishIntro();
      return;
    }

    document.documentElement.classList.add('is-locked');
    if (state.lenis) state.lenis.scrollTo(0, { immediate: true, force: true });
    else window.scrollTo(0, 0);

    /* a bright architectural plate, a wordmark, one hairline, one number:
       about a second from first paint to the hero */
    gsap.set(curtain, { yPercent: 0, autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0%)' });
    gsap.set(word, { yPercent: 112 });
    gsap.set(bar, { scaleX: 0, transformOrigin: '0% 50%' });

    var counter = { v: 0 };
    var tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      onComplete: function () {
        hideCurtain();
        document.documentElement.classList.remove('is-locked');
        window.ScrollTrigger.refresh();
      }
    });

    tl.to(word, { yPercent: 0, duration: 0.5, stagger: 0.06, ease: 'expo.out' }, 0)
      .to(counter, {
        v: 100, duration: 0.46, ease: 'power2.inOut',
        onUpdate: function () {
          if (countEl) countEl.textContent = String(Math.round(counter.v)).padStart(2, '0');
        }
      }, 0.02)
      .to(bar, { scaleX: 1, duration: 0.46, ease: 'power2.inOut' }, 0.02)
      .add(heroIntro, 0.06)
      .to(inner, { autoAlpha: 0, y: -14, duration: 0.22, ease: 'power2.in' }, 0.46)
      .to(curtain, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.55, ease: 'power3.inOut' }, 0.5)
      .add(function () {
        heroTitleIn(0);
        gsap.to(fade, { y: 0, autoAlpha: 1, duration: 1.05, ease: 'power3.out', stagger: 0.09 });
      }, 0.6)
      .set(curtain, { autoAlpha: 0 }, 1.05)
      .add(finishIntro, 1.05);
  }

  /* The headline arrives word by word — measured masks would freeze a line
     break, and this headline has to be free to rewrap at every width. */
  function heroTitleIn(delay) {
    state.gsap.fromTo('.hero__title .hw',
      { opacity: 0, yPercent: 14 },
      { opacity: 1, yPercent: 0, duration: 1.15, ease: 'expo.out', stagger: 0.075, delay: delay || 0 });
  }

  /* The hero's arrival: sky settles, clouds drift down into place, the building
     fades up. It only ever touches the images inside the layers, never the
     layers themselves, so the scroll timeline owns their transforms. */
  function heroIntro() {
    var gsap = state.gsap;
    gsap.fromTo('.hero__back', { scale: 1.1 }, { scale: 1, duration: 3.4, ease: 'expo.out' });
    gsap.fromTo('.hero__cloud--l', { yPercent: 40 }, { yPercent: 0, duration: 2.8, ease: 'expo.out' });
    gsap.fromTo('.hero__cloud--r', { yPercent: 60 }, { yPercent: 0, duration: 3.2, ease: 'expo.out', delay: 0.1 });
    gsap.fromTo('.hero__house img', { opacity: 0, yPercent: 8 }, { opacity: 1, yPercent: 0, duration: 2.6, ease: 'expo.out', delay: 0.15 });
  }

  function finishIntro() {
    if (state.lenis) state.lenis.start();
  }

  /* ------------------------------------------------------------------ */
  /*  7. Header behaviour over sections                                 */
  /* ------------------------------------------------------------------ */
  function initHeaderMotion() {
    var darkSections = $$('[data-nav="light"]');

    function syncInverted() {
      var probe = 46;
      var inverted = darkSections.some(function (sec) {
        var r = sec.getBoundingClientRect();
        return r.top <= probe && r.bottom > probe;
      });
      header.classList.toggle('is-inverted', inverted);
    }

    window.ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: function (self) {
        var y = self.scroll();
        header.classList.toggle('is-scrolled', y > 40);
        if (!document.body.classList.contains('menu-open')) {
          if (y > 240 && self.direction === 1) header.classList.add('is-hidden');
          else if (self.direction === -1 || y < 120) header.classList.remove('is-hidden');
        }
        syncInverted();
      },
      onRefresh: syncInverted
    });
    syncInverted();
  }

  /* ------------------------------------------------------------------ */
  /*  8. Scroll choreography                                            */
  /* ------------------------------------------------------------------ */
  function initScrollMotion() {
    var gsap = state.gsap;
    var ST = window.ScrollTrigger;

    /* Hero: one take over five viewports.
       0.00–1.00  the building rises and grows, the mist climbs, the clouds part
       0.00–0.20  the copy sinks and fades, going behind the building
       0.10–0.40  the wordmark draws itself as a hairline, then fades
       0.30–1.00  the building reappears inside the wordmark as the plain
                  copy fades away                                                  */
    var heroPaths = $$('.hero__logo path');
    heroPaths.forEach(function (p) {
      var len = 0;
      try { len = p.getTotalLength(); } catch (e) {}
      if (!len) len = 1000;
      p.style.strokeDasharray = len + ' ' + len;
      p.style.strokeDashoffset = len;
    });

    /* the CSS parks the mist below the floor; re-declare it as a percentage so
       the tween below starts from 42% rather than a baked matrix */
    gsap.set('.hero__smoke', { yPercent: 42, y: 0 });

    var heroMM = gsap.matchMedia();
    heroMM.add('(min-width: 1px)', function () {
      var tl = gsap.timeline({
        defaults: { ease: 'power1.out' },
        scrollTrigger: {
          trigger: '.hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 0.1
        }
      });

      tl.to(['.hero__house', '.hero__composite .hero__house'], { yPercent: -40, scale: 1.3, duration: 1 }, 0)
        .to('.hero__smoke', { yPercent: -10, duration: 1 }, 0)
        .to('.hero__cloud--l', { xPercent: -15, duration: 1 }, 0)
        .to('.hero__cloud--r', { xPercent: 15, duration: 1 }, 0)
        .to('.hero__content', { yPercent: 20, scale: 0.9, duration: 1 }, 0)
        .to('.hero__content', { autoAlpha: 0, duration: 0.2 }, 0)
        .to('.hero__logo', { autoAlpha: 1, duration: 0.01 }, 0.1)
        .to(heroPaths, { strokeDashoffset: 0, duration: 0.3 }, 0.1)
        .to('.hero__logo', { autoAlpha: 0, duration: 0.2 }, 0.28)
        .to('.hero__composite', { opacity: 1, duration: 0.1 }, 0.3)
        .to('.hero__bg > .hero__house', { opacity: 0, duration: 0.1 }, 0.3)
        .add(function () {}, 1);

      return function () {
        gsap.set(['.hero__house', '.hero__composite', '.hero__smoke', '.hero__content', '.hero__logo', '.hero__cloud--l', '.hero__cloud--r'], { clearProps: 'all' });
        gsap.set('.hero__bg > .hero__house', { clearProps: 'opacity' });
      };
    });

    /* Generic reveals */
    $$('[data-reveal]').forEach(function (el) {
      var d = parseFloat(el.style.getPropertyValue('--d') || '0') || 0;
      gsap.fromTo(el,
        { y: 26, autoAlpha: 0 },
        {
          y: 0, autoAlpha: 1, duration: 1.05, ease: 'power3.out', delay: d * 0.08,
          scrollTrigger: { trigger: el, start: 'top 90%', once: true }
        }
      );
    });

    /* Masked display type on scroll */
    $$('[data-split]').forEach(function (el) {
      if (el.closest('.hero')) return;
      ST.create({
        trigger: el,
        start: 'top 86%',
        once: true,
        onEnter: function () { revealSplit(el); }
      });
    });

    /* Image curtains + inner scale */
    $$('[data-curtain]').forEach(function (el, i) {
      var frame = el.classList.contains('ph') ? $('.ph__frame', el) : el;
      if (!frame) return;
      gsap.fromTo(frame,
        { clipPath: 'inset(0% 0% 100% 0%)' },
        {
          clipPath: 'inset(0% 0% 0% 0%)',
          duration: 1.35,
          ease: 'expo.inOut',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true }
        }
      );
      var img = $('img', frame);
      if (img && !el.classList.contains('dev-card__figure')) {
        gsap.fromTo(img, { scale: 1.14 }, {
          scale: 1, duration: 1.7, ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true }
        });
      }
      void i;
    });

    /* Parallax photography */
    $$('[data-parallax]').forEach(function (img) {
      var amount = parseFloat(img.getAttribute('data-parallax')) || 5;
      var scope = img.closest('[data-parallax-scope]') || img.closest('figure') || img.parentElement;
      gsap.fromTo(img,
        { yPercent: -amount },
        {
          yPercent: amount,
          ease: 'none',
          scrollTrigger: { trigger: scope, start: 'top bottom', end: 'bottom top', scrub: true }
        }
      );
    });

    /* Featured project — scale-on-scroll (Hale Arden pattern) */
    initFeature();

    /* Counters */
    initCounters();

    /* Footer wordmark */
    var mark = $('[data-footer-mark]');
    if (mark) {
      gsap.fromTo(mark, { yPercent: 70, opacity: 0 }, {
        yPercent: 0, opacity: 1, duration: 1.2, ease: 'expo.out',
        scrollTrigger: { trigger: mark, start: 'top 95%', once: true }
      });
    }

    /* Closing line */
    var closing = $('.closing__line');
    if (closing) {
      ST.create({ trigger: closing, start: 'top 90%', once: true, onEnter: function () { revealSplit(closing); } });
    }

    window.addEventListener('load', function () { ST.refresh(); });
  }

  function initFeature() {
    var gsap = state.gsap;
    var blocks = $$('[data-feature-stage]');
    if (!blocks.length) return;

    blocks.forEach(function (stage) {
      var block = stage.closest('[data-feature]') || stage.parentElement;
      var media = $('[data-feature-media]', stage);
      var img = $('[data-feature-img]', stage);
      var caption = $('.feature__caption', stage);
      if (!media) return;

      var mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: no-preference)', function () {
        var tl = gsap.timeline({
          scrollTrigger: {
            trigger: stage,
            start: 'top 90%',
            end: 'top 30%',
            scrub: 0.6,
            invalidateOnRefresh: true
          }
        });
        tl.fromTo(media,
          { scale: 0.74, clipPath: 'inset(0% 9% 0% 9%)' },
          { scale: 1, clipPath: 'inset(0% 0% 0% 0%)', ease: 'none', duration: 1 }, 0);
        if (img) tl.fromTo(img, { scale: 1.32 }, { scale: 1, ease: 'none', duration: 1 }, 0);

        return function () {
          gsap.set([media, img].filter(Boolean), { clearProps: 'all' });
        };
      });

      if (caption) {
        gsap.fromTo(caption, { y: 26, autoAlpha: 0 }, {
          y: 0, autoAlpha: 1, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: stage, start: 'top 48%', once: true }
        });
      }
      void block;
    });
  }

  function fmtCount(v, decimals) {
    if (decimals) return v.toFixed(decimals);
    return Math.round(v).toLocaleString('en-US');
  }

  function initCounters() {
    var gsap = state.gsap;
    $$('[data-count]').forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-count'));
      var decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
      if (isNaN(target)) return;
      var obj = { v: 0 };
      var done = false;
      window.ScrollTrigger.create({
        trigger: el,
        start: 'top 92%',
        once: true,
        onEnter: function () {
          if (done) return;
          done = true;
          gsap.to(obj, {
            v: target,
            duration: 1.6,
            ease: 'power2.out',
            onUpdate: function () {
              el.textContent = fmtCount(obj.v, decimals);
            },
            onComplete: function () { el.textContent = fmtCount(target, decimals); }
          });
        }
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  9. Cursor + magnetic buttons                                      */
  /* ------------------------------------------------------------------ */
  function initCursor() {
    if (!wantsHover) return;
    var cursor = $('#cursor');
    if (!cursor) return;
    var label = $('.cursor__label', cursor);
    var gsap = state.gsap;
    document.body.classList.add('has-cursor');

    var xTo = gsap.quickTo(cursor, 'x', { duration: 0.32, ease: 'power3.out' });
    var yTo = gsap.quickTo(cursor, 'y', { duration: 0.32, ease: 'power3.out' });

    window.addEventListener('mousemove', function (e) {
      xTo(e.clientX);
      yTo(e.clientY);
    }, { passive: true });

    var current = null;

    function setTarget(el) {
      if (el === current) return;
      current = el;
      if (!el) {
        cursor.classList.remove('is-active', 'is-hover', 'is-text');
        return;
      }
      if (el.hasAttribute('data-cursor')) {
        var text = el.getAttribute('data-cursor');
        if (label) label.textContent = text;
        cursor.classList.add('is-active');
        cursor.classList.remove('is-hover', 'is-text');
      } else if (el.closest('input, textarea, select')) {
        cursor.classList.remove('is-active', 'is-hover');
        cursor.classList.add('is-text');
      } else {
        cursor.classList.remove('is-active', 'is-text');
        cursor.classList.add('is-hover');
      }
    }

    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest('[data-cursor], a, button, input, textarea, select');
      setTarget(t);
    });

    document.addEventListener('mouseout', function (e) {
      var related = e.relatedTarget;
      if (!related || !related.closest || !related.closest('[data-cursor], a, button, input, textarea, select')) {
        setTarget(null);
      }
    });

    window.addEventListener('mousedown', function () { cursor.classList.add('is-down'); });
    window.addEventListener('mouseup', function () { cursor.classList.remove('is-down'); });
    document.addEventListener('mouseleave', function () { cursor.classList.remove('is-active'); });
  }

  function initMagnetic() {
    if (!wantsHover) return;
    var gsap = state.gsap;
    $$('.magnetic').forEach(function (el) {
      var strength = 0.22;
      var qx = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
      var qy = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        qx((e.clientX - r.left - r.width / 2) * strength);
        qy((e.clientY - r.top - r.height / 2) * strength);
      });
      el.addEventListener('mouseleave', function () {
        gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  10. Portfolio filters                                             */
  /* ------------------------------------------------------------------ */
  var currentFilter = 'all';

  function initFilters() {
    var buttons = $$('.filter');
    var cards = $$('.dev-card');
    var grid = $('#devGrid');
    var status = $('#filterStatus');
    var thumb = $('.filters__thumb');
    if (!buttons.length || !grid) return;

    function moveThumb(btn) {
      if (!thumb || !btn) return;
      thumb.style.width = btn.offsetWidth + 'px';
      thumb.style.height = btn.offsetHeight + 'px';
      thumb.style.top = btn.offsetTop + 'px';
      thumb.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
    }

    function apply(key, animate) {
      currentFilter = key;
      var shown = 0;

      buttons.forEach(function (btn) {
        var active = btn.getAttribute('data-filter') === key;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        if (active) moveThumb(btn);
      });

      grid.classList.toggle('is-filtered', key !== 'all');

      var reveal = function () {
        cards.forEach(function (card) {
          var match = key === 'all' || card.getAttribute('data-status') === key;
          card.classList.toggle('is-off', !match);
          if (match) shown++;
        });
        if (status) {
          status.textContent = shown === cards.length
            ? 'Showing all ' + shown + ' developments'
            : 'Showing ' + shown + ' of ' + cards.length + ' developments';
        }
        if (state.motion) {
          window.ScrollTrigger.refresh();
          var visible = cards.filter(function (c) { return !c.classList.contains('is-off'); });
          state.gsap.fromTo(visible,
            { opacity: 0, y: 26 },
            { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', stagger: 0.06, clearProps: 'opacity,transform' });
        }
      };

      if (animate && state.motion) {
        state.gsap.to(cards, {
          opacity: 0, y: 14, duration: 0.28, ease: 'power2.in', stagger: 0.015,
          onComplete: reveal
        });
      } else {
        reveal();
      }
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        apply(btn.getAttribute('data-filter'), true);
      });
    });

    apply('all', false);
    var initial = $('.filter.is-active');
    if (initial) requestAnimationFrame(function () { moveThumb(initial); });
    window.addEventListener('resize', function () {
      var active = $('.filter.is-active');
      if (active) moveThumb(active);
    });

    window.__applyFilter = apply;
    void currentFilter;
  }

  /* ------------------------------------------------------------------ */
  /*  11. Development modal                                             */
  /* ------------------------------------------------------------------ */
  var modalApi = null;

  function initModal() {
    var modal = $('#devModal');
    if (!modal) return;
    var panel = $('.modal__panel', modal);
    var lastFocused = null;
    var currentDev = null;

    function open(id) {
      var dev = DEVELOPMENTS[id];
      if (!dev) return;
      currentDev = id;
      lastFocused = document.activeElement;

      $('#modalImage', modal).src = dev.image;
      $('#modalImage', modal).alt = dev.alt;
      $('#modalCaption', modal).textContent = dev.caption;
      $('#modalTitle', modal).textContent = dev.name;
      $('#modalLocation', modal).textContent = dev.location + ' · ' + dev.year;
      $('#modalDesc', modal).textContent = dev.description;
      $('#modalPrice', modal).textContent = dev.price;

      $('#modalSpecs', modal).innerHTML = dev.specs.map(function (row) {
        return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>';
      }).join('');

      $('#modalTypes', modal).innerHTML = dev.types.map(function (t) {
        return '<li><span class="modal-type__name">' + t.name + '</span>' +
          '<span class="modal-type__price">' + t.price + '</span>' +
          '<span class="modal-type__meta">' + t.sub + '</span></li>';
      }).join('');

      $('#modalAmenities', modal).innerHTML = dev.amenities.map(function (a) {
        return '<li>' + a + '</li>';
      }).join('');

      var chip = $('#modalStatus', modal);
      chip.textContent = dev.status;
      chip.className = 'chip chip--' + dev.statusKey;

      var enquire = $('#modalEnquire', modal);
      if (enquire) enquire.setAttribute('data-dev', id);

      modal.hidden = false;
      document.body.classList.add('modal-open');
      lockScroll(true);
      window.requestAnimationFrame(function () { modal.classList.add('is-open'); });
      setTimeout(function () { if (panel) panel.focus({ preventScroll: true }); }, 80);
    }

    function close() {
      modal.classList.remove('is-open');
      document.body.classList.remove('modal-open');
      if (!document.body.classList.contains('menu-open')) lockScroll(false);
      setTimeout(function () {
        if (!modal.classList.contains('is-open')) modal.hidden = true;
      }, 520);
      if (lastFocused && lastFocused.focus) lastFocused.focus({ preventScroll: true });
      currentDev = null;
    }

    $$('[data-open]').forEach(function (btn) {
      btn.addEventListener('click', function () { open(btn.getAttribute('data-open')); });
    });

    $$('[data-close]', modal).forEach(function (el) { el.addEventListener('click', close); });

    modal.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var focusables = $$('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])', modal)
        .filter(function (el) { return el.offsetParent !== null; });
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    var enquireLink = $('#modalEnquire');
    if (enquireLink) {
      enquireLink.addEventListener('click', function () {
        var id = enquireLink.getAttribute('data-dev') || currentDev;
        close();
        setTimeout(function () { prefillInquiry(id, null); }, 420);
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
    });

    modalApi = { open: open, close: close };
  }

  /* ------------------------------------------------------------------ */
  /*  12. Residences & plans explorer                                   */
  /* ------------------------------------------------------------------ */
  var explorerState = { dev: 'casa-da-luz', type: null };

  function formatArea(n) {
    return n ? n.toLocaleString('en-GB') + ' m²' : '—';
  }

  function planSvg(type) {
    var ns = 'http://www.w3.org/2000/svg';
    var g = $('#planRooms');
    var svg = $('#exPlanSvg');
    if (!g || !svg) return;
    g.innerHTML = '';

    var plan = type.plan || {};
    var el = function (tag, attrs) {
      var n = document.createElementNS(ns, tag);
      Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
      return n;
    };

    var rectOf = function (r, cls) {
      if (!r) return;
      g.appendChild(el('rect', { x: r[0], y: r[1], width: r[2], height: r[3], 'class': cls }));
    };

    if (plan.terrace) rectOf(plan.terrace, 'terrace');
    if (plan.pool) rectOf(plan.pool, 'pool');
    if (plan.court) rectOf(plan.court, 'terrace');
    if (plan.outer) rectOf(plan.outer, 'wall');

    (plan.walls || []).forEach(function (w) {
      g.appendChild(el('line', { x1: w[0], y1: w[1], x2: w[2], y2: w[3], 'class': 'inner' }));
    });

    (plan.labels || []).forEach(function (l) {
      var t = el('text', { x: l.x, y: l.y, 'class': 'room-label', 'text-anchor': 'middle' });
      t.textContent = l.t;
      g.appendChild(t);
    });

    svg.setAttribute('aria-label', 'Schematic floor plan of the ' + type.name + ' at ' + DEVELOPMENTS[explorerState.dev].name);

    /* draw-in animation for the walls */
    var strokes = $$('.wall, .inner, .terrace, .pool', g);
    strokes.forEach(function (s, i) {
      s.setAttribute('pathLength', '1');
      s.style.strokeDasharray = '1';
      s.style.strokeDashoffset = '1';
      s.style.transition = 'stroke-dashoffset 1.15s cubic-bezier(.22,.68,.16,1) ' + (i * 0.045) + 's';
    });
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        strokes.forEach(function (s) { s.style.strokeDashoffset = '0'; });
      });
    });

    /* labels fade in after the walls */
    $$('.room-label', g).forEach(function (t, i) {
      t.style.opacity = '0';
      t.style.transition = 'opacity .5s ease ' + (0.5 + i * 0.06) + 's';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { t.style.opacity = '1'; });
      });
    });

    var needle = $('#planNeedle');
    if (needle) needle.setAttribute('transform', 'rotate(' + (type.deg || 180) + ' 24 24)');
  }

  function renderExplorer(devKey, typeId) {
    var dev = DEVELOPMENTS[devKey];
    if (!dev) return;
    explorerState.dev = devKey;
    var type = dev.types.map(function (t) { return t; }).filter(function (t) { return t.id === typeId; })[0] || dev.types[0];
    explorerState.type = type.id;

    $('#exLocation').textContent = dev.location + ' · ' + dev.year;
    $('#exName').textContent = dev.name;
    $('#exDesc').textContent = dev.description;
    $('#exPrice').textContent = /\d/.test(type.from) ? type.from + ' · guide price' : type.from;

    $$('.explorer__tab').forEach(function (tab) {
      var on = tab.getAttribute('data-dev') === devKey;
      tab.classList.toggle('is-active', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
      tab.setAttribute('tabindex', on ? '0' : '-1');
      if (on && tab.parentNode) {
        var scroller = tab.parentNode;
        if (scroller.scrollWidth > scroller.clientWidth) {
          scroller.scrollTo({ left: Math.max(0, tab.offsetLeft - 12), behavior: 'smooth' });
        }
      }
    });

    var pills = $('#exTypes');
    pills.innerHTML = dev.types.map(function (t) {
      return '<button class="type-pill' + (t.id === type.id ? ' is-active' : '') +
        '" type="button" data-type="' + t.id + '" aria-pressed="' + (t.id === type.id) + '">' + t.name + '</button>';
    }).join('');

    $$('.type-pill', pills).forEach(function (btn) {
      btn.addEventListener('click', function () {
        renderExplorer(devKey, btn.getAttribute('data-type'));
      });
    });

    var specs = [
      ['Interior', formatArea(type.interior)],
      ['Terrace', formatArea(type.terrace)],
      ['Bedrooms', type.beds + (type.beds === 1 ? ' bedroom' : ' bedrooms')],
      ['Orientation', type.orientation],
      ['Architect', (dev.specs.filter(function (s) { return s[0] === 'Architect'; })[0] || ['', '—'])[1]],
      ['Tenure', (dev.specs.filter(function (s) { return s[0] === 'Tenure'; })[0] || ['', '—'])[1]]
    ];
    $('#exSpecs').innerHTML = specs.map(function (s) {
      return '<div><dt>' + s[0] + '</dt><dd>' + s[1] + '</dd></div>';
    }).join('');

    var max = Math.max(type.interior || 0, type.terrace || 0, type.plot || 0, 1);
    var metrics = [
      ['Interior', type.interior],
      ['Terrace', type.terrace],
      ['Plot', type.plot]
    ];
    $('#exMetrics').innerHTML = metrics.map(function (m) {
      var v = Math.max(0.02, (m[1] || 0) / max);
      return '<div class="metric"><span class="metric__label">' + m[0] + '</span>' +
        '<span class="metric__value">' + formatArea(m[1]) + '</span>' +
        '<span class="metric__bar"><i style="--v:' + v.toFixed(3) + '"></i></span></div>';
    }).join('');

    $('#exPlanType').textContent = type.name;
    $('#exPlanSub').textContent = type.sub;

    planSvg(type);

    var request = $('#exRequest');
    if (request) request.setAttribute('data-current', devKey + ':' + type.id);
  }

  function initExplorer() {
    var tabs = $('#devTabs');
    if (!tabs) return;

    tabs.innerHTML = Object.keys(DEVELOPMENTS).map(function (key, i) {
      var d = DEVELOPMENTS[key];
      return '<button class="explorer__tab" type="button" role="tab" aria-selected="false" tabindex="-1" data-dev="' + key + '">' +
        '<i>0' + (i + 1) + '</i>' + d.name + '</button>';
    }).join('');

    $$('.explorer__tab', tabs).forEach(function (tab) {
      tab.addEventListener('click', function () { renderExplorer(tab.getAttribute('data-dev'), null); });
      tab.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        var all = $$('.explorer__tab', tabs);
        var i = all.indexOf(tab) + (e.key === 'ArrowRight' ? 1 : -1);
        var next = all[(i + all.length) % all.length];
        if (next) { next.focus(); renderExplorer(next.getAttribute('data-dev'), null); }
      });
    });

    renderExplorer('casa-da-luz', 'garden-villa');

    var request = $('#exRequest');
    if (request) {
      request.addEventListener('click', function () {
        var cur = (request.getAttribute('data-current') || 'casa-da-luz:garden-villa').split(':');
        prefillInquiry(cur[0], cur[1]);
      });
    }

    var devSel = $('#development');
    if (devSel) {
      devSel.addEventListener('change', function () {
        populateResidences(devSel.value, null);
        if (DEVELOPMENTS[devSel.value]) renderExplorer(devSel.value, null);
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  13. Inquiry form                                                  */
  /* ------------------------------------------------------------------ */
  function populateResidences(devKey, typeId) {
    var sel = $('#residence');
    if (!sel) return;
    var dev = DEVELOPMENTS[devKey];
    var options = ['<option value="">Any remaining residence</option>'];
    if (dev) {
      dev.types.forEach(function (t) {
        options.push('<option value="' + t.id + '">' + t.name + ' — ' + t.sub + '</option>');
      });
    }
    sel.innerHTML = options.join('');
    if (typeId) sel.value = typeId;
  }

  function prefillInquiry(devKey, typeId) {
    var dev = DEVELOPMENTS[devKey];
    if (!dev) return;
    var devSel = $('#development');
    var formWrap = $('.inquire__form');
    if (devSel) devSel.value = devKey;
    populateResidences(devKey, typeId);

    var type = typeId ? dev.types.filter(function (t) { return t.id === typeId; })[0] : null;
    var msg = $('#message');
    if (msg && !msg.value.trim()) {
      msg.value = type
        ? 'We would like to see the ' + type.name + ' at ' + dev.name + ' (' + type.sub + '). Please send the plans and specification.'
        : 'We would like to see ' + dev.name + '. Please send the plans and specification.';
    }

    var target = $('#inquire');
    if (target) {
      var top = target.getBoundingClientRect().top + window.pageYOffset - headerH() + 4;
      if (state.lenis) state.lenis.scrollTo(top, { duration: 1.4, easing: function (t) { return 1 - Math.pow(1 - t, 3); } });
      else window.scrollTo({ top: top, behavior: reduced ? 'auto' : 'smooth' });
    }

    if (formWrap) {
      formWrap.classList.add('is-prefilled');
      setTimeout(function () { formWrap.classList.remove('is-prefilled'); }, 2800);
    }
    setTimeout(function () {
      var name = $('#name');
      if (name) name.focus({ preventScroll: true });
    }, state.lenis ? 1200 : 700);
  }

  function initForm() {
    var form = $('#inquiryForm');
    var success = $('#inquirySuccess');
    if (!form || !success) return;

    var dateInput = $('#viewingDate');
    if (dateInput) {
      var t = new Date();
      var iso = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
      dateInput.min = iso;
    }

    function setError(field, hasError) {
      var wrapper = field.closest('.field');
      if (!wrapper) return;
      wrapper.classList.toggle('has-error', hasError);
      var msg = $('.field__error', wrapper);
      if (msg) msg.hidden = !hasError;
      field.setAttribute('aria-invalid', hasError ? 'true' : 'false');
    }

    function validate(field) {
      var value = (field.value || '').trim();
      var ok = true;
      switch (field.id) {
        case 'name': ok = value.length >= 2; break;
        case 'email': ok = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(value); break;
        case 'phone': ok = value === '' || value.replace(/[^\d]/g, '').length >= 7; break;
        case 'viewingDate':
          if (value) {
            var today = new Date(); today.setHours(0, 0, 0, 0);
            var chosen = new Date(value + 'T00:00:00');
            ok = !isNaN(chosen.getTime()) && chosen >= today;
          }
          break;
        default: ok = true;
      }
      setError(field, !ok);
      return ok;
    }

    $$('input, select, textarea', form).forEach(function (field) {
      field.addEventListener('blur', function () {
        if (field.value && field.id !== 'message') validate(field);
      });
      field.addEventListener('input', function () {
        var wrapper = field.closest('.field');
        if (wrapper && wrapper.classList.contains('has-error')) validate(field);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var required = ['name', 'email', 'phone', 'viewingDate'];
      var firstInvalid = null;
      required.forEach(function (id) {
        var field = $('#' + id);
        if (!field) return;
        if (!validate(field) && !firstInvalid) firstInvalid = field;
      });
      if (firstInvalid) { firstInvalid.focus({ preventScroll: false }); return; }

      var nameValue = ($('#name').value || '').trim();
      var firstName = nameValue.split(/\s+/)[0];
      var devKey = $('#development').value;
      var devLabel = RES_LABELS[devKey] || 'your enquiry';
      var resKey = $('#residence') ? $('#residence').value : '';
      var resLabel = '';
      if (resKey && DEVELOPMENTS[devKey]) {
        var tt = DEVELOPMENTS[devKey].types.filter(function (x) { return x.id === resKey; })[0];
        resLabel = tt ? tt.name : '';
      }
      var dateValue = dateInput ? dateInput.value : '';

      var btn = $('.submit', form);
      var lbl = $('.submit__label', btn);
      if (btn) { btn.disabled = true; if (lbl) lbl.textContent = 'Sending…'; }

      setTimeout(function () {
        $('#successName').textContent = firstName;

        var copy = 'Your enquiry is with the studio. A partner will write to you within one business day with the full presentation';
        copy += devKey === 'general' ? '.' : ' for ' + devLabel + '.';
        if (dateValue) {
          var d = new Date(dateValue + 'T00:00:00');
          var pretty = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
          copy += ' We have noted ' + pretty + ' as your preferred viewing date and will confirm the time by email.';
        }
        $('#successCopy').textContent = copy;

        var rows = [];
        if (devKey !== 'general') rows.push(['Development', devLabel]);
        if (resLabel) rows.push(['Residence', resLabel]);
        if (dateValue) {
          rows.push(['Preferred viewing', new Date(dateValue + 'T00:00:00')
            .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })]);
        }
        $('#successSummary').innerHTML = rows.map(function (r) {
          return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
        }).join('');

        form.hidden = true;
        success.hidden = false;
        success.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
        if (btn) { btn.disabled = false; if (lbl) lbl.textContent = 'Request the presentation'; }
      }, 560);
    });

    var reset = $('#resetForm');
    if (reset) {
      reset.addEventListener('click', function () {
        form.reset();
        $$('.field', form).forEach(function (f) { f.classList.remove('has-error'); });
        $$('.field__error', form).forEach(function (m) { m.hidden = true; });
        populateResidences('general', null);
        success.hidden = true;
        form.hidden = false;
        var nameField = $('#name');
        if (nameField) nameField.focus({ preventScroll: false });
      });
    }

    populateResidences('general', null);
  }

  /* ------------------------------------------------------------------ */
  /*  14. Static init + go                                              */
  /* ------------------------------------------------------------------ */
  function initStatic() {
    var year = $('#year');
    if (year) year.textContent = String(new Date().getFullYear());
    initFilters();
    initExplorer();
    initForm();
  }

  function start() {
    initStatic();
    bootMotion();
    window.addEventListener('resize', function () {
      if (!state.motion) return;
      clearTimeout(window.__rsz);
      window.__rsz = setTimeout(function () {
        resplitAll();
        window.ScrollTrigger.refresh();
        var active = $('.filter.is-active');
        var thumb = $('.filters__thumb');
        if (active && thumb) {
          thumb.style.width = active.offsetWidth + 'px';
          thumb.style.height = active.offsetHeight + 'px';
          thumb.style.top = active.offsetTop + 'px';
          thumb.style.transform = 'translateX(' + active.offsetLeft + 'px)';
        }
      }, 220);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
