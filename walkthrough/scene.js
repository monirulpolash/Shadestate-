/* ═══════════════════════════════════════════════════════════════════════════
   SHADESTATE — CASA DA LUZ
   A scroll-driven, fully procedural 3D walkthrough.

   Nothing here loads a model, a texture or an HDRI. Every surface is drawn into
   a canvas at runtime, every form is a primitive, and one procedural equirect
   sky is both the background and the PMREM environment, so reflections, glass
   and the horizon always agree.

   Craft notes
   · all static geometry is baked and merged per material → ~25 draw calls
   · the sun never moves, so the shadow map is rendered once and frozen
   · limestone/oak get GPU noise weathering in onBeforeCompile (large-scale
     grime and rain streaks that a tiled bitmap cannot produce)
   · water is a transmissive physical material with animated normals (desktop)
   · dust motes are one additive Points pass with a custom shader
   · foliage, slats, pebbles are InstancedMesh
   · DPR, shadow size, particle counts and the leaf budget are tiered by device
   ═══════════════════════════════════════════════════════════════════════════ */

import * as THREE from './vendor/three.module.js';

const BUILD = 'shadestate-3d/1.0';

/* ─────────────────────────────────────────────────────────────────────────────
   0 · environment
   ───────────────────────────────────────────────────────────────────────────── */
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NARROW = window.matchMedia('(max-width: 820px)').matches;
const MOBILE = NARROW || (navigator.maxTouchPoints > 1 && window.innerWidth < 1100);

const section = document.getElementById('walk');
const canvas = document.getElementById('scene');

function fail(err) {
  console.error(err);
  // host integration: the scene is embedded, so the class goes on the section
  // (the template keeps its own page chrome and must not be touched)
  document.documentElement.classList.add('no-webgl');
  if (section) section.classList.add('no-webgl');
}

/* ─────────────────────────────────────────────────────────────────────────────
   1 · utilities
   ───────────────────────────────────────────────────────────────────────────── */
let _seed = 0x2f6e2b1 ^ 0x9e3779b9;
const rnd = () => { _seed = (_seed * 1664525 + 1013904223) >>> 0; return _seed / 4294967296; };
const rr = (a, b) => a + (b - a) * rnd();
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

function tex(canvasEl, { repeat = [1, 1], srgb = false } = {}) {
  const t = new THREE.CanvasTexture(canvasEl);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** Tangent-space normal map from a greyscale height canvas. */
function normalFromHeight(src, strength = 2.0) {
  const w = src.width, h = src.height;
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const out = cv(w, h);
  const octx = out.getContext('2d');
  const od = octx.createImageData(w, h);
  const H = (x, y) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      od.data[i] = (nx * 0.5 + 0.5) * 255;
      od.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      od.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      od.data[i + 3] = 255;
    }
  }
  octx.putImageData(od, 0, 0);
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────────
   2 · procedural textures
   ───────────────────────────────────────────────────────────────────────────── */
function makeStone(base = '#e7dfd0', poreRGB = '124,110,90') {
  const S = 1024;
  const c = cv(S), g = c.getContext('2d');
  const hc = cv(S), hg = hc.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S);

  for (let i = 0; i < 46; i++) {
    const x = rnd() * S, y = rnd() * S, r = rr(60, 220);
    const warm = rnd() > 0.45;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, warm ? 'rgba(205,191,167,.12)' : 'rgba(255,252,244,.14)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    const hgd = hg.createRadialGradient(x, y, 0, x, y, r);
    hgd.addColorStop(0, warm ? 'rgba(110,110,110,.5)' : 'rgba(150,150,150,.4)');
    hgd.addColorStop(1, 'rgba(128,128,128,0)');
    hg.fillStyle = hgd; hg.beginPath(); hg.arc(x, y, r, 0, 7); hg.fill();
  }
  for (let i = 0; i < 260; i++) {
    const y = rnd() * S, h = rr(1, 7), dark = rnd() > 0.42;
    g.fillStyle = dark ? `rgba(178,163,138,${rr(0.03, 0.11).toFixed(3)})` : `rgba(255,251,242,${rr(0.04, 0.13).toFixed(3)})`;
    g.fillRect(0, y, S, h);
    hg.fillStyle = dark ? `rgba(96,96,96,${rr(0.05, 0.16).toFixed(3)})` : `rgba(160,160,160,${rr(0.04, 0.12).toFixed(3)})`;
    hg.fillRect(0, y, S, h);
  }
  for (let i = 0; i < 5200; i++) {
    const x = rnd() * S, y = rnd() * S, w = rr(0.8, 3.4), h = rr(0.6, 2.2), a = rr(0.05, 0.22);
    g.fillStyle = `rgba(${poreRGB},${a.toFixed(3)})`;
    g.beginPath(); g.ellipse(x, y, w, h, rnd() * 3, 0, 7); g.fill();
    hg.fillStyle = `rgba(60,60,60,${(a * 2.2).toFixed(3)})`;
    hg.beginPath(); hg.ellipse(x, y, w, h, 0, 0, 7); hg.fill();
  }
  for (let i = 0; i < 24000; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,250,.05)' : 'rgba(150,136,116,.045)';
    g.fillRect(rnd() * S, rnd() * S, 1.4, 1.4);
  }
  const rc = cv(256), rg = rc.getContext('2d');
  rg.fillStyle = '#b4b4b4'; rg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 220; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = rr(6, 40), v = rnd() > 0.5 ? 210 : 160;
    const grd = rg.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${v},${v},${v},.5)`);
    grd.addColorStop(1, 'rgba(180,180,180,0)');
    rg.fillStyle = grd; rg.beginPath(); rg.arc(x, y, r, 0, 7); rg.fill();
  }
  return { map: c, normal: normalFromHeight(hc, 1.45), rough: rc };
}

function makeOakFloor() {
  const S = 1024, c = cv(S), g = c.getContext('2d');
  const hc = cv(S), hg = hc.getContext('2d');
  g.fillStyle = '#6f4a2c'; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S);
  const rows = 9, ph = S / rows;
  for (let r = 0; r < rows; r++) {
    const y0 = r * ph;
    let x = -rr(0, 400);
    while (x < S) {
      const len = rr(260, 620), tone = rr(0.78, 1.16);
      const R = Math.round(150 * tone), G = Math.round(102 * tone), B = Math.round(64 * tone);
      g.fillStyle = `rgb(${R},${G},${B})`;
      g.fillRect(x, y0, len, ph);
      for (let i = 0; i < 42; i++) {
        const gy = y0 + rr(2, ph - 2);
        g.strokeStyle = `rgba(${Math.round(R * 0.62)},${Math.round(G * 0.6)},${Math.round(B * 0.6)},${rr(0.05, 0.2).toFixed(3)})`;
        g.lineWidth = rr(0.5, 1.8);
        g.beginPath(); g.moveTo(x, gy);
        for (let k = 1; k <= 6; k++) g.lineTo(x + (len * k) / 6, gy + Math.sin(k * 0.9 + i) * rr(0.6, 2.6));
        g.stroke();
      }
      if (rnd() > 0.78) {
        const kx = x + rr(40, len - 40), ky = y0 + rr(ph * 0.3, ph * 0.7);
        for (let k = 0; k < 4; k++) {
          g.strokeStyle = `rgba(${Math.round(R * 0.5)},${Math.round(G * 0.48)},${Math.round(B * 0.5)},.22)`;
          g.lineWidth = 1;
          g.beginPath(); g.ellipse(kx, ky, 4 + k * 3.2, 2 + k * 1.9, 0, 0, 7); g.stroke();
        }
      }
      g.fillStyle = 'rgba(44,28,16,.55)'; g.fillRect(x + len - 1.5, y0, 1.6, ph);
      hg.fillStyle = 'rgba(40,40,40,.85)'; hg.fillRect(x + len - 1.5, y0, 1.6, ph);
      x += len;
    }
    g.fillStyle = 'rgba(44,28,16,.5)'; g.fillRect(0, y0 - 0.8, S, 1.6);
    hg.fillStyle = 'rgba(40,40,40,.8)'; hg.fillRect(0, y0 - 0.8, S, 1.6);
  }
  for (let i = 0; i < 60; i++) {
    const x = rnd() * S, y = rnd() * S, r = rr(60, 260);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,235,205,.10)');
    grd.addColorStop(1, 'rgba(255,235,205,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  return { map: c, normal: normalFromHeight(hc, 0.9) };
}

function makeConcrete() {
  const S = 512, c = cv(S), g = c.getContext('2d');
  const hc = cv(S), hg = hc.getContext('2d');
  g.fillStyle = '#b9b3a6'; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#8a8a8a'; hg.fillRect(0, 0, S, S);
  for (let i = 0; i < 26000; i++) {
    const v = rnd();
    g.fillStyle = v > 0.5 ? `rgba(255,255,250,${rr(0.02, 0.08).toFixed(3)})` : `rgba(96,90,80,${rr(0.02, 0.09).toFixed(3)})`;
    g.fillRect(rnd() * S, rnd() * S, rr(1, 2.4), rr(1, 2.4));
  }
  for (let i = 0; i < 40; i++) {
    const x = rnd() * S, y = rnd() * S, r = rr(20, 110);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(140,132,118,${rr(0.05, 0.14).toFixed(3)})`);
    grd.addColorStop(1, 'rgba(140,132,118,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  for (let i = 0; i < 4; i++) {
    const y = (i + 0.5) * (S / 4);
    g.fillStyle = 'rgba(120,113,101,.16)'; g.fillRect(0, y, S, 2);
    hg.fillStyle = 'rgba(90,90,90,.4)'; hg.fillRect(0, y, S, 2);
  }
  return { map: c, normal: normalFromHeight(hc, 0.7) };
}

function makeGravel() {
  const S = 768, c = cv(S), g = c.getContext('2d');
  const hc = cv(S), hg = hc.getContext('2d');
  g.fillStyle = '#918776'; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#7a7a7a'; hg.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * S, y = rnd() * S, rw = rr(1.4, 5.6), rh = rw * rr(0.55, 1), t = rnd();
    const col = t > 0.72 ? [214, 204, 186] : t > 0.42 ? [176, 165, 145] : t > 0.2 ? [140, 130, 112] : [110, 100, 86];
    g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${rr(0.5, 1).toFixed(2)})`;
    g.beginPath(); g.ellipse(x, y, rw, rh, rnd() * 3.14, 0, 7); g.fill();
    hg.fillStyle = `rgba(${150 + Math.round(rnd() * 80)},150,150,.9)`;
    hg.beginPath(); hg.ellipse(x, y, rw, rh, 0, 0, 7); hg.fill();
  }
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(196,186,168,${rr(0.04, 0.12).toFixed(3)})`;
    g.beginPath(); g.arc(rnd() * S, rnd() * S, rr(2, 12), 0, 7); g.fill();
  }
  return { map: c, normal: normalFromHeight(hc, 1.1) };
}

function makeMeadow() {
  const hc = cv(512), hg = hc.getContext('2d');
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, 512, 512);
  const S = 1024, c = cv(S), g = c.getContext('2d');
  g.fillStyle = '#7d8455'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 1200; i++) {
    const x = rnd() * S, y = rnd() * S, r = rr(20, 130), t = rnd();
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, t > 0.6 ? 'rgba(160,168,112,.22)' : t > 0.3 ? 'rgba(122,132,88,.18)' : 'rgba(186,180,140,.20)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  for (let i = 0; i < 22000; i++) {
    const x = rnd() * S, y = rnd() * S, t = rnd();
    g.strokeStyle = t > 0.55
      ? `rgba(${Math.round(rr(104, 140))},${Math.round(rr(116, 144))},${Math.round(rr(68, 92))},${rr(0.10, 0.34).toFixed(2)})`
      : `rgba(${Math.round(rr(158, 200))},${Math.round(rr(150, 184))},${Math.round(rr(110, 140))},${rr(0.10, 0.32).toFixed(2)})`;
    g.lineWidth = rr(0.6, 1.6);
    const a = rr(-0.5, 0.5), l = rr(2, 7);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y - Math.cos(a) * l); g.stroke();
  }
  for (let i = 0; i < 5200; i++) {
    const x = rnd() * 512, y = rnd() * 512;
    hg.fillStyle = rnd() > 0.5 ? 'rgba(190,190,190,.5)' : 'rgba(70,70,70,.4)';
    hg.beginPath(); hg.ellipse(x, y, rr(1, 5), rr(0.6, 2.4), rnd() * 3, 0, 7); hg.fill();
  }
  return { map: c, normal: normalFromHeight(hc, 1.0) };
}

function makeLeafCluster() {
  const S = 512, c = cv(S), g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  const cx = S / 2, cy = S / 2;
  for (let i = 0; i < 760; i++) {
    const a = rnd() * Math.PI * 2;
    const rad = Math.pow(rnd(), 0.58) * S * 0.47;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad * 0.94;
    const len = rr(8, 24), wid = rr(1.8, 4.2), tone = rr(0.72, 1.28);
    const R = Math.round(112 * tone), G = Math.round(124 * tone), B = Math.round(84 * tone);
    g.save(); g.translate(x, y); g.rotate(a + rr(-1.1, 1.1));
    const grd = g.createLinearGradient(-len / 2, 0, len / 2, 0);
    grd.addColorStop(0, `rgba(${R},${G},${B},1)`);
    grd.addColorStop(0.55, `rgba(${Math.min(255, R + 26)},${Math.min(255, G + 26)},${Math.min(255, B + 16)},1)`);
    grd.addColorStop(1, `rgba(${Math.round(R * 0.78)},${Math.round(G * 0.8)},${Math.round(B * 0.78)},1)`);
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(0, 0, len / 2, wid, 0, 0, 7); g.fill();
    g.restore();
  }
  return c;
}

function makeBark() {
  const S = 256, c = cv(S), g = c.getContext('2d');
  g.fillStyle = '#6d6455'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * S;
    g.strokeStyle = rnd() > 0.5 ? `rgba(58,52,44,${rr(0.1, 0.4).toFixed(2)})` : `rgba(150,140,120,${rr(0.08, 0.3).toFixed(2)})`;
    g.lineWidth = rr(1, 5);
    g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y < S; y += 22) g.lineTo(x + Math.sin(y * 0.05 + i) * 4, y);
    g.stroke();
  }
  return c;
}

function makeWaterNormal(S = 512) {
  const c = cv(S), g = c.getContext('2d');
  const img = g.createImageData(S, S);
  const wave = (x, y) =>
    Math.sin((x * 3 + Math.sin(y * 2.2) * 0.35) * Math.PI * 2) * 0.55 +
    Math.sin((y * 5.1 - x * 1.3) * Math.PI * 2) * 0.28 +
    Math.sin((x * 11 + y * 7) * Math.PI * 2) * 0.1 +
    Math.sin((y * 17 - x * 9) * Math.PI * 2) * 0.05;
  const e = 1 / S;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const dx = (wave(u + e, v) - wave(u - e, v)) / (2 * e) * 0.0025;
      const dy = (wave(u, v + e) - wave(u, v - e)) / (2 * e) * 0.0025;
      let nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * S + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function makeLinen(tint = [226, 218, 203]) {
  const S = 512, c = cv(S), g = c.getContext('2d');
  g.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 14000; i++) {
    const x = rnd() * S, y = rnd() * S;
    g.strokeStyle = rnd() > 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(90,80,66,.06)';
    g.lineWidth = 1;
    g.beginPath();
    if (rnd() > 0.5) { g.moveTo(x, y); g.lineTo(x + rr(3, 12), y); }
    else { g.moveTo(x, y); g.lineTo(x, y + rr(3, 12)); }
    g.stroke();
  }
  return c;
}

/** Soft radial veil, used for lens glare at the big openings. */
function makeGlowTexture() {
  const S = 256, c = cv(S), g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,238,210,1)');
  grd.addColorStop(0.35, 'rgba(255,228,190,.55)');
  grd.addColorStop(0.7, 'rgba(255,220,180,.14)');
  grd.addColorStop(1, 'rgba(255,215,175,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return c;
}

/* ─────────────────────────────────────────────────────────────────────────────
   3 · renderer
   ───────────────────────────────────────────────────────────────────────────── */
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({
    canvas, antialias: !MOBILE, powerPreference: 'high-performance', alpha: false, stencil: false,
    // only for screenshot tooling: lets the harness read the drawing buffer back
    preserveDrawingBuffer: /[?&]capture=1/.test(location.search)
  });
} catch (err) { fail(err); }

if (renderer) {
  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MOBILE ? 1.5 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.info.autoReset = false;
    renderer.autoClear = true;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xe2dac9, 0.0032);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 900);

    /* ── sky + environment ─────────────────────────────────────────────── */
    const SUN_DIR = new THREE.Vector3(-0.86, 0.30, 0.41).normalize();

    function makeSky() {
      const W = 2048, H = 1024;
      const c = cv(W, H), g = c.getContext('2d');

      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0.00, '#3d5c82');
      grad.addColorStop(0.18, '#5c7b9c');
      grad.addColorStop(0.30, '#8ea2b4');
      grad.addColorStop(0.375, '#c2c2b7');
      grad.addColorStop(0.435, '#e9d8c0');
      grad.addColorStop(0.480, '#f7e6c9');
      grad.addColorStop(0.500, '#fbeed6');
      grad.addColorStop(0.520, '#e0c9a5');
      grad.addColorStop(0.620, '#9d9078');
      grad.addColorStop(1.000, '#4b4538');
      g.fillStyle = grad; g.fillRect(0, 0, W, H);

      const u = Math.atan2(SUN_DIR.z, SUN_DIR.x) / (Math.PI * 2) + 0.5;
      const v = 1 - (Math.asin(SUN_DIR.y) / Math.PI + 0.5);
      const sx = u * W, sy = v * H;

      const glow = g.createRadialGradient(sx, sy, 0, sx, sy, W * 0.30);
      glow.addColorStop(0.00, 'rgba(255,240,208,.95)');
      glow.addColorStop(0.09, 'rgba(255,224,175,.52)');
      glow.addColorStop(0.32, 'rgba(255,208,152,.17)');
      glow.addColorStop(1.00, 'rgba(255,200,150,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);

      const disc = g.createRadialGradient(sx, sy, 0, sx, sy, 44);
      disc.addColorStop(0.00, 'rgba(255,255,250,1)');
      disc.addColorStop(0.18, 'rgba(255,248,228,.98)');
      disc.addColorStop(0.36, 'rgba(255,228,182,.5)');
      disc.addColorStop(1.00, 'rgba(255,218,170,0)');
      g.fillStyle = disc; g.beginPath(); g.arc(sx, sy, 44, 0, 7); g.fill();

      for (let i = 0; i < 170; i++) {
        const cy = H * rr(0.28, 0.50);
        const cw = rr(70, 460), ch = rr(1.2, 8);
        const cx = rnd() * W;
        const near = 1 - Math.min(1, Math.abs(cx - sx) / (W * 0.55));
        const a = rr(0.02, 0.09) * (0.3 + near * 0.9);
        const grd = g.createLinearGradient(cx - cw / 2, cy, cx + cw / 2, cy);
        grd.addColorStop(0, 'rgba(255,245,228,0)');
        grd.addColorStop(0.5, `rgba(${near > 0.4 ? '255,240,216' : '250,248,242'},${a.toFixed(3)})`);
        grd.addColorStop(1, 'rgba(255,245,228,0)');
        g.fillStyle = grd;
        g.beginPath(); g.ellipse(cx, cy, cw / 2, ch, rr(-0.04, 0.04), 0, 7); g.fill();
      }

      const haze = g.createLinearGradient(0, H * 0.43, 0, H * 0.57);
      haze.addColorStop(0, 'rgba(255,238,212,0)');
      haze.addColorStop(0.5, 'rgba(255,236,206,.30)');
      haze.addColorStop(1, 'rgba(240,220,190,0)');
      g.fillStyle = haze; g.fillRect(0, H * 0.43, W, H * 0.14);

      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.mapping = THREE.EquirectangularReflectionMapping;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      return t;
    }

    const skyTexture = makeSky();
    scene.background = skyTexture;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    scene.environment = pmrem.fromEquirectangular(skyTexture).texture;

    /* ── sun ───────────────────────────────────────────────────────────── */
    const sun = new THREE.DirectionalLight(0xffd2a0, 4.6);
    sun.position.copy(SUN_DIR).multiplyScalar(120);
    sun.target.position.set(-1, 0, -1);
    sun.castShadow = true;
    const SM = MOBILE ? 1024 : 2048;
    sun.shadow.mapSize.set(SM, SM);
    sun.shadow.camera.left = -33;
    sun.shadow.camera.right = 33;
    sun.shadow.camera.top = 33;
    sun.shadow.camera.bottom = -33;
    sun.shadow.camera.near = 40;
    sun.shadow.camera.far = 220;
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.03;
    scene.add(sun, sun.target);

    scene.add(new THREE.HemisphereLight(0xa8c2dc, 0x6f5f48, MOBILE ? 0.1 : 0.13));

    /* ── weathering shader injection ───────────────────────────────────────
       Adds large-scale grime and vertical rain streaks in world space, plus a
       darker base where the wall meets the ground. Costs a few ALU ops.      */
    const WEATHER_GLSL = /* glsl */`
      float wHash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
      float wNoise(vec3 p){
        vec3 i=floor(p), f=fract(p);
        f=f*f*(3.0-2.0*f);
        float a=wHash(i), b=wHash(i+vec3(1.,0.,0.)), c=wHash(i+vec3(0.,1.,0.)), d=wHash(i+vec3(1.,1.,0.));
        float e=wHash(i+vec3(0.,0.,1.)), g2=wHash(i+vec3(1.,0.,1.)), h2=wHash(i+vec3(0.,1.,1.)), i2=wHash(i+vec3(1.,1.,1.));
        return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y), mix(mix(e,g2,f.x),mix(h2,i2,f.x),f.y), f.z);
      }
    `;

    function weather(mat, { grime = 0.20, streak = 0.22, base = 0.26, scale = 0.32 } = {}) {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uGrime = { value: grime };
        shader.uniforms.uStreak = { value: streak };
        shader.uniforms.uBase = { value: base };
        shader.uniforms.uScale = { value: scale };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n vWPos = (modelMatrix * vec4(transformed,1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\nvarying vec3 vWPos;\nuniform float uGrime; uniform float uStreak; uniform float uBase; uniform float uScale;\n${WEATHER_GLSL}`)
          .replace('#include <map_fragment>', `
            #include <map_fragment>
            float w1 = wNoise(vWPos * uScale);
            float w2 = wNoise(vWPos * uScale * 4.7 + 11.0);
            float w3 = wNoise(vec3(vWPos.x * 3.2, vWPos.y * 0.55, vWPos.z * 3.2));
            float grime = clamp(w1 * 0.62 + w2 * 0.38, 0.0, 1.0);
            diffuseColor.rgb *= mix(1.0 - uGrime, 1.0 + uGrime * 0.35, grime);
            diffuseColor.rgb *= mix(vec3(1.0), vec3(0.955, 0.96, 0.925), w3 * uStreak);
            float baseMask = 1.0 - smoothstep(0.0, 2.2, vWPos.y);
            diffuseColor.rgb *= mix(1.0, 0.74, baseMask * uBase);
          `);
      };
      mat.customProgramCacheKey = () => 'weather';
      return mat;
    }

    /* ── materials ─────────────────────────────────────────────────────── */
    const stoneA = makeStone('#e8e0d1');
    const stoneB = makeStone('#ded4c1', '118,104,86');
    const oak = makeOakFloor();
    const conc = makeConcrete();
    const grav = makeGravel();
    const mead = makeMeadow();
    const bark = makeBark();
    const linenA = makeLinen([228, 220, 205]);
    const linenB = makeLinen([118, 110, 98]);

    const M = {
      stone: weather(new THREE.MeshStandardMaterial({
        map: tex(stoneA.map, { srgb: true }),
        normalMap: tex(stoneA.normal),
        roughnessMap: tex(stoneA.rough),
        roughness: 0.94, metalness: 0.0,
        normalScale: new THREE.Vector2(0.6, 0.6),
        envMapIntensity: 0.14
      }), { grime: 0.10, streak: 0.17, base: 0.20, scale: 0.30 }),
      stonePale: weather(new THREE.MeshStandardMaterial({
        map: tex(stoneB.map, { srgb: true }),
        normalMap: tex(stoneB.normal),
        roughness: 0.9, metalness: 0.0,
        normalScale: new THREE.Vector2(0.45, 0.45),
        envMapIntensity: 0.5
      }), { grime: 0.07, streak: 0.12, base: 0.15, scale: 0.34 }),
      concrete: weather(new THREE.MeshStandardMaterial({
        map: tex(conc.map, { srgb: true }),
        normalMap: tex(conc.normal),
        roughness: 0.86, metalness: 0.0,
        envMapIntensity: 0.8
      }), { grime: 0.2, streak: 0.3, base: 0.3, scale: 0.5 }),
      oakFloor: new THREE.MeshStandardMaterial({
        map: tex(oak.map, { srgb: true }),
        normalMap: tex(oak.normal),
        roughness: 0.5, metalness: 0.0,
        normalScale: new THREE.Vector2(0.35, 0.35),
        envMapIntensity: 0.7
      }),
      oak: new THREE.MeshStandardMaterial({ color: 0x9c6b3f, roughness: 0.58, metalness: 0.0, envMapIntensity: 0.7 }),
      oakDark: new THREE.MeshStandardMaterial({ color: 0x7d5330, roughness: 0.66, metalness: 0.0, envMapIntensity: 0.6 }),
      bronze: new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.33, metalness: 0.92, envMapIntensity: 1.5 }),
      plaster: new THREE.MeshStandardMaterial({ color: 0xf1eade, roughness: 0.96, metalness: 0.0, envMapIntensity: 0.2 }),
      glass: new THREE.MeshPhysicalMaterial({
        color: 0xd8e4e0, metalness: 0.0, roughness: 0.03,
        transparent: true, opacity: 0.16,
        envMapIntensity: 2.6, side: THREE.DoubleSide, depthWrite: false
      }),
      gravel: new THREE.MeshStandardMaterial({
        map: tex(grav.map, { srgb: true }),
        normalMap: tex(grav.normal),
        roughness: 1.0, metalness: 0.0,
        normalScale: new THREE.Vector2(1.1, 1.1),
        envMapIntensity: 0.55
      }),
      meadow: new THREE.MeshStandardMaterial({
        color: 0x92985f,
        map: tex(mead.map, { srgb: true }),
        normalMap: tex(mead.normal),
        roughness: 1.0, metalness: 0.0, envMapIntensity: 0.4,
        normalScale: new THREE.Vector2(0.85, 0.85)
      }),
      bark: new THREE.MeshStandardMaterial({
        map: tex(bark, { srgb: true, repeat: [1, 3] }),
        roughness: 0.94, metalness: 0.0, envMapIntensity: 0.5
      }),
      linenA: new THREE.MeshStandardMaterial({ map: tex(linenA, { srgb: true }), roughness: 0.95, metalness: 0.0, envMapIntensity: 0.45 }),
      linenB: new THREE.MeshStandardMaterial({ map: tex(linenB, { srgb: true }), roughness: 0.95, metalness: 0.0, envMapIntensity: 0.4 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x24211d, roughness: 0.7, metalness: 0.1, envMapIntensity: 0.5 }),
      poolWall: new THREE.MeshStandardMaterial({ color: 0x86988e, roughness: 0.62, metalness: 0.0, envMapIntensity: 0.45 }),
      leaf: new THREE.MeshStandardMaterial({
        map: tex(makeLeafCluster(), { srgb: true }),
        alphaTest: 0.42, side: THREE.DoubleSide, color: 0xd7dcc4,
        roughness: 0.9, metalness: 0.0, envMapIntensity: 0.5
      }),
      glow: new THREE.MeshBasicMaterial({
        map: tex(makeGlowTexture(), { srgb: true }),
        transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide
      })
    };

    /* ─────────────────────────────────────────────────────────────────────
       4 · geometry batching
       ───────────────────────────────────────────────────────────────────── */
    const world = new THREE.Group();
    scene.add(world);

    const BUCKETS = new Map();
    function queue(geo, mat, cast, receive, order = 0) {
      const key = `${mat.uuid}|${cast ? 1 : 0}${receive ? 1 : 0}|${order}`;
      let b = BUCKETS.get(key);
      if (!b) { b = { mat, cast, receive, order, geos: [] }; BUCKETS.set(key, b); }
      b.geos.push(geo);
    }

    function mergeGeos(geos) {
      let vCount = 0, iCount = 0;
      for (const g of geos) {
        vCount += g.attributes.position.count;
        iCount += g.index ? g.index.count : g.attributes.position.count;
      }
      const pos = new Float32Array(vCount * 3);
      const nor = new Float32Array(vCount * 3);
      const uv = new Float32Array(vCount * 2);
      const idx = new Uint32Array(iCount);
      let vo = 0, io = 0;
      for (const g of geos) {
        const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
        pos.set(p.array.subarray(0, p.count * 3), vo * 3);
        if (n) nor.set(n.array.subarray(0, n.count * 3), vo * 3);
        if (u) uv.set(u.array.subarray(0, u.count * 2), vo * 2);
        if (g.index) {
          for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
          io += g.index.count;
        } else {
          for (let i = 0; i < p.count; i++) idx[io + i] = i + vo;
          io += p.count;
        }
        vo += p.count;
        g.dispose();
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      out.setIndex(new THREE.BufferAttribute(idx, 1));
      out.computeBoundingSphere();
      return out;
    }

    function flush() {
      for (const b of BUCKETS.values()) {
        const mesh = new THREE.Mesh(mergeGeos(b.geos), b.mat);
        mesh.castShadow = b.cast;
        mesh.receiveShadow = b.receive;
        mesh.renderOrder = b.order;
        world.add(mesh);
      }
      BUCKETS.clear();
    }

    /** UVs from world position, so every surface tiles at the same real size. */
    function worldUV(geo, scale) {
      const pos = geo.attributes.position;
      const nor = geo.attributes.normal;
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        let u, v;
        if (ny > 0.5) { u = x; v = z; }
        else if (nx > 0.5) { u = z; v = y; }
        else { u = x; v = y; }
        uv[i * 2] = u * scale;
        uv[i * 2 + 1] = v * scale;
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      return geo;
    }

    function addBox(w, h, d, x, y, z, mat, opts = {}) {
      const geo = new THREE.BoxGeometry(w, h, d);
      if (opts.uv) worldUV(geo, opts.uv);
      geo.translate(x, y, z);
      if (opts.ry) geo.rotateY(opts.ry);
      if (opts.solid) {
        const m = new THREE.Mesh(geo, mat);
        m.castShadow = opts.cast !== false;
        m.receiveShadow = opts.receive !== false;
        world.add(m);
        return m;
      }
      queue(geo, mat, opts.cast !== false, opts.receive !== false, opts.order || 0);
      return null;
    }

    /**
     * A wall with real rectangular holes. The wall is split on every hole edge,
     * so openings are geometry you can walk through, with the reveal depth of
     * the wall itself.
     */
    function addWall({ axis, at, from, to, y0, y1, thick, holes = [], mat, uv = 0.42 }) {
      const us = [from, to], vs = [y0, y1];
      holes.forEach(h => { us.push(h.a, h.b); vs.push(h.y0, h.y1); });
      us.sort((p, q) => p - q); vs.sort((p, q) => p - q);
      for (let i = 0; i < us.length - 1; i++) {
        const uc = (us[i] + us[i + 1]) / 2, du = us[i + 1] - us[i];
        if (du < 0.004) continue;
        for (let j = 0; j < vs.length - 1; j++) {
          const vc = (vs[j] + vs[j + 1]) / 2, dv = vs[j + 1] - vs[j];
          if (dv < 0.004) continue;
          if (holes.some(h => uc > h.a && uc < h.b && vc > h.y0 && vc < h.y1)) continue;
          if (axis === 'x') addBox(du, dv, thick, uc, vc, at, mat, { uv });
          else addBox(thick, dv, du, at, vc, uc, mat, { uv });
        }
      }
    }

    function addPlane(w, d, x, y, z, mat, opts = {}) {
      const geo = new THREE.PlaneGeometry(w, d, opts.seg || 1, opts.seg || 1);
      geo.rotateX(opts.faceDown ? Math.PI / 2 : -Math.PI / 2);
      if (opts.uv) worldUV(geo, opts.uv);
      if (opts.bend) {
        const p = geo.attributes.position;
        for (let i = 0; i < p.count; i++) p.setY(i, opts.bend(p.getX(i) + x, p.getZ(i) + z));
        geo.computeVertexNormals();
      }
      geo.translate(x, y, z);
      queue(geo, mat, !!opts.cast, opts.receive !== false);
    }

    /* ─────────────────────────────────────────────────────────────────────
       5 · landscape
       ───────────────────────────────────────────────────────────────────── */
    const CZ = -1.4;
    const vn = (x, z) => Math.sin(x * 0.11) * Math.cos(z * 0.13) + Math.sin(x * 0.037 + z * 0.052) * 1.6
      + Math.sin(x * 0.023 - z * 0.019 + 2.1) * 2.2 + Math.sin(x * 0.29 + z * 0.17) * 0.22;

    const POOLG = { x0: -3.2, x1: 8.4, z0: -19.6, z1: -9.8 };
    const bend = (x, z) => {
      const d = Math.hypot(x, z * 0.9);
      return smoothstep(42, 130, d) * vn(x, z) * 0.62 - 0.06;
    };
    // the meadow is four quads around the pool cut-out, so the water is a real
    // basin in the ground rather than a plane painted on top of it
    const groundQuads = [
      [-260, 260, POOLG.z1, 260],
      [-260, 260, -260, POOLG.z0],
      [-260, POOLG.x0, POOLG.z0, POOLG.z1],
      [POOLG.x1, 260, POOLG.z0, POOLG.z1]
    ];
    for (const [x0, x1, z0, z1] of groundQuads) {
      addPlane(x1 - x0, z1 - z0, (x0 + x1) / 2, -0.06, (z0 + z1) / 2, M.meadow, {
        seg: Math.min(88, Math.max(8, Math.round((x1 - x0) / 6))), uv: 1 / 9, bend
      });
    }

    // gravel drive — a ribbon following the same spline the camera flies
    const drivePts = [
      [30, 150], [26, 128], [22.5, 108], [19.5, 92], [17, 78], [14.5, 64],
      [12, 52], [9.2, 41], [6.4, 31], [4.0, 23], [2.2, 16.5], [1.0, 11.5], [0, 8.4], [0, 6.4]
    ].map(([x, z]) => new THREE.Vector3(x, 0, z));
    const drive = new THREE.CatmullRomCurve3(drivePts, false, 'centripetal', 0.5);
    {
      const N = 200, pos = [], uv = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const p = drive.getPoint(t);
        const tan = drive.getTangent(t);
        const nrm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        const w = lerp(1.65, 1.25, t);
        for (const s of [-1, 1]) {
          pos.push(p.x + nrm.x * w * s, 0.035 + (t > 0.95 ? (t - 0.95) * 1.0 : 0), p.z + nrm.z * w * s);
          uv.push(s * 1.1 + 0.55, t * 34);
        }
        if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const path = new THREE.Mesh(geo, M.gravel);
      path.receiveShadow = true;
      world.add(path);
    }

    // loose pebbles on the drive shoulders — instanced, no shadow cost
    {
      const geo = new THREE.IcosahedronGeometry(1, 0);
      const count = MOBILE ? 180 : 380;
      const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x9d9483, roughness: 0.92, metalness: 0, envMapIntensity: 0.35 });
      const inst = new THREE.InstancedMesh(geo, pebbleMat, count);
      inst.receiveShadow = true;
      const d = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        const t = Math.pow(rnd(), 0.8);
        const p = drive.getPoint(t);
        const tan = drive.getTangent(t);
        const nrm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        const side = rnd() > 0.5 ? 1 : -1;
        const off = lerp(1.28, 2.1, rnd()) * side;
        d.position.set(p.x + nrm.x * off, 0.02, p.z + nrm.z * off);
        const s = rr(0.045, 0.11);
        d.scale.set(s * rr(1, 2.0), s * rr(0.45, 0.8), s * rr(1, 2.0));
        d.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
        d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      world.add(inst);
    }

    // distant hills
    {
      const hillMat = new THREE.MeshStandardMaterial({ color: 0x8e8770, roughness: 1, metalness: 0, envMapIntensity: 0.25 });
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.4, r = rr(300, 360);
        const geo = new THREE.SphereGeometry(rr(34, 58), 22, 12, 0, Math.PI * 2, 0, Math.PI / 2);
        geo.scale(rr(1.4, 2.4), rr(0.22, 0.5), rr(1.3, 2.2));
        geo.translate(Math.cos(a) * r, -7, Math.sin(a) * r);
        queue(geo, hillMat, false, false);
      }
    }

    // terrace + pool
    const POOL = { x0: -3.2, x1: 8.4, z0: -19.6, z1: -9.8, w: -0.34 };
    addBox(22, 0.4, 4.0, 1.5, -0.2, -7.9, M.stonePale, { uv: 0.42 });
    addBox(21, 0.42, 0.3, 1.5, -0.2, -6.05, M.stonePale, { uv: 0.42 });
    const pw = 0.34;
    {
      const px = (POOL.x0 + POOL.x1) / 2, pz = (POOL.z0 + POOL.z1) / 2;
      const w = POOL.x1 - POOL.x0, d = POOL.z1 - POOL.z0;
      // basin: floor plus four walls, so the water has something to sit over
      addBox(w, 0.24, d, px, -1.82, pz, M.poolWall, { cast: false });
      addBox(w, 1.62, 0.2, px, -0.95, POOL.z1 - 0.1, M.poolWall, { cast: false });
      addBox(w, 1.62, 0.2, px, -0.95, POOL.z0 + 0.1, M.poolWall, { cast: false });
      addBox(0.2, 1.62, d, POOL.x0 + 0.1, -0.95, pz, M.poolWall, { cast: false });
      addBox(0.2, 1.62, d, POOL.x1 - 0.1, -0.95, pz, M.poolWall, { cast: false });
    }
    addBox(POOL.x1 - POOL.x0 + pw * 2, 0.28, pw, (POOL.x0 + POOL.x1) / 2, -0.34, POOL.z1 + pw / 2, M.stonePale, { uv: 0.42 });
    addBox(POOL.x1 - POOL.x0 + pw * 2, 0.28, pw, (POOL.x0 + POOL.x1) / 2, -0.34, POOL.z0 - pw / 2, M.stonePale, { uv: 0.42 });
    addBox(pw, 0.28, POOL.z1 - POOL.z0, POOL.x0 - pw / 2, -0.34, (POOL.z0 + POOL.z1) / 2, M.stonePale, { uv: 0.42 });
    addBox(pw, 0.28, POOL.z1 - POOL.z0, POOL.x1 + pw / 2, -0.34, (POOL.z0 + POOL.z1) / 2, M.stonePale, { uv: 0.42 });

    const waterNormalTex = tex(makeWaterNormal(512));
    waterNormalTex.repeat.set(4, 3.4);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x14302d,
      roughness: 0.13,
      metalness: 0.0,
      normalMap: waterNormalTex,
      normalScale: new THREE.Vector2(0.45, 0.45),
      envMapIntensity: 0.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.09,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(POOL.x1 - POOL.x0, POOL.z1 - POOL.z0), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set((POOL.x0 + POOL.x1) / 2, POOL.w, (POOL.z0 + POOL.z1) / 2);
    water.receiveShadow = true;
    water.renderOrder = 1;
    world.add(water);

    /* ─────────────────────────────────────────────────────────────────────
       6 · the house
       ───────────────────────────────────────────────────────────────────── */
    const A = { x0: -10, x1: 4, z0: -6, z1: 6, h: 6.8, t: 0.5 };
    const B = { x0: 3.6, x1: 13, z0: -6, z1: 3.2, h: 3.9, t: 0.42 };
    const DOOR = { a: -1.15, b: 1.15, top: 2.95 };
    const REAR = { a: -6.0, b: 2.2, top: 3.35 };

    addBox(A.x1 - A.x0 + 0.5, 0.34, A.z1 - A.z0 + 0.5, (A.x0 + A.x1) / 2, -0.17, (A.z0 + A.z1) / 2, M.concrete, { uv: 0.42 });
    addBox(B.x1 - B.x0 + 0.4, 0.3, B.z1 - B.z0 + 0.4, (B.x0 + B.x1) / 2, -0.15, (B.z0 + B.z1) / 2, M.concrete, { uv: 0.42 });

    addWall({
      axis: 'x', at: A.z1, from: A.x0, to: A.x1, y0: 0, y1: A.h, thick: A.t, mat: M.stone, uv: 0.4,
      holes: [
        { a: DOOR.a, b: DOOR.b, y0: 0, y1: DOOR.top },
        { a: -7.6, b: -3.7, y0: 0.95, y1: 3.45 },
        { a: -7.6, b: -3.7, y0: 4.9, y1: 6.05 }
      ]
    });
    addWall({
      axis: 'x', at: A.z0, from: A.x0, to: A.x1, y0: 0, y1: A.h, thick: A.t, mat: M.stone, uv: 0.4,
      holes: [
        { a: REAR.a, b: REAR.b, y0: 0, y1: REAR.top },
        { a: -8.6, b: -3.2, y0: 4.6, y1: 5.9 }
      ]
    });
    addWall({
      axis: 'z', at: A.x0, from: A.z0, to: A.z1, y0: 0, y1: A.h, thick: A.t, mat: M.stone, uv: 0.4,
      holes: [
        { a: -4.6, b: -2.2, y0: 0.85, y1: 3.5 },
        { a: 1.3, b: 3.4, y0: 0.85, y1: 3.5 }
      ]
    });
    addWall({
      axis: 'z', at: A.x1, from: A.z0, to: A.z1, y0: 0, y1: A.h, thick: A.t, mat: M.stone, uv: 0.4,
      holes: [{ a: -4.3, b: -1.1, y0: 0, y1: 3.15 }]
    });

    // expressed floor line + cladding joints
    for (const [z, ry] of [[A.z1 + 0.005, 0], [A.z0 - 0.005, 0]]) {
      addBox(13.98, 0.055, 0.02, 0, 3.44, z, M.dark, { uv: 0.4, cast: false });
    }
    for (const x of [-8.2, -4.4, 0.9, 3.45]) {
      addBox(0.03, 2.9, 0.02, x, 5.1, A.z1 + 0.005, M.dark, { uv: 0.4, cast: false });
    }
    addBox(0.02, 6.4, 0.055, A.x0 - 0.005, 3.2, -0.9, M.dark, { uv: 0.4, cast: false });

    // roofs
    const roofMat = new THREE.MeshStandardMaterial({ map: tex(conc.map, { srgb: true }), normalMap: tex(conc.normal), color: 0x8f8b80, roughness: 0.95, metalness: 0, envMapIntensity: 0.35 });
    // main volume: slab, membrane roof, low parapet with a bronze coping
    addBox(A.x1 - A.x0 + 1.9, 0.55, A.z1 - A.z0 + 1.9, (A.x0 + A.x1) / 2, A.h + 0.28, (A.z0 + A.z1) / 2, M.stonePale, { uv: 0.4 });
    addBox(A.x1 - A.x0 + 1.7, 0.06, A.z1 - A.z0 + 1.7, (A.x0 + A.x1) / 2, A.h + 0.575, (A.z0 + A.z1) / 2, roofMat, { uv: 0.3, cast: false });
    {
      const px = (A.x0 + A.x1) / 2, pz = (A.z0 + A.z1) / 2;
      const ow = A.x1 - A.x0 + 1.9, od = A.z1 - A.z0 + 1.9;
      addBox(ow, 0.34, 0.16, px, A.h + 0.73, pz - od / 2 + 0.08, M.stonePale, { uv: 0.4 });
      addBox(ow, 0.34, 0.16, px, A.h + 0.73, pz + od / 2 - 0.08, M.stonePale, { uv: 0.4 });
      addBox(0.16, 0.34, od, px - ow / 2 + 0.08, A.h + 0.73, pz, M.stonePale, { uv: 0.4 });
      addBox(0.16, 0.34, od, px + ow / 2 - 0.08, A.h + 0.73, pz, M.stonePale, { uv: 0.4 });
    }
    // wing
    addBox(B.x1 - B.x0 + 1.1, 0.42, B.z1 - B.z0 + 1.1, (B.x0 + B.x1) / 2, B.h + 0.21, (B.z0 + B.z1) / 2, M.stonePale, { uv: 0.4 });
    addBox(B.x1 - B.x0 + 0.95, 0.05, B.z1 - B.z0 + 0.95, (B.x0 + B.x1) / 2, B.h + 0.44, (B.z0 + B.z1) / 2, roofMat, { uv: 0.3, cast: false });
    {
      const px = (B.x0 + B.x1) / 2, pz = (B.z0 + B.z1) / 2;
      const ow = B.x1 - B.x0 + 1.1, od = B.z1 - B.z0 + 1.1;
      addBox(ow, 0.26, 0.14, px, B.h + 0.55, pz - od / 2 + 0.07, M.stonePale, { uv: 0.4 });
      addBox(ow, 0.26, 0.14, px, B.h + 0.55, pz + od / 2 - 0.07, M.stonePale, { uv: 0.4 });
      addBox(0.14, 0.26, od, px - ow / 2 + 0.07, B.h + 0.55, pz, M.stonePale, { uv: 0.4 });
      addBox(0.14, 0.26, od, px + ow / 2 - 0.07, B.h + 0.55, pz, M.stonePale, { uv: 0.4 });
    }

    // timber wing
    addWall({
      axis: 'x', at: B.z1, from: B.x0, to: B.x1, y0: 0, y1: B.h, thick: B.t, mat: M.stone, uv: 0.4,
      holes: [{ a: 5.1, b: 11.7, y0: 0.05, y1: 2.92 }]
    });
    addWall({
      axis: 'x', at: B.z0, from: B.x0, to: B.x1, y0: 0, y1: B.h, thick: B.t, mat: M.stone, uv: 0.4,
      holes: [{ a: 5.0, b: 12.1, y0: 0.05, y1: 2.92 }]
    });
    addWall({
      axis: 'z', at: B.x1, from: B.z0, to: B.z1, y0: 0, y1: B.h, thick: B.t, mat: M.stone, uv: 0.4,
      holes: [{ a: -4.7, b: 1.4, y0: 0.05, y1: 2.92 }]
    });

    // vertical oak slats — real geometry, one instanced draw
    {
      const slatGeo = new THREE.BoxGeometry(0.045, 1, 0.12);
      const count = MOBILE ? 78 : 118;
      const slatMat = new THREE.MeshStandardMaterial({ color: 0x6b4726, roughness: 0.72, metalness: 0, envMapIntensity: 0.55 });
      const inst = new THREE.InstancedMesh(slatGeo, slatMat, count);
      inst.castShadow = true; inst.receiveShadow = true;
      const d = new THREE.Object3D();
      let i = 0;
      const front = Math.round(count * 0.62);
      for (; i < front; i++) {
        d.position.set(lerp(B.x0 + 0.4, B.x1 - 0.3, i / (front - 1)), 1.62, B.z1 + 0.16);
        d.scale.set(1, 3.24, 1); d.rotation.set(0, 0, 0);
        d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
      }
      for (; i < count; i++) {
        d.position.set(B.x1 + 0.16, 1.62, lerp(B.z0 + 0.5, B.z1 - 0.4, (i - front) / (count - front - 1)));
        d.scale.set(1, 3.24, 1); d.rotation.set(0, Math.PI / 2, 0);
        d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      world.add(inst);
    }

    /* ── glazing ───────────────────────────────────────────────────────── */
    function glaze({ axis, at, from, to, y0, y1, mullions = 3, openFrom = null, openTo = null }) {
      const tF = 0.07;
      const mul = Array.isArray(mullions)
        ? mullions.slice()
        : Array.from({ length: mullions + 1 }, (_, i) => lerp(from, to, i / mullions));
      const mk = (w, h, d, x, y, z) => addBox(w, h, d, x, y, z, M.bronze, { uv: 0.5 });
      if (axis === 'x') {
        mk(to - from, tF, 0.11, (from + to) / 2, y1 - tF / 2, at);
        mk(to - from, tF, 0.11, (from + to) / 2, y0 + tF / 2, at);
        for (const u of mul) mk(tF, y1 - y0, 0.11, u, (y0 + y1) / 2, at);
      } else {
        mk(0.11, tF, to - from, at, y1 - tF / 2, (from + to) / 2);
        mk(0.11, tF, to - from, at, y0 + tF / 2, (from + to) / 2);
        for (const u of mul) mk(0.11, y1 - y0, tF, at, (y0 + y1) / 2, u);
      }
      const panes = [];
      for (let i = 0; i < mul.length - 1; i++) {
        const a = mul[i] ?? mul[i], b = mul[i + 1];
        if (openFrom === null) { panes.push([a, b]); continue; }
        if (b <= openTo + 0.001 || a >= openFrom - 0.001) { panes.push([a, b]); continue; }
        if (a < openTo) panes.push([a, openTo]);
        if (b > openFrom) panes.push([openFrom, b]);
      }
      for (const [a, b] of panes) {
        if (b - a < 0.05) continue;
        const h = y1 - y0;
        const g = new THREE.Mesh(new THREE.PlaneGeometry(b - a, h), M.glass);
        if (axis === 'x') g.position.set((a + b) / 2, (y0 + y1) / 2, at);
        else { g.rotation.y = Math.PI / 2; g.position.set(at, (y0 + y1) / 2, (a + b) / 2); }
        g.renderOrder = 3;
        world.add(g);
      }
    }

    glaze({ axis: 'x', at: A.z0, from: REAR.a, to: REAR.b, y0: 0.02, y1: REAR.top, mullions: [-6, -4.4, -2.8, -1.2, 0.0], openFrom: 2.2, openTo: 0.0 });
    glaze({ axis: 'x', at: A.z0 + 0.02, from: -8.6, to: -3.2, y0: 4.6, y1: 5.9, mullions: 3 });
    glaze({ axis: 'x', at: A.z1 - 0.02, from: -7.6, to: -3.7, y0: 4.9, y1: 6.05, mullions: 3 });
    glaze({ axis: 'x', at: A.z1 - 0.02, from: -7.6, to: -3.7, y0: 0.95, y1: 3.45, mullions: 2 });
    glaze({ axis: 'z', at: A.x0 + 0.02, from: -4.6, to: -2.2, y0: 0.85, y1: 3.5, mullions: 2 });
    glaze({ axis: 'z', at: A.x0 + 0.02, from: 1.3, to: 3.4, y0: 0.85, y1: 3.5, mullions: 2 });
    glaze({ axis: 'x', at: B.z1 - 0.02, from: 5.1, to: 11.7, y0: 0.05, y1: 2.92, mullions: 5 });
    glaze({ axis: 'x', at: B.z0 + 0.02, from: 5.0, to: 12.1, y0: 0.05, y1: 2.92, mullions: 5 });
    glaze({ axis: 'z', at: B.x1 - 0.02, from: -4.7, to: 1.4, y0: 0.05, y1: 2.92, mullions: 4 });

    // entry portal — the deep recess the camera travels through
    addBox(1.0, 3.45, 1.35, -1.65, 1.72, A.z1 + 0.66, M.stone, { uv: 0.4 });
    addBox(1.0, 3.45, 1.35, 1.65, 1.72, A.z1 + 0.66, M.stone, { uv: 0.4 });
    addBox(2.4, 0.62, 1.35, 0, 3.28, A.z1 + 0.66, M.stone, { uv: 0.4 });
    addBox(5.6, 0.28, 3.2, 0.4, 3.72, A.z1 + 1.6, M.stonePale, { uv: 0.4 });
    addBox(5.7, 0.06, 3.3, 0.4, 3.89, A.z1 + 1.6, M.bronze, { uv: 0.4 });
    addBox(2.34, 0.05, 0.56, 0, DOOR.top - 0.02, A.z1, M.bronze, { uv: 0.5 });
    addBox(0.05, DOOR.top, 0.56, -1.17, DOOR.top / 2, A.z1, M.bronze, { uv: 0.5 });
    addBox(0.05, DOOR.top, 0.56, 1.17, DOOR.top / 2, A.z1, M.bronze, { uv: 0.5 });
    addBox(0.055, 2.86, 2.1, 2.25, 1.45, 4.62, M.oak, { uv: 0.6 });
    addBox(0.09, 0.03, 1.4, 2.22, 1.02, 4.4, M.bronze, { uv: 0.5 });

    /* ─────────────────────────────────────────────────────────────────────
       7 · interior
       ───────────────────────────────────────────────────────────────────── */
    addPlane(A.x1 - A.x0 - 0.6, A.z1 - A.z0 - 0.6, 0, 0.012, 0, M.oakFloor, { uv: 1 / 3.1 });
    addPlane(B.x1 - B.x0 - 0.5, B.z1 - B.z0 - 0.5, (B.x0 + B.x1) / 2 + 0.2, 0.014, (B.z0 + B.z1) / 2, M.oakFloor, { uv: 1 / 3.1 });
    addPlane(A.x1 - A.x0 - 0.6, A.z1 - A.z0 - 0.6, 0, A.h - 0.02, 0, M.plaster, { uv: 0.35, faceDown: true });

    addBox(6.0, 0.26, 4.6, -7.0, 3.62, 0.3, M.stonePale, { uv: 0.42 });
    addPlane(5.9, 4.5, -7.0, 3.485, 0.3, M.plaster, { uv: 0.35, faceDown: true });
    addBox(6.0, 0.05, 0.05, -7.0, 3.79, 2.6, M.oak, { uv: 0.6 });
    {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 1.0), M.glass);
      g.position.set(-7.0, 4.3, 2.58); g.renderOrder = 3; world.add(g);
      addBox(5.9, 0.07, 0.09, -7.0, 4.83, 2.58, M.oak, { uv: 0.6 });
    }

    // floating oak stair
    {
      const n = 13, rise = 3.5 / n, run = 0.3;
      for (let i = 0; i < n; i++) {
        const y = 0.16 + i * rise, z = 2.05 - i * run;
        addBox(1.5, 0.075, run + 0.06, -9.0, y, z, M.oak, { uv: 0.6 });
        addBox(0.05, 0.28, 0.05, -9.7, y + 0.14, z, M.bronze, { uv: 0.5 });
      }
      addBox(0.02, 1.05, 3.9, -8.2, 2.1, 0.1, M.glass, { uv: 0.5 });
      const hrPts = [];
      for (let i = 0; i <= 8; i++) {
        const s = i / 8;
        hrPts.push(new THREE.Vector3(-8.22, 1.05 + s * 3.42, 2.15 - s * 3.5));
      }
      const hr = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hrPts), 20, 0.028, 8), M.bronze);
      hr.castShadow = true; world.add(hr);
    }

    addWall({ axis: 'z', at: 7.0, from: -5.8, to: 3.0, y0: 0, y1: B.h, thick: 0.16, mat: M.plaster, uv: 0.4 });

    // furniture
    addPlane(5.4, 3.8, -5.2, 0.022, -3.4, M.linenB, { uv: 0.5 });
    {
      const sx = -5.2, sz = -4.35;
      addBox(3.4, 0.34, 1.15, sx, 0.28, sz, M.linenA, { uv: 0.7 });
      addBox(3.4, 0.62, 0.26, sx, 0.62, sz - 0.46, M.linenA, { uv: 0.7 });
      addBox(0.26, 0.5, 1.15, sx - 1.6, 0.55, sz, M.linenA, { uv: 0.7 });
      addBox(0.26, 0.5, 1.15, sx + 1.6, 0.55, sz, M.linenA, { uv: 0.7 });
      for (let i = 0; i < 3; i++) addBox(1.02, 0.16, 0.96, sx - 1.05 + i * 1.05, 0.53, sz + 0.02, M.linenA, { uv: 0.7 });
      addBox(0.42, 0.4, 0.16, sx + 0.9, 0.66, sz - 0.28, M.linenA, { uv: 0.7 });
    }
    addBox(1.7, 0.07, 0.85, -5.2, 0.36, -2.75, M.oakDark, { uv: 0.6 });
    addBox(1.5, 0.32, 0.06, -5.2, 0.19, -2.75, M.bronze, { uv: 0.5 });
    addBox(0.24, 0.05, 0.3, -5.6, 0.42, -2.72, M.dark, { uv: 0.5 });
    addBox(0.2, 0.03, 0.26, -5.58, 0.46, -2.7, M.linenA, { uv: 0.5 });
    {
      const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.34, 14), M.stonePale);
      vase.geometry.translate(-4.8, 0.47, -2.78);
      vase.castShadow = true;
      queue(vase.geometry, M.stonePale, true, true);
    }
    {
      const tx = 0.6, tz = -0.6;
      addBox(2.5, 0.08, 1.0, tx, 0.74, tz, M.oakDark, { uv: 0.6 });
      for (const [dx, dz] of [[-1.1, -0.38], [1.1, -0.38], [-1.1, 0.38], [1.1, 0.38]])
        addBox(0.07, 0.72, 0.07, tx + dx, 0.37, tz + dz, M.bronze, { uv: 0.5 });
      for (let i = 0; i < 3; i++) {
        const cx = tx - 0.8 + i * 0.8;
        addBox(0.42, 0.06, 0.42, cx, 0.45, tz + 0.85, M.oak, { uv: 0.6 });
        addBox(0.42, 0.5, 0.05, cx, 0.72, tz + 1.05, M.oak, { uv: 0.6 });
        addBox(0.05, 0.45, 0.05, cx - 0.16, 0.22, tz + 0.7, M.bronze, { uv: 0.5 });
        addBox(0.05, 0.45, 0.05, cx + 0.16, 0.22, tz + 1.0, M.bronze, { uv: 0.5 });
      }
    }
    {
      const cord = new THREE.CylinderGeometry(0.006, 0.006, 3.4, 5);
      cord.translate(0.6, 5.0, -0.6);
      queue(cord, M.bronze, false, false);
      addBox(0.62, 0.1, 0.16, 0.6, 3.28, -0.6, M.bronze, { uv: 0.5 });
      addBox(0.58, 0.02, 0.13, 0.6, 3.22, -0.6, new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.3, 1.4) }), { cast: false, receive: false });
    }
    {
      const base = new THREE.CylinderGeometry(0.16, 0.18, 0.03, 16);
      base.translate(-8.4, 0.02, -5.2);
      queue(base, M.bronze, false, true);
      const pole = new THREE.CylinderGeometry(0.014, 0.014, 1.5, 8);
      pole.translate(-8.4, 0.76, -5.2);
      queue(pole, M.bronze, false, false);
      const shade = new THREE.CylinderGeometry(0.2, 0.24, 0.26, 20, 1, true);
      shade.translate(-8.4, 1.58, -5.2);
      queue(shade, M.linenA, false, false);
    }
    addBox(3.2, 0.9, 1.1, 9.0, 0.45, -1.2, M.stonePale, { uv: 0.5 });
    addBox(3.4, 0.06, 1.3, 9.0, 0.93, -1.2, M.concrete, { uv: 0.5 });
    addBox(0.9, 0.06, 0.5, 9.6, 0.99, -1.2, M.dark, { uv: 0.5 });

    /* ── interior lighting ─────────────────────────────────────────────── */
    const warm = 0xffbf85;
    const addPoint = (x, y, z, intensity, dist, color = warm, castShadow = false) => {
      const l = new THREE.PointLight(color, intensity, dist, 2);
      l.position.set(x, y, z);
      if (castShadow) {
        // the walls must block the light, or every room is flooded evenly
        l.castShadow = true;
        const sm = MOBILE ? 512 : 1024;
        l.shadow.mapSize.set(sm, sm);
        l.shadow.camera.near = 0.12;
        l.shadow.camera.far = dist + 4;
        l.shadow.bias = -0.0009;
        l.shadow.normalBias = 0.035;
      }
      scene.add(l);
      return l;
    };
    addPoint(0.0, 3.4, 2.6, MOBILE ? 14 : 22, 18, warm, true);
    addPoint(-4.6, 3.1, -3.0, MOBILE ? 18 : 30, 20, warm, true);
    addPoint(0.6, 2.5, -0.6, MOBILE ? 7 : 10, 9, warm, true);
    addPoint(9.0, 2.4, -1.2, MOBILE ? 7 : 10, 13, warm, true);
    addPoint(2.0, -0.7, -14.0, MOBILE ? 5 : 8, 13, 0xbfe2d8);

    const coveMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.9, 2.05, 1.25) });
    addBox(8.0, 0.03, 0.06, -2.0, 6.72, -3.9, coveMat, { cast: false, receive: false });
    addBox(0.06, 0.03, 5.0, 3.6, 6.72, 0.5, coveMat, { cast: false, receive: false });
    addBox(5.0, 0.03, 0.06, -7.0, 3.45, 2.4, coveMat, { cast: false, receive: false });

    // bollards on the terrace
    const bollard = (x, z) => {
      addBox(0.12, 0.5, 0.12, x, 0.25, z, M.bronze, { uv: 0.5 });
      addBox(0.1, 0.04, 0.1, x, 0.5, z, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.7, 1.0) }), { cast: false, receive: false });
      addPoint(x, 0.62, z, MOBILE ? 2.5 : 4, 5, 0xffb877);
    };
    bollard(-6.6, -8.6); bollard(9.6, -8.6);


    /* ─────────────────────────────────────────────────────────────────────
       8 · olives
       ───────────────────────────────────────────────────────────────────── */
    const leafGeo = new THREE.PlaneGeometry(1, 1);
    const leafMatrices = [];

    function addOlive(x, z, scale = 1) {
      const g = new THREE.Group();
      const h = rr(2.1, 2.9) * scale;
      const segs = 5;
      for (let i = 0; i < segs; i++) {
        const r0 = lerp(0.2, 0.1, i / segs) * scale, r1 = lerp(0.2, 0.1, (i + 1) / segs) * scale;
        const geo = new THREE.CylinderGeometry(r1, r0, h / segs, 9, 1, true);
        geo.rotateZ(rr(-0.16, 0.16)); geo.rotateX(rr(-0.12, 0.12));
        geo.translate(x + rr(-0.08, 0.08) * scale, (i + 0.5) * h / segs, z + rr(-0.08, 0.08) * scale);
        queue(geo, M.bark, true, true);
      }
      const branchTips = [];
      const nb = MOBILE ? 4 : 6;
      for (let i = 0; i < nb; i++) {
        const a = (i / nb) * Math.PI * 2 + rr(-0.4, 0.4), len = rr(0.9, 1.6) * scale;
        const start = new THREE.Vector3(x, h * rr(0.62, 0.92), z);
        const end = new THREE.Vector3(x + Math.cos(a) * len, start.y + rr(0.5, 1.1) * scale, z + Math.sin(a) * len);
        const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(rr(-0.2, 0.2), rr(0, 0.25), rr(-0.2, 0.2)));
        const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([start, mid, end]), 8, 0.055 * scale, 6, false);
        queue(geo, M.bark, true, false);
        branchTips.push(end);
      }

      const clusters = MOBILE ? 9 : 14, perCluster = MOBILE ? 11 : 17;
      const dummy = new THREE.Object3D();
      for (let c = 0; c < clusters; c++) {
        const tip = branchTips[c % branchTips.length];
        const cx0 = tip.x + rr(-0.75, 0.75) * scale;
        const cy0 = tip.y + rr(-0.35, 0.95) * scale;
        const cz0 = tip.z + rr(-0.75, 0.75) * scale;
        for (let k = 0; k < perCluster; k++) {
          const a = rnd() * Math.PI * 2, b = Math.acos(rr(-1, 1));
          const rad = Math.pow(rnd(), 0.5) * 1.25 * scale;
          dummy.position.set(
            cx0 + Math.sin(b) * Math.cos(a) * rad,
            cy0 + Math.cos(b) * rad * 0.72,
            cz0 + Math.sin(b) * Math.sin(a) * rad
          );
          dummy.rotation.set(rr(0, 3.14), rr(0, 3.14), rr(0, 3.14));
          const s = rr(0.55, 0.95) * scale;
          dummy.scale.set(s, s, s);
          dummy.updateMatrix();
          leafMatrices.push(dummy.matrix.clone());
        }
      }
    }

    const treeSpots = [
      [-7.5, 9.2, 1.05], [6.4, 10.5, 0.95], [-10.5, 16, 1.1], [11.5, 19, 1.0],
      [-14, 26, 1.15], [6.0, 34, 0.9], [-7, 44, 1.1], [20.5, 50, 1.0],
      [-18, 62, 1.2], [7.5, 68, 1.05], [-9.5, 88, 1.15], [26, 96, 1.1],
      [-11.5, -13.5, 1.05], [12.5, -16, 1.0], [-13, -2.5, 0.95], [15.5, 6.5, 0.95],
      [-16, -24, 1.1], [11, -26, 1.05], [-6, -30, 1.0], [2, -36, 1.1]
    ];
    treeSpots.forEach(([x, z, s]) => addOlive(x, z, s));

    // shrubs
    {
      const shrubMat = new THREE.MeshStandardMaterial({ color: 0x6f7448, roughness: 0.96, metalness: 0, envMapIntensity: 0.4, flatShading: true });
      const geo = new THREE.IcosahedronGeometry(1, 1);
      const count = MOBILE ? 46 : 86;
      const inst = new THREE.InstancedMesh(geo, shrubMat, count);
      inst.castShadow = true; inst.receiveShadow = true;
      const d = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        // hug the drive, plus a band along the house
        if (i % 7 === 0) {
          d.position.set(rr(-11, 5), 0, rr(6.6, 7.4));
        } else {
          const t = Math.pow(rnd(), 0.9);
          const pp = drive.getPoint(t);
          const tan = drive.getTangent(t);
          const nrm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
          const side = rnd() > 0.5 ? 1 : -1;
          const off = rr(1.8, 4.6) * side;
          d.position.set(pp.x + nrm.x * off, 0, pp.z + nrm.z * off);
        }
        const s = rr(0.16, 0.42);
        d.scale.set(s * rr(1.3, 1.9), s * rr(0.6, 0.95), s * rr(1.3, 1.9));
        d.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
        d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      world.add(inst);
    }

    // every canopy card, one draw
    {
      const inst = new THREE.InstancedMesh(leafGeo, M.leaf, leafMatrices.length);
      leafMatrices.forEach((m, i) => inst.setMatrixAt(i, m));
      inst.instanceMatrix.needsUpdate = true;
      inst.castShadow = true;
      inst.frustumCulled = false;
      world.add(inst);
    }

    flush();

    /* ─────────────────────────────────────────────────────────────────────
       9 · dust motes — one additive Points pass inside the hall
       ───────────────────────────────────────────────────────────────────── */
    const dust = (() => {
      const N = MOBILE ? 420 : 1100;
      const pos = new Float32Array(N * 3);
      const seed = new Float32Array(N);
      const size = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = rr(-9.2, 3.4);
        pos[i * 3 + 1] = rr(0.2, 6.4);
        pos[i * 3 + 2] = rr(-5.4, 5.4);
        seed[i] = rnd();
        size[i] = rr(0.5, 1.6);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
      geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        vertexShader: /* glsl */`
          attribute float aSeed;
          attribute float aSize;
          uniform float uTime;
          varying float vFade;
          void main(){
            vec3 p = position;
            p.x += sin(uTime*0.19 + aSeed*28.0) * 0.42;
            p.y += sin(uTime*0.13 + aSeed*17.0) * 0.30;
            p.z += cos(uTime*0.16 + aSeed*23.0) * 0.42;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = aSize * 26.0 / max(1.2, -mv.z);
            vFade = clamp(1.0 - (-mv.z) / 22.0, 0.0, 1.0) * clamp(1.0 - abs(p.y - 3.0) / 4.2, 0.0, 1.0);
          }`,
        fragmentShader: /* glsl */`
          uniform float uOpacity;
          varying float vFade;
          void main(){
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.02, d) * vFade * uOpacity;
            if (a < 0.004) discard;
            gl_FragColor = vec4(1.0, 0.86, 0.68, a);
          }`
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      pts.renderOrder = 5;
      world.add(pts);
      return mat;
    })();

    /* ─────────────────────────────────────────────────────────────────────
       10 · post pipeline  (after Lusion's pass order:
            scene → bloom(10) → final grade(30) → screen)
       The scene renders into a half-float target, a high-pass + separable blur
       makes the glow, and one composite pass does the filmic grade: saturation,
       contrast, aspect-corrected vignette and 1/255 dither so the dark
       gradients do not band. Mobile skips the whole chain and lets the CSS
       grade do the work; `?post=0` disables it anywhere.
       ───────────────────────────────────────────────────────────────────── */
    const POST = !MOBILE && renderer.capabilities.isWebGL2 && !/[?&]post=0/.test(location.search);
    let post = null;

    if (POST) {
      try {
        const rtOpts = {
          type: THREE.HalfFloatType, minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false
        };
        const sceneRT = new THREE.WebGLRenderTarget(2, 2, rtOpts);
        const brightRT = new THREE.WebGLRenderTarget(2, 2, { ...rtOpts, depthBuffer: false });
        const blurA = new THREE.WebGLRenderTarget(2, 2, { ...rtOpts, depthBuffer: false });
        const blurB = new THREE.WebGLRenderTarget(2, 2, { ...rtOpts, depthBuffer: false });

        const quadGeo = new THREE.PlaneGeometry(2, 2);
        const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const quadMesh = new THREE.Mesh(quadGeo, null);
        const quadScene = new THREE.Scene();
        quadScene.add(quadMesh);

        const brightMat = new THREE.ShaderMaterial({
          uniforms: {
            tDiffuse: { value: null },
            uThreshold: { value: 2.0 },
            uKnee: { value: 1.2 }
          },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
          fragmentShader: /* glsl */`
            uniform sampler2D tDiffuse; uniform float uThreshold; uniform float uKnee;
            varying vec2 vUv;
            void main(){
              vec3 c = texture2D(tDiffuse, vUv).rgb;
              float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
              float w = smoothstep(uThreshold, uThreshold + uKnee, l);
              gl_FragColor = vec4(c * w, 1.0);
            }`,
          depthTest: false, depthWrite: false
        });

        const blurMat = new THREE.ShaderMaterial({
          uniforms: {
            tDiffuse: { value: null },
            uDir: { value: new THREE.Vector2(1, 0) },
            uTexel: { value: new THREE.Vector2(1 / 256, 1 / 256) }
          },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
          fragmentShader: /* glsl */`
            uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uTexel;
            varying vec2 vUv;
            void main(){
              vec2 o = uDir * uTexel;
              vec3 s = texture2D(tDiffuse, vUv).rgb * 0.2270270270;
              s += texture2D(tDiffuse, vUv + o * 1.3846153846).rgb * 0.3162162162;
              s += texture2D(tDiffuse, vUv - o * 1.3846153846).rgb * 0.3162162162;
              s += texture2D(tDiffuse, vUv + o * 3.2307692308).rgb * 0.0702702703;
              s += texture2D(tDiffuse, vUv - o * 3.2307692308).rgb * 0.0702702703;
              gl_FragColor = vec4(s, 1.0);
            }`,
          depthTest: false, depthWrite: false
        });

        const compMat = new THREE.ShaderMaterial({
          uniforms: {
            tScene: { value: null },
            tBloom: { value: null },
            uBloom: { value: 0.14 },
            uExposure: { value: 0.82 },
            uSaturation: { value: 0.06 },
            uContrast: { value: 0.055 },
            uBrightness: { value: 0.004 },
            uVignetteFrom: { value: 0.62 },
            uVignetteTo: { value: 1.28 },
            uVignetteColor: { value: new THREE.Color(0x14110d) },
            uVignette: { value: 0.55 },
            uVigAspect: { value: new THREE.Vector2(1, 1) },
            uSeed: { value: 0 },
            uFade: { value: 1 }
          },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
          fragmentShader: /* glsl */`
            uniform sampler2D tScene; uniform sampler2D tBloom;
            uniform float uBloom, uSaturation, uContrast, uBrightness, uExposure;
            uniform float uVignetteFrom, uVignetteTo, uVignette, uSeed, uFade;
            uniform vec3 uVignetteColor; uniform vec2 uVigAspect;
            varying vec2 vUv;

            /* ACES filmic, applied after the bloom so the glow keeps its highlights */
            vec3 rrtOdt(vec3 v){
              vec3 a = v * (v + 0.0245786) - 0.000090537;
              vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
              return a / b;
            }
            vec3 aces(vec3 color){
              const mat3 inMat = mat3(
                0.59719, 0.07600, 0.02840,
                0.35458, 0.90834, 0.13383,
                0.04823, 0.01566, 0.83777);
              const mat3 outMat = mat3(
                 1.60475, -0.10208, -0.00327,
                -0.53108,  1.10813, -0.07276,
                -0.07367, -0.00605,  1.07602);
              color *= uExposure / 0.6;
              color = inMat * color;
              color = rrtOdt(color);
              color = outMat * color;
              return clamp(color, 0.0, 1.0);
            }

            /* exact linear → sRGB transfer, so the post path matches the direct one */
            vec3 toSRGB(vec3 c){
              c = clamp(c, 0.0, 1.0);
              return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055, step(vec3(0.0031308), c));
            }
            float hash13(vec3 p3){
              p3 = fract(p3 * 0.1031);
              p3 += dot(p3, p3.yzx + 33.33);
              return fract((p3.x + p3.y) * p3.z);
            }

            void main(){
              vec3 c = texture2D(tScene, vUv).rgb;
              c += texture2D(tBloom, vUv).rgb * uBloom;
              c = toSRGB(aces(c));

              float luma = dot(c, vec3(0.299, 0.587, 0.114));
              c = mix(vec3(luma), c, 1.0 + uSaturation);
              c = 0.5 + (1.0 + uContrast) * (c - 0.5);
              c += uBrightness;

              float d = length((vUv - 0.5) * uVigAspect) * 2.0;
              c = mix(c, uVignetteColor, smoothstep(uVignetteFrom, uVignetteTo, d) * uVignette);

              c += (hash13(vec3(gl_FragCoord.xy, uSeed)) - 0.5) / 255.0;
              gl_FragColor = vec4(c * uFade, 1.0);
            }`,
          depthTest: false, depthWrite: false
        });

        post = {
          sceneRT, brightRT, blurA, blurB, quadMesh, quadCam, quadScene,
          brightMat, blurMat, compMat,
          setSize(w, h) {
            const dpr = renderer.getPixelRatio();
            const bw = Math.max(2, Math.round(w * dpr));
            const bh = Math.max(2, Math.round(h * dpr));
            sceneRT.setSize(bw, bh);
            const qw = Math.max(2, Math.round(bw / 4));
            const qh = Math.max(2, Math.round(bh / 4));
            brightRT.setSize(qw, qh);
            blurA.setSize(qw, qh);
            blurB.setSize(qw, qh);
            compMat.uniforms.uVigAspect.value.set(w / h >= 1 ? 1 : h / w, w / h >= 1 ? h / w : 1);
            blurMat.uniforms.uTexel.value.set(1 / qw, 1 / qh);
          },
          draw() {
            renderer.setRenderTarget(sceneRT);
            renderer.render(scene, camera);

            // bright pass (quarter res)
            quadMesh.material = brightMat;
            brightMat.uniforms.tDiffuse.value = sceneRT.texture;
            renderer.setRenderTarget(brightRT);
            renderer.render(quadScene, quadCam);

            // two separable blur passes
            let src = brightRT;
            for (let i = 0; i < 2; i++) {
              quadMesh.material = blurMat;
              blurMat.uniforms.tDiffuse.value = src.texture;
              blurMat.uniforms.uDir.value.set(1, 0);
              renderer.setRenderTarget(blurA);
              renderer.render(quadScene, quadCam);

              blurMat.uniforms.tDiffuse.value = blurA.texture;
              blurMat.uniforms.uDir.value.set(0, 1);
              renderer.setRenderTarget(blurB);
              renderer.render(quadScene, quadCam);
              src = blurB;
            }

            // composite to screen
            quadMesh.material = compMat;
            compMat.uniforms.tScene.value = sceneRT.texture;
            compMat.uniforms.tBloom.value = blurB.texture;
            compMat.uniforms.uSeed.value = (performance.now() * 0.06) % 1000;
            renderer.setRenderTarget(null);
            renderer.render(quadScene, quadCam);
          }
        };
        // the composite now owns tone mapping, so the scene renders linear HDR
        renderer.toneMapping = THREE.NoToneMapping;
      } catch (err) {
        console.warn('post pipeline unavailable', err);
        post = null;
      }
    }

    function drawFrame() {
      renderer.info.reset();
      if (post) post.draw();
      else renderer.render(scene, camera);
    }

    /* ─────────────────────────────────────────────────────────────────────
       11 · camera choreography
       ───────────────────────────────────────────────────────────────────── */
    const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

    const CAMERA_KEYS = [
      { t: 0.000, p: [15.6, 5.2, 61.0], l: [0.0, 4.5, 2.5], fov: 31 },
      { t: 0.075, p: [14.4, 4.8, 54.0], l: [0.0, 4.3, 1.5], fov: 32 },
      { t: 0.150, p: [12.8, 4.2, 46.0], l: [0.0, 4.0, 0.8], fov: 33 },
      { t: 0.225, p: [12.2, 3.8, 43.0], l: [0.0, 3.8, 0.2], fov: 36 },
      { t: 0.300, p: [10.4, 3.2, 36.0], l: [0.0, 3.5, 0.0], fov: 38 },
      { t: 0.355, p: [8.6, 2.7, 30.0], l: [0.2, 3.0, 1.0], fov: 40 },
      { t: 0.400, p: [6.2, 2.3, 24.0], l: [0.2, 2.6, 3.0], fov: 42 },
      { t: 0.440, p: [3.2, 1.86, 18.5], l: [0.0, 2.2, 5.0], fov: 45 },
      { t: 0.472, p: [1.0, 1.70, 13.5], l: [0.0, 2.05, 5.8], fov: 46 },
      { t: 0.492, p: [0.0, 1.66, 9.4], l: [0.0, 1.95, 5.6], fov: 46 },
      { t: 0.512, p: [0.0, 1.65, 6.5], l: [0.0, 1.90, 2.0], fov: 47 },
      { t: 0.534, p: [0.0, 1.66, 4.4], l: [-0.6, 1.95, -1.5], fov: 48 },
      { t: 0.565, p: [-0.2, 1.74, 2.3], l: [-2.4, 2.30, -3.0], fov: 50 },
      { t: 0.610, p: [-0.7, 1.86, 0.7], l: [-5.6, 2.80, -2.4], fov: 50 },
      { t: 0.660, p: [-1.5, 2.02, -0.7], l: [-8.4, 3.20, 0.4], fov: 48 },
      { t: 0.705, p: [-1.3, 1.96, -2.2], l: [-2.0, 2.40, -6.0], fov: 47 },
      { t: 0.745, p: [-0.2, 1.86, -3.8], l: [2.2, 2.00, -9.0], fov: 46 },
      { t: 0.780, p: [0.6, 1.80, -5.4], l: [3.4, 1.75, -12.0], fov: 45 },
      { t: 0.808, p: [1.2, 1.78, -7.0], l: [4.0, 1.55, -15.0], fov: 44 },
      { t: 0.830, p: [1.4, 1.95, -9.2], l: [3.0, 2.05, -18.0], fov: 43 },
      { t: 0.860, p: [1.4, 2.00, -9.8], l: [2.0, 2.10, -19.0], fov: 43 }
    ];

    const posCurve = new THREE.CatmullRomCurve3(CAMERA_KEYS.map(k => V3(k.p)), false, 'centripetal', 0.5);
    const tgtCurve = new THREE.CatmullRomCurve3(CAMERA_KEYS.map(k => V3(k.l)), false, 'centripetal', 0.5);
    posCurve.arcLengthDivisions = 800;
    tgtCurve.arcLengthDivisions = 800;

    const ORBIT_T0 = 0.860;
    const ORBIT = {
      cx: 0, cz: CZ,
      r0: Math.hypot(1.4, -9.6 - CZ),
      a0: Math.atan2(1.4, -9.6 - CZ),
      y0: 1.9, r1: 34, y1: 14, turns: 1.0
    };

    /** The curve passes exactly through every key at its own t. */
    function sampleCurve(curve, t, out) {
      const n = CAMERA_KEYS.length;
      if (t <= CAMERA_KEYS[0].t) return out.copy(curve.getPoint(0));
      if (t >= CAMERA_KEYS[n - 1].t) return out.copy(curve.getPoint(1));
      let i = 0;
      while (i < n - 2 && t > CAMERA_KEYS[i + 1].t) i++;
      const s = (t - CAMERA_KEYS[i].t) / (CAMERA_KEYS[i + 1].t - CAMERA_KEYS[i].t);
      return out.copy(curve.getPoint((i + s) / (n - 1)));
    }

    function fovAt(t) {
      const n = CAMERA_KEYS.length;
      if (t <= CAMERA_KEYS[0].t) return CAMERA_KEYS[0].fov;
      if (t >= CAMERA_KEYS[n - 1].t) return CAMERA_KEYS[n - 1].fov;
      let i = 0;
      while (i < n - 2 && t > CAMERA_KEYS[i + 1].t) i++;
      const s = smoothstep(0, 1, (t - CAMERA_KEYS[i].t) / (CAMERA_KEYS[i + 1].t - CAMERA_KEYS[i].t));
      return lerp(CAMERA_KEYS[i].fov, CAMERA_KEYS[i + 1].fov, s);
    }

    const tmpPos = new THREE.Vector3();
    const tmpTgt = new THREE.Vector3();
    const orbitTgt = new THREE.Vector3(0, 3.1, CZ);

    function cameraAt(t) {
      const tt = clamp(t);
      if (tt < ORBIT_T0) {
        sampleCurve(posCurve, tt, tmpPos);
        sampleCurve(tgtCurve, tt, tmpTgt);
        return fovAt(tt);
      }
      const s = clamp((tt - ORBIT_T0) / (1 - ORBIT_T0));
      const ang = ORBIT.a0 + s * ORBIT.turns * Math.PI * 2;
      const r = lerp(ORBIT.r0, ORBIT.r1, Math.pow(s, 0.55));
      const y = lerp(ORBIT.y0, ORBIT.y1, Math.pow(s, 0.85));
      tmpPos.set(ORBIT.cx + Math.sin(ang) * r, y, ORBIT.cz + Math.cos(ang) * r);

      sampleCurve(tgtCurve, ORBIT_T0, tmpTgt);
      orbitTgt.set(0, lerp(3.1, 2.2, smoothstep(0.35, 1, s)), CZ + 0.4);
      tmpTgt.lerp(orbitTgt, smoothstep(0, 0.16, s));
      return lerp(43, 37, smoothstep(0, 1, s));
    }

    /* ─────────────────────────────────────────────────────────────────────
       11 · scroll, overlays, loop
       ───────────────────────────────────────────────────────────────────── */
    let pTarget = 0, pSmooth = 0, lastApplied = -1, visible = true, started = false;
    let lookYaw = 0, lookPitch = 0, lookYawTarget = 0, lookPitchTarget = 0;
    let dragging = false, lastX = 0, lastY = 0, pointerX = 0, pointerY = 0;

    const hudBar = document.getElementById('hudBar');
    const hudPct = document.getElementById('hudPct');
    const hudStages = Array.from(document.querySelectorAll('#hudStages li'));
    const copyItems = Array.from(document.querySelectorAll('.copy__item')).map(el => ({
      el, in: parseFloat(el.dataset.in), out: parseFloat(el.dataset.out)
    }));
    const scrollHint = document.querySelector('.walk__scrollhint');
    const grade = document.querySelector('.walk__grade');
    const bloom = document.querySelector('.walk__bloom');
    const veil = document.querySelector('.walk__veil');

    const STAGE_EDGES = [0, 0.30, 0.56, 0.78, 0.885, 1.01];
    const STATIC_VIEWS = [0.0, 0.30, 0.44, 0.512, 0.66, 0.83, 0.93, 1.0];

    function readProgress() {
      const rect = section.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      pTarget = total <= 0 ? 0 : clamp(-rect.top / total);
    }

    function paintOverlays(p) {
      let stage = 0;
      for (let i = 0; i < STAGE_EDGES.length - 1; i++) if (p >= STAGE_EDGES[i]) stage = i;
      hudStages.forEach((li, i) => li.classList.toggle('is-active', i === stage));
      if (hudBar) hudBar.style.width = (p * 100).toFixed(2) + '%';
      if (hudPct) hudPct.textContent = String(Math.round(p * 100)).padStart(2, '0');
      if (scrollHint) scrollHint.classList.toggle('is-hidden', p > 0.015);

      for (const c of copyItems) {
        const f = Math.min(0.018, (c.out - c.in) * 0.25);
        const o = Math.min(smoothstep(c.in, c.in + f, p), 1 - smoothstep(c.out - f, c.out, p));
        c.el.style.opacity = o.toFixed(3);
        // the closing panel carries a real link: only let it catch the pointer
        // while it is actually readable, otherwise it blocks drag-look on the canvas
        if (c.el.classList.contains('copy__item--end')) c.el.style.pointerEvents = o > 0.4 ? 'auto' : 'none';
        if (!c.el.classList.contains('copy__item--center')) {
          c.el.style.transform = `translate3d(0,${((1 - o) * 14).toFixed(2)}px,0)`;
        }
      }

      const dark = smoothstep(0.478, 0.522, p) * (1 - smoothstep(0.545, 0.60, p));
      const warmUp = smoothstep(0.525, 0.60, p) * (1 - smoothstep(0.72, 0.80, p));
      if (veil) veil.style.opacity = (0.09 + dark * 0.30).toFixed(3);
      if (grade) grade.style.opacity = (0.82 + dark * 0.18 - warmUp * 0.16).toFixed(3);
      if (bloom) bloom.style.opacity = (warmUp * 0.42 + smoothstep(0.86, 0.98, p) * 0.14).toFixed(3);

      if (dust) dust.uniforms.uOpacity.value = smoothstep(0.52, 0.62, p) * (1 - smoothstep(0.79, 0.85, p)) * (MOBILE ? 0.5 : 0.62);
    }

    let exposure = 0.82;

    function applyCamera(t, dt) {
      const fov = cameraAt(t);
      camera.position.copy(tmpPos);
      camera.up.set(0, 1, 0);
      camera.lookAt(tmpTgt);
      if (!REDUCED) { camera.rotateY(lookYaw); camera.rotateX(lookPitch); }

      const portrait = camera.aspect < 1.1 ? lerp(1, 1.46, clamp((1.1 - camera.aspect) / 0.7)) : 1;
      const f = fov * portrait;
      if (Math.abs(camera.fov - f) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); }

      const dark = smoothstep(0.478, 0.522, t) * (1 - smoothstep(0.545, 0.60, t));
      const inside = smoothstep(0.53, 0.62, t) * (1 - smoothstep(0.78, 0.85, t));
      const target = 0.82 - dark * 0.22 + inside * 0.30;
      exposure += (target - exposure) * Math.min(1, dt * 6);
      renderer.toneMappingExposure = exposure;
      if (post) post.compMat.uniforms.uExposure.value = exposure;
    }

    function resize() {
      const w = section.clientWidth || window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (post) post.setSize(w, h);
    }

    canvas.addEventListener('pointerdown', (e) => {
      if (REDUCED) return;
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      canvas.classList.add('is-dragging');
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
    });
    window.addEventListener('pointermove', (e) => {
      pointerX = (e.clientX / window.innerWidth) * 2 - 1;
      pointerY = (e.clientY / window.innerHeight) * 2 - 1;
      if (!dragging) return;
      lookYawTarget = clamp(lookYawTarget - (e.clientX - lastX) * 0.0016, -0.13, 0.13);
      lookPitchTarget = clamp(lookPitchTarget - (e.clientY - lastY) * 0.0013, -0.09, 0.09);
      lastX = e.clientX; lastY = e.clientY;
    }, { passive: true });
    const release = (e) => {
      dragging = false;
      canvas.classList.remove('is-dragging');
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    window.addEventListener('scroll', readProgress, { passive: true });
    window.addEventListener('resize', () => { resize(); readProgress(); }, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(section);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { rootMargin: '160px' }).observe(section);
    }

    const clock = new THREE.Clock();
    let elapsed = 0;
    let paused = false;

    function tick() {
      requestAnimationFrame(tick);
      const dt = Math.min(0.1, clock.getDelta());
      if (paused || !visible) return;
      elapsed += dt;

      if (REDUCED) {
        let best = STATIC_VIEWS[0];
        for (const v of STATIC_VIEWS) if (Math.abs(v - pTarget) < Math.abs(best - pTarget)) best = v;
        pSmooth = best;
        lookYaw = lookPitch = 0;
      } else {
        pSmooth += (pTarget - pSmooth) * (1 - Math.exp(-dt * 11));
        const px = dragging ? 0 : pointerX * 0.012;
        const py = dragging ? 0 : pointerY * 0.008;
        lookYaw += ((lookYawTarget + px) - lookYaw) * Math.min(1, dt * 4.5);
        lookPitch += ((lookPitchTarget + py) - lookPitch) * Math.min(1, dt * 4.5);
        if (!dragging) { lookYawTarget *= 0.995; lookPitchTarget *= 0.995; }
      }

      if (Math.abs(pSmooth - lastApplied) > 0.00015 || !started) {
        applyCamera(pSmooth, dt);
        paintOverlays(pSmooth);
        lastApplied = pSmooth;
      }

      if (!REDUCED) {
        waterNormalTex.offset.set(elapsed * 0.018, elapsed * 0.011);
        dust.uniforms.uTime.value = elapsed;
      }

      drawFrame();

      if (!started) {
        started = true;
        // the world never moves: bake the shadow map once, then stop updating
        renderer.shadowMap.autoUpdate = false;
        canvas.classList.add('is-ready');
      }
    }

    resize();
    readProgress();
    pSmooth = pTarget;
    applyCamera(pSmooth, 1);
    paintOverlays(pSmooth);
    clock.start();
    tick();

    window.__shade = {
      get progress() { return pSmooth; },
      set progress(v) {
        pSmooth = clamp(v); pTarget = pSmooth;
        applyCamera(pSmooth, 1); paintOverlays(pSmooth); lastApplied = pSmooth;
        if (paused) drawFrame();
      },
      pause() { paused = true; },
      resume() { paused = false; clock.getDelta(); },
      render() { drawFrame(); },
      camera, scene, renderer, section, sun, waterMat, dust, THREE, materials: M, build: BUILD,
      get stats() {
        return {
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures
        };
      }
    };

    // embedded in a host page: only this module's own failures collapse the
    // section — an unrelated error elsewhere on the page must not hide it
    window.addEventListener('error', (e) => {
      const src = (e && e.filename) || '';
      if (src.indexOf('scene.js') !== -1) fail(e.error || e.message);
    });
    window.addEventListener('unhandledrejection', (e) => {
      const r = e && e.reason;
      const src = String((r && (r.stack || r.message)) || r || '');
      if (src.indexOf('scene.js') !== -1) fail(r);
    });
  } catch (err) {
    fail(err);
  }
}
