/* ==========================================================================
   SHADESTATE · 3D presence map
   A stylised architectural relief of the Arabian Peninsula: extruded land,
   a dark sea plane, and one glowing pin per residence. Drag to orbit,
   scroll to zoom, select a pin for its card.
   Three.js is the copy already vendored for the walkthrough.
   ========================================================================== */
import * as THREE from '../walkthrough/vendor/three.module.js';

const stage = document.getElementById('presenceStage');
const canvas = document.getElementById('presenceCanvas');
const pinLayer = document.getElementById('mapPins');
const card = document.getElementById('mapCard');

if (stage && canvas && window.SHADE_PROJECTS) {
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PROJECTS = window.SHADE_PROJECTS;
  const ORDER = window.SHADE_ORDER || Object.keys(PROJECTS);

  /* ── projection: lon/lat → map units ───────────────────────────────── */
  const LON0 = 32, LAT0 = 12, SX = 0.093, SY = 0.100;
  const CX = ((58 - 32) * SX) / 2, CY = ((34 - 12) * SY) / 2;
  const proj = (lon, lat) => [(lon - LON0) * SX - CX, (lat - LAT0) * SY - CY];

  const COL = {
    completed: 0xF7F4EF,
    ongoing: 0xC9A55A,
    upcoming: 0xF7F4EF,
    sea: 0x080F12,
    landTop: 0xD9CBB0,
    landSide: 0x8E7C61
  };

  /* ── renderer / scene ──────────────────────────────────────────────── */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (err) {
    stage.classList.add('no-webgl');
    document.documentElement.classList.add('no-webgl');
  }

  if (renderer) {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0B1114);
    scene.fog = new THREE.Fog(0x0B1114, 4.6, 8.2);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 30);

    /* lights: a warm low sun from the west, a cool sky fill */
    const hemi = new THREE.HemisphereLight(0xBFD4D8, 0x2A2118, 0.95);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xFFE4BE, 2.1);
    sun.position.set(-3.2, 4.6, 2.8);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x8FB6C4, 0.7);
    rim.position.set(3.4, 2.4, -3.2);
    scene.add(rim);

    /* sea */
    const seaGeo = new THREE.PlaneGeometry(14, 12, 1, 1);
    const seaMat = new THREE.MeshStandardMaterial({ color: COL.sea, roughness: 0.42, metalness: 0.25 });
    const sea = new THREE.Mesh(seaGeo, seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -0.035;
    scene.add(sea);

    /* subtle graticule, like a survey drawing */
    const gridPts = [];
    for (let gx = -3.5; gx <= 3.5; gx += 0.5) {
      gridPts.push(new THREE.Vector3(gx, -0.028, -3), new THREE.Vector3(gx, -0.028, 3));
    }
    for (let gz = -3; gz <= 3; gz += 0.5) {
      gridPts.push(new THREE.Vector3(-3.5, -0.028, gz), new THREE.Vector3(3.5, -0.028, gz));
    }
    const gridGeo = new THREE.BufferGeometry().setFromPoints(gridPts);
    const grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: 0x2B3A3E, transparent: true, opacity: 0.5 }));
    scene.add(grid);

    /* ── land ────────────────────────────────────────────────────────── */
    const landGroup = new THREE.Group();
    scene.add(landGroup);

    const topMat = new THREE.MeshStandardMaterial({ color: COL.landTop, roughness: 0.94, metalness: 0.02 });
    const sideMat = new THREE.MeshStandardMaterial({ color: COL.landSide, roughness: 1, metalness: 0 });
    const borderMat = new THREE.LineBasicMaterial({ color: 0xF0E5D0, transparent: true, opacity: 0.18 });

    function addCountry(rings) {
      rings.forEach((ring) => {
        if (ring.length < 3) return;
        const shape = new THREE.Shape();
        ring.forEach((pt, i) => {
          const [x, y] = proj(pt[0], pt[1]);
          if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
        });
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.055, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 1, curveSegments: 1 });
        const mesh = new THREE.Mesh(geo, [topMat, sideMat]);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.055;
        landGroup.add(mesh);

        const pts = ring.map((pt) => {
          const [x, y] = proj(pt[0], pt[1]);
          return new THREE.Vector3(x, 0.116, -y);
        });
        pts.push(pts[0].clone());
        const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), borderMat);
        landGroup.add(line);
      });
    }

    fetch('map/land.json')
      .then((r) => r.json())
      .then((data) => { (data.countries || []).forEach((c) => addCountry(c.rings)); })
      .catch(() => {});

    /* ── pins ────────────────────────────────────────────────────────── */
    const pinMeshes = [];
    const pinData = ORDER.filter((s) => PROJECTS[s]).map((slug) => {
      const p = PROJECTS[slug];
      const [x, y] = proj(p.lon, p.lat);
      return { slug, p, x, y };
    });

    const OFFSETS = {
      'palm-crest-villas': [-152, -86],
      'sun-bliss-residence': [-152, -60],
      'arbour-townhomes': [-152, -34],
      'skyline-towers': [-152, -8],
      'luxurious-villas': [-152, 18],
      'diriyah-courtyard-villas': [-150, -76],
      'al-nakheel-house': [26, -48],
      'red-sea-horizon': [26, -18],
      'wadi-alula-residences': [-138, -20]
    };

    const NARROW = window.matchMedia('(max-width: 760px)').matches;
    const OFFSETS_M = {
      'palm-crest-villas': [-98, -66],
      'sun-bliss-residence': [-98, -46],
      'arbour-townhomes': [-98, -26],
      'skyline-towers': [-98, -6],
      'luxurious-villas': [-98, 14],
      'diriyah-courtyard-villas': [-92, -22],
      'al-nakheel-house': [12, -38],
      'red-sea-horizon': [12, -12],
      'wadi-alula-residences': [12, -22]
    };

    const ringGeo = new THREE.RingGeometry(0.030, 0.036, 40);
    const dotGeo = new THREE.SphereGeometry(0.017, 16, 12);
    const stemGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.07, 8);

    pinData.forEach(({ slug, p, x, y }) => {
      const g = new THREE.Group();
      g.position.set(x, 0.075, -y);
      const status = p.status;
      const color = status === 'Completed' ? COL.completed : status === 'Ongoing' ? COL.ongoing : COL.upcoming;

      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const dot = new THREE.Mesh(dotGeo, mat);
      dot.position.y = 0.075;
      g.add(dot);

      const stem = new THREE.Mesh(stemGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55 }));
      stem.position.y = 0.035;
      g.add(stem);

      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: status === 'Upcoming' ? 0.65 : 0.35, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.058;
      g.add(ring);

      g.userData = { slug, ring, ringMat, dot, mat, status };
      scene.add(g);
      pinMeshes.push(g);

      /* HTML annotation */
      const el = document.createElement('div');
      el.className = 'pin';
      el.dataset.slug = slug;
      el.dataset.status = status;
      const off = (NARROW && OFFSETS_M[slug]) || OFFSETS[slug] || [20, -34];
      el.style.setProperty('--dx', off[0] + 'px');
      el.style.setProperty('--dy', off[1] + 'px');
      el.innerHTML = '<span class="pin__leader"></span><span class="pin__dot" aria-hidden="true"></span>' +
        '<button class="pin__label" type="button" aria-label="' + p.name + ', ' + p.location + '">' + p.short + '</button>';
      pinLayer.appendChild(el);
      el.querySelector('.pin__label').addEventListener('click', () => select(slug, true));
      el.querySelector('.pin__label').addEventListener('mouseenter', () => { auto = false; select(slug, false); });
      el.querySelector('.pin__label').addEventListener('focus', () => select(slug, false));
    });

    /* ── camera rig ──────────────────────────────────────────────────── */
    const R0 = NARROW ? 5.55 : 4.05;
    const rig = {
      theta: 0.55,
      phi: 0.60,
      radius: R0,
      target: new THREE.Vector3(0.30, 0.02, 0.06),
      tTheta: 0.55,
      tPhi: 0.60,
      tRadius: R0,
      tTarget: new THREE.Vector3(0.30, 0.02, 0.06)
    };

    function placeCamera() {
      const r = rig.radius;
      const sp = Math.sin(rig.phi), cp = Math.cos(rig.phi);
      camera.position.set(
        rig.target.x + r * sp * Math.sin(rig.theta),
        rig.target.y + r * cp,
        rig.target.z + r * sp * Math.cos(rig.theta)
      );
      camera.lookAt(rig.target);
    }

    let selected = null;
    let hovered = null;

    function select(slug, focus) {
      const entry = pinData.find((q) => q.slug === slug);
      if (!entry) return;
      selected = slug;
      const p = entry.p;
      if (card) {
        const img = document.getElementById('mapCardImg');
        const name = document.getElementById('mapCardName');
        const status = document.getElementById('mapCardStatus');
        const city = document.getElementById('mapCardCity');
        const loc = document.getElementById('mapCardLoc');
        const price = document.getElementById('mapCardPrice');
        const link = document.getElementById('mapCardLink');
        if (img) { img.src = p.hero; img.alt = p.heroAlt || p.name; }
        if (name) name.textContent = p.name;
        if (status) status.textContent = p.status;
        if (city) city.textContent = p.city;
        if (loc) loc.textContent = p.location;
        if (price) price.textContent = window.shadeMoney(p, p.currency);
        if (link) { link.href = 'project.html?project=' + slug; link.setAttribute('aria-label', 'View ' + p.name); }
        card.classList.add('is-visible');
      }
      pinLayer.querySelectorAll('.pin').forEach((el) => el.classList.toggle('is-active', el.dataset.slug === slug));
      if (focus) {
        rig.tTarget.set(entry.x, 0.08, -entry.y);
        rig.tRadius = 2.15;
        rig.tPhi = 0.62;
        auto = false;
      }
    }

    function clearSelection() {
      selected = null;
      if (card) card.classList.remove('is-visible');
      pinLayer.querySelectorAll('.pin').forEach((el) => el.classList.remove('is-active'));
      rig.tTarget.set(0.30, 0.02, 0.06);
      rig.tRadius = R0;
      rig.tPhi = 0.60;
    }

    if (card) {
      const close = document.getElementById('mapCardClose');
      if (close) close.addEventListener('click', clearSelection);
    }

    /* ── pointer interaction ─────────────────────────────────────────── */
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let dragging = false, moved = false, lastX = 0, lastY = 0;
    let auto = !REDUCED && !NARROW;

    canvas.addEventListener('pointerdown', (e) => {
      dragging = true; moved = false; lastX = e.clientX; lastY = e.clientY;
      auto = false;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (dragging) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        rig.tTheta -= dx * 0.0055;
        rig.tPhi = Math.min(1.32, Math.max(0.24, rig.tPhi - dy * 0.004));
        lastX = e.clientX; lastY = e.clientY;
      }
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pinMeshes, true)[0];
      const slug = hit ? hit.object.parent.userData.slug : null;
      if (slug !== hovered) {
        hovered = slug;
        canvas.style.cursor = slug ? 'pointer' : 'grab';
        if (slug) select(slug, false);
      }
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      if (canvas.releasePointerCapture && e.pointerId != null) { try { canvas.releasePointerCapture(e.pointerId); } catch (err) {} }
      if (!moved && hovered) select(hovered, true);
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('pointerleave', () => { dragging = false; });
    canvas.addEventListener('pointerenter', () => { auto = false; });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      rig.tRadius = Math.min(7.2, Math.max(1.7, rig.tRadius + e.deltaY * 0.0018));
    }, { passive: false });

    /* keyboard: the labels are real buttons, so tab + enter works */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && selected) clearSelection();
    });

    /* ── sizing, visibility, loop ────────────────────────────────────── */
    function resize() {
      const w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);
    resize();

    let visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((en) => { visible = en.isIntersecting; });
      }, { rootMargin: '120px' }).observe(stage);
    }

    const tmp = new THREE.Vector3();
    let t0 = performance.now();

    function projectPoint(x, y, z) {
      tmp.set(x, y, z).project(camera);
      return {
        x: (tmp.x * 0.5 + 0.5) * stage.clientWidth,
        y: (-tmp.y * 0.5 + 0.5) * stage.clientHeight,
        z: tmp.z
      };
    }

    function syncLabels() {
      pinLayer.querySelectorAll('.pin').forEach((el) => {
        const entry = pinData.find((q) => q.slug === el.dataset.slug);
        if (!entry) return;
        const pt = projectPoint(entry.x, 0.12, -entry.y);
        if (pt.z > 1) { el.style.display = 'none'; return; }
        el.style.display = '';
        el.style.transform = 'translate3d(' + pt.x.toFixed(1) + 'px,' + pt.y.toFixed(1) + 'px,0)';
        const dot = el.querySelector('.pin__dot');
        const leader = el.querySelector('.pin__leader');
        const label = el.querySelector('.pin__label');
        if (dot) { dot.style.left = '-5px'; dot.style.top = '-5px'; }
        let dx = parseFloat(el.style.getPropertyValue('--dx')) || 20;
        let dy = parseFloat(el.style.getPropertyValue('--dy')) || -34;
        if (label) {
          const w = label.offsetWidth, h = label.offsetHeight;
          const pad = 10, topPad = NARROW ? 34 : 10;
          const lx = Math.min(stage.clientWidth - w - pad, Math.max(pad, pt.x + dx));
          const ly = Math.min(stage.clientHeight - h - pad, Math.max(topPad, pt.y + dy));
          dx = lx - pt.x; dy = ly - pt.y;
          label.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
        }
        if (leader) {
          const len = Math.hypot(dx, dy);
          const ang = Math.atan2(dy, dx) * 180 / Math.PI;
          leader.style.width = len.toFixed(1) + 'px';
          leader.style.transform = 'rotate(' + ang.toFixed(2) + 'deg)';
        }
      });
    }

    let paused = false;
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || paused) return;
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;

      if (auto && !selected) rig.tTheta += dt * 0.035;
      rig.theta += (rig.tTheta - rig.theta) * Math.min(1, dt * 7);
      rig.phi += (rig.tPhi - rig.phi) * Math.min(1, dt * 7);
      rig.radius += (rig.tRadius - rig.radius) * Math.min(1, dt * 6);
      rig.target.lerp(rig.tTarget, Math.min(1, dt * 5));
      placeCamera();

      const t = now * 0.001;
      pinMeshes.forEach((g, i) => {
        const on = !selected || g.userData.slug === selected;
        const pulse = REDUCED ? 0.4 : 0.34 + Math.sin(t * 1.6 + i * 0.9) * 0.12;
        g.userData.ringMat.opacity = on ? pulse : 0.10;
        const s = REDUCED ? 1 : 1 + Math.sin(t * 1.6 + i * 0.9) * 0.10;
        g.userData.ring.scale.setScalar(s);
        g.userData.mat.opacity = on ? 1 : 0.35;
      });

      syncLabels();
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);

    /* expose for the screenshot harness */
    window.__presence = { camera, scene, renderer, rig, select, clearSelection, build: 'shadestate-map/1.0',
      pause() { paused = true; }, resume() { paused = false; } };
  }
}
