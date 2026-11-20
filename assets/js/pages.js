/* ==========================================================================
   SHADESTATE · inner page behaviour
   Projects filter + preview · studio team · three-step enquiry · journal
   · legal index. Guarded: each block only runs when its markup is present.
   ========================================================================== */
(function () {
  'use strict';

  /* responsive-photo helper (assets/js/img-manifest.js), with a plain fallback */
  var photo = window.shadePhoto || function (img, src) { if (img && src) img.src = src; };

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var money = window.shadeMoney;

  /* ── projects: editorial showcase grid + numbered index ─────────────────
     Grid spans are re-balanced on every filter change so each row always
     fills 12 columns (Hale Arden's large/small rhythm, OH's stagger, Cargo's
     Swiss metadata). Index view keeps the numbered hairline table. */
  function initCatalogue() {
    var grid = $('#projectGrid');
    var index = $('#projectIndex');
    if (!grid && !index) return;
    var cards = grid ? $$('.pcard', grid) : [];
    var rows = index ? $$('.crow', index) : [];
    var pool = cards.length ? cards : rows;
    var statusBtns = $$('#statusFilters .filter');
    var countryBtns = $$('#countryFilters .filter');
    var viewBtns = $$('.viewtoggle__btn');
    var count = $('#catalogueCount');
    var empty = $('#catalogueEmpty');
    var status = 'all', country = 'all';
    var total = pool.length;

    var SPANS = ['pcard--s4', 'pcard--s5', 'pcard--s7', 'pcard--s8', 'pcard--s12', 'pcard--off'];
    var PAIRS = [[7, 5], [5, 7]];

    function plan(n) {
      var out = [], rem = n, k = 0;
      while (rem > 0) {
        if (rem === 1) { out.push([12]); rem = 0; }
        else if (rem === 2) { out.push(PAIRS[k % 2]); rem = 0; }
        else if (rem === 3) { out.push([4, 4, 4]); rem = 0; }
        else { out.push(PAIRS[k % 2]); k++; rem -= 2; }
      }
      return out;
    }

    function assign(list) {
      if (!list.length) return;
      var ordered = plan(list.length), i = 0;
      ordered.forEach(function (row) {
        row.forEach(function (span, j) {
          var el = list[i++];
          if (!el) return;
          SPANS.forEach(function (c) { el.classList.remove(c); });
          el.classList.add('pcard--s' + span);
          el.style.setProperty('--d', j);
          /* drop the smaller plate of each pair so the pair reads as a stagger,
             whichever side it lands on */
          if (row.length === 2 && span === 5) el.classList.add('pcard--off');
        });
      });
    }

    function match(el) {
      return (status === 'all' || el.getAttribute('data-status') === status) &&
             (country === 'all' || el.getAttribute('data-country') === country);
    }

    function tally(list, key, value) {
      var n = 0;
      list.forEach(function (el) {
        if (!match(el)) return;
        if (value === 'all' || el.getAttribute('data-' + key) === value) n++;
      });
      return n;
    }

    function recount() {
      statusBtns.forEach(function (b) {
        var span = $('.count', b);
        if (span) span.textContent = tally(pool, 'status', b.getAttribute('data-status'));
      });
      countryBtns.forEach(function (b) {
        var span = $('.count', b);
        if (span) span.textContent = tally(pool, 'country', b.getAttribute('data-country'));
      });
    }

    function apply() {
      var shown = 0, visible = [];
      cards.forEach(function (el) {
        var ok = match(el);
        el.classList.toggle('is-off', !ok);
        if (ok) { shown++; visible.push(el); }
      });
      rows.forEach(function (el) { el.classList.toggle('is-off', !match(el)); });
      assign(visible);
      if (count) count.textContent = 'Showing ' + shown + ' of ' + total;
      if (empty) empty.hidden = shown !== 0;
      recount();
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }

    function wire(btns, key, set) {
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          btns.forEach(function (b) { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
          btn.classList.add('is-active');
          btn.setAttribute('aria-pressed', 'true');
          set(btn.getAttribute('data-' + key));
          apply();
        });
      });
    }
    wire(statusBtns, 'status', function (v) { status = v; });
    wire(countryBtns, 'country', function (v) { country = v; });

    $$('[data-reset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        status = 'all'; country = 'all';
        [statusBtns, countryBtns].forEach(function (group) {
          group.forEach(function (b) {
            var on = (b.getAttribute('data-status') === 'all' || b.getAttribute('data-country') === 'all');
            b.classList.toggle('is-active', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
        });
        apply();
      });
    });

    function setView(v) {
      var isGrid = v !== 'index';
      if (grid) grid.hidden = !isGrid;
      if (index) index.hidden = isGrid;
      viewBtns.forEach(function (b) {
        var on = b.getAttribute('data-view') === (isGrid ? 'grid' : 'index');
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }
    viewBtns.forEach(function (b) {
      b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
    });

    apply();
  }

  /* ── studio: team list ↔ portrait (Hale Arden rhythm) ────────────────── */
  function initTeam() {
    var root = $('[data-team]');
    if (!root) return;
    var items = $$('.team-item', root);
    var imgs = $$('.team-image', root);
    var jobs = $$('.team-job', root);
    if (!items.length) return;

    function set(k) {
      items.forEach(function (it, i) { it.classList.toggle('is-active', i === k); });
      imgs.forEach(function (im, i) { im.classList.toggle('is-active', i === k); });
      jobs.forEach(function (j, i) { j.classList.toggle('is-active', i === k); });
    }

    var isMobile = function () { return window.matchMedia('(max-width: 900px)').matches; };

    items.forEach(function (it, i) {
      it.addEventListener('mouseenter', function () { if (!isMobile()) set(i); });
      it.addEventListener('focusin', function () { set(i); });
      it.tabIndex = 0;
    });

    if (isMobile() && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            var k = items.indexOf(en.target);
            if (k >= 0) set(k);
          }
        });
      }, { rootMargin: '-40% 0px -40% 0px' });
      items.forEach(function (it) { io.observe(it); });
    }
  }

  /* ── contact: three-step enquiry ─────────────────────────────────────── */
  var ADVISORS = {
    'Dubai': { name: 'Layla Haddad', role: 'Partner, Design', city: 'Dubai' },
    'Saudi Arabia': { name: 'Faisal Al-Qahtani', role: 'Partner, Development', city: 'Riyadh' },
    'Advisory': { name: 'Daniel Whitfield', role: 'Head of Advisory', city: 'Dubai' }
  };

  function initInquiry() {
    var form = $('#inquiryForm');
    if (!form) return;
    var steps = $$('.step', form);
    var now = $('#stepNow');
    var bar = $('#stepBar');
    var done = $('#inquiryDone');
    var current = 1;

    var projectSel = $('#cProject');
    var params = new URLSearchParams(location.search);
    var pre = params.get('project');
    if (pre && window.SHADE_PROJECTS && window.SHADE_PROJECTS[pre] && projectSel) {
      projectSel.value = pre;
      var p = window.SHADE_PROJECTS[pre];
      var interest = p.country === 'Saudi Arabia' ? 'Saudi Arabia' : 'Dubai';
      var radio = $('input[name="interest"][value="' + interest + '"]', form);
      if (radio) radio.checked = true;
    }
    var interestParam = params.get('interest');
    if (interestParam) {
      var r2 = $('input[name="interest"][value="' + interestParam + '"]', form);
      if (r2) r2.checked = true;
    }

    function show(n) {
      current = Math.min(3, Math.max(1, n));
      steps.forEach(function (s) { s.classList.toggle('is-active', Number(s.dataset.step) === current); });
      if (now) now.textContent = '0' + current;
      if (bar) bar.style.width = (current / 3 * 100).toFixed(2) + '%';
      if (current === 3) buildSummary();
      var legend = $('.step.is-active .step__legend', form);
      if (legend) legend.setAttribute('tabindex', '-1');
    }

    function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

    function validateStep() {
      var ok = true;
      if (current === 2) {
        var name = $('#cName'), email = $('#cEmail');
        [name, email].forEach(function (f) {
          if (!f) return;
          var bad = !f.value.trim() || (f.type === 'email' && !validEmail(f.value));
          f.style.borderColor = bad ? '#C9A55A' : '';
          if (bad) ok = false;
        });
      }
      return ok;
    }

    function projectName() {
      if (!projectSel || projectSel.value === 'general') return 'the residences';
      var p = window.SHADE_PROJECTS && window.SHADE_PROJECTS[projectSel.value];
      return p ? p.name : 'the residences';
    }

    function buildSummary() {
      var box = $('#summary');
      if (!box) return;
      var interest = ($('input[name="interest"]:checked', form) || {}).value || 'Dubai';
      var date = $('#cDate') && $('#cDate').value;
      var time = $('#cTime') && $('#cTime').value;
      var timeline = $('#cTimeline') && $('#cTimeline').value;
      var rows = [
        ['Interest', interest],
        ['Development', projectName()],
        ['Timeline', timeline || 'To be confirmed'],
        ['Viewing', (date ? new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : 'To be arranged') + (time ? ' · ' + time : '')]
      ];
      box.innerHTML = rows.map(function (r) {
        return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
      }).join('');
    }

    $$('[data-next]', form).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!validateStep()) return;
        show(current + 1);
      });
    });
    $$('[data-back]', form).forEach(function (btn) {
      btn.addEventListener('click', function () { show(current - 1); });
    });

    ['#cDate', '#cTime', '#cTimeline', '#cProject'].forEach(function (sel) {
      var el = $(sel);
      if (el) el.addEventListener('change', function () { if (current === 3) buildSummary(); });
    });
    $$('input[name="interest"]', form).forEach(function (r) {
      r.addEventListener('change', function () { if (current === 3) buildSummary(); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateStep()) return;
      var interest = ($('input[name="interest"]:checked', form) || {}).value || 'Dubai';
      var adv = ADVISORS[interest] || ADVISORS.Dubai;
      var name = ($('#cName') && $('#cName').value.trim().split(' ')[0]) || 'thank you';
      var dn = $('#doneName'), da = $('#doneAdvisor'), dr = $('#doneRole'), dp = $('#doneProject'), ds = $('#doneSummary');
      if (dn) dn.textContent = name;
      if (da) da.textContent = adv.name;
      if (dr) dr.textContent = adv.role + ' · ' + adv.city;
      if (dp) dp.textContent = projectName();
      if (ds) {
        var date = $('#cDate') && $('#cDate').value;
        var time = $('#cTime') && $('#cTime').value;
        ds.innerHTML =
          '<div><dt>Interest</dt><dd>' + interest + '</dd></div>' +
          '<div><dt>Development</dt><dd>' + projectName() + '</dd></div>' +
          '<div><dt>Preferred viewing</dt><dd>' + (date ? new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'To be arranged') + (time ? ' · ' + time : '') + '</dd></div>';
      }
      form.hidden = true;
      var head = $('.inquiry__head');
      if (head) head.style.display = 'none';
      if (done) done.hidden = false;
    });

    show(1);
  }

  /* ── studio clocks: open / by appointment ────────────────────────────── */
  function initOpenState() {
    var nodes = $$('[data-open]');
    if (!nodes.length) return;
    var zones = { dubai: 'Asia/Dubai', riyadh: 'Asia/Riyadh' };
    function tick() {
      nodes.forEach(function (el) {
        var z = zones[el.getAttribute('data-open')] || 'Asia/Dubai';
        var parts = {};
        try {
          var fmt = new Intl.DateTimeFormat('en-GB', { timeZone: z, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
          fmt.formatToParts(new Date()).forEach(function (p) { parts[p.type] = p.value; });
        } catch (err) { return; }
        var day = parts.weekday;
        var hour = parseInt(parts.hour, 10);
        var open = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].indexOf(day) !== -1 && hour >= 9 && hour < 18;
        el.textContent = open ? 'Open now' : 'By appointment';
        el.classList.toggle('is-closed', !open);
      });
    }
    tick();
    setInterval(tick, 60000);
  }

  /* ── journal ─────────────────────────────────────────────────────────── */
  function initJournal() {
    var grid = $('#journalGrid');
    var posts = window.SHADE_JOURNAL;
    if (!grid || !posts) return;
    var filters = $$('#journalFilters .filter');
    var count = $('#journalCount');
    var reader = $('#reader');

    grid.innerHTML = posts.map(function (p, i) {
      return '<a class="jcard" href="blog.html?article=' + p.slug + '" data-cat="' + p.cat + '" style="--i:' + (i % 3) + '" data-no-transition>' +
        '<figure class="jcard__figure"><img alt="" loading="lazy" decoding="async" data-photo="' + p.img + '"></figure>' +
        '<p class="jcard__meta"><b>' + p.cat + '</b><span>' + p.date + '</span><span>' + p.read + '</span></p>' +
        '<h3 class="jcard__title">' + p.title + '</h3>' +
        '<p class="jcard__excerpt">' + p.excerpt + '</p>' +
        '<span class="jcard__more">Read the essay →</span></a>';
    }).join('');

    $$('.jcard__figure img', grid).forEach(function (im) {
      photo(im, im.getAttribute('data-photo'), '(max-width: 700px) 100vw, 34vw');
    });

    var cards = $$('.jcard', grid);
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
      }, { rootMargin: '0px 0px -6% 0px' });
      cards.forEach(function (c) { io.observe(c); });
    } else cards.forEach(function (c) { c.classList.add('is-in'); });

    filters.forEach(function (btn) {
      btn.addEventListener('click', function () {
        filters.forEach(function (b) { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('is-active'); btn.setAttribute('aria-pressed', 'true');
        var cat = btn.dataset.cat;
        var n = 0;
        cards.forEach(function (c) {
          var ok = cat === 'all' || c.dataset.cat === cat;
          c.classList.toggle('is-off', !ok);
          if (ok) n++;
        });
        if (count) count.textContent = n + (n === 1 ? ' essay' : ' essays');
      });
    });
    if (count) count.textContent = cards.length + ' essays';

    var slug = new URLSearchParams(location.search).get('article');
    if (slug && reader) {
      var post = posts.filter(function (p) { return p.slug === slug; })[0];
      if (post) {
        grid.hidden = true;
        var bar = $('.journal__bar');
        if (bar) bar.hidden = true;
        $('#readerCat').textContent = post.cat + ' · ' + post.date;
        $('#readerTitle').textContent = post.title;
        $('#readerMeta').textContent = 'By the Shadestate studio · ' + post.read + ' read';
        photo($('#readerImg'), post.img, '(max-width: 900px) 100vw, 62vw');
        $('#readerImg').alt = post.title;
        $('#readerBody').innerHTML = post.body.map(function (b) {
          if (typeof b === 'string') return '<p>' + b + '</p>';
          if (b.h) return '<h3>' + b.h + '</h3>';
          return '';
        }).join('');
        reader.hidden = false;
        document.title = post.title + ' · Shadestate Journal';
        window.scrollTo(0, 0);
      }
    }
  }

  /* ── legal: sticky index follows the prose ───────────────────────────── */
  function initLegal() {
    var blocks = $$('.prose__block[id]');
    if (!blocks.length) return;
    var links = $$('[data-legal-link]');
    if (!('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id);
        });
      });
    }, { rootMargin: '-32% 0px -58% 0px' });
    blocks.forEach(function (b) { io.observe(b); });
  }

  function init() {
    initCatalogue();
    initTeam();
    initInquiry();
    initOpenState();
    initJournal();
    initLegal();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
