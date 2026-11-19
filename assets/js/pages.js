/* ==========================================================================
   SHADESTATE — inner page behaviour
   Projects filter + preview · studio team · three-step enquiry · journal
   · legal index. Guarded: each block only runs when its markup is present.
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var money = window.shadeMoney;

  /* ── projects: status × country filters + one shared preview ─────────── */
  function initCatalogue() {
    var list = $('#catalogue');
    if (!list) return;
    var rows = $$('.crow', list);
    var statusBtns = $$('#statusFilters .filter');
    var countryBtns = $$('#countryFilters .filter');
    var count = $('#catalogueCount');
    var box = $('#cataloguePreview');
    var img = box && $('img', box);
    var status = 'all', country = 'all';
    var current = -1;

    function apply() {
      var shown = 0;
      rows.forEach(function (row) {
        var ok = (status === 'all' || row.dataset.status === status) &&
                 (country === 'all' || row.dataset.country === country);
        row.classList.toggle('is-off', !ok);
        if (ok) shown++;
      });
      if (count) count.textContent = 'Showing ' + shown + ' of ' + rows.length;
    }

    function wire(btns, key, set) {
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          btns.forEach(function (b) { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
          btn.classList.add('is-active');
          btn.setAttribute('aria-pressed', 'true');
          set(btn.dataset[key]);
          apply();
        });
      });
    }
    wire(statusBtns, 'status', function (v) { status = v; });
    wire(countryBtns, 'country', function (v) { country = v; });
    apply();

    if (box && img) {
      var xTo = null, yTo = null;
      if (window.gsap) {
        xTo = window.gsap.quickTo(box, 'x', { duration: 0.6, ease: 'power3.out' });
        yTo = window.gsap.quickTo(box, 'y', { duration: 0.6, ease: 'power3.out' });
      }
      rows.forEach(function (row, i) {
        var link = $('.crow__link', row);
        if (!link) return;
        function activate() {
          if (i === current) return;
          current = i;
          img.src = link.dataset.preview;
          if (window.gsap) {
            window.gsap.fromTo(img, { scale: 1.08 }, { scale: 1, duration: 0.6, ease: 'power2.out' });
            window.gsap.to(box, { opacity: 1, duration: 0.35 });
          } else {
            box.style.opacity = '1';
          }
        }
        function leave() {
          current = -1;
          if (window.gsap) window.gsap.to(box, { opacity: 0, duration: 0.3 });
          else box.style.opacity = '0';
        }
        link.addEventListener('mouseenter', activate);
        link.addEventListener('focus', activate);
        link.addEventListener('mouseleave', leave);
        link.addEventListener('blur', leave);
        link.addEventListener('mousemove', function (e) {
          var x = e.clientX + 28;
          var y = e.clientY - box.offsetHeight * 0.5;
          if (xTo) { xTo(x); yTo(y); }
          else box.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
        });
      });
    }
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
        ['Timeline', timeline || '—'],
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
        '<figure class="jcard__figure"><img src="' + p.img + '" alt="" loading="lazy" decoding="async"></figure>' +
        '<p class="jcard__meta"><b>' + p.cat + '</b><span>' + p.date + '</span><span>' + p.read + '</span></p>' +
        '<h3 class="jcard__title">' + p.title + '</h3>' +
        '<p class="jcard__excerpt">' + p.excerpt + '</p>' +
        '<span class="jcard__more">Read the essay →</span></a>';
    }).join('');

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
        $('#readerImg').src = post.img;
        $('#readerImg').alt = post.title;
        $('#readerBody').innerHTML = post.body.map(function (b) {
          if (typeof b === 'string') return '<p>' + b + '</p>';
          if (b.h) return '<h3>' + b.h + '</h3>';
          return '';
        }).join('');
        reader.hidden = false;
        document.title = post.title + ' — Shadestate Journal';
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
