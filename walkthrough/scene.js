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
   · water is a Fresnel shader over a half-res planar mirror of house and sky
   · grass (62k blades), foliage cards, bracts, slats, pebbles are instanced
   · trunks are swept, tapered, root-flared tubes with procedural bark
   · dust motes are one additive Points pass with a custom shader
   · DPR, shadow size, particle counts and the leaf budget are tiered by device
   ═══════════════════════════════════════════════════════════════════════════ */

/* three.js is imported inside createWalkthrough() so a page view above the fold
   never downloads or parses it. */

const BUILD = 'shadestate-3d/2.0';

/* ─────────────────────────────────────────────────────────────────────────────
   0 · the public entry point
   createWalkthrough(container, options) → handle
   One call mounts the whole scene into any element. Nothing else is required:
   no page CSS, no ids, no globals. destroy() takes it all back down.
   ───────────────────────────────────────────────────────────────────────────── */

/** Camera stops a host can open on. */
const STOPS = { approach: 0.03, entry: 0.47, interior: 0.63, terrace: 0.84, orbit: 0.97 };

const DEFAULTS = {
  scrollDriven: true,      // camera follows the section's scroll progress
  autoplay: false,         // otherwise: a slow loop over the whole take
  loop: true,
  speed: 1,
  startStop: 'approach',
  timeOfDay: 'morning',    // morning | noon | golden | dusk
  cloudCover: 0.55,        // 0 clear … 1 overcast
  waterRipples: 1,         // ripple strength multiplier
  grassDensity: 1,         // 0 … 1 (clamped to the device tier)
  palms: true,             // the four corner date palms
  quality: 'auto',         // auto | high | lite
  pausedOffscreen: true,   // stop the loop when the section leaves the viewport
  interactive: true,       // drag to look around
  dprMax: null,            // override the device-pixel-ratio cap
  onProgress: null
};

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
  // micro-pitting: quarried travertine is never a glassy surface
  for (let i = 0; i < 30000; i++) {
    hg.fillStyle = rnd() > 0.42
      ? `rgba(92,92,92,${rr(0.10, 0.34).toFixed(2)})`
      : `rgba(176,176,176,${rr(0.06, 0.24).toFixed(2)})`;
    hg.beginPath(); hg.ellipse(rnd() * S, rnd() * S, rr(0.6, 2.8), rr(0.5, 1.7), rnd() * 3, 0, 7); hg.fill();
  }
  for (let i = 0; i < 60; i++) {
    const x = rnd() * 256, y = rnd() * 256, r = rr(6, 34), v = rnd() > 0.5 ? 240 : 210;
    const grd = rg.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${v},${v},${v},.4)`);
    grd.addColorStop(1, 'rgba(216,216,216,0)');
    rg.fillStyle = grd; rg.beginPath(); rg.arc(x, y, r, 0, 7); rg.fill();
  }
  for (let i = 0; i < 14000; i++) {
    const v = rnd() > 0.5 ? 238 : 194;
    rg.fillStyle = `rgba(${v},${v},${v},.45)`;
    rg.fillRect(rnd() * 256, rnd() * 256, rr(1, 4), rr(1, 4));
  }

  return { map: c, normal: normalFromHeight(hc, 1.9), rough: rc };
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
  g.fillStyle = '#aeb37c'; g.fillRect(0, 0, S, S);
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

/* ── one grass tuft, drawn as a card ────────────────────────────────────────
   A lawn of real blades is a million triangles; a lawn of tuft cards is nine
   blades per quad and looks denser. This builds a 3×3 atlas of nine different
   tufts — each a fan of tapered, curving blades with a dark root and a lit tip,
   a few of them dry — so one instanced draw covers the whole field without a
   repeated motif. The cells keep a transparent gutter so mipmaps never bleed. */
function makeGrassTuft() {
  const CELL = 256, N = 3, S = CELL * N;
  const c = cv(S), g = c.getContext('2d');
  g.clearRect(0, 0, S, S);

  const blade = (bx, by, tipX, tipY, wBase, tones, g2) => {
    // a blade is a quadratic spine with a width that tapers to nothing
    const mx = bx + (tipX - bx) * 0.35, my = by + (tipY - by) * 0.62;
    const STEPS = 12, L = [], R = [];
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const it = 1 - t;
      const x = it * it * bx + 2 * it * t * mx + t * t * tipX;
      const y = it * it * by + 2 * it * t * my + t * t * tipY;
      const dx = 2 * it * (mx - bx) + 2 * t * (tipX - mx);
      const dy = 2 * it * (my - by) + 2 * t * (tipY - my);
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const w = wBase * Math.pow(1 - t, 0.62) * (t < 0.12 ? 0.8 + t * 1.7 : 1);
      L.push([x + nx * w, y + ny * w]);
      R.push([x - nx * w, y - ny * w]);
    }
    const grd = g2.createLinearGradient(bx, by, tipX, tipY);
    grd.addColorStop(0, tones[0]);
    grd.addColorStop(0.45, tones[1]);
    grd.addColorStop(1, tones[2]);
    g2.fillStyle = grd;
    g2.beginPath();
    g2.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i <= STEPS; i++) g2.lineTo(L[i][0], L[i][1]);
    for (let i = STEPS; i >= 0; i--) g2.lineTo(R[i][0], R[i][1]);
    g2.closePath();
    g2.fill();
  };

  for (let cy = 0; cy < N; cy++) {
    for (let cxi = 0; cxi < N; cxi++) {
      const ox = cxi * CELL, oy = cy * CELL;
      const baseY = oy + CELL * 0.985;
      const nBlades = 26 + Math.floor(rnd() * 10);
      for (let b = 0; b < nBlades; b++) {
        const spread = CELL * (0.035 + Math.pow(rnd(), 1.25) * 0.40);
        const side = rnd() > 0.5 ? 1 : -1;
        const bx = ox + CELL * 0.5 + side * spread * rr(0.15, 1);
        // short fillers at the root close the gaps between tall blades
        const short = rnd() < 0.34;
        const hgt = CELL * (short ? rr(0.18, 0.42) : rr(0.42, 0.96))
          * (1 - 0.26 * (Math.abs(bx - ox - CELL * 0.5) / (CELL * 0.40)));
        const lean = side * rr(0.04, 0.55) + rr(-0.12, 0.12);
        const dry = rnd() < 0.17;
        const tone = rr(0.72, 1.12);
        const greens = dry
          ? [`rgba(${Math.round(88 * tone)},${Math.round(84 * tone)},${Math.round(52 * tone)},1)`,
             `rgba(${Math.round(150 * tone)},${Math.round(140 * tone)},${Math.round(88 * tone)},1)`,
             `rgba(${Math.round(196 * tone)},${Math.round(184 * tone)},${Math.round(132 * tone)},1)`]
          : [`rgba(${Math.round(54 * tone)},${Math.round(72 * tone)},${Math.round(30 * tone)},1)`,
             `rgba(${Math.round(102 * tone)},${Math.round(128 * tone)},${Math.round(58 * tone)},1)`,
             `rgba(${Math.round(168 * tone)},${Math.round(188 * tone)},${Math.round(108 * tone)},1)`];
        blade(bx, baseY, bx + lean * hgt, baseY - hgt, CELL * rr(0.006, 0.012), greens, g);
      }
    }
  }
  return c;
}

/* ── the lawn mat: what the grass stands in ────────────────────────────────
   A field of tuft cards shows the ground through its gaps, and if that ground
   is pale meadow soil the cards read as plugs in rows. So the walk area gets
   its own surface: a tileable mat of tiny blades seen from above, dark at the
   root, with enough mottling that a 6 m tile never shows a seam. One plane,
   one draw call, and the tufts merge into a lawn. */
function makeLawnMat() {
  const S = 1024, c = cv(S), g = c.getContext('2d');
  g.fillStyle = '#5d6b30';
  g.fillRect(0, 0, S, S);

  // broad mottling, first: light and shade across the mat
  for (let i = 0; i < 260; i++) {
    const x = rnd() * S, y = rnd() * S, r = rr(40, 190), t = rnd();
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, t > 0.55 ? 'rgba(84,104,44,.30)' : t > 0.25 ? 'rgba(30,44,14,.34)' : 'rgba(120,124,62,.22)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }

  // the blades, wrap-drawn so the tile is seamless
  const stroke = (x, y, len, wid, ang, col) => {
    for (const ox of [0, -S, S]) {
      for (const oy of [0, -S, S]) {
        g.strokeStyle = col; g.lineWidth = wid; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x + ox, y + oy);
        g.quadraticCurveTo(
          x + ox + Math.cos(ang) * len * 0.5 + rr(-1.5, 1.5),
          y + oy + Math.sin(ang) * len * 0.5,
          x + ox + Math.cos(ang) * len, y + oy + Math.sin(ang) * len);
        g.stroke();
      }
    }
  };
  const tones = [
    [56, 74, 32], [72, 90, 40], [88, 104, 46], [106, 120, 56], [128, 134, 68], [158, 150, 88]
  ];
  for (let i = 0; i < 26000; i++) {
    const x = rnd() * S, y = rnd() * S;
    const t = tones[Math.floor(Math.pow(rnd(), 0.8) * tones.length)];
    const k = rr(0.82, 1.2);
    stroke(x, y, rr(5, 17), rr(0.9, 2.2), rr(0, Math.PI * 2),
      `rgba(${Math.round(t[0] * k)},${Math.round(t[1] * k)},${Math.round(t[2] * k)},${rr(0.45, 0.95).toFixed(2)})`);
  }
  // a little thatch at the root
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * S, y = rnd() * S;
    g.fillStyle = `rgba(${Math.round(rr(60, 96))},${Math.round(rr(56, 84))},${Math.round(rr(34, 52))},${rr(0.08, 0.22).toFixed(2)})`;
    g.fillRect(x, y, rr(1, 4), rr(1, 3));
  }
  return c;
}

function makeLeafCluster() {
  /* An olive is not a blob: it is a few thin twigs with pairs of narrow,
     silver-green leaves, and you can see sky through it. This draws exactly
     that — six to nine twigs from a soft core, paired lanceolate leaves along
     each, ragged at the edge — so a crown built from these cards keeps the
     airy silhouette and the grey cast that reads as olive rather than boxwood.
     The alpha stays hard-edged and the leaves stay above the alphaTest floor,
     so mipmaps do not chew the cluster away at distance. */
  const S = 512, c = cv(S), g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  const cx = S * 0.5, cy = S * 0.5;

  // a soft heart, only enough to stop the middle of the card going see-through
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, rad = Math.pow(rnd(), 0.5) * S * 0.16;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad, r = rr(16, 40);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(96,108,70,.34)');
    grd.addColorStop(1, 'rgba(96,108,70,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }

  const leafTones = [
    [86, 96, 66], [104, 116, 80], [118, 128, 90],
    [136, 145, 104], [156, 162, 126], [72, 82, 58]
  ];

  const twigs = 6 + Math.floor(rnd() * 4);
  for (let t = 0; t < twigs; t++) {
    const a = (t / twigs) * Math.PI * 2 + rr(-0.45, 0.45);
    const len = rr(0.20, 0.44) * S;
    const bendA = a + rr(-0.5, 0.5);
    const mx = cx + Math.cos(bendA) * len * 0.55;
    const my = cy + Math.sin(bendA) * len * 0.55;
    const tx = cx + Math.cos(a) * len;
    const ty = cy + Math.sin(a) * len;

    g.strokeStyle = 'rgba(104,96,74,.62)';
    g.lineWidth = rr(1.4, 2.8);
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy);
    g.quadraticCurveTo(mx, my, tx, ty);
    g.stroke();

    const steps = Math.max(2, Math.round(len / 58));
    for (let k = 1; k <= steps; k++) {
      const u = k / steps;
      const it = 1 - u;
      const px = it * it * cx + 2 * it * u * mx + u * u * tx;
      const py = it * it * cy + 2 * it * u * my + u * u * ty;
      const dx = 2 * it * (mx - cx) + 2 * u * (tx - mx);
      const dy = 2 * it * (my - cy) + 2 * u * (ty - my);
      const along = Math.atan2(dy, dx);
      for (const side of [-1, 1]) {
        // leaves shrink toward the twig's tip, as they do on the tree
        const l = rr(58, 96) * (1 - 0.30 * u);
        const w = l * rr(0.14, 0.19);
        const ang = along + side * rr(0.55, 0.95);
        const tone = leafTones[Math.floor(rnd() * leafTones.length)];
        const k2 = rr(0.88, 1.1);
        g.save();
        g.translate(px + Math.cos(ang) * l * 0.5, py + Math.sin(ang) * l * 0.5);
        g.rotate(ang);
        const grd = g.createLinearGradient(-l / 2, 0, l / 2, 0);
        const R = Math.round(tone[0] * k2), G = Math.round(tone[1] * k2), B = Math.round(tone[2] * k2);
        grd.addColorStop(0, `rgba(${Math.round(R * 0.82)},${Math.round(G * 0.86)},${Math.round(B * 0.84)},1)`);
        grd.addColorStop(0.55, `rgba(${Math.min(255, R + 16)},${Math.min(255, G + 16)},${Math.min(255, B + 10)},1)`);
        grd.addColorStop(1, `rgba(${Math.round(R * 0.72)},${Math.round(G * 0.76)},${Math.round(B * 0.74)},1)`);
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(-l / 2, 0);
        g.quadraticCurveTo(0, -w, l / 2, 0);
        g.quadraticCurveTo(0, w, -l / 2, 0);
        g.fill();
        g.restore();
      }
    }
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

/** Nubby loop-pile bouclé, the texture the whole sofa is built from. */
function makeBoucle(tint = [238, 230, 216]) {
  const S = 512, c = cv(S), g = c.getContext('2d');
  const hc = cv(S), hg = hc.getContext('2d');
  g.fillStyle = `rgb(${tint[0]},${tint[1]},${tint[2]})`; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S);
  // flat wool ground with a hint of slub
  for (let i = 0; i < 1400; i++) {
    g.strokeStyle = rnd() > 0.5 ? 'rgba(255,255,252,.16)' : 'rgba(150,138,118,.10)';
    g.lineWidth = rr(0.6, 1.6);
    const x = rnd() * S, y = rnd() * S;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + rr(-9, 9), y + rr(-3, 3)); g.stroke();
  }
  // the loops themselves: little arcs, catching and losing the light
  for (let i = 0; i < 15000; i++) {
    const x = rnd() * S, y = rnd() * S, r = rr(1.4, 3.9);
    const t = rr(0.84, 1.14);
    const a0 = rr(0, 6.3), a1 = a0 + rr(2.4, 5.2);
    g.strokeStyle = `rgba(${Math.round(tint[0] * t)},${Math.round(tint[1] * t)},${Math.round(tint[2] * t)},${rr(0.28, 0.85).toFixed(2)})`;
    g.lineWidth = rr(0.9, 2.0);
    g.beginPath(); g.arc(x, y, r, a0, a1); g.stroke();
    const hv = rnd() > 0.42 ? rr(178, 246) : rr(52, 118);
    hg.strokeStyle = `rgba(${Math.round(hv)},${Math.round(hv)},${Math.round(hv)},.8)`;
    hg.lineWidth = rr(1.0, 2.4);
    hg.beginPath(); hg.arc(x, y, r, a0, a1); hg.stroke();
  }
  return { map: c, normal: normalFromHeight(hc, 1.2) };
}

/** A chunky hand-woven wool rug: warp, weft, a darker border, sun-faded flecks. */
function makeRug() {
  const S = 2048, c = cv(S), g = c.getContext('2d');
  const hc = cv(S), hg = hc.getContext('2d');
  g.fillStyle = '#cbc4b6'; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S);
  // weft ribs
  for (let y = 0; y < S; y += 4) {
    const t = rr(0.9, 1.08);
    g.fillStyle = `rgba(${Math.round(208 * t)},${Math.round(201 * t)},${Math.round(188 * t)},.9)`;
    g.fillRect(0, y + rr(0, 1), S, rr(1.6, 2.8));
    hg.fillStyle = rnd() > 0.5 ? 'rgba(196,196,196,.5)' : 'rgba(88,88,88,.45)';
    hg.fillRect(0, y, S, 2.4);
  }
  // warp threads, so the weave reads in both directions
  for (let x = 0; x < S; x += 5) {
    g.strokeStyle = rnd() > 0.5 ? 'rgba(255,250,238,.10)' : 'rgba(122,105,82,.10)';
    g.lineWidth = rr(1.0, 2.2);
    g.beginPath(); g.moveTo(x + rr(-1, 1), 0); g.lineTo(x + rr(-1, 1), S); g.stroke();
  }
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,253,246,.12)' : 'rgba(92,86,76,.10)';
    g.fillRect(rnd() * S, rnd() * S, rr(0.8, 2.4), rr(0.8, 2.4));
  }
  const hcS = cv(512);
  hcS.getContext('2d').drawImage(hc, 0, 0, 512, 512);
  return { map: c, normal: normalFromHeight(hcS, 0.5) };
}

/** A minimal framed work: warm paper, one ochre field, one ink line. */
function makeArtwork() {
  const W = 384, H = 512, c = cv(W, H), g = c.getContext('2d');
  g.fillStyle = '#e6dcc6'; g.fillRect(0, 0, W, H);
  // a soft sand field across the lower third
  const grd = g.createLinearGradient(0, H * 0.55, 0, H);
  grd.addColorStop(0, 'rgba(188,144,92,0)');
  grd.addColorStop(1, 'rgba(158,112,62,.58)');
  g.fillStyle = grd; g.fillRect(0, H * 0.52, W, H * 0.48);
  // one warm disc, off centre
  const cx = W * 0.62, cy = H * 0.36, r = W * 0.25;
  const disc = g.createRadialGradient(cx - r * 0.25, cy - r * 0.3, 0, cx, cy, r);
  disc.addColorStop(0, 'rgba(206,152,84,.98)');
  disc.addColorStop(0.7, 'rgba(178,120,62,.85)');
  disc.addColorStop(0.98, 'rgba(170,110,56,.25)');
  disc.addColorStop(1, 'rgba(170,110,56,0)');
  g.fillStyle = disc; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
  // two ink gestures
  g.strokeStyle = 'rgba(46,40,34,.86)';
  g.lineWidth = 2.6; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(W * 0.22, H * 0.26);
  g.bezierCurveTo(W * 0.30, H * 0.46, W * 0.19, H * 0.58, W * 0.33, H * 0.76);
  g.stroke();
  g.strokeStyle = 'rgba(46,40,34,.34)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(W * 0.28, H * 0.28);
  g.bezierCurveTo(W * 0.35, H * 0.47, W * 0.26, H * 0.60, W * 0.38, H * 0.78);
  g.stroke();
  // paper tooth
  for (let i = 0; i < 16000; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,255,250,.10)' : 'rgba(120,104,82,.06)';
    g.fillRect(rnd() * W, rnd() * H, 1.2, 1.2);
  }
  return c;
}

/**
 * Sawn hardwood: long grain that follows the board, cathedral arches around
 * the knots, open pores, and a height canvas so the normal map carries the
 * grain as a real surface rather than a picture of one.
 */
function makeWoodGrain(base = [150, 96, 54], dark = [74, 42, 22], light = [196, 145, 96]) {
  const S = 1024, c = cv(S), g = c.getContext('2d');
  const hc = cv(S), hg = hc.getContext('2d');
  g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#8a8a8a'; hg.fillRect(0, 0, S, S);

  // broad tonal bands along the grain
  for (let i = 0; i < 34; i++) {
    const y = rnd() * S, h = rr(30, 170), t = rr(0.86, 1.12);
    g.fillStyle = `rgba(${Math.round(base[0] * t)},${Math.round(base[1] * t)},${Math.round(base[2] * t)},${rr(0.18, 0.45).toFixed(2)})`;
    g.fillRect(0, y, S, h);
  }

  // cathedral figure around a few knots
  for (let k = 0; k < 4; k++) {
    const kx = rr(S * 0.1, S * 0.9), ky = rr(S * 0.1, S * 0.9);
    for (let i = 1; i < 12; i++) {
      g.strokeStyle = `rgba(${dark[0]},${dark[1]},${dark[2]},${(0.20 - i * 0.012).toFixed(3)})`;
      g.lineWidth = rr(1.2, 3.6);
      g.beginPath();
      g.ellipse(kx - i * 9, ky, i * 16 + rr(0, 8), i * 9 + rr(0, 5), rr(-0.25, 0.25), 0, 7);
      g.stroke();
    }
    g.fillStyle = `rgba(${dark[0]},${dark[1]},${dark[2]},.6)`;
    g.beginPath(); g.ellipse(kx, ky, rr(4, 9), rr(2, 5), 0, 0, 7); g.fill();
  }

  // long grain lines
  for (let i = 0; i < 340; i++) {
    const y0 = rnd() * S, amp = rr(1.5, 16), freq = rr(0.002, 0.011), a = rr(0.05, 0.26);
    const useDark = rnd() > 0.4;
    g.strokeStyle = `rgba(${useDark ? dark.join(',') : light.join(',')},${a.toFixed(3)})`;
    g.lineWidth = rr(0.7, 2.8);
    g.beginPath();
    for (let x = 0; x <= S; x += 10) {
      const y = y0 + Math.sin(x * freq + y0) * amp + Math.sin(x * freq * 3.1) * amp * 0.25;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    const hv = useDark ? rr(40, 100) : rr(160, 214);
    hg.strokeStyle = `rgba(${Math.round(hv)},${Math.round(hv)},${Math.round(hv)},.7)`;
    hg.lineWidth = rr(1.2, 3.6);
    hg.beginPath();
    for (let x = 0; x <= S; x += 10) {
      const y = y0 + Math.sin(x * freq + y0) * amp + Math.sin(x * freq * 3.1) * amp * 0.25;
      if (x === 0) hg.moveTo(x, y); else hg.lineTo(x, y);
    }
    hg.stroke();
  }

  // open pores, short dashes lying along the grain
  for (let i = 0; i < 7000; i++) {
    const x = rnd() * S, y = rnd() * S;
    g.fillStyle = `rgba(${Math.round(dark[0] * 1.15)},${Math.round(dark[1] * 1.15)},${Math.round(dark[2] * 1.15)},${rr(0.06, 0.28).toFixed(2)})`;
    g.fillRect(x, y, rr(2, 14), rr(0.7, 1.6));
  }
  return { map: c, normal: normalFromHeight(hc, 1.1) };
}

/** Date-palm trunk: overlapping leaf-base diamonds down a dusty grey column. */
function makePalmBark() {
  const S = 512, c = cv(S), g = c.getContext('2d');
  const hc = cv(S), hg = hc.getContext('2d');
  g.fillStyle = '#6f6555'; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#8a8a8a'; hg.fillRect(0, 0, S, S);
  const rows = 16, rh = S / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    for (let i = 0; i < 8; i++) {
      const x = i * (S / 8) + (r % 2 ? S / 16 : 0);
      const t = rr(0.86, 1.14);
      g.fillStyle = `rgba(${Math.round(116 * t)},${Math.round(106 * t)},${Math.round(88 * t)},.92)`;
      g.beginPath();
      g.moveTo(x + S / 16, y + rh * 0.08);
      g.lineTo(x + S / 8 - 2, y + rh * 0.5);
      g.lineTo(x + S / 16, y + rh * 0.92);
      g.lineTo(x + 2, y + rh * 0.5);
      g.closePath(); g.fill();
      // the shadowed lower lip of each leaf base
      g.strokeStyle = 'rgba(58,51,42,.5)'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(x + 2, y + rh * 0.5); g.lineTo(x + S / 16, y + rh * 0.94); g.lineTo(x + S / 8 - 2, y + rh * 0.5); g.stroke();
      hg.strokeStyle = 'rgba(44,44,44,.85)'; hg.lineWidth = 3;
      hg.beginPath(); hg.moveTo(x + 2, y + rh * 0.48); hg.lineTo(x + S / 16, y + rh * 0.95); hg.lineTo(x + S / 8 - 2, y + rh * 0.48); hg.stroke();
    }
  }
  for (let i = 0; i < 12000; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(214,204,182,.10)' : 'rgba(62,54,42,.09)';
    g.fillRect(rnd() * S, rnd() * S, rr(0.8, 2.6), rr(0.8, 2.6));
  }
  return { map: c, normal: normalFromHeight(hc, 1.0) };
}

/** Fine cypress needles on a card: a dark body, a thousand short sprays. */
function makeNeedleCluster() {
  const S = 256, c = cv(S), g = c.getContext('2d');
  g.clearRect(0, 0, S, S);
  const cx = S / 2, cy = S / 2;
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2, rad = Math.pow(rnd(), 0.5) * S * 0.34;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad, r = rr(18, 46);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(46,60,38,.55)');
    grd.addColorStop(1, 'rgba(46,60,38,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  for (let i = 0; i < 2400; i++) {
    const a = rnd() * Math.PI * 2;
    const rad = Math.pow(rnd(), 0.45) * S * 0.46;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    const len = rr(3, 11), dir = a + rr(-0.9, 0.9);
    const t = rr(0.55, 1.0);
    g.strokeStyle = `rgba(${Math.round(58 * t)},${Math.round(78 * t)},${Math.round(46 * t)},${rr(0.5, 0.95).toFixed(2)})`;
    g.lineWidth = rr(0.6, 1.3);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(dir) * len, y + Math.sin(dir) * len); g.stroke();
  }
  return c;
}

/** The surface of a dense cypress: dark, vertically streaked, almost black in
    the shade. Used on the revolved body so it does not read as painted green. */
function makeCypressSurface() {
  const S = 512, c = cv(S), g = c.getContext('2d');
  g.fillStyle = '#465c36'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 1800; i++) {
    const x = rnd() * S, y = rnd() * S, len = rr(10, 60), t = rr(0.65, 1.5);
    g.strokeStyle = t > 1
      ? `rgba(${Math.round(122 * (t - 0.35))},${Math.round(146 * (t - 0.35))},${Math.round(84 * (t - 0.35))},${rr(0.2, 0.55).toFixed(2)})`
      : `rgba(${Math.round(46 * t)},${Math.round(64 * t)},${Math.round(34 * t)},${rr(0.3, 0.7).toFixed(2)})`;
    g.lineWidth = rr(1, 4);
    g.beginPath(); g.moveTo(x, y);
    g.quadraticCurveTo(x + rr(-6, 6), y + len * 0.5, x + rr(-10, 10), y + len);
    g.stroke();
  }
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(150,172,102,.18)' : 'rgba(26,36,20,.20)';
    g.fillRect(rnd() * S, rnd() * S, rr(0.8, 2.2), rr(2, 7));
  }
  return c;
}

/** Soft radial shade for a contact shadow decal. */
function makeContactShadowTexture() {
  const S = 128, c = cv(S), g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(0,0,0,.60)');
  grd.addColorStop(0.38, 'rgba(0,0,0,.42)');
  grd.addColorStop(0.72, 'rgba(0,0,0,.14)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
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
let THREE = null;   /* the namespace, loaded once and shared by every instance */

/* ─────────────────────────────────────────────────────────────────────────────
   createWalkthrough — everything below runs on the first call for a container.
   The site defers it with an IntersectionObserver (800px of runway); a Framer
   section calls it on mount. Until then this module has done nothing but read a
   few matchMedia results: no three.js download, no shader compile, no
   procedural texture, no render loop.
   ───────────────────────────────────────────────────────────────────────────── */
export async function createWalkthrough(container, options = {}) {
  if (!container || !container.nodeType) throw new Error('createWalkthrough: a container element is required');
  const opts = { ...DEFAULTS, ...options };
  /* an explicit undefined (an unset data- attribute, an optional prop) must not
     wipe out a default: it is the same as not passing it at all */
  for (const k of Object.keys(opts)) if (opts[k] === undefined) opts[k] = DEFAULTS[k];
  /* the render harness and the Framer preview can drive the look from the URL:
     ?tod=golden&cover=0.2&grass=0.6&palms=0&quality=lite                      */
  if (typeof location !== 'undefined' && location.search) {
    const q = new URLSearchParams(location.search);
    if (q.has('tod')) opts.timeOfDay = q.get('tod');
    if (q.has('cover')) opts.cloudCover = parseFloat(q.get('cover'));
    if (q.has('grass')) opts.grassDensity = parseFloat(q.get('grass'));
    if (q.has('palms')) opts.palms = q.get('palms') !== '0';
    if (q.has('quality')) opts.quality = q.get('quality');
  }

  /* ── environment ──────────────────────────────────────────────────────────
     The device tier is decided from the container's own width, not the window's,
     so a narrow column inside a wide page still gets the light tier.          */
  const REDUCED = opts.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hostW = container.clientWidth || window.innerWidth;
  const lite = opts.quality === 'lite' || (opts.quality === 'auto' && (hostW <= 820 ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 1100)));
  const MOBILE = lite;
  /* tablet sits between the phone tier and the full desktop tier */
  const TABLET = !MOBILE && opts.quality === 'auto' && Math.min(hostW, window.innerWidth) <= 1024;
  /* the drawing buffer is never larger than this, whatever the device reports:
     1.25× is already retina-crisp for this soft, painterly render and costs a
     quarter of the fragments of a 2× buffer. */
  const DPR_MAX = opts.dprMax != null ? opts.dprMax : (MOBILE ? 1.25 : (TABLET ? 1.35 : 1.5));

  const section = container;
  let canvas = container.querySelector('canvas');
  let ownsCanvas = false;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'shadestate-canvas';
    container.appendChild(canvas);
    ownsCanvas = true;
  }
  if (ownsCanvas) {
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    canvas.setAttribute('aria-label', 'Procedural three-dimensional view of Casa da Luz');
    canvas.setAttribute('role', 'img');
  }
  canvas.classList.add('is-loading');

  function fail(err) {
    console.error(err);
    canvas.classList.remove('is-loading');
    if (container) container.classList.add('no-webgl');
    document.documentElement.classList.add('no-webgl');
  }

  let renderer = null;
  /* A host may hand its own three.js in (the Framer component passes the npm
     namespace, the embed bundle passes the copy inlined beside this code), so
     the module never has to fetch one. */
  if (!THREE) THREE = opts.three || null;
  if (!THREE) {
    let url = opts.threeUrl || '';
    if (!url) {
      try { url = new URL('./vendor/three.module.js', import.meta.url).href; }
      catch (_) { url = './vendor/three.module.js'; }
    }
    THREE = await import(/* @vite-ignore */ url);
  }

  try {
    renderer = new THREE.WebGLRenderer({
      canvas, antialias: !MOBILE && opts.quality !== 'lite' && !/[?&]aa=0/.test(location.search), powerPreference: 'high-performance', alpha: false, stencil: false,
      // only for screenshot tooling: lets the harness read the drawing buffer back
      preserveDrawingBuffer: /[?&]capture=1/.test(location.search)
    });
  } catch (err) { fail(err); }

  if (!renderer) return null;

  {
    try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_MAX));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.info.autoReset = false;
    renderer.autoClear = true;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xd9d0bd, 0.0027);
    /* hooks the look controls fill in later (sky rebuild, palm toggle) */
    let setSky = null;
    let setPalms = () => {};
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 900);

    /* ── sky + environment ───────────────────────────────────────────────
       One equirect canvas: v 0 is the zenith, v 0.5 the horizon. Stops are
       authored in degrees of elevation, because the camera only ever sees the
       bottom 20 degrees: the azure has to hold all the way down to a thin
       warm glow at the ridge, which is what reads as a deep sky.

       The clouds are a real cloud field, not wisps painted on: value-noise
       fBm, domain-warped, evaluated over the band the camera can see, then
       shaded from its own gradient — bright where the field rises toward the
       sun, blue-grey where it falls away. It costs one pass over a half-res
       buffer at boot and nothing per frame, and because the same texture is
       the PMREM environment, every reflection carries the sky the eye sees. */

    const SKY_PRESETS = {
      morning: {
        stops: [[0, '#3f74ad'], [78, '#4378b2'], [58, '#487eb8'], [38, '#4f88c2'],
          [24, '#5b95cb'], [15, '#6ba5d5'], [10, '#7aaed9'], [6.5, '#90bddc'],
          [5.0, '#a3c8dc'], [3.8, '#bcd2d6'], [2.8, '#d3d6c8'], [2.0, '#e4dcc4'],
          [1.2, '#f1e4c8'], [0.5, '#f9edd3']],
        horizon: '#ded4bf', below: ['#d9d0bd', '#b9b09b', '#8b8270', '#4b4538'],
        sun: [-0.86, 0.30, 0.41], sunCol: [1.55, 1.02, 0.64], sunInt: 4.6, light: 0xffd2a0,
        sunGlow: 'rgba(255,247,224,.88)', lit: [253, 249, 238], shade: [176, 187, 208],
        fog: 0xd9d0bd
      },
      noon: {
        stops: [[0, '#2f66a8'], [78, '#3370af'], [58, '#3a78b8'], [38, '#4485c4'],
          [24, '#4f92ce'], [15, '#5fa2d8'], [10, '#6fafe0'], [6.5, '#84bde5'],
          [5.0, '#9bcbe8'], [3.8, '#b6d8e4'], [2.8, '#cfe0d8'], [2.0, '#e2e6cf'],
          [1.2, '#f0eccf'], [0.5, '#f8f0d8']],
        horizon: '#e2dbc8', below: ['#ded9c8', '#c0baa4', '#958c76', '#544d3f'],
        sun: [-0.55, 0.78, 0.30], sunCol: [1.45, 1.26, 1.02], sunInt: 5.4, light: 0xfff4e2,
        sunGlow: 'rgba(255,252,240,.92)', lit: [253, 252, 248], shade: [172, 184, 206],
        fog: 0xded9c8
      },
      golden: {
        stops: [[0, '#3a5f96'], [78, '#3f66a0'], [58, '#466faa'], [38, '#537fb6'],
          [24, '#6490c2'], [15, '#7fa2cc'], [10, '#9ab4d2'], [6.5, '#b8c3cd'],
          [5.0, '#d0cbc2'], [3.8, '#e2d2b6'], [2.8, '#edd6ac'], [2.0, '#f4dcac'],
          [1.2, '#f9e3b6'], [0.5, '#fdecc8']],
        horizon: '#e2d2b8', below: ['#dccbac', '#c2ac8c', '#96826a', '#4e4638'],
        sun: [-0.94, 0.16, 0.32], sunCol: [1.75, 1.02, 0.52], sunInt: 4.2, light: 0xffc78a,
        sunGlow: 'rgba(255,236,198,.90)', lit: [255, 236, 208], shade: [168, 168, 190],
        fog: 0xdccbac
      },
      dusk: {
        stops: [[0, '#22355e'], [78, '#263a64'], [58, '#2c426d'], [38, '#394f7c'],
          [24, '#4a5c88'], [15, '#657092'], [10, '#84849a'], [6.5, '#a89a98'],
          [5.0, '#c4a68d'], [3.8, '#d9a878'], [2.8, '#e8ae70'], [2.0, '#f0b677'],
          [1.2, '#f5c489'], [0.5, '#f8d3a2']],
        horizon: '#ddc3a0', below: ['#c9b39a', '#b08867', '#82685a', '#3c3630'],
        sun: [-0.96, 0.075, 0.28], sunCol: [1.85, 0.86, 0.40], sunInt: 3.4, light: 0xffa968,
        sunGlow: 'rgba(255,214,160,.92)', lit: [252, 224, 190], shade: [138, 142, 168],
        fog: 0xc9b39a
      }
    };

    function makeSky(presetName = 'morning', cover = 0.55) {
      const P = SKY_PRESETS[presetName] || SKY_PRESETS.morning;
      const W = MOBILE ? 1024 : (TABLET ? 1536 : 2048), H = W / 2;
      const c = cv(W, H), g = c.getContext('2d');
      const deg = (d) => 0.5 - d / 180;

      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0.000, P.stops[0][1]);
      // d = 0 would land on v = 0.5, the horizon — a duplicate of the zenith
      // colour there drew a blue hairline across the horizon
      for (const [d, col] of P.stops) if (d > 0) grad.addColorStop(deg(d), col);
      grad.addColorStop(0.500, P.horizon);
      grad.addColorStop(0.512, P.below[0]);
      grad.addColorStop(0.545, P.below[1]);
      grad.addColorStop(0.640, P.below[2]);
      grad.addColorStop(1.000, P.below[3]);
      g.fillStyle = grad; g.fillRect(0, 0, W, H);

      const SUN = new THREE.Vector3(P.sun[0], P.sun[1], P.sun[2]).normalize();
      const u = Math.atan2(SUN.z, SUN.x) / (Math.PI * 2) + 0.5;
      const v = 1 - (Math.asin(SUN.y) / Math.PI + 0.5);
      const sx = u * W, sy = v * H;

      /* ── the cloud field ─────────────────────────────────────────────────
         Half res, one band. Domain-warped fBm gives mounds with soft edges;
         its own gradient lights them, so the sun side of a cumulus is warm and
         the underside cools to the sky. cover 0 is clear, 1 is overcast.    */
      if (cover > 0.02) {
        const CW = Math.round(W / 2), CH = Math.round(H / 2);
        const elTop = 64, elBot = 2.5;                       // degrees
        const y0 = Math.round(deg(elTop) * CH), y1 = Math.round(deg(elBot) * CH);
        const bandH = y1 - y0;
        const y0Full = Math.round(deg(elTop) * H);   // where the band lands on the sky canvas
        const field = new Float32Array(CW * bandH);

        const hash = (x, yy) => {
          const s = Math.sin(x * 127.1 + yy * 311.7) * 43758.5453;
          return s - Math.floor(s);
        };
        const vnoise = (x, yy) => {
          const xi = Math.floor(x), yi = Math.floor(yy);
          const xf = x - xi, yf = yy - yi;
          const uu = xf * xf * (3 - 2 * xf), vv = yf * yf * (3 - 2 * yf);
          const a = hash(xi, yi), b = hash(xi + 1, yi), cc = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
          return (a + (b - a) * uu) * (1 - vv) + (cc + (d - cc) * uu) * vv;
        };
        const fbm = (x, yy, oct) => {
          let s = 0, amp = 0.5, f = 1;
          for (let o = 0; o < oct; o++) { s += amp * vnoise(x * f, yy * f); f *= 2.03; amp *= 0.5; }
          return s;
        };

        // a mottled, horizontally-stretched base field
        for (let y = 0; y < bandH; y++) {
          const el = elTop - ((y / bandH) * (elTop - elBot));
          const stretch = 1 / Math.max(0.35, Math.cos((el * Math.PI) / 180));
          for (let x = 0; x < CW; x++) {
            const ax = (x / CW) * 6.2832;
            const px = Math.cos(ax) * 2.4 * stretch + Math.sin(ax * 3.0) * 0.4;
            const py = (el / 180) * 12.0;
            const warp = fbm(px * 1.7 + 11.3, py * 1.7 + 4.1, 3) - 0.5;
            field[y * CW + x] = fbm(px * 1.05 + warp * 1.5, py * 2.1 - warp * 1.1, 5);
          }
        }

        // vertical structure: cumulus low, cirrus high, haze at the ridge
        const cloudCanvas = cv(CW, bandH);
        const cctx = cloudCanvas.getContext('2d');
        const img = cctx.createImageData(CW, bandH);
        const data = img.data;
        const [lr, lg, lb] = P.lit, [sr, sg, sb] = P.shade;
        const sunAz = u;
        for (let y = 0; y < bandH; y++) {
          const el = elTop - ((y / bandH) * (elTop - elBot));
          const cum = smoothstep(7.0, 12.0, el) * (1 - smoothstep(26, 42, el));
          const cir = smoothstep(34, 46, el) * (1 - smoothstep(56, 64, el));
          // both ends of the band dissolve, so there is no cut edge, and the
          // low clouds thin out into the horizon haze the way real ones do
          const edge = smoothstep(elBot, elBot + 7.0, el) * (1 - smoothstep(elTop - 9, elTop, el))
                     * (0.30 + 0.70 * smoothstep(6.0, 18.0, el));
          const band = Math.max(cum, cir * 0.45) * edge;
          const base = 0.62 - 0.34 * cover;
          for (let x = 0; x < CW; x++) {
            const f = field[y * CW + x];
            const gx = field[y * CW + Math.min(CW - 1, x + 1)] - field[y * CW + Math.max(0, x - 1)];
            const gy = field[Math.min(bandH - 1, y + 1) * CW + x] - field[Math.max(0, y - 1) * CW + x];
            let dens = smoothstep(base - 0.04, base + 0.24, f) * band;
            if (dens <= 0.001) continue;
            // shade from the field's own gradient, lit from the sun's azimuth
            const az = (x / CW) * Math.PI * 2;
            const lx = Math.cos(sunAz * Math.PI * 2), ly = -0.55;
            const light = clamp(0.74 + (gx * lx + gy * ly) * 15.0, 0.26, 1.12);
            const warm = clamp(1 - Math.abs(((az - sunAz * Math.PI * 2 + Math.PI * 3) % (Math.PI * 2)) - Math.PI) / 1.6, 0, 1);
            const r = lerp(sr, Math.min(255, lr + 12 * warm), light);
            const gg = lerp(sg, lg, light);
            const b = lerp(sb, lb, light);
            dens *= 0.94;
            const p4 = (y * CW + x) * 4;
            data[p4] = r;
            data[p4 + 1] = gg;
            data[p4 + 2] = b;
            data[p4 + 3] = Math.round(dens * 255);
          }
        }
        cctx.putImageData(img, 0, 0);
        // scaled up by the canvas itself: soft, and no half-res grid
        g.imageSmoothingEnabled = true;
        g.drawImage(cloudCanvas, 0, y0Full, W, bandH * 2);
      }

      /* ── the sun ───────────────────────────────────────────────────────── */
      const glow = g.createRadialGradient(sx, sy, 0, sx, sy, W * 0.16);
      glow.addColorStop(0.00, P.sunGlow);
      glow.addColorStop(0.10, 'rgba(255,232,192,.34)');
      glow.addColorStop(0.32, 'rgba(255,216,168,.10)');
      glow.addColorStop(1.00, 'rgba(255,206,158,0)');
      g.fillStyle = glow; g.fillRect(0, 0, W, H);

      const disc = g.createRadialGradient(sx, sy, 0, sx, sy, 44);
      disc.addColorStop(0.00, 'rgba(255,255,250,1)');
      disc.addColorStop(0.18, 'rgba(255,248,228,.98)');
      disc.addColorStop(0.36, 'rgba(255,228,182,.5)');
      disc.addColorStop(1.00, 'rgba(255,218,170,0)');
      g.fillStyle = disc; g.beginPath(); g.arc(sx, sy, 44, 0, 7); g.fill();

      /* A hair of haze right on the horizon, so the far ridge melts into the
         glow instead of sitting on a hard line.                            */
      const haze = g.createLinearGradient(0, deg(13), 0, deg(-3));
      haze.addColorStop(0.00, 'rgba(232,222,203,0)');
      haze.addColorStop(0.52, 'rgba(232,221,200,.26)');
      haze.addColorStop(0.80, 'rgba(228,217,196,.52)');
      haze.addColorStop(0.93, 'rgba(224,213,192,.70)');
      haze.addColorStop(1.00, 'rgba(220,210,190,0)');
      g.fillStyle = haze; g.fillRect(0, deg(13) * H, W, (deg(-3) - deg(13)) * H);

      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.mapping = THREE.EquirectangularReflectionMapping;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      return t;
    }

    let skyTexture = makeSky(opts.timeOfDay, opts.cloudCover);
    const SUN_DIR = new THREE.Vector3(...(SKY_PRESETS[opts.timeOfDay] || SKY_PRESETS.morning).sun).normalize();
    scene.background = skyTexture;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    scene.environment = pmrem.fromEquirectangular(skyTexture).texture;

    /* ── sun ───────────────────────────────────────────────────────────── */
    const SUN_P0 = SKY_PRESETS[opts.timeOfDay] || SKY_PRESETS.morning;
    const sun = new THREE.DirectionalLight(SUN_P0.light ?? 0xffd2a0, SUN_P0.sunInt);
    sun.position.copy(SUN_DIR).multiplyScalar(120);
    sun.target.position.set(-1, 0, -1);
    sun.castShadow = true;
    const SM = MOBILE ? 1024 : (TABLET ? 1280 : 1536);
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

    /* Rebuild the sky, the light and the environment for a preset. Used by the
       Framer look controls; costs one canvas pass and one PMREM bake. */
    setSky = (name, cvr) => {
      const P = SKY_PRESETS[name] || SKY_PRESETS.morning;
      const old = skyTexture;
      skyTexture = makeSky(name, cvr);
      scene.background = skyTexture;
      scene.environment = pmrem.fromEquirectangular(skyTexture).texture;
      if (old) old.dispose();
      sun.color.set(P.light ?? 0xffd2a0);
      sun.intensity = P.sunInt;
      SUN_DIR.set(P.sun[0], P.sun[1], P.sun[2]).normalize();
      sun.position.copy(SUN_DIR).multiplyScalar(120);
      sun.target.updateMatrixWorld();
      scene.fog.color.setHex(P.fog);
      renderer.shadowMap.needsUpdate = true;
      if (waterUniforms) {
        waterUniforms.uSunDir.value.copy(SUN_DIR);
        waterUniforms.uSunElev.value = SUN_DIR.y;
        waterUniforms.uFogCol.value.setHex(P.fog);
        waterUniforms.uSkyCol.value.copy(new THREE.Color(P.stops[3][1]));
      }
      if (grassUniforms) {
        grassUniforms.uSunDir.value.copy(SUN_DIR);
        grassUniforms.uFogCol.value.setHex(P.fog);
      }
      if (post) post.compMat.uniforms.uExposure.value = renderer.toneMappingExposure;
      drawFrame();
      return true;
    };

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
    let grassSetDensity = null;

    function windify(mat, { amp = 0.05, freq = 1.0, height = 2.6, base = 0.4, soft = 0 } = {}) {
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
        /* Leaves are thin and translucent: a card's flat normal turns every
           leaf that faces away from the sun black, which is what makes cheap
           foliage read as confetti. Pulling the shading normal toward the sky
           gives a canopy lit by the whole dome rather than by one plane. */
        if (soft > 0) {
          shader.fragmentShader = shader.fragmentShader
            .replace(
              '#include <normal_fragment_maps>',
              `#include <normal_fragment_maps>
               normal = normalize(mix(normal, vec3(0.0, 1.0, 0.0), ${soft.toFixed(2)}));`
            )
            /* and a fill from the sky the canopy sits in: without it every leaf
               that turns away from the sun is black, which is what a backlit
               tree looks like when it is made of cardboard */
            .replace(
              '#include <lights_fragment_end>',
              `#include <lights_fragment_end>
               totalEmissiveRadiance += diffuseColor.rgb * vec3(0.085, 0.105, 0.062);`
            );
        }
      };
      mat.customProgramCacheKey = () => `wind${amp}${freq}${height}${base}${soft}`;
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
    const boucle = makeBoucle([224, 213, 196]);
    const rugTex = makeRug();
    const oakWood = makeWoodGrain([150, 108, 74], [82, 54, 34], [196, 158, 120]);
    const walnutWood = makeWoodGrain([104, 70, 46], [46, 28, 16], [156, 112, 78]);
    const palmTex = makePalmBark();
    const aoTex = tex(makeContactShadowTexture());

    /** Same texture with the grain turned through 90 degrees, for panels and
        slats whose long axis runs up the v of a world-space UV.            */
    function texV(canvasEl, repeat = [1, 1]) {
      const t = tex(canvasEl, { repeat });
      t.center.set(0.5, 0.5);
      t.rotation = Math.PI / 2;
      return t;
    }

    const M = {
      stone: weather(new THREE.MeshStandardMaterial({
        map: tex(stoneA.map, { srgb: true }),
        normalMap: tex(stoneA.normal),
        roughnessMap: tex(stoneA.rough),
        roughness: 1.0, metalness: 0.0,
        normalScale: new THREE.Vector2(1.55, 1.55),
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
      oak: new THREE.MeshStandardMaterial({
        map: tex(oakWood.map, { srgb: true }),
        normalMap: tex(oakWood.normal),
        roughness: 0.54, metalness: 0.0,
        normalScale: new THREE.Vector2(0.55, 0.55),
        envMapIntensity: 0.75
      }),
      oakVert: new THREE.MeshStandardMaterial({
        map: texV(oakWood.map),
        normalMap: texV(oakWood.normal),
        roughness: 0.54, metalness: 0.0,
        normalScale: new THREE.Vector2(0.55, 0.55),
        envMapIntensity: 0.75
      }),
      walnut: new THREE.MeshStandardMaterial({
        map: tex(walnutWood.map, { srgb: true }),
        normalMap: tex(walnutWood.normal),
        roughness: 0.44, metalness: 0.0,
        normalScale: new THREE.Vector2(0.6, 0.6),
        envMapIntensity: 0.9
      }),
      walnutVert: new THREE.MeshStandardMaterial({
        map: texV(walnutWood.map),
        normalMap: texV(walnutWood.normal),
        roughness: 0.44, metalness: 0.0,
        normalScale: new THREE.Vector2(0.6, 0.6),
        envMapIntensity: 0.9
      }),
      oakDark: new THREE.MeshStandardMaterial({
        map: tex(walnutWood.map, { srgb: true, repeat: [1, 1] }),
        normalMap: tex(walnutWood.normal),
        color: 0xd9c4ac,
        roughness: 0.6, metalness: 0.0, envMapIntensity: 0.65
      }),
      boucle: new THREE.MeshStandardMaterial({
        map: tex(boucle.map, { srgb: true }),
        normalMap: tex(boucle.normal),
        normalScale: new THREE.Vector2(0.85, 0.85),
        roughness: 0.97, metalness: 0.0, envMapIntensity: 0.5
      }),
      rugWoven: new THREE.MeshStandardMaterial({
        map: tex(rugTex.map, { srgb: true, repeat: [2.6, 2.0] }),
        normalMap: tex(rugTex.normal, { repeat: [2.6, 2.0] }),
        normalScale: new THREE.Vector2(0.9, 0.9),
        color: 0xffffff,
        roughness: 0.98, metalness: 0.0, envMapIntensity: 0.2
      }),
      rugEdge: new THREE.MeshStandardMaterial({ color: 0x8b7757, roughness: 0.98, envMapIntensity: 0.2 }),
      ceramic: new THREE.MeshStandardMaterial({ color: 0xe9e2d4, roughness: 0.38, metalness: 0.0, envMapIntensity: 1.1 }),
      stoneVessel: new THREE.MeshStandardMaterial({ color: 0xa89b86, roughness: 0.66, metalness: 0.0, envMapIntensity: 0.8 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xb08a4e, roughness: 0.26, metalness: 1.0, envMapIntensity: 1.7 }),
      bronze: new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.33, metalness: 0.92, envMapIntensity: 1.5 }),
      plaster: new THREE.MeshStandardMaterial({ color: 0xf1eade, roughness: 0.96, metalness: 0.0, envMapIntensity: 0.2 }),
      glass: (() => {
        const m = new THREE.MeshPhysicalMaterial({
          color: 0xb8cbc8, metalness: 0.0, roughness: 0.028,
          transparent: true, opacity: 0.34, ior: 1.52,
          clearcoat: 1.0, clearcoatRoughness: 0.02,
          envMapIntensity: 2.0, side: THREE.DoubleSide, depthWrite: false,
          specularIntensity: 1.0
        });
        // real glass is clear face-on and a mirror at grazing angles: drive the
        // alpha and a little extra sky bounce from the Fresnel term
        m.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
             float ndv = clamp(abs(dot(normalize(geometryNormal), normalize(vViewPosition))), 0.0, 1.0);
             float fres = pow(1.0 - ndv, 3.0);
             gl_FragColor.a = clamp(mix(0.12, 0.86, fres), 0.0, 1.0);
             gl_FragColor.rgb += vec3(0.34, 0.41, 0.44) * fres;`
          );
        };
        m.customProgramCacheKey = () => 'glassfresnel';
        return m;
      })(),
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
      oliveBark: new THREE.MeshStandardMaterial({
        map: tex(bark.map, { srgb: true }),
        normalMap: tex(bark.normal),
        normalScale: new THREE.Vector2(1.35, 1.35),
        color: 0xc9c4b4,
        roughness: 1.0, metalness: 0.0, envMapIntensity: 0.55,
        side: THREE.DoubleSide
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
      }), { amp: 0.075, freq: 1.2, height: 3.2, soft: 0.58 }),
      glow: new THREE.MeshBasicMaterial({
        map: tex(makeGlowTexture(), { srgb: true }),
        transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide
      }),
      art: new THREE.MeshStandardMaterial({
        map: tex(makeArtwork(), { srgb: true }),
        roughness: 0.88, metalness: 0.0, envMapIntensity: 0.3
      }),
      cypress: windify(new THREE.MeshStandardMaterial({
        map: tex(makeCypressSurface(), { srgb: true }),
        roughness: 0.97, metalness: 0.0, envMapIntensity: 0.28
      }), { amp: 0.05, freq: 1.05, height: 3.6, base: 0.5, soft: 0.5 }),
      needle: windify(new THREE.MeshStandardMaterial({
        map: tex(makeNeedleCluster(), { srgb: true }),
        alphaTest: 0.3, side: THREE.DoubleSide, color: 0xd6ddc0,
        roughness: 0.94, metalness: 0.0, envMapIntensity: 0.45
      }), { amp: 0.065, freq: 1.2, height: 3.6, base: 0.5, soft: 0.55 }),
      palmBark: new THREE.MeshStandardMaterial({
        map: tex(palmTex.map, { srgb: true }),
        color: 0xb2a48c,
        normalMap: tex(palmTex.normal),
        normalScale: new THREE.Vector2(1.25, 1.25),
        roughness: 0.94, metalness: 0.0, envMapIntensity: 0.35
      }),
      palmCrown: new THREE.MeshStandardMaterial({
        map: tex(palmTex.map, { srgb: true }),
        color: 0x8d8a5e,
        normalMap: tex(palmTex.normal),
        normalScale: new THREE.Vector2(1.0, 1.0),
        roughness: 0.86, metalness: 0.0, envMapIntensity: 0.4
      }),
      palmRachis: new THREE.MeshStandardMaterial({
        color: 0x6d7641, roughness: 0.82, metalness: 0.0, envMapIntensity: 0.4
      }),
      palmLeaf: windify(new THREE.MeshStandardMaterial({
        color: 0x7b8352, vertexColors: true, roughness: 0.88, metalness: 0.0,
        side: THREE.DoubleSide, envMapIntensity: 0.35
      }), { amp: 0.075, freq: 0.85, height: 3.8, base: 0.5, soft: 0.38 }),
      palmDry: windify(new THREE.MeshStandardMaterial({
        color: 0x9c8358, vertexColors: true, roughness: 0.96, metalness: 0.0,
        side: THREE.DoubleSide, envMapIntensity: 0.32
      }), { amp: 0.05, freq: 1.15, height: 3.8, base: 0.5, soft: 0.34 }),
      dates: new THREE.MeshStandardMaterial({ color: 0xb06b2c, roughness: 0.58, metalness: 0.0, envMapIntensity: 0.7 }),
      ao: new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity: 0.5, depthWrite: false }),
      aoSoft: new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity: 0.26, depthWrite: false })
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
      let vCount = 0, iCount = 0, anyColor = false;
      for (const g of geos) {
        vCount += g.attributes.position.count;
        iCount += g.index ? g.index.count : g.attributes.position.count;
        if (g.attributes.color) anyColor = true;
      }
      const pos = new Float32Array(vCount * 3);
      const nor = new Float32Array(vCount * 3);
      const uv = new Float32Array(vCount * 2);
      const col = anyColor ? new Float32Array(vCount * 3).fill(1) : null;
      const idx = new Uint32Array(iCount);
      let vo = 0, io = 0;
      for (const g of geos) {
        const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv, cattr = g.attributes.color;
        pos.set(p.array.subarray(0, p.count * 3), vo * 3);
        if (n) nor.set(n.array.subarray(0, n.count * 3), vo * 3);
        if (u) uv.set(u.array.subarray(0, u.count * 2), vo * 2);
        if (col && cattr) col.set(cattr.array.subarray(0, cattr.count * 3), vo * 3);
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
      if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
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

    /**
     * A soft-edged box: every vertex is clamped into an inner box and pushed
     * back out by the bevel radius. That is a rounded rectangle in three
     * dimensions, which is what a cushion, a plaster reveal or a stone edge
     * actually is; a hard-box corner is what makes cheap furniture read cheap.
     */
    function roundedBoxGeo(w, h, d, r, seg = 2) {
      const geo = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
      const p = geo.attributes.position;
      const ix = Math.max(0, w / 2 - r), iy = Math.max(0, h / 2 - r), iz = Math.max(0, d / 2 - r);
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const cx = clamp(v.x, -ix, ix), cy = clamp(v.y, -iy, iy), cz = clamp(v.z, -iz, iz);
        const dx = v.x - cx, dy = v.y - cy, dz = v.z - cz;
        const l = Math.hypot(dx, dy, dz) || 1;
        p.setXYZ(i, cx + (dx / l) * r, cy + (dy / l) * r, cz + (dz / l) * r);
      }
      geo.computeVertexNormals();
      return geo;
    }

    function addSoft(w, h, d, r, x, y, z, mat, opts = {}) {
      const geo = roundedBoxGeo(w, h, d, r, opts.seg ?? 2);
      if (opts.uv) worldUV(geo, opts.uv);
      if (opts.rx) geo.rotateX(opts.rx);
      if (opts.rz) geo.rotateZ(opts.rz);
      if (opts.ry) geo.rotateY(opts.ry);
      geo.translate(x, y, z);
      queue(geo, mat, opts.cast !== false, opts.receive !== false, opts.order || 0);
    }

    /** A thrown vessel: a lathe around an authored profile. */
    function addLathe(profile, x, y, z, mat, segs = 24, opts = {}) {
      const pts = profile.map(([r, h]) => new THREE.Vector2(Math.max(0.001, r), h));
      const geo = new THREE.LatheGeometry(pts, segs);
      geo.computeVertexNormals();
      geo.translate(x, y, z);
      queue(geo, mat, opts.cast !== false, opts.receive !== false, opts.order || 0);
    }

    /** A baked contact shadow, so a lounger or a stair tread sits on the ground. */
    function contactShadow(x, z, w, d, soft = false, y = 0.028, rot = 0) {
      const geo = new THREE.PlaneGeometry(w, d);
      geo.rotateX(-Math.PI / 2);
      if (rot) geo.rotateY(rot);
      geo.translate(x, y, z);
      queue(geo, soft ? M.aoSoft : M.ao, false, false, 2);
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
    /* The meadow runs out to where the fog takes it, not to a visible edge:
       at ±260 m its edge drew a bright line across the horizon.           */
    const EXT = 900;
    const groundQuads = [
      [-EXT, EXT, POOLG.z1, EXT],
      [-EXT, EXT, -EXT, POOLG.z0],
      [-EXT, POOLG.x0, POOLG.z0, POOLG.z1],
      [POOLG.x1, EXT, POOLG.z0, POOLG.z1]
    ];
    for (const [x0, x1, z0, z1] of groundQuads) {
      addPlane(x1 - x0, z1 - z0, (x0 + x1) / 2, -0.06, (z0 + z1) / 2, M.meadow, {
        seg: Math.min(96, Math.max(8, Math.round((x1 - x0) / 22))), uv: 1 / 9, bend
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
        // the shoulder only: start clear of the gravel ribbon itself
        const off = (lerp(1.65, 1.25, t) + lerp(0.06, 0.55, rnd())) * side;
        d.position.set(p.x + nrm.x * off, 0.02, p.z + nrm.z * off);
        const s = rr(0.045, 0.11);
        d.scale.set(s * rr(1, 2.0), s * rr(0.45, 0.8), s * rr(1, 2.0));
        d.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
        d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      world.add(inst);
    }

    /* The horizon is the meadow itself. Its own bend, plus the fog, gives the
       far country its shape; separate hill geometry only ever drew a bright
       rim above it or poked through it as a brown patch.                    */

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
      uSkyCol: { value: new THREE.Color(0.22, 0.40, 0.66) },
      uFogCol: { value: new THREE.Color(0.69, 0.63, 0.51) },
      uFogDensity: { value: 0.0027 },
      uRipples: { value: clamp(opts.waterRipples, 0, 3) },
      uMin: { value: new THREE.Vector2(POOL.x0, POOL.z0) },
      uMax: { value: new THREE.Vector2(POOL.x1, POOL.z1) },
      uSunElev: { value: SUN_DIR.y }
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
        uniform float uRipples;
        uniform vec2 uMin;
        uniform vec2 uMax;
        uniform float uSunElev;
        varying vec2 vScreen;
        varying vec3 vWorld;
        varying vec3 vToEye;

        void main() {
          vec2 uv = vWorld.xz;

          /* three wave trains at different scales and speeds: a long swell, a
             chop, and the fine cat's-paws that catch the light */
          vec3 a = texture2D(tNormal, uv * 0.085 + vec2(uTime * 0.014, uTime * 0.008)).rgb * 2.0 - 1.0;
          vec3 b = texture2D(tNormal, uv * 0.031 - vec2(uTime * 0.007, -uTime * 0.010)).rgb * 2.0 - 1.0;
          vec3 c = texture2D(tNormal, uv * 0.24 + vec2(-uTime * 0.030, uTime * 0.024)).rgb * 2.0 - 1.0;
          vec3 d2 = texture2D(tNormal, uv * 0.62 - vec2(uTime * 0.052, -uTime * 0.041)).rgb * 2.0 - 1.0;
          float amp = uRipples;
          vec2 slope = (a.xy * 0.50 + b.xy * 0.66 + c.xy * 0.26 + d2.xy * 0.10) * amp;
          slope = clamp(slope, -1.4, 1.4);

          /* the normal is in world space, so the eye vector has to be too:
             mixing in the view-space one made dot(N, V) read as zero and the
             pool a flat sky mirror at every angle */
          vec3 V = normalize(cameraPosition - vWorld);
          float dist = length(vToEye);
          /* ripples flatten with distance, or the far end of the pool boils */
          float nearK = 1.0 - smoothstep(9.0, 34.0, dist) * 0.66;
          vec3 N = normalize(vec3(slope.x * 0.20, 1.0, slope.y * 0.20));
          N = normalize(mix(vec3(0.0, 1.0, 0.0), N, nearK * 0.85 + 0.15));

          float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 5.0);

          vec3 refl;
          if (uHasReflect > 0.5) {
            // the whole surface bends the mirror, so the house in the water is
            // never a clean copy of the house above it
            vec2 wob = N.xz * (0.10 + 0.06 * amp);
            vec2 ruv = clamp(vScreen + wob, vec2(0.002), vec2(0.998));
            refl = texture2D(tReflect, ruv).rgb * 0.62
                 + texture2D(tReflect, clamp(ruv + vec2(uReflectTexel.x * 1.6, 0.0), vec2(0.002), vec2(0.998))).rgb * 0.19
                 + texture2D(tReflect, clamp(ruv - vec2(uReflectTexel.x * 1.6, 0.0), vec2(0.002), vec2(0.998))).rgb * 0.19;
          } else {
            vec3 R = reflect(-V, N);
            refl = mix(uSkyCol, uFogCol, smoothstep(0.05, 0.62, R.y));
          }

          /* depth: the basin is 1.5 m deep and the water eats red first, so the
             body reads teal where it is deep and green-blue where the sun rakes
             in — and it is palest along the walls, where it is shallow */
          vec2 door = min(vWorld.xz - uMin, uMax - vWorld.xz);
          float edgeD = min(door.x, door.y);
          float shallow = 1.0 - smoothstep(0.0, 0.85, edgeD);
          uDeep * 1.0;
          vec3 body = mix(uDeep * 1.7, uShallow * 1.35, 0.22 + 0.55 * clamp(dot(N, uSunDir), 0.0, 1.0) + shallow * 0.45);
          body += uShallow * pow(max(c.x, 0.0), 3.0) * 0.35;

          refl *= vec3(0.82, 0.92, 0.98);
          vec3 col = mix(body, refl, clamp(fres * 2.0, 0.0, 0.97));

          /* the waterline: a dark line where the surface meets the coping, and
             a hair of light right against it */
          float rim = smoothstep(0.16, 0.0, edgeD);
          col = mix(col, col * 0.80, rim * 0.35);

          /* sun glitter: a tight core with a wide, wind-stretched falloff */
          vec3 H = normalize(uSunDir + V);
          float spec = pow(max(dot(N, H), 0.0), 720.0);
          col += uSunCol * spec * 3.4;
          float sparkle = pow(max(dot(N, H), 0.0), 110.0) * pow(max(c.x, 0.0), 2.0);
          col += uSunCol * sparkle * (0.55 + 0.45 * uSunElev);

          float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
          col = mix(col, uFogCol, clamp(fog, 0.0, 1.0));

          float alpha = mix(0.70, 0.99, clamp(fres * 1.25 + (1.0 - shallow) * 0.22, 0.0, 1.0));
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

    // vertical oak slats — real geometry, one instanced draw
    {
      const slatGeo = new THREE.BoxGeometry(0.045, 1, 0.12);
      const count = MOBILE ? 78 : 118;
      const slatMat = new THREE.MeshStandardMaterial({
        map: texV(oakWood.map, [1, 0.4]),
        normalMap: texV(oakWood.normal, [1, 0.4]),
        color: 0xb99772, roughness: 0.68, metalness: 0, envMapIntensity: 0.55
      });
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

    // entry portal — the deep recess the camera travels through
    addBox(1.0, 3.45, 1.35, -1.65, 1.72, A.z1 + 0.66, M.stone, { uv: 0.4 });
    addBox(1.0, 3.45, 1.35, 1.65, 1.72, A.z1 + 0.66, M.stone, { uv: 0.4 });
    addBox(2.4, 0.62, 1.35, 0, 3.28, A.z1 + 0.66, M.stone, { uv: 0.4 });
    addBox(5.6, 0.28, 3.2, 0.4, 3.72, A.z1 + 1.6, M.stonePale, { uv: 0.4 });
    addBox(5.7, 0.06, 3.3, 0.4, 3.89, A.z1 + 1.6, M.bronze, { uv: 0.4 });
    addBox(2.34, 0.05, 0.56, 0, DOOR.top - 0.02, A.z1, M.bronze, { uv: 0.5 });
    addBox(0.05, DOOR.top, 0.56, -1.17, DOOR.top / 2, A.z1, M.bronze, { uv: 0.5 });
    addBox(0.05, DOOR.top, 0.56, 1.17, DOOR.top / 2, A.z1, M.bronze, { uv: 0.5 });
    addBox(0.055, 2.86, 2.1, 2.25, 1.45, 4.62, M.walnutVert, { uv: 0.6 });
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
        addBox(0.085, 0.115, 3.06, x, cy, cz, M.oakVert, { uv: 0.7 });
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
        addBox(0.15, py, 0.15, x, py / 2, z, M.oakVert, { uv: 0.6 });
      }
      addBox(px1 - px0 + 0.5, 0.26, 0.18, (px0 + px1) / 2, py + 0.1, pz0, M.oakDark, { uv: 0.6 });
      addBox(px1 - px0 + 0.5, 0.26, 0.18, (px0 + px1) / 2, py + 0.1, pz1, M.oakDark, { uv: 0.6 });
      for (let x = px0 + 0.25; x <= px1 - 0.2; x += 0.24) {
        addBox(0.07, 0.15, pz1 - pz0 - 0.1, x, py + 0.24, (pz0 + pz1) / 2, M.oakVert, { uv: 0.7 });
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

      // chamfered arrises: a 45 degree strip bedded into each outer edge, so
      // the coping catches a highlight instead of ending in a knife edge
      const ch = (len, x, y, z, axisX) => {
        const g = new THREE.BoxGeometry(axisX ? len : 0.05, 0.05, axisX ? 0.05 : len);
        if (axisX) g.rotateX(Math.PI / 4); else g.rotateZ(Math.PI / 4);
        g.translate(x, y, z);
        queue(g, M.stonePale, true, true);
      };
      const cyA = yTop + 0.014;
      ch(ow + 0.14, px, cyA, pz - od / 2 + 0.08 - 0.132, true);
      ch(ow + 0.14, px, cyA, pz + od / 2 - 0.08 + 0.132, true);
      ch(od, px - ow / 2 + 0.08 - 0.132, cyA, pz, false);
      ch(od, px + ow / 2 - 0.08 + 0.132, cyA, pz, false);
      const cyB = byTop + 0.002;
      ch(bw + 0.12, bx, cyB, bz - bd / 2 + 0.07 - 0.112, true);
      ch(bw + 0.12, bx, cyB, bz + bd / 2 - 0.07 + 0.112, true);
      ch(bd, bx - bw / 2 + 0.07 - 0.112, cyB, bz, false);
      ch(bd, bx + bw / 2 - 0.07 + 0.112, cyB, bz, false);
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
    contactShadow(5.3, -8.55, 2.6, 1.15, true, 0.018);
    contactShadow(7.6, -8.55, 2.6, 1.15, true, 0.018);
    contactShadow(6.45, -8.55, 0.82, 0.82, true, 0.018);
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

      /** Three papery bracts round a small eye — drawn pale, tinted per instance. */
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
      // glass balustrade following the flight, not a floating pane
      {
        const z0 = 2.15, z1 = -1.35, y0 = 1.05, y1 = 4.47, hh = 1.02, px = -8.22;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([
          px, y0, z0, px, y1, z1, px, y0 + hh, z0, px, y1 + hh, z1
        ], 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
        g.setIndex([0, 1, 2, 1, 3, 2]);
        g.computeVertexNormals();
        const pane = new THREE.Mesh(g, M.glass);
        pane.renderOrder = 3;
        world.add(pane);
      }
      contactShadow(-9.0, 0.45, 1.7, 4.1, false, 0.03);
      contactShadow(-8.24, 0.1, 0.55, 3.9, true, 0.031);
      const hrPts = [];
      for (let i = 0; i <= 8; i++) {
        const s = i / 8;
        hrPts.push(new THREE.Vector3(-8.22, 1.05 + s * 3.42, 2.15 - s * 3.5));
      }
      const hr = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hrPts), 20, 0.028, 8), M.bronze);
      hr.castShadow = true; world.add(hr);
    }

    addWall({ axis: 'z', at: 7.0, from: -5.8, to: 3.0, y0: 0, y1: B.h, thick: 0.16, mat: M.plaster, uv: 0.4 });

    /* ── the living room ──────────────────────────────────────────────────
       Low bouclé sectional on a woven rug, a fluted oak coffee table with
       thrown vessels, one framed work on the limestone, and a brass linear
       pendant hung the full height of the hall. Every edge is bevelled: at
       walking pace nothing should read as a box.                          */
    {
      // rug: one tile, mapped 0..1 so its border lands on its own edge
      const g = new THREE.PlaneGeometry(4.7, 3.6);
      g.rotateX(-Math.PI / 2);
      g.translate(-5.0, 0.034, -3.5);
      queue(g, M.rugWoven, false, true);
    }

    // sectional sofa: plinth, seat cushions, leaning back cushions, arms, throw
    {
      const sx = -5.2, sz = -4.45;
      addSoft(3.42, 0.10, 1.0, 0.03, sx, 0.07, sz, M.dark, { uv: 0.5 });        // shadow gap
      addSoft(3.52, 0.28, 1.14, 0.06, sx, 0.27, sz, M.boucle, { uv: 0.55 });    // base
      for (let i = 0; i < 2; i++) {
        addSoft(1.68, 0.16, 1.02, 0.07, sx - 0.85 + i * 1.7, 0.485, sz + 0.04, M.boucle, { uv: 0.5, seg: 3 });
      }
      addSoft(3.52, 0.50, 0.20, 0.06, sx, 0.60, sz - 0.52, M.boucle, { uv: 0.55 }); // back frame
      for (let i = 0; i < 2; i++) {
        addSoft(1.64, 0.46, 0.24, 0.09, sx - 0.85 + i * 1.7, 0.68, sz - 0.42,
          M.boucle, { uv: 0.5, rx: -0.13, seg: 3 });
      }
      for (const ax of [sx - 1.76, sx + 1.76]) {
        addSoft(0.20, 0.40, 1.16, 0.09, ax, 0.44, sz, M.boucle, { uv: 0.5, seg: 3 });
      }
      // chaise return, west end, running into the room
      addSoft(1.02, 0.24, 1.5, 0.05, sx - 1.36, 0.26, -3.66, M.boucle, { uv: 0.55 });
      addSoft(0.96, 0.14, 1.42, 0.07, sx - 1.36, 0.46, -3.66, M.boucle, { uv: 0.5, seg: 3 });
      // throw cushions, each leaning a little differently
      const throws = [
        [-6.05, 0.72, -4.72, 0.44, M.linenB, 0.14, -0.22],
        [-4.35, 0.70, -4.74, 0.42, M.linenA, -0.10, -0.20],
        [-4.86, 0.66, -4.80, 0.38, M.boucle, 0.05, -0.26],
        [-6.40, 0.55, -3.30, 0.46, M.linenA, 0.42, 0.06]
      ];
      for (const [x, y, z, s, mat, rz, rx] of throws) {
        addSoft(s, s, 0.15, 0.06, x, y, z, mat, { uv: 0.6, rz, rx, seg: 3 });
      }

      // fluted oak coffee table: rounded top on two fluted drums
      const tx = -4.85, tz = -2.9;
      addSoft(1.74, 0.08, 0.88, 0.035, tx, 0.335, tz, M.walnut, { uv: 0.7, seg: 3 });
      for (const dx of [-0.46, 0.46]) {
        const drum = new THREE.CylinderGeometry(0.235, 0.26, 0.29, 22);
        worldUV(drum, 1.1);
        drum.translate(tx + dx, 0.155, tz);
        queue(drum, M.walnut, true, true);
        const flutes = MOBILE ? 12 : 18;
        for (let i = 0; i < flutes; i++) {
          const a = (i / flutes) * Math.PI * 2;
          const f = new THREE.CylinderGeometry(0.027, 0.029, 0.285, 6, 1, false);
          f.translate(tx + dx + Math.cos(a) * 0.247, 0.152, tz + Math.sin(a) * 0.247);
          queue(f, M.walnut, true, false);
        }
      }
      // thrown pieces: a tall ceramic, a stone bowl, a stack of books
      addLathe([[0.001, 0], [0.055, 0.006], [0.078, 0.10], [0.048, 0.21], [0.052, 0.30], [0.036, 0.35]],
        -5.28, 0.375, -2.94, M.ceramic, 24);
      addLathe([[0.001, 0], [0.075, 0], [0.135, 0.02], [0.158, 0.085], [0.148, 0.098], [0.128, 0.072], [0.062, 0.013], [0.001, 0.012]],
        -4.58, 0.375, -3.02, M.stoneVessel, 24);
      addBox(0.34, 0.035, 0.24, -5.55, 0.392, -2.72, M.dark, { uv: 0.5 });
      addBox(0.31, 0.03, 0.22, -5.53, 0.424, -2.73, M.linenB, { uv: 0.6 });

      // a tall stone vessel standing on the floor by the window
      addLathe([[0.001, 0], [0.13, 0.01], [0.19, 0.22], [0.14, 0.48], [0.10, 0.62], [0.115, 0.70], [0.10, 0.72]],
        -8.55, 0.012, -1.55, M.stoneVessel, 26);

      // contact shadows for everything that stands on the floor
      contactShadow(-5.2, -4.45, 4.1, 1.7, false, 0.032);
      contactShadow(-6.56, -3.66, 1.5, 1.9, false, 0.032);
      contactShadow(-4.85, -2.9, 2.2, 1.35, false, 0.032);
      contactShadow(-8.55, -1.55, 0.86, 0.86, false, 0.032);
    }

    /* ── framed work over the sofa, on the limestone return wall ────────── */
    {
      const az = A.z0 + A.t / 2 + 0.03, ax = -7.7, ay = 2.02;
      const aw = 1.66, ah = 1.16;
      const art = new THREE.PlaneGeometry(aw, ah);
      art.translate(ax, ay, az + 0.03);
      queue(art, M.art, false, false);
      const fw = 0.03, fd = 0.045;
      addBox(aw + fw * 2, fw, fd, ax, ay + ah / 2 + fw / 2, az + 0.012, M.bronze, { uv: 0.6 });
      addBox(aw + fw * 2, fw, fd, ax, ay - ah / 2 - fw / 2, az + 0.012, M.bronze, { uv: 0.6 });
      addBox(fw, ah, fd, ax - aw / 2 - fw / 2, ay, az + 0.012, M.bronze, { uv: 0.6 });
      addBox(fw, ah, fd, ax + aw / 2 + fw / 2, ay, az + 0.012, M.bronze, { uv: 0.6 });
    }

    /* ── brass linear pendant over the coffee table ─────────────────────── */
    {
      const px = -4.85, pz = -2.9, py = 2.44;
      const bar = new THREE.CylinderGeometry(0.048, 0.048, 1.56, 14);
      bar.rotateZ(Math.PI / 2);
      bar.translate(px, py, pz);
      queue(bar, M.brass, true, false);
      for (const ex of [-0.78, 0.78]) {
        addSoft(0.075, 0.075, 0.075, 0.03, px + ex, py, pz, M.brass, { seg: 2 });
      }
      const diffuser = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.95, 1.42, 0.96) });
      addBox(1.44, 0.014, 0.072, px, py - 0.048, pz, diffuser, { cast: false, receive: false });
      for (const cx of [-0.62, 0.62]) {
        addBox(0.007, A.h - 0.06 - py, 0.007, px + cx, (A.h - 0.06 + py) / 2, pz, M.bronze, { cast: false, receive: false });
      }
      const pl = new THREE.PointLight(0xffc287, MOBILE ? 6 : 12, 8.5, 2);
      pl.position.set(px, py - 0.2, pz);
      scene.add(pl);
      const glow = M.glow.clone();
      glow.opacity = 0.3;
      const q = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.1), glow);
      q.rotation.x = -Math.PI / 2;
      q.position.set(px, py - 0.06, pz);
      q.renderOrder = 4;
      world.add(q);
    }

    /* ── sideboard in the wing, still under the low ceiling ─────────────── */
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
    addPoint(-4.6, 3.1, -3.0, MOBILE ? 16 : 26, 20, warm, true);
    addPoint(0.6, 2.5, -0.6, MOBILE ? 7 : 10, 9, warm, true);
    addPoint(9.0, 2.4, -1.2, MOBILE ? 7 : 10, 13, warm, true);
    addPoint(2.0, -0.7, -14.0, MOBILE ? 5 : 8, 13, 0xbfe2d8);
    // 2700 K bounce off the high cove, so the ceiling is warm rather than dark
    addPoint(-2.4, 6.1, -3.4, MOBILE ? 4 : 8, 15, 0xffb479);

    // a recessed spot washing the framed work on the limestone wall
    {
      const spot = new THREE.SpotLight(0xffc89c, MOBILE ? 10 : 20, 11, 0.52, 0.78, 2);
      spot.position.set(-7.25, 3.55, -0.35);
      spot.target.position.set(-9.74, 1.7, -0.35);
      scene.add(spot, spot.target);
    }

    const coveMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.4, 1.45) });
    addBox(8.0, 0.03, 0.06, -2.0, 6.72, -3.9, coveMat, { cast: false, receive: false });
    addBox(0.06, 0.03, 5.0, 3.6, 6.72, 0.5, coveMat, { cast: false, receive: false });
    addBox(5.0, 0.03, 0.06, -7.0, 3.45, 2.4, coveMat, { cast: false, receive: false });
    addBox(0.06, 0.03, 5.6, -9.55, 6.72, -2.4, coveMat, { cast: false, receive: false });
    // the cove throws a soft warm band a little way down the wall
    for (const [cx, cy, cz, w, d, ry] of [[-2.0, 6.45, -3.62, 8.0, 0.9, 0], [-9.3, 6.45, -2.4, 5.6, 0.9, 1]]) {
      const gm = M.glow.clone();
      gm.opacity = 0.24;
      const q = new THREE.Mesh(new THREE.PlaneGeometry(w, d), gm);
      if (ry) { q.rotation.set(0, Math.PI / 2, 0); }
      else { q.rotation.set(0, 0, 0); }
      q.position.set(cx, cy, cz);
      q.renderOrder = 4;
      world.add(q);
    }

    // bollards on the terrace
    const bollard = (x, z) => {
      addBox(0.12, 0.5, 0.12, x, 0.25, z, M.bronze, { uv: 0.5 });
      addBox(0.1, 0.04, 0.1, x, 0.5, z, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.7, 1.0) }), { cast: false, receive: false });
      addPoint(x, 0.62, z, MOBILE ? 2.5 : 4, 5, 0xffb877);
    };
    bollard(-6.6, -8.6); bollard(9.6, -8.6);


    /* ─────────────────────────────────────────────────────────────────────
       7b · grass — instanced tuft cards, wind in the vertex shader
       The old field was 62k single blades, which at 1.7 m eye height reads as a
       scatter of spikes on a flat carpet: a lawn needs two orders of magnitude
       more blades than a browser can draw as geometry. So each instance here is
       a nine-blade tuft from a 3×3 atlas of procedural tufts, on two crossed
       quads: roughly 300k blades for 26k instances and one draw call.

       · density follows the camera's own path down the drive, then falls off
       · colour is driven by a large-scale field, so the lawn has lush and dry
         patches that do not repeat, and by per-tuft tint
       · the wind is one travelling gust, not per-blade jitter, so it moves
         across the field in waves
       · at distance each tuft shrinks and fades into the meadow, which is what
         keeps it from aliasing into noise on the horizon
       · the paving is kept clear and the height shortens at its edge
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

      /* ── the mat the tufts stand in ──────────────────────────────────────
         One plane over the walk area, a tileable lawn surface with the sun and
         the house shadow on it, faded out to nothing at its edge so it hands
         over to the meadow without a border. Without this the tufts read as
         plugs in rows, because their gaps show pale soil.                    */
      {
        const lawnMat = new THREE.MeshStandardMaterial({
          map: tex(makeLawnMat(), { srgb: true }),
          color: 0xffffff, roughness: 1.0, metalness: 0.0,
          transparent: true, depthWrite: false, envMapIntensity: 0.42
        });
        lawnMat.map.anisotropy = MOBILE ? 2 : 8;
        lawnMat.onBeforeCompile = (sh) => {
          sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(position, 1.0)).xyz;');
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
            .replace('#include <alphamap_fragment>', '#include <alphamap_fragment>\n' +
              'vec2 lq = abs(vWPos.xz - vec2(2.0, 10.0)) - vec2(84.0, 90.0);\n' +
              'float lawnFade = 1.0 - smoothstep(0.0, 22.0, max(lq.x, lq.y));\n' +
              'diffuseColor.a *= lawnFade;\n' +
              'if (lawnFade < 0.02) discard;');
        };
        lawnMat.customProgramCacheKey = () => 'lawnmat';
        const geo = new THREE.PlaneGeometry(240, 240, 64, 64);
        geo.rotateX(-Math.PI / 2);
        {
          const pp = geo.attributes.position;
          for (let i = 0; i < pp.count; i++) {
            pp.setY(i, bend(pp.getX(i) + 2, pp.getZ(i) + 10) + 0.035);
          }
          geo.computeVertexNormals();
        }
        geo.translate(2, 0, 10);
        const mp = geo.attributes.position;
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(i, mp.getX(i) / 6.0, mp.getZ(i) / 6.0);
        }
        const lawn = new THREE.Mesh(geo, lawnMat);
        lawn.receiveShadow = true;
        lawn.renderOrder = 0;
        world.add(lawn);
      }

      /* two crossed quads, four rows high, so the card can bend in the wind */
      const card = (() => {
        const rows = 4, v = [], uvs = [], idx = [];
        for (let q = 0; q < 2; q++) {
          const base = v.length / 3;
          for (let r = 0; r < rows; r++) {
            const y = r / (rows - 1);
            const x0 = -0.5, x1 = 0.5;
            if (q === 0) { v.push(x0, y, 0, x1, y, 0); }
            else { v.push(0, y, x0, 0, y, x1); }
            uvs.push(0, y, 1, y);
            if (r < rows - 1) {
              const a = base + r * 2;
              idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
            }
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        g.setIndex(idx);
        return g;
      })();

      const N = Math.round((MOBILE ? 17000 : (TABLET ? 26000 : 34000)) * clamp(opts.grassDensity, 0.15, 1));
      const aRoot = new Float32Array(N * 3);
      const aParam = new Float32Array(N * 4);
      const aTint = new Float32Array(N);

      let i = 0, guard = 0;
      while (i < N && guard < N * 10) {
        guard++;
        let x, z;
        const roll = rnd();
        if (roll < 0.58) {
          // along the drive — this is where the camera actually is
          const t = 0.20 + 0.80 * Math.pow(rnd(), 0.5);
          const p = drive.getPoint(t);
          const tan = drive.getTangent(t);
          const nx = -tan.z, nz = tan.x;
          const side = rnd() > 0.5 ? 1 : -1;
          const off = side * (1.45 + Math.pow(rnd(), 1.25) * 22);
          x = p.x + nx * off; z = p.z + nz * off;
        } else if (roll < 0.96) {
          // the apron round the house, terrace and pool
          x = rr(-34, 38); z = rr(-46, 40);
        } else {
          // the meadow beyond
          const a = rnd() * Math.PI * 2, r = 44 + Math.pow(rnd(), 0.55) * 92;
          x = Math.cos(a) * r + 4; z = Math.sin(a) * r - 2;
        }
        if (Math.hypot(x - 1.5, z + 3) > 150) continue;
        if (paved(x, z)) continue;

        const dd = driveDist(x, z);
        const edge = clamp(dd / 1.1);                       // 0 at the gravel, 1 clear of it
        const rHouse = Math.hypot(x - 1.5, z - 1.0);
        // lush and tall where the walk happens, shorter and sparser outside it
        const near = clamp(1 - (rHouse - 6) / 44);
        const dryField = smoothstep(18, 62, rHouse);

        const baseH = (0.30 + Math.pow(rnd(), 1.35) * 0.34) * (0.62 + 0.38 * near);
        const h = baseH * (0.45 + 0.55 * edge) * rr(0.68, 1.32);
        const w = h * rr(1.15, 1.75);

        // a little jitter, so the sampling never shows as rows
        x += rr(-0.35, 0.35); z += rr(-0.35, 0.35);
        aRoot[i * 3] = x;
        aRoot[i * 3 + 1] = -0.045;
        aRoot[i * 3 + 2] = z;
        aParam[i * 4] = rnd() * Math.PI * 2;                 // yaw
        aParam[i * 4 + 1] = h;
        aParam[i * 4 + 2] = w;
        aParam[i * 4 + 3] = Math.floor(rnd() * 9) + 0.001 * rnd();  // atlas cell
        aTint[i] = clamp(rr(0.62, 1.18) * (0.85 + 0.35 * dryField) - dryField * 0.12);
        i++;
      }

      const geo = new THREE.InstancedBufferGeometry();
      geo.index = card.index;
      geo.setAttribute('position', card.attributes.position);
      geo.setAttribute('uv', card.attributes.uv);
      geo.setAttribute('aRoot', new THREE.InstancedBufferAttribute(aRoot, 3));
      geo.setAttribute('aParam', new THREE.InstancedBufferAttribute(aParam, 4));
      geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(aTint, 1));
      geo.instanceCount = i;
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(2, 0, 0), 200);

      const sunDir = SUN_DIR.clone().normalize();
      const tuftTex = tex(makeGrassTuft(), { srgb: true });
      tuftTex.generateMipmaps = true;
      tuftTex.minFilter = THREE.LinearMipmapLinearFilter;
      tuftTex.anisotropy = MOBILE ? 2 : 8;

      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uTuft: { value: tuftTex },
          uSunDir: { value: sunDir },
          uSunCol: { value: new THREE.Color(1.55, 1.02, 0.64) },
          uSkyCol: { value: new THREE.Color(0.26, 0.35, 0.52) },
          uFogCol: { value: new THREE.Color(0.69, 0.63, 0.51) },
          uFogDensity: { value: 0.0027 },
          uGroundCol: { value: new THREE.Color(0.235, 0.265, 0.135) },
          uHalfW: { value: 150 }
        },
        side: THREE.DoubleSide,
        vertexShader: /* glsl */`
          attribute vec3 aRoot;
          attribute vec4 aParam;
          attribute float aTint;
          uniform float uTime;
          varying vec3 vCol;
          varying vec2 vUv;
          varying float vDist;
          varying float vUp;

          float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

          void main() {
            float yaw = aParam.x, h = aParam.y, w = aParam.z, cell = aParam.w;
            vec2 wxz = aRoot.xz;

            // one travelling gust front + a slower ripple, both in world space
            float gust = sin(wxz.x * 0.085 + wxz.y * 0.062 - uTime * 0.85);
            gust = gust * 0.6 + sin(wxz.x * 0.21 - wxz.y * 0.17 - uTime * 1.9) * 0.3;
            float phase = hash21(wxz) * 6.283;

            vec3 p = position;
            p.x *= w;
            p.y *= h;
            p.z *= w;

            // bend: only the top of the tuft moves, the root stays put
            float bend = pow(clamp(p.y / max(h, 0.001), 0.0, 1.0), 1.45);
            float sway = sin(uTime * 1.9 + phase) * 0.22 + gust * 0.55;
            p.x += sway * h * 0.30 * bend;
            p.z += (cos(uTime * 1.6 + phase * 1.3) * 0.12 + gust * 0.28) * h * 0.20 * bend;

            float c = cos(yaw), s = sin(yaw);
            vec3 rp = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);
            vec3 wp = aRoot + rp;

            float camDist = length(aRoot - cameraPosition);

            // distance: the tuft shortens toward the ground, so nothing shimmers
            wp.y *= 1.0 - 0.72 * smoothstep(16.0, 78.0, camDist);
            float far = smoothstep(60.0, 155.0, camDist);
            wp.xz = mix(wp.xz, aRoot.xz + vec2(0.0), far * 0.35);

            vec4 mv = viewMatrix * vec4(wp, 1.0);
            vDist = -mv.z;

            // a large-scale field: patches of lush green, patches of dry straw
            float fieldN = sin(wxz.x * 0.061 + wxz.y * 0.043 + 1.7)
                        + 0.5 * sin(wxz.x * 0.017 - wxz.y * 0.023 + 3.1);
            float dry = clamp(0.5 + 0.26 * fieldN + (aTint - 0.9) * 0.55, 0.0, 1.0);
            vec3 lush = vec3(0.150, 0.235, 0.085);
            vec3 straw = vec3(0.330, 0.290, 0.140);
            vec3 base = mix(lush, straw, dry);

            // per-tuft light, and a root that sits in its own shadow
            base *= 0.46 + 0.62 * smoothstep(-0.02, 0.85, position.y);
            base *= 0.82 + aTint * 0.30;
            vCol = base;
            vUp = position.y;

            float cx = mod(floor(cell), 3.0), cy = floor(floor(cell) / 3.0);
            vUv = (vec2(cx, 2.0 - cy) + clamp(uv, 0.0, 1.0) * 0.94 + 0.03) / 3.0;

            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */`
          uniform sampler2D uTuft;
          uniform vec3 uSunDir;
          uniform vec3 uSunCol;
          uniform vec3 uSkyCol;
          uniform vec3 uFogCol;
          uniform float uFogDensity;
          uniform vec3 uGroundCol;
          varying vec3 vCol;
          varying vec2 vUv;
          varying float vDist;
          varying float vUp;

          void main() {
            vec4 texel = texture2D(uTuft, vUv);
            if (texel.a < 0.42) discard;

            vec3 albedo = vCol * texel.rgb * 3.5;

            // a card's face is mostly up-facing, so the light comes from the sky
            vec3 N = normalize(vec3(0.0, 1.0, 0.0));
            float ndl = max(dot(N, uSunDir), 0.0);
            vec3 col = albedo * (uSkyCol * 1.18 + uSunCol * ndl * 1.28);
            // backlit rim, where the sun comes through the thin tips
            col += albedo * uSunCol * 0.55 * smoothstep(0.35, 1.0, vUp) * ndl;

            // far grass dissolves into the meadow that carries it, in the same
            // light, so the field reads as texture rather than as speckle
            vec3 litGround = uGroundCol * (uSkyCol * 1.05 + uSunCol * ndl * 1.25);
            float farMask = smoothstep(26.0, 92.0, vDist);
            col = mix(col, litGround, farMask * 0.85);
            float f = 1.0 - exp(-uFogDensity * uFogDensity * vDist * vDist);
            col = mix(col, uFogCol, clamp(f, 0.0, 1.0));
            // and finally the tuft itself dissolves, handing the field back to
            // the meadow plane, so the horizon has one tone and no dark band
            float vanish = smoothstep(88.0, 150.0, vDist);
            if (vanish > 0.98) discard;

            gl_FragColor = vec4(col, 1.0 - vanish);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = -1;
      world.add(mesh);
      grassUniforms = mat.uniforms;
      grassSetDensity = (v) => {
        geo.instanceCount = Math.max(0, Math.round(i * clamp(v, 0, 1)));
      };
      grassSetDensity(clamp(opts.grassDensity, 0.15, 1));
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
    const needleMatrices = [], needleColors = [];
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

    function needleAt(x, y, z, s, lit) {
      dummy.position.set(x, y, z);
      dummy.rotation.set(rr(0, 3.14), rr(0, 3.14), rr(0, 3.14));
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      needleMatrices.push(dummy.matrix.clone());
      tmpCol.setRGB(rr(0.82, 1.12), rr(0.9, 1.18), rr(0.74, 1.02));
      needleColors.push(tmpCol.clone());
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
      }), M.oliveBark, true, true);

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
      const cardsPer = MOBILE ? 22 : 34;
      for (const tip of tips) {
        for (let k = 0; k < cardsPer; k++) {
          const a = rnd() * Math.PI * 2, b = Math.acos(rr(-1, 1));
          const rad = Math.pow(rnd(), 0.4) * tip.s * 0.78;
          cardAt(
            tip.p.x + Math.sin(b) * Math.cos(a) * rad,
            tip.p.y + Math.cos(b) * rad * 0.66 + rr(0, 0.14) * tip.s,
            tip.p.z + Math.sin(b) * Math.sin(a) * rad,
            rr(0.26, 0.46) * scale, rr(0.82, 1.06) + 0.20 * clamp((tip.p.y - h * 0.7) / (h * 0.6))
          );
        }
      }
      /* the crown as a body: cards through an ellipsoid, densest in the middle
         and thinner at the rim, so the canopy holds together from every angle
         instead of hanging in lobes off the twig tips */
      {
        const ccx = x + lean * 0.92, ccz = z + leanZ * 0.92, ccy = h * 1.02;
        const rx = 1.55 * scale, ry = 0.78 * scale, rz = 1.55 * scale;
        const body = MOBILE ? 120 : 220;
        for (let i = 0; i < body; i++) {
          const a = rnd() * Math.PI * 2;
          const u = Math.pow(rnd(), 0.55);
          const b = Math.acos(rr(-1, 1));
          const rr2 = u;
          const px = ccx + Math.sin(b) * Math.cos(a) * rx * rr2;
          const py = ccy + Math.cos(b) * ry * rr2 + rr(-0.1, 0.16) * scale;
          const pz = ccz + Math.sin(b) * Math.sin(a) * rz * rr2;
          cardAt(px, py, pz, rr(0.20, 0.34) * scale,
            0.80 + 0.24 * clamp((py - h * 0.7) / (h * 0.5)) + rr(-0.06, 0.06));
        }
      }

      // a denser heart so the crown is not see-through at eye level
      for (let i = 0; i < (MOBILE ? 3 : 5); i++) {
        const a = rnd() * Math.PI * 2, rad = rr(0, 0.5) * scale;
        for (let k = 0; k < (MOBILE ? 12 : 22); k++) {
          cardAt(
            x + lean * 0.9 + Math.cos(a) * rad + rr(-0.45, 0.45) * scale,
            h * rr(0.9, 1.25) + rr(-0.2, 0.2) * scale,
            z + leanZ * 0.9 + Math.sin(a) * rad + rr(-0.45, 0.45) * scale,
            rr(0.22, 0.44) * scale, rr(0.82, 1.08)
          );
        }
      }
      contactShadow(x, z, 2.1 * scale, 2.1 * scale, true, 0.03);
    }

    /* ── cypress ────────────────────────────────────────────────────────────
       Not a stack of cards: a flared trunk under a revolved, radially noisy
       body (its silhouette and its shading both change as you walk past), with
       tiered foliage clusters for organic mass and needle cards for the ragged
       edge. Read at 3 m or at 100 m, it is a solid volume.                  */
    function addCypress(x, z, scale = 1) {
      const h = rr(7.4, 10.4) * scale;
      const w = rr(0.52, 0.74) * scale;
      const leanX = rr(-0.30, 0.30) * scale, leanZ = rr(-0.30, 0.30) * scale;
      const yaw = rr(0, 6.3);
      const tiers = MOBILE ? 5 : 7;

      const spine = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, -0.18, z),
        new THREE.Vector3(x + leanX * 0.22, h * 0.26, z + leanZ * 0.22),
        new THREE.Vector3(x + leanX * 0.56, h * 0.56, z + leanZ * 0.56),
        new THREE.Vector3(x + leanX * 0.74, h * 0.74, z + leanZ * 0.74)
      ], false, 'centripetal', 0.5);
      queue(limb(spine, {
        r0: 0.20 * scale, r1: 0.075 * scale, radial: 8, tubular: 10,
        flare: 0.9, flareLen: 0.6 * scale, tile: 0.9
      }), M.bark, true, true);

      // the flame of foliage: one closed, noisy surface of revolution
      const shapeAt = (t) => Math.pow(Math.sin(Math.PI * Math.min(1, 0.17 + 0.83 * t)), 0.60) * (1 - 0.30 * t);
      const RINGS = MOBILE ? 11 : 17, RAD = MOBILE ? 9 : 13;
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= RINGS; i++) {
        const t = i / RINGS;
        const y = h * (0.09 + 0.91 * t);
        const base = w * shapeAt(t);
        for (let j = 0; j <= RAD; j++) {
          const a = (j / RAD) * Math.PI * 2;
          const wob = 1
            + 0.16 * Math.sin(a * 3 + t * 6.4 + yaw)
            + 0.10 * Math.sin(a * 7 - t * 4.2 + yaw * 2)
            + 0.07 * Math.sin(a * 11 + t * 9 + yaw * 3)
            + 0.04 * Math.sin(a * 5 - t * 15);
          const r = Math.max(0.008, base * wob);
          pos.push(
            x + leanX * t * 0.82 + Math.cos(a) * r,
            y + Math.sin(a * 5 + t * 9 + yaw) * 0.07 * w,
            z + leanZ * t * 0.82 + Math.sin(a) * r
          );
          uv.push((j / RAD) * 2.2, t * 7);
        }
      }
      for (let i = 0; i < RINGS; i++) {
        for (let j = 0; j < RAD; j++) {
          const a = i * (RAD + 1) + j, b = a + RAD + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
      const body = new THREE.BufferGeometry();
      body.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      body.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      body.setIndex(idx);
      body.computeVertexNormals();
      // every normal out from the axis, whatever the winding produced
      const nb = body.attributes.normal, pb = body.attributes.position;
      for (let i = 0; i < nb.count; i++) {
        const dx = pb.getX(i) - (x + leanX * 0.5), dz = pb.getZ(i) - (z + leanZ * 0.5);
        if (nb.getX(i) * dx + nb.getZ(i) * dz < 0) nb.setXYZ(i, -nb.getX(i), -nb.getY(i), -nb.getZ(i));
      }
      queue(body, M.cypress, true, true);

      // tiered clusters, mostly inside the body, so the mass stays a column
      for (let ti = 0; ti < tiers; ti++) {
        const t = 0.10 + (ti / (tiers - 1)) * 0.84;
        const y = h * (0.09 + 0.91 * t);
        const rad = w * shapeAt(t) * 1.04;
        const n = MOBILE ? 2 : 3;
        for (let k = 0; k < n; k++) {
          const a = yaw + (k / n) * Math.PI * 2 + rr(-0.5, 0.5);
          const off = rad * rr(0.05, 0.3);
          const s = rad * rr(0.35, 0.6) + 0.03;
          clumpAt(
            x + leanX * t * 0.82 + Math.cos(a) * off,
            y + rr(-0.1, 0.12) * (h / tiers),
            z + leanZ * t * 0.82 + Math.sin(a) * off,
            s, (h / tiers) * rr(0.28, 0.4), s,
            0.244, rr(0.28, 0.38), rr(0.042, 0.072)
          );
        }
        const needles = MOBILE ? 7 : 15;
        for (let k = 0; k < needles; k++) {
          const a = rnd() * Math.PI * 2;
          const rad2 = rad * rr(0.92, 1.05);
          needleAt(
            x + leanX * t * 0.82 + Math.cos(a) * rad2,
            y + rr(-0.3, 0.3) * (h / tiers),
            z + leanZ * t * 0.82 + Math.sin(a) * rad2,
            rr(0.10, 0.20) * scale, 1.0
          );
        }
      }
      // a crown tuft, so the top reads as a living tip rather than a cone
      for (let k = 0; k < (MOBILE ? 2 : 4); k++) {
        const a = rnd() * Math.PI * 2;
        needleAt(
          x + leanX * 0.86 + Math.cos(a) * 0.05 * scale,
          h * rr(0.93, 0.985), z + leanZ * 0.86 + Math.sin(a) * 0.05 * scale,
          rr(0.10, 0.18) * scale, 1.0
        );
      }
    }

    /* ── date palms ─────────────────────────────────────────────────────────
       The Gulf palm that belongs beside this villa: a leaning, tapering trunk
       of leaf-base scars, a crownshaft, and a crown of twenty-odd arched fronds
       — a rachis with two ranks of leaflets built as real ribbon geometry with
       a serrated edge, so the crown has mass instead of a comb's tooth gaps.
       Each frond carries its own colour: dark at the crown, olive through the
       middle, sunlit at the tips, with a backlit rim where the sun is behind it.
       A skirt of dry fronds and a few clusters of dates finish it.           */

    /** One frond: two ranks of leaflet ribbon along an arching rachis, in 3D. */
    function frondGeo(ox, oy, oz, az, pitch, len, droop, twist = 0, dense = 1) {
      const K = Math.round((MOBILE ? 28 : 44) * dense);
      const hx = Math.cos(az), hz = Math.sin(az);
      const ct = Math.cos(twist), st = Math.sin(twist);
      // twisted frame: leaflets leave the rachis plane, so the frond has depth
      const lat = new THREE.Vector3(-hz * ct, st, hx * ct);
      const up = new THREE.Vector3(hz * st, ct, -hx * st);

      // the rachis, arching: pitch up out of the crown, then drooping under its own weight
      const pts = [];
      for (let k = 0; k <= K; k++) {
        const s = k / K;
        const r = len * s;
        const y = len * (Math.sin(pitch) * s - droop * s * s);
        pts.push(new THREE.Vector3(ox + hx * r, oy + y, oz + hz * r));
      }

      const pos = [], col = [], idx = [];
      let vo = 0;
      const Lmax = len * 0.175;
      const leafletLen = (s) => Lmax * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + s * 0.96)), 0.55) * (1 - 0.22 * s);

      for (let k = 0; k < K; k++) {
        const s0 = k / K, s1 = (k + 1) / K;
        const p0 = pts[k], p1 = pts[k + 1];
        const tan = p1.clone().sub(p0).normalize();
        // the serrated edge: every other leaflet is a hair shorter, so the
        // silhouette reads as leaflets rather than as a smooth feather
        const notch = 0.84 + 0.16 * ((k % 2) ? 1 : 0.45);
        for (const side of [-1, 1]) {
          const l0 = leafletLen(s0) * notch, l1 = leafletLen(s1) * notch;
          const a = p0.clone().addScaledVector(lat, side * 0.018);
          const b = p1.clone().addScaledVector(lat, side * 0.018);
          const o0 = p0.clone()
            .addScaledVector(lat, side * l0 * 0.96)
            .addScaledVector(tan, l0 * 0.34)
            .addScaledVector(up, -l0 * 0.26);
          const o1 = p1.clone()
            .addScaledVector(lat, side * l1 * 0.96)
            .addScaledVector(tan, l1 * 0.34)
            .addScaledVector(up, -l1 * 0.26);
          pos.push(a.x, a.y, a.z, b.x, b.y, b.z, o1.x, o1.y, o1.z, o0.x, o0.y, o0.z);
          // dark where the leaflets leave the rachis, lit at the tips, and a
          // little lighter on the side that faces up
          const inner = 0.62 + 0.30 * Math.sin(Math.PI * s0);
          const outer = 0.92 + 0.34 * Math.sin(Math.PI * s0);
          col.push(inner, inner, inner, inner, inner, inner, outer, outer * 1.04, outer * 0.92, outer, outer * 1.04, outer * 0.92);
          idx.push(vo, vo + 1, vo + 2, vo, vo + 2, vo + 3);
          vo += 4;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      return { geo: g, pts };
    }

    function addPalm(x, z, scale = 1, opts = {}) {
      // a framed palm (the four corner palms) takes its height, lean and lean
      // direction from the composition, so the quartet is a matching set
      const h = opts.h ?? rr(6.2, 8.4) * scale;
      const bend = opts.bend ?? rr(0.8, 1.7) * scale;
      const dir = opts.dir ?? rr(0, 6.3);
      const dx = Math.cos(dir), dz = Math.sin(dir);

      const spine = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, -0.2, z),
        new THREE.Vector3(x + dx * bend * 0.16, h * 0.34, z + dz * bend * 0.16),
        new THREE.Vector3(x + dx * bend * 0.48, h * 0.70, z + dz * bend * 0.48),
        new THREE.Vector3(x + dx * bend * 0.90, h, z + dz * bend * 0.90)
      ], false, 'centripetal', 0.5);
      const top = spine.getPointAt(1);

      /* the trunk: one swept tube, root-flared, with the diamond lattice of
         old leaf bases as real relief — no stacked cylinders, no visible step */
      queue(limb(spine, {
        r0: 0.285 * scale, r1: 0.165 * scale, radial: MOBILE ? 9 : 13, tubular: MOBILE ? 18 : 30,
        flare: 0.40, flareLen: 0.85 * scale, tile: 0.5 * scale
      }), M.palmBark, true, true);

      // crownshaft: the smooth green-brown collar the fronds come out of
      {
        const d2 = spine.getPointAt(0.972), t2 = spine.getPointAt(1);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), t2.clone().sub(d2).normalize());
        const g = new THREE.CylinderGeometry(0.19 * scale, 0.245 * scale, 0.95 * scale, MOBILE ? 9 : 13, 1, false);
        worldUV(g, 1.1);
        g.applyMatrix4(new THREE.Matrix4().compose(
          top.clone().addScaledVector(new THREE.Vector3(0, 1, 0), -0.22 * scale), q, new THREE.Vector3(1, 1, 1)));
        queue(g, M.palmCrown, true, false);
      }

      // fronds: three ranks — steep inner whorl, level middle, drooping skirt
      const nF = MOBILE ? 21 : 34;
      for (let i = 0; i < nF; i++) {
        const az = (i / nF) * Math.PI * 2 + rr(-0.14, 0.14);
        const rank = i % 3;                     // 0 skirt, 1 middle, 2 upper
        const pitch = rank === 0 ? rr(-0.42, -0.02)
          : rank === 1 ? rr(0.18, 0.62)
            : rr(0.66, 1.18);
        const len = rr(2.3, 3.5) * scale * (rank === 0 ? 0.92 : 1.0);
        const droop = rank === 0 ? rr(0.55, 0.95)
          : rank === 1 ? rr(0.45, 0.78)
            : rr(0.55, 0.92);
        // fronds do not all spring from one point: each starts a little out
        // along its own bearing, which is what gives the crown its depth
        const out = rr(0.05, 0.34) * scale;
        const f = frondGeo(
          top.x + Math.cos(az) * out,
          top.y + rr(-0.12, 0.20) * scale,
          top.z + Math.sin(az) * out,
          az, pitch, len, droop, rr(-0.55, 0.55));
        queue(f.geo, M.palmLeaf, true, false);
        queue(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(f.pts), MOBILE ? 8 : 12, 0.026 * scale, 4, false), M.palmRachis, true, false);
      }
      // a fibrous crown core, so the fronds spring from a mass, not a pole
      {
        const g = new THREE.IcosahedronGeometry(0.34 * scale, 1);
        g.scale(1, 0.7, 1);
        g.translate(top.x, top.y - 0.03 * scale, top.z);
        queue(g, M.palmDry, true, false);
      }
      // dry skirt hanging under the crown
      for (let i = 0; i < (MOBILE ? 4 : 7); i++) {
        const az = rr(0, 6.3);
        const f = frondGeo(top.x, top.y - 0.14 * scale, top.z, az, rr(-0.85, -0.45), rr(1.4, 2.1) * scale, rr(0.14, 0.28), rr(-0.4, 0.4), 0.55);
        queue(f.geo, M.palmDry, true, false);
      }
      // an inner whorl of shorter, steeper fronds, so the crown has a heart
      for (let i = 0; i < (MOBILE ? 4 : 7); i++) {
        const az = (i / 7) * Math.PI * 2 + rr(-0.3, 0.3);
        const f = frondGeo(top.x, top.y + 0.14 * scale, top.z, az,
          rr(1.0, 1.45), rr(1.3, 2.0) * scale, rr(0.28, 0.52), rr(-0.4, 0.4), 0.7);
        queue(f.geo, M.palmLeaf, true, false);
      }

      // dates: three small clusters tucked under the crownshaft
      for (let c = 0; c < 3; c++) {
        const az = rr(0, 6.3), rad = 0.26 * scale;
        const cx = top.x + Math.cos(az) * rad, cz = top.z + Math.sin(az) * rad;
        for (let k = 0; k < (MOBILE ? 5 : 9); k++) {
          const g = new THREE.SphereGeometry(0.038 * scale, 5, 4);
          g.translate(cx + rr(-0.14, 0.14) * scale, top.y - 0.30 * scale - rr(0, 0.36) * scale, cz + rr(-0.14, 0.14) * scale);
          queue(g, M.dates, true, false);
        }
      }
      contactShadow(x + dx * bend * 0.1, z + dz * bend * 0.1, 1.7 * scale, 1.7 * scale, true, 0.022);
    }

    /* Two olives, not a grove. One either side of the drive, set back far
       enough to stay off the gravel and to be read whole from the path: the
       left one is the tree the camera passes closest to, the right one gives
       the approach its parallax. Everything else in the field is the meadow,
       the four palms, and the light. */
    const treeSpots = [
      [-6.4, 16.5, 1.12],
      [11.6, 32.0, 1.0]
    ];
    treeSpots.forEach(([x, z, s]) => addOlive(x, z, s));

    /* date palms: four Gulf date palms standing on the four corners of the
       house + terrace + pool plinth, the way four minarets frame the Taj. One
       height, one lean length, each leaning out along the plinth's own
       diagonal, so the quartet is a measured set rather than a grove: the
       approach passes between the front pair, and the orbit turns inside them.
       Kept clear of the gravel, the entry canopy, the wing and the pool. */
    const PALM_FRAME = { cx: 1.5, cz: -5.1, h: 9.7, bend: 0.42 };
    [[-14.2, 11.4], [17.2, 11.4], [-14.2, -21.6], [17.2, -21.6]]
      .forEach(([x, z]) => {
        const dir = Math.atan2(z - PALM_FRAME.cz, x - PALM_FRAME.cx);
        addPalm(x, z, 1, { h: PALM_FRAME.h, bend: PALM_FRAME.bend, dir });
      });

    // the palms are their own materials, so the quartet switches as one group
    setPalms = (on) => {
      for (const m of [M.palmBark, M.palmCrown, M.palmLeaf, M.palmRachis, M.palmDry, M.dates]) {
        const mesh = BUCKET_MESH.get(m);
        if (mesh) mesh.visible = !!on;
      }
      drawFrame();
    };

    // (low shrubs are grass tufts and vine skirts now — no separate pass)

    // foliage mass + every canopy card, two draws
    {
      const folMat = windify(new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.98, metalness: 0, envMapIntensity: 0.25
      }), { amp: 0.055, freq: 1.15, height: 3.2, soft: 0.6 });
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

      const needles = new THREE.InstancedMesh(leafGeo, M.needle, needleMatrices.length);
      needleMatrices.forEach((m, i) => { needles.setMatrixAt(i, m); needles.setColorAt(i, needleColors[i]); });
      needles.instanceMatrix.needsUpdate = true;
      if (needles.instanceColor) needles.instanceColor.needsUpdate = true;
      needles.castShadow = true;
      needles.frustumCulled = false;
      world.add(needles);
    }


    flush();

    // the basin is only for the eye, never for the mirror
    const basin = BUCKET_MESH.get(M.poolWall);
    if (basin) basin.layers.set(1);

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
      { t: 0.565, p: [-0.2, 1.72, 2.4], l: [-2.8, 1.92, -3.0], fov: 50 },
      { t: 0.610, p: [-0.9, 1.80, 0.5], l: [-5.6, 1.58, -3.4], fov: 50 },
      { t: 0.660, p: [-1.9, 1.94, -1.3], l: [-7.0, 1.92, -2.9], fov: 48 },
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
   11 · host loop — scroll / autoplay, overlays, the render loop
   Everything host-specific is optional: if the page has the walkthrough's
   overlay markup (#hudBar, .copy__item, …) it is driven; if not, the scene
   runs on its own. Nothing here reads a global except window events, and every
   listener and observer is tied to `ac` so destroy() can take them back.
   ───────────────────────────────────────────────────────────────────── */
const ac = new AbortController();
const signal = ac.signal;

if (opts.height != null) section.style.height = (typeof opts.height === 'number' ? opts.height + 'px' : opts.height);

const rect0 = section.getBoundingClientRect();
const visible0 = rect0.top < window.innerHeight + 240 && rect0.bottom > -240;
let pTarget = STOPS[opts.startStop] ?? 0, pSmooth = pTarget, lastApplied = -1, visible = visible0, started = false;
let autoP = pSmooth, autoDir = 1;
let lookYaw = 0, lookPitch = 0, lookYawTarget = 0, lookPitchTarget = 0;
let dragging = false, lastX = 0, lastY = 0, pointerX = 0, pointerY = 0;

/* the page's overlays, if this host has them */
const hudBar = document.getElementById('hudBar');
const hudPct = document.getElementById('hudPct');
const hudStages = Array.from(document.querySelectorAll('#hudStages li'));
const copyItems = Array.from(document.querySelectorAll('.copy__item')).map(el => ({
  el, in: parseFloat(el.dataset.in), out: parseFloat(el.dataset.out)
}));
const scrollHint = document.querySelector('.walk__scrollhint');
const grade = document.querySelector('.walk__grade');
const bloomEl = document.querySelector('.walk__bloom');
const veil = document.querySelector('.walk__veil');

const STAGE_EDGES = [0, 0.30, 0.56, 0.78, 0.885, 1.01];
const STATIC_VIEWS = [0.0, 0.30, 0.44, 0.512, 0.66, 0.83, 0.93, 1.0];

function readProgress() {
  if (!opts.scrollDriven) return;
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
  if (bloomEl) bloomEl.style.opacity = (warmUp * 0.42 + smoothstep(0.86, 0.98, p) * 0.14).toFixed(3);

  if (dust) dust.uniforms.uOpacity.value = smoothstep(0.52, 0.62, p) * (1 - smoothstep(0.79, 0.85, p)) * (MOBILE ? 0.5 : 0.62);
  if (opts.onProgress) { try { opts.onProgress(p, stage); } catch (_) { /* host's problem */ } }
}

let exposure = 0.82;

function applyCamera(t, dt) {
  const fov = cameraAt(t);
  camera.position.copy(tmpPos);
  camera.up.set(0, 1, 0);
  camera.lookAt(tmpTgt);
  if (!REDUCED && opts.interactive) { camera.rotateY(lookYaw); camera.rotateX(lookPitch); }

  const aspect = camera.aspect;
  const portrait = aspect < 1.1 ? lerp(1, 1.46, clamp((1.1 - aspect) / 0.7)) : 1;
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
  const h = (opts.fillContainer ? section.clientHeight : 0) || window.innerHeight;
  renderer.setSize(w, h, false);
  if (reflRT) {
    const dpr = renderer.getPixelRatio();
    reflRT.setSize(Math.max(2, Math.round((w * dpr) / 2)), Math.max(2, Math.round((h * dpr) / 2)));
    waterUniforms.uReflectTexel.value.set(1 / reflRT.width, 1 / reflRT.height);
  }
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (post) post.setSize(w, h);
  if (opts.onResize) { try { opts.onResize(w, h); } catch (_) {} }
}

/* drag to look, and a little pointer parallax when idle */
canvas.addEventListener('pointerdown', (e) => {
  if (REDUCED || !opts.interactive) return;
  dragging = true; lastX = e.clientX; lastY = e.clientY;
  canvas.classList.add('is-dragging');
  try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
}, { signal });
window.addEventListener('pointermove', (e) => {
  if (!opts.interactive) return;
  pointerX = (e.clientX / window.innerWidth) * 2 - 1;
  pointerY = (e.clientY / window.innerHeight) * 2 - 1;
  if (!dragging) return;
  lookYawTarget = clamp(lookYawTarget - (e.clientX - lastX) * 0.0016, -0.13, 0.13);
  lookPitchTarget = clamp(lookPitchTarget - (e.clientY - lastY) * 0.0013, -0.09, 0.09);
  lastX = e.clientX; lastY = e.clientY;
}, { passive: true, signal });
const release = (e) => {
  dragging = false;
  canvas.classList.remove('is-dragging');
  try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
};
window.addEventListener('pointerup', release, { signal });
window.addEventListener('pointercancel', release, { signal });

window.addEventListener('scroll', readProgress, { passive: true, signal });
window.addEventListener('resize', () => { resize(); readProgress(); }, { passive: true, signal });

let ro = null, io = null;
if ('ResizeObserver' in window) { ro = new ResizeObserver(resize); ro.observe(section); }
if (opts.pausedOffscreen && 'IntersectionObserver' in window) {
  io = new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    // out of view: the loop is stopped below, so nothing renders; back in
    // view: pick the clock up again without a jump and restart the loop.
    if (visible) { clock.getDelta(); schedule(); }
  }, { rootMargin: '200px 0px' });
  io.observe(section);
}

const clock = new THREE.Clock();
let elapsed = 0;
let paused = false;
let rafId = 0;
let destroyed = false;

/* One frame at a time: the loop parks itself the moment the section leaves the
   viewport, so scrolling never competes with a second live WebGL loop. */
function schedule() {
  if (rafId || paused || !visible || destroyed) return;
  rafId = requestAnimationFrame(tick);
}

function tick() {
  rafId = 0;
  const dt = Math.min(0.1, clock.getDelta());
  if (paused || !visible || destroyed) return;
  elapsed += dt;

  /* autoplay: a slow pass over the take, ping-pong or looping */
  if (!opts.scrollDriven && (opts.autoplay || opts.loop)) {
    autoP += dt * 0.035 * (opts.speed || 1) * autoDir;
    if (autoP > 0.995) { autoP = 0.995; autoDir = opts.loop ? -1 : 1; if (!opts.loop) { paused = true; } }
    if (autoP < 0.005) { autoP = 0.005; autoDir = 1; }
    pTarget = autoP;
  }

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
    dust.uniforms.uTime.value = elapsed;
    WIND.time.value = elapsed;
    if (grassUniforms) grassUniforms.uTime.value = elapsed;
    if (waterUniforms) waterUniforms.uTime.value = elapsed;
  }

  drawFrame();

  if (!started) {
    started = true;
    // the world never moves: bake the shadow map once, then stop updating
    renderer.shadowMap.autoUpdate = false;
    canvas.classList.add('is-ready');
    canvas.classList.remove('is-loading');
  }

  schedule();
}

resize();
readProgress();
pSmooth = pTarget;
applyCamera(pSmooth, 1);
paintOverlays(pSmooth);
clock.start();
schedule();

/* ── the handle: everything a host needs and nothing it has to know ───── */
const handle = {
  get progress() { return pSmooth; },
  set progress(v) { this.setProgress(v); },
  setProgress(v) {
    pSmooth = clamp(v); pTarget = pSmooth; autoP = pSmooth;
    applyCamera(pSmooth, 1); paintOverlays(pSmooth); lastApplied = pSmooth;
    if (paused) drawFrame();
  },
  stop(name) { this.setProgress(STOPS[name] ?? STOPS.approach); },
  pause() { paused = true; if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } },
  resume() { if (destroyed) return; paused = false; clock.getDelta(); schedule(); },
  render() { drawFrame(); },
  resize,
  setOptions(next = {}) {
    const before = { ...opts };
    Object.assign(opts, next);
    if (next.height != null) section.style.height = (typeof next.height === 'number' ? next.height + 'px' : next.height);
    if (next.speed != null) opts.speed = next.speed;
    if ((next.cloudCover != null || next.timeOfDay != null) && setSky) setSky(next.timeOfDay || before.timeOfDay, opts.cloudCover);
    if (next.waterRipples != null && waterUniforms && waterUniforms.uRipples) waterUniforms.uRipples.value = clamp(next.waterRipples, 0, 3);
    if (next.grassDensity != null && grassSetDensity) grassSetDensity(next.grassDensity);
    if (next.palms != null) setPalms(!!next.palms);
    if (next.scrollDriven != null && next.scrollDriven) readProgress();
    if (next.quality != null && next.quality !== before.quality) return 'remount';
    return true;
  },
  camera, scene, renderer, section, sun, waterMat, dust, THREE, materials: M, build: BUILD,
  get stats() {
    return {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      tier: MOBILE ? 'lite' : (TABLET ? 'tablet' : 'high')
    };
  },
  destroy,
};

function destroy() {
  if (destroyed) return;
  destroyed = true;
  if (rafId) cancelAnimationFrame(rafId);
  if (ro) ro.disconnect();
  if (io) io.disconnect();
  ac.abort();
  try { pmrem.dispose(); } catch (_) {}
  try { skyTexture.dispose(); } catch (_) {}
  if (reflRT) reflRT.dispose();
  if (post) {
    post.sceneRT.dispose(); post.brightRT.dispose();
    post.blurA.dispose(); post.blurB.dispose();
    post.quadMesh.geometry.dispose();
    post.brightMat.dispose(); post.blurMat.dispose(); post.compMat.dispose();
  }
  const seenTex = new Set();
  scene.traverse((o) => {
    if (o.geometry && !o.geometry.__shared) o.geometry.dispose();
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (!m || m.__shared) continue;
      for (const k in m) {
        const v = m[k];
        if (v && v.isTexture && !seenTex.has(v)) { seenTex.add(v); v.dispose(); }
      }
      m.dispose();
    }
  });
  scene.clear();
  renderer.dispose();
  if (ownsCanvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  else canvas.classList.remove('is-ready');
  container.classList.remove('no-webgl');
  if (window.__shade === handle) { try { delete window.__shade; } catch (_) { window.__shade = undefined; } }
}

/* the debug/screenshot hook the page harness and the render scripts use */
window.__shade = handle;

window.addEventListener('error', (e) => fail(e.error || e.message), { signal });
window.addEventListener('unhandledrejection', (e) => fail(e.reason), { signal });

return handle;
    } catch (err) {
      fail(err);
      return null;
    }
  }
}


/* ───────────────────────────────────────────────────────────────────
   The page integration. On a page that already carries the walkthrough markup
   (#walk containing a canvas) the scene mounts itself on approach, with 800px
   of runway — no extra script, no config. A host that calls createWalkthrough
   itself (the Framer component, a test page) never reaches this block.
   ─────────────────────────────────────────────────────────────────── */
(function autoMount() {
  if (typeof document === 'undefined') return;
  const host = document.getElementById('walk');
  if (!host || !host.querySelector('canvas')) return;
  let armed = false;
  const go = () => {
    if (armed) return;
    armed = true;
    Promise.resolve(createWalkthrough(host, {})).catch((e) => console.error(e));
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { io.disconnect(); go(); }
    }, { rootMargin: '800px 0px' });
    io.observe(host);
  } else {
    go();
  }
})();
