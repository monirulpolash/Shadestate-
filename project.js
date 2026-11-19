/* ============================================================
   SHADESTATE — Project details
   Data + rendering + interactions. No dependencies.
   Project is chosen with ?project=<slug>, default arbour-townhomes.
   ============================================================ */
(function () {
  'use strict';

  /* ───────────────────────── data ───────────────────────── */

  var IMG = '';

  function faqs(p) {
    return [
      { q: 'What makes ' + p.name + ' different?', a: p.faqDiff },
      { q: 'What is the payment plan?', a: p.payment },
      { q: 'Are pets allowed?', a: p.pets || 'Yes. The community is pet-friendly, with planted verges and shaded walking routes.' },
      { q: 'Which schools are nearby?', a: p.schools || 'Several international schools are within a short drive. Our team can share the full list and catchment details on request.' },
      { q: 'When is handover?', a: 'Handover is planned for ' + p.handover + ', with phased completion by cluster. A written schedule is issued with the reservation form.' },
      { q: 'How do I book a site visit?', a: 'Use the enquiry form on this page and our team will call you to arrange a visit at a time that suits you.' }
    ];
  }

  var PROJECTS = window.SHADE_PROJECTS || {};
  var ORDER = window.SHADE_ORDER || Object.keys(PROJECTS);

  /* ───────────────────────── helpers ───────────────────────── */

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function slugFromQuery() {
    var m = /[?&]project=([^&#]+)/.exec(location.search);
    var s = m ? decodeURIComponent(m[1]).replace(/\/+$/, '').toLowerCase() : '';
    return PROJECTS[s] ? s : 'arbour-townhomes';
  }

  var slug = slugFromQuery();
  var p = PROJECTS[slug];

  /* ───────────────────────── isometric art ───────────────────────── */

  var ISO_C = Math.cos(Math.PI / 6);
  var ISO_S = Math.sin(Math.PI / 6);

  function iso(x, y, z) {
    return [(x - y) * ISO_C, (x + y) * ISO_S - (z || 0)];
  }

  function poly(pts, cls) {
    return '<polygon points="' + pts.map(function (q) { return q[0].toFixed(2) + ',' + q[1].toFixed(2); }).join(' ') + '"' + (cls ? ' class="' + cls + '"' : '') + '/>';
  }

  function seg(a, b) {
    return '<line x1="' + a[0].toFixed(2) + '" y1="' + a[1].toFixed(2) + '" x2="' + b[0].toFixed(2) + '" y2="' + b[1].toFixed(2) + '"/>';
  }

  function plane(x, y, w, d, z) {
    return poly([iso(x, y, z), iso(x + w, y, z), iso(x + w, y + d, z), iso(x, y + d, z)]);
  }

  function box(x, y, w, d, h, z0) {
    var z = z0 || 0;
    var t = [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)];
    var l = iso(x, y, z), r = iso(x + w, y, z), r2 = iso(x + w, y + d, z), l2 = iso(x, y + d, z);
    var tl = iso(x, y, z + h), tr = iso(x + w, y, z + h), tr2 = iso(x + w, y + d, z + h), tl2 = iso(x, y + d, z + h);
    var out = poly(t);
    out += '<path d="M' + l[0].toFixed(2) + ' ' + l[1].toFixed(2) + 'L' + tl[0].toFixed(2) + ' ' + tl[1].toFixed(2) + 'L' + tl2[0].toFixed(2) + ' ' + tl2[1].toFixed(2) + 'L' + l2[0].toFixed(2) + ' ' + l2[1].toFixed(2) + 'Z"/>';
    out += '<path d="M' + r[0].toFixed(2) + ' ' + r[1].toFixed(2) + 'L' + tr[0].toFixed(2) + ' ' + tr[1].toFixed(2) + 'L' + tr2[0].toFixed(2) + ' ' + tr2[1].toFixed(2) + 'L' + r2[0].toFixed(2) + ' ' + r2[1].toFixed(2) + 'Z"/>';
    return out;
  }

  function tree(x, y, z, r) {
    var c = iso(x, y, (z || 0) + r * 0.9);
    return seg(iso(x, y, z || 0), iso(x, y, (z || 0) + r * 0.9)) +
      '<circle cx="' + c[0].toFixed(2) + '" cy="' + c[1].toFixed(2) + '" r="' + (r * 7).toFixed(2) + '"/>' +
      '<circle cx="' + (c[0] - r * 4).toFixed(2) + '" cy="' + (c[1] + r * 3).toFixed(2) + '" r="' + (r * 4.6).toFixed(2) + '"/>' +
      '<circle cx="' + (c[0] + r * 4.4).toFixed(2) + '" cy="' + (c[1] + r * 2.4).toFixed(2) + '" r="' + (r * 4).toFixed(2) + '"/>';
  }

  function art(kind) {
    var w = 220, h = 170, ox = 110, oy = 108, s = 15;

    function T(pts) { return pts; }
    var body = '';

    function g(x, y, z) {
      var q = iso(x, y, z);
      return [ox + q[0] * s, oy + q[1] * s];
    }
    // local iso in screen units
    function L(x, y, z) { return g(x, y, z || 0); }
    function pl(x, y, ww, dd, z) {
      return poly([L(x, y, z), L(x + ww, y, z), L(x + ww, y + dd, z), L(x, y + dd, z)]);
    }
    function bx(x, y, ww, dd, hh, z0) {
      var z = z0 || 0;
      var top = [L(x, y, z + hh), L(x + ww, y, z + hh), L(x + ww, y + dd, z + hh), L(x, y + dd, z + hh)];
      var a = L(x, y, z), b = L(x + ww, y, z), c = L(x + ww, y + dd, z), d = L(x, y + dd, z);
      var ta = L(x, y, z + hh), tb = L(x + ww, y, z + hh), tc = L(x + ww, y + dd, z + hh), td = L(x, y + dd, z + hh);
      var out = poly(top);
      out += '<path d="M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1) + 'L' + ta[0].toFixed(1) + ' ' + ta[1].toFixed(1) + 'L' + td[0].toFixed(1) + ' ' + td[1].toFixed(1) + 'L' + d[0].toFixed(1) + ' ' + d[1].toFixed(1) + 'Z"/>';
      out += '<path d="M' + b[0].toFixed(1) + ' ' + b[1].toFixed(1) + 'L' + tb[0].toFixed(1) + ' ' + tb[1].toFixed(1) + 'L' + tc[0].toFixed(1) + ' ' + tc[1].toFixed(1) + 'L' + c[0].toFixed(1) + ' ' + c[1].toFixed(1) + 'Z"/>';
      return out;
    }
    function ln(a, b) { return seg(a, b); }
    function tr(x, y, z, r) {
      var base = L(x, y, z || 0);
      var mid = L(x, y, (z || 0) + r * 1.1);
      return ln(base, mid) +
        '<circle cx="' + mid[0].toFixed(1) + '" cy="' + (mid[1] - r * 7).toFixed(1) + '" r="' + (r * 8).toFixed(1) + '"/>' +
        '<circle cx="' + (mid[0] - r * 7).toFixed(1) + '" cy="' + (mid[1] - r * 3).toFixed(1) + '" r="' + (r * 5.4).toFixed(1) + '"/>' +
        '<circle cx="' + (mid[0] + r * 7).toFixed(1) + '" cy="' + (mid[1] - r * 4).toFixed(1) + '" r="' + (r * 5).toFixed(1) + '"/>';
    }

    switch (kind) {
      case 'gardens':
        body += pl(0, 0, 10, 7, 0);
        body += pl(0.6, 0.6, 4.2, 2.6, 0.02);
        body += pl(5.4, 0.6, 4, 2.6, 0.02);
        body += pl(0.6, 3.6, 3.4, 2.8, 0.02);
        body += pl(4.4, 3.6, 5, 2.8, 0.02);
        body += tr(2.4, 2, 0, 0.9) + tr(7.6, 2, 0, 0.8) + tr(2.2, 5.2, 0, 0.75) + tr(7.4, 5.1, 0, 0.9);
        body += ln(L(0, 7.6, 0), L(10, 7.6, 0));
        break;
      case 'play':
        body += pl(0, 0, 10, 7, 0);
        body += ln(L(1.2, 1.2, 3.4), L(1.2, 1.2, 0)) + ln(L(4.6, 1.2, 3.4), L(4.6, 1.2, 0));
        body += ln(L(1.2, 1.2, 3.4), L(4.6, 1.2, 3.4));
        body += ln(L(2.1, 1.2, 3.4), L(2.1, 1.2, 1.6)) + ln(L(3.7, 1.2, 3.4), L(3.7, 1.2, 1.6));
        body += pl(1.8, 1.0, 1.0, 0.5, 1.55);
        body += poly([L(2.1, 1.2, 3.4), L(2.6, 1.2, 3.4), L(2.6, 2.0, 3.4), L(2.1, 2.0, 3.4)]);
        body += tr(8.2, 1.6, 0, 1.0) + tr(8.8, 5.2, 0, 0.8);
        body += pl(5.6, 4.6, 2.4, 1.6, 0.02);
        break;
      case 'tennis':
        body += pl(0, 0, 12, 7.2, 0);
        body += pl(0.6, 0.6, 10.8, 6, 0.02);
        body += ln(L(6, 0.6, 0.02), L(6, 6.6, 0.02));
        body += ln(L(0.6, 3.6, 0.02), L(11.4, 3.6, 0.02));
        body += ln(L(6, 0.4, 0), L(6, 0.4, 1.6)) + ln(L(6, 6.8, 0), L(6, 6.8, 1.6));
        body += ln(L(6, 0.4, 1.55), L(6, 6.8, 1.55));
        body += ln(L(0.2, 7.4, 0), L(12.2, 7.4, 0));
        break;
      case 'yoga':
        body += pl(0, 0, 9, 8, 0);
        for (var i = 0; i < 6; i++) body += ln(L(0, 1 + i * 1.2, 0.01), L(9, 1 + i * 1.2, 0.01));
        body += pl(1.6, 1.4, 2.6, 1.2, 0.04) + pl(5.0, 4.6, 2.6, 1.2, 0.04);
        body += ln(L(2.9, 1.4, 0.04), L(2.9, 2.6, 0.04));
        body += ln(L(6.3, 4.6, 0.04), L(6.3, 5.8, 0.04));
        body += tr(8.1, 1.2, 0, 0.9) + tr(1.0, 6.9, 0, 0.8);
        break;
      case 'gym':
        body += pl(0, 0, 10.4, 7.4, 0);
        body += bx(1, 1.2, 4.2, 1.2, 0.5);
        body += bx(1.1, 1.35, 1.2, 0.9, 0.9);
        body += ln(L(6.2, 1.2, 0), L(6.2, 1.2, 2.2)) + ln(L(8.4, 1.2, 0), L(8.4, 1.2, 2.2));
        body += ln(L(6.2, 1.2, 2.2), L(8.4, 1.2, 2.2));
        body += ln(L(6.6, 1.2, 1.1), L(6.6, 1.2, 1.7)) + ln(L(8, 1.2, 1.1), L(8, 1.2, 1.7));
        body += bx(6.4, 5.4, 3.0, 1.2, 0.35);
        body += bx(6.7, 5.6, 0.5, 0.8, 0.55) + bx(8.6, 5.6, 0.5, 0.8, 0.55);
        break;
      case 'parking':
        body += pl(0, 0, 11, 7.6, 0);
        body += ln(L(0, 2.6, 0.01), L(11, 2.6, 0.01));
        body += ln(L(0, 5.2, 0.01), L(11, 5.2, 0.01));
        for (var k = 0; k < 4; k++) body += ln(L(0.6 + k * 2.7, 0, 0.01), L(0.6 + k * 2.7, 7.6, 0.01));
        body += bx(1.4, 3.0, 1.7, 1.6, 0.7) + bx(4.1, 3.0, 1.7, 1.6, 0.7) + bx(6.8, 3.0, 1.7, 1.6, 0.7);
        body += bx(1.6, 3.2, 1.3, 1.2, 0.45) + bx(4.3, 3.2, 1.3, 1.2, 0.45) + bx(7.0, 3.2, 1.3, 1.2, 0.45);
        break;
      case 'security':
        body += pl(0, 0, 10, 7, 0);
        body += bx(1.2, 1.4, 3.2, 2.6, 2.0);
        body += ln(L(1.2, 4.0, 2.0), L(4.4, 4.0, 2.0)) + ln(L(1.2, 1.4, 1.0), L(4.4, 1.4, 1.0));
        body += ln(L(4.6, 4.0, 0), L(4.6, 4.0, 2.4)) + ln(L(4.6, 4.0, 2.4), L(8.4, 4.0, 2.4));
        body += ln(L(8.4, 4.0, 2.4), L(8.4, 4.0, 2.0));
        body += '<path d="M' + L(6.2, 2.2, 3.2)[0].toFixed(1) + ' ' + L(6.2, 2.2, 3.2)[1].toFixed(1) + 'l1.6 .6l-.2 1.7l-1.4 1.1l-1.4-1.1l-.2-1.7Z"/>';
        body += tr(8.8, 6.0, 0, 0.85);
        break;
      case 'lounge':
      default:
        body += pl(0, 0, 10, 7.4, 0);
        body += bx(0.9, 0.9, 3.4, 1.2, 0.55);
        body += bx(0.9, 0.9, 1.1, 1.2, 0.95);
        body += bx(5.6, 5.0, 3.4, 1.2, 0.55);
        body += bx(8.0, 5.0, 1.0, 1.2, 0.95);
        body += bx(0.9, 5.0, 1.2, 1.6, 0.5);
        body += bx(7.6, 0.9, 1.2, 1.6, 0.5);
        body += bx(4.2, 3.0, 2.0, 1.4, 0.35);
        body += tr(9.0, 2.0, 0, 0.8);
        break;
    }

    var fit = '<g transform="translate(110 86) scale(0.66) translate(-110 -86)">' + body + '</g>';
    return '<svg viewBox="0 0 220 172" aria-hidden="true" focusable="false">' + fit + '</svg>';
  }

  /* ───────────────────────── render: hero ───────────────────────── */

  var displayCurrency = null;

  function moneyFor(cur) {
    return window.shadeMoney ? window.shadeMoney(p, cur) : p.price + ' ' + (cur || p.currency);
  }

  function setCurrency(cur) {
    displayCurrency = cur;
    var el = $('#projectPrice');
    if (el) {
      if (window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        window.gsap.fromTo(el, { yPercent: 30, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: .5, ease: 'power2.out' });
      }
      el.textContent = moneyFor(cur);
    }
    $$('.currency__btn').forEach(function (b) {
      var on = b.getAttribute('data-cur') === cur;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function initCurrency() {
    $$('.currency__btn').forEach(function (b) {
      b.addEventListener('click', function () { setCurrency(b.getAttribute('data-cur')); });
    });
    setCurrency(p.currency);
  }

  function renderPayplan() {
    var cells = $('#payplanCells');
    var pctEl = $('#payplanPct');
    var bar = $('#payplanBar');
    var note = $('#payplanNote');
    var label = $('#payplanLabel');
    var stage = $('#payplanStage');
    if (!cells) return;
    var done = p.status === 'Completed';
    var pct = done ? 100 : (p.progress || 0);

    if (done) {
      if (label) label.textContent = 'Ownership';
      cells.innerHTML = '<div class="payplan__cell"><b>Ready to move</b><span>Delivered and handed over</span></div>' +
        '<div class="payplan__cell"><b>Title deed</b><span>Issued on transfer</span></div>' +
        '<div class="payplan__cell"><b>Tenure</b><span>Freehold · managed by Shadestate</span></div>';
      if (note) note.textContent = 'Residences are complete. A private viewing can be arranged within the week.';
      if (stage) stage.textContent = 'complete';
    } else {
      if (label) label.textContent = 'Payment plan & construction';
      cells.innerHTML = (p.plan || [['10%', 'Booking'], ['50%', 'Construction'], ['40%', 'Handover']]).map(function (c) {
        return '<div class="payplan__cell"><b>' + esc(c[0]) + '</b><span>' + esc(c[1]) + '</span></div>';
      }).join('');
      if (note) note.textContent = p.payment || '10% on booking, 50% during construction and 40% on handover.';
      if (stage) stage.textContent = 'built';
    }
    if (bar) bar.style.width = Math.max(2, pct) + '%';
    if (pctEl) {
      var obj = { v: 0 };
      var set = function (v) { pctEl.textContent = Math.round(v); };
      if (window.gsap) window.gsap.to(obj, { v: pct, duration: 1.4, ease: 'power2.out', onUpdate: function () { set(obj.v); } });
      else set(pct);
    }
  }

  function renderHero() {
    document.title = p.name + ' — Shadestate';
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute('content', p.name + ' by Shadestate — ' + p.type + ' in ' + p.location + '. Specifications, residences, floor plans and everything close by.');

    $('#projectTitle').textContent = p.name;
    var eyebrow = $('#projectEyebrow');
    if (eyebrow) eyebrow.textContent = p.location + ' · ' + p.status;
    $('#overviewText').textContent = p.overview;
    $('#overviewNote').textContent = p.note;

    var spec = [
      ['Status', p.status],
      ['Location', p.location],
      ['Property type', p.type],
      ['Handover', p.handover],
      ['Unit size', p.size]
    ];
    $('#specList').innerHTML = spec.map(function (r) {
      return '<div class="spec__row"><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('');

    var hero = $('#heroImage');
    hero.src = p.hero;
    hero.alt = p.heroAlt;
    var cap = $('#heroCaption');
    if (cap) cap.textContent = p.heroCap;

    $('#landmarksSub').textContent = 'Drive times from ' + p.name + ', measured at off-peak hours.';

    var tel = p.country === 'Saudi Arabia' ? '+966110000000' : '+97140000000';
    var wa = 'https://wa.me/' + tel.replace(/\D/g, '') + '?text=' + encodeURIComponent('Hello Shadestate — I would like to know more about ' + p.name + '.');
    var call = $('#callLink'); if (call) call.href = 'tel:' + tel;
    var wa1 = $('#waLink'); if (wa1) wa1.href = wa;
    var wa2 = $('#waLinkFloat'); if (wa2) wa2.href = wa;
    var mapName = $('#mapProjectName'); if (mapName) mapName.textContent = p.name;

    var contact = 'contact.html?project=' + encodeURIComponent(slug);
    ['enquireLink', 'enquiryAction', 'brochureLink', 'planEnquire', 'viewingEnquire', 'quickEnquire', 'orbitEnquire'].forEach(function (id) {
      var a = document.getElementById(id);
      if (a) a.href = contact;
    });
    var oc = $('#enquireCopy');
    if (oc) oc.textContent = 'Walk ' + p.name + ' with the people who planned and built it, in ' + (p.country === 'Saudi Arabia' ? 'Riyadh' : 'Dubai') + '. By appointment, at a time that suits you.';
    var op = $('#orbitProject'); if (op) op.textContent = p.name;
    var opc = $('#orbitProjectCopy'); if (opc) opc.textContent = p.name;
    var we = $('#walkEyebrow'); if (we) we.textContent = p.name + ' · ' + p.location;

    initCurrency();
    renderPayplan();
  }

  /* ───────────────────────── landmarks ───────────────────────── */

  function renderLandmarks() {
    var row = $('#landmarkRow');
    row.innerHTML = '';
    var maxMin = Math.max.apply(null, p.landmarks.map(function (l) { return l.min; }));

    p.landmarks.forEach(function (l, i) {
      var li = el('li', 'landmark reveal');
      li.style.transitionDelay = (i * 60) + 'ms';

      var ring = el('div', 'landmark__ring');
      var pct = Math.min(0.92, Math.max(0.14, l.min / (maxMin * 1.25)));
      var r = 49, c = 2 * Math.PI * r;
      ring.innerHTML =
        '<svg viewBox="0 0 100 100" aria-hidden="true">' +
        '<circle class="track" cx="50" cy="50" r="' + r + '"/>' +
        '<circle class="prog" cx="50" cy="50" r="' + r + '" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + c.toFixed(1) + '" data-dash="' + (c * (1 - pct)).toFixed(1) + '"/>' +
        '</svg>' +
        '<div class="landmark__img"><img src="' + IMG + l.img + '" alt="' + esc(l.name) + '" loading="lazy" decoding="async" width="600" height="600"></div>';

      var time = el('p', 'landmark__time', '<span class="num" data-min="' + l.min + '">0</span><small>min</small>');
      var name = el('p', 'landmark__name', esc(l.name));
      var dist = el('p', 'landmark__dist', esc(l.km));

      li.appendChild(ring);
      li.appendChild(time);
      li.appendChild(name);
      li.appendChild(dist);
      row.appendChild(li);
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var item = e.target;
        var prog = item.querySelector('.prog');
        if (prog) prog.style.strokeDashoffset = prog.getAttribute('data-dash');
        var num = item.querySelector('.num');
        if (num && !num.dataset.done) {
          num.dataset.done = '1';
          countUp(num, parseInt(num.getAttribute('data-min'), 10), 1000);
        }
        item.classList.add('in');
        io.unobserve(item);
      });
    }, { threshold: .3 });

    $$('.landmark', row).forEach(function (n) { io.observe(n); });
  }

  function countUp(node, target, dur) {
    var start = performance.now();
    function tick(t) {
      var k = Math.min(1, (t - start) / dur);
      var eased = 1 - Math.pow(1 - k, 3);
      node.textContent = Math.round(target * eased);
      if (k < 1) requestAnimationFrame(tick);
      else node.textContent = target;
    }
    requestAnimationFrame(tick);
  }

  /* ───────────────────────── gallery ───────────────────────── */

  function renderGallery() {
    var track = $('#galleryTrack');
    track.innerHTML = '';
    p.gallery.forEach(function (g, i) {
      var a = el('article', 'gitem reveal' + (i === 0 ? ' gitem--lead' : ''));
      a.innerHTML =
        '<p class="gitem__num">' + pad2(i + 1) + '</p>' +
        '<figure class="gitem__fig"><img src="' + IMG + g.img + '" alt="' + esc(p.name + ' — ' + g.cap) + '" loading="' + (i > 1 ? 'lazy' : 'eager') + '" decoding="async" width="900" height="1125"></figure>' +
        '<p class="gitem__cap"><span>' + esc(g.cap) + '</span><span>' + esc(g.sub) + '</span></p>';
      track.appendChild(a);
    });

    track.scrollLeft = 0;
    var step = function () {
      var first = $('.gitem', track);
      return first ? first.getBoundingClientRect().width + 20 : 320;
    };
    $('#galPrev').addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    $('#galNext').addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); track.scrollBy({ left: step(), behavior: 'smooth' }); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); track.scrollBy({ left: -step(), behavior: 'smooth' }); }
    });
  }

  /* ───────────────────────── amenities ───────────────────────── */

  var ART_KEYS = ['gardens', 'play', 'tennis', 'yoga', 'gym', 'parking', 'security', 'lounge'];

  function renderAmenities() {
    var grid = $('#amenityGrid');
    grid.innerHTML = '';
    p.amenities.forEach(function (name, i) {
      var d = el('article', 'amenity reveal');
      d.style.transitionDelay = (i % 4 * 50) + 'ms';
      d.innerHTML =
        '<div class="amenity__art">' + art(ART_KEYS[i % ART_KEYS.length]) + '</div>' +
        '<div class="amenity__foot"><span class="amenity__no">' + pad2(i + 1) + '</span><span class="amenity__name">' + esc(name) + '</span></div>';
      grid.appendChild(d);
    });
  }

  /* ───────────────────────── layouts ───────────────────────── */

  var activeLayout = 0;

  function renderLayouts() {
    var tabs = $('#layoutTabs');
    tabs.innerHTML = '';
    p.layouts.forEach(function (l, i) {
      var b = el('button', 'tab', esc(l.name));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      b.setAttribute('aria-controls', 'planStage');
      b.id = 'tab-' + i;
      b.addEventListener('click', function () { setLayout(i); });
      b.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var n = (i + d + p.layouts.length) % p.layouts.length;
        setLayout(n);
        $('#tab-' + n).focus();
      });
      tabs.appendChild(b);
    });
    setLayout(0, true);
  }

  function setLayout(i, silent) {
    activeLayout = i;
    var l = p.layouts[i];
    $$('#layoutTabs .tab').forEach(function (t, k) {
      t.setAttribute('aria-selected', k === i ? 'true' : 'false');
      t.tabIndex = k === i ? 0 : -1;
    });

    var stage = $('#planStage'), img = $('#planImage');
    stage.classList.remove('is-swap');
    img.style.opacity = '0';
    setTimeout(function () {
      img.src = IMG + l.plan;
      img.alt = l.name + ' floor plan — ' + p.name;
      img.onload = function () { img.style.opacity = '1'; };
      if (img.complete) img.style.opacity = '1';
    }, silent ? 0 : 120);

    var stageEl = $('#planStage');
    if (stageEl) stageEl.setAttribute('aria-labelledby', 'tab-' + i);

    $('#planCount').innerHTML = pad2(i + 1) + ' <span>/ ' + pad2(p.layouts.length) + '</span>';
    $('#planStageName').textContent = l.name;
    $('#planTitle').textContent = l.name;

    var rows = [
      ['Type', l.type],
      ['Size', l.size],
      ['Bedrooms', l.bedrooms],
      ['Bathrooms', l.bathrooms],
      ['Balcony', l.balcony],
      ['Pool deck', l.pool]
    ];
    $('#planSpec').innerHTML = rows.map(function (r) {
      return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>';
    }).join('');

    var avail = $('#planAvail');
    if (avail) {
      var state = l.availability || 'Available';
      avail.innerHTML = '<i class="dot" aria-hidden="true"></i>' + esc(state);
      avail.className = 'plan__avail plan__avail--' + state.toLowerCase().replace(/\s+/g, '-');
    }

    var dl = $('#planDownload');
    dl.href = IMG + l.plan;
    dl.setAttribute('download', slug + '-' + l.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png');
  }

  /* ───────────────────────── nearby + map ───────────────────────── */

  var CATS = ['Schools', 'Daily needs', 'Healthcare', 'Leisure'];
  var activeCat = 'All';

  function renderNearby() {
    var filters = $('#nearbyFilters');
    filters.innerHTML = '';
    ['All'].concat(CATS).forEach(function (c) {
      var b = el('button', 'chip', esc(c));
      b.type = 'button';
      b.setAttribute('aria-pressed', c === 'All' ? 'true' : 'false');
      b.dataset.cat = c;
      b.addEventListener('click', function () { setCat(c); });
      filters.appendChild(b);
    });

    var list = $('#nearbyList');
    list.innerHTML = '';
    CATS.forEach(function (c) {
      var items = p.nearby[c] || [];
      if (!items.length) return;
      var g = el('section', 'nearby__group');
      g.dataset.cat = c;
      g.innerHTML = '<h3 class="nearby__group-title">' + esc(c) + '</h3>';
      items.forEach(function (place, idx) {
        var b = el('button', 'place');
        b.type = 'button';
        b.dataset.pin = c + '-' + idx;
        b.innerHTML =
          '<span class="place__name">' + esc(place.name) + '</span>' +
          '<span class="place__meta"><span class="place__dist">' + esc(place.km) + '</span><span class="place__time">' + esc(place.min) + '</span></span>';
        b.addEventListener('click', function () { focusPin(c + '-' + idx, b); });
        g.appendChild(b);
      });
      list.appendChild(g);
    });

    buildMap();
    setCat('All');
  }

  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
  }

  function rng(seed) {
    var a = seed;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function buildMap() {
    var svg = $('#mapSvg');
    var r = rng(hash(slug));
    var W = 800, H = 620;
    var out = '<rect width="' + W + '" height="' + H + '" fill="#F1EFE9"/>';

    // land blocks
    var x = -20, y = -20;
    var blocks = [];
    while (y < H + 20) {
      var rowH = 52 + r() * 46;
      x = -20;
      while (x < W + 20) {
        var w = 70 + r() * 90;
        blocks.push([x, y, w, rowH]);
        x += w + 10 + r() * 8;
      }
      y += rowH + 11 + r() * 8;
    }
    blocks.forEach(function (b) {
      out += '<rect x="' + b[0].toFixed(1) + '" y="' + b[1].toFixed(1) + '" width="' + (b[2] - 6).toFixed(1) + '" height="' + (b[3] - 6).toFixed(1) + '" rx="2" fill="#E6E2D8"/>';
    });

    // parks
    out += '<ellipse cx="640" cy="120" rx="120" ry="78" fill="#DFE6D5"/>';
    out += '<ellipse cx="150" cy="520" rx="130" ry="72" fill="#DFE6D5"/>';
    out += '<rect x="270" y="250" width="150" height="96" rx="4" fill="#DFE6D5"/>';

    // water
    out += '<path d="M-20 470 C120 440 190 520 300 512 C420 504 470 570 520 640 L-20 640 Z" fill="#DCE5E6"/>';

    // roads
    out += '<g stroke="#FFFFFF" fill="none" stroke-linecap="round">';
    out += '<path d="M-20 210 C160 190 260 240 420 226 C560 214 680 250 820 214" stroke-width="14"/>';
    out += '<path d="M-20 430 C140 410 240 452 360 440 C500 426 640 470 820 438" stroke-width="10"/>';
    out += '<path d="M240 -20 C250 120 210 260 250 400 C280 500 300 560 296 640" stroke-width="12"/>';
    out += '<path d="M600 -20 C580 120 620 260 590 400 C570 500 590 570 600 640" stroke-width="9"/>';
    out += '<path d="M-20 320 C120 300 260 340 420 320 C560 302 700 330 820 312" stroke-width="7"/>';
    out += '</g>';

    // road names
    out += '<g fill="rgba(17,17,17,.34)" font-family="Inter,Helvetica,Arial,sans-serif" font-size="10" letter-spacing="1.4">';
    out += '<text x="330" y="204">AL KHALEEL STREET</text>';
    out += '<text x="330" y="424">DUBAI HILLS BOULEVARD</text>';
    out += '<text x="258" y="120" transform="rotate(90 258 120)">PARK AVENUE</text>';
    out += '<text x="610" y="300" transform="rotate(90 610 300)">GOLF CLUB DRIVE</text>';
    out += '</g>';

    out += '<g fill="rgba(17,17,17,.22)" font-family="Inter,Helvetica,Arial,sans-serif" font-size="10" letter-spacing="2" text-anchor="middle">';
    out += '<text x="640" y="124">DUBAI HILLS PARK</text>';
    out += '<text x="150" y="524">COMMUNITY GARDENS</text>';
    out += '</g>';

    svg.innerHTML = out;

    // pins
    var pins = $('#mapPins');
    pins.innerHTML = '';
    var home = el('div', 'pin pin--home');
    home.style.left = '47%';
    home.style.top = '52%';
    home.innerHTML = '<span class="pin__dot"></span><span class="pin__label">' + esc(p.short) + '</span>';
    pins.appendChild(home);

    var rr = rng(hash(slug + 'pins'));
    var spots = [
      [22, 20], [70, 18], [82, 40], [63, 66], [30, 74], [15, 42], [55, 30], [40, 80], [76, 82], [12, 62], [86, 62]
    ];
    var n = 0;
    CATS.forEach(function (c) {
      (p.nearby[c] || []).forEach(function (place, idx) {
        var spot = spots[n % spots.length];
        n++;
        var pin = el('div', 'pin');
        pin.dataset.pin = c + '-' + idx;
        pin.dataset.cat = c;
        pin.style.left = (spot[0] + (rr() * 6 - 3)) + '%';
        pin.style.top = (spot[1] + (rr() * 6 - 3)) + '%';
        pin.innerHTML = '<span class="pin__dot"></span><span class="pin__label">' + esc(place.name) + ' · ' + esc(place.min) + '</span>';
        pin.addEventListener('click', function () { focusPlace(c + '-' + idx, pin); });
        pins.appendChild(pin);
      });
    });
  }

  function setCat(c) {
    activeCat = c;
    $$('#nearbyFilters .chip').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.cat === c ? 'true' : 'false');
    });
    $$('#nearbyList .nearby__group').forEach(function (g) {
      g.hidden = !(c === 'All' || g.dataset.cat === c);
    });
    $$('#mapPins .pin').forEach(function (pin) {
      if (pin.classList.contains('pin--home')) return;
      var on = c === 'All' || pin.dataset.cat === c;
      pin.classList.toggle('is-dim', !on);
    });
  }

  function focusPin(key, row) {
    $$('#mapPins .pin').forEach(function (pin) {
      pin.classList.toggle('is-active', pin.dataset.pin === key);
    });
    $$('#nearbyList .place').forEach(function (b) { b.classList.toggle('is-active', b === row); });
  }

  function focusPlace(key, pin) {
    $$('#mapPins .pin').forEach(function (n) { n.classList.toggle('is-active', n === pin); });
    var row = $('#nearbyList .place[data-pin="' + key + '"]');
    $$('#nearbyList .place').forEach(function (b) { b.classList.toggle('is-active', b === row); });
    if (row && row.offsetParent) {
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /* ───────────────────────── masterplan + faq + explore ───────────────────────── */

  function renderMasterplan() {
    var img = $('#masterplanImage');
    img.src = IMG + p.masterplan;
    img.alt = p.masterplanAlt;
  }

  function renderFaq() {
    var list = $('#faqList');
    list.innerHTML = '';
    faqs(p).forEach(function (f, i) {
      var item = el('article', 'faq__item' + (i === 0 ? ' is-open' : ''));
      item.innerHTML =
        '<button class="faq__q" type="button" aria-expanded="' + (i === 0 ? 'true' : 'false') + '">' +
        '<span class="faq__no">' + pad2(i + 1) + '</span>' +
        '<span class="faq__text">' + esc(f.q) + '</span>' +
        '<span class="faq__sign" aria-hidden="true">+</span>' +
        '</button>' +
        '<div class="faq__a"><div><p>' + esc(f.a) + '</p></div></div>';
      var btn = $('.faq__q', item);
      btn.addEventListener('click', function () {
        var open = item.classList.toggle('is-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      list.appendChild(item);
    });
  }

  function renderExplore() {
    var grid = $('#exploreGrid');
    if (!grid) return;
    grid.innerHTML = '';
    var others = ORDER.filter(function (s) { return s !== slug; });
    others.sort(function (a, b) {
      var ca = PROJECTS[a].city === p.city ? 0 : 1;
      var cb = PROJECTS[b].city === p.city ? 0 : 1;
      return ca - cb;
    });
    others.slice(0, 3).forEach(function (s, i) {
      var o = PROJECTS[s];
      var li = el('li', 'crow');
      li.setAttribute('data-status', o.status);
      li.innerHTML = '<a class="crow__link" href="project.html?project=' + encodeURIComponent(s) + '" data-preview="' + o.hero + '" data-cursor="Open project">' +
        '<span class="crow__num">' + ('0' + (i + 1)).slice(-2) + '</span>' +
        '<span class="crow__name">' + esc(o.name) + '</span>' +
        '<span class="crow__loc">' + esc(o.location) + '</span>' +
        '<span class="crow__type">' + esc(o.type) + '</span>' +
        '<span class="crow__price">From ' + esc(window.shadeMoney ? window.shadeMoney(o, o.currency) : o.price) + '</span>' +
        '<span class="crow__state"><i class="dot" aria-hidden="true"></i>' + esc(o.status) + '</span>' +
        '<svg class="crow__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M12.5 6.5 18 12l-5.5 5.5"/></svg></a>';
      grid.appendChild(li);
    });
    initExplorePreview(grid);
  }

  function initExplorePreview(grid) {
    if (!window.matchMedia('(hover: hover)').matches) return;
    var box = el('div', 'preview');
    box.setAttribute('aria-hidden', 'true');
    box.innerHTML = '<img alt="" src="' + (p.hero || 'assets/ksa/arbour-townhomes.jpg') + '">';
    grid.parentElement.appendChild(box);
    var img = box.querySelector('img');
    var xTo = null, yTo = null;
    if (window.gsap) {
      xTo = window.gsap.quickTo(box, 'x', { duration: .5, ease: 'power3.out' });
      yTo = window.gsap.quickTo(box, 'y', { duration: .5, ease: 'power3.out' });
    }
    $$('.crow__link', grid).forEach(function (a) {
      a.addEventListener('mouseenter', function () {
        img.src = a.getAttribute('data-preview');
        if (window.gsap) {
          window.gsap.fromTo(img, { scale: 1.08 }, { scale: 1, duration: .6, ease: 'power2.out' });
          window.gsap.to(box, { opacity: 1, duration: .35 });
        } else box.style.opacity = '1';
      });
      a.addEventListener('mouseleave', function () {
        if (window.gsap) window.gsap.to(box, { opacity: 0, duration: .3 });
        else box.style.opacity = '0';
      });
      a.addEventListener('mousemove', function (e) {
        var x = e.clientX + 28, y = e.clientY - box.offsetHeight * .5;
        if (xTo) { xTo(x); yTo(y); }
        else box.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
      });
    });
  }

  /* ───────────────────────── menu, dock, theme ───────────────────────── */

  function renderMenu() {
    var ul = $('#menuProjects');
    if (!ul) return;
    ul.innerHTML = '';
    ORDER.forEach(function (s) {
      var o = PROJECTS[s];
      var li = el('li');
      li.innerHTML = '<a href="project.html?project=' + encodeURIComponent(s) + '"' + (s === slug ? ' aria-current="page"' : '') + '>' +
        '<span>' + esc(o.name) + '</span><span>' + esc(o.city) + '</span></a>';
      ul.appendChild(li);
    });
  }

  function initMenu() {
    var menu = $('#menu');
    var btn = $('#menuBtn');
    var open = false;

    function setMenu(state) {
      open = state;
      if (state) {
        menu.hidden = false;
        requestAnimationFrame(function () { menu.classList.add('is-open'); });
        document.body.style.overflow = 'hidden';
        btn.setAttribute('aria-expanded', 'true');
        btn.innerHTML = 'CLOSE <span class="btn__dots" aria-hidden="true">✕</span>';
        setTimeout(function () { $('.menu__nav a', menu).focus(); }, 120);
      } else {
        menu.classList.remove('is-open');
        document.body.style.overflow = '';
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = 'MENU <span class="btn__dots" aria-hidden="true">••</span>';
        setTimeout(function () { menu.hidden = true; }, 380);
      }
    }

    btn.addEventListener('click', function () { setMenu(!open); });
    $$('[data-close-menu]', menu).forEach(function (b) { b.addEventListener('click', function () { setMenu(false); }); });
    $$('.menu a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) setMenu(false);
    });
  }

  function initModals() {
    var lastFocus = null;

    function openModal(id) {
      var m = document.getElementById('modal' + id.charAt(0).toUpperCase() + id.slice(1));
      if (!m) return;
      lastFocus = document.activeElement;
      m.hidden = false;
      document.body.classList.add('modal-open');
      var f = m.querySelector('input,textarea,button');
      if (f) setTimeout(function () { f.focus(); }, 60);
    }
    function closeModal(m) {
      m.hidden = true;
      document.body.classList.remove('modal-open');
      if (lastFocus) lastFocus.focus();
    }

    $$('[data-open]').forEach(function (b) {
      b.addEventListener('click', function () {
        openModal(b.getAttribute('data-open'));
      });
    });
    $$('.modal').forEach(function (m) {
      $$('[data-close-modal]', m).forEach(function (b) { b.addEventListener('click', function () { closeModal(m); }); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      $$('.modal').forEach(function (m) { if (!m.hidden) closeModal(m); });
    });

    // enquire form (only present on legacy markup)
    var form = $('#enqForm');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#enqName'), email = $('#enqEmail'), out = $('#enqMsgOut');
      if (!name.value.trim() || !email.value.trim() || email.value.indexOf('@') < 1) {
        out.textContent = 'Please add your name and a valid email address.';
        (!name.value.trim() ? name : email).focus();
        return;
      }
      out.textContent = 'Thank you, ' + name.value.trim().split(' ')[0] + '. Our team will be in touch within one working day.';
      form.reset();
    });

    // brochure (legacy modal)
    var broDownload = $('#broDownload');
    if (broDownload) broDownload.addEventListener('click', function () {
      var rows = [
        ['Project', p.name], ['Location', p.location], ['Status', p.status], ['Property type', p.type],
        ['Starting from', moneyFor(p.currency)], ['Handover', p.handover], ['Unit size', p.size]
      ];
      var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + esc(p.name) + ' — Brochure</title>' +
        '<style>body{font-family:Helvetica,Arial,sans-serif;max-width:720px;margin:64px auto;padding:0 32px;color:#111}h1{font-weight:300;letter-spacing:-.02em;font-size:44px;text-transform:uppercase;margin:0 0 8px}h2{font-size:15px;letter-spacing:.1em;text-transform:uppercase;font-weight:500;margin:32px 0 10px}p{line-height:1.6;font-size:15px}table{width:100%;border-collapse:collapse;margin-top:12px}td{padding:10px 0;border-bottom:1px solid #ddd;font-size:14px}td:first-child{color:#666;text-transform:uppercase;letter-spacing:.08em;font-size:11px;width:40%}li{font-size:14px;line-height:1.7}</style></head><body>' +
        '<h1>' + esc(p.name) + '</h1><p>' + esc(p.location) + ' · ' + esc(p.type) + '</p>' +
        '<table>' + rows.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>'; }).join('') + '</table>' +
        '<h2>Overview</h2><p>' + esc(p.overview) + '</p>' +
        '<h2>Amenities</h2><ul>' + p.amenities.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' +
        '<h2>Layouts</h2><table>' + p.layouts.map(function (l) { return '<tr><td>' + esc(l.name) + '</td><td>' + esc(l.size + ' · ' + l.bedrooms + ' bed · ' + l.bathrooms + ' bath') + '</td></tr>'; }).join('') + '</table>' +
        '<p style="margin-top:40px;font-size:11px;color:#777">Shadestate · Office 1204, Bay Square 7, Business Bay, Dubai · hello@shadestate.com</p>' +
        '</body></html>';
      var blob = new Blob([html], { type: 'text/html' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = slug + '-brochure.html';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    });

    // newsletter (legacy form)
    var news = $('#newsForm'), msg = $('#newsMsg');
    if (news) news.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = $('#newsEmail').value.trim();
      if (v.indexOf('@') < 1) { msg.textContent = 'Please enter a valid email.'; return; }
      msg.textContent = 'Thank you — you are on the list.';
      news.reset();
    });
  }

  function initScrollUI() {
    var top = $('#topbar');
    var dock = $('#dock');
    var quick = $('#quick');
    var hero = $('#project');
    var sections = ['overview', 'gallery', 'amenities', 'plans', 'location', 'faq'];
    var darkSections = $$('[data-theme="dark"]');

    var ticking = false;
    function update() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset;

      var dark = false;
      darkSections.forEach(function (s) {
        var r = s.getBoundingClientRect();
        if (r.top <= 60 && r.bottom >= 60) dark = true;
      });
      if (top) top.classList.toggle('is-scrolled', y > 30);

      var heroBottom = hero.getBoundingClientRect().bottom;
      var foot = document.querySelector('.footer');
      var footTop = foot ? foot.getBoundingClientRect().top : 1e9;
      var show = heroBottom < 40 && footTop > window.innerHeight - 90;
      dock.classList.toggle('is-visible', show);
      quick.classList.toggle('is-visible', show);

      var current = '';
      sections.forEach(function (id) {
        var s = document.getElementById(id);
        if (!s) return;
        var r = s.getBoundingClientRect();
        if (r.top <= window.innerHeight * .45 && r.bottom > window.innerHeight * .45) current = id;
      });
      $$('#dock a').forEach(function (a) {
        a.classList.toggle('is-active', a.getAttribute('data-spy') === current);
      });

    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();

    $$('[data-top]').forEach(function (b) {
      b.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    });
  }

  function initReveal() {
    var nodes = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      nodes.forEach(function (n) { n.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: .08, rootMargin: '120px 0px -30px 0px' });
    nodes.forEach(function (n) { io.observe(n); });

    // Safety net: smooth scrolling and programmatic jumps can skip an item, so
    // anything that has entered (or passed) the viewport is revealed on settle.
    var settling = false;
    function catchUp() {
      settling = false;
      var vh = window.innerHeight;
      nodes.forEach(function (n) {
        if (n.classList.contains('in')) return;
        var r = n.getBoundingClientRect();
        if (r.top < vh + 120 && r.bottom > -120) { n.classList.add('in'); io.unobserve(n); }
      });
    }
    window.addEventListener('scroll', function () {
      if (settling) return;
      settling = true;
      setTimeout(catchUp, 120);
    }, { passive: true });
    window.addEventListener('resize', catchUp);
    setTimeout(catchUp, 900);
  }

  function initGalleryWheel() {
    var track = $('#galleryTrack');
    track.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        var max = track.scrollWidth - track.clientWidth;
        if ((e.deltaY > 0 && track.scrollLeft < max - 1) || (e.deltaY < 0 && track.scrollLeft > 1)) {
          track.scrollLeft += e.deltaY;
        }
      }
    }, { passive: true });
  }

  /* ───────────────────────── footer art ───────────────────────── */

  function skyline() {
    var wrap = $('#skyline');
    var w = 1600, h = 260;
    var r = rng(20261119);
    var out = '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">';
    var x = -40;
    while (x < w + 40) {
      var bw = 34 + r() * 90;
      var bh = 40 + r() * 150;
      var y = h - bh;
      out += '<rect x="' + x.toFixed(0) + '" y="' + y.toFixed(0) + '" width="' + bw.toFixed(0) + '" height="' + bh.toFixed(0) + '" fill="#1b1b1b"/>';
      // windows
      var cols = Math.max(1, Math.floor(bw / 16));
      var rows = Math.max(1, Math.floor(bh / 20));
      for (var cc = 0; cc < cols; cc++) {
        for (var rr2 = 0; rr2 < rows; rr2++) {
          if (r() > .55) out += '<rect x="' + (x + 7 + cc * 15).toFixed(0) + '" y="' + (y + 9 + rr2 * 18).toFixed(0) + '" width="4" height="6" fill="#2c2c2c"/>';
        }
      }
      x += bw + 8 + r() * 26;
    }
    out += '<rect x="0" y="' + (h - 6) + '" width="' + w + '" height="6" fill="#1b1b1b"/></svg>';
    wrap.innerHTML = out;
  }

  function ctaArt() {
    if (!$('#ctaArt')) return;
    // Exploded axonometric tower: stacked floor plates, corner columns, label leaders.
    var W = 520, H = 420;
    var cx = 190, cy = 315, k = 0.86;
    function L(x, y, z) { return [cx + (x - y) * k, cy + (x + y) * 0.5 * k - z * k]; }
    function n(v) { return v.toFixed(1); }
    function line(a, b) { return '<line x1="' + n(a[0]) + '" y1="' + n(a[1]) + '" x2="' + n(b[0]) + '" y2="' + n(b[1]) + '"/>'; }
    function flat(x, y, w, d, z) {
      var p1 = L(x, y, z), p2 = L(x + w, y, z), p3 = L(x + w, y + d, z), p4 = L(x, y + d, z);
      return '<path d="M' + n(p1[0]) + ' ' + n(p1[1]) + 'L' + n(p2[0]) + ' ' + n(p2[1]) +
             'L' + n(p3[0]) + ' ' + n(p3[1]) + 'L' + n(p4[0]) + ' ' + n(p4[1]) + 'Z"/>';
    }

    var out = '';
    var w = 108, d = 80;
    var zs = [0, 35, 70, 105, 140, 175];

    // ground plate
    out += flat(-24, -18, w + 48, d + 36, -26);
    for (var i = 0; i < zs.length; i++) {
      out += flat(0, 0, w, d, zs[i]);
    }
    // corner columns across the whole stack
    [[0, 0], [w, 0], [w, d], [0, d]].forEach(function (c) {
      out += line(L(c[0], c[1], zs[0]), L(c[0], c[1], zs[zs.length - 1] + 18));
    });
    // roof crown
    out += flat(0, 0, w, d, zs[zs.length - 1] + 18);
    out += flat(30, 24, 42, 32, zs[zs.length - 1] + 34);
    [[30, 24], [72, 24], [72, 56], [30, 56]].forEach(function (c) {
      out += line(L(c[0], c[1], zs[zs.length - 1] + 18), L(c[0], c[1], zs[zs.length - 1] + 34));
    });

    // balconies: short plates on the two visible faces
    zs.slice(1, 5).forEach(function (z, i) {
      out += flat(4, d + 2, 34, 10, z);
      out += flat(w + 2, 6, 10, 30, z);
    });

    // labels
    var notes = [
      ['SKY LOUNGE', zs[zs.length - 1] + 26],
      ['RESIDENCES', zs[4] + 6],
      ['POOL + GYM', zs[2] + 6],
      ['LOBBY + RETAIL', zs[1] + 4],
      ['PARKING', -26]
    ];
    notes.forEach(function (nt) {
      var a = L(w + 12, d * 0.55, nt[1]);
      var b = [a[0] + 34, a[1]];
      var c = [b[0] + 22, b[1]];
      out += line(a, b) + line(b, c);
      out += '<circle cx="' + n(a[0]) + '" cy="' + n(a[1]) + '" r="1.6" fill="#111" stroke="none"/>';
      out += '<text x="' + n(c[0] + 6) + '" y="' + n(c[1] + 2.5) + '">' + nt[0] + '</text>';
    });

    $('#ctaArt').innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + out + '</svg>';
  }

  function initPlanZoom() {
    var zoom = $('#planZoom');
    var box = $('#planLightbox');
    if (!zoom || !box) return;
    var img = $('#lightboxImg');
    var cap = $('#lightboxCap');
    function open() {
      var plan = $('#planImage');
      if (img) { img.src = plan.src; img.alt = plan.alt; }
      if (cap) cap.textContent = $('#planTitle') ? $('#planTitle').textContent : '';
      box.hidden = false;
      document.body.classList.add('is-locked');
      requestAnimationFrame(function () { box.classList.add('is-open'); });
      var btn = $('#lightboxClose'); if (btn) setTimeout(function () { btn.focus(); }, 60);
    }
    function close() {
      box.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      setTimeout(function () { box.hidden = true; }, 300);
    }
    zoom.addEventListener('click', open);
    var c = $('#lightboxClose'); if (c) c.addEventListener('click', close);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) close(); });
  }

  /* ───────────────────────── boot ───────────────────────── */

  function init() {
    renderHero();
    renderLandmarks();
    renderGallery();
    renderAmenities();
    renderLayouts();
    renderNearby();
    renderMasterplan();
    renderFaq();
    renderExplore();
    renderMenu();
    initModals();
    initScrollUI();
    initGalleryWheel();
    initPlanZoom();
    ctaArt();
    initReveal();

    // mark current menu link
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
