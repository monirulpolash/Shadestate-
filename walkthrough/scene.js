/* ═══════════════════════════════════════════════════════════════════════════
   SHADESTATE · CASA DA LUZ
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
   · water is a Fresnel shader over a half-res planar mirror of house and sky
   · grass (62k blades), foliage cards, bracts, slats, pebbles are instanced
   · trunks are swept, tapered, root-flared tubes with procedural bark
   · dust motes are one additive Points pass with a custom shader
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

/**
 * Travertine ashlar for the villa: five courses per tile, staggered joints,
 * each block its own tone with the horizontal sediment bands and open pores of
 * quarried limestone. Joints are real recesses in the height map, so the sun
 * draws a line along every course.
 */
function makeAshlar(base = [233, 225, 210], courses = 5) {
  const S = 1024, ch = S / courses;
  const c = cv(S), g = c.getContext('2d');
  const hc = cv(S), hg = hc.getContext('2d');
  const rc = cv(256), rg = rc.getContext('2d');
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#787878'; hg.fillRect(0, 0, S, S);
  rg.fillStyle = '#d8d8d8'; rg.fillRect(0, 0, 256, 256);

  for (let r = 0; r < courses; r++) {
    const y0 = r * ch;
    let x = r % 2 ? -rr(40, 140) : 0;
    while (x < S) {
      const len = rr(S * 0.20, S * 0.40);
      const tone = rr(0.975, 1.018);
      const R = Math.round(base[0] * tone), G = Math.round(base[1] * tone), B = Math.round(base[2] * tone);

      g.save();
      g.beginPath(); g.rect(x, y0, len, ch); g.clip();
      g.fillStyle = `rgb(${R},${G},${B})`; g.fillRect(x, y0, len, ch);
      // sediment bands
      for (let i = 0; i < 16; i++) {
        const by = y0 + rr(0, ch), bh = rr(1, 7), dark = rnd() > 0.45;
        g.fillStyle = dark ? `rgba(186,172,148,${rr(0.05, 0.16).toFixed(2)})` : `rgba(255,251,242,${rr(0.05, 0.15).toFixed(2)})`;
        g.fillRect(x, by, len, bh);
      }
      // open pores
      for (let i = 0; i < 120; i++) {
        const px = x + rr(0, len), py = y0 + rr(0, ch);
        g.fillStyle = `rgba(122,108,88,${rr(0.10, 0.34).toFixed(2)})`;
        g.beginPath(); g.ellipse(px, py, rr(0.8, 3.4), rr(0.6, 1.9), 0, 0, 7); g.fill();
      }
      // a few hairline veins
      for (let i = 0; i < 3; i++) {
        g.strokeStyle = `rgba(150,136,114,${rr(0.06, 0.16).toFixed(2)})`;
        g.lineWidth = rr(0.6, 1.4);
        g.beginPath();
        let vx = x + rr(0, len), vy = y0;
        g.moveTo(vx, vy);
        while (vy < y0 + ch) { vy += rr(6, 20); vx += rr(-6, 6); g.lineTo(vx, vy); }
        g.stroke();
      }
      g.restore();

      // height: face slightly domed, pores recessed
      const grd = hg.createLinearGradient(x, y0, x, y0 + ch);
      grd.addColorStop(0, 'rgba(118,118,118,.55)');
      grd.addColorStop(0.5, 'rgba(150,150,150,.35)');
      grd.addColorStop(1, 'rgba(124,124,124,.55)');
      hg.fillStyle = grd; hg.fillRect(x, y0, len, ch);

      // joint
      g.fillStyle = 'rgba(166,155,132,.88)'; g.fillRect(x + len - 2.2, y0, 2.4, ch);
      g.fillStyle = 'rgba(255,252,244,.45)'; g.fillRect(x + len + 0.3, y0, 1.1, ch);
      hg.fillStyle = 'rgba(40,40,40,.95)'; hg.fillRect(x + len - 2.4, y0, 2.6, ch);
      x += len;
    }
    // bed joint
    g.fillStyle = 'rgba(166,155,132,.9)'; g.fillRect(0, y0 + ch - 2.2, S, 2.6);
    g.fillStyle = 'rgba(255,252,244,.45)'; g.fillRect(0, y0 + ch + 0.3, S, 1.1);
    hg.fillStyle = 'rgba(40,40,40,.95)'; hg.fillRect(0, y0 + ch - 2.4, S, 2.8);
  }

  // whole-surface dust and weather
  for (let i = 0; i < 20000; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,250,.05)' : 'rgba(146,132,110,.05)';
    g.fillRect(rnd() * S, rnd() * S, 1.4, 1.4);
  }
  for (let i = 0; i < 60; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = rr(6, 34), v = rnd() > 0.5 ? 240 : 210;
    const grd = rg.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${v},${v},${v},.4)`);
    grd.addColorStop(1, 'rgba(216,216,216,0)');
    rg.fillStyle = grd; rg.beginPath(); rg.arc(x, y, r, 0, 7); rg.fill();
  }

  return { map: c, normal: normalFromHeight(hc, 1.5), rough: rc };
}

/** Pale green-grey ceramic tiles for the pool basin. */
function makePoolTile() {
  const S = 512, n = 8, t = S / n;
  const c = cv(S), g = c.getContext('2d');
  const hc = cv(S), hg = hc.getContext('2d');
  g.fillStyle = '#8fa79c'; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#9a9a9a'; hg.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const tone = rr(0.9, 1.06);
      const x = i * t, y = j * t;
      g.fillStyle = `rgb(${Math.round(150 * tone)},${Math.round(172 * tone)},${Math.round(162 * tone)})`;
      g.fillRect(x + 1.4, y + 1.4, t - 2.8, t - 2.8);
      for (let k = 0; k < 60; k++) {
        g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(56,74,68,.05)';
        g.fillRect(x + rr(2, t - 3), y + rr(2, t - 3), rr(1, 4), rr(1, 4));
      }
      hg.fillStyle = '#b4b4b4'; hg.fillRect(x + 1.4, y + 1.4, t - 2.8, t - 2.8);
    }
  }
  g.strokeStyle = 'rgba(104,124,118,.55)'; g.lineWidth = 1.2;
  for (let i = 0; i <= n; i++) {
    g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, S); g.stroke();
    g.beginPath(); g.moveTo(0, i * t); g.lineTo(S, i * t); g.stroke();
    hg.strokeStyle = 'rgba(58,58,58,.9)'; hg.lineWidth = 2.4;
    hg.beginPath(); hg.moveTo(i * t, 0); hg.lineTo(i * t, S); hg.stroke();
    hg.beginPath(); hg.moveTo(0, i * t); hg.lineTo(S, i * t); hg.stroke();
  }
  return { map: c, normal: normalFromHeight(hc, 0.9) };
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
  g.fillStyle = '#9aa268'; g.fillRect(0, 0, S, S);
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

  // soft body inside the cluster, so thin card overlaps still read as canopy
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2, rad = Math.pow(rnd(), 0.45) * S * 0.4;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    const r = rr(34, 82), tone = rr(0.55, 1.0);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${Math.round(80 * tone)},${Math.round(94 * tone)},${Math.round(56 * tone)},${rr(0.3, 0.5).toFixed(2)})`);
    grd.addColorStop(1, 'rgba(80,94,56,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }

  // leaves on a disc, densest in the middle, thinning to a ragged rim
  for (let i = 0; i < 1900; i++) {
    const a = rnd() * Math.PI * 2;
    const u = Math.pow(rnd(), 0.42);
    const rad = u * S * 0.47;
    if (u > 0.9 && rnd() < 0.55) continue;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad * 0.95;
    const len = rr(11, 30), wid = rr(2.4, 5.4), tone = rr(0.56, 1.34);
    const R = Math.round(104 * tone), G = Math.round(118 * tone), B = Math.round(76 * tone);
    g.save(); g.translate(x, y); g.rotate(a + rr(-1.2, 1.2));
    const grd = g.createLinearGradient(-len / 2, 0, len / 2, 0);
    grd.addColorStop(0, `rgba(${Math.round(R * 0.78)},${Math.round(G * 0.8)},${Math.round(B * 0.76)},1)`);
    grd.addColorStop(0.5, `rgba(${Math.min(255, R + 38)},${Math.min(255, G + 36)},${Math.min(255, B + 18)},1)`);
    grd.addColorStop(1, `rgba(${Math.round(R * 0.68)},${Math.round(G * 0.72)},${Math.round(B * 0.68)},1)`);
    g.fillStyle = grd;
    g.beginPath(); g.ellipse(0, 0, len / 2, wid, 0, 0, 7); g.fill();
    g.restore();
  }
  return c;
}

function makeBarkTextures() {
  const S = 512, c = cv(S), g = c.getContext('2d');
  const hc = cv(S), hg = hc.getContext('2d');
  const rc = cv(256), rg = rc.getContext('2d');

  g.fillStyle = '#8b8171'; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#8c8c8c'; hg.fillRect(0, 0, S, S);
  rg.fillStyle = '#e4e4e4'; rg.fillRect(0, 0, 256, 256);

  const wrapX = (fn) => { fn(0); fn(-S); };

  // broad tonal plates, so the silhouette is not one flat colour
  for (let i = 0; i < 70; i++) {
    const x = rnd() * S, w = rr(10, 60), tone = rr(0.78, 1.12), a = rr(0.18, 0.5);
    wrapX((off) => {
      g.fillStyle = `rgba(${Math.round(126 * tone)},${Math.round(116 * tone)},${Math.round(98 * tone)},${a.toFixed(2)})`;
      g.fillRect(x + off, 0, w, S);
    });
  }

  // deep fissures
  for (let i = 0; i < 120; i++) {
    const x0 = rnd() * S, w = rr(1.2, 6.5), drift = rr(3, 14), alpha = rr(0.3, 0.8);
    const seed = rnd() * 20;
    wrapX((off) => {
      const path = [];
      for (let y = 0; y <= S; y += 6) {
        path.push([x0 + off + Math.sin(y * 0.028 + seed) * drift * 0.55 + Math.sin(y * 0.11 + seed * 3) * 2.2, y]);
      }
      g.beginPath();
      path.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokeStyle = `rgba(46,40,32,${alpha.toFixed(2)})`;
      g.lineWidth = w; g.lineCap = 'round'; g.stroke();

      hg.beginPath();
      path.forEach(([x, y], k) => (k ? hg.lineTo(x, y) : hg.moveTo(x, y)));
      hg.strokeStyle = `rgba(38,38,38,${(alpha * 1.05).toFixed(2)})`;
      hg.lineWidth = w * 1.15; hg.lineCap = 'round'; hg.stroke();

      // a lit lip along one side of the groove
      g.beginPath();
      path.forEach(([x, y], k) => (k ? g.lineTo(x + w * 0.75, y) : g.moveTo(x + w * 0.75, y)));
      g.strokeStyle = 'rgba(186,174,150,.16)'; g.lineWidth = 1.1; g.stroke();
    });
  }

  // short cross-checks between fissures
  for (let i = 0; i < 190; i++) {
    const x = rnd() * S, y = rnd() * S, l = rr(3, 16), a = rr(-0.5, 0.5);
    g.strokeStyle = `rgba(52,45,36,${rr(0.15, 0.5).toFixed(2)})`;
    g.lineWidth = rr(0.7, 2);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.sin(a) * l, y + Math.cos(a) * l); g.stroke();
  }

  // grain and lichen
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * S, y = rnd() * S;
    g.fillStyle = rnd() > 0.55 ? 'rgba(196,186,164,.11)' : 'rgba(44,38,30,.11)';
    g.fillRect(x, y, rr(0.8, 2.2), rr(2, 9));
  }
  for (let i = 0; i < 60; i++) {
    const x = rnd() * S, y = rnd() * S, r = rr(6, 26);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(176,182,146,${rr(0.05, 0.16).toFixed(2)})`);
    grd.addColorStop(1, 'rgba(176,182,146,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * 256, y = rnd() * 256, v = rnd() > 0.5 ? 250 : 200;
    rg.fillStyle = `rgba(${v},${v},${v},.35)`;
    rg.fillRect(x, y, rr(1, 6), rr(2, 14));
  }

  return { map: c, normal: normalFromHeight(hc, 1.5), rough: rc };
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
    canvas, antialias: !MOBILE && !/[?&]aa=0/.test(location.search), powerPreference: 'high-performance', alpha: false, stencil: false,
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
    const SM = MOBILE ? 1024 : 1536;
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

    scene.add(new THREE.HemisphereLight(0xb2c8de, 0x7d6a4e, MOBILE ? 0.17 : 0.23));

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

    /* ── wind ──────────────────────────────────────────────────────────────
       Foliage sways in world space, after the instance matrix, so a card does
       not get flung around by its own random rotation. One shared uniform.  */
    const WIND = { time: { value: 0 } };
    let grassUniforms = null;   // assigned by the grass block

    function windify(mat, { amp = 0.05, freq = 1.0, height = 2.6, base = 0.4 } = {}) {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uWindTime = WIND.time;
        shader.uniforms.uWindAmp = { value: amp };
        shader.uniforms.uWindFreq = { value: freq };
        shader.uniforms.uWindHeight = { value: height };
        shader.uniforms.uWindBase = { value: base };
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', `#include <common>
            uniform float uWindTime; uniform float uWindAmp; uniform float uWindFreq;
            uniform float uWindHeight; uniform float uWindBase;`)
          .replace('#include <project_vertex>', `
            vec4 mvPosition = vec4( transformed, 1.0 );
            #ifdef USE_INSTANCING
              mvPosition = instanceMatrix * mvPosition;
            #endif
            vec4 wWind = modelMatrix * mvPosition;
            float hgt = clamp((wWind.y - uWindBase) / uWindHeight, 0.0, 1.0);
            float ph = wWind.x * 0.52 + wWind.z * 0.39;
            float gust = 0.55 + 0.45 * sin(uWindTime * 0.31 + ph * 0.07);
            float sw = uWindAmp * hgt * hgt * gust;
            wWind.x += sin(uWindTime * 1.35 * uWindFreq + ph * 1.6) * sw;
            wWind.z += cos(uWindTime * 1.05 * uWindFreq + ph * 1.25) * sw * 0.72;
            wWind.y += sin(uWindTime * 1.9 * uWindFreq + ph * 2.1) * sw * 0.2;
            mvPosition = viewMatrix * wWind;
            gl_Position = projectionMatrix * mvPosition;
          `);
      };
      mat.customProgramCacheKey = () => `wind${amp}${freq}${height}${base}`;
      return mat;
    }

    /** Moving caustics for anything under the water line. */
    function caustic(mat) {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uCausticTime = WIND.time;
        shader.vertexShader = shader.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vCPos;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\n vCPos = (modelMatrix * vec4(transformed,1.0)).xyz;');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>
            varying vec3 vCPos;
            uniform float uCausticTime;`)
          .replace('#include <map_fragment>', `
            #include <map_fragment>
            float ct = uCausticTime;
            vec2 cp = vCPos.xz * 2.3 + vCPos.y * 1.7;
            float c1 = sin(cp.x + ct * 0.7 + sin(cp.y * 1.3 - ct * 0.5) * 1.7);
            float c2 = sin(cp.y * 1.17 - ct * 0.55 + sin(cp.x * 0.9 + ct * 0.4) * 1.5);
            float caus = pow(abs(c1 * c2), 2.4) * 0.7;
            caus *= smoothstep(-0.24, -0.9, vCPos.y) * 0.9 + 0.06;
            diffuseColor.rgb += vec3(0.30, 0.46, 0.40) * caus;
          `);
      };
      mat.customProgramCacheKey = () => 'caustic';
      return mat;
    }

    /* ── materials ─────────────────────────────────────────────────────── */
    const stoneA = makeAshlar([221, 211, 194], 5);
    const stoneB = makeStone('#ded4c1', '118,104,86');
    const poolTile = makePoolTile();
    const oak = makeOakFloor();
    const conc = makeConcrete();
    const grav = makeGravel();
    const mead = makeMeadow();
    const bark = makeBarkTextures();
    const linenA = makeLinen([228, 220, 205]);
    const linenB = makeLinen([118, 110, 98]);

    const M = {
      stone: weather(new THREE.MeshStandardMaterial({
        map: tex(stoneA.map, { srgb: true }),
        normalMap: tex(stoneA.normal),
        roughnessMap: tex(stoneA.rough),
        roughness: 1.0, metalness: 0.0,
        normalScale: new THREE.Vector2(1.25, 1.25),
        envMapIntensity: 0.42
      }), { grime: 0.09, streak: 0.15, base: 0.18, scale: 0.30 }),
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
        color: 0x5d7370, metalness: 0.0, roughness: 0.035,
        transparent: true, opacity: 0.40,
        clearcoat: 1.0, clearcoatRoughness: 0.03,
        envMapIntensity: 2.4, side: THREE.DoubleSide, depthWrite: false
      }),
      gravel: new THREE.MeshStandardMaterial({
        map: tex(grav.map, { srgb: true }),
        normalMap: tex(grav.normal),
        roughness: 1.0, metalness: 0.0,
        normalScale: new THREE.Vector2(1.1, 1.1),
        envMapIntensity: 0.55
      }),
      meadow: new THREE.MeshStandardMaterial({
        color: 0xf2f4e2,
        map: tex(mead.map, { srgb: true }),
        normalMap: tex(mead.normal),
        roughness: 1.0, metalness: 0.0, envMapIntensity: 0.7,
        normalScale: new THREE.Vector2(0.6, 0.6)
      }),
      bark: new THREE.MeshStandardMaterial({
        map: tex(bark.map, { srgb: true }),
        normalMap: tex(bark.normal),
        roughnessMap: tex(bark.rough),
        normalScale: new THREE.Vector2(1.6, 1.6),
        roughness: 1.0, metalness: 0.0, envMapIntensity: 0.4,
        side: THREE.DoubleSide
      }),
      linenA: new THREE.MeshStandardMaterial({ map: tex(linenA, { srgb: true }), roughness: 0.95, metalness: 0.0, envMapIntensity: 0.45 }),
      linenB: new THREE.MeshStandardMaterial({ map: tex(linenB, { srgb: true }), roughness: 0.95, metalness: 0.0, envMapIntensity: 0.4 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x24211d, roughness: 0.7, metalness: 0.1, envMapIntensity: 0.5 }),
      poolWall: caustic(new THREE.MeshStandardMaterial({
        map: tex(poolTile.map, { srgb: true }),
        normalMap: tex(poolTile.normal),
        normalScale: new THREE.Vector2(0.7, 0.7),
        color: 0x4f6d63, roughness: 0.55, metalness: 0.0, envMapIntensity: 0.45
      })),
      leaf: windify(new THREE.MeshStandardMaterial({
        map: tex(makeLeafCluster(), { srgb: true }),
        alphaTest: 0.34, side: THREE.DoubleSide, color: 0xdfe4ca,
        roughness: 0.9, metalness: 0.0, envMapIntensity: 0.5
      }), { amp: 0.075, freq: 1.2, height: 3.2 }),
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

    const BUCKET_MESH = new Map();
    function flush() {
      for (const b of BUCKETS.values()) {
        const mesh = new THREE.Mesh(mergeGeos(b.geos), b.mat);
        mesh.castShadow = b.cast;
        mesh.receiveShadow = b.receive;
        mesh.renderOrder = b.order;
        world.add(mesh);
        BUCKET_MESH.set(b.mat, mesh);
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

    // gravel drive, a ribbon following the same spline the camera flies
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

    // loose pebbles on the drive shoulders, instanced, no shadow cost
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
      addBox(w, 0.24, d, px, -1.82, pz, M.poolWall, { cast: false, uv: 0.55 });
      addBox(w, 1.62, 0.2, px, -0.95, POOL.z1 - 0.1, M.poolWall, { cast: false, uv: 0.55 });
      addBox(w, 1.62, 0.2, px, -0.95, POOL.z0 + 0.1, M.poolWall, { cast: false, uv: 0.55 });
      addBox(0.2, 1.62, d, POOL.x0 + 0.1, -0.95, pz, M.poolWall, { cast: false, uv: 0.55 });
      addBox(0.2, 1.62, d, POOL.x1 - 0.1, -0.95, pz, M.poolWall, { cast: false, uv: 0.55 });
    }
    addBox(POOL.x1 - POOL.x0 + pw * 2, 0.28, pw, (POOL.x0 + POOL.x1) / 2, -0.34, POOL.z1 + pw / 2, M.stonePale, { uv: 0.42 });
    addBox(POOL.x1 - POOL.x0 + pw * 2, 0.28, pw, (POOL.x0 + POOL.x1) / 2, -0.34, POOL.z0 - pw / 2, M.stonePale, { uv: 0.42 });
    addBox(pw, 0.28, POOL.z1 - POOL.z0, POOL.x0 - pw / 2, -0.34, (POOL.z0 + POOL.z1) / 2, M.stonePale, { uv: 0.42 });
    addBox(pw, 0.28, POOL.z1 - POOL.z0, POOL.x1 + pw / 2, -0.34, (POOL.z0 + POOL.z1) / 2, M.stonePale, { uv: 0.42 });

    /* ── pool basin: tilework, a bench in the deep end, a waterline band ── */
    const WATER_Y = -0.255;
    const pzMid = (POOL.z0 + POOL.z1) / 2;
    // underwater bench along the far wall
    addBox(POOL.x1 - POOL.x0 - 1.2, 0.42, 0.9, (POOL.x0 + POOL.x1) / 2, -1.4, POOL.z0 + 0.75, M.poolWall, { cast: false, uv: 0.55 });
    // steps into the shallow end
    for (let i = 0; i < 3; i++) {
      addBox(2.4, 0.3, 0.34, POOL.x0 + 1.5, -1.62 + i * 0.3 + 0.15, POOL.z1 - 0.6 - i * 0.34, M.poolWall, { cast: false, uv: 0.55 });
    }
    // waterline band, just above the surface, in a darker tile
    {
      const bandMat = new THREE.MeshStandardMaterial({ color: 0x1b3330, roughness: 0.2, metalness: 0.05, envMapIntensity: 0.7 });
      const t = 0.06, y = WATER_Y + 0.07;
      addBox(POOL.x1 - POOL.x0, 0.14, t, (POOL.x0 + POOL.x1) / 2, y, POOL.z1 - t / 2, bandMat, { cast: false });
      addBox(POOL.x1 - POOL.x0, 0.14, t, (POOL.x0 + POOL.x1) / 2, y, POOL.z0 + t / 2, bandMat, { cast: false });
      addBox(t, 0.14, POOL.z1 - POOL.z0, POOL.x0 + t / 2, y, pzMid, bandMat, { cast: false });
      addBox(t, 0.14, POOL.z1 - POOL.z0, POOL.x1 - t / 2, y, pzMid, bandMat, { cast: false });
    }

    /* ── water ──────────────────────────────────────────────────────────────
       A physical-ish water shader: two scrolling wave normal sets, Fresnel,
       a planar mirror of the house and sky (rendered from below the surface),
       sun glitter and depth tint. Everything below the surface shows through,
       tinted, because the surface is blended rather than opaque.
       ───────────────────────────────────────────────────────────────────── */
    const waterNormalTex = tex(makeWaterNormal(512));

    const waterUniforms = {
      tNormal: { value: waterNormalTex },
      tReflect: { value: null },
      uTexMatrix: { value: new THREE.Matrix4() },
      uReflectTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
      uHasReflect: { value: 0 },
      uTime: { value: 0 },
      uSunDir: { value: SUN_DIR.clone() },
      uSunCol: { value: new THREE.Color(1.7, 1.12, 0.72) },
      uDeep: { value: new THREE.Color(0.005, 0.026, 0.030) },
      uShallow: { value: new THREE.Color(0.030, 0.110, 0.112) },
      uSkyCol: { value: new THREE.Color(0.42, 0.52, 0.66) },
      uFogCol: { value: new THREE.Color(0.72, 0.66, 0.55) },
      uFogDensity: { value: 0.0032 }
    };

    const waterMat = new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      vertexShader: /* glsl */`
        varying vec2 vScreen;
        varying vec3 vWorld;
        varying vec3 vToEye;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          vec4 mv = viewMatrix * wp;
          vToEye = -mv.xyz;
          gl_Position = projectionMatrix * mv;
          vScreen = gl_Position.xy / gl_Position.w * 0.5 + 0.5;
        }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tNormal;
        uniform sampler2D tReflect;
        uniform float uHasReflect;
        uniform vec2 uReflectTexel;
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uSunCol;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uSkyCol;
        uniform vec3 uFogCol;
        uniform float uFogDensity;
        varying vec2 vScreen;
        varying vec3 vWorld;
        varying vec3 vToEye;

        void main() {
          vec2 uv = vWorld.xz;

          // two wave trains at different scales, drifting apart
          vec3 a = texture2D(tNormal, uv * 0.075 + vec2(uTime * 0.011, uTime * 0.006)).rgb * 2.0 - 1.0;
          vec3 b = texture2D(tNormal, uv * 0.028 - vec2(uTime * 0.005, -uTime * 0.008)).rgb * 2.0 - 1.0;
          vec3 c = texture2D(tNormal, uv * 0.21 + vec2(-uTime * 0.021, uTime * 0.017)).rgb * 2.0 - 1.0;
          vec2 slope = a.xy * 0.55 + b.xy * 0.62 + c.xy * 0.16;

          vec3 V = normalize(vToEye);
          vec3 N = normalize(vec3(slope.x * 0.32, 1.0, slope.y * 0.32));

          float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);

          vec3 refl;
          if (uHasReflect > 0.5) {
            vec2 ruv = vScreen + N.xz * 0.085;
            refl = texture2D(tReflect, clamp(ruv, vec2(0.002), vec2(0.998))).rgb;
          } else {
            vec3 R = reflect(-V, N);
            refl = mix(uSkyCol, uFogCol, smoothstep(-0.1, 0.55, R.y));
          }

          // body: deep teal, lighter where the sun rakes through
          vec3 body = mix(uDeep, uShallow, 0.28 + 0.42 * clamp(dot(N, uSunDir), 0.0, 1.0));
          refl *= vec3(0.84, 0.93, 0.97);
          vec3 col = mix(body, refl, clamp(fres * 1.25, 0.0, 0.95));

          // sun glitter
          vec3 H = normalize(uSunDir + V);
          float spec = pow(max(dot(N, H), 0.0), 620.0);
          col += uSunCol * spec * 2.6;
          float sparkle = pow(max(dot(N, H), 0.0), 90.0) * pow(max(c.x, 0.0), 2.0);
          col += uSunCol * sparkle * 0.5;

          float dist = length(vToEye);
          float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
          col = mix(col, uFogCol, clamp(fog, 0.0, 1.0));

          float alpha = mix(0.74, 0.99, clamp(fres * 1.25, 0.0, 1.0));
          gl_FragColor = vec4(col, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`
    });

    const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(POOL.x1 - POOL.x0, POOL.z1 - POOL.z0), waterMat);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.set((POOL.x0 + POOL.x1) / 2, WATER_Y, pzMid);
    waterMesh.renderOrder = 2;
    waterMesh.layers.set(1);            // mirrored camera does not draw the water
    world.add(waterMesh);

    // the pool sits in layer 1 as well, so the mirror pass can skip it
    camera.layers.enable(1);

    // planar reflection target, half res, desktop only
    let reflRT = null;
    const reflCam = new THREE.PerspectiveCamera();
    const reflTextureMatrix = new THREE.Matrix4();
    const _rw = { x: 2, y: 2 };

    if (!MOBILE) {
      reflRT = new THREE.WebGLRenderTarget(2, 2, {
        type: THREE.HalfFloatType, minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false
      });
      reflRT.texture.colorSpace = THREE.NoColorSpace;
      waterUniforms.tReflect.value = reflRT.texture;
      waterUniforms.uHasReflect.value = 1;
      waterUniforms.uTexMatrix.value = reflTextureMatrix;
    }

    const waterBox = new THREE.Box3(
      new THREE.Vector3(POOL.x0, WATER_Y - 1.8, POOL.z0),
      new THREE.Vector3(POOL.x1, WATER_Y + 3.2, POOL.z1)
    );
    const _frustum = new THREE.Frustum();
    const _projScreen = new THREE.Matrix4();
    const _rv1 = new THREE.Vector3(), _rv2 = new THREE.Vector3(), _rv3 = new THREE.Vector3();
    const _rot = new THREE.Matrix4();
    const WATER_NORMAL = new THREE.Vector3(0, 1, 0);
    const WATER_ORIGIN = new THREE.Vector3(0, WATER_Y, 0);

    const _corner = new THREE.Vector3();
    const POOL_CENTRE = new THREE.Vector3((POOL.x0 + POOL.x1) / 2, WATER_Y, (POOL.z0 + POOL.z1) / 2);
    function poolOnScreen() {
      // project the pool's eight corners; skip the mirror pass when the water
      // is off frame, too far to read, or the eye is not above it
      if (camera.position.y < WATER_Y + 0.15) return false;
      if (camera.position.distanceTo(POOL_CENTRE) > 52) return false;
      let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, anyFront = false;
      for (let i = 0; i < 8; i++) {
        _corner.set(i & 1 ? waterBox.max.x : waterBox.min.x,
                    i & 2 ? waterBox.max.y : waterBox.min.y,
                    i & 4 ? waterBox.max.z : waterBox.min.z);
        _corner.applyMatrix4(camera.matrixWorldInverse);
        if (_corner.z > -0.2) continue;
        anyFront = true;
        _corner.applyMatrix4(camera.projectionMatrix);
        minX = Math.min(minX, _corner.x); maxX = Math.max(maxX, _corner.x);
        minY = Math.min(minY, _corner.y); maxY = Math.max(maxY, _corner.y);
      }
      if (!anyFront) return false;
      if (maxX < -1 || minX > 1 || maxY < -1 || minY > 1) return false;
      const area = ((Math.min(1, maxX) - Math.max(-1, minX)) * (Math.min(1, maxY) - Math.max(-1, minY))) / 4;
      return area > 0.012;
    }

    function renderReflection() {
      if (!reflRT) return false;
      // only when the pool is actually in frame
      _projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      _frustum.setFromProjectionMatrix(_projScreen);
      if (!_frustum.intersectsBox(waterBox) || !poolOnScreen()) {
        waterUniforms.uHasReflect.value = 0;
        return false;
      }

      camera.getWorldPosition(_rv1);
      const view = _rv2.subVectors(WATER_ORIGIN, _rv1);
      if (view.dot(WATER_NORMAL) > 0) { waterUniforms.uHasReflect.value = 0; return false; }
      view.reflect(WATER_NORMAL).negate().add(WATER_ORIGIN);

      _rot.extractRotation(camera.matrixWorld);
      const lookAt = _rv3.set(0, 0, -1).applyMatrix4(_rot).add(_rv1);
      const target = new THREE.Vector3().subVectors(WATER_ORIGIN, lookAt);
      target.reflect(WATER_NORMAL).negate().add(WATER_ORIGIN);

      reflCam.position.copy(view);
      reflCam.up.set(0, 1, 0).applyMatrix4(_rot).reflect(WATER_NORMAL);
      reflCam.lookAt(target);
      reflCam.near = camera.near;
      reflCam.far = camera.far;
      reflCam.updateMatrixWorld();
      reflCam.projectionMatrix.copy(camera.projectionMatrix);

      reflTextureMatrix.set(
        0.5, 0.0, 0.0, 0.5,
        0.0, 0.5, 0.0, 0.5,
        0.0, 0.0, 0.5, 0.5,
        0.0, 0.0, 0.0, 1.0
      );
      reflTextureMatrix.multiply(reflCam.projectionMatrix);
      reflTextureMatrix.multiply(reflCam.matrixWorldInverse);
      reflTextureMatrix.multiply(waterMesh.matrixWorld);

      waterMesh.visible = false;
      renderer.setRenderTarget(reflRT);
      renderer.clear();
      renderer.render(scene, reflCam);
      renderer.setRenderTarget(null);
      waterMesh.visible = true;
      waterUniforms.uHasReflect.value = 1;
      return true;
    }

    waterUniforms.uTime = WIND.time;

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
    const roofMat = new THREE.MeshStandardMaterial({
      map: tex(grav.map, { srgb: true }), normalMap: tex(grav.normal),
      color: 0xd8cdb8, roughness: 0.98, metalness: 0, envMapIntensity: 0.9,
      emissive: new THREE.Color(0x1b1712), emissiveIntensity: 1.0
    });
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

    // vertical oak slats, real geometry, one instanced draw
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
    function glaze({ axis, at, from, to, y0, y1, mullions = 3, openFrom = null, openTo = null, sill = true }) {
      const tF = 0.075, dF = 0.17;            // frame face, frame depth
      const mul = Array.isArray(mullions)
        ? mullions.slice()
        : Array.from({ length: mullions + 1 }, (_, i) => lerp(from, to, i / mullions));
      const mk = (w, h, d, x, y, z, mat = M.bronze) => addBox(w, h, d, x, y, z, mat, { uv: 0.5 });
      const sides = axis === 'x'
        ? [[to - from + tF, tF, dF, (from + to) / 2, y1 - tF / 2, at],
           [to - from + tF, tF, dF, (from + to) / 2, y0 + tF / 2, at]]
        : [[dF, tF, to - from + tF, at, y1 - tF / 2, (from + to) / 2],
           [dF, tF, to - from + tF, at, y0 + tF / 2, (from + to) / 2]];
      for (const [w, h, d, x, y, z] of sides) mk(w, h, d, x, y, z);

      for (const u of mul) {
        if (axis === 'x') mk(tF, y1 - y0, dF, u, (y0 + y1) / 2, at);
        else mk(dF, y1 - y0, tF, at, (y0 + y1) / 2, u);
      }
      // a transom across the tall bays: real glazing is never one pane
      const hMid = (y0 + y1) / 2;
      const tall = y1 - y0 > 2.3;
      if (tall) {
        if (axis === 'x') mk(to - from, 0.05, dF * 0.85, (from + to) / 2, y1 - 0.62, at);
        else mk(dF * 0.85, 0.05, to - from, at, y1 - 0.62, (from + to) / 2);
      }
      // stone sill outside and a shadow reveal inside the opening
      if (sill) {
        if (axis === 'x') {
          mk(to - from + 0.3, 0.07, 0.26, (from + to) / 2, y0 - 0.02, at, M.stonePale);
          mk(to - from, 0.1, 0.04, (from + to) / 2, y1 + 0.05, at, M.dark);
        } else {
          mk(0.26, 0.07, to - from + 0.3, at, y0 - 0.02, (from + to) / 2, M.stonePale);
          mk(0.04, 0.1, to - from, at, y1 + 0.05, (from + to) / 2, M.dark);
        }
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

    // entry portal, the deep recess the camera travels through
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

    /* ── exterior detailing ────────────────────────────────────────────────
       Timber soffits, a pergola over the terrace, bronze sconces with their
       warm pools on the stone, roof copings with a shadow line, and the teak
       loungers by the pool. All merged into the existing material buckets.
       ─────────────────────────────────────────────────────────────────── */
    // entrance canopy: slatted oak soffit + bronze fascia
    {
      const cx = 0.4, cz = A.z1 + 1.6, cy = 3.56;
      for (let x = -2.25; x <= 3.15; x += 0.17) {
        addBox(0.085, 0.115, 3.06, x, cy, cz, M.oak, { uv: 0.7 });
      }
      addBox(5.66, 0.1, 0.08, 0.4, cy + 0.02, cz + 1.62, M.bronze, { uv: 0.5 });
      for (let z = cz - 1.5; z <= cz + 1.5; z += 0.5) {
        addBox(0.06, 0.09, 0.06, -2.3, cy + 0.04, z, M.bronze, { uv: 0.5 });
      }
    }

    // pergola over the terrace, clear of the camera's exit line
    {
      const px0 = 4.5, px1 = 9.8, pz0 = -9.5, pz1 = -6.75, py = 3.12;
      for (const [x, z] of [[px0, pz0], [px1, pz0], [px0, pz1], [px1, pz1]]) {
        addBox(0.15, py, 0.15, x, py / 2, z, M.oak, { uv: 0.6 });
      }
      addBox(px1 - px0 + 0.5, 0.26, 0.18, (px0 + px1) / 2, py + 0.1, pz0, M.oakDark, { uv: 0.6 });
      addBox(px1 - px0 + 0.5, 0.26, 0.18, (px0 + px1) / 2, py + 0.1, pz1, M.oakDark, { uv: 0.6 });
      for (let x = px0 + 0.25; x <= px1 - 0.2; x += 0.24) {
        addBox(0.07, 0.15, pz1 - pz0 - 0.1, x, py + 0.24, (pz0 + pz1) / 2, M.oak, { uv: 0.7 });
      }
    }

    // roof copings: a projecting cap with a shadow reveal under it
    {
      const px = (A.x0 + A.x1) / 2, pz = (A.z0 + A.z1) / 2;
      const ow = A.x1 - A.x0 + 1.9, od = A.z1 - A.z0 + 1.9;
      const yTop = A.h + 0.73 + 0.17;
      addBox(ow + 0.14, 0.075, 0.3, px, yTop, pz - od / 2 + 0.08, M.stonePale, { uv: 0.4 });
      addBox(ow + 0.14, 0.075, 0.3, px, yTop, pz + od / 2 - 0.08, M.stonePale, { uv: 0.4 });
      addBox(0.3, 0.075, od, px - ow / 2 + 0.08, yTop, pz, M.stonePale, { uv: 0.4 });
      addBox(0.3, 0.075, od, px + ow / 2 - 0.08, yTop, pz, M.stonePale, { uv: 0.4 });

      const bx = (B.x0 + B.x1) / 2, bz = (B.z0 + B.z1) / 2;
      const bw = B.x1 - B.x0 + 1.1, bd = B.z1 - B.z0 + 1.1;
      const byTop = B.h + 0.55 + 0.13;
      addBox(bw + 0.12, 0.06, 0.26, bx, byTop, bz - bd / 2 + 0.07, M.stonePale, { uv: 0.4 });
      addBox(bw + 0.12, 0.06, 0.26, bx, byTop, bz + bd / 2 - 0.07, M.stonePale, { uv: 0.4 });
      addBox(0.26, 0.06, bd, bx - bw / 2 + 0.07, byTop, bz, M.stonePale, { uv: 0.4 });
      addBox(0.26, 0.06, bd, bx + bw / 2 - 0.07, byTop, bz, M.stonePale, { uv: 0.4 });
    }

    /* ── exterior lighting: sconces, step lights ─────────────────────────── */
    const warmLamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.2, 1.25) });

    function sconce(x, y, z, axis = 'z', sign = 1) {
      const w = axis === 'z' ? 0.17 : 0.05;
      const d = axis === 'z' ? 0.05 : 0.17;
      addBox(w, 0.36, d, x, y, z, M.bronze, { uv: 0.5 });
      const ox = axis === 'z' ? 0 : sign * 0.075;
      const oz = axis === 'z' ? sign * 0.075 : 0;
      addBox(0.13, 0.22, 0.13, x + ox, y, z + oz, M.bronze, { uv: 0.5 });
      addBox(0.1, 0.06, 0.1, x + ox, y - 0.13, z + oz, warmLamp, { cast: false, receive: false });
      // the warm pool it throws on the stone
      const glowMat = M.glow.clone();
      glowMat.opacity = 0.3;
      const q = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9), glowMat);
      if (axis === 'z') q.position.set(x + ox, y + 0.05, z + sign * 0.11);
      else { q.rotation.y = Math.PI / 2; q.position.set(x + sign * 0.11, y + 0.05, z + oz); }
      q.renderOrder = 4;
      world.add(q);
    }
    sconce(-2.62, 2.62, A.z1 + 0.26, 'z', 1);
    sconce(2.62, 2.62, A.z1 + 0.26, 'z', 1);
    sconce(-6.8, 2.7, A.z0 - 0.26, 'z', -1);
    sconce(3.1, 2.7, A.z0 - 0.26, 'z', -1);
    for (const [lx, ly, lz, li] of [[-2.62, 2.55, A.z1 + 0.55, MOBILE ? 2.5 : 4.2],
                                     [-6.8, 2.6, A.z0 - 0.55, MOBILE ? 2.2 : 3.6]]) {
      const pl = new THREE.PointLight(0xffb877, li, 6.5, 2);
      pl.position.set(lx, ly, lz);
      scene.add(pl);
    }

    // recessed step lights in the pool coping face
    for (const sx of [-2.4, 0.6, 3.6, 6.6]) {
      addBox(0.16, 0.05, 0.02, sx, -0.22, POOL.z1 + pw + 0.005, warmLamp, { cast: false, receive: false });
    }

    /* ── teak loungers by the pool ───────────────────────────────────────── */
    function lounger(x, z) {
      const sx = 1.95, sz = 0.72;
      for (const dz of [-sz / 2 + 0.07, sz / 2 - 0.07]) {
        addBox(sx - 0.1, 0.07, 0.07, x, 0.3, z + dz, M.oakDark, { uv: 0.6 });
        addBox(0.06, 0.3, 0.06, x - sx / 2 + 0.1, 0.15, z + dz, M.bronze, { uv: 0.5 });
        addBox(0.06, 0.3, 0.06, x + sx / 2 - 0.1, 0.15, z + dz, M.bronze, { uv: 0.5 });
      }
      for (let i = 0; i < 9; i++) {
        addBox(0.075, 0.035, sz, x - sx / 2 + 0.16 + i * 0.205, 0.345, z, M.oak, { uv: 0.7 });
      }
      // inclined back
      for (let i = 0; i < 5; i++) {
        addBox(0.075, 0.035, sz, x - sx / 2 + 0.1 + i * 0.16, 0.36 + i * 0.12, z, M.oak, { uv: 0.7 });
      }
      // folded linen at the foot
      addBox(0.44, 0.1, 0.5, x + sx / 2 - 0.4, 0.41, z, M.linenA, { uv: 0.6 });
    }
    lounger(5.3, -8.55);
    lounger(7.6, -8.55);
    // a low stone side table between them
    addBox(0.46, 0.34, 0.46, 6.45, 0.17, -8.55, M.stonePale, { uv: 0.5 });
    addBox(0.5, 0.05, 0.5, 6.45, 0.36, -8.55, M.stonePale, { uv: 0.5 });


    /* ── bougainvillea ─────────────────────────────────────────────────────
       Paper flower draped over the entry canopy, the pergola, the wing's roof
       edge and a stretch of the limestone wall. Woody runners are swept tubes;
       leaves and bract clusters are instanced cards with per-instance colour,
       so one draw carries a few thousand magenta bracts that sway together.
       ───────────────────────────────────────────────────────────────────── */
    {
      const S = 256;

      /** Three papery bracts round a small eye, drawn pale, tinted per instance. */
      function makeBractCard() {
        const c = cv(S), g = c.getContext('2d');
        g.clearRect(0, 0, S, S);
        const cx = S / 2, cy = S / 2;
        for (let i = 0; i < 3; i++) {
          const a = i * (Math.PI * 2 / 3) + 0.35;
          g.save(); g.translate(cx, cy); g.rotate(a);
          const grd = g.createLinearGradient(0, 0, 0, -S * 0.44);
          grd.addColorStop(0, 'rgba(255,232,238,1)');
          grd.addColorStop(0.45, 'rgba(255,246,248,1)');
          grd.addColorStop(0.82, 'rgba(255,255,255,1)');
          grd.addColorStop(1, 'rgba(255,255,255,.85)');
          g.fillStyle = grd;
          g.beginPath();
          g.moveTo(0, 0);
          g.bezierCurveTo(-S * 0.20, -S * 0.12, -S * 0.23, -S * 0.33, 0, -S * 0.44);
          g.bezierCurveTo(S * 0.23, -S * 0.33, S * 0.20, -S * 0.12, 0, 0);
          g.fill();
          // papery veins
          g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.3;
          for (let v = -2; v <= 2; v++) {
            g.beginPath(); g.moveTo(0, -S * 0.02); g.lineTo(v * S * 0.045, -S * 0.40); g.stroke();
          }
          g.strokeStyle = 'rgba(190,150,160,.35)'; g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(0, 0);
          g.bezierCurveTo(-S * 0.19, -S * 0.12, -S * 0.22, -S * 0.32, 0, -S * 0.43);
          g.stroke();
          g.restore();
        }
        g.fillStyle = 'rgba(248,236,204,1)';
        g.beginPath(); g.arc(cx, cy, S * 0.035, 0, 7); g.fill();
        return c;
      }

      /** A single oval leaf with a midrib. */
      function makeVineLeafCard() {
        const c = cv(S), g = c.getContext('2d');
        g.clearRect(0, 0, S, S);
        g.save(); g.translate(S / 2, S / 2);
        const grd = g.createLinearGradient(-S * 0.3, 0, S * 0.3, 0);
        grd.addColorStop(0, 'rgba(228,242,220,1)');
        grd.addColorStop(0.5, 'rgba(252,255,248,1)');
        grd.addColorStop(1, 'rgba(214,232,206,1)');
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(-S * 0.36, 0);
        g.bezierCurveTo(-S * 0.2, -S * 0.26, S * 0.2, -S * 0.3, S * 0.38, 0);
        g.bezierCurveTo(S * 0.2, S * 0.3, -S * 0.2, S * 0.26, -S * 0.36, 0);
        g.fill();
        g.strokeStyle = 'rgba(150,175,140,.55)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(-S * 0.36, 0); g.lineTo(S * 0.36, 0); g.stroke();
        for (let i = -3; i <= 3; i++) {
          g.lineWidth = 1.2; g.strokeStyle = 'rgba(150,175,140,.35)';
          g.beginPath(); g.moveTo(i * S * 0.09, 0); g.lineTo(i * S * 0.09 + S * 0.05, -S * 0.16); g.stroke();
        }
        g.restore();
        return c;
      }

      const bractMat = windify(new THREE.MeshStandardMaterial({
        map: tex(makeBractCard(), { srgb: true }),
        alphaTest: 0.42, side: THREE.DoubleSide,
        roughness: 0.62, metalness: 0.0, envMapIntensity: 0.7,
        emissive: new THREE.Color(0x33091a), emissiveIntensity: 0.4
      }), { amp: 0.085, freq: 1.5, height: 3.4 });

      const vineLeafMat = windify(new THREE.MeshStandardMaterial({
        map: tex(makeVineLeafCard(), { srgb: true }),
        alphaTest: 0.45, side: THREE.DoubleSide,
        roughness: 0.85, metalness: 0.0, envMapIntensity: 0.6
      }), { amp: 0.09, freq: 1.45, height: 3.4 });

      const bMats = [], bCols = [], lMats = [], lCols = [];
      const bGeo = new THREE.PlaneGeometry(1, 1);
      const vd = new THREE.Object3D();
      const vc = new THREE.Color();

      // magenta → crimson → coral → warm pink, the range bougainvillea gives you
      const PALETTE = [
        [0.46, 0.015, 0.115], [0.60, 0.025, 0.085], [0.74, 0.075, 0.19],
        [0.86, 0.235, 0.31], [0.52, 0.012, 0.20], [0.94, 0.34, 0.42]
      ];

      function bract(x, y, z, s, pick) {
        vd.position.set(x, y, z);
        vd.rotation.set(rr(-1.5, 1.5), rr(0, 6.3), rr(-1.2, 1.2));
        vd.scale.set(s, s, s);
        vd.updateMatrix();
        bMats.push(vd.matrix.clone());
        const p = PALETTE[pick % PALETTE.length];
        vc.setRGB(p[0] * rr(0.9, 1.1), p[1] * rr(0.88, 1.12), p[2] * rr(0.9, 1.1));
        bCols.push(vc.clone());
      }

      function vleaf(x, y, z, s) {
        vd.position.set(x, y, z);
        vd.rotation.set(rr(-1.2, 1.2), rr(0, 6.3), rr(-1.2, 1.2));
        vd.scale.set(s * 1.35, s, s);
        vd.updateMatrix();
        lMats.push(vd.matrix.clone());
        vc.setRGB(rr(0.13, 0.24), rr(0.26, 0.42), rr(0.09, 0.17));
        lCols.push(vc.clone());
      }

      /** One woody runner: thickness taper, leaves along it, bracts hanging off. */
      function runner(pts, { r = 0.038, density = 1, droop = 0.55, spread = 0.34, pick = 0 } = {}) {
        const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal', 0.5);
        queue(limb(curve, { r0: r, r1: r * 0.4, radial: 6, tubular: 18, tile: 0.45 }), M.bark, true, false);
        const len = curve.getLength();
        const n = Math.max(5, Math.round(len * 9 * density));
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const p = curve.getPoint(t);
          const vigour = 0.55 + 0.45 * Math.sin(t * 9.1 + pick * 2.3);

          for (let k = 0; k < 2; k++) {
            const a = rnd() * Math.PI * 2, off = rr(0.03, spread * 0.7);
            vleaf(p.x + Math.cos(a) * off, p.y + rr(-0.1, 0.14), p.z + Math.sin(a) * off, rr(0.09, 0.19));
          }
          if (rnd() < 0.8 * vigour) {
            const cl = Math.round(rr(3, 8) * density);
            for (let k = 0; k < cl; k++) {
              const a = rnd() * Math.PI * 2;
              const off = Math.pow(rnd(), 0.6) * spread;
              bract(
                p.x + Math.cos(a) * off,
                p.y - droop * off * rr(0.2, 1.0) + rr(-0.06, 0.10),
                p.z + Math.sin(a) * off,
                rr(0.075, 0.165) * (0.8 + vigour * 0.4), pick + i
              );
            }
          }
        }
      }

      // 1 · the entry canopy: a sheet spilling over its outer edge
      runner([[-2.45, 3.96, 9.05], [-1.2, 4.02, 9.16], [0.4, 3.98, 9.2], [2.0, 4.0, 9.14], [3.3, 3.94, 9.0]],
        { r: 0.05, density: 1.5, droop: 1.1, spread: 0.5, pick: 0 });
      for (let x = -2.3; x < 3.2; x += 0.46) {
        runner([[x, 3.95, 9.12], [x + rr(-0.12, 0.12), 3.62, 9.3], [x + rr(-0.2, 0.2), 3.2, 9.28],
                [x + rr(-0.26, 0.26), 2.86, 9.18]], { r: 0.026, density: 1.4, droop: 0.7, spread: 0.34, pick: 2 });
      }
      // and up the pier, from the gravel
      runner([[-2.2, 0.05, 7.6], [-2.28, 1.1, 7.4], [-2.1, 2.2, 7.5], [-2.24, 3.3, 7.3], [-2.15, 3.9, 7.5]],
        { r: 0.05, density: 1.5, droop: 0.5, spread: 0.4, pick: 3 });
      runner([[-2.5, 0.05, 8.7], [-2.42, 1.4, 8.5], [-2.55, 2.6, 8.6], [-2.4, 3.7, 8.4]],
        { r: 0.04, density: 1.2, droop: 0.55, spread: 0.4, pick: 1 });

      // 2 · over the pergola, both beams and the hanging edge
      runner([[4.4, 3.4, -9.5], [6.2, 3.44, -9.56], [8.0, 3.4, -9.5], [9.9, 3.36, -9.46]],
        { r: 0.045, density: 1.6, droop: 1.2, spread: 0.42, pick: 4 });
      runner([[4.4, 3.38, -6.8], [6.4, 3.42, -6.84], [8.4, 3.38, -6.8], [9.9, 3.34, -6.78]],
        { r: 0.04, density: 1.4, droop: 0.9, spread: 0.38, pick: 5 });
      for (let x = 4.6; x < 9.8; x += 0.62) {
        runner([[x, 3.4, -9.5], [x + rr(-0.1, 0.1), 3.05, -9.62], [x + rr(-0.16, 0.16), 2.62, -9.55]],
          { r: 0.022, density: 1.2, droop: 0.75, spread: 0.3, pick: 1 });
      }
      // a few canes up the pergola posts
      for (const [px2, pz2] of [[9.8, -9.5], [4.5, -9.5]]) {
        runner([[px2 + 0.1, 0.05, pz2 + 0.1], [px2 + 0.12, 1.1, pz2 + 0.14], [px2 + 0.08, 2.3, pz2 + 0.1],
                [px2 + 0.1, 3.1, pz2 + 0.12]], { r: 0.036, density: 1.1, droop: 0.4, spread: 0.3, pick: 0 });
      }

      // 3 · the wing's roof edge above the terrace, spilling over the coping
      runner([[4.2, 4.5, -6.62], [6.0, 4.52, -6.66], [7.9, 4.48, -6.62], [9.6, 4.46, -6.6], [11.0, 4.44, -6.58]],
        { r: 0.05, density: 1.5, droop: 1.4, spread: 0.45, pick: 3 });
      for (let x = 4.5; x < 10.8; x += 0.72) {
        runner([[x, 4.48, -6.62], [x + rr(-0.15, 0.15), 4.05, -6.8], [x + rr(-0.2, 0.2), 3.6, -6.78]],
          { r: 0.022, density: 1.1, droop: 0.7, spread: 0.28, pick: 5 });
      }

      // 4 · a stretch of the limestone wall by the door, ground to lintel
      runner([[3.55, 0.05, 6.35], [3.62, 1.2, 6.34], [3.5, 2.4, 6.36], [3.6, 3.4, 6.35], [3.52, 4.3, 6.34]],
        { r: 0.045, density: 1.4, droop: 0.45, spread: 0.36, pick: 2 });
      runner([[2.9, 0.05, 6.4], [3.0, 1.5, 6.42], [2.86, 2.8, 6.4], [2.95, 3.9, 6.41]],
        { r: 0.032, density: 1.1, droop: 0.55, spread: 0.3, pick: 4 });

      // 5 · the rear wall beside the opening, seen as you step out
      runner([[3.2, 0.05, -6.2], [3.3, 1.3, -6.22], [3.18, 2.5, -6.2], [3.26, 3.6, -6.21]],
        { r: 0.042, density: 1.3, droop: 0.5, spread: 0.34, pick: 1 });

      function mass(x0, x1, y0, y1, z0, z1, count, pick) {
        for (let i = 0; i < count; i++) {
          const x = rr(x0, x1), y = rr(y0, y1), z = rr(z0, z1);
          bract(x, y, z, rr(0.07, 0.16), pick + i);
          if (i % 3 === 0) vleaf(x + rr(-0.1, 0.1), y - rr(0.02, 0.12), z + rr(-0.1, 0.1), rr(0.07, 0.15));
        }
      }
      mass(-2.45, 3.4, 2.88, 4.02, 8.95, 9.4, MOBILE ? 220 : 560, 0);     // entry canopy
      mass(4.2, 9.85, 2.62, 3.55, -9.72, -9.3, MOBILE ? 240 : 620, 4);    // pergola, pool side
      mass(4.2, 11.0, 3.5, 4.5, -6.95, -6.5, MOBILE ? 220 : 520, 3);      // wing roof edge
      mass(3.35, 3.78, 0.5, 4.25, 6.18, 6.52, MOBILE ? 120 : 300, 2);     // wall by the door
      mass(-2.6, -2.1, 0.4, 3.5, 7.2, 7.75, MOBILE ? 90 : 220, 1);        // entry pier

      const bracts = new THREE.InstancedMesh(bGeo, bractMat, bMats.length);
      bMats.forEach((m, i) => { bracts.setMatrixAt(i, m); bracts.setColorAt(i, bCols[i]); });
      bracts.instanceMatrix.needsUpdate = true;
      if (bracts.instanceColor) bracts.instanceColor.needsUpdate = true;
      bracts.castShadow = false;
      bracts.frustumCulled = false;
      world.add(bracts);

      const vLeaves = new THREE.InstancedMesh(bGeo, vineLeafMat, lMats.length);
      lMats.forEach((m, i) => { vLeaves.setMatrixAt(i, m); vLeaves.setColorAt(i, lCols[i]); });
      vLeaves.instanceMatrix.needsUpdate = true;
      if (vLeaves.instanceColor) vLeaves.instanceColor.needsUpdate = true;
      vLeaves.castShadow = false;
      vLeaves.frustumCulled = false;
      world.add(vLeaves);
    }

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
        const sm = MOBILE ? 512 : 512;
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
       7b · grass: 40k instanced blades, wind in the vertex shader
       Blades are dense where the camera goes (along the drive, round the house
       and the pool) and thin out with distance; the paving is kept clear and
       the height shortens at its edge, so the lawn meets the gravel cleanly.
       ───────────────────────────────────────────────────────────────────── */
    {
      const driveHalf = (t) => lerp(1.65, 1.25, t);

      // the drive as a lookup table, for cheap "is this paving?" tests
      const DT = [];
      for (let i = 0; i <= 400; i++) {
        const t = i / 400, p = drive.getPoint(t);
        DT.push({ x: p.x, z: p.z, w: driveHalf(t) });
      }
      const driveDist = (x, z) => {
        let best = 1e9, bi = 0;
        for (let i = 0; i < DT.length; i += 4) {
          const d = (DT[i].x - x) ** 2 + (DT[i].z - z) ** 2;
          if (d < best) { best = d; bi = i; }
        }
        for (let i = Math.max(0, bi - 4); i < Math.min(DT.length, bi + 5); i++) {
          const d = (DT[i].x - x) ** 2 + (DT[i].z - z) ** 2;
          if (d < best) { best = d; bi = i; }
        }
        return Math.sqrt(best) - DT[bi].w;
      };

      const paved = (x, z) => {
        if (driveDist(x, z) < 0.22) return true;
        if (x > A.x0 - 0.9 && x < B.x1 + 1.0 && z > A.z0 - 1.0 && z < A.z1 + 0.9) return true;
        if (x > -9.8 && x < 12.8 && z > -10.4 && z < -5.5) return true;
        if (x > POOL.x0 - 1.1 && x < POOL.x1 + 1.1 && z > POOL.z0 - 1.1 && z < POOL.z1 + 1.1) return true;
        return false;
      };

      // blade: three tapered segments, curved forward, in a y 0…1 unit box
      const blade = (() => {
        const segs = 3, v = [], uvs = [], idx = [];
        for (let i = 0; i <= segs; i++) {
          const t = i / segs;
          const w = 0.5 * Math.pow(1 - t, 0.7) + 0.015;
          const bend = t * t * 0.26;
          v.push(-w, t, bend, w, t, bend);
          uvs.push(0, t, 1, t);
          if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        g.setIndex(idx);
        return g;
      })();

      const N = MOBILE ? 12000 : 62000;
      const aRoot = new Float32Array(N * 3);
      const aParam = new Float32Array(N * 4);
      const aTint = new Float32Array(N);

      let i = 0, guard = 0;
      while (i < N && guard < N * 6) {
        guard++;
        let x, z, near = 1;
        const roll = rnd();
        if (roll < 0.58) {
          // along the drive, this is where the camera actually is
          const t = 0.28 + 0.72 * Math.pow(rnd(), 0.7);
          const p = drive.getPoint(t);
          const tan = drive.getTangent(t);
          const nx = -tan.z, nz = tan.x;
          const off = (rnd() > 0.5 ? 1 : -1) * (1.6 + Math.pow(rnd(), 0.65) * 17);
          x = p.x + nx * off; z = p.z + nz * off;
          near = clamp(1 - (Math.abs(off) - 1.6) / 30);
        } else if (roll < 0.84) {
          // the apron round the house, terrace and pool
          x = rr(-26, 32); z = rr(-34, 30);
          near = 0.9;
        } else {
          const a = rnd() * Math.PI * 2, r = Math.pow(rnd(), 0.55) * 90;
          x = Math.cos(a) * r * 1.2 + 4; z = Math.sin(a) * r - 4;
          near = clamp(1 - r / 90) * 0.7;
        }
        if (Math.hypot(x, z + 4) > 150) continue;

        const edge = Math.max(0, Math.min(1, (driveDist(x, z) - 0.15) / 1.5));
        const wild = 0.65 + 0.5 * rnd() * (0.35 + near * 0.65);
        const hTuft = (0.12 + Math.pow(rnd(), 1.5) * 0.3) * wild * (0.55 + 0.45 * edge);

        // a tuft of thin blades rather than one wide blade, so the lawn reads
        // as volume and the gaps keep the ground visible
        const k = 4 + Math.floor(rnd() * 5);
        const spread = 0.05 + rnd() * 0.15;
        for (let b = 0; b < k && i < N; b++) {
          const bx = x + rr(-spread, spread), bz = z + rr(-spread, spread);
          if (paved(bx, bz)) continue;
          const h = hTuft * rr(0.62, 1.32);
          aRoot[i * 3] = bx;
          aRoot[i * 3 + 1] = -0.05;
          aRoot[i * 3 + 2] = bz;
          aParam[i * 4] = rnd() * Math.PI * 2;
          aParam[i * 4 + 1] = h;
          aParam[i * 4 + 2] = h * rr(0.042, 0.072);
          aParam[i * 4 + 3] = rnd();
          aTint[i] = clamp(0.2 + 0.8 * near * rr(0.55, 1.15) + (rnd() - 0.5) * 0.3);
          i++;
        }
      }

      const geo = new THREE.InstancedBufferGeometry();
      geo.index = blade.index;
      geo.setAttribute('position', blade.attributes.position);
      geo.setAttribute('uv', blade.attributes.uv);
      geo.setAttribute('aRoot', new THREE.InstancedBufferAttribute(aRoot, 3));
      geo.setAttribute('aParam', new THREE.InstancedBufferAttribute(aParam, 4));
      geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint, 1));
      geo.instanceCount = i;

      const sunDir = SUN_DIR.clone().normalize();
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSunDir: { value: sunDir },
          uSunCol: { value: new THREE.Color(1.55, 1.02, 0.64) },
          uSkyCol: { value: new THREE.Color(0.30, 0.38, 0.52) },
          uFogCol: { value: new THREE.Color(0.72, 0.66, 0.55) },
          uFogDensity: { value: 0.0032 }
        },
        side: THREE.DoubleSide,
        vertexShader: /* glsl */`
          attribute vec3 aRoot;
          attribute vec4 aParam;
          attribute float aTint;
          uniform float uTime;
          varying vec3 vCol;
          varying float vDist;
          varying float vUp;

          void main() {
            float yaw = aParam.x, h = aParam.y, w = aParam.z, ph = aParam.w;
            vec3 p = position;
            p.x *= w * 2.0;
            p.y *= h;
            p.z *= h * 0.55;

            float sway = pow(position.y, 1.7);
            float gust = 0.55 + 0.45 * sin(uTime * 0.55 + aRoot.x * 0.09 + aRoot.z * 0.07);
            float a = sin(uTime * 1.6 + aRoot.x * 0.8 + aRoot.z * 0.6 + ph * 6.28) * 0.6
                    + sin(uTime * 3.1 + ph * 14.0) * 0.22;
            p.x += a * 0.19 * h * sway * gust;
            p.z += cos(uTime * 1.25 + aRoot.x * 0.55 + ph * 5.0) * 0.15 * h * sway * gust;

            float c = cos(yaw), s = sin(yaw);
            vec3 rp = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
            vec3 wp = aRoot + rp;

            vec4 mv = viewMatrix * vec4(wp, 1.0);
            vDist = -mv.z;

            // colour: shaded base, olive body, sunlit tip, per-blade tint
            vec3 base = mix(vec3(0.038, 0.055, 0.022), vec3(0.115, 0.160, 0.062), smoothstep(0.0, 0.7, position.y));
            base = mix(base, vec3(0.27, 0.32, 0.115), smoothstep(0.55, 1.0, position.y) * 0.85);
            vCol = base * (0.55 + aTint * 0.85);
            vUp = position.y;

            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */`
          uniform vec3 uSunDir;
          uniform vec3 uSunCol;
          uniform vec3 uSkyCol;
          uniform vec3 uFogCol;
          uniform float uFogDensity;
          varying vec3 vCol;
          varying float vDist;
          varying float vUp;

          void main() {
            // a blade's face is mostly up-facing; tilt it a little for variety
            vec3 N = normalize(vec3(0.0, 1.0, 0.0));
            float ndl = max(dot(N, uSunDir), 0.0);
            vec3 col = vCol * (uSkyCol * 0.95 + uSunCol * ndl * 1.35);
            // backlit rim: the sun through the blade
            col += vCol * uSunCol * 0.45 * smoothstep(0.45, 1.0, vUp) * ndl;
            float f = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist);
            col = mix(col, uFogCol, clamp(f, 0.0, 1.0));
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = -1;
      world.add(mesh);
      grassUniforms = mat.uniforms;
    }

    /* ─────────────────────────────────────────────────────────────────────
       8 · olives, cypresses, canopy
       Trunks are swept, tapered, root-flared tubes along a kinked spine; every
       primary limb fords into two or three twigs, and the crown is a mix of
       displaced foliage clumps (body + shadow) and alpha cards (silhouette).
       Both foliage layers sway on the GPU from a single shared time uniform.
       ───────────────────────────────────────────────────────────────────── */

    /** Swept limb: tapered, optionally root-flared, bark UVs along the grain. */
    function limb(curve, { r0, r1, radial = 9, tubular = 16, flare = 0, flareLen = 0.6, tile = 0.85 } = {}) {
      const frames = curve.computeFrenetFrames(tubular, false);
      const len = curve.getLength();
      const pos = [], nor = [], uv = [], idx = [];
      for (let i = 0; i <= tubular; i++) {
        const t = i / tubular;
        const p = curve.getPointAt(t);
        const N = frames.normals[i], B = frames.binormals[i];
        let r = lerp(r0, r1, Math.pow(t, 0.85));
        if (flare > 0) {
          const k = clamp(1 - (t * len) / flareLen);
          r *= 1 + flare * k * k;
        }
        for (let j = 0; j <= radial; j++) {
          const a = (j / radial) * Math.PI * 2;
          const ca = Math.cos(a), sa = Math.sin(a);
          const nx = N.x * ca + B.x * sa;
          const ny = N.y * ca + B.y * sa;
          const nz = N.z * ca + B.z * sa;
          pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
          nor.push(nx, ny, nz);
          uv.push(j / radial, (t * len) / tile);
        }
      }
      for (let i = 0; i < tubular; i++) {
        for (let j = 0; j < radial; j++) {
          const a = i * (radial + 1) + j, b = a + radial + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx);
      return g;
    }

    const leafGeo = new THREE.PlaneGeometry(1, 1);
    const leafMatrices = [], leafColors = [];
    const clumpMatrices = [], clumpColors = [];
    const dummy = new THREE.Object3D();
    const tmpCol = new THREE.Color();

    /** One irregular foliage clump, reused at every scale. */
    const clumpGeo = (() => {
      const g = new THREE.IcosahedronGeometry(1, 1);
      const p = g.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const knot = Math.sin(v.x * 3.1 + v.y * 2.3) * 0.13
          + Math.sin(v.z * 4.7 - v.y * 1.9) * 0.11
          + Math.sin(v.x * 7.3 + v.z * 6.1) * 0.055;
        v.multiplyScalar(1 + knot);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      return g;
    })();

    function clumpAt(x, y, z, sx, sy, sz, hue, sat, lit) {
      dummy.position.set(x, y, z);
      dummy.rotation.set(rr(0, 6.3), rr(0, 6.3), rr(0, 6.3));
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      clumpMatrices.push(dummy.matrix.clone());
      tmpCol.setHSL(hue, sat, lit);
      clumpColors.push(tmpCol.clone());
    }

    function cardAt(x, y, z, s, lit) {
      dummy.position.set(x, y, z);
      dummy.rotation.set(rr(0, 3.14), rr(0, 3.14), rr(0, 3.14));
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      leafMatrices.push(dummy.matrix.clone());
      tmpCol.setRGB(lit * rr(0.8, 1.06), lit * rr(0.88, 1.08), lit * rr(0.72, 0.94));
      leafColors.push(tmpCol.clone());
    }

    function addOlive(x, z, scale = 1) {
      const lean = rr(-1, 1) * 0.38 * scale;
      const leanZ = rr(-1, 1) * 0.32 * scale;
      const h = rr(2.15, 3.0) * scale;
      const baseR = rr(0.15, 0.21) * scale;
      const yaw = rr(0, 6.3);

      // spine: never plumb, always a little kinked
      const spine = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, -0.09, z),
        new THREE.Vector3(x + lean * 0.16, h * 0.30, z + leanZ * 0.16),
        new THREE.Vector3(x + lean * 0.52, h * 0.64, z + leanZ * 0.52),
        new THREE.Vector3(x + lean, h, z + leanZ)
      ], false, 'centripetal', 0.5);
      queue(limb(spine, {
        r0: baseR, r1: baseR * 0.38, radial: 10, tubular: 18,
        flare: 0.7, flareLen: 0.62 * scale, tile: 0.95 * scale
      }), M.bark, true, true);

      // buttress roots where the trunk meets the ground
      const roots = MOBILE ? 3 : 4 + Math.floor(rnd() * 2);
      for (let i = 0; i < roots; i++) {
        const a = yaw + (i / roots) * Math.PI * 2 + rr(-0.35, 0.35);
        const reach = baseR * rr(1.6, 2.6);
        const p0 = new THREE.Vector3(x + Math.cos(a) * baseR * 0.55, 0.34 * scale, z + Math.sin(a) * baseR * 0.55);
        const p1 = new THREE.Vector3(x + Math.cos(a) * reach, 0.11 * scale, z + Math.sin(a) * reach);
        const p2 = new THREE.Vector3(x + Math.cos(a) * reach * 1.5, -0.07, z + Math.sin(a) * reach * 1.5);
        queue(limb(new THREE.CatmullRomCurve3([p0, p1, p2]), {
          r0: baseR * 0.42, r1: baseR * 0.1, radial: 7, tubular: 8, tile: 0.7
        }), M.bark, true, true);
      }

      // limbs, then twigs on every limb
      const tips = [];
      const limbs = MOBILE ? 4 : 5;
      for (let i = 0; i < limbs; i++) {
        const a = yaw + (i / limbs) * Math.PI * 2 + rr(-0.55, 0.55);
        const y0 = h * rr(0.52, 0.94);
        const start = new THREE.Vector3(
          x + lean * (y0 / h) * 0.85 + Math.cos(a) * baseR * 0.3,
          y0,
          z + leanZ * (y0 / h) * 0.85 + Math.sin(a) * baseR * 0.3
        );
        const len = rr(0.85, 1.6) * scale;
        const rise = rr(0.5, 1.15) * scale;
        const mid = new THREE.Vector3(
          start.x + Math.cos(a) * len * 0.55,
          start.y + rise * 0.62,
          start.z + Math.sin(a) * len * 0.55
        );
        const end = new THREE.Vector3(
          start.x + Math.cos(a) * len,
          start.y + rise,
          start.z + Math.sin(a) * len
        );
        const c = new THREE.CatmullRomCurve3([start, mid, end], false, 'centripetal', 0.5);
        queue(limb(c, {
          r0: baseR * 0.44, r1: baseR * 0.17, radial: 8, tubular: 12, tile: 0.8
        }), M.bark, true, false);
        tips.push({ p: end, s: rr(0.85, 1.25) * scale });

        const twigs = MOBILE ? 2 : 2 + Math.floor(rnd() * 2);
        for (let k = 0; k < twigs; k++) {
          const b = a + rr(-1.2, 1.2);
          const from = c.getPoint(rr(0.5, 0.85));
          const tl = rr(0.4, 0.85) * scale;
          const tp = new THREE.Vector3(
            from.x + Math.cos(b) * tl,
            from.y + rr(0.18, 0.55) * scale,
            from.z + Math.sin(b) * tl
          );
          const tm = from.clone().lerp(tp, 0.5).add(new THREE.Vector3(rr(-0.08, 0.08), rr(0, 0.1), rr(-0.08, 0.08)));
          queue(limb(new THREE.CatmullRomCurve3([from, tm, tp], false, 'centripetal', 0.5), {
            r0: baseR * 0.17, r1: baseR * 0.05, radial: 6, tubular: 7, tile: 0.7
          }), M.bark, true, false);
          tips.push({ p: tp, s: rr(0.6, 0.95) * scale });
        }
      }

      // crown: a small core clump for body, then cards for the silhouette
      const cardsPer = MOBILE ? 14 : 22;
      for (const tip of tips) {
        clumpAt(
          tip.p.x + rr(-0.1, 0.1), tip.p.y + rr(-0.04, 0.1), tip.p.z + rr(-0.1, 0.1),
          tip.s * rr(0.1, 0.17), tip.s * rr(0.08, 0.13), tip.s * rr(0.1, 0.17),
          rr(0.21, 0.25), rr(0.3, 0.5), rr(0.07, 0.12)
        );
        for (let k = 0; k < cardsPer; k++) {
          const a = rnd() * Math.PI * 2, b = Math.acos(rr(-1, 1));
          const rad = Math.pow(rnd(), 0.4) * tip.s * 0.78;
          cardAt(
            tip.p.x + Math.sin(b) * Math.cos(a) * rad,
            tip.p.y + Math.cos(b) * rad * 0.66 + rr(0, 0.14) * tip.s,
            tip.p.z + Math.sin(b) * Math.sin(a) * rad,
            rr(0.16, 0.36) * scale, rr(0.78, 1.02) + 0.22 * clamp((tip.p.y - h * 0.7) / (h * 0.6))
          );
        }
      }
      // a denser heart so the crown is not see-through at eye level
      for (let i = 0; i < (MOBILE ? 3 : 5); i++) {
        const a = rnd() * Math.PI * 2, rad = rr(0, 0.5) * scale;
        clumpAt(
          x + lean * 0.9 + Math.cos(a) * rad,
          h * rr(0.94, 1.16),
          z + leanZ * 0.9 + Math.sin(a) * rad,
          rr(0.14, 0.24) * scale, rr(0.1, 0.17) * scale, rr(0.14, 0.24) * scale,
          rr(0.21, 0.245), rr(0.3, 0.45), rr(0.06, 0.12)
        );
        for (let k = 0; k < (MOBILE ? 10 : 18); k++) {
          cardAt(
            x + lean * 0.9 + Math.cos(a) * rad + rr(-0.45, 0.45) * scale,
            h * rr(0.9, 1.25) + rr(-0.2, 0.2) * scale,
            z + leanZ * 0.9 + Math.sin(a) * rad + rr(-0.45, 0.45) * scale,
            rr(0.18, 0.38) * scale, rr(0.82, 1.08)
          );
        }
      }
    }

    /** A dark Mediterranean cypress: three stacked, squashed clumps on a stub. */
    function addCypress(x, z, scale = 1) {
      const h = rr(6.5, 9.5) * scale;
      const w = rr(0.34, 0.5) * scale;
      const stem = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, -0.1, z),
        new THREE.Vector3(x + rr(-0.1, 0.1), h * 0.3, z + rr(-0.1, 0.1)),
        new THREE.Vector3(x + rr(-0.15, 0.15), h * 0.6, z + rr(-0.15, 0.15))
      ], false, 'centripetal', 0.5);
      queue(limb(stem, { r0: 0.13 * scale, r1: 0.06 * scale, radial: 7, tubular: 8, tile: 0.8 }), M.bark, true, true);
      const n = MOBILE ? 18 : 26;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const y = h * (0.12 + t * 0.8);
        const r = w * 0.86 * Math.pow(1 - t, 0.46) * rr(0.95, 1.06) + 0.015;
        clumpAt(x + rr(-0.03, 0.03), y, z + rr(-0.03, 0.03),
          r, (h / n) * rr(3.0, 3.8), r, 0.235, 0.36, rr(0.055, 0.085));
        for (let k = 0; k < (MOBILE ? 3 : 6); k++) {
          const a = rnd() * Math.PI * 2;
          cardAt(x + Math.cos(a) * r * 0.85, y + rr(-0.55, 0.55) * (h / n), z + Math.sin(a) * r * 0.85,
            rr(0.2, 0.34) * scale, rr(0.45, 0.66));
        }
      }
    }

    const treeSpots = [
      [-7.5, 9.2, 1.05], [6.4, 10.5, 0.95], [-10.5, 16, 1.1], [11.5, 19, 1.0],
      [-14, 26, 1.15], [6.0, 34, 0.9], [-7, 44, 1.1], [20.5, 50, 1.0],
      [-18, 62, 1.2], [7.5, 68, 1.05], [-9.5, 88, 1.15], [26, 96, 1.1],
      [-11.5, -13.5, 1.05], [12.5, -16, 1.0], [-13, -2.5, 0.95], [15.5, 6.5, 0.95],
      [-16, -24, 1.1], [11, -26, 1.05], [-6, -30, 1.0], [2, -36, 1.1],
      // a closer rank so the drive has parallax and bark you can read
      [-5.2, 13.5, 0.62], [4.6, 17.5, 0.58], [-3.4, 27, 0.66], [8.6, 41, 0.62],
      [-11.0, 52, 0.72], [3.6, 60, 0.66], [-2.2, 74, 0.78], [13.0, 82, 0.78]
    ];
    treeSpots.forEach(([x, z, s]) => addOlive(x, z, s));

    // cypresses: dark verticals against the pale hills
    [[-22, 30, 1.0], [-26, 8, 0.9], [24, 22, 1.0], [30, 70, 1.1], [-20, 108, 1.2],
     [18, 118, 1.1], [-30, -40, 1.0], [26, -48, 1.05]]
      .forEach(([x, z, s]) => addCypress(x, z, s));

    // (low shrubs are grass tufts and vine skirts now, no separate pass)

    // foliage mass + every canopy card, two draws
    {
      const folMat = windify(new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.98, metalness: 0, envMapIntensity: 0.25
      }), { amp: 0.055, freq: 1.15, height: 3.2 });
      const clumps = new THREE.InstancedMesh(clumpGeo, folMat, clumpMatrices.length);
      clumpMatrices.forEach((m, i) => { clumps.setMatrixAt(i, m); clumps.setColorAt(i, clumpColors[i]); });
      clumps.instanceMatrix.needsUpdate = true;
      if (clumps.instanceColor) clumps.instanceColor.needsUpdate = true;
      clumps.castShadow = true;
      world.add(clumps);

      const cards = new THREE.InstancedMesh(leafGeo, M.leaf, leafMatrices.length);
      leafMatrices.forEach((m, i) => { cards.setMatrixAt(i, m); cards.setColorAt(i, leafColors[i]); });
      cards.instanceMatrix.needsUpdate = true;
      if (cards.instanceColor) cards.instanceColor.needsUpdate = true;
      cards.castShadow = true;
      cards.frustumCulled = false;
      world.add(cards);
    }


    flush();

    // the basin is only for the eye, never for the mirror
    const basin = BUCKET_MESH.get(M.poolWall);
    if (basin) basin.layers.set(1);

    /* ─────────────────────────────────────────────────────────────────────
       9 · dust motes: one additive Points pass inside the hall
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
            uSaturation: { value: 0.11 },
            uContrast: { value: 0.085 },
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
      renderReflection();
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
      if (reflRT) {
        const dpr = renderer.getPixelRatio();
        reflRT.setSize(Math.max(2, Math.round((w * dpr) / 2)), Math.max(2, Math.round((h * dpr) / 2)));
        waterUniforms.uReflectTexel.value.set(1);
      }
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
        WIND.time.value = elapsed;
        if (grassUniforms) grassUniforms.uTime.value = elapsed;
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

    window.addEventListener('error', (e) => fail(e.error || e.message));
    window.addEventListener('unhandledrejection', (e) => fail(e.reason));
  } catch (err) {
    fail(err);
  }
}
