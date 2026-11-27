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

const BUILD = 'shadestate-3d/2.1';

/* ─────────────────────────────────────────────────────────────────────────────
   0 · the public entry point
   createWalkthrough(container, options) → handle
   One call mounts the whole scene into any element. Nothing else is required:
   no page CSS, no ids, no globals. destroy() takes it all back down.
   ───────────────────────────────────────────────────────────────────────────── */

/** Camera stops a host can open on. */
const STOPS = { approach: 0.03, entry: 0.505, interior: 0.705, terrace: 0.845, orbit: 0.97 };

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
  models: true,            // the Megascans props in models/ (async, optional)
  modelBase: null,         // where models/ lives, when the host knows better
  city: true,              // the skyline beyond the pool
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

/* Every one of these canvases is drawn into once and then uploaded as a texture,
   and several are read back pixel by pixel (the height maps that become normal
   maps). Asking for a CPU-backed 2d context up front is what keeps that read
   cheap on a real device, where a GPU-backed canvas has to be copied back. */
/* Set per tier when the scene boots: the normal maps (and the one 2k weave)
   are the textures whose resolution a phone cannot afford, so the lite tier
   builds them at half size. Everything else keeps its authored resolution. */
let NRM_CAP = 0;
let LITE_TEX = false;
/* a 4 GB phone (or a low-core machine) draws the lite scene under a stricter
   budget: half-size procedural canvases, no secondary maps, a 768 px shadow */
let LOWRAM = false;
let LEAN = false;
/* every canvas this scene bakes, so the backing stores can be released once
   their pixels are on the GPU (see releaseCanvases) */
const CANVAS_KEEP = [];

const cv = (w, h = w) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  CANVAS_KEEP.push(c);
  const get = c.getContext.bind(c);
  c.getContext = (type, opts) => get(type, type === '2d' ? { willReadFrequently: true, ...(opts || {}) } : opts);
  return c;
};

function tex(canvasEl, { repeat = [1, 1], srgb = false } = {}) {
  canvasEl.__asTex = true;        // releaseScratchCanvases must leave this one
  const t = new THREE.CanvasTexture(canvasEl);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

/** Tangent-space normal map from a greyscale height canvas.

    This is the single most expensive thing the scene does at boot: every pixel
    of every map reads its four neighbours and normalises. Written as a flat
    loop over typed arrays with the row offsets hoisted and the wrap handled
    inline, it is the same image for a fraction of the time (the closure-and-
    modulo version cost ~18 s of the 20 s boot on a 2-vCPU box). */
function normalFromHeight(src, strength = 2.0, maxSize = 0) {
  let w = src.width, h = src.height;
  const cap = maxSize || NRM_CAP;
  if (cap > 0 && w > cap) {
    /* a smaller working copy: normal maps carry medium detail, and the value
       is re-normalised anyway, so half resolution is nearly free visually */
    const c = cv(cap, Math.round(cap * h / w));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    src = c; w = c.width; h = c.height;
  }
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const out = cv(w, h);
  const octx = out.getContext('2d');
  const od = octx.createImageData(w, h);
  const dst = od.data;
  const k = strength / 255;
  const wm1 = w - 1, hm1 = h - 1;
  let rowPrev = hm1 * w, row = 0, rowNext = w;
  for (let y = 0; y < h; y++) {
    const p0 = rowPrev * 4, p1 = row * 4, p2 = rowNext * 4;
    for (let x = 0; x < w; x++) {
      const xl = x === 0 ? wm1 : x - 1, xr = x === wm1 ? 0 : x + 1;
      const dx = (sd[p1 + xr * 4] - sd[p1 + xl * 4]) * k;
      const dy = (sd[p2 + x * 4] - sd[p0 + x * 4]) * k;
      const il = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const i = p1 + x * 4;
      dst[i] = (-dx * il * 0.5 + 0.5) * 255;
      dst[i + 1] = (-dy * il * 0.5 + 0.5) * 255;
      dst[i + 2] = (il * 0.5 + 0.5) * 255;
      dst[i + 3] = 255;
    }
    rowPrev = row; row = rowNext;
    rowNext = y + 2 > hm1 ? 0 : rowNext + w;
  }
  octx.putImageData(od, 0, 0);
  return out;
}

/* ─────────────────────────────────────────────────────────────────────────────
   2 · photo scans laid under the drawings (ambientCG, CC0)

   The surfaces here are still drawn by this file; four photo sets are laid
   under the drawings as grain (travertine, asphalt, oak, lawn). They are all
   optional: each request has a deadline and a failure path, and a surface with
   no photo keeps the drawing it always had. That matters because the same
   scene runs on a Vercel page, inside a Framer component and in a bare test
   harness, and only the first of those is guaranteed to share an origin.

   Sizes are tiered: 1k/768 colour on desktop, 512 on a phone; normal and
   roughness maps are 512 everywhere because they are sampled through a tiled,
   high-frequency UV.
   ───────────────────────────────────────────────────────────────────────────── */
const PHOTO = {
  asphalt: null, travertine: null, oak: null, grass: null,
  stucco: null, plaster: null, limestone: null, pooltile: null, conc: null, cedar: null
};
const PHOTO_MANIFEST = {
  asphalt: { color: ['@768', '@512'], normal: ['@512', '@512'] },
  travertine: { color: ['@1k', '@512'], normal: ['@512', '@512'], rough: ['@512', '@512'] },
  oak: { color: ['@1k', '@512'], normal: ['@512', '@512'], rough: ['@512', '@512'] },
  grass: { color: ['@768', '@512'] },
  /* the 2026-11-26 Quixel pass: every remaining architectural surface */
  stucco: { color: ['@1k', '@512'], normal: ['@512', '@512'], rough: ['@512', '@512'] },
  plaster: { color: ['@1k', '@512'], normal: ['@512', '@512'], rough: ['@512', '@512'] },
  limestone: { color: ['@1k', '@512'], normal: ['@512', '@512'], rough: ['@512', '@512'] },
  pooltile: { color: ['@1k', '@512'], normal: ['@512', '@512'], rough: ['@512', '@512'] },
  conc: { color: ['@1k', '@512'], normal: ['@512', '@512'], rough: ['@512', '@512'] },
  cedar: { color: ['@1k', '@512'], normal: ['@512', '@512'], rough: ['@512', '@512'] }
};

/* the six surfaces the first two seconds actually look at; everything else
   arrives after the first frame (see loadPhotos and schedulePhotoUpgrade) */
const PHOTO_CORE = ['oak', 'travertine', 'limestone', 'plaster', 'stucco', 'cedar'];

function loadPhoto(url, timeout = 5000) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') { resolve(null); return; }
    const img = new Image();
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => done(img.naturalWidth > 0 ? img : null);
    img.onerror = () => done(null);
    setTimeout(() => done(null), timeout);
    img.src = url;
  });
}

/*  Where the atlases live. Set at boot from the host's textureBase (the Framer
    component passes the Vercel origin), so the sprite cards resolve in every
    host. A card whose atlas never arrives simply keeps its drawn twin. */
let TEX_BASE = './textures/';
const _atlasCache = new Map();
function loadAtlas(name) {
  if (_atlasCache.has(name)) return _atlasCache.get(name);
  const t = new THREE.Texture();
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.anisotropy = 4;
  t.needsUpdate = true;
  _atlasCache.set(name, t);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.onload = () => { t.image = img; t.needsUpdate = true; };
  img.src = TEX_BASE + name;
  return t;
}

/** Fetch a set of photo scans; a set without a colour map is dropped whole.

    Two phases, because the first frame is what the user is waiting for:

    · phase one loads the colour of the six surfaces the camera meets in the
      first two seconds (the villa's stone, the floor, the plaster and the
      cedar soffit) and nothing else;
    · phase two, run from idle after the first frame, brings the normals and
      the remaining surfaces, and swaps them into the materials in place.

    A lean device also skips the roughness maps entirely: the lite tier gets
    one colour and one light normal, which is what halves the texture memory. */
async function loadPhotos(base, lite, keys = null, onlyKinds = null) {
  if (!base) return;
  const tier = lite ? 1 : 0;
  const jobs = [];
  for (const [key, kinds] of Object.entries(PHOTO_MANIFEST)) {
    if (keys && !keys.includes(key)) continue;
    jobs.push((async () => {
      const out = PHOTO[key] || {};
      const want = Object.entries(kinds).filter(([kind]) => {
        if (onlyKinds && !onlyKinds.includes(kind)) return false;
        /* a lean device takes the colour and one light normal, never the
           roughness map: a third of the pixels and half the VRAM */
        if (lite && kind === 'rough') return false;
        if (out[kind]) return false;              // phase one already has it
        return true;
      });
      await Promise.all(want.map(async ([kind, sizes]) => {
        const img = await loadPhoto(base + key + '-' + kind + sizes[tier] + '.webp');
        if (img) out[kind] = img;
      }));
      if (out.color) PHOTO[key] = out;
    })());
  }
  await Promise.all(jobs);
}

/**
 * Lay a photo into a square canvas as surface grain. `mode` picks how much of
 * the drawing underneath survives: multiply keeps the drawn structure and
 * borrows the photo's figure, soft-light only borrows its contrast.
 */
function photoUnder(ctx, img, size, { tiles = 1, mode = 'multiply', alpha = 1, dx = 0, dy = 0 } = {}) {
  if (!img) return;
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  const step = size / tiles;
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      ctx.drawImage(img, dx + tx * step, dy + ty * step, step, step);
    }
  }
  ctx.restore();
}

/** A loaded photo set as a three.js map, or null when the scan did not arrive.
    Every caller treats null as "keep the drawn surface", so a blocked network
    only costs detail, never the scene. */
const _photoTexCache = new Map();
function photoTex(key, kind, srgb = false, size = 512) {
  const set = PHOTO[key];
  if (!set || !set[kind]) return null;
  const id = key + '|' + kind + '|' + size;
  let t = _photoTexCache.get(id);
  if (!t) {
    t = tex(photoCanvas(set[kind], size), { srgb });
    _photoTexCache.set(id, t);
  }
  return t;
}

/** The same, but each cell takes a different crop, so a 4×4 deck of pavers is
    sixteen different pieces of stone rather than the same one repeated. */
function photoCrops(ctx, img, size, n, { mode = 'multiply', alpha = 1, srcTiles = 3 } = {}) {
  if (!img) return;
  const step = size / n;
  const sw = img.naturalWidth / srcTiles, sh = img.naturalHeight / srcTiles;
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = alpha;
  let k = 0;
  for (let ty = 0; ty < n; ty++) {
    for (let tx = 0; tx < n; tx++) {
      const sx = (k * 0.37 % srcTiles) * sw;
      const sy = (Math.floor(k * 0.61) % srcTiles) * sh;
      ctx.drawImage(img, sx, sy, sw, sh, tx * step, ty * step, step, step);
      k++;
    }
  }
  ctx.restore();
}

/** A photo map (normal, roughness) as a texture canvas, cap-aware. */
function photoCanvas(img, size = 512) {
  const c = cv(size);
  c.getContext('2d').drawImage(img, 0, 0, size, size);
  return c;
}

/* ─────────────────────────────────────────────────────────────────────────────
   3 · procedural textures
   ───────────────────────────────────────────────────────────────────────────── */
/* a lean device bakes every canvas at half resolution: the same drawing, a
   quarter of the pixels to fill, upload and keep in VRAM (a 4 GB phone) */
const TS = (v) => (LEAN ? Math.max(64, Math.round(v / 2)) : v);

function makeStone(base = '#e7dfd0', poreRGB = '124,110,90') {
  const S = TS(1024);
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
  /* the same scanned stone, finer, for the large plain fields: estate wall,
     pool coping, kerbs, roof fascia */
  if (PHOTO.travertine) {
    photoUnder(g, PHOTO.travertine.color, S, { tiles: 3, mode: 'luminosity', alpha: 0.42 });
    photoUnder(g, PHOTO.travertine.color, S, { tiles: 3, mode: 'soft-light', alpha: 0.20 });
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
  const S = TS(1024), ch = S / courses;
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

  /* the drawn courses carry the architecture; the scan carries the stone.
     Multiply keeps every joint and block tone and lets the travertine's own
     sediment bands and pores show through; the small screen pass puts back the
     light the multiply took out. */
  const trav = PHOTO.travertine;
  if (trav) {
    /* Luminosity rather than multiply: the scan keeps its figure (bands,
       pores, block-to-block variation) but borrows the drawn stone's own hue
       instead of pushing the whole facade orange. */
    photoUnder(g, trav.color, S, { tiles: 2, mode: 'luminosity', alpha: 0.55 });
    photoUnder(g, trav.color, S, { tiles: 2, mode: 'soft-light', alpha: 0.28 });
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

/** Pale travertine mosaic for the pool basin. The floor is seen through the
    water, so it is a warm, light stone rather than a dark ceramic: the water
    takes its aqua from what sunlight does to this, not from a tinted tile. */
function makePoolTile() {
  const S = TS(512), n = 10, t = S / n;
  const c = cv(S), g = c.getContext('2d');
  const hc = cv(S), hg = hc.getContext('2d');
  g.fillStyle = '#c9bfa9'; g.fillRect(0, 0, S, S);          // grout line
  hg.fillStyle = '#8c8c8c'; hg.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const tone = rr(0.94, 1.05);
      const x = i * t, y = j * t;
      const warm = rnd();
      g.fillStyle = `rgb(${Math.round((233 + warm * 9) * tone)},${Math.round((223 + warm * 7) * tone)},${Math.round((202 + warm * 5) * tone)})`;
      g.fillRect(x + 1.6, y + 1.6, t - 3.2, t - 3.2);
      // faint travertine figure: soft veins and a little open pore
      for (let k = 0; k < 26; k++) {
        g.fillStyle = rnd() > 0.6 ? 'rgba(255,252,242,.22)' : 'rgba(156,140,112,.14)';
        g.fillRect(x + rr(2, t - 4), y + rr(2, t - 4), rr(1, t * 0.55), rr(0.6, 1.7));
      }
      hg.fillStyle = '#c6c6c6'; hg.fillRect(x + 1.6, y + 1.6, t - 3.2, t - 3.2);
    }
  }
  g.strokeStyle = 'rgba(172,158,132,.55)'; g.lineWidth = 1.1;
  for (let i = 0; i <= n; i++) {
    g.beginPath(); g.moveTo(i * t, 0); g.lineTo(i * t, S); g.stroke();
    g.beginPath(); g.moveTo(0, i * t); g.lineTo(S, i * t); g.stroke();
    hg.strokeStyle = 'rgba(70,70,70,.85)'; hg.lineWidth = 2.2;
    hg.beginPath(); hg.moveTo(i * t, 0); hg.lineTo(i * t, S); hg.stroke();
    hg.beginPath(); hg.moveTo(0, i * t); hg.lineTo(S, i * t); hg.stroke();
  }
  return { map: c, normal: normalFromHeight(hc, 0.8) };
}

function makeOakFloor() {
  const S = TS(1024), c = cv(S), g = c.getContext('2d');
  /* the scanned board floor, warmed toward the interior's oak grade. Its own
     plank seams and grain do the work; the drawing below stays as the
     fallback when the scan is not reachable. */
  const oakPhoto = PHOTO.oak;
  if (oakPhoto) {
    g.fillStyle = '#a98a62';
    g.fillRect(0, 0, S, S);
    g.save();
    g.globalCompositeOperation = 'luminosity';
    g.globalAlpha = 0.88;
    g.drawImage(oakPhoto.color, 0, 0, S, S);
    g.globalCompositeOperation = 'multiply';
    g.globalAlpha = 0.22;
    g.fillStyle = 'rgba(206,178,134,1)';
    g.fillRect(0, 0, S, S);
    g.restore();
    return {
      map: c,
      normal: oakPhoto.normal ? photoCanvas(oakPhoto.normal, 512) : null,
      rough: oakPhoto.rough ? photoCanvas(oakPhoto.rough, 512) : null
    };
  }
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

function makeAsphalt() {
  const S = TS(512), c = cv(S), g = c.getContext('2d');
  const hc = cv(S), hg = hc.getContext('2d');
  const a = PHOTO.asphalt;
  if (a) {
    /*  The scan is bright at source, so it is normalised before it is used: a
        straight luminosity blend would lay a pale wash where the tarmac should
        be dark, and the road would come out a different tone on a desktop than
        on a phone. Multiplying it down to the drawn tarmac's own level keeps
        the aggregate, the repair patches and the oil staining at the same
        albedo the phone renders, so both tiers hold the low sun's shadow. */
    g.fillStyle = '#8a8d94';
    g.fillRect(0, 0, S, S);
    g.save();
    g.globalCompositeOperation = 'multiply';
    g.drawImage(a.color, 0, 0, S, S);
    g.restore();
    hg.fillStyle = '#7a7a7a'; hg.fillRect(0, 0, S, S);
    return {
      map: c,
      normal: a.normal ? photoCanvas(a.normal, 512) : null,
      rough: a.rough ? photoCanvas(a.rough, 512) : null
    };
  }
  /*  the drawn tarmac (a phone loads no secondary scans): a grey asphalt that
      keeps the aggregate, the faint patch line and the low sun's shadow */
  g.fillStyle = '#797b7e'; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#7a7a7a'; hg.fillRect(0, 0, S, S);
  for (let i = 0; i < 24000; i++) {
    const v = rnd();
    g.fillStyle = v > 0.55 ? `rgba(198,194,186,${rr(0.03, 0.11).toFixed(3)})` : `rgba(28,26,24,${rr(0.03, 0.11).toFixed(3)})`;
    const s = rr(0.8, 2.2);
    g.fillRect(rnd() * S, rnd() * S, s, s);
    if (v > 0.7) hg.fillStyle = `rgba(${rnd() > 0.5 ? 190 : 60},${rnd() > 0.5 ? 190 : 60},${rnd() > 0.5 ? 190 : 60},.18)`;
  }
  return { map: c, normal: normalFromHeight(hc, 0.55) };
}

/** A monocrystalline module: 6 × 10 half-cells under glass, dark navy with the
    faintest blue cast, a silver busbar grid and the two junction lines. Drawn
    once, tiled across every panel on the roof. */
function makePvPanel() {
  const S = TS(512), c = cv(S), g = c.getContext('2d');
  const cols = 6, rows = 10, pad = 7;
  const cw = (S - pad * 2) / cols, ch = (S - pad * 2) / rows;
  // the sheet under the cells: near-black, a touch of blue
  g.fillStyle = '#0b0f16'; g.fillRect(0, 0, S, S);
  g.fillStyle = '#111722'; g.fillRect(pad * 0.5, pad * 0.5, S - pad, S - pad);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = pad + i * cw, y = pad + j * ch;
      const v = rr(0.90, 1.10);
      g.fillStyle = `rgb(${Math.round(17 * v)},${Math.round(24 * v)},${Math.round(41 * v)})`;
      g.fillRect(x + 1.1, y + 1.1, cw - 2.2, ch - 2.2);
      // the cell's own fine finger grid, running across the short side
      g.strokeStyle = 'rgba(148,158,172,.16)'; g.lineWidth = 0.7;
      for (let k = 1; k < 6; k++) {
        const fy = y + (ch * k) / 6;
        g.beginPath(); g.moveTo(x + 2, fy); g.lineTo(x + cw - 2, fy); g.stroke();
      }
      // a soft sheen along the top-left of each cell, the anti-reflective coat
      const grd = g.createLinearGradient(x, y, x + cw, y + ch);
      grd.addColorStop(0, 'rgba(96,126,170,.16)');
      grd.addColorStop(0.45, 'rgba(60,86,128,.04)');
      grd.addColorStop(1, 'rgba(8,12,20,0)');
      g.fillStyle = grd; g.fillRect(x + 1.1, y + 1.1, cw - 2.2, ch - 2.2);
    }
  }
  // busbars: three silver ribbons down the module, and the cell gaps
  g.fillStyle = 'rgba(176,184,196,.85)';
  for (const fx of [0.167, 0.5, 0.833]) g.fillRect(S * fx - 1.6, pad, 3.2, S - pad * 2);
  g.strokeStyle = 'rgba(150,160,175,.42)'; g.lineWidth = 1.4;
  for (let i = 0; i <= cols; i++) {
    const x = pad + i * cw;
    g.beginPath(); g.moveTo(x, pad); g.lineTo(x, S - pad); g.stroke();
  }
  for (let j = 0; j <= rows; j++) {
    const y = pad + j * ch;
    g.beginPath(); g.moveTo(pad, y); g.lineTo(S - pad, y); g.stroke();
  }
  // the anodised frame line at the very edge of the laminate
  g.strokeStyle = 'rgba(188,194,204,.55)'; g.lineWidth = 2;
  g.strokeRect(3, 3, S - 6, S - 6);
  return { map: c };
}

function makeConcrete() {
  const S = TS(512), c = cv(S), g = c.getContext('2d');
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

function makePaving() {
  const S = TS(512), c = cv(S), g = c.getContext('2d');
  const hc = cv(S), hg = hc.getContext('2d');
  /*  The ground is concrete, not the villa's stone. The house is pale warm
      limestone; the drive, the arrival court, the carport and the sidewalks are
      a cool grey paver with a real joint, so the wall reads against the ground
      it stands on instead of dissolving into it. Four pavers by four: the
      half-metre format the walk has always had, 2 m a tile from gate to door. */
  g.fillStyle = '#b5babd'; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#9a9a9a'; hg.fillRect(0, 0, S, S);
  const n = 4, t = S / n, jw = 2.8;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const l = rr(-7, 7), cool = rr(-2.5, 2.5);
      g.fillStyle = `rgb(${Math.round(179 + l - cool)},${Math.round(184 + l)},${Math.round(189 + l + cool)})`;
      g.fillRect(i * t + jw / 2, j * t + jw / 2, t - jw, t - jw);
      hg.fillStyle = `rgb(${168 + Math.round(l)},168,168)`;
      hg.fillRect(i * t + jw / 2, j * t + jw / 2, t - jw, t - jw);
    }
  }
  /*  the cast slab's own blotching: soft, wide, faintly darker and lighter
      patches, so at grazing light a paver field never reads as a flat fill */
  for (let i = 0; i < 70; i++) {
    const x = rnd() * S, y = rnd() * S, r = rr(24, 120);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, rnd() > 0.45 ? 'rgba(96,101,104,.10)' : 'rgba(228,232,232,.10)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  /* fine aggregate: the even tooth of a pressed slab */
  for (let i = 0; i < 13000; i++) {
    g.fillStyle = rnd() > 0.5 ? `rgba(238,241,241,${rr(0.03, 0.08).toFixed(3)})` : `rgba(56,60,62,${rr(0.03, 0.09).toFixed(3)})`;
    const s = rr(0.7, 1.9);
    g.fillRect(rnd() * S, rnd() * S, s, s);
  }
  /*  the joints over the aggregate: a recess, its far edge catching the low sun,
      and a damp darkened margin just inside each paver, so the format reads at
      distance and the field has a wet working edge rather than a drawn grid */
  for (let k = 0; k <= n; k++) {
    const p = k * t;
    g.fillStyle = 'rgba(74,79,82,.9)';
    g.fillRect(0, p - jw / 2, S, jw);
    g.fillRect(p - jw / 2, 0, jw, S);
    g.fillStyle = 'rgba(236,239,239,.26)';
    g.fillRect(0, p + jw / 2, S, 0.9);
    g.fillRect(p + jw / 2, 0, 0.9, S);
    hg.fillStyle = 'rgba(28,28,28,.95)';
    hg.fillRect(0, p - jw / 2, S, jw);
    hg.fillRect(p - jw / 2, 0, jw, S);
    g.fillStyle = 'rgba(66,74,78,.14)';
    g.fillRect(0, p + jw / 2 + 0.9, S, t * 0.05);
    g.fillRect(p + jw / 2 + 0.9, 0, t * 0.05, S);
  }
  return { map: c, normal: normalFromHeight(hc, 1.0) };
}

/* ── a city facade ─────────────────────────────────────────────────────────
   One tile is four bays by four floors (14 m either way), so any block gets
   the same floor height and the same rhythm whatever its size. The warm
   variant is a residential building with a balcony slab under each window and
   a railing; the cool one is an office with a ribbon of glass and stone piers
   between the bays. A few windows are lit, for the dusk presets.            */
function makeFacade({ wall = [214, 205, 190], glass = [58, 72, 84], balcony = true } = {}) {
  const S = TS(512), B = 4, t = S / B;
  const c = cv(S), g = c.getContext('2d');
  const em = cv(S), eg = em.getContext('2d');
  g.fillStyle = `rgb(${wall[0]},${wall[1]},${wall[2]})`; g.fillRect(0, 0, S, S);
  eg.fillStyle = '#000'; eg.fillRect(0, 0, S, S);

  // plaster mottle and a few rain streaks down the piers
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = rnd() > 0.5 ? `rgba(255,252,244,${rr(0.02, 0.07).toFixed(3)})` : `rgba(120,110,96,${rr(0.02, 0.07).toFixed(3)})`;
    g.fillRect(rnd() * S, rnd() * S, rr(1, 3), rr(1, 3));
  }
  for (let i = 0; i < 26; i++) {
    const x = rnd() * S, w = rr(2, 8), h = rr(40, 200);
    g.fillStyle = `rgba(104,98,86,${rr(0.02, 0.055).toFixed(3)})`;
    g.fillRect(x, rnd() * S * 0.5, w, h);
  }

  for (let j = 0; j < B; j++) {
    const y0 = j * t;
    // the floor slab line: a hairline shadow across the tile
    g.fillStyle = 'rgba(96,88,76,.30)'; g.fillRect(0, y0 + t - 2, S, 2);
    g.fillStyle = 'rgba(255,252,244,.16)'; g.fillRect(0, y0 + 2, S, 2);

    for (let i = 0; i < B; i++) {
      const x0 = i * t;
      if (balcony) {
        // window: 76% of the bay wide, 44% of the floor high
        const wx = x0 + t * 0.12, wy = y0 + t * 0.24, ww = t * 0.76, wh = t * 0.44;
        const grd = g.createLinearGradient(wx, wy, wx, wy + wh);
        grd.addColorStop(0, `rgba(${glass[0] + 78},${glass[1] + 78},${glass[2] + 84},1)`);
        grd.addColorStop(0.45, `rgba(${glass[0] + 22},${glass[1] + 26},${glass[2] + 30},1)`);
        grd.addColorStop(1, `rgba(${glass[0]},${glass[1]},${glass[2]},1)`);
        g.fillStyle = grd; g.fillRect(wx, wy, ww, wh);
        // reveal: a pale frame and a dark head
        g.strokeStyle = 'rgba(248,242,230,.55)'; g.lineWidth = 2.5; g.strokeRect(wx, wy, ww, wh);
        g.fillStyle = 'rgba(18,22,26,.55)'; g.fillRect(wx, wy, ww, wh * 0.16);
        // a mullion
        g.fillStyle = `rgba(${wall[0] - 40},${wall[1] - 40},${wall[2] - 40},.85)`;
        g.fillRect(wx + ww * 0.5 - 1.5, wy, 3, wh);
        // balcony slab + railing below the window
        const by = y0 + t * 0.72;
        g.fillStyle = 'rgba(246,242,232,.86)'; g.fillRect(x0 + t * 0.04, by, t * 0.92, t * 0.055);
        g.fillStyle = 'rgba(150,142,128,.55)'; g.fillRect(x0 + t * 0.04, by + t * 0.055, t * 0.92, t * 0.045);
        g.fillStyle = 'rgba(120,112,100,.35)';
        for (let k = 1; k < 7; k++) g.fillRect(x0 + t * 0.04 + (t * 0.92 * k) / 7, by + t * 0.02, 1.5, t * 0.04);
        // and one window in nine is lit warm
        if (rnd() > 0.89) {
          eg.fillStyle = `rgba(255,198,138,${rr(0.5, 0.95).toFixed(2)})`;
          eg.fillRect(wx + 1, wy + 1, ww - 2, wh - 2);
        }
      } else {
        // office: a ribbon of glass across the whole bay, piers between
        const wy = y0 + t * 0.18, wh = t * 0.52;
        const grd = g.createLinearGradient(x0, wy, x0, wy + wh);
        grd.addColorStop(0, `rgba(${glass[0] + 96},${glass[1] + 92},${glass[2] + 88},1)`);
        grd.addColorStop(0.5, `rgba(${glass[0] + 28},${glass[1] + 32},${glass[2] + 34},1)`);
        grd.addColorStop(1, `rgba(${glass[0]},${glass[1]},${glass[2]},1)`);
        g.fillStyle = grd; g.fillRect(x0 + 2, wy, t - 4, wh);
        g.fillStyle = 'rgba(236,232,222,.35)'; g.fillRect(x0 + 2, wy, t - 4, 2);
        g.fillStyle = `rgba(${wall[0] - 26},${wall[1] - 26},${wall[2] - 24},.9)`;
        for (let k = 1; k < 4; k++) g.fillRect(x0 + (t * k) / 4 - 1, wy, 2, wh);
        if (rnd() > 0.92) {
          eg.fillStyle = `rgba(255,206,150,${rr(0.35, 0.7).toFixed(2)})`;
          eg.fillRect(x0 + 3, wy + 2, t - 6, wh - 4);
        }
      }
    }
  }
  return { map: c, em };
}

function makeGravel() {
  const S = TS(768), c = cv(S), g = c.getContext('2d');
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
  const S = TS(1024), c = cv(S), g = c.getContext('2d');
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

/* ── dune sand: wind-rippled, pale, a little scrub-dark in the troughs ──────
   The land outside the wall is a dune field, not a lawn; this is the surface
   the ground shader mixes toward where the dunes rise and the grass thins. */
function makeDuneSand() {
  const S = TS(512), c = cv(S), g = c.getContext('2d');
  const hc = cv(S), hg = hc.getContext('2d');
  g.fillStyle = '#b7a685'; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S);
  // broad tone variation: some dunes are pale shell sand, some are redder
  for (let i = 0; i < 260; i++) {
    const x = rnd() * S, y = rnd() * S, r = rr(24, 150), t = rnd();
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, t > 0.5 ? 'rgba(214,198,166,.30)' : 'rgba(164,142,112,.26)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // wind ripples: long, slightly curved, and never quite parallel
  for (let i = 0; i < 190; i++) {
    const y0 = rnd() * S, amp = rr(2, 9), len = rr(60, 200), ph = rnd() * 6.283;
    for (let x = -20; x < S + 20; x += 4) {
      const y = y0 + Math.sin((x / len) * 6.283 + ph) * amp;
      const a = rr(0.03, 0.10);
      g.fillStyle = `rgba(236,224,198,${a.toFixed(3)})`;
      g.fillRect(x, y, 4, 1.4);
      g.fillStyle = `rgba(120,104,82,${(a * 0.8).toFixed(3)})`;
      g.fillRect(x, y + 1.5, 4, 1.1);
      hg.fillStyle = `rgba(${190 + Math.round(rnd() * 40)},190,190,.5)`;
      hg.fillRect(x, y, 4, 1.6);
      hg.fillStyle = 'rgba(60,60,60,.45)';
      hg.fillRect(x, y + 1.8, 4, 1.4);
    }
  }
  // grain, and the odd dark fleck of scrub
  for (let i = 0; i < 9000; i++) {
    const v = 150 + Math.round(rnd() * 90);
    g.fillStyle = `rgba(${v + 14},${v + 4},${v - 22},${rr(0.05, 0.20).toFixed(2)})`;
    g.fillRect(rnd() * S, rnd() * S, rr(0.8, 2.2), rr(0.8, 2.0));
  }
  for (let i = 0; i < 130; i++) {
    g.fillStyle = `rgba(78,72,52,${rr(0.10, 0.26).toFixed(2)})`;
    g.beginPath(); g.ellipse(rnd() * S, rnd() * S, rr(1.5, 6), rr(1, 3.5), rnd() * 3, 0, 7); g.fill();
  }
  return { map: c, normal: normalFromHeight(hc, 0.7) };
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
        /* an irrigated Gulf lawn in warm afternoon light: olive-sage, never
           the bottle green that reads as plastic at ten metres */
        const greens = dry
          ? [`rgba(${Math.round(104 * tone)},${Math.round(96 * tone)},${Math.round(62 * tone)},1)`,
             `rgba(${Math.round(162 * tone)},${Math.round(150 * tone)},${Math.round(102 * tone)},1)`,
             `rgba(${Math.round(206 * tone)},${Math.round(194 * tone)},${Math.round(146 * tone)},1)`]
          : [`rgba(${Math.round(66 * tone)},${Math.round(76 * tone)},${Math.round(44 * tone)},1)`,
             `rgba(${Math.round(116 * tone)},${Math.round(128 * tone)},${Math.round(74 * tone)},1)`,
             `rgba(${Math.round(182 * tone)},${Math.round(184 * tone)},${Math.round(124 * tone)},1)`];
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
  const S = TS(1024), c = cv(S), g = c.getContext('2d');
  /* a real mown lawn under the instanced blades: the scan gives the thatch and
     soil shadow between tufts that a flat fill cannot, and the drawn blades
     below give the depth the camera reads at the pool edge */
  const grassPhoto = PHOTO.grass;
  if (grassPhoto) {
    g.fillStyle = '#6a7440';
    g.fillRect(0, 0, S, S);
    g.save();
    g.globalCompositeOperation = 'luminosity';
    g.globalAlpha = 0.50;
    g.drawImage(grassPhoto.color, 0, 0, S, S);
    g.globalCompositeOperation = 'soft-light';
    g.globalAlpha = 0.16;
    g.drawImage(grassPhoto.color, 0, 0, S, S);
    g.restore();
  } else {
    g.fillStyle = '#6f7a44';
    g.fillRect(0, 0, S, S);
  }

  // broad mottling, first: light and shade across the mat
  for (let i = 0; i < 260; i++) {
    const x = rnd() * S, y = rnd() * S, r = rr(40, 190), t = rnd();
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, t > 0.55 ? 'rgba(104,118,62,.22)' : t > 0.25 ? 'rgba(58,68,36,.15)' : 'rgba(146,148,88,.24)');
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
    [66, 78, 42], [82, 94, 50], [98, 110, 58], [116, 126, 66], [138, 140, 82], [166, 158, 104]
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
  /* One card = one spray, not a tuft.
     shade-verse draws its canopies the same way (src/world/trees.ts treeGeo):
     a card carries a small piece of a branch — a twig with a handful of
     leaves along it — and the crown is built from hundreds of them, so the
     gaps between cards read as air and the canopy has structure instead of
     being a felted disc of leaf. The earlier card packed a whole branchlet
     (sixteen sprays, a thousand leaves) into 20 cm, which is why an olive
     read as a bush of pale blobs.
     Four variants in one atlas, one per quadrant, picked per card through an
     instanced attribute, so the repetition that a single card cannot avoid is
     gone. Two canvases as before: colour is painted over an opaque bed of the
     same olive so mipmaps never darken the far crown, and the cut is its own
     greyscale map. */
  const S = 512, C = 256;
  const c = cv(S), g = c.getContext('2d');
  const ac = cv(S), a = ac.getContext('2d');
  g.fillStyle = '#4e583c';
  g.fillRect(0, 0, S, S);
  a.fillStyle = '#000';
  a.fillRect(0, 0, S, S);
  g.lineCap = g.lineJoin = 'round';
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));

  /* one olive leaf: base at the origin, pointing along +x, a narrow lanceolate
     blade with a pale midrib. lum 0 = shaded heart, 1 = sunlit rim. */
  const leaf = (bx, by, ang, len, hw, lum, warm, shade, alpha) => {
    /* silver-sage, not mint: the blue of the old ramp came from G and B
       travelling together, which reads as a worn plastic leaf at any light.
       A real olive is grey-green with a warm edge and a pale underside. */
    const R = 88 + 78 * lum + 14 * warm;
    const G = 100 + 74 * lum + 6 * warm;
    const B = 66 + 48 * lum - 12 * warm;
    for (const [ctx, a2] of [[g, 1], [a, alpha]]) {
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(ang);
      if (a2 === 1) {
        const grd = ctx.createLinearGradient(0, -hw, 0, hw);
        grd.addColorStop(0, `rgb(${cl(R * 1.04 * shade)},${cl(G * 1.03 * shade)},${cl(B * 1.06 * shade)})`);
        grd.addColorStop(0.5, `rgb(${cl(R * 0.88 * shade)},${cl(G * 0.90 * shade)},${cl(B * 0.92 * shade)})`);
        grd.addColorStop(1, `rgb(${cl(R * 0.76 * shade)},${cl(G * 0.80 * shade)},${cl(B * 0.82 * shade)})`);
        ctx.fillStyle = grd;
      } else {
        ctx.fillStyle = '#fff';
      }
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(len * 0.34, -hw * 1.85, len, 0);
      ctx.quadraticCurveTo(len * 0.36, hw * 1.85, 0, 0);
      ctx.fill();
      if (a2 === 1) {
        ctx.strokeStyle = `rgba(${cl(R * 1.20)},${cl(G * 1.18)},${cl(B * 1.24)},.55)`;
        ctx.lineWidth = Math.max(0.7, len * 0.020);
        ctx.beginPath();
        ctx.moveTo(len * 0.04, 0);
        ctx.quadraticCurveTo(len * 0.55, -hw * 0.10, len * 0.94, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
  };

  const twig = (x0, y0, mx, my, tx, ty, w) => {
    g.strokeStyle = 'rgba(96,86,60,.75)';
    g.lineWidth = w;
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, tx, ty); g.stroke();
    a.strokeStyle = '#fff';
    a.lineWidth = Math.max(1.2, w * 0.95);
    a.beginPath(); a.moveTo(x0, y0); a.quadraticCurveTo(mx, my, tx, ty); a.stroke();
  };

  /* one spray inside a cell: a twig rising from the cell's foot, a leaf pair
     at every node, shortening and turning down toward the tip */
  const spray = (ox, oy, seedShift) => {
    /* three twigs per cell, splayed like a hand: one card then holds enough
       leaf to read as canopy at 15 m and still breaks into sprays at 3 m */
    for (let t = 0; t < 3; t++) {
      twigFrom(ox, oy, -Math.PI * 0.5 + (t - 1) * rr(0.34, 0.46) + rr(-0.10, 0.10));
    }
  };

  const twigFrom = (ox, oy, tipAng) => {
    const cx = ox + C * 0.5, cy = oy + C * 0.96;
    const L = C * rr(0.56, 0.80);
    const bend = rr(-0.45, 0.45);
    const mx = cx + Math.cos(tipAng + bend * 0.55) * L * 0.52;
    const my = cy + Math.sin(tipAng + bend * 0.55) * L * 0.52;
    const tx = cx + Math.cos(tipAng + bend) * L;
    const ty = cy + Math.sin(tipAng + bend) * L;
    twig(cx, cy, mx, my, tx, ty, C * rr(0.010, 0.016));

    const pairs = 12 + Math.floor(rnd() * 3);
    const leaves = [];
    for (let k = 1; k <= pairs; k++) {
      const u = k / (pairs + 0.35), it = 1 - u;
      const px = it * it * cx + 2 * it * u * mx + u * u * tx;
      const py = it * it * cy + 2 * it * u * my + u * u * ty;
      const dx = 2 * it * (mx - cx) + 2 * u * (tx - mx);
      const dy = 2 * it * (my - cy) + 2 * u * (ty - my);
      const along = Math.atan2(dy, dx);
      const lum = clamp(rr(0.28, 0.86));
      for (const side of [-1, 1]) {
        leaves.push({
          x: px, y: py,
          ang: along + side * rr(0.80, 1.24) + rr(-0.12, 0.12),
          len: C * rr(0.17, 0.225) * (1 - 0.18 * u),
          hw: C * rr(0.026, 0.034),
          lum, warm: rr(-0.5, 0.7),
          shade: side > 0 ? rr(0.92, 1.02) : rr(1.04, 1.16),
          alpha: rr(0.90, 1).toFixed(2)
        });
      }
    }
    // a terminal leaf carries the tip past the last pair
    leaves.push({
      x: tx, y: ty, ang: tipAng + bend + rr(-0.2, 0.2),
      len: C * rr(0.16, 0.20), hw: C * rr(0.026, 0.032),
      lum: clamp(rr(0.32, 0.88)), warm: rr(-0.4, 0.6), shade: rr(0.95, 1.10), alpha: 1
    });
    leaves.sort((A, B) => A.y - B.y);
    for (const L2 of leaves) leaf(L2.x, L2.y, L2.ang, L2.len, L2.hw, L2.lum, L2.warm, L2.shade, L2.alpha);
  };

  for (let k = 0; k < 4; k++) spray((k % 2) * C, Math.floor(k / 2) * C, k);
  return { map: c, alpha: ac, cells: 2 };
}

function makeBarkTextures() {
  const S = TS(512), c = cv(S), g = c.getContext('2d');
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
  const S = TS(512), c = cv(S), g = c.getContext('2d');
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
  const S = TS(512), c = cv(S), g = c.getContext('2d');
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
  const S = LITE_TEX ? 1024 : 2048, c = cv(S), g = c.getContext('2d');
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

/** The entry mat: charcoal coir, woven one way, bound on all four edges.
    Reads as a mat at 1.5 m and costs one 512 canvas. */
function makeDoormat() {
  const S = TS(512), c = cv(S), g = c.getContext('2d');
  const hc = cv(256), hg = hc.getContext('2d');
  g.fillStyle = '#403d37'; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S);
  // the coir ribs, one direction, slightly uneven like a real mat
  for (let y = 0; y < S; y += 5) {
    const t = rr(0.84, 1.14);
    g.fillStyle = `rgba(${Math.round(84 * t)},${Math.round(80 * t)},${Math.round(70 * t)},.92)`;
    g.fillRect(0, y + rr(0, 1.4), S, rr(2.2, 3.4));
    hg.fillStyle = rnd() > 0.5 ? 'rgba(198,198,198,.55)' : 'rgba(70,70,70,.5)';
    hg.fillRect(0, y, S, 2.6);
  }
  // cross threads, sparse and dark, so the weave holds together
  for (let x = 0; x < S; x += 13) {
    g.strokeStyle = 'rgba(20,19,17,.30)';
    g.lineWidth = rr(1.0, 1.8);
    g.beginPath(); g.moveTo(x + rr(-1, 1), 0); g.lineTo(x + rr(-1, 1), S); g.stroke();
  }
  for (let i = 0; i < 7000; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(126,120,108,.20)' : 'rgba(14,14,12,.22)';
    g.fillRect(rnd() * S, rnd() * S, rr(1, 3), rr(0.8, 2));
  }
  // the bound border: a band in near-black round the four edges
  g.strokeStyle = '#22211e';
  g.lineWidth = 14;
  g.strokeRect(7, 7, S - 14, S - 14);
  return { map: c, normal: normalFromHeight(hc, 0.35) };
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
  const S = TS(1024), c = cv(S), g = c.getContext('2d');
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
  const S = TS(512), c = cv(S), g = c.getContext('2d');
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

// ─────────────────────────────────────────────────────────────────────────────
// PATCH A · date-palm fronds, ported from shade-verse src/world/trees.ts
// (palmFrondTex + palmFrondStrips, Shifat's work).
//
// A frond is one arched rib folded into a shallow V, and the leaflets are DRAWN
// into an alpha map rather than modelled: ~58 leaflet pairs per side, each a
// curved tapering strip that leaves the rib and droops at its own angle. The
// card is alpha-tested, never blended, so the cut edge stays crisp at any
// distance and a frond costs a few hundred triangles instead of a thousand.
// ─────────────────────────────────────────────────────────────────────────────

/** The pinnate leaflet map: white leaflets on black, used as colour AND cut. */
function makePalmFrondTex() {
  const W = 256, H = 512;
  const c = cv(W, H), g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  const Y = (v) => (1 - v) * H;                 // v = 0 at the base, 1 at the tip
  const N = 70;

  for (const side of [-1, 1]) {
    for (let k = 0; k < N; k++) {
      const v0 = 0.055 + 0.905 * (k + rnd() * 0.7) / N;
      const tip = Math.min(1, v0 + 0.045 + 0.035 * rnd());
      const reach = (0.86 + 0.14 * rnd()) * (W * 0.5 - 3);
      const x0 = W / 2 + side * 1.6, y0 = Y(v0);
      const x2 = W / 2 + side * reach, y2 = Y(tip);
      const x1 = W / 2 + side * reach * 0.46, y1 = Y(v0 + (tip - v0) * 0.86);

      // a quadratic spine with a width that tapers to nothing
      const wb = 8.4 - 3.6 * v0, STEPS = 9, L = [], R = [];
      for (let i = 0; i <= STEPS; i++) {
        const t = i / STEPS, it = 1 - t;
        const px = it * it * x0 + 2 * it * t * x1 + t * t * x2;
        const py = it * it * y0 + 2 * it * t * y1 + t * t * y2;
        const dx = 2 * it * (x1 - x0) + 2 * t * (x2 - x1);
        const dy = 2 * it * (y1 - y0) + 2 * t * (y2 - y1);
        const dl = Math.hypot(dx, dy) || 1;
        const hw = 0.5 * wb * (1 - 0.86 * t) * (t < 0.16 ? 0.55 + t * 2.8 : 1);
        L.push([px - dy / dl * hw, py + dx / dl * hw]);
        R.push([px + dy / dl * hw, py - dx / dl * hw]);
      }
      // tone: a frond is deep green at the rib and sun-bleached at the tips,
      // and the leaflets that lie over each other go a shade darker
      const li = 0.82 + 0.16 * v0 + rr(-0.03, 0.03);
      g.fillStyle = `rgba(${Math.round(206 * li)},${Math.round(216 * li)},${Math.round(178 * li)},1)`;
      g.beginPath();
      g.moveTo(L[0][0], L[0][1]);
      for (const p of L) g.lineTo(p[0], p[1]);
      for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
      g.closePath();
      g.fill();
    }
  }
  // the rib: a pale tapering spine drawn over the leaflet roots
  for (let i = 0; i < 46; i++) {
    const v0 = i / 46, v1 = (i + 1) / 46, w = 6.4 - 5.0 * v0;
    g.fillStyle = `rgba(${Math.round(196 - 26 * v0)},${Math.round(204 - 22 * v0)},${Math.round(160 - 18 * v0)},1)`;
    g.fillRect(W / 2 - w / 2, Y(v1), w, Y(v0) - Y(v1) + 1);
  }
  return c;
}

/** Fine cypress needles on a card: a dark body, a thousand short sprays. */
function makeNeedleCluster() {
  const S = TS(256), c = cv(S), g = c.getContext('2d');
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
  const S = TS(512), c = cv(S), g = c.getContext('2d');
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
  const S = TS(128), c = cv(S), g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(0,0,0,.60)');
  grd.addColorStop(0.38, 'rgba(0,0,0,.42)');
  grd.addColorStop(0.72, 'rgba(0,0,0,.14)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return c;
}

/** A soft band: dark at one edge, gone at the other. Contact shading along a
    wall, where a round decal would read as a smudge. */
function makeContactBandTexture() {
  const W = 16, H = 64, c = cv(W, H), g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0.00, 'rgba(0,0,0,.66)');
  grd.addColorStop(0.22, 'rgba(0,0,0,.50)');
  grd.addColorStop(0.55, 'rgba(0,0,0,.20)');
  grd.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  return c;
}

/** Soft radial veil, used for lens glare at the big openings. */
function makeGlowTexture() {
  const S = TS(256), c = cv(S), g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,238,210,1)');
  grd.addColorStop(0.35, 'rgba(255,228,190,.55)');
  grd.addColorStop(0.7, 'rgba(255,220,180,.14)');
  grd.addColorStop(1, 'rgba(255,215,175,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return c;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Megascans props — a small glTF 2.0 binary reader

   Every prop in models/ is a Quixel Megascans asset (Fab, free) re-encoded for
   the web: one mesh, one material, 512 px maps, no Draco and no extensions, so
   the reader below is the whole loader. A GLB is fetched only after the scene
   has drawn its first frame, each request has a deadline, and a prop that does
   not arrive leaves the procedural piece it was going to replace exactly where
   it was. Nothing in this layer can block the first paint.
   ───────────────────────────────────────────────────────────────────────────── */
const MEGA_ASSETS = {
  palm:           { wind: 0.11, shadow: true,  soft: 0.42 },
  lady_palm:      { wind: 0.06, shadow: true,  soft: 0.40 },
  snake_plant:    { wind: 0.04, shadow: true,  soft: 0.38 },
  ribbon_plant:   { wind: 0.05, shadow: false, soft: 0.38 },
  fountain_grass: { wind: 0.09, shadow: false, soft: 0.45 },
  grass_tuft:     { wind: 0.06, shadow: false, soft: 0.45 },
  rock_formation: { wind: 0, shadow: true },
  boulder:        { wind: 0, shadow: true },
  sandstone:      { wind: 0, shadow: true },
  clay_vase:      { wind: 0, shadow: true },
  wood_vase:      { wind: 0, shadow: true },
  /* the 2026-11-26 planting + props pass (SUBSTITUTES.md §1–§4) */
  yucca_a:        { wind: 0.030, shadow: true, soft: 0.42 },
  fan_palm:       { wind: 0.055, shadow: true, soft: 0.44 },
  cane_palm:      { wind: 0.050, shadow: true, soft: 0.42 },
  tropical_palm:  { wind: 0.060, shadow: true, soft: 0.46 },
  laurel:         { wind: 0.028, shadow: true, soft: 0.44 },
  ground_cover:   { wind: 0.018, shadow: false, soft: 0.46 },
  pot_bowl:       { wind: 0, shadow: true },
  pot_taper:      { wind: 0, shadow: true },
  median:         { wind: 0, shadow: true },
  bollard:        { wind: 0, shadow: true },
  bench:          { wind: 0, shadow: true }
};

function glbChunks(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a GLB');
  let off = 12, json = null, bin = null;
  while (off + 8 <= buf.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    off += 8;
    const chunk = buf.slice(off, off + len);
    if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(chunk));
    else if (type === 0x004E4942) bin = chunk;
    off += len + ((4 - (len % 4)) % 4);
  }
  if (!json || !bin) throw new Error('incomplete GLB');
  return { json, bin };
}

function glbAccessor(json, bin, index) {
  const a = json.accessors[index];
  const bv = json.bufferViews[a.bufferView];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const TA = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[a.componentType];
  if (!TA) throw new Error('unsupported component type ' + a.componentType);
  const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const need = comps * TA.BYTES_PER_ELEMENT;
  const stride = bv.byteStride || need;
  if (stride === need) return new TA(bin, base, a.count * comps);
  const out = new TA(a.count * comps);
  for (let i = 0; i < a.count; i++) out.set(new TA(bin, base + i * stride, comps), i * comps);
  return out;
}

function glbTexture(THREE, json, bin, info, srgb) {
  const tex = json.textures[info.index];
  const img = json.images[tex.source];
  const bv = json.bufferViews[img.bufferView];
  const bytes = new Uint8Array(bin, bv.byteOffset || 0, bv.byteLength);
  const url = URL.createObjectURL(new Blob([bytes], { type: img.mimeType || 'image/jpeg' }));
  const t = new THREE.TextureLoader().load(url, () => URL.revokeObjectURL(url));
  t.flipY = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Fetch + decode one Megascans GLB into { geometry, material }. */
function loadMegaModel(THREE, url, timeout = 9000) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => ctl && ctl.abort(), timeout);
  return fetch(url, ctl ? { signal: ctl.signal, mode: 'cors' } : { mode: 'cors' })
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
    .then((buf) => {
      clearTimeout(timer);
      const { json, bin } = glbChunks(buf);
      const prim = json.meshes[0].primitives[0];
      const geo = new THREE.BufferGeometry();
      const P = glbAccessor(json, bin, prim.attributes.POSITION);
      geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
      if (prim.attributes.NORMAL != null) geo.setAttribute('normal', new THREE.BufferAttribute(glbAccessor(json, bin, prim.attributes.NORMAL), 3));
      if (prim.attributes.TEXCOORD_0 != null) geo.setAttribute('uv', new THREE.BufferAttribute(glbAccessor(json, bin, prim.attributes.TEXCOORD_0), 2));
      if (prim.indices != null) geo.setIndex(new THREE.BufferAttribute(glbAccessor(json, bin, prim.indices), 1));
      if (prim.attributes.NORMAL == null) geo.computeVertexNormals();
      geo.computeBoundingSphere();
      const def = (json.materials && json.materials[0]) || {};
      const pbr = def.pbrMetallicRoughness || {};
      const mat = new THREE.MeshStandardMaterial({
        color: pbr.baseColorFactor ? new THREE.Color(pbr.baseColorFactor[0], pbr.baseColorFactor[1], pbr.baseColorFactor[2]) : 0xffffff,
        metalness: pbr.metallicFactor != null ? pbr.metallicFactor : 0,
        roughness: pbr.roughnessFactor != null ? pbr.roughnessFactor : 1,
        side: def.doubleSided ? THREE.DoubleSide : THREE.FrontSide
      });
      if (pbr.baseColorTexture) mat.map = glbTexture(THREE, json, bin, pbr.baseColorTexture, true);
      if (def.normalTexture) mat.normalMap = glbTexture(THREE, json, bin, def.normalTexture, false);
      if (pbr.metallicRoughnessTexture) mat.roughnessMap = glbTexture(THREE, json, bin, pbr.metallicRoughnessTexture, false);
      if (def.alphaMode === 'MASK') mat.alphaTest = def.alphaCutoff || 0.35;
      mat.envMapIntensity = 0.9;
      return { geometry: geo, material: mat };
    })
    .catch((e) => { clearTimeout(timer); throw e; });
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

/* A breathing point between build stages. The scene is one long synchronous
   construction — textures, geometry, the sky, the first shader compile — and
   without these the whole of it lands in a single task, so the page cannot
   paint or answer a scroll while it runs. Each stage now ends on an idle
   callback (a rAF fallback), which keeps the longest task short without
   adding to the total: the same work, split into slices the browser can
   schedule around the user. */
const nextTick = (timeout = 90) => new Promise((resolve) => {
  if (typeof requestIdleCallback === 'function') {
    const t = setTimeout(resolve, timeout);
    requestIdleCallback(() => { clearTimeout(t); resolve(); }, { timeout });
  } else if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => resolve());
  } else {
    setTimeout(resolve, 0);
  }
});

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
    if (q.has('city')) opts.city = q.get('city') !== '0';
    if (q.has('quality')) opts.quality = q.get('quality');
    if (q.has('models')) opts.models = q.get('models') !== '0';
  }

  /* ── environment ──────────────────────────────────────────────────────────
     The device tier is decided from the container's own width, not the window's,
     so a narrow column inside a wide page still gets the light tier.          */
  const REDUCED = opts.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hostW = container.clientWidth || window.innerWidth;
  const lite = opts.quality === 'lite' || (opts.quality === 'auto' && (hostW <= 820 ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 1100)));
  const MOBILE = lite;
  /* ── the lean budget ─────────────────────────────────────────────────────
     A phone gets lite. A 4 GB phone, or any machine that reports four cores
     or fewer, gets the same scene under a stricter budget: half-size bakes,
     no secondary maps, a smaller shadow map, a leaner lawn and no far
     Megascans layer. `navigator.deviceMemory` is Chromium-only, so cores are
     the second signal.                                                     */
  LOWRAM = (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
  LEAN = MOBILE || LOWRAM;
  /* what this boot actually cost, for the perf harness and the README */
  const ctxStats = {
    lowram: LOWRAM, lean: LEAN, dpr: 0, shadowMap: 0, scratchCanvasesFreed: 0, scratchMbFreed: 0,
    photoWaitMs: 0, grassTufts: 0, megascansDeferred: 0
  };
  /* tablet sits between the phone tier and the full desktop tier */
  const TABLET = !MOBILE && opts.quality === 'auto' && Math.min(hostW, window.innerWidth) <= 1024;
  /* the drawing buffer is never larger than this, whatever the device reports:
     1.25× is already retina-crisp for this soft, painterly render and costs a
     quarter of the fragments of a 2× buffer. */
  /* the panel's Max pixel ratio is a ceiling, never a floor for a weaker tier:
     a 1.5 setting on a phone still caps at the lite tier's 1.25 */
  const TIER_DPR = LOWRAM ? 1.0 : (MOBILE ? 1.25 : (TABLET ? 1.4 : 1.75));
  const DPR_MAX = opts.dprMax != null ? Math.min(opts.dprMax, TIER_DPR) : TIER_DPR;
  /* a phone gets half-size normal maps: four times fewer pixels to derive, and
     four times less texture memory for the same look at a 390 px canvas */
  LITE_TEX = LEAN;
  NRM_CAP = LEAN ? 256 : (TABLET ? 768 : 0);

  /* Photo scans start downloading now, in parallel with three.js, the renderer
     and the procedural canvases. They are only awaited just before the
     materials are built, and never for longer than 2.5 s: a phone on a slow
     connection gets the all-procedural scene rather than a blank canvas. */
  let photos = null;
  let photoBase = null;
  {
    let base = opts.textureBase;
    if (!base) {
      try { base = new URL('./textures/', import.meta.url).href; }
      catch (_) { base = './textures/'; }
    }
    TEX_BASE = base;
    photoBase = base;
    photos = LEAN
      ? loadPhotos(base, true, PHOTO_CORE, ['color']).catch(() => null)
      : loadPhotos(base, false).catch(() => null);
  }

  const section = container;
  /* A host may drive progress from a taller element than the box the canvas
     fills — the Framer component is a 100vh sticky frame inside an 820vh
     track — so the measured element and the painted element can differ. */
  const scrollHost = opts.scrollTarget
    ? (typeof opts.scrollTarget === 'string' ? document.querySelector(opts.scrollTarget) : opts.scrollTarget)
    : section;
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
    renderer.toneMappingExposure = 1.16;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.info.autoReset = false;
    renderer.autoClear = true;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xd9d8d2, 0.00230);

    /*  Height-based haze. three's fog is depth-only, which lays the same veil
        on the villa and on a tower a kilometre out at the same distance. The
        air is not like that: the mist sits in the first twenty metres and thins
        with altitude, so the skyline sinks into the ground haze while the
        house, at eye level, stays crisp. One varying and a multiply, on every
        material that already carries fog; the sky has its own gradient. */
    if (!MOBILE && !THREE.ShaderChunk.__shadeHeightFog) {
      /*  A phone keeps the stock fog chunk: the same atmosphere, without an
          extra varying and a smoothstep in every fragment program. Its skyline
          already carries its own height haze in the city shader, so the air on
          the phone is unchanged and the first frame stays where it was. */
      THREE.ShaderChunk.__shadeHeightFog = true;
      THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n\tvarying float vFogDepth;\n\tvarying float vFogH;\n#endif';
      THREE.ShaderChunk.fog_vertex = `#ifdef USE_FOG
        vFogDepth = - mvPosition.z;
        {
          vec4 fogW = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            fogW = instanceMatrix * fogW;
          #endif
          vFogH = (modelMatrix * fogW).y;
        }
      #endif`;
      THREE.ShaderChunk.fog_pars_fragment = THREE.ShaderChunk.fog_pars_fragment
        .replace('varying float vFogDepth;', 'varying float vFogDepth;\n\tvarying float vFogH;');
      THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
        #ifdef FOG_EXP2
          float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
        #else
          float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
        #endif
        /* the haze pools low: full strength at the ground, 60% of it at 45 m,
           which is what puts the far city behind the air without touching the
           house in the foreground */
        fogFactor *= mix( 1.0, 0.60, smoothstep( 2.0, 45.0, vFogH ) );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
      #endif`;
    }
    /* hooks the look controls fill in later (sky rebuild, palm toggle) */
    let setSky = null;
    let setPalms = () => {};
    let setCity = () => {};
    let cityMood = null;
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 4200);   /* the skyline sits a kilometre out */

    await nextTick();

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
        /*  The committed look: a low sun in the west, roughly eighteen degrees
            up, raking across the approach facade while the carport and entry
            side fall into cool shade. The sky is blue overhead and only goes
            pale at the ridge; the light is white-warm, not orange, so the
            limestone stays the pale stone it is. Rayleigh scatter, muted mid
            blue desaturating down the long ray path into a neutral haze. */
        stops: [[0, '#3b6a9e'], [78, '#3f6da2'], [58, '#4573a8'], [38, '#5181b2'],
          [24, '#638cbb'], [15, '#78a0c5'], [10, '#90b1cf'], [6.5, '#a9c3d8'],
          [5.0, '#c6d1d8'], [3.8, '#d3d8d4'], [2.8, '#dfe0da'], [2.0, '#e9e8e1'],
          [1.2, '#f0eee6'], [0.5, '#f5f3ea']],
        horizon: '#dfdcd2', below: ['#dedbd2', '#bfbcb2', '#8f8d84', '#4c4b45'],
        sun: [-0.86, 0.30, 0.41], sunCol: [1.50, 1.13, 0.88], sunInt: 4.75, light: 0xffd2a0,
        sunGlow: 'rgba(255,250,240,.88)', lit: [253, 251, 246], shade: [184, 193, 209],
        fog: 0xd9d8d2
      },
      noon: {
        stops: [[0, '#396aa2'], [78, '#3d6ea6'], [58, '#4476ac'], [38, '#5082b4'],
          [24, '#6291bd'], [15, '#77a5c8'], [10, '#8db5d3'], [6.5, '#a6c5dc'],
          [5.0, '#bdd4e0'], [3.8, '#d3dade'], [2.8, '#e2e0d3'], [2.0, '#ece6d3'],
          [1.2, '#f3ecd8'], [0.5, '#f8f1de']],
        horizon: '#e6dfcd', below: ['#e2dccb', '#c6bfa9', '#978e79', '#554e40'],
        sun: [-0.55, 0.78, 0.30], sunCol: [1.45, 1.26, 1.02], sunInt: 5.4, light: 0xfff4e2,
        sunGlow: 'rgba(255,252,240,.92)', lit: [253, 252, 248], shade: [180, 190, 208],
        fog: 0xe6dfcd
      },
      golden: {
        stops: [[0, '#3a5c8e'], [78, '#3f6296'], [58, '#466a9d'], [38, '#5477a8'],
          [24, '#6785b3'], [15, '#8296bb'], [10, '#9fa9c0'], [6.5, '#bcb9ba'],
          [5.0, '#d2c5b2'], [3.8, '#e0caa9'], [2.8, '#e9cf9f'], [2.0, '#efd5a3'],
          [1.2, '#f5ddae'], [0.5, '#fae5c0']],
        horizon: '#e6d3b6', below: ['#e1cfb4', '#c6ae90', '#98836b', '#4f4739'],
        sun: [-0.94, 0.16, 0.32], sunCol: [1.75, 1.02, 0.52], sunInt: 4.2, light: 0xffc78a,
        sunGlow: 'rgba(255,236,198,.90)', lit: [255, 236, 208], shade: [178, 175, 190],
        fog: 0xe6d3b4
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
            let dens = smoothstep(base - 0.10, base + 0.30, f) * band;
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
        /* one soft pass before it becomes sky: a cumulus edge is a gradient,
           not a cut line, and the field's own threshold leaves it crisp */
        const soft = cv(CW, bandH);
        const sctx = soft.getContext('2d');
        sctx.filter = 'blur(1.8px)';
        sctx.drawImage(cloudCanvas, 0, 0);
        // scaled up by the canvas itself: soft, and no half-res grid
        g.imageSmoothingEnabled = true;
        g.drawImage(soft, 0, y0Full, W, bandH * 2);
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
      // the cloud field is built from cos/sin of the azimuth, so it closes on
      // itself: repeat the wrap instead of clamping, which drew a hard seam
      // straight down the sky
      t.wrapS = THREE.RepeatWrapping;
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
      return t;
    }

    let skyTexture = makeSky(opts.timeOfDay, opts.cloudCover);
    const SUN_DIR = new THREE.Vector3(...(SKY_PRESETS[opts.timeOfDay] || SKY_PRESETS.morning).sun).normalize();
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    scene.environment = pmrem.fromEquirectangular(skyTexture).texture;

    /* ── sun ───────────────────────────────────────────────────────────── */
    const SUN_P0 = SKY_PRESETS[opts.timeOfDay] || SKY_PRESETS.morning;
    const sun = new THREE.DirectionalLight(SUN_P0.light ?? 0xffd2a0, SUN_P0.sunInt);
    sun.position.copy(SUN_DIR).multiplyScalar(120);
    sun.target.position.set(-1, 0, -1);
    sun.castShadow = true;
    /* a 4 GB phone gets a 768 px shadow map: 0.6 MB instead of 4 MB of depth,
       and at 390 css px there is no edge anyone can see */
    const SM = LEAN ? (LOWRAM ? 512 : 1024) : (TABLET ? 1536 : 2048);
    ctxStats.shadowMap = SM;
    sun.shadow.mapSize.set(SM, SM);
    sun.shadow.camera.left = -44;
    sun.shadow.camera.right = 44;
    sun.shadow.camera.top = 44;
    sun.shadow.camera.bottom = -44;
    sun.shadow.camera.near = 34;
    sun.shadow.camera.far = 220;
    sun.shadow.bias = -0.00035;
    sun.shadow.normalBias = 0.03;
    /* a longer, softer penumbra than the default: the low sun draws shadows
       three times the height of what casts them, and a hard edge reads as CG */
    sun.shadow.radius = 2;
    scene.add(sun, sun.target);

    /*  the sky's own fill. A desert afternoon is not a studio: the shadow side
        of a wall is still lit by the whole dome, and at 0.17 it read as black.
        The hemisphere now carries the sky colour and a warm sand bounce, which
        is what makes shadows blue-warm instead of dead. */
    scene.add(new THREE.HemisphereLight(0xc4d2e2, 0x9a948a, MOBILE ? 0.60 : 0.74));
    {
      /* one weak ambient term, neutral: the last of the ground bounce, never a
         warm wash over the stone */
      const amb = new THREE.AmbientLight(0xe0dcd2, MOBILE ? 0.14 : 0.20);
      scene.add(amb);
    }

    /* Rebuild the sky, the light and the environment for a preset. Used by the
       Framer look controls; costs one canvas pass and one PMREM bake. */
    setSky = (name, cvr) => {
      const P = SKY_PRESETS[name] || SKY_PRESETS.morning;
      const old = skyTexture;
      skyTexture = makeSky(name, cvr);
      setSkyDome(name, cvr == null ? opts.cloudCover : cvr);
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
      if (cityMood) cityMood(name);
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

/* ─────────────────────────────────────────────────────────────────────────────
   PATCH C · the visible sky dome
   Inserted right after `const WIND = { time: { value: 0 } };`

   The canvas equirect stays what it was — the PMREM environment, so glass,
   paint and the pool keep reflecting the same sky the presets define. What the
   eye sees is this dome instead: the preset gradient sampled by elevation, a
   sun disc with limb darkening, and the cumulus field ported from shade-verse
   (`src/shaders/skyFx.ts`, Shifat's cloudSky): a domain-warped fbm deck whose
   sunward tap shades the cloud bases, whose thin edges catch the forward
   scatter as a silver lining, and which is grouped into clear patches and
   dense clusters rather than spread evenly. It drifts, which a baked canvas
   cannot, and the pool's mirror pass renders it too, so the water agrees.
   ───────────────────────────────────────────────────────────────────────────── */
const SKY_DOME_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const SKY_DOME_FRAG = /* glsl */`
  precision highp float;
  varying vec3 vDir;
  uniform vec4 uStops[16];
  uniform int uStopCount;
  uniform vec3 uHor;
  uniform vec3 uFogC;
  uniform vec3 uSunV;
  uniform vec3 uSunCol;
  uniform float uCover;
  uniform float uWarm;
  uniform float uTime;
  uniform float uCloud;

  float sh2(vec2 p) { return fract(sin(mod(dot(p, vec2(127.1, 311.7)), 6.2831853)) * 43758.5453); }
  float sn2(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(sh2(i), sh2(i + vec2(1.0, 0.0)), f.x),
               mix(sh2(i + vec2(0.0, 1.0)), sh2(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float cfbm(vec2 p) {
    p += vec2(sn2(p * 0.5), sn2(p * 0.5 + 7.3)) * 0.9;
    float f = 0.0, a = 0.55;
    for (int i = 0; i < 5; i++) {
      f += a * sn2(p);
      p = mat2(1.6, 1.2, -1.2, 1.6) * p + vec2(3.1, 1.7);
      a *= 0.48;
    }
    return f;
  }

  /*  A photographic sky, not a painted one: two decks whose edges are
      feathered over a third of their own range, a sun-side tap that shades the
      cumulus bases, and forward scatter on the sunward rim. Nothing here uses
      a hard smoothstep narrower than the noise scale, which is what drew the
      cartoon cut-outs.                                                       */
  vec4 cloudSky(vec3 dn, vec3 sun, float t, float warm, vec3 hor, float cover) {
    if (dn.y <= 0.0) return vec4(0.0);
    float el = clamp(dn.y, 0.0, 1.0);
    float cv = clamp(cover, 0.0, 1.0);
    /* the azimuth is divided by height, so clouds compress toward the horizon
       exactly as a real deck does; drift is slow and mostly lateral */
    vec2 cp = dn.xz / (dn.y + 0.16) * 8.2 + vec2(t * 0.0034, t * 0.0011);
    vec2 sdir = normalize(sun.xz + vec2(1e-4));

    /* ── high cirrus: a thin streaked sheet, only where the eye can see it ── */
    vec2 sp = cp * vec2(0.26, 0.85) + vec2(2.7, 9.4);
    float ci = cfbm(sp * 0.52) * 0.60 + cfbm(sp * 1.65 + 17.3) * 0.40;
    float aCi = smoothstep(0.46, 0.86, ci) * smoothstep(0.04, 0.36, el) * (0.11 + 0.16 * cv);

    /* ── cumulus: a broken deck over a clear zenith ───────────────────────── */
    vec2 q = cp * 0.62;
    float cu = cfbm(q) * 0.78 + cfbm(q * 2.4 + 31.7) * 0.22;
    /* clusters: one corner of the sky carries the weather, the rest stays open */
    float clus = cfbm(q * 0.21 + 5.3);
    float thr = mix(0.63, 0.47, cv) + (clus - 0.5) * 0.16 + smoothstep(0.45, 1.0, el) * 0.05;
    float dens = smoothstep(thr - 0.12, thr + 0.30, cu);
    dens *= smoothstep(0.012, 0.20, dn.y);          // melt into the horizon haze
    dens = pow(dens, 1.15) * uCloud;

    if (dens + aCi <= 0.004) return vec4(0.0);

    /* the same field tapped toward the sun: how much cloud stands between this
       sample and the sun decides how much of it is in shade */
    float near = cfbm((q + sdir * 0.22)) * 0.78 + cfbm((q + sdir * 0.22) * 2.4 + 31.7) * 0.22;
    float shadow = clamp((near - thr + 0.16) / 0.30, 0.0, 1.0);
    float body = pow(dens, 2.0);
    float lit = clamp(0.90 - 0.30 * shadow - 0.20 * body, 0.0, 1.0);

    vec3 sunC = mix(vec3(1.0, 0.975, 0.93), vec3(1.0, 0.72, 0.46), warm);
    vec3 litC = mix(vec3(0.88, 0.89, 0.925), sunC * 1.05, 0.55);
    vec3 shdC = mix(vec3(0.56, 0.59, 0.665), vec3(0.62, 0.56, 0.55), warm * 0.7);
    vec3 cc = mix(shdC, litC, lit);

    /* forward scatter: the silver lining lives on the thin sunward edge, and a
       little of the sun's colour bleeds through the whole deck */
    float g = max(dot(dn, sun), 0.0);
    float phase = pow(g, 7.0) * 0.5 + pow(g, 32.0) * 0.8;
    cc += sunC * phase * (0.35 + 0.85 * (1.0 - dens)) * (0.55 + 0.45 * warm);
    cc += sunC * 0.10 * (1.0 - body) * warm;
    cc = mix(cc, hor * 1.02, 0.14 * (1.0 - lit));

    /* feather the deck into the sky at both ends: no edge survives */
    float a = dens * 0.86 * smoothstep(0.004, 0.13, dn.y);

    /* cirrus over the cumulus, thin and warm-white */
    if (aCi > 0.004) {
      vec3 ciC = mix(vec3(0.86, 0.88, 0.93), vec3(1.0, 0.94, 0.86), 0.45 + 0.55 * warm);
      ciC += vec3(1.0, 0.92, 0.82) * pow(g, 10.0) * 0.35;
      cc = mix(cc, ciC, aCi * (1.0 - a * 0.65));
      a = max(a, aCi * 0.72);
    }
    return vec4(cc, a);
  }

  void main() {
    vec3 dn = normalize(vDir);
    float elev = degrees(asin(clamp(dn.y, -1.0, 1.0)));

    vec3 col = uStops[0].yzw;
    float lo = uStops[0].x;
    for (int i = 1; i < 16; i++) {
      if (i >= uStopCount) break;
      float hi = uStops[i].x;
      float k = clamp((lo - elev) / max(lo - hi, 1e-4), 0.0, 1.0);
      col = mix(col, uStops[i].yzw, k);
      lo = hi;
    }
    col = mix(uHor, col, smoothstep(-0.5, 1.5, elev));

    // sun: a photographed disc with limb darkening, golden and dimmer low
    float sg = max(dot(dn, uSunV), 0.0);
    float sa = acos(clamp(sg, -1.0, 1.0)) / 0.05;
    float sd = 1.0 - smoothstep(0.8, 1.12, sa);
    float mu = sqrt(max(1.0 - sa * sa, 0.0));
    float limb = 0.82 + 0.18 * mu;
    vec3 core = mix(vec3(1.0, 0.98, 0.94) * 2.35, vec3(1.0, 0.74, 0.44) * 1.85, uWarm * uWarm);
    vec3 rim  = mix(vec3(1.0, 0.9, 0.72) * 1.30, vec3(1.0, 0.52, 0.22) * 1.10, uWarm * uWarm);
    col = mix(col, mix(rim, core, limb) * limb * 1.05 * uSunCol, sd);
    col += mix(vec3(1.0, 0.9, 0.75), vec3(1.0, 0.55, 0.25), uWarm) * exp(-max(sa - 1.0, 0.0) * 1.45) * 0.46 * uSunCol;
    col += uSunCol * (pow(sg, 220.0) * 0.26 + pow(sg, 24.0) * 0.085);
    /* the broad atmospheric scatter around the sun that a real sky carries:
       warm, wide and weak, so it reads as air rather than a glow sprite */
    col += mix(vec3(1.0, 0.86, 0.70), vec3(1.0, 0.62, 0.34), uWarm) * pow(sg, 3.2) * (0.055 + 0.055 * uWarm) * uSunCol;

    // the warm band the sun lays along the ridge, and the haze at the horizon
    col += vec3(1.0, 0.76, 0.57) * 0.20 * uWarm * exp(-abs(dn.y) * 9.0)
      * (0.4 + 0.6 * max(dot(normalize(vec3(dn.x, 0.0, dn.z)), normalize(vec3(uSunV.x, 0.0, uSunV.z))), 0.0));
    col = mix(col, uHor, exp(-max(dn.y, 0.0) * 5.5) * 0.55);

    vec4 cs = cloudSky(dn, uSunV, uTime, uWarm, uHor, uCover);
    col = mix(col, cs.rgb, cs.a);

    // under the horizon the dome is only the haze the ground fades into
    col = mix(col, uFogC, smoothstep(0.0, -0.10, dn.y));

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const SKY_WARM = { morning: 0.10, noon: 0.0, golden: 0.55, dusk: 0.9 };

const skyDomeUniforms = {
  uStops: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uStopCount: { value: 14 },
  uHor: { value: new THREE.Color(0.8, 0.8, 0.8) },
  uFogC: { value: new THREE.Color(0.8, 0.8, 0.8) },
  uSunV: { value: SUN_DIR.clone() },
  uSunCol: { value: new THREE.Color(1, 1, 1) },
  uCover: { value: clamp(opts.cloudCover, 0, 1) },
  uWarm: { value: 0.1 },
  uCloud: { value: 1 },
  uTime: WIND.time
};

function setSkyDome(name, cover) {
  const P = SKY_PRESETS[name] || SKY_PRESETS.morning;
  const stops = P.stops.slice().sort((a, b) => b[0] - a[0]);
  for (let i = 0; i < 16; i++) {
    const s = stops[Math.min(i, stops.length - 1)];
    const c = new THREE.Color(s[1]).convertSRGBToLinear();
    skyDomeUniforms.uStops.value[i].set(s[0], c.r, c.g, c.b);
  }
  skyDomeUniforms.uStopCount.value = Math.min(16, stops.length);
  skyDomeUniforms.uHor.value.set(P.horizon).convertSRGBToLinear();
  skyDomeUniforms.uFogC.value.setHex(P.fog).convertSRGBToLinear();
  skyDomeUniforms.uSunV.value.set(P.sun[0], P.sun[1], P.sun[2]).normalize();
  skyDomeUniforms.uSunCol.value.setRGB(P.sunCol[0], P.sunCol[1], P.sunCol[2]).multiplyScalar(0.55);
  skyDomeUniforms.uWarm.value = SKY_WARM[name] ?? 0.1;
  skyDomeUniforms.uCover.value = clamp(cover, 0, 1);
}

setSkyDome(opts.timeOfDay, opts.cloudCover);

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(2400, MOBILE ? 32 : 64, MOBILE ? 20 : 40),
  new THREE.ShaderMaterial({
    uniforms: skyDomeUniforms,
    vertexShader: SKY_DOME_VERT,
    fragmentShader: SKY_DOME_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false
  })
);
skyDome.renderOrder = -1000;
skyDome.frustumCulled = false;
skyDome.layers.set(0);
scene.add(skyDome);
scene.background = null;

    let grassUniforms = null;   // assigned by the grass block
    let grassSetDensity = null;

    function windify(mat, { amp = 0.05, freq = 1.0, height = 2.6, base = 0.4, soft = 0,
      fill = [0.085, 0.105, 0.062], trans = 0 } = {}) {
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uWindTime = WIND.time;
        shader.uniforms.uWindAmp = { value: amp };
        shader.uniforms.uWindFreq = { value: freq };
        shader.uniforms.uWindHeight = { value: height };
        shader.uniforms.uWindBase = { value: base };
        if (trans > 0) {
          shader.uniforms.uSunDir = { value: SUN_DIR };
          shader.uniforms.uTrans = { value: trans };
        }
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
               totalEmissiveRadiance += diffuseColor.rgb * vec3(${fill[0].toFixed(3)}, ${fill[1].toFixed(3)}, ${fill[2].toFixed(3)});`
            );
          if (trans > 0) {
            /* A leaf is a window, not a card: sunlight behind it comes through
               the blade and the crown glows silver instead of going to a black
               silhouette against the sky. */
            shader.fragmentShader = shader.fragmentShader
              .replace('#include <common>', `#include <common>
                uniform vec3 uSunDir; uniform float uTrans;`)
              .replace(
                '#include <lights_fragment_end>',
                `#include <lights_fragment_end>
                 vec3 sunView = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
                 float backLit = max(0.0, -dot(normal, sunView));
                 float thru = pow(backLit, 1.3) * uTrans;
                 totalEmissiveRadiance += diffuseColor.rgb * vec3(1.22, 1.16, 0.92) * thru * 1.10;`
              );
          }
        }
      };
      mat.customProgramCacheKey = () => `wind${amp}${freq}${height}${base}${soft}${fill.join('_')}${trans}`;
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
            float caus = pow(abs(c1 * c2), 2.1) * 1.05;
            /* a second, finer net crossing the first: the bright knots where
               they meet are what reads as sunlight focused through the ripple */
            vec2 cp2 = vCPos.xz * 5.4 - vCPos.y * 2.2;
            float c3 = sin(cp2.x - ct * 0.92 + sin(cp2.y * 1.7 + ct * 0.6) * 1.9);
            float c4 = sin(cp2.y * 1.31 + ct * 0.71 + sin(cp2.x * 1.07 - ct * 0.48) * 1.6);
            caus += pow(abs(c3 * c4), 2.8) * 0.55;
            caus *= smoothstep(-0.20, -0.9, vCPos.y) * 0.94 + 0.05;
            /* underwater sun bounce: the basin walls shade the floor from a
               low morning sun, and a real pool is still bright down there
               because the light comes in through the surface */
            diffuseColor.rgb += vec3(0.13, 0.17, 0.15) * (smoothstep(-0.20, -0.95, vCPos.y) * 0.9 + 0.05);
            diffuseColor.rgb += vec3(0.34, 0.50, 0.44) * caus;
          `);
      };
      mat.customProgramCacheKey = () => 'caustic';
      return mat;
    }

    await nextTick();

    /* ── materials ─────────────────────────────────────────────────────── */
    /* the first frame is not held for a slow scan: a lean device waits 900 ms
       for the six colours it needs and not a millisecond longer */
    if (photos) {
      await Promise.race([photos, new Promise((r) => setTimeout(r, LEAN ? 900 : 2500))]);
    }
    const stoneA = makeAshlar([221, 211, 194], 5);
    const stoneB = makeStone('#ded4c1', '118,104,86');
    const poolTile = makePoolTile();
    const oak = makeOakFloor();
    const conc = makeConcrete();
    const grav = makeGravel();
    const pave = makePaving();
    const asph = makeAsphalt();
    const facWarm = makeFacade({ wall: [217, 207, 189], glass: [40, 52, 64], balcony: true });
    const facCool = makeFacade({ wall: [196, 194, 186], glass: [34, 46, 60], balcony: false });
    const facWhite = makeFacade({ wall: [231, 228, 219], glass: [46, 58, 70], balcony: true });
    const facSand = makeFacade({ wall: [206, 188, 164], glass: [44, 54, 62], balcony: true });
    const mead = makeMeadow();
    const sand = makeDuneSand();
    const bark = makeBarkTextures();
    const linenA = makeLinen([228, 220, 205]);
    const linenB = makeLinen([118, 110, 98]);
    const boucle = makeBoucle([224, 213, 196]);
    const rugTex = makeRug();
    const oakWood = makeWoodGrain([150, 108, 74], [82, 54, 34], [196, 158, 120]);
    const walnutWood = makeWoodGrain([104, 70, 46], [46, 28, 16], [156, 112, 78]);
    const palmTex = makePalmBark();
    const palmFrondTex = tex(makePalmFrondTex(), { srgb: true });
    const aoTex = tex(makeContactShadowTexture());
    const aoBandTex = tex(makeContactBandTexture());
    /* one paver field, two finishes: the drive in cool grey, the rear deck warm */
    const paveMap = tex(pave.map, { srgb: true });
    const paveNormal = tex(pave.normal);

    /** Same texture with the grain turned through 90 degrees, for panels and
        slats whose long axis runs up the v of a world-space UV.            */
    function texV(canvasEl, repeat = [1, 1]) {
      const t = tex(canvasEl, { repeat });
      t.center.set(0.5, 0.5);
      t.rotation = Math.PI / 2;
      return t;
    }

    const M = {
      /* the villa's travertine: the drawn block structure carries the joints,
         and the scanned Quixel normal and roughness carry the stone itself */
      stone: weather(new THREE.MeshStandardMaterial({
        map: tex(stoneA.map, { srgb: true }),
        normalMap: photoTex('travertine', 'normal') || tex(stoneA.normal),
        roughnessMap: photoTex('travertine', 'rough') || tex(stoneA.rough),
        roughness: 1.0, metalness: 0.0,
        normalScale: new THREE.Vector2(0.95, 0.95),
        envMapIntensity: 0.42
      }), { grime: 0.10, streak: 0.18, base: 0.20, scale: 0.30 }),
      /* the pale limestone: Quixel Grey Stone Tile, its joints and all */
      stonePale: weather(new THREE.MeshStandardMaterial({
        map: photoTex('limestone', 'color', true, 1024) || tex(stoneB.map, { srgb: true }),
        normalMap: photoTex('limestone', 'normal') || tex(stoneB.normal),
        roughnessMap: photoTex('limestone', 'rough'),
        color: photoTex('limestone', 'color') ? 0xfdfaf3 : 0xffffff,
        roughness: photoTex('limestone', 'rough') ? 1.0 : 0.9, metalness: 0.0,
        normalScale: new THREE.Vector2(0.85, 0.85),
        envMapIntensity: 0.5
      }), { grime: 0.07, streak: 0.12, base: 0.15, scale: 0.34 }),
      concrete: weather(new THREE.MeshStandardMaterial({
        map: photoTex('conc', 'color', true, 1024) || tex(conc.map, { srgb: true }),
        normalMap: photoTex('conc', 'normal') || tex(conc.normal),
        roughnessMap: photoTex('conc', 'rough'),
        roughness: photoTex('conc', 'rough') ? 1.0 : 0.86, metalness: 0.0,
        normalScale: new THREE.Vector2(1.0, 1.0),
        envMapIntensity: 0.8
      }), { grime: 0.2, streak: 0.3, base: 0.3, scale: 0.5 }),
      oakFloor: new THREE.MeshStandardMaterial({
        map: tex(oak.map, { srgb: true }),
        normalMap: oak.normal ? tex(oak.normal) : null,
        roughnessMap: oak.rough ? tex(oak.rough) : null,
        roughness: oak.rough ? 1.0 : 0.5, metalness: 0.0,
        normalScale: new THREE.Vector2(oak.normal ? 0.7 : 0.35, oak.normal ? 0.7 : 0.35),
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
      /* inside and under the slabs: scanned plaster, never a flat fill */
      plaster: new THREE.MeshStandardMaterial({
        map: photoTex('plaster', 'color', true, 1024),
        normalMap: photoTex('plaster', 'normal'),
        roughnessMap: photoTex('plaster', 'rough'),
        color: photoTex('plaster', 'color') ? 0xf6f0e5 : 0xf1eade,
        roughness: photoTex('plaster', 'rough') ? 1.0 : 0.96,
        metalness: 0.0, envMapIntensity: 0.2
      }),
      /* the roof frieze and every rendered soffit: Quixel stucco */
      stucco: new THREE.MeshStandardMaterial({
        map: photoTex('stucco', 'color', true, 1024),
        normalMap: photoTex('stucco', 'normal'),
        roughnessMap: photoTex('stucco', 'rough'),
        color: photoTex('stucco', 'color') ? 0xf4efe4 : 0xefe9dd,
        roughness: photoTex('stucco', 'rough') ? 1.0 : 0.94,
        metalness: 0.0, envMapIntensity: 0.24
      }),
      /* west-red cedar: the soffit slats and the pergola rafters */
      cedar: new THREE.MeshStandardMaterial({
        map: photoTex('cedar', 'color', true, 1024),
        normalMap: photoTex('cedar', 'normal'),
        roughnessMap: photoTex('cedar', 'rough'),
        color: photoTex('cedar', 'color') ? 0xd7b48f : 0xb98a5e,
        roughness: photoTex('cedar', 'rough') ? 1.0 : 0.62,
        metalness: 0.0, envMapIntensity: 0.55
      }),
      cedarVert: new THREE.MeshStandardMaterial({
        map: photoTex('cedar', 'color', true, 1024),
        normalMap: photoTex('cedar', 'normal'),
        roughnessMap: photoTex('cedar', 'rough'),
        color: photoTex('cedar', 'color') ? 0xd7b48f : 0xb98a5e,
        roughness: photoTex('cedar', 'rough') ? 1.0 : 0.62,
        metalness: 0.0, envMapIntensity: 0.55
      }),
      glass: (() => {
        const m = new THREE.MeshPhysicalMaterial({
          color: 0xb3c8c6, metalness: 0.0, roughness: 0.02,
          transparent: true, opacity: 0.34, ior: 1.52,
          clearcoat: 1.0, clearcoatRoughness: 0.014,
          envMapIntensity: 2.9, side: THREE.DoubleSide, depthWrite: false,
          specularIntensity: 1.0
        });
        // real glass is clear face-on and a mirror at grazing angles: drive the
        // alpha and a little extra sky bounce from the Fresnel term
        m.onBeforeCompile = (sh) => {
          sh.fragmentShader = sh.fragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
             float ndv = clamp(abs(dot(normalize(geometryNormal), normalize(vViewPosition))), 0.0, 1.0);
             float fres = pow(1.0 - ndv, 2.6);
             /* a real sheet is clear face-on and a mirror at the grazing angle,
                so the pane keeps the room readable and still holds the sky */
             gl_FragColor.a = clamp(mix(0.12, 0.88, fres), 0.0, 1.0);
             gl_FragColor.rgb += vec3(0.40, 0.49, 0.53) * fres * 1.25;
             gl_FragColor.rgb += vec3(0.30, 0.34, 0.30) * pow(fres, 3.0) * 0.5;`
          );
        };
        m.customProgramCacheKey = () => 'glassfresnel';
        return m;
      })(),
      gravel: new THREE.MeshStandardMaterial({
        map: tex(grav.map, { srgb: true }),
        normalMap: tex(grav.normal),
        color: 0xd8cdb8,
        roughness: 1.0, metalness: 0.0,
        normalScale: new THREE.Vector2(1.1, 1.1),
        envMapIntensity: 0.55
      }),
      /* weathered charcoal, not chalk: the scan is bright, the road is not */
      asphalt: new THREE.MeshStandardMaterial({
        map: tex(asph.map, { srgb: true }),
        normalMap: asph.normal ? tex(asph.normal) : null,
        roughnessMap: asph.rough ? tex(asph.rough) : null,
        color: 0xd2d2d0,
        roughness: asph.rough ? 1.0 : 0.97, metalness: 0.0,
        normalScale: new THREE.Vector2(1.8, 1.8),
        envMapIntensity: 0.20
      }),
      /*  The drive, the arrival court, the carport and the sidewalks: a cool
          grey concrete paver, deliberately not the villa's limestone. */
      pave: new THREE.MeshStandardMaterial({
        map: paveMap,
        normalMap: paveNormal,
        color: 0xffffff, roughness: 0.94, metalness: 0.0,
        normalScale: new THREE.Vector2(0.9, 0.9),
        envMapIntensity: 0.42
      }),
      /*  The rear terrace and the pool deck: the same paver, warmer and a touch
          lighter, so the water side reads as a deck rather than as the wall
          carried on to the floor. */
      deck: new THREE.MeshStandardMaterial({
        map: paveMap,
        normalMap: paveNormal,
        color: 0xe6ded0, roughness: 0.92, metalness: 0.0,
        normalScale: new THREE.Vector2(0.8, 0.8),
        envMapIntensity: 0.5
      }),
      /* worn thermoplastic, not fresh paint: the lane lines were the brightest
         thing in the frame after the sky */
      line: new THREE.MeshStandardMaterial({ color: 0xa89f8d, roughness: 0.92, metalness: 0.0, envMapIntensity: 0.34 }),
      glassDark: new THREE.MeshStandardMaterial({
        color: 0x2e3c42, metalness: 0.42, roughness: 0.13, envMapIntensity: 1.45
      }),
      facadeWarm: new THREE.MeshStandardMaterial({
        map: tex(facWarm.map, { srgb: true }),
        emissiveMap: tex(facWarm.em, { srgb: true }),
        emissive: new THREE.Color(0xffc488), emissiveIntensity: 0.45,
        roughness: 0.87, metalness: 0.0, envMapIntensity: 0.45
      }),
      facadeWhite: new THREE.MeshStandardMaterial({
        map: tex(facWhite.map, { srgb: true }),
        emissiveMap: tex(facWhite.em, { srgb: true }),
        emissive: new THREE.Color(0xffc488), emissiveIntensity: 0.45,
        roughness: 0.86, metalness: 0.0, envMapIntensity: 0.5
      }),
      facadeSand: new THREE.MeshStandardMaterial({
        map: tex(facSand.map, { srgb: true }),
        emissiveMap: tex(facSand.em, { srgb: true }),
        emissive: new THREE.Color(0xffc488), emissiveIntensity: 0.45,
        roughness: 0.9, metalness: 0.0, envMapIntensity: 0.42
      }),
      facadeCool: new THREE.MeshStandardMaterial({
        map: tex(facCool.map, { srgb: true }),
        emissiveMap: tex(facCool.em, { srgb: true }),
        emissive: new THREE.Color(0xffc488), emissiveIntensity: 0.4,
        roughness: 0.8, metalness: 0.05, envMapIntensity: 0.6
      }),
      lampLit: new THREE.MeshStandardMaterial({
        color: 0x2a2620, emissive: new THREE.Color(0xffd8a2), emissiveIntensity: 3.4, roughness: 0.5
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
        color: 0xa2a79f,
        roughness: 1.0, metalness: 0.0, envMapIntensity: 0.35,
        side: THREE.DoubleSide
      }),
      oliveTwig: new THREE.MeshStandardMaterial({
        map: tex(bark.map, { srgb: true, repeat: [1, 2] }),
        color: 0x6f6a5c,
        roughness: 1.0, metalness: 0.0, envMapIntensity: 0.25,
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
        map: photoTex('pooltile', 'color', true, 1024) || tex(poolTile.map, { srgb: true }),
        normalMap: photoTex('pooltile', 'normal') || tex(poolTile.normal),
        roughnessMap: photoTex('pooltile', 'rough'),
        normalScale: new THREE.Vector2(0.9, 0.9),
        color: photoTex('pooltile', 'color') ? 0xffffff : 0xfaf6ec,
        roughness: photoTex('pooltile', 'rough') ? 1.0 : 0.62, metalness: 0.0, envMapIntensity: 0.5
      })),
      leaf: (() => {
        const leafTex = makeLeafCluster();
        const mat = windify(new THREE.MeshStandardMaterial({
          map: tex(leafTex.map, { srgb: true }),
          alphaMap: tex(leafTex.alpha),
          alphaTest: 0.30, side: THREE.DoubleSide, color: 0xe6e4cf,
          roughness: 0.94, metalness: 0.0, envMapIntensity: 0.42
        }), { amp: 0.075, freq: 1.2, height: 3.2, soft: 0.72,
          fill: [0.17, 0.19, 0.13], trans: 0.9 });
        /* which of the four sprays this card wears: a per-instance UV cell,
           so one draw call still gives the crown four different cards */
        const wind = mat.onBeforeCompile;
        mat.onBeforeCompile = (sh, r) => {
          wind(sh, r);
          sh.vertexShader = 'attribute float aCell;\n' + sh.vertexShader.replace(
            '#include <uv_vertex>',
            `#include <uv_vertex>
            {
              float leafRow = floor(aCell * 0.5 + 0.001);
              vec2 leafCell = vec2(mod(aCell, 2.0) * 0.5, (1.0 - leafRow) * 0.5);
              #ifdef USE_MAP
                vMapUv = vMapUv * 0.5 + leafCell;
              #endif
              #ifdef USE_ALPHAMAP
                vAlphaMapUv = vAlphaMapUv * 0.5 + leafCell;
              #endif
            }`);
        };
        const cacheKey = mat.customProgramCacheKey;
        mat.customProgramCacheKey = () => cacheKey() + '_leafcell';
        return mat;
      })(),
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
        map: palmFrondTex, alphaTest: 0.26,
        color: 0xaebd7e, vertexColors: true, roughness: 0.88, metalness: 0.0,
        side: THREE.DoubleSide, envMapIntensity: 0.35
      }), { amp: 0.075, freq: 0.85, height: 3.8, base: 0.5, soft: 0.38 }),
      palmDry: windify(new THREE.MeshStandardMaterial({
        map: palmFrondTex, alphaTest: 0.26,
        color: 0xbb9a63, vertexColors: true, roughness: 0.96, metalness: 0.0,
        side: THREE.DoubleSide, envMapIntensity: 0.32
      }), { amp: 0.05, freq: 1.15, height: 3.8, base: 0.5, soft: 0.34 }),
      dates: new THREE.MeshStandardMaterial({ color: 0xb06b2c, roughness: 0.58, metalness: 0.0, envMapIntensity: 0.7 }),
      /*  One green-to-husk-brown material for every coconut in the scene; the
          per-fruit variation rides on vertex colour, so the whole bunch is one
          merged mesh and one draw call. */
      coconut: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0.0, envMapIntensity: 0.5 }),
      ao: new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity: 0.5, depthWrite: false }),
      aoSoft: new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity: 0.26, depthWrite: false }),
      aoBand: new THREE.MeshBasicMaterial({
        map: aoBandTex, transparent: true, opacity: 0.5, depthWrite: false,
        side: THREE.DoubleSide
      })
    };

    /* ── phase two: the rest of the scans, once the first frame is up ──────
       On a lean device the scene is drawn from six colour scans. This runs from
       idle after that frame: it fetches the normals and the surfaces that were
       skipped, then swaps them into the materials that are already on screen —
       a map assignment per material, no rebuild. A texture that never arrives
       leaves the material exactly as it was drawn.                          */
    let photoPhase2 = false;
    function schedulePhotoUpgrade() {
      if (photoPhase2 || !LEAN || !photoBase) return;
      /*  A 4 GB phone stops at the first wave. Swapping a material's map after
          the first frame costs a fresh shader program and a texture upload, and
          on a weak GPU that lands as a second of frozen scroll. The procedural
          maps it already has are the whole look at 390 px. */
      if (MOBILE && LOWRAM) return;
      photoPhase2 = true;
      const go = () => {
        if (destroyed) return;
        loadPhotos(photoBase, true, null, ['color', 'normal']).then(() => {
          if (destroyed) return;
          const put = (mat, key, opts = {}) => {
            const set = PHOTO[key];
            if (!mat || !set || !set.color) return;
            const size = 256;
            try {
              if (mat.map && mat.map.isTexture) mat.map.dispose();
              mat.map = tex(photoCanvas(set.color, size), { srgb: true });
              if (set.normal) {
                if (mat.normalMap && mat.normalMap.isTexture) mat.normalMap.dispose();
                mat.normalMap = tex(photoCanvas(set.normal, size));
                mat.normalScale = new THREE.Vector2(opts.ns || 0.85, opts.ns || 0.85);
              }
            } catch (_) { return; }
            mat.needsUpdate = true;
          };
          /* the floor is baked, so its own builder runs again over the scans */
          try {
            if (PHOTO.oak && PHOTO.oak.color) {
              const o = makeOakFloor();
              if (M.oakFloor.map) M.oakFloor.map.dispose();
              M.oakFloor.map = tex(o.map, { srgb: true });
              if (o.normal) {
                if (M.oakFloor.normalMap) M.oakFloor.normalMap.dispose();
                M.oakFloor.normalMap = tex(photoCanvas(PHOTO.oak.normal, 256));
                M.oakFloor.normalScale = new THREE.Vector2(0.7, 0.7);
              }
              M.oakFloor.needsUpdate = true;
            }
          } catch (_) {}
          put(M.plaster, 'plaster');
          put(M.stucco, 'stucco');
          put(M.cedar, 'cedar');
          put(M.cedarVert, 'cedar');
          put(M.concrete, 'conc', { ns: 0.8 });
          put(M.stone, 'limestone');
          put(M.poolWall, 'pooltile', { ns: 0.9 });
          photoPhase2 = 'done';
        }).catch(() => { photoPhase2 = false; });
      };
      /* idle, and after the first frame has actually painted */
      const kick = () => {
        /*  Never while the thumb is moving: the swap recompiles programs, and a
            compile in the middle of a flick is what a phone renders as "stuck". */
        const whenStill = () => {
          if (destroyed) return;
          if (performance.now() - lastScrollAt < 1600) { setTimeout(whenStill, 400); return; }
          if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 4000 });
          else setTimeout(go, 1600);
        };
        whenStill();
      };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(kick));
      else kick();
    }

    /* ── the land shader ────────────────────────────────────────────────────
       One surface carries the whole country: lawn on the estate pad, dune sand
       where the ground rises and the grass gives out, and a contact darkening
       that hugs both faces of the boundary wall. No extra draw call — the sand
       is sampled by world position, so the change of surface follows the land
       and not a UV seam.                                                    */
    {
      const sandMap = tex(sand.map, { srgb: true });
      const sandNrm = tex(sand.normal);
      const meadowMat = M.meadow;
      meadowMat.onBeforeCompile = (sh) => {
        sh.uniforms.uSand = { value: sandMap };
        sh.uniforms.uSandN = { value: sandNrm };
        sh.uniforms.uEstateC = { value: new THREE.Vector2((ESTATE.x0 + ESTATE.x1) / 2, (ESTATE.z0 + ESTATE.z1) / 2) };
        sh.uniforms.uEstateH = { value: new THREE.Vector2((ESTATE.x1 - ESTATE.x0) / 2, (ESTATE.z1 - ESTATE.z0) / 2) };
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vLand;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLand = (modelMatrix * vec4(position, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vLand;\nuniform sampler2D uSand;\nuniform sampler2D uSandN;\nuniform vec2 uEstateC;\nuniform vec2 uEstateH;')
          .replace('#include <map_fragment>', `#include <map_fragment>
            /* the wall's signed distance, reused twice: the sand outside it
               and the shadow the wall lays on the ground */
            vec2 eD = abs(vLand.xz - uEstateC) - uEstateH;
            float sdR = length(max(eD, vec2(0.0))) + min(max(eD.x, eD.y), 0.0);

            float dunes = smoothstep(0.18, 2.1, vLand.y + 0.06);
            /* beyond the garden the ground turns to sand: a desert city is
               irrigated in patches, not carpeted green */
            dunes = max(dunes, smoothstep(2.5, 26.0, sdR) * 0.60);
            float mottle = texture2D(uSand, vMapUv * 0.55).g;
            dunes *= 0.55 + 0.7 * smoothstep(0.30, 0.70, mottle);
            vec3 sandCol = texture2D(uSand, vMapUv * 2.15).rgb;
            diffuseColor.rgb = mix(diffuseColor.rgb, sandCol * vec3(1.01, 0.99, 0.96), clamp(dunes, 0.0, 1.0) * 0.82);
            /* ground AO: darken both faces of the wall, and only there */
            float band = 1.0 - smoothstep(0.0, 1.9, abs(sdR));
            diffuseColor.rgb *= 1.0 - 0.42 * band * band;`);
      };
      meadowMat.customProgramCacheKey = () => 'meadowland';
    }

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

    /* ── Megascans props — placements registered while the scene is built ──
       A scanned prop never replaces anything by surgery on the merged
       batches: the procedural piece it stands in for is built into its own
       group, so the swap is one visibility flip when the GLB arrives. If the
       model never arrives — offline, a strict network, a phone out of
       memory — the drawing is exactly what it always was.                  */
    const megaFallback = new THREE.Group();
    megaFallback.name = 'megascans-fallbacks';
    world.add(megaFallback);
    const megaSpots = [];
    const megaFallbacks = new Map();

    function megaSpot(key, x, y, z, opts = {}) {
      const sp = {
        key, x, y, z,
        yaw: opts.yaw == null ? rr(0, 6.283) : opts.yaw,
        s: opts.s, h: opts.h, sy: opts.sy, mobile: opts.mobile !== false
      };
      megaSpots.push(sp);
      return sp;
    }

    /** A turned vessel whose scan replaces it at the same footprint. */
    function megaVessel(key, profile, x, y, z, mat, segs = 24, opts = {}) {
      const pts = profile.map(([r, h]) => new THREE.Vector2(Math.max(0.001, r), h));
      const geo = new THREE.LatheGeometry(pts, segs);
      geo.computeVertexNormals();
      geo.translate(x, y, z);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = opts.cast !== false;
      mesh.receiveShadow = opts.receive !== false;
      megaFallback.add(mesh);
      if (!megaFallbacks.has(key)) megaFallbacks.set(key, []);
      megaFallbacks.get(key).push(mesh);
      const target = Math.max(...profile.map((q) => q[1]));
      megaSpot(key, x, y, z, { yaw: opts.yaw, h: target * (opts.hScale || 1) });
      return mesh;
    }

    /** A baked contact shadow, so a lounger or a stair tread sits on the ground. */
    function contactShadow(x, z, w, d, soft = false, y = 0.028, rot = 0) {
      const geo = new THREE.PlaneGeometry(w, d);
      geo.rotateX(-Math.PI / 2);
      if (rot) geo.rotateY(rot);
      geo.translate(x, y, z);
      queue(geo, soft ? M.aoSoft : M.ao, false, false, 2);
    }

    /** The same idea along a run: dark where a wall meets the ground, gone
        1.7 m out. `side` is which way the ground is, from the wall line. */
    function contactBand(axis, at, from, to, side, width = 1.7, y = 0.022, mat = M.aoBand) {
      const a = Math.min(from, to), b = Math.max(from, to);
      const n0 = at, n1 = at + width * side;
      const pos = axis === 'x'
        ? [a, y, n0, b, y, n0, b, y, n1, a, y, n1]
        : [n0, y, a, n0, y, b, n1, y, b, n1, y, a];
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      geo.setIndex([0, 2, 1, 0, 3, 2]);
      geo.computeVertexNormals();
      queue(geo, mat, false, false, 2);
    }

    /* ─────────────────────────────────────────────────────────────────────
       5 · landscape
       ───────────────────────────────────────────────────────────────────── */
    const CZ = -1.4;

    /* ── the estate line ────────────────────────────────────────────────────
       One rectangle holds the villa, its lawn, the pool terrace and the four
       palms, with a single gate where the drive crosses it. The wall, its
       planters, the grass it keeps off, and the level pad the whole land is
       shaped around are all derived from these numbers.
       ───────────────────────────────────────────────────────────────────── */
    const ESTATE = {
      x0: -27.5, x1: 31.0,        // west / east wall centre-lines
      z0: -34.5, z1: 25.0,        // rear / front
      t: 0.36,                    // panel thickness
      h: 2.00,                    // front + side walls, to the top of the coping
      hr: 1.35,                   // the rear rail, low enough for the skyline
      gate: { a: -0.9, b: 10.1 }  // the clear entrance, centred on the drive
    };

    /* ── the city grid ──────────────────────────────────────────────────────
       The villa stands in the middle of a Dubai neighbourhood, not out on a
       dune: four avenues wrap the plot, a cross grid runs out to the mid-rise
       ring, and the diagonal approach becomes a boulevard through it. One
       table describes every street, so the asphalt, the kerbs, the sidewalks,
       the lamps, the palms and the "no grass here" test all read from the
       same numbers — and every one of them sits clear of the 58.5 × 59.5 m
       estate pad.
       ───────────────────────────────────────────────────────────────────── */
    const STREETS = [
      { axis: 'x', at: 40.0, from: -170, to: 174, half: 4.2, walk: 2.4, main: true },   // front avenue
      { axis: 'x', at: -50.0, from: -170, to: 174, half: 4.2, walk: 2.4, main: true },  // rear avenue
      { axis: 'z', at: -42.0, from: -178, to: 178, half: 4.2, walk: 2.4, main: true },  // west avenue
      { axis: 'z', at: 46.0, from: -178, to: 178, half: 4.2, walk: 2.4, main: true },   // east avenue
      { axis: 'x', at: 106.0, from: -170, to: 174, half: 3.6, walk: 2.0 },              // cross street S
      { axis: 'x', at: -118.0, from: -170, to: 174, half: 3.6, walk: 2.0 },             // cross street N
      { axis: 'z', at: -114.0, from: -178, to: 178, half: 3.6, walk: 2.0 },             // cross street W
      { axis: 'z', at: 118.0, from: -178, to: 178, half: 3.6, walk: 2.0 }               // cross street E
    ];
    /** The paved grid's extent — everything inside is flat city, not desert. */
    const TOWN = { x0: -170, x1: 174, z0: -178, z1: 178 };
    /** The house's own centre, the anchor for every "is it too close" test. */
    const HOME = { x: 0.5, z: -1.0 };
    /** On a street surface (asphalt, kerb or sidewalk), plus a margin. */
    const onStreet = (x, z, pad = 0) => {
      for (const s of STREETS) {
        const along = s.axis === 'x' ? x : z;
        const across = s.axis === 'x' ? z : x;
        if (along < s.from - pad || along > s.to + pad) continue;
        if (Math.abs(across - s.at) < s.half + s.walk + pad) return true;
      }
      return false;
    };

    /** Inside the strip the wall stands on: keeps grass off its footprint. */
    const estateBand = (x, z, pad = 0.52) => {
      if (x < ESTATE.x0 - pad || x > ESTATE.x1 + pad || z < ESTATE.z0 - pad || z > ESTATE.z1 + pad) return false;
      const edge = Math.min(Math.abs(x - ESTATE.x0), Math.abs(x - ESTATE.x1),
                            Math.abs(z - ESTATE.z0), Math.abs(z - ESTATE.z1));
      return edge < pad;
    };

    const POOLG = { x0: -3.2, x1: 8.4, z0: -19.6, z1: -9.8 };

    await nextTick();

    /* ── the land ───────────────────────────────────────────────────────────
       The estate stands on a level pad; everything outside the wall is a
       coastal dune field. Long ridges run roughly east–west the way wind-built
       dunes do along a shore, their crests narrow and their troughs broad, and
       between them the ground settles to a walkable plain. The field lifts
       gently toward the horizon so the far country is a silhouette rather than
       the rim of a disc, and the approach keeps a level corridor cut through
       it — a road bed, and the one line the eye follows in.
       ───────────────────────────────────────────────────────────────────── */
    /** The approach as one polyline: the gravel drive, then the lane beyond. */
    const APPROACH = [
      [0.0, 8.8], [0.3, 10.4], [1.0, 12.6], [2.2, 16.5], [4.0, 23], [6.4, 31],
      [9.2, 41], [12.0, 52], [14.5, 64], [17.0, 78], [19.5, 92], [22.5, 108],
      [26.0, 128], [30.0, 150], [33.0, 170], [38.0, 188], [44.0, 210],
      [52.0, 238], [62.0, 272], [74.0, 312], [88.0, 358], [104.0, 410],
      [122.0, 468], [142.0, 532], [164.0, 600], [192.0, 690]
    ];
    /** Its centre-line x at a given z; the run is monotonic in z. */
    const driveCX = (z) => {
      const n = APPROACH.length;
      if (z <= APPROACH[0][1]) return APPROACH[0][0];
      for (let i = 1; i < n; i++) {
        if (z <= APPROACH[i][1]) {
          const [xa, za] = APPROACH[i - 1], [xb, zb] = APPROACH[i];
          return lerp(xa, xb, (z - za) / (zb - za));
        }
      }
      return APPROACH[n - 1][0];
    };

    /** Wind-built dunes: low, long, asymmetric — not a sea of sine waves. */
    const duneNoise = (x, z) => {
      const a = Math.sin(x * 0.0206 + z * 0.0052 + 0.44) * Math.cos(z * 0.0174 - x * 0.0039);
      const b = Math.sin(x * 0.0412 - z * 0.0331 + 1.94);
      const c = Math.sin(x * 0.0866 + z * 0.0724 + 0.51);
      const d = Math.sin(x * 0.194 - z * 0.171 + 2.37);
      const n = 0.56 * a + 0.29 * b + 0.11 * c + 0.035 * d;
      return Math.sign(n) * Math.pow(Math.abs(n), 0.82);
    };

    /** Ground height above the estate pad. Zero across the whole city, and on
        and around the estate; the dunes only begin out past the last ring of
        the neighbourhood, the way Dubai's own sand sits behind its streets. */
    const terrainH = (x, z) => {
      const dx = Math.max(ESTATE.x0 - x, 0, x - ESTATE.x1);
      const dz = Math.max(ESTATE.z0 - z, 0, z - ESTATE.z1);
      const d = Math.hypot(dx, dz);
      const r = Math.hypot(x - 3, z + 6);
      // how far outside the paved grid we are: the city is a level plain, so
      // the land is dead flat to the last street and only then rolls away
      const tdx = Math.max(TOWN.x0 - x, 0, x - TOWN.x1);
      const tdz = Math.max(TOWN.z0 - z, 0, z - TOWN.z1);
      const outTown = Math.hypot(tdx, tdz);
      const open = smoothstep(70, 420, outTown);
      // taller as it goes away from the house, settling again far out
      const amp = (1.25 + 4.8 * smoothstep(320, 900, r)) * (1 - 0.45 * smoothstep(1400, 2800, r));
      let h = duneNoise(x, z) * amp * open;
      // a broader swell under the dunes lifts the far country into a low ridge,
      // so the horizon is a line rather than the rim of a disc
      h += (0.5 + 0.5 * Math.sin(x * 0.0086 + 1.2) * 0.6 + 0.5 * Math.sin(x * 0.0142 - z * 0.0041))
           * 4.0 * smoothstep(900, 1500, r) * (1 - 0.35 * smoothstep(2000, 3200, r));
      // fine wind ripple on the sand
      h += Math.sin(x * 0.69 + z * 0.51) * 0.05 * open;
      // the approach keeps a level bed through whatever it crosses
      const ahead = smoothstep(ESTATE.z1 + 2, ESTATE.z1 + 15, z);
      h *= 1 - 0.93 * ahead * (1 - smoothstep(4.5, 16, Math.abs(x - driveCX(z))));
      // and the plain lifts a little toward the horizon
      h += smoothstep(900, 2600, r) * 2.6;
      return h;
    };

    const bend = (x, z) => terrainH(x, z) - 0.06;

    /* Four quads round the pool cut-out — so the water is a real basin in the
       ground, not a plane painted on it — each cut from the same two graded
       axes. Shared edges therefore carry exactly the same vertices, and no
       seam can open between them. 4 m near the house, 120 m at the horizon. */
    const EXT = 2400;
    function gradedAxis(dense0, dense1, step, growth, maxStep) {
      const put3 = (v) => Math.round(v * 1000) / 1000;
      const mid = [];
      for (let v = dense0; v < dense1 - 1e-6; v += step) mid.push(put3(v));
      mid.push(put3(dense1));
      const right = [];
      let s = step * 2, v = dense1;
      while (v < EXT - 1e-6) { v = Math.min(EXT, v + s); right.push(put3(v)); s = Math.min(maxStep, s * growth); }
      const left = [];
      s = step * 2; v = dense0;
      while (v > -EXT + 1e-6) { v = Math.max(-EXT, v - s); left.push(put3(v)); s = Math.min(maxStep, s * growth); }
      return left.reverse().concat(mid, right);
    }
    const withCuts = (arr, cuts) => {
      const out = arr.slice();
      for (const c of cuts) {
        if (!out.some((v) => Math.abs(v - c) < 1e-4)) out.push(c);
      }
      return out.sort((a, b) => a - b);
    };
    const XS = withCuts(gradedAxis(-42, 42, 4, 1.18, 120), [POOLG.x0, POOLG.x1]);
    const ZS = withCuts(gradedAxis(-42, 42, 4, 1.18, 120), [POOLG.z0, POOLG.z1]);
    const span = (arr, lo, hi) => arr.filter((v) => v >= lo - 1e-6 && v <= hi + 1e-6);

    function buildGround(xs, zs) {
      const nx = xs.length, nz = zs.length;
      const pos = new Float32Array(nx * nz * 3);
      const uvs = new Float32Array(nx * nz * 2);
      const idx = [];
      for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
          const k = j * nx + i, x = xs[i], z = zs[j];
          pos[k * 3] = x; pos[k * 3 + 1] = bend(x, z); pos[k * 3 + 2] = z;
          uvs[k * 2] = x / 9; uvs[k * 2 + 1] = z / 9;
        }
      }
      for (let j = 0; j < nz - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const a = j * nx + i, bb = a + 1, cc = a + nx, dd = cc + 1;
          idx.push(a, cc, bb, bb, cc, dd);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      queue(geo, M.meadow, false, true);
    }
    buildGround(XS, span(ZS, POOLG.z1, EXT));
    buildGround(XS, span(ZS, -EXT, POOLG.z0));
    buildGround(span(XS, -EXT, POOLG.x0), span(ZS, POOLG.z0, POOLG.z1));
    buildGround(span(XS, POOLG.x1, EXT), span(ZS, POOLG.z0, POOLG.z1));

    /* ── the way in: gravel outside the gate, laid stone from the gate to the
       door ────────────────────────────────────────────────────────────────
       The approach spline carries the camera the whole way in, so it also
       carries the surface: past the wall the boulevard's tarmac takes over,
       and the moment the drive crosses the estate line it becomes a laid
       limestone walk. One material, one ribbon, joints from the scan, and a
       pale border each side so the walk reads as architecture rather than a
       painted lane. No tarmac, no lane paint, no loose stone inside the wall. */
    const drivePts = [
      [30, 150], [26, 128], [22.5, 108], [19.5, 92], [17, 78], [14.5, 64],
      [12, 52], [9.2, 41], [6.4, 31], [4.0, 23], [2.2, 16.5], [1.0, 12.6], [0.3, 10.4], [0, 8.8]
    ].map(([x, z]) => new THREE.Vector3(x, 0, z));
    const drive = new THREE.CatmullRomCurve3(drivePts, false, 'centripetal', 0.5);

    /* where the drive crosses the wall: the surface changes here */
    let tWALL = 1;
    for (let i = 0; i <= 600; i++) {
      const t = i / 600;
      if (drive.getPoint(t).z <= ESTATE.z1) { tWALL = t; break; }
    }
    {
      const N = 240;
      const band = (t0, t1, wOf, lift, mat, uvS) => {
        const pos = [], uv = [], idx = [];
        for (let i = 0; i <= N; i++) {
          const t = lerp(t0, t1, i / N);
          const p = drive.getPoint(t), tan = drive.getTangent(t);
          const nx = -tan.z, nz = tan.x, l = Math.hypot(nx, nz) || 1;
          const w = wOf(t);
          for (const s of [-1, 1]) {
            const px = p.x + (nx / l) * w * s, pz = p.z + (nz / l) * w * s;
            pos.push(px, lift, pz);
            uv.push(px * uvS, pz * uvS);
          }
          if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        world.add(mesh);
        return mesh;
      };
      /* outside the wall: the gravel verge the boulevard's tarmac sits in */
      band(0.001, tWALL, (t) => lerp(1.65, 1.44, t), 0.035, M.gravel, 0.42);
      /* inside the wall: the walk. Three metres of limestone, world-scaled so
         the pavers are a constant 2 m format from the gate to the door. */
      band(tWALL, 1, (t) => lerp(1.58, 1.46, (t - tWALL) / (1 - tWALL)), 0.044, M.pave, 0.5);
      /* a pale border each side, 40 mm proud, so the walk has an edge */
      const edge = (side) => {
        const pos = [], uv = [], idx = [];
        for (let i = 0; i <= N; i++) {
          const t = lerp(tWALL, 1, i / N);
          const p = drive.getPoint(t), tan = drive.getTangent(t);
          const nx = -tan.z, nz = tan.x, l = Math.hypot(nx, nz) || 1;
          const w = lerp(1.58, 1.46, i / N);
          for (const q of [0, 1]) {
            const o = (w + 0.02 + q * 0.16) * side;
            pos.push(p.x + (nx / l) * o, 0.048 + q * 0.026, p.z + (nz / l) * o);
            uv.push(q, i * 0.5);
          }
          if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        queue(geo, M.stonePale, false, true, 1);
      };
      edge(1); edge(-1);
    }

    // loose pebbles on the outer verge only: the walk inside the wall stays clear
    {
      const geo = new THREE.IcosahedronGeometry(1, 0);
      const count = LOWRAM ? 46 : (MOBILE ? 90 : 170);
      const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x9d9483, roughness: 0.92, metalness: 0, envMapIntensity: 0.35 });
      const inst = new THREE.InstancedMesh(geo, pebbleMat, count);
      inst.receiveShadow = true;
      const d = new THREE.Object3D();
      for (let i = 0; i < count; i++) {
        const t = Math.pow(rnd(), 0.8) * (tWALL - 0.01);
        const p = drive.getPoint(t);
        const tan = drive.getTangent(t);
        const nrm = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        const side = rnd() > 0.5 ? 1 : -1;
        // the verge only: outside the boulevard's asphalt and its walk, so no
        // stone ever lies on the driving surface
        const off = (3.95 + lerp(0.05, 1.35, Math.pow(rnd(), 0.8))) * side;
        d.position.set(p.x + nrm.x * off, 0.02, p.z + nrm.z * off);
        const s = rr(0.045, 0.11);
        d.scale.set(s * rr(1, 2.0), s * rr(0.45, 0.8), s * rr(1, 2.0));
        d.rotation.set(rr(0, 3), rr(0, 3), rr(0, 3));
        d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      world.add(inst);
    }

    /* ── the road out there ─────────────────────────────────────────────────
       The gravel drive belongs to the estate; beyond the gate the approach
       carries on as a narrow tarmac lane between the dunes, curving out of
       sight. It is what tells the eye the estate is somewhere rather than
       nowhere: a line of travel, a pair of pale shoulders, a dry verge.  */
    {
      /* one ribbon builder, used for the lane and its two shoulders.
         `uvScale` switches the run to world-space UVs (metres × scale), which
         is what a scanned surface needs: the old 0..1 across / t·vScale along
         mapping stretched any bitmap into stripes. */
      const ribbon = (curve, mats, w, lift, vScale, segs = 150, uvScale = 0) => {
        const pos = [], uv = [], idx = [];
        const lens = curve.getLength ? curve.getLength() : 0;
        for (let i = 0; i <= segs; i++) {
          const t = i / segs, p = curve.getPoint(t), tan = curve.getTangent(t);
          const nx = -tan.z, nz = tan.x;
          const l = Math.hypot(nx, nz) || 1;
          const y = terrainH(p.x, p.z) + lift;
          for (const s of [-1, 1]) {
            pos.push(p.x + (nx / l) * w * s, y, p.z + (nz / l) * w * s);
            if (uvScale) uv.push((s * w + w) * uvScale, t * lens * uvScale);
            else uv.push(s * 0.5 + 0.5, t * vScale);
          }
          if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx);
        geo.computeVertexNormals();
        queue(geo, mats, false, true, 1);
      };

      const roadPts = APPROACH.slice(13).map(([x, z]) => new THREE.Vector3(x, 0, z));
      const road = new THREE.CatmullRomCurve3(roadPts, false, 'centripetal', 0.5);
      const asphalt = M.asphalt;
      // a gravel shoulder first, so the tarmac has an edge to sit in
      ribbon(road, M.gravel, 2.35, 0.03, 120, 150, 0.42);
      ribbon(road, asphalt, 1.72, 0.055, 120, 150, 0.40);

      /* the walk carries its own pale edge borders (laid above), so the old
         raised kerb ribbons that used to run down the middle of it are gone:
         they read as painted lane lines on the stone. */
    }

    /* The horizon is the meadow itself. Its own bend, plus the fog, gives the
       far country its shape; separate hill geometry only ever drew a bright
       rim above it or poked through it as a brown patch.                    */

    /* ── the estate line ────────────────────────────────────────────────────
       ESTATE and estateBand are declared up in section 5, so the ground could
       be graded around the pad before it was built; the wall, its planters and
       the grass it keeps off all read from the same numbers.
       ───────────────────────────────────────────────────────────────────── */

    // terrace + pool
    const POOL = { x0: -3.2, x1: 8.4, z0: -19.6, z1: -9.8, w: -0.34 };

    /*  The rear terrace and the pool deck are laid in the same grey paver as the
        drive, warmed a little: the deck is floor, not wall, and the villa's pale
        stone has to separate from the ground it stands on at both ends. */
    addBox(22, 0.4, 4.0, 1.5, -0.2, -7.9, M.deck, { uv: 0.42 });
    addBox(21, 0.42, 0.3, 1.5, -0.2, -6.05, M.deck, { uv: 0.42 });
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
    addBox(POOL.x1 - POOL.x0 + pw * 2, 0.28, pw, (POOL.x0 + POOL.x1) / 2, -0.34, POOL.z1 + pw / 2, M.deck, { uv: 0.42 });
    addBox(POOL.x1 - POOL.x0 + pw * 2, 0.28, pw, (POOL.x0 + POOL.x1) / 2, -0.34, POOL.z0 - pw / 2, M.deck, { uv: 0.42 });
    addBox(pw, 0.28, POOL.z1 - POOL.z0, POOL.x0 - pw / 2, -0.34, (POOL.z0 + POOL.z1) / 2, M.deck, { uv: 0.42 });
    addBox(pw, 0.28, POOL.z1 - POOL.z0, POOL.x1 + pw / 2, -0.34, (POOL.z0 + POOL.z1) / 2, M.deck, { uv: 0.42 });

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
      uDeep: { value: new THREE.Color(0.010, 0.120, 0.130) },
      uShallow: { value: new THREE.Color(0.055, 0.270, 0.255) },
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
          /* a slow domain warp first, so the four wave trains below never line
             up into a tiled pattern as the eye pans across the pool (the
             texture-bombing trick shade-verse uses on its sea surface) */
          vec2 uv0 = vWorld.xz;
          vec2 uv = uv0 + vec2(sin(uv0.y * 0.21 + uTime * 0.05), cos(uv0.x * 0.19 - uTime * 0.04)) * 0.55;

          /* three wave trains at different scales and speeds: a long swell, a
             chop, and the fine cat's-paws that catch the light */
          vec3 a = texture2D(tNormal, uv * 0.085 + vec2(uTime * 0.014, uTime * 0.008)).rgb * 2.0 - 1.0;
          vec3 b = texture2D(tNormal, uv * 0.031 - vec2(uTime * 0.007, -uTime * 0.010)).rgb * 2.0 - 1.0;
          vec3 c = texture2D(tNormal, uv * 0.24 + vec2(-uTime * 0.030, uTime * 0.024)).rgb * 2.0 - 1.0;
          vec3 d2 = texture2D(tNormal, uv * 0.62 - vec2(uTime * 0.052, -uTime * 0.041)).rgb * 2.0 - 1.0;
          /* gust patches: a very low-frequency field roughens one stretch of
             water and leaves the next glassy, the way wind moves over a pool */
          float gust = 0.72 + 0.42 * sin(uv0.x * 0.045 + sin(uv0.y * 0.052) * 1.7 + uTime * 0.06);
          float amp = uRipples * gust;
          vec2 slope = (a.xy * 0.50 + b.xy * 0.66 + c.xy * 0.26 + d2.xy * 0.10) * amp;
          slope = clamp(slope, -1.4, 1.4);

          /* the normal is in world space, so the eye vector has to be too:
             mixing in the view-space one made dot(N, V) read as zero and the
             pool a flat sky mirror at every angle */
          vec3 V = normalize(cameraPosition - vWorld);
          float dist = length(vToEye);
          /* ripples flatten with distance, or the far end of the pool boils */
          float nearK = 1.0 - smoothstep(9.0, 34.0, dist) * 0.66;
          vec3 N = normalize(vec3(slope.x * 0.26, 1.0, slope.y * 0.26));
          N = normalize(mix(vec3(0.0, 1.0, 0.0), N, nearK * 0.85 + 0.15));

          /* exact unpolarised Fresnel for air into water (n = 1.333) instead of
             the Schlick approximation: the pool's grazing angles and the dark
             band just past them sit where real water puts them */
          float cosi = clamp(dot(N, V), 0.0, 1.0);
          float s2 = (1.0 / 1.333) * (1.0 / 1.333) * (1.0 - cosi * cosi);
          float fres = 1.0;
          if (s2 < 1.0) {
            float ct = sqrt(1.0 - s2);
            float rs = (cosi - 1.333 * ct) / (cosi + 1.333 * ct);
            float rp = (1.333 * cosi - ct) / (1.333 * cosi + ct);
            fres = 0.5 * (rs * rs + rp * rp);
          }

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
             body is palest along the coping, where the travertine floor shows
             warm through it, and deepens to turquoise where the sun has
             further to travel */
          vec2 door = min(vWorld.xz - uMin, uMax - vWorld.xz);
          float edgeD = min(door.x, door.y);
          float shallow = 1.0 - smoothstep(0.0, 0.55, edgeD);
          float sunFace = clamp(dot(N, uSunDir), 0.0, 1.0);

          /* a sunlit caustic shimmer in the body itself: two crossing wave
             sets, so the surface has life even where the floor is hidden by
             reflection */
          float shim = sin(uv0.x * 1.55 + uTime * 0.55 + sin(uv0.y * 1.20 - uTime * 0.40) * 1.6)
                     * sin(uv0.y * 1.42 - uTime * 0.47 + sin(uv0.x * 1.05 + uTime * 0.33) * 1.5);
          shim = pow(abs(shim), 1.4);

          vec3 body = mix(uDeep, uShallow, 0.16 + 0.42 * sunFace + shallow * 0.44);
          body += uShallow * shim * 0.62;
          body += vec3(0.015, 0.045, 0.043) * shim;

          refl *= vec3(0.86, 0.95, 1.00);
          /* sky is most of what a pool reflects; the mirror carries the house
             and the clouds at a much softer weight, so the far end never
             turns into a hard white sheet */
          vec3 skyRefl = mix(uSkyCol, uFogCol, 0.25);
          refl = mix(refl, skyRefl, 0.34);
          vec3 col = mix(body, refl, clamp(fres * 1.45, 0.0, 0.84));

          /* the waterline: a soft darkening where the surface meets the
             coping, and a hair of light right against it */
          float rim = smoothstep(0.14, 0.0, edgeD);
          col = mix(col, col * 0.86, rim * 0.28);

          /* sun glitter: a tight core with a wide, wind-stretched falloff */
          vec3 H = normalize(uSunDir + V);
          float spec = pow(max(dot(N, H), 0.0), 620.0);
          col += uSunCol * spec * 1.9;
          float sparkle = pow(max(dot(N, H), 0.0), 96.0) * pow(max(c.x, 0.0), 2.0);
          col += uSunCol * sparkle * (0.30 + 0.25 * uSunElev);

          float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
          col = mix(col, uFogCol, clamp(fog, 0.0, 1.0));

          /* the water surface sits on top of the floor as a real surface layer
             of colour: the basin reads blue-green straight down, the floor's
             caustics still ghost through, and the mirror takes over at the
             grazing angles. The body colour is absorption, not paint: it is
             strongest looking down through the deepest section and gives way
             to the mirror as the eye flattens. */
          float lookDown = smoothstep(0.0, 0.85, cosi);
          /* the body of the water is absorption, so it has to stay thin enough
             to show the pale travertine floor through it; the old 0.72 veil
             was paint over a mirror nobody could see */
          vec3 tinted = mix(col, uShallow * 0.80 + vec3(0.012, 0.055, 0.060), lookDown * 0.50);
          /* the surface colour is drawn at strength, not as a veil: what the
             pool loses in see-through depth it gains in reading as water at
             every angle the walkthrough looks at it from */
          float alpha = mix(0.42, 0.88, clamp(fres * 1.15, 0.0, 1.0));
          alpha = mix(alpha, 0.74, lookDown * 0.35);
          alpha *= mix(0.80, 1.0, smoothstep(0.0, 0.45, edgeD));
          gl_FragColor = vec4(min(tinted, vec3(0.90, 0.94, 0.96)), alpha);
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
       5c · the city beyond
       The house faces a city it does not show you until you are inside it.
       A kilometre out, across the dunes and the water, the skyline stands on
       the haze: tapered glass towers, chamfered slabs, a few stepped crowns
       and three needles. It is almost a rumour — aerial perspective does half
       the work — but the silhouettes are real architecture, not boxes: an
       eight-sided tower tapers as it rises, its curtain wall catches the sky
       as one long specular streak, and the low sun puts a warm rim on every
       edge that faces it. Five instanced draws for the whole city.
       ───────────────────────────────────────────────────────────────────── */
    {
      /* ── the curtain wall ────────────────────────────────────────────────
         Bays of dark glass, a sky reflection at the head of each, piers
         between them, floor lines, and a scatter of lamps still on.           */
      const CW = 128, CH = 256;
      const faceC = cv(CW, CH), fg = faceC.getContext('2d');
      const emC = cv(CW, CH), eg = emC.getContext('2d');
      fg.fillStyle = '#5a636f'; fg.fillRect(0, 0, CW, CH);
      eg.fillStyle = '#000000'; eg.fillRect(0, 0, CW, CH);
      const cols = 10, rows = 34, cw = CW / cols, chh = CH / rows;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const x = i * cw + cw * 0.13, y = j * chh + chh * 0.22, w = cw * 0.74, h = chh * 0.5;
          const r = rnd();
          const lit = r > 0.935;
          const grd = fg.createLinearGradient(0, y, 0, y + h);
          grd.addColorStop(0, lit ? 'rgba(236,206,166,.95)' : 'rgba(158,178,196,.78)');
          grd.addColorStop(1, lit ? 'rgba(198,160,116,.92)' : 'rgba(24,30,40,.88)');
          fg.fillStyle = grd; fg.fillRect(x, y, w, h);
          if (lit) { eg.fillStyle = 'rgba(255,198,136,1)'; eg.fillRect(x, y, w, h); }
        }
        fg.fillStyle = 'rgba(104,112,124,.5)'; fg.fillRect(0, j * chh, CW, 1.3);
      }
      // structural piers, a little wider than the mullions between bays
      for (const i of [0, 5]) {
        fg.fillStyle = 'rgba(126,133,143,.92)'; fg.fillRect(i * cw + cw * 0.02, 0, cw * 0.1, CH);
      }

      const cityUniforms = {
        uHaze: { value: new THREE.Color(0xd2d6d7) },
        uHazeLow: { value: new THREE.Color(0xdcdedb) },
        uRim: { value: new THREE.Color(0.52, 0.50, 0.46) }
      };

      const cityMat = new THREE.MeshStandardMaterial({
        map: tex(faceC, { srgb: true }),
        emissiveMap: tex(emC, { srgb: true }),
        emissive: new THREE.Color(0xffc488),
        emissiveIntensity: 0.55,
        color: 0xffffff,
        roughness: 0.30, metalness: 0.22,
        envMapIntensity: 1.15,
        side: THREE.DoubleSide,   /* the prisms are wound as plans, either way */
        fog: false                /* the atmosphere is its own below */
      });
      cityMat.uniforms = cityUniforms;
      cityMat.onBeforeCompile = (sh) => {
        sh.uniforms.uHaze = cityUniforms.uHaze;
        sh.uniforms.uHazeLow = cityUniforms.uHazeLow;
        sh.uniforms.uRim = cityUniforms.uRim;
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nvarying vec3 vCYWorld;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>
            vec4 cwPos = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              cwPos = instanceMatrix * cwPos;
            #endif
            vCYWorld = (modelMatrix * cwPos).xyz;`);
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uHaze;\nuniform vec3 uHazeLow;\nuniform vec3 uRim;\nvarying vec3 vCYWorld;')
          .replace('#include <fog_fragment>', `
            /* aerial perspective, by hand: the scene's own fog is an exp² field
               that swallows anything past 400 m, and this city runs from 300 m
               to two kilometres. The near ring is hazed exactly as hard as the
               land it stands on, the far rings settle toward a soft silhouette
               (the towers must still read at two kilometres), and height lifts
               every tower out of the ground mist. */
            float cwD = length(vCYWorld - cameraPosition);
            float cwH = clamp((vCYWorld.y + 4.0) / 190.0, 0.0, 1.0);
            float cwE = cwD * 0.0019;
            float cwF = 1.0 - exp(-cwE * cwE);
            float cwA = mix(cwF, 0.62, smoothstep(700.0, 1900.0, cwD));
            cwA *= 1.0 - 0.42 * cwH;
            cwA = clamp(cwA, 0.0, 0.88);
            vec3 cwHaze = mix(uHazeLow, uHaze, smoothstep(0.0, 0.55, cwH));
            gl_FragColor.rgb = mix(gl_FragColor.rgb, cwHaze, cwA);

            /* and the low sun on every edge that turns away from the eye */
            vec3 cwN = normalize(normal);
            float cwRim = pow(1.0 - clamp(abs(dot(cwN, normalize(vViewPosition))), 0.0, 1.0), 3.0);
            gl_FragColor.rgb += uRim * cwRim * 0.30 * (1.0 - cwA * 0.5);`);
      };
      cityMat.customProgramCacheKey = () => 'citycurtain';

      /* ── a tapered prism from a plan ─────────────────────────────────────
         The plan is a unit polygon round the origin; the top is the same plan
         scaled by `taper`. Normals point straight out of each face, so the
         chamfers read as facets and the smooth sides catch the sky.         */
      function prismGeo(plan, taper = 1, segs = 6) {
        const pos = [], nor = [], uv = [], idx = [];
        const n = plan.length;
        let per = 0;
        const lens = [];
        for (let i = 0; i < n; i++) {
          const a = plan[i], b = plan[(i + 1) % n];
          const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
          lens.push(l); per += l;
        }
        let acc = 0, vo = 0;
        for (let i = 0; i < n; i++) {
          const a = plan[i], b = plan[(i + 1) % n], l = lens[i];
          const u0 = acc / per, u1 = (acc + l) / per;
          const mx = (a[0] + b[0]) * 0.5, mz = (a[1] + b[1]) * 0.5;
          const ml = Math.hypot(mx, mz) || 1;
          const nx = mx / ml, nz = mz / ml;
          pos.push(a[0], 0, a[1], b[0], 0, b[1],
                   b[0] * taper, 1, b[1] * taper, a[0] * taper, 1, a[1] * taper);
          for (let k = 0; k < 4; k++) nor.push(nx, 0, nz);
          uv.push(u0, 0, u1, 0, u1, 1, u0, 1);
          idx.push(vo, vo + 1, vo + 2, vo, vo + 2, vo + 3);
          vo += 4; acc += l;
        }
        // roof
        const cvo = vo;
        pos.push(0, 1, 0); nor.push(0, 1, 0); uv.push(0.5, 1);
        for (let i = 0; i < n; i++) {
          const p = plan[i];
          pos.push(p[0] * taper, 1, p[1] * taper); nor.push(0, 1, 0); uv.push(0.5 + p[0], 1);
        }
        for (let i = 0; i < n; i++) idx.push(cvo, cvo + 1 + i, cvo + 1 + ((i + 1) % n));
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        return g;
      }

      const poly = (n, rot = 0, r = 0.5) => {
        const out = [];
        for (let i = 0; i < n; i++) {
          const a = rot + (i / n) * Math.PI * 2;
          out.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        return out;
      };
      // a square with its corners cut: the classic Gulf tower plan
      const chamfer = (c = 0.42) => [[0.5, c], [0.5, -c], [c, -0.5], [-c, -0.5],
                                     [-0.5, -c], [-0.5, c], [-c, 0.5], [c, 0.5]];

      const GEO = {
        octa: prismGeo(poly(8, Math.PI / 8), 0.62),      // tapered octagon
        cham: prismGeo(chamfer(0.40), 0.68),             // tapered chamfered square
        slab: prismGeo(chamfer(0.46), 0.94),             // a straight-sided older block
        crown: prismGeo(poly(8, Math.PI / 8), 0.86),     // a stepped shoulder
        spire: prismGeo(poly(3), 0.02)                   // a needle
      };

      const NEAR = 0x7e8b99, FAR = 0xa9b2bc;
      const dm = new THREE.Object3D();
      const parts = { octa: [], cham: [], slab: [], crown: [], spire: [] };

      const push = (set, x, z, w, h, d, col, y = -6) => {
        parts[set].push({ x, y, z, w, h, d, col });
      };

      const N = LOWRAM ? 64 : (MOBILE ? 150 : 320);
      for (let i = 0; i < N; i++) {
        /* Three rings, all the way round the house: the low waterfront
           neighbourhood close in, the downtown mass behind it, and the far
           silhouette, with the density thinning and the heights rising as the
           rings go out. The nearest ring is set back off the boulevard so the
           approach still has a street to look down. */
        const pick = rnd();
        let r, hMin, hMax, wMin, wMax;
        if (pick < 0.30) { r = rr(330, 520); hMin = 14; hMax = 46; wMin = 18; wMax = 36; }
        else if (pick < 0.66) { r = rr(580, 880); hMin = 28; hMax = 110; wMin = 22; wMax = 50; }
        else if (pick < 0.92) { r = rr(930, 1450); hMin = 45; hMax = 190; wMin = 28; wMax = 64; }
        else { r = rr(1550, 2450); hMin = 60; hMax = 280; wMin = 34; wMax = 82; }
        const ang = rnd() * Math.PI * 2;
        const x = HOME.x + Math.cos(ang) * r;
        const z = HOME.z + Math.sin(ang) * r * 1.02;
        // the boulevard runs out of the city between the towers
        if (z > 60 && z < 780 && Math.abs(x - driveCX(z)) < 36) continue;
        const w = rr(wMin, wMax), d = w * rr(0.72, 1.3);
        let h = hMin + Math.pow(rnd(), 2.0) * (hMax - hMin);
        const tall = rnd() < 0.10;
        if (tall) h *= rr(1.12, 1.42);
        const far = clamp((r - 330) / 1800);
        const col = new THREE.Color(NEAR).lerp(new THREE.Color(FAR), far * rr(0.45, 1));
        const set = rnd() < 0.46 ? 'octa' : (rnd() < 0.55 ? 'cham' : 'slab');
        push(set, x, z, w, h, d, col);
        // stepped shoulders and crowns on the taller ones: the silhouette is
        // the whole story at this distance
        if (h > hMax * 0.78) {
          push('crown', x, z, w * rr(0.62, 0.8), h + rr(5, 14), d * rr(0.62, 0.8),
               col.clone().offsetHSL(0, -0.02, 0.035));
          if (rnd() < 0.35) {
            push('crown', x, z, w * rr(0.34, 0.48), h + rr(16, 30), d * rr(0.34, 0.48),
                 col.clone().offsetHSL(0, -0.02, 0.05));
          }
        }
        if (tall && rnd() < 0.55) {
          parts.spire.push({ x, y: h - 2, z, w: w * 0.085, h: rr(22, 52), d: w * 0.085, col });
        }
      }

      /* ── the landmarks ──────────────────────────────────────────────────
         The city needs one thing the eye can name, or a ring of towers is just
         a hedge. A Burj-shaped supertall stands 2.2 km to the north where the
         pool terrace and the orbit both look at it; a pair of slender twins
         flank it to the north-west; and a handful of Gulf spires fill the rest
         of the bowl, so no direction is empty. */
      const spire = (x, z, w, h, top, col) => {
        push('octa', x, z, w, h, w, col);
        push('crown', x, z, w * 0.62, h + (top - h) * 0.34, w * 0.62, col.clone().offsetHSL(0, -0.02, 0.03));
        push('crown', x, z, w * 0.36, h + (top - h) * 0.62, w * 0.36, col.clone().offsetHSL(0, -0.02, 0.045));
        parts.spire.push({ x, y: h + (top - h) * 0.62 - 6, z, w: w * 0.10, h: (top - h) * 0.66, d: w * 0.10, col });
      };
      // the Burj: a wide podium, a slender shaft, stepped crowns, a needle.
      // It stands a little west of due north, where the approach's own axis
      // finds it over the villa's roof.
      {
        const bx = -250, bz = -2250, col = new THREE.Color(0x9aa6b2);
        push('octa', bx, bz, 150, 210, 150, col);
        push('cham', bx, bz, 104, 430, 104, col.clone().offsetHSL(0, -0.02, 0.02));
        push('cham', bx, bz, 74, 610, 74, col.clone().offsetHSL(0, -0.02, 0.035));
        push('cham', bx, bz, 52, 740, 52, col.clone().offsetHSL(0, -0.02, 0.05));
        push('octa', bx, bz, 30, 812, 30, col.clone().offsetHSL(0, -0.02, 0.06));
        parts.spire.push({ x: bx, y: 800, z: bz, w: 11, h: 120, d: 11, col });
      }
      // twin slender towers to the north-west
      for (const [x, z, w, h] of [[-980, -1560, 58, 300], [-880, -1620, 52, 268]]) {
        push('cham', x, z, w, h, w * 1.15, new THREE.Color(0x94a0ac));
        push('crown', x, z, w * 0.8, h + 22, w * 0.92, new THREE.Color(0x9da8b4));
        parts.spire.push({ x, y: h + 14, z, w: 7, h: 46, d: 9, col: new THREE.Color(0x99a4b0) });
      }
      // and the rest of the bowl: spires in every other direction
      for (const [x, z, w, h, top] of [
        [1180, 900, 46, 250, 330], [-1340, 620, 50, 230, 300], [640, 1420, 54, 210, 286],
        [-420, 1240, 40, 190, 256], [1520, -420, 44, 236, 296], [-1500, -320, 42, 205, 268]
      ]) {
        spire(x, z, w, h, top, new THREE.Color(0x97a3af));
      }
      // one tall landmark due west of the pool terrace, so the view over the
      // water has a name in it too
      spire(-2680, -520, 62, 300, 640, new THREE.Color(0x9aa6b2));

      const cityMeshes = [];
      for (const key of Object.keys(parts)) {
        const arr = parts[key];
        if (!arr.length) continue;
        const mesh = new THREE.InstancedMesh(GEO[key], cityMat, arr.length);
        arr.forEach((p, i) => {
          dm.position.set(p.x, p.y, p.z);
          dm.scale.set(p.w, p.h, p.d);
          dm.rotation.set(0, key === 'spire' ? rr(0, 6.28) : 0, 0);
          dm.updateMatrix();
          mesh.setMatrixAt(i, dm.matrix);
          mesh.setColorAt(i, p.col);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = false; mesh.receiveShadow = false;
        mesh.frustumCulled = false;
        mesh.renderOrder = 1;
        world.add(mesh);
        cityMeshes.push(mesh);
      }

      setCity = (on) => {
        for (const m of cityMeshes) m.visible = !!on;
        drawFrame();
      };
      const cityOn = opts.city !== false;
      for (const m of cityMeshes) m.visible = cityOn;

      /* the sky decides how far the city is allowed to recede */
      cityMood = (P) => {
        const dusk = P === 'dusk' || P === 'golden';
        cityMat.color.setHex(dusk ? 0xe2d8ca : 0xffffff);
        cityMat.emissiveIntensity = P === 'dusk' ? 1.15 : (P === 'golden' ? 0.8 : 0.5);
        const preset = SKY_PRESETS[P] || SKY_PRESETS.morning;
        cityUniforms.uHaze.value.setHex(preset.fog);
        cityUniforms.uHazeLow.value.setHex(preset.below ? preset.below[0] : preset.fog);
        cityUniforms.uRim.value.setHex(P === 'dusk' ? 0xd8a26a : (P === 'golden' ? 0xe0b484 : 0x9aa2ac));
      };
    }

    /* ─────────────────────────────────────────────────────────────────────
       6 · the house — one mass, two storeys
       A travertine upper floor overhangs a recessed, entirely glazed ground
       floor: four metres of shaded glass below, four metres of stone above,
       and a 1.8 m porch in the shadow of the slab between them. The upper
       storey is a single continuous block — a long bronze-framed ribbon, a
       loggia cut into it, the entry slot passing through both floors — so the
       house reads as one commanding volume from 80 m out on the drive and as a
       sequence of rooms up close. The wing stays one storey and its roof
       becomes the second terrace, flush with the first floor, looking back at
       the house.
       ───────────────────────────────────────────────────────────────────── */
    const G = { x0: -12.5, x1: 4.0, z0: -6.0, z1: 6.6, h: 4.05, t: 0.54 };
    const S = { x0: -14.1, x1: 4.6, z0: -6.0, z1: 8.4, y0: 4.05, y1: 8.15, t: 0.54 };
    const WING = { x0: 4.0, x1: 16.2, z0: -6.0, z1: 3.4, h: 3.72, t: 0.44 };
    const DECK = 4.05;              // structural second floor, and the wing roof
    const F2 = 4.45;                // finished floor of the upper storey
    const RL = 8.15;                // underside of the roof slab
    const ROOF = RL + 0.38;
    const DOOR = { a: -1.3, b: 1.3, top: 3.05 };
    const REAR = { a: -6.4, b: 1.6, top: 3.85 };
    const ATRIUM = { x0: -10.6, x1: 1.4, z0: -6.0, z1: 2.4 };
    const LOGGIA = { x0: -10.6, x1: -5.2, z0: 6.9, z1: S.z1 };
    const SKY = { x0: -8.4, x1: -2.8, z0: -5.2, z1: 0.9 };
    const PORCH = { z0: G.z1, z1: S.z1 };

    const warmLamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.2, 1.25) });

    /* plinths: one pale slab under each volume, 0.36 proud of the meadow */
    addBox(G.x1 - G.x0 + 0.9, 0.36, G.z1 - G.z0 + 0.9, (G.x0 + G.x1) / 2, -0.18, (G.z0 + G.z1) / 2, M.concrete, { uv: 0.42 });
    addBox(WING.x1 - WING.x0 + 0.7, 0.34, WING.z1 - WING.z0 + 0.7, (WING.x0 + WING.x1) / 2, -0.17, (WING.z0 + WING.z1) / 2, M.concrete, { uv: 0.42 });

    await nextTick();

    /* ── ground storey: stone piers, glass between them ─────────────────── */
    addWall({
      axis: 'x', at: G.z1, from: G.x0, to: G.x1, y0: 0, y1: G.h, thick: G.t, mat: M.stone, uv: 0.4,
      holes: [
        { a: -1.35, b: 1.35, y0: 0, y1: 3.95 },         // the entry, with its transom
        { a: -11.7, b: -3.1, y0: 0.05, y1: 3.8 },       // the living room, floor to ceiling
        { a: 2.05, b: 3.55, y0: 1.0, y1: 3.45 }         // beside the door
      ]
    });
    addWall({
      axis: 'x', at: G.z0, from: G.x0, to: G.x1, y0: 0, y1: G.h, thick: G.t, mat: M.stone, uv: 0.4,
      holes: [
        { a: REAR.a, b: REAR.b, y0: 0.03, y1: REAR.top },
        { a: -11.9, b: -10.3, y0: 0.95, y1: 3.5 }
      ]
    });
    addWall({
      axis: 'z', at: G.x0, from: G.z0, to: G.z1, y0: 0, y1: G.h, thick: G.t, mat: M.stone, uv: 0.4,
      holes: [
        { a: -4.4, b: -2.0, y0: 0.9, y1: 3.6 },
        { a: 0.8, b: 2.9, y0: 0.9, y1: 3.6 }
      ]
    });
    addWall({
      axis: 'z', at: G.x1, from: G.z0, to: G.z1, y0: 0, y1: G.h, thick: G.t, mat: M.stone, uv: 0.4,
      holes: [
        { a: -2.4, b: 0.4, y0: 0, y1: 2.95 },           // through to the wing
        { a: -5.2, b: -3.6, y0: 1.0, y1: 3.4 }
      ]
    });

    /* ── upper storey: one plane, one ribbon of glass ───────────────────── */
    addWall({
      axis: 'x', at: S.z1, from: S.x0, to: S.x1, y0: DECK, y1: S.y1, thick: S.t, mat: M.stone, uv: 0.4,
      holes: [
        { a: -12.9, b: -10.6, y0: 4.95, y1: 7.45 },
        { a: LOGGIA.x0, b: LOGGIA.x1, y0: 4.4, y1: 7.95 },   // the loggia, cut out of the block
        { a: -5.2, b: -1.9, y0: 4.95, y1: 7.45 },
        { a: -0.9, b: 0.9, y0: 4.9, y1: 7.5 },               // above the entry
        { a: 2.3, b: 3.6, y0: 4.95, y1: 7.45 }
      ]
    });
    addWall({
      axis: 'x', at: S.z0, from: S.x0, to: S.x1, y0: DECK, y1: S.y1, thick: S.t, mat: M.stone, uv: 0.4,
      holes: [
        { a: -12.8, b: -7.0, y0: 5.0, y1: 7.5 },
        { a: -6.6, b: -3.4, y0: F2, y1: 7.4 },               // out onto the rear balcony
        { a: -3.0, b: 1.2, y0: 5.0, y1: 7.5 }
      ]
    });
    addWall({
      axis: 'z', at: S.x0, from: S.z0, to: S.z1, y0: DECK, y1: S.y1, thick: S.t, mat: M.stone, uv: 0.4,
      holes: [
        { a: -4.6, b: -2.2, y0: 4.95, y1: 7.45 },
        { a: 1.0, b: 3.2, y0: 4.95, y1: 7.45 },
        { a: 4.8, b: 6.6, y0: 4.95, y1: 7.45 }
      ]
    });
    addWall({
      axis: 'z', at: S.x1, from: S.z0, to: S.z1, y0: DECK, y1: S.y1, thick: S.t, mat: M.stone, uv: 0.4,
      holes: [
        { a: -1.4, b: 1.6, y0: F2, y1: 7.2 },                // the door onto the roof deck
        { a: -5.4, b: -3.4, y0: 4.95, y1: 7.45 }
      ]
    });
    /* the loggia's side returns */
    for (const [x, sgn] of [[LOGGIA.x0, 1], [LOGGIA.x1, -1]]) {
      addWall({
        axis: 'z', at: x, from: LOGGIA.z0, to: LOGGIA.z1, y0: F2, y1: RL, thick: 0.28, mat: M.stone, uv: 0.4
      });
    }

    /* ── the wing: one storey of glass under a timber screen ────────────── */
    addWall({
      axis: 'x', at: WING.z1, from: WING.x0, to: WING.x1, y0: 0, y1: WING.h, thick: WING.t, mat: M.stone, uv: 0.4,
      holes: [{ a: 5.6, b: 15.0, y0: 0.05, y1: 3.3 }]
    });
    addWall({
      axis: 'x', at: WING.z0, from: WING.x0, to: WING.x1, y0: 0, y1: WING.h, thick: WING.t, mat: M.stone, uv: 0.4,
      holes: [{ a: 5.4, b: 15.6, y0: 0.05, y1: 3.3 }]
    });
    addWall({
      axis: 'z', at: WING.x1, from: WING.z0, to: WING.z1, y0: 0, y1: WING.h, thick: WING.t, mat: M.stone, uv: 0.4,
      holes: [{ a: -5.2, b: 2.6, y0: 0.05, y1: 3.3 }]
    });

    /* ── expressed lines: the floor band, the joints, the shadow gaps ───── */
    // the ground floor is capped by a bronze shadow line where the slab meets it
    for (const [z, dir] of [[G.z1 + 0.005, 1], [G.z0 - 0.005, -1]]) {
      addBox(G.x1 - G.x0 + 0.02, 0.07, 0.02, (G.x0 + G.x1) / 2, 4.02, z, M.dark, { uv: 0.4, cast: false });
    }
    addBox(0.02, 0.07, G.z1 - G.z0 + 0.02, G.x0 - 0.005, 4.02, (G.z0 + G.z1) / 2, M.dark, { uv: 0.4, cast: false });
    addBox(0.02, 0.07, G.z1 - G.z0 + 0.02, G.x1 + 0.005, 4.02, (G.z0 + G.z1) / 2, M.dark, { uv: 0.4, cast: false });
    // ashlar joints on the upper front, so 18 m of wall still has a scale
    for (const x of [-13.4, -11.7, -6.4, -3.4, 1.3, 4.1]) {
      addBox(0.03, RL - DECK - 0.1, 0.02, x, (DECK + RL) / 2, S.z1 + 0.005, M.dark, { uv: 0.4, cast: false });
    }
    for (const z of [-3.6, 0.2, 3.6, 7.2]) {
      addBox(0.02, RL - DECK - 0.1, 0.03, S.x0 - 0.005, (DECK + RL) / 2, z, M.dark, { uv: 0.4, cast: false });
    }

    /* ── glazing, bronze-framed, in every opening ───────────────────────── */
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
      const tall = y1 - y0 > 2.3;
      if (tall) {
        if (axis === 'x') mk(to - from, 0.05, dF * 0.85, (from + to) / 2, y1 - 0.62, at);
        else mk(dF * 0.85, 0.05, to - from, at, y1 - 0.62, (from + to) / 2);
      }
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
        const a = mul[i], b = mul[i + 1];
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

    // ground floor
    glaze({ axis: 'x', at: G.z1 - 0.02, from: -11.7, to: -3.1, y0: 0.05, y1: 3.8, mullions: 6 });
    glaze({ axis: 'x', at: G.z1 - 0.02, from: -1.35, to: 1.35, y0: 3.05, y1: 3.95, mullions: 2, sill: false });
    glaze({ axis: 'x', at: G.z1 - 0.02, from: 2.05, to: 3.55, y0: 1.0, y1: 3.45, mullions: 1 });
    glaze({ axis: 'x', at: G.z0 + 0.02, from: REAR.a, to: REAR.b, y0: 0.03, y1: REAR.top, mullions: [-6.4, -4.8, -3.2, -1.6, 0.0], openFrom: 1.6, openTo: 0.0 });
    glaze({ axis: 'x', at: G.z0 + 0.02, from: -11.9, to: -10.3, y0: 0.95, y1: 3.5, mullions: 1 });
    glaze({ axis: 'z', at: G.x0 + 0.02, from: -4.4, to: -2.0, y0: 0.9, y1: 3.6, mullions: 2 });
    glaze({ axis: 'z', at: G.x0 + 0.02, from: 0.8, to: 2.9, y0: 0.9, y1: 3.6, mullions: 2 });
    glaze({ axis: 'z', at: G.x1 - 0.02, from: -5.2, to: -3.6, y0: 1.0, y1: 3.4, mullions: 1 });
    // upper floor
    glaze({ axis: 'x', at: S.z1 - 0.02, from: -12.9, to: -10.6, y0: 4.95, y1: 7.45, mullions: 1 });
    glaze({ axis: 'x', at: S.z1 - 0.02, from: -5.2, to: -1.9, y0: 4.95, y1: 7.45, mullions: 2 });
    glaze({ axis: 'x', at: S.z1 - 0.02, from: -0.9, to: 0.9, y0: 4.9, y1: 7.5, mullions: 1 });
    glaze({ axis: 'x', at: S.z1 - 0.02, from: 2.3, to: 3.6, y0: 4.95, y1: 7.45, mullions: 1 });
    glaze({ axis: 'x', at: LOGGIA.z0 - 0.02, from: LOGGIA.x0, to: LOGGIA.x1, y0: F2, y1: 7.9, mullions: [-10.6, -8.8, -7.0, -5.2], sill: false });
    glaze({ axis: 'x', at: S.z0 + 0.02, from: -12.8, to: -7.0, y0: 5.0, y1: 7.5, mullions: 3 });
    glaze({ axis: 'x', at: S.z0 + 0.02, from: -3.0, to: 1.2, y0: 5.0, y1: 7.5, mullions: 2 });
    glaze({ axis: 'x', at: S.z0 + 0.02, from: -6.6, to: -3.4, y0: F2, y1: 7.4, mullions: 2, sill: false });
    glaze({ axis: 'z', at: S.x0 + 0.02, from: -4.6, to: -2.2, y0: 4.95, y1: 7.45, mullions: 1 });
    glaze({ axis: 'z', at: S.x0 + 0.02, from: 1.0, to: 3.2, y0: 4.95, y1: 7.45, mullions: 1 });
    glaze({ axis: 'z', at: S.x0 + 0.02, from: 4.8, to: 6.6, y0: 4.95, y1: 7.45, mullions: 1 });
    glaze({ axis: 'z', at: S.x1 - 0.02, from: -1.4, to: 1.6, y0: F2, y1: 7.2, mullions: 2, sill: false });
    glaze({ axis: 'z', at: S.x1 - 0.02, from: -5.4, to: -3.4, y0: 4.95, y1: 7.45, mullions: 1 });
    // wing
    glaze({ axis: 'x', at: WING.z1 - 0.02, from: 5.6, to: 15.0, y0: 0.05, y1: 3.3, mullions: 6 });
    glaze({ axis: 'x', at: WING.z0 + 0.02, from: 5.4, to: 15.6, y0: 0.05, y1: 3.3, mullions: 6 });
    glaze({ axis: 'z', at: WING.x1 - 0.02, from: -5.2, to: 2.6, y0: 0.05, y1: 3.3, mullions: 5 });

    /* ── the entry: a bronze portal, a deep reveal, the transom above ───── */
    {
      const z = G.z1;
      // jambs and lintel stand 0.3 proud of the glass line
      addBox(0.34, 3.1, 0.36, -1.5, 1.55, z + 0.08, M.stone, { uv: 0.4 });
      addBox(0.34, 3.1, 0.36, 1.5, 1.55, z + 0.08, M.stone, { uv: 0.4 });
      addBox(3.34, 0.3, 0.36, 0, 3.12, z + 0.08, M.stone, { uv: 0.4 });
      // the bronze frame of the leaf opening
      addBox(2.66, 0.05, 0.2, 0, DOOR.top + 0.02, z, M.bronze, { uv: 0.5 });
      addBox(0.05, DOOR.top, 0.2, -1.31, DOOR.top / 2, z, M.bronze, { uv: 0.5 });
      addBox(0.05, DOOR.top, 0.2, 1.31, DOOR.top / 2, z, M.bronze, { uv: 0.5 });
      // the threshold itself is laid with the entry apron, on the apron's own
      // level: one bronze inlay, not a plate buried under the floor
      // the door itself, open inward against the wall
      addBox(0.06, 3.0, 1.18, -1.28, 1.5, z - 0.62, M.walnutVert, { uv: 0.6 });
      addBox(0.05, 0.05, 1.0, -1.24, 1.05, z - 0.6, M.bronze, { uv: 0.5 });
    }

    /* ── porch: oak soffit under the cantilever, two bronze columns ─────── */
    {
      const z0 = PORCH.z0, z1 = PORCH.z1 - 0.05, zc = (z0 + z1) / 2, d = z1 - z0;
      for (let x = S.x0 + 0.15; x <= S.x1 - 0.1; x += 0.17) {
        addBox(0.085, 0.13, d, x, 3.97, zc, M.cedarVert, { uv: 0.7 });
      }
      addBox(S.x1 - S.x0, 0.08, 0.07, (S.x0 + S.x1) / 2, 3.9, z0 + 0.03, M.bronze, { uv: 0.5 });
      for (const x of [-8.6, 2.4]) {
        addBox(0.14, 4.0, 0.14, x, 2.0, z1 - 0.16, M.bronze, { uv: 0.5 });
        addBox(0.3, 0.03, 0.3, x, 4.03, z1 - 0.16, M.bronze, { uv: 0.5 });
        contactShadow(x, z1 - 0.16, 0.7, 0.7, true, 0.02);
      }
      // two recessed downlights in the soffit, washing the stone
      for (const x of [-6.2, -1.9, 3.0]) {
        addBox(0.1, 0.02, 0.1, x, 3.93, zc - 0.4, warmLamp, { cast: false, receive: false });
      }
    }

    /* ── roofs: a deep flat slab, a crisp fascia, a slim parapet ────────── */
    const roofMat = new THREE.MeshStandardMaterial({
      map: tex(grav.map, { srgb: true }), normalMap: tex(grav.normal),
      color: 0xd8cdb8, roughness: 0.98, metalness: 0, envMapIntensity: 0.9,
      emissive: new THREE.Color(0x1b1712), emissiveIntensity: 1.0
    });
    const OV = 1.5;                 // overhang
    {
      const x0 = S.x0 - OV, x1 = S.x1 + OV, z0 = S.z0 - OV, z1 = S.z1 + OV;
      const bx = [[x0, SKY.x0, z0, z1], [SKY.x1, x1, z0, z1], [SKY.x0, SKY.x1, z0, SKY.z0], [SKY.x0, SKY.x1, SKY.z1, z1]];
      for (const [a, b, c, d] of bx) {
        addBox(b - a, ROOF - RL, d - c, (a + b) / 2, (RL + ROOF) / 2, (c + d) / 2, M.stonePale, { uv: 0.4 });
      }
      // membrane + pale walkway where it shows from the orbit
      for (const [a, b, c, d] of bx) {
        addBox(b - a - 0.9, 0.04, d - c - 0.9, (a + b) / 2, ROOF + 0.02, (c + d) / 2, roofMat, { uv: 0.3, cast: false });
      }
      // fascia: a stone band with a bronze drip line, and the parapet above
      const fh = 0.38;
      addBox(x1 - x0 + 0.06, fh, 0.1, (x0 + x1) / 2, ROOF - fh / 2 + 0.02, z0 - 0.02, M.stonePale, { uv: 0.4 });
      addBox(x1 - x0 + 0.06, fh, 0.1, (x0 + x1) / 2, ROOF - fh / 2 + 0.02, z1 + 0.02, M.stonePale, { uv: 0.4 });
      addBox(0.1, fh, z1 - z0, x0 - 0.02, ROOF - fh / 2 + 0.02, (z0 + z1) / 2, M.stonePale, { uv: 0.4 });
      addBox(0.1, fh, z1 - z0, x1 + 0.02, ROOF - fh / 2 + 0.02, (z0 + z1) / 2, M.stonePale, { uv: 0.4 });
      for (const [a, b, c, d] of [[x0 + 0.06, x1 - 0.06, z0 + 0.02, z0 + 0.1], [x0 + 0.06, x1 - 0.06, z1 - 0.1, z1 - 0.02],
        [x0 + 0.02, x0 + 0.1, z0 + 0.06, z1 - 0.06], [x1 - 0.1, x1 - 0.02, z0 + 0.06, z1 - 0.06]]) {
        addBox(b - a, 0.05, d - c, (a + b) / 2, ROOF - fh + 0.03, (c + d) / 2, M.bronze, { uv: 0.5, cast: false });
      }
      // parapet, set back 0.14 with a bronze coping
      const pw2 = 0.14, ph = 0.30;
      for (const [a, b, c, d] of [[x0 + 0.14, x1 - 0.14, z0 + 0.14, z0 + 0.14 + pw2], [x0 + 0.14, x1 - 0.14, z1 - 0.14 - pw2, z1 - 0.14],
        [x0 + 0.14, x0 + 0.14 + pw2, z0 + 0.14, z1 - 0.14], [x1 - 0.14 - pw2, x1 - 0.14, z0 + 0.14, z1 - 0.14]]) {
        addBox(b - a, ph, d - c, (a + b) / 2, ROOF + ph / 2, (c + d) / 2, M.stonePale, { uv: 0.4 });
        /* a crisp cut-stone coping, bevelled by its own overhang, instead of
           the bronze cap that read as a painted line on the pale roof */
        addBox(b - a + 0.10, 0.06, d - c + 0.10, (a + b) / 2, ROOF + ph + 0.03, (c + d) / 2, M.stonePale, { uv: 0.45, cast: false });
        addBox(b - a + 0.02, 0.018, d - c + 0.02, (a + b) / 2, ROOF + ph - 0.009, (c + d) / 2, M.dark, { uv: 0.5, cast: false });
      }
    }
    // the skylight over the hall, raised out of the roof
    {
      const w = SKY.x1 - SKY.x0, d = SKY.z1 - SKY.z0, cx = (SKY.x0 + SKY.x1) / 2, cz = (SKY.z0 + SKY.z1) / 2;
      // the lantern: 1.5 m of stonewall above the roof, glazed over the top
      const LH = 1.5;
      for (const [a, b, c, dd] of [[SKY.x0 - 0.24, SKY.x1 + 0.24, SKY.z0 - 0.24, SKY.z0], [SKY.x0 - 0.24, SKY.x1 + 0.24, SKY.z1, SKY.z1 + 0.24],
        [SKY.x0 - 0.24, SKY.x0, SKY.z0, SKY.z1], [SKY.x1, SKY.x1 + 0.24, SKY.z0, SKY.z1]]) {
        addBox(b - a, LH, dd - c, (a + b) / 2, ROOF + LH / 2, (c + dd) / 2, M.stonePale, { uv: 0.4 });
      }
      const lw = SKY.x1 - SKY.x0 + 0.48, ld = SKY.z1 - SKY.z0 + 0.48;
      addBox(lw + 0.1, 0.07, ld + 0.1, cx, ROOF + LH + 0.02, cz, M.bronze, { uv: 0.5 });
      const lglass = new THREE.Mesh(new THREE.PlaneGeometry(lw - 0.06, ld - 0.06), M.glass);
      lglass.rotation.x = -Math.PI / 2;
      lglass.position.set(cx, ROOF + LH + 0.06, cz);
      lglass.renderOrder = 3;
      world.add(lglass);
      // the well lined in plaster through the depth of the slab
      for (const [a, b, c, dd] of [[SKY.x0 - 0.03, SKY.x0, SKY.z0, SKY.z1], [SKY.x1, SKY.x1 + 0.03, SKY.z0, SKY.z1],
        [SKY.x0, SKY.x1, SKY.z0 - 0.03, SKY.z0], [SKY.x0, SKY.x1, SKY.z1, SKY.z1 + 0.03]]) {
        addBox(b - a, ROOF - RL, dd - c, (a + b) / 2, (RL + ROOF) / 2, (c + dd) / 2, M.plaster, { uv: 0.4, cast: false });
      }
      const skyGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.1, 2.35, 2.6) });
      addBox(w - 0.04, 0.01, d - 0.04, cx, ROOF + LH - 0.03, cz, skyGlow, { cast: false, receive: false });
      const cover = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.06, d + 0.06), M.glass);
      cover.rotation.x = -Math.PI / 2;
      cover.position.set(cx, ROOF + LH, cz);
      cover.renderOrder = 3;
      world.add(cover);
    }

    /* ── the solar array ──────────────────────────────────────────────────
       Twelve monocrystalline modules in three rows on the open east half of
       the main roof, clear of the skylight lantern and the parapet planters.
       12° south tilt on charcoal rails and concrete ballast, so it reads as
       the plant room of a house that is meant to run itself. Instanced: four
       draws for the whole array, no material the rest of the scene does not
       already carry.                                                       */
    {
      const TILT = 12 * Math.PI / 180;
      const PW = 1.68, PD = 1.02;                 // module, landscape
      const ROWS = [5.05, 6.60, 8.15];            // row centres, front to back
      const COLS = [-1.15, 0.62, 2.39, 4.16];     // module centres across
      const y0 = ROOF + 0.26 + (PD / 2) * Math.sin(TILT);
      const pvTex = makePvPanel();
      const pvMat = MOBILE || LOWRAM
        ? new THREE.MeshStandardMaterial({
            map: tex(pvTex.map, { srgb: true }),
            roughness: 0.17, metalness: 0.34, envMapIntensity: 1.1
          })
        : new THREE.MeshPhysicalMaterial({
            map: tex(pvTex.map, { srgb: true }),
            roughness: 0.18, metalness: 0.30, envMapIntensity: 1.15,
            clearcoat: 0.55, clearcoatRoughness: 0.14
          });
      const railMat = new THREE.MeshStandardMaterial({
        color: 0x25282c, roughness: 0.34, metalness: 0.88, envMapIntensity: 1.0
      });

      /* the glass laminate, one draw for all twelve */
      const faceGeo = new THREE.PlaneGeometry(PW - 0.05, PD - 0.05);
      faceGeo.rotateX(-Math.PI / 2 + TILT);
      const faces = new THREE.InstancedMesh(faceGeo, pvMat, ROWS.length * COLS.length);
      faces.name = 'solar:panels';
      /* the anodised frame under each laminate */
      const frameGeo = new THREE.BoxGeometry(PW + 0.02, 0.055, PD + 0.02);
      frameGeo.rotateX(TILT);
      const frames = new THREE.InstancedMesh(frameGeo, railMat, ROWS.length * COLS.length);
      frames.name = 'solar:frames';
      frames.castShadow = true;
      const d = new THREE.Object3D();
      let k = 0;
      for (const z of ROWS) {
        for (const x of COLS) {
          d.position.set(x, y0 - 0.032, z); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1);
          d.updateMatrix(); frames.setMatrixAt(k, d.matrix);
          d.position.set(x, y0 + 0.012, z);
          d.updateMatrix(); faces.setMatrixAt(k, d.matrix);
          k++;
        }
      }
      faces.instanceMatrix.needsUpdate = true;
      frames.instanceMatrix.needsUpdate = true;
      faces.castShadow = false; faces.receiveShadow = true;
      faces.frustumCulled = false; frames.frustumCulled = false;
      world.add(frames); world.add(faces);

      /* rails under each row, and the ballast feet that hold them down */
      const span = COLS[COLS.length - 1] - COLS[0] + PW;
      const cx = (COLS[0] + COLS[COLS.length - 1]) / 2;
      const railGeo = new THREE.BoxGeometry(span, 0.07, 0.08);
      const rails = new THREE.InstancedMesh(railGeo, railMat, ROWS.length * 2);
      rails.name = 'solar:rails'; rails.castShadow = true;
      let r = 0;
      for (const z of ROWS) for (const dz of [-0.30, 0.30]) {
        d.position.set(cx, ROOF + 0.225, z + dz); d.updateMatrix(); rails.setMatrixAt(r++, d.matrix);
      }
      rails.instanceMatrix.needsUpdate = true; rails.frustumCulled = false;
      world.add(rails);

      const footGeo = new THREE.BoxGeometry(0.22, 0.15, 0.19);
      const feet = new THREE.InstancedMesh(footGeo, M.concrete, ROWS.length * 2 * 5);
      feet.name = 'solar:ballast'; feet.receiveShadow = true;
      let f = 0;
      for (const z of ROWS) for (const dz of [-0.30, 0.30]) {
        for (let i = 0; i < 5; i++) {
          d.position.set(COLS[0] + (span - 0.22) * (i / 4), ROOF + 0.095, z + dz);
          d.updateMatrix(); feet.setMatrixAt(f++, d.matrix);
        }
      }
      feet.instanceMatrix.needsUpdate = true; feet.frustumCulled = false;
      world.add(feet);

      /* the string inverter on the lantern's east wall, with its conduit */
      addBox(0.16, 0.46, 0.36, -2.52, ROOF + 0.35, 2.30, railMat, { cast: false });
      addBox(0.06, 0.06, 0.06, -2.52, ROOF + 0.06, 2.30, M.bronze, { cast: false });
      addBox(0.05, 0.05, 2.4, -2.52, ROOF + 0.08, 3.55, M.bronze, { cast: false });
    }

    /* ── balconies and the roof deck ────────────────────────────────────── */
    /** A frameless glass balustrade on a bronze shoe, axis aligned. */
    function railX(x0, x1, z, y, h = 1.05) {
      const w = x1 - x0, cx = (x0 + x1) / 2;
      const g = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.glass);
      g.position.set(cx, y + h / 2, z); g.renderOrder = 3; world.add(g);
      addBox(w, 0.075, 0.1, cx, y + 0.037, z, M.bronze, { uv: 0.6 });
      addBox(w, 0.045, 0.12, cx, y + h + 0.02, z, M.bronze, { uv: 0.6 });
    }
    function railZ(z0, z1, x, y, h = 1.05) {
      const d = z1 - z0, cz = (z0 + z1) / 2;
      const g = new THREE.Mesh(new THREE.PlaneGeometry(d, h), M.glass);
      g.rotation.y = Math.PI / 2;
      g.position.set(x, y + h / 2, cz); g.renderOrder = 3; world.add(g);
      addBox(0.1, 0.075, d, x, y + 0.037, cz, M.bronze, { uv: 0.6 });
      addBox(0.12, 0.045, d, x, y + h + 0.02, cz, M.bronze, { uv: 0.6 });
    }

    // the loggia: glass at the outer face of the recess
    railX(LOGGIA.x0, LOGGIA.x1, S.z1 - 0.16, F2, 1.08);
    addBox(LOGGIA.x1 - LOGGIA.x0, 0.16, LOGGIA.z1 - LOGGIA.z0, (LOGGIA.x0 + LOGGIA.x1) / 2, F2 - 0.08, (LOGGIA.z0 + LOGGIA.z1) / 2, M.stonePale, { uv: 0.5 });
    // the rear balcony, projecting over the terrace
    {
      addBox(3.9, 0.18, 1.6, -5.0, F2 - 0.09, S.z0 - 0.8, M.stonePale, { uv: 0.5 });
      addBox(3.96, 0.06, 1.66, -5.0, F2 - 0.19, S.z0 - 0.8, M.bronze, { uv: 0.5, cast: false });
      railX(-6.9, -3.1, S.z0 - 1.55, F2, 1.06);
      railZ(S.z0 - 1.55, S.z0, -6.9, F2, 1.06);
      railZ(S.z0 - 1.55, S.z0, -3.1, F2, 1.06);
      contactShadow(-5.0, S.z0 - 0.8, 4.4, 2.2, true, 0.02);
    }
    // the wing's roof deck: slab, pale paving, glass rail on three edges
    {
      addBox(WING.x1 - WING.x0 + 0.9, 0.33, WING.z1 - WING.z0 + 0.9, (WING.x0 + WING.x1) / 2, DECK - 0.165, (WING.z0 + WING.z1) / 2, M.stonePale, { uv: 0.4 });
      addPlane(WING.x1 - WING.x0 + 0.6, WING.z1 - WING.z0 + 0.6, (WING.x0 + WING.x1) / 2, DECK + 0.004, (WING.z0 + WING.z1) / 2, M.oakFloor, { uv: 1 / 3.1 });
      railX(WING.x0 + 0.3, WING.x1 + 0.35, WING.z1 + 0.35, DECK, 1.05);
      railZ(WING.z0 - 0.35, WING.z1 + 0.35, WING.x1 + 0.35, DECK, 1.05);
      railZ(WING.z0 - 0.35, WING.z1 + 0.35, WING.x0 + 0.3, DECK, 1.05);
      // pergola over the east half of the deck
      const px0 = 10.4, px1 = 15.8, pz0 = -4.6, pz1 = 2.4, py = 6.45;
      for (const [x, z] of [[px0, pz0], [px1, pz0], [px0, pz1], [px1, pz1]]) {
        addBox(0.13, py - DECK, 0.13, x, (py + DECK) / 2, z, M.bronze, { uv: 0.5 });
      }
      addBox(px1 - px0 + 0.5, 0.24, 0.16, (px0 + px1) / 2, py + 0.09, pz0, M.cedar, { uv: 0.6 });
      addBox(px1 - px0 + 0.5, 0.24, 0.16, (px0 + px1) / 2, py + 0.09, pz1, M.cedar, { uv: 0.6 });
      for (let x = px0 + 0.24; x <= px1 - 0.18; x += 0.23) {
        addBox(0.07, 0.14, pz1 - pz0 - 0.1, x, py + 0.22, (pz0 + pz1) / 2, M.cedarVert, { uv: 0.7 });
      }
      // a daybed and two planters, so the deck reads as a room
      const daybed = (x, z) => {
        addBox(1.8, 0.12, 0.9, x, DECK + 0.32, z, M.oakDark, { uv: 0.6 });
        for (const dx of [-0.78, 0.78]) {
          for (const dz of [-0.36, 0.36]) addBox(0.06, 0.3, 0.06, x + dx, DECK + 0.15, z + dz, M.bronze, { uv: 0.5 });
        }
        addBox(1.7, 0.16, 0.82, x, DECK + 0.46, z, M.linenA, { uv: 0.6 });
        addBox(0.42, 0.16, 0.4, x - 0.55, DECK + 0.58, z, M.linenB, { uv: 0.6 });
      };
      daybed(9.2, 1.5); daybed(9.2, 0.1);
      addBox(0.7, 0.5, 0.7, 5.2, DECK + 0.25, 2.6, M.stonePale, { uv: 0.5 });
      addBox(0.7, 0.5, 0.7, 5.2, DECK + 0.25, -5.2, M.stonePale, { uv: 0.5 });
      addBox(6.0, 0.6, 0.4, 13.0, DECK + 0.3, -5.6, M.stone, { uv: 0.4 });
    }

    /* ── timber slat screen along the wing ──────────────────────────────── */
    {
      const slatGeo = new THREE.BoxGeometry(0.045, 1, 0.12);
      const count = LOWRAM ? 32 : (MOBILE ? 78 : 118);
      const slatMat = new THREE.MeshStandardMaterial({
        map: texV(oakWood.map, [1, 0.4]),
        normalMap: texV(oakWood.normal, [1, 0.4]),
        color: 0xa08a6c, roughness: 0.72, metalness: 0, envMapIntensity: 0.5
      });
      const inst = new THREE.InstancedMesh(slatGeo, slatMat, count);
      inst.castShadow = true; inst.receiveShadow = true;
      const d = new THREE.Object3D();
      let i = 0;
      const front = Math.round(count * 0.66);
      for (; i < front; i++) {
        d.position.set(lerp(WING.x0 + 4.4, WING.x1 - 0.25, i / (front - 1)), 1.58, WING.z1 + 0.17);
        d.scale.set(1, 3.16, 1); d.rotation.set(0, 0, 0);
        d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
      }
      for (; i < count; i++) {
        d.position.set(WING.x1 + 0.17, 1.58, lerp(WING.z0 + 0.35, WING.z1 - 0.35, (i - front) / (count - front - 1)));
        d.scale.set(1, 3.16, 1); d.rotation.set(0, Math.PI / 2, 0);
        d.updateMatrix(); inst.setMatrixAt(i, d.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      world.add(inst);
    }

    /* ── exterior lighting: sconces, step lights ─────────────────────────── */
    function sconce(x, y, z, axis = 'z', sign = 1) {
      const w = axis === 'z' ? 0.17 : 0.05;
      const d = axis === 'z' ? 0.05 : 0.17;
      addBox(w, 0.36, d, x, y, z, M.bronze, { uv: 0.5 });
      const ox = axis === 'z' ? 0 : sign * 0.075;
      const oz = axis === 'z' ? sign * 0.075 : 0;
      addBox(0.13, 0.22, 0.13, x + ox, y, z + oz, M.bronze, { uv: 0.5 });
      addBox(0.1, 0.06, 0.1, x + ox, y - 0.13, z + oz, warmLamp, { cast: false, receive: false });
      const glowMat = M.glow.clone();
      glowMat.opacity = 0.3;
      const q = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.9), glowMat);
      if (axis === 'z') q.position.set(x + ox, y + 0.05, z + sign * 0.11);
      else { q.rotation.y = Math.PI / 2; q.position.set(x + sign * 0.11, y + 0.05, z + oz); }
      q.renderOrder = 4;
      world.add(q);
    }
    sconce(-2.6, 2.6, G.z1 + 0.14, 'z', 1);
    sconce(2.6, 2.6, G.z1 + 0.14, 'z', 1);
    sconce(-6.8, 2.7, G.z0 - 0.28, 'z', -1);
    sconce(3.0, 2.7, G.z0 - 0.28, 'z', -1);
    sconce(-13.0, 2.7, G.z0 - 0.28, 'z', -1);
    for (const [lx, ly, lz, li] of [[-2.6, 2.55, G.z1 + 0.5, MOBILE ? 2.5 : 4.2],
                                     [-6.8, 2.6, G.z0 - 0.6, MOBILE ? 2.2 : 3.6]]) {
      const pl = new THREE.PointLight(0xffb877, li, 6.5, 2);
      pl.position.set(lx, ly, lz);
      scene.add(pl);
    }

    // recessed step lights in the pool coping face
    for (const sx of [-2.4, 0.6, 3.6, 6.6]) {
      addBox(0.16, 0.05, 0.02, sx, -0.22, POOL.z1 + pw + 0.005, warmLamp, { cast: false, receive: false });
    }

    /* ── the pergola over the terrace ───────────────────────────────────── */
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

    /* ── the way in: a solid stone apron under the porch, a nosing at its
       edge, and a bronze threshold that is the only thing crossing the door
       line. It used to be a zero-thickness plane laid over the plinth and
       through the step, which is what flickered as the camera crossed the
       threshold: three surfaces inside 30 mm of each other. Now each level has
       one slab and one height, and nothing is coplanar.                     */
    {
      const zA = G.z1 + 0.02, zB = PORCH.z1 + 0.62;      // 6.62 → 9.02
      addBox(9.2, 0.06, zB - zA, 0, 0.03, (zA + zB) / 2, M.stonePale, { uv: 0.5 });
      // the nosing: one riser, 15 mm below the apron, so the step reads
      addBox(9.22, 0.045, 0.26, 0, 0.0225, zB + 0.13, M.stonePale, { uv: 0.5, cast: false });
      // the threshold inlay: 18 mm proud of the apron, 30 mm deep
      addBox(2.9, 0.018, 0.3, 0, 0.069, G.z1 + 0.05, M.bronze, { uv: 0.6, cast: false });
      for (const x of [-4.2, 4.2]) addBox(0.14, 0.05, 0.14, x, 0.085, zB + 0.02, M.bronze, { cast: false });

      /* the mat: charcoal coir, 1.45 × 0.78 m, 60 mm clear of the bronze
         inlay and 6 mm proud of the apron, on its own baked soft shadow, so
         it never floats and never fights the slab it sits on */
      {
        const dm = makeDoormat();
        const matMat = new THREE.MeshStandardMaterial({
          map: tex(dm.map, { srgb: true }),
          normalMap: tex(dm.normal),
          roughness: 0.96, metalness: 0.0,
          normalScale: new THREE.Vector2(0.55, 0.55),
          envMapIntensity: 0.22
        });
        const mw = 1.45, md = 0.78, mz = G.z1 + 0.24 + md / 2;
        const matGeo = new THREE.BoxGeometry(mw, 0.016, md);
        matGeo.translate(0, 0.066, mz);
        const matMesh = new THREE.Mesh(matGeo, matMat);
        matMesh.receiveShadow = true;
        matMesh.castShadow = false;
        world.add(matMesh);
        contactShadow(0, mz, mw + 0.18, md + 0.18, true, 0.061);
      }
    }

    /* ── teak loungers by the pool ──────────────────────────────────────── */
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
      for (let i = 0; i < 5; i++) {
        addBox(0.075, 0.035, sz, x - sx / 2 + 0.1 + i * 0.16, 0.36 + i * 0.12, z, M.oak, { uv: 0.7 });
      }
      addBox(0.44, 0.1, 0.5, x + sx / 2 - 0.4, 0.41, z, M.linenA, { uv: 0.6 });
    }
    lounger(5.3, -8.55);
    lounger(7.6, -8.55);
    contactShadow(5.3, -8.55, 2.6, 1.15, true, 0.018);
    contactShadow(7.6, -8.55, 2.6, 1.15, true, 0.018);
    contactShadow(6.45, -8.55, 0.82, 0.82, true, 0.018);
    addBox(0.46, 0.34, 0.46, 6.45, 0.17, -8.55, M.stonePale, { uv: 0.5 });
    addBox(0.5, 0.05, 0.5, 6.45, 0.36, -8.55, M.stonePale, { uv: 0.5 });

    /* ── the parking court: a cantilevered carport beside the drive ───────
       Two bays on a paved apron east of the drive's last bend, under a thin
       travertine slab that cantilevers off two bronze columns at its rear
       edge. Bronze louver fins under the slab, recessed warm downlights in
       it, pale kerbs at the bay heads. Everything rides the house's own
       materials, so the whole court costs no extra draw call.              */
    {
      const CX = 9.6, CZ = 14.5, CW = 6.6, CD = 5.6;
      /* the arrival court in front of the house: one field of limestone from
         the porch step to the gate line, so the walk, the carport link and the
         door all stand in stone rather than in meadow grass */
      addPlane(12.5, 16.2, 0.85, 0.036, 17.1, M.pave, { uv: 0.5 });
      addPlane(13.1, 16.8, 0.85, 0.026, 17.1, M.gravel, { uv: 0.5 });

      /* the way in to the court: a stone apron from the walk to the bay heads,
         and a driveway spur that runs from the pad out through the gate, so the
         parking court reads as connected to the street rather than dropped on
         the lawn */
      addPlane(4.5, 5.4, 4.55, 0.044, CZ, M.pave, { uv: 0.5 });          // walk → bay heads
      addPlane(3.9, 8.3, 7.95, 0.046, 21.1, M.pave, { uv: 0.5 });        // pad → gate → street
      addPlane(4.9, 5.8, 4.55, 0.037, CZ, M.gravel, { uv: 0.5 });        // its gravel shoulder
      addPlane(4.3, 8.7, 7.95, 0.037, 21.1, M.gravel, { uv: 0.5 });
      // paved apron with a pale border, on the lawn between drive and wall
      addPlane(CW + 0.9, CD + 0.9, CX, 0.045, CZ, M.gravel, { uv: 0.5 });
      addPlane(CW, CD, CX, 0.075, CZ, M.pave, { uv: 0.5 });
      // crisp bronze border strips
      addBox(CW + 0.12, 0.05, 0.09, CX, 0.095, CZ - CD / 2 - 0.03, M.bronze, { cast: false });
      addBox(CW + 0.12, 0.05, 0.09, CX, 0.095, CZ + CD / 2 + 0.03, M.bronze, { cast: false });
      addBox(0.09, 0.05, CD + 0.12, CX - CW / 2 - 0.03, 0.095, CZ, M.bronze, { cast: false });
      addBox(0.09, 0.05, CD + 0.12, CX + CW / 2 + 0.03, 0.095, CZ, M.bronze, { cast: false });
      // the centre line and the two bay marks
      addBox(0.08, 0.012, CD - 0.6, CX, 0.088, CZ, M.line, { cast: false });
      addBox(0.08, 0.012, CD - 0.6, CX - CW / 4, 0.088, CZ, M.line, { cast: false });
      addBox(0.08, 0.012, CD - 0.6, CX + CW / 4, 0.088, CZ, M.line, { cast: false });
      // wheel-stop kerbs at the north bay heads
      for (const kx of [CX - CW / 4, CX + CW / 4]) {
        addBox(1.7, 0.13, 0.16, kx, 0.145, CZ - CD / 2 + 0.35, M.stonePale, { uv: 0.5 });
      }
      // two bronze columns at the south edge, the slab cantilevers north
      for (const cxx of [CX - CW / 2 + 0.55, CX + CW / 2 - 0.55]) {
        addBox(0.17, 2.9, 0.17, cxx, 1.45, CZ + CD / 2 - 0.35, M.bronze, { uv: 0.5 });
        contactShadow(cxx, CZ + CD / 2 - 0.35, 0.8, 0.8, true, 0.05);
      }
      // the slab, its fascia, and the louver fins under it
      addBox(CW + 0.8, 0.16, CD + 0.6, CX, 3.02, CZ, M.stonePale, { uv: 0.42 });
      addBox(CW + 0.86, 0.07, CD + 0.66, CX, 2.90, CZ, M.bronze, { cast: false });
      for (let zz = CZ - CD / 2 + 0.35; zz <= CZ + CD / 2 - 0.3; zz += 0.16) {
        addBox(CW + 0.4, 0.045, 0.07, CX, 2.80, zz, M.bronze, { cast: false });
      }
      // recessed warm downlights in the soffit
      for (const lx of [CX - CW / 4, CX + CW / 4]) {
        addBox(0.14, 0.02, 0.14, lx, 2.925, CZ - 0.6, warmLamp, { cast: false, receive: false });
      }
      const carGlow = M.glow.clone();
      carGlow.opacity = 0.14;
      const cg = new THREE.PlaneGeometry(CW, CD);
      cg.rotateX(-Math.PI / 2);
      cg.translate(CX, 2.88, CZ);
      queue(cg, carGlow, false, false, 4);
      contactShadow(CX, CZ, CW + 1, CD + 1, true, 0.03);

      /* ── the car: a dark luxury SUV, nose to the gate, in the west bay.
         Same bevelled volumes as the interior furniture: a low body, a
         shoulder, a shorter glasshouse with tilted screens and a bonnet that
         steps down at the nose, four wheels with machined rims and a dark
         arch ring at each corner, so the wheel openings read as cut rather
         than as wheels sunk into a box. */
      {
        const BX = CX - CW / 4, BZ = CZ + 0.1, Y0 = 0.075;
        const paint = new THREE.MeshPhysicalMaterial({
          color: 0x14171b, metalness: 0.28, roughness: 0.44,
          clearcoat: 0.6, clearcoatRoughness: 0.16, envMapIntensity: 0.45
        });
        const carGlass = new THREE.MeshStandardMaterial({
          color: 0x0a1015, metalness: 0.12, roughness: 0.20, envMapIntensity: 0.5
        });
        const tyre = new THREE.MeshStandardMaterial({ color: 0x0c0d0e, roughness: 0.96, metalness: 0.0, envMapIntensity: 0.25 });
        const rimM = new THREE.MeshStandardMaterial({ color: 0x8d949b, roughness: 0.30, metalness: 0.92, envMapIntensity: 1.15 });
        const trimM = new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.62, metalness: 0.35, envMapIntensity: 0.7 });
        const lampF = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.35, 2.1) });
        const lampR = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 0.24, 0.16) });
        const add = (geo, mat, cast = true, recv = true) => {
          geo.translate(BX, Y0, BZ);
          queue(geo, mat, cast, recv);
        };

        // the body: a low sill, the main volume, a shoulder above it
        let g = roundedBoxGeo(1.86, 0.56, 4.52, 0.15); g.translate(0, 0.56, 0); add(g, paint);
        g = roundedBoxGeo(1.96, 0.44, 4.74, 0.17); g.translate(0, 0.92, 0); add(g, paint);
        g = roundedBoxGeo(1.90, 0.20, 4.48, 0.10); g.translate(0, 1.18, -0.04); add(g, paint);
        // the bonnet steps down ahead of the screen
        g = roundedBoxGeo(1.86, 0.22, 1.10, 0.10); g.translate(0, 1.08, 1.78); add(g, paint);
        // the glasshouse, shorter than the body, and its roof
        g = roundedBoxGeo(1.68, 0.42, 2.50, 0.11); g.translate(0, 1.44, -0.28); add(g, carGlass);
        g = roundedBoxGeo(1.66, 0.10, 2.28, 0.05); g.translate(0, 1.66, -0.32); add(g, paint);
        // the screens, tilted: the rounded corner alone reads as a van
        g = new THREE.BoxGeometry(1.56, 0.54, 0.035); g.rotateX(-0.52); g.translate(0, 1.45, 1.05); add(g, carGlass, false);
        g = new THREE.BoxGeometry(1.54, 0.48, 0.035); g.rotateX(0.44); g.translate(0, 1.47, -1.55); add(g, carGlass, false);
        // side glass, a touch proud of the pillars so it reads as a window
        for (const sx of [-1, 1]) {
          g = roundedBoxGeo(0.03, 0.34, 2.18, 0.02); g.translate(sx * 0.845, 1.44, -0.28); add(g, carGlass, false);
        }
        // sills and the arch rings that make the wheel openings read
        for (const sx of [-1, 1]) {
          g = roundedBoxGeo(0.11, 0.15, 3.20, 0.04); g.translate(sx * 0.95, 0.31, 0); add(g, trimM);
          for (const wz of [-1.52, 1.52]) {
            g = new THREE.TorusGeometry(0.47, 0.06, 8, 22); g.rotateY(Math.PI / 2);
            g.translate(sx * 0.955, 0.40, wz); add(g, trimM, false);
          }
        }
        // wheels: tyre, a machined rim, a dark hub and five spokes
        for (const sx of [-1, 1]) {
          for (const wz of [-1.52, 1.52]) {
            g = new THREE.CylinderGeometry(0.385, 0.385, 0.28, 26); g.rotateZ(Math.PI / 2);
            g.translate(sx * 0.875, 0.385, wz); add(g, tyre);
            g = new THREE.CylinderGeometry(0.25, 0.25, 0.29, 22); g.rotateZ(Math.PI / 2);
            g.translate(sx * 0.878, 0.385, wz); add(g, rimM, false);
            g = new THREE.CylinderGeometry(0.07, 0.07, 0.30, 12); g.rotateZ(Math.PI / 2);
            g.translate(sx * 0.88, 0.385, wz); add(g, trimM, false);
            for (let s2 = 0; s2 < 5; s2++) {
              const a = s2 * Math.PI * 2 / 5;
              g = new THREE.BoxGeometry(0.31, 0.34, 0.06); g.rotateX(a);
              g.translate(sx * 0.885, 0.385 + Math.cos(a) * 0.10, wz + Math.sin(a) * 0.10); add(g, rimM, false);
            }
          }
        }
        // the front: a low bumper, the grille with thin blades, a lamp each side
        g = roundedBoxGeo(1.92, 0.30, 0.20, 0.07); g.translate(0, 0.52, 2.34); add(g, trimM, false);
        g = roundedBoxGeo(1.16, 0.22, 0.08, 0.03); g.translate(0, 0.88, 2.36); add(g, trimM, false);
        for (let i = 0; i < 7; i++) {
          g = new THREE.BoxGeometry(0.032, 0.18, 0.03); g.translate(-0.45 + i * 0.15, 0.88, 2.39); add(g, paint, false, false);
        }
        for (const sx of [-1, 1]) {
          g = roundedBoxGeo(0.46, 0.085, 0.06, 0.025); g.translate(sx * 0.62, 1.06, 2.37); add(g, lampF, false, false);
          g = roundedBoxGeo(0.54, 0.16, 0.05, 0.02); g.translate(sx * 0.62, 1.06, 2.33); add(g, trimM, false);
          g = roundedBoxGeo(0.18, 0.13, 0.05, 0.02); g.translate(sx * 0.88, 0.62, 2.38); add(g, trimM, false);
        }
        // the rear: a full-width light bar and a diffuser
        g = roundedBoxGeo(1.58, 0.075, 0.05, 0.02); g.translate(0, 1.10, -2.37); add(g, lampR, false, false);
        g = roundedBoxGeo(1.88, 0.26, 0.20, 0.06); g.translate(0, 0.50, -2.32); add(g, trimM, false);
        // mirrors on short arms, and roof rails
        for (const sx of [-1, 1]) {
          g = roundedBoxGeo(0.20, 0.10, 0.13, 0.035); g.translate(sx * 1.00, 1.34, 0.72); add(g, paint);
          g = roundedBoxGeo(0.06, 0.05, 1.90, 0.02); g.translate(sx * 0.70, 1.72, -0.32); add(g, trimM, false);
        }
        contactShadow(BX, BZ + 0.05, 5.5, 2.5, true, 0.079);
      }
    }

    /* ── the wellness pavilion west of the pool ──────────────────────────
       One low glass-and-travertine volume: the west half a cedar-slatted
       sauna with an amber interior glow, the east half a glass-walled gym
       with dark-bronze equipment silhouettes. A stone slab roof, a pale
       apron, and stepping stones back to the terrace.                      */
    {
      const PX = -11.4, PZ = -11.9, PW = 5.4, PD = 3.8, PH = 2.75;
      addPlane(PW + 1.3, PD + 1.5, PX, 0.04, PZ, M.pave, { uv: 0.5 });
      addPlane(PW + 1.34, PD + 1.54, PX, 0.022, PZ, M.gravel, { uv: 0.5 });
      // travertine end walls, glazed long sides, slab roof on a bronze reveal
      addWall({ axis: 'z', at: PX - PW / 2, from: PZ - PD / 2, to: PZ + PD / 2, y0: 0.06, y1: PH, thick: 0.22, mat: M.stone, uv: 0.45 });
      addWall({ axis: 'z', at: PX + PW / 2, from: PZ - PD / 2, to: PZ + PD / 2, y0: 0.06, y1: PH, thick: 0.22, mat: M.stone, uv: 0.45 });
      // the dividing pier between sauna and gym
      addBox(0.24, PH, 0.24, PX, PH / 2, PZ - PD / 2 + 0.3, M.stone, { uv: 0.45 });
      addBox(0.24, PH, 0.24, PX, PH / 2, PZ + PD / 2 - 0.3, M.stone, { uv: 0.45 });
      // glazed sides, bronze frames, on both long faces
      for (const sgn of [-1, 1]) {
        const zz = PZ + sgn * PD / 2;
        const g = new THREE.Mesh(new THREE.PlaneGeometry(PW - 0.5, PH - 0.35), M.glass);
        g.position.set(PX, (0.06 + PH) / 2 + 0.08, zz);
        g.renderOrder = 3;
        world.add(g);
        addBox(PW - 0.5, 0.07, 0.12, PX, PH - 0.05, zz, M.bronze, { uv: 0.5 });
        addBox(PW - 0.5, 0.07, 0.12, PX, 0.10, zz, M.bronze, { uv: 0.5 });
        for (const fx of [PX - (PW - 0.5) / 2, PX, PX + (PW - 0.5) / 2]) {
          addBox(0.07, PH - 0.2, 0.10, fx, (PH + 0.1) / 2, zz, M.bronze, { uv: 0.5 });
        }
      }
      addBox(PW + 0.5, 0.14, PD + 0.5, PX, PH + 0.07, PZ, M.stonePale, { uv: 0.42 });
      addBox(PW + 0.56, 0.05, PD + 0.56, PX, PH - 0.02, PZ, M.bronze, { cast: false });

      // the sauna half: cedar slats inside the west cell, an amber glow
      {
        const sx = PX - PW / 4;
        for (let zz = PZ - PD / 2 + 0.45; zz <= PZ + PD / 2 - 0.35; zz += 0.13) {
          addBox(PW / 2 - 0.5, PH - 0.4, 0.05, sx, (PH + 0.1) / 2, zz, M.oakVert, { uv: 0.7, cast: false });
        }
        // the bench tier
        addBox(PW / 2 - 0.6, 0.09, 0.55, sx - 0.35, 0.62, PZ, M.oakDark, { uv: 0.6 });
        addBox(PW / 2 - 0.6, 0.09, 0.55, sx - 0.35, 1.06, PZ, M.oakDark, { uv: 0.6 });
        for (const bz of [PZ - 0.24, PZ + 0.24]) {
          addBox(0.06, 0.62, 0.06, sx - 0.9, 0.31, bz, M.bronze, { cast: false });
        }
        addBox(0.30, 0.02, 0.30, sx + 0.6, PH - 0.30, PZ, warmLamp, { cast: false, receive: false });
        const sg = M.glow.clone();
        sg.opacity = 0.30;
        const sq = new THREE.PlaneGeometry(PW / 2, PD);
        sq.rotateX(-Math.PI / 2);
        sq.translate(sx, PH - 0.16, PZ);
        queue(sq, sg, false, false, 4);
      }
      // the gym half: rack, bench and treadmill as bronze/dark silhouettes
      {
        const gx = PX + PW / 4;
        // the rack: two uprights and a pull-up bar
        for (const rx of [gx - 0.85, gx + 0.85]) {
          addBox(0.07, 1.72, 0.07, rx, 0.92, PZ - PD / 2 + 0.45, M.bronze, { uv: 0.5 });
        }
        addBox(1.78, 0.06, 0.06, gx, 1.80, PZ - PD / 2 + 0.45, M.bronze, { cast: false });
        for (const ry of [0.78, 1.16]) {
          addBox(1.7, 0.045, 0.045, gx, ry, PZ - PD / 2 + 0.45, M.bronze, { cast: false });
        }
        // the bench
        addSoft(1.30, 0.20, 0.34, 0.05, gx + 0.15, 0.48, PZ + 0.55, M.oakDark, { uv: 0.6 });
        for (const [bx2, bz2] of [[-0.55, -0.12], [0.55, -0.12], [-0.55, 0.12], [0.55, 0.12]]) {
          addBox(0.05, 0.38, 0.05, gx + 0.15 + bx2, 0.19, PZ + 0.55 + bz2, M.bronze, { cast: false });
        }
        // the treadmill
        addBox(1.55, 0.10, 0.62, gx - 0.15, 0.16, PZ + 1.25, M.dark, { uv: 0.5 });
        addBox(1.45, 0.015, 0.5, gx - 0.15, 0.225, PZ + 1.25, M.dark, { cast: false });
        addBox(0.05, 0.95, 0.05, gx - 0.75, 0.62, PZ + 1.55, M.bronze, { cast: false });
        addBox(0.05, 0.95, 0.05, gx + 0.45, 0.62, PZ + 1.55, M.bronze, { cast: false });
        addBox(0.05, 0.05, 0.62, gx - 0.15, 1.10, PZ + 1.55, M.bronze, { cast: false });
      }
      contactShadow(PX, PZ, PW + 1.2, PD + 1.2, true, 0.03);

      // stepping stones from the terrace's west end to the pavilion door
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        addBox(0.58, 0.07, 0.44,
          lerp(-7.6, PX + PW / 2 - 0.2, t) + rr(-0.15, 0.15),
          0.05,
          lerp(-8.4, PZ + PD / 2 + 0.75, t) + rr(-0.12, 0.12),
          M.stonePale, { uv: 0.5 });
      }
    }

    /* ── the landscape garden along the west lawn ─────────────────────────
       Low clipped hedges framing gravel beds, ornamental grass tufts already
       in the lawn, and a stepping-stone spur off the pavilion path. All of it
       under the orbit's low west pass, so nothing new is flown through.    */
    {
      /*  A clipped hedge, built from the Quixel Japanese Privet leaf atlas: a
          dark core so no light shows through the run, and instanced 0.5 m leaf
          cards on both faces and the crown, each at its own angle. Three runs
          are three draw calls and about 140 cards, which is cheaper than the
          painted box it replaces and looks like a hedge instead of a slab. */
      const hedgeMat = windify(new THREE.MeshStandardMaterial({
        map: loadAtlas('hedge_privet.webp'), alphaTest: 0.42, side: THREE.DoubleSide,
        roughness: 0.94, metalness: 0.0, envMapIntensity: 0.45, color: 0xe2e8d2
      }), { amp: 0.018, freq: 1.3, height: 0.8, base: -0.2, soft: 0.55,
        fill: [0.095, 0.125, 0.062], trans: 0.22 });
      const hedgeCore = new THREE.MeshStandardMaterial({ color: 0x2b3720, roughness: 1.0, envMapIntensity: 0.12 });
      const cardGeo = new THREE.PlaneGeometry(1, 1);
      const hd = new THREE.Object3D();
      const hcol = new THREE.Color();
      function hedgeRun(x0, z0, x1, z1, h = 0.54, w = 0.46) {
        const dx = x1 - x0, dz = z1 - z0;
        const len = Math.hypot(dx, dz);
        const ang = Math.atan2(dz, dx);
        const core = new THREE.BoxGeometry(len, h * 0.88, w * 0.62);
        core.rotateY(-ang);
        core.translate((x0 + x1) / 2, h * 0.44, (z0 + z1) / 2);
        const cm = new THREE.Mesh(core, hedgeCore);
        cm.castShadow = cm.receiveShadow = true;
        world.add(cm);
        const nx = Math.sin(ang), nz = -Math.cos(ang);      // normal to the run
        const mats = [], cols = [];
        const card = (u, y, across, face) => {
          const px = x0 + dx * u, pz = z0 + dz * u;
          hd.position.set(px + nx * across, y, pz + nz * across);
          if (face === 'side') hd.rotation.set(0, -ang + Math.PI / 2 + rr(-0.35, 0.35), rr(-0.22, 0.22));
          else hd.rotation.set(-Math.PI / 2 + rr(-0.28, 0.28), rr(0, 6.283), 0);
          const s = rr(0.44, 0.64) * (h / 0.54);
          hd.scale.set(s, s, s);
          hd.updateMatrix();
          mats.push(hd.matrix.clone());
          const v = rr(0.78, 1.0);
          hcol.setRGB(v * 0.94, v, v * 0.78);
          cols.push(hcol.clone());
        };
        const n = Math.max(5, Math.round(len / 0.19));
        for (let i = 0; i <= n; i++) {
          const u = i / n;
          for (const sgn of [-1, 1]) {
            card(u, rr(h * 0.18, h * 0.60), sgn * w * 0.46, 'side');
            card(u, rr(h * 0.54, h * 0.92), sgn * w * 0.30, 'side');
          }
          card(u, h * rr(0.94, 1.03), rr(-w * 0.24, w * 0.24), 'top');
        }
        const mesh = new THREE.InstancedMesh(cardGeo, hedgeMat, mats.length);
        mats.forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, cols[i]); });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        world.add(mesh);
      }
      // two hedge runs framing the west lawn
      hedgeRun(-17.4, -4.6, -13.0, -4.6);
      hedgeRun(-17.4, -2.6, -13.0, -2.6);
      hedgeRun(-17.2, -7.2, -17.2, -3.6);
      // a bronze-trimmed gravel bed between them, with three stone orbs
      addPlane(3.9, 2.3, -15.2, 0.035, -3.6, M.gravel, { uv: 0.5 });
      addBox(4.0, 0.05, 0.07, -15.2, 0.075, -4.78, M.bronze, { cast: false });
      addBox(4.0, 0.05, 0.07, -15.2, 0.075, -2.42, M.bronze, { cast: false });
      for (const [ox, oz, orr] of [[-16.1, -3.1, 0.26], [-15.0, -4.1, 0.33], [-14.2, -3.3, 0.22]]) {
        megaVessel(ox > -15 ? 'sandstone' : 'rock_formation',
          [[0.001, 0], [orr * 0.9, 0.02], [orr, orr * 0.72], [orr * 0.94, orr * 1.28], [0.05, orr * 1.5]],
          ox, 0.05, oz, M.stoneVessel, 18, { hScale: 1.5 });
      }
      // a second, smaller bed nearer the house's west corner
      addPlane(2.6, 1.8, -16.0, 0.035, -8.2, M.gravel, { uv: 0.5 });
      hedgeRun(-17.4, -9.3, -17.4, -7.1, 0.48, 0.44);
      megaVessel('boulder', [[0.001, 0], [0.2, 0.02], [0.26, 0.2], [0.2, 0.34]], -15.4, 0.05, -8.2, M.stoneVessel, 16, { hScale: 1.5 });
    }

    /* ── the children's court in the east side yard ───────────────────────
       Soft sand inside a limestone curb, a cedar swing frame on bronze
       pivots, and a low climbing frame with a slide. Every timber here is the
       scanned Quixel cedar on the villa's soffits and the bronze is the gate's
       own, so the court belongs to the house; scanned boulders, a Quixel
       timber bench and ground cover finish its edges.                     */
    {
      const CX2 = 22.2, CZ2 = 1.2, CW2 = 7.0, CD2 = 8.4;
      addPlane(CW2 + 1.0, CD2 + 1.0, CX2, 0.032, CZ2, M.gravel, { uv: 0.5 });
      // soft sand turf for the court: the dune sand's own surface, kept pale
      const courtSand = new THREE.MeshStandardMaterial({
        map: tex(sand.map, { srgb: true }),
        normalMap: tex(sand.normal),
        color: 0xe8ddc4, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.5
      });
      addPlane(CW2, CD2, CX2, 0.058, CZ2, courtSand, { uv: 0.55 });
      // the limestone curb: one block course all round, 180 wide, 120 high
      addBox(CW2 + 0.36, 0.12, 0.18, CX2, 0.075, CZ2 - CD2 / 2 - 0.09, M.stonePale, { uv: 0.5 });
      addBox(CW2 + 0.36, 0.12, 0.18, CX2, 0.075, CZ2 + CD2 / 2 + 0.09, M.stonePale, { uv: 0.5 });
      addBox(0.18, 0.12, CD2 + 0.36, CX2 - CW2 / 2 - 0.09, 0.075, CZ2, M.stonePale, { uv: 0.5 });
      addBox(0.18, 0.12, CD2 + 0.36, CX2 + CW2 / 2 + 0.09, 0.075, CZ2, M.stonePale, { uv: 0.5 });

      // the swing frame: two cedar A-frames, a cedar beam, two swings on bronze
      {
        const sx = CX2 - 1.4, sz = CZ2 - 1.6;
        for (const s2 of [-1, 1]) {
          addSoft(0.12, 2.0, 0.12, 0.02, sx + s2 * 0.85, 1.0, sz - 0.5, M.cedarVert, { uv: 0.6, rz: s2 * -0.24 });
          addSoft(0.12, 2.0, 0.12, 0.02, sx + s2 * 0.85, 1.0, sz + 0.5, M.cedarVert, { uv: 0.6, rz: s2 * -0.24 });
          contactShadow(sx + s2 * 0.85, sz, 1.6, 1.4, true, 0.045);
        }
        addBox(2.5, 0.13, 0.13, sx, 2.02, sz, M.cedar, { uv: 0.6 });
        for (const sw of [-0.55, 0.55]) {
          for (const dz of [-0.05, 0.05]) {
            addBox(0.02, 1.32, 0.02, sx + sw, 1.36, sz + dz, M.bronze, { cast: false });
          }
          addSoft(0.42, 0.055, 0.19, 0.02, sx + sw, 0.70, sz, M.oak, { uv: 0.6 });
        }
      }
      // the play fort: four cedar posts, a deck with guard rails, a hipped
      // cedar roof and a slide landing on the sand. The rails and the roof are
      // what make it read as a playhouse rather than a table.
      {
        const cx2 = CX2 + 1.7, cz2 = CZ2 + 1.9, DY = 1.12;
        for (const [dx, dz] of [[-0.68, -0.60], [0.68, -0.60], [-0.68, 0.60], [0.68, 0.60]]) {
          addBox(0.11, DY, 0.11, cx2 + dx, DY / 2, cz2 + dz, M.cedarVert, { uv: 0.6 });
        }
        addBox(1.56, 0.10, 1.40, cx2, DY + 0.05, cz2, M.cedar, { uv: 0.6 });
        // guard rails on three sides, a gap on the slide side
        for (const s2 of [-1, 1]) {
          addBox(0.05, 0.05, 1.30, cx2 + s2 * 0.72, DY + 0.62, cz2, M.cedar, { cast: false });
          addBox(0.05, 0.05, 1.30, cx2 + s2 * 0.72, DY + 0.34, cz2, M.cedar, { cast: false });
          for (const dz of [-0.58, 0, 0.58]) addBox(0.05, 0.62, 0.05, cx2 + s2 * 0.72, DY + 0.45, cz2 + dz, M.cedar, { cast: false });
        }
        addBox(1.40, 0.05, 0.05, cx2, DY + 0.62, cz2 - 0.66, M.cedar, { cast: false });
        addBox(1.40, 0.05, 0.05, cx2, DY + 0.34, cz2 - 0.66, M.cedar, { cast: false });
        // the hipped roof: four cedar planes over the deck, a bronze finial
        const apex = DY + 1.62, ey = DY + 1.02, rw = 1.02, rd = 0.94;
        for (let q = 0; q < 4; q++) {
          const a0 = q * Math.PI / 2 + Math.PI / 4, a1 = a0 + Math.PI / 2;
          const p0 = [cx2 + Math.cos(a0) * rw, ey, cz2 + Math.sin(a0) * rd];
          const p1 = [cx2 + Math.cos(a1) * rw, ey, cz2 + Math.sin(a1) * rd];
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute([
            p0[0], ey, p0[2], p1[0], ey, p1[2], cx2, apex - 0.02, cz2,
            cx2, apex - 0.02, cz2, p1[0], ey, p1[2], p0[0], ey, p0[2]
          ], 3));
          g.computeVertexNormals();
          queue(g, M.cedar, false, true);
        }
        // bronze rungs up the south face, under the deck
        for (let ry = 0.26; ry <= DY - 0.14; ry += 0.22) {
          addBox(1.05, 0.04, 0.04, cx2, ry, cz2 + 0.66, M.bronze, { cast: false });
        }
        // the slide: an angled cedar deck with bronze rails, landing on the sand
        addSoft(0.60, 0.07, 2.05, 0.02, cx2 - 0.02, 0.72, cz2 + 1.80, M.cedar, { uv: 0.6, rx: 0.54 });
        for (const s2 of [-1, 1]) {
          addSoft(0.04, 0.05, 1.95, 0.015, cx2 - 0.02 + s2 * 0.30, 0.90, cz2 + 1.80, M.bronze, { cast: false, rx: 0.54 });
        }
        contactShadow(cx2, cz2, 2.9, 3.6, true, 0.045);
      }
      // a low bronze hoop on the court's east edge, standing on a cedar post
      {
        addBox(0.09, 1.55, 0.09, CX2 + CW2 / 2 - 0.6, 0.78, CZ2 - 2.4, M.cedarVert, { uv: 0.6 });
        const hoop = new THREE.TorusGeometry(0.36, 0.028, 8, 20);
        hoop.rotateY(Math.PI / 2);
        hoop.translate(CX2 + CW2 / 2 - 0.6 + 0.38, 1.58, CZ2 - 2.4);
        queue(hoop, M.bronze, true, false);
      }
      // a cedar balance log on two bronze saddles, along the north kerb
      {
        const lx = CX2 - 0.4, lz = CZ2 + CD2 / 2 - 0.55;
        const log = new THREE.CylinderGeometry(0.13, 0.14, 2.6, 14);
        log.rotateZ(Math.PI / 2);
        log.translate(lx, 0.26, lz);
        queue(log, M.cedar, true, true);
        for (const dx of [-0.9, 0.9]) addBox(0.16, 0.14, 0.30, lx + dx, 0.07, lz, M.bronze, { cast: false });
        contactShadow(lx, lz, 2.9, 0.6, true, 0.052);
      }
    }

    /* ─────────────────────────────────────────────────────────────────────
       6b · the estate wall and the terrace planters
       A travertine boundary round the compound: a plinth, a warm ashlar panel
       with recessed bronze louver bays, stepped piers and a crisp pale coping
       on the three sides the eye comes in over, and a low, open-topped wall at
       the rear so the pool terrace keeps its skyline. One gate opening where
       the drive crosses it, framed by two stone piers with a warm light slot.

       Everything is batched into the house's own materials, so the whole
       estate wall costs a single extra draw call; the flowers in the terrace
       troughs ride the bougainvillea's instanced cards further down.
       ───────────────────────────────────────────────────────────────────── */
    const PLANTERS = [
      /* the deck edge facing the water, west of the loungers */
      { x: -8.6, z: -9.06, y: 0, w: 1.55, d: 0.60, h: 0.62, spread: 0.92, pick: 0, count: 170 },
      { x: -6.6, z: -9.06, y: 0, w: 1.55, d: 0.60, h: 0.62, spread: 0.92, pick: 2, count: 170 },
      { x: -4.6, z: -9.06, y: 0, w: 1.55, d: 0.60, h: 0.62, spread: 0.92, pick: 4, count: 170 },
      /* the deck's east end, turned across the plan */
      { x: 10.9, z: -7.0, y: 0, w: 0.60, d: 1.60, h: 0.62, spread: 0.92, pick: 1, count: 170 },
      /* the far edge of the pool, seen across the water from the terrace */
      { x: -2.2, z: -20.35, y: -0.05, w: 1.55, d: 0.60, h: 0.62, spread: 0.90, pick: 3, count: 170 },
      { x: 0.2, z: -20.35, y: -0.05, w: 1.55, d: 0.60, h: 0.62, spread: 0.90, pick: 5, count: 170 },
      { x: 2.6, z: -20.35, y: -0.05, w: 1.55, d: 0.60, h: 0.62, spread: 0.90, pick: 0, count: 170 },
      { x: 4.9, z: -20.35, y: -0.05, w: 1.75, d: 0.60, h: 0.62, spread: 0.90, pick: 2, count: 170 },
      /* two drums at the pool's west end */
      { kind: 'round', r: 0.48, x: -4.15, z: -13.4, y: -0.05, h: 0.66, spread: 0.86, pick: 1, count: 150 },
      { kind: 'round', r: 0.40, x: -4.05, z: -17.2, y: -0.05, h: 0.58, spread: 0.78, pick: 4, count: 130 },
      /* the rear balcony, over the terrace */
      { x: -5.0, z: -7.24, y: F2, w: 2.55, d: 0.48, h: 0.46, spread: 0.58, pick: 3, count: 150 },
      /* the roof deck: a trough on its south edge, and the two stone cubes
         already on the deck, planted */
      /* the roof-deck trough on its south edge, a second on its north edge by
         the pergola, and the two stone cubes already on the deck, planted */
      { x: 7.4, z: 3.0, y: DECK, w: 2.40, d: 0.55, h: 0.55, spread: 0.58, pick: 5, count: 170 },
      { x: 12.4, z: -5.45, y: DECK, w: 2.20, d: 0.55, h: 0.50, spread: 0.52, pick: 0, count: 150 },
      { kind: 'existing', x: 5.2, z: 2.6, y: DECK, w: 0.66, d: 0.66, h: 0.50, spread: 0.44, pick: 0, count: 80 },
      { kind: 'existing', x: 5.2, z: -5.2, y: DECK, w: 0.66, d: 0.66, h: 0.50, spread: 0.44, pick: 2, count: 80 },
      /* the main roof's perimeter: travertine troughs inside the parapet on
         all four edges, planted with the same instanced bougainvillea. They
         ring the roof in flower in the approach and the orbit.             */
      { x: -13.5, z: -6.95, y: ROOF, w: 2.30, d: 0.55, h: 0.50, spread: 0.50, pick: 1, count: 110 },
      { x: -8.6, z: -6.95, y: ROOF, w: 2.30, d: 0.55, h: 0.50, spread: 0.50, pick: 4, count: 110 },
      { x: -1.0, z: -6.95, y: ROOF, w: 2.30, d: 0.55, h: 0.50, spread: 0.50, pick: 2, count: 110 },
      { x: 3.4, z: -6.95, y: ROOF, w: 2.30, d: 0.55, h: 0.50, spread: 0.50, pick: 0, count: 110 },
      { x: -12.8, z: 9.45, y: ROOF, w: 2.30, d: 0.55, h: 0.50, spread: 0.50, pick: 3, count: 110 },
      { x: -7.4, z: 9.45, y: ROOF, w: 2.30, d: 0.55, h: 0.50, spread: 0.50, pick: 5, count: 110 },
      { x: -1.6, z: 9.45, y: ROOF, w: 2.30, d: 0.55, h: 0.50, spread: 0.50, pick: 1, count: 110 },
      { x: 3.6, z: 9.45, y: ROOF, w: 2.30, d: 0.55, h: 0.50, spread: 0.50, pick: 2, count: 110 },
      { x: -15.03, z: -4.6, y: ROOF, w: 0.55, d: 2.30, h: 0.50, spread: 0.50, pick: 0, count: 110 },
      { x: -15.03, z: 0.4, y: ROOF, w: 0.55, d: 2.30, h: 0.50, spread: 0.50, pick: 3, count: 110 },
      { x: -15.03, z: 5.4, y: ROOF, w: 0.55, d: 2.30, h: 0.50, spread: 0.50, pick: 5, count: 110 },
      { x: 5.67, z: -4.6, y: ROOF, w: 0.55, d: 2.30, h: 0.50, spread: 0.50, pick: 4, count: 110 },
      { x: 5.67, z: 0.4, y: ROOF, w: 0.55, d: 2.30, h: 0.50, spread: 0.50, pick: 1, count: 110 },
      { x: 5.67, z: 5.4, y: ROOF, w: 0.55, d: 2.30, h: 0.50, spread: 0.50, pick: 2, count: 110 }
    ];

    {
      const T = ESTATE.t, PL = 0.30;
      const CAP = 0.18, CAP_D = T + 0.26;              // the coping overhangs 0.13 a side
      const REV = 0.06;                                 // the shadow reveal under it
      const BAY = { y0: 0.94, y1: 1.74 };
      const REAR_BAND = 1.30, REAR_TOP = 1.35;
      const GA = ESTATE.gate.a, GB = ESTATE.gate.b;
      const CORNER = 0.50;                              // half a corner pier

      /* the wall's own stone: a shade warmer and deeper than the villa's, so
         the boundary reads as an older wall round a pale new house */
      const wallStone = weather(new THREE.MeshStandardMaterial({
        map: tex(stoneA.map, { srgb: true }),
        normalMap: tex(stoneA.normal),
        roughnessMap: tex(stoneA.rough),
        color: 0xeadfca,
        roughness: 1.0, metalness: 0.0,
        normalScale: new THREE.Vector2(1.02, 1.02),
        envMapIntensity: 0.44
      }), { grime: 0.10, streak: 0.18, base: 0.26, scale: 0.34 });

      /* place a box in run coordinates: u along the run, y up, d across */
      const put = (axis, at, u, y, lu, ly, ld, mat, opt) => {
        if (axis === 'x') addBox(lu, ly, ld, u, y, at, mat, opt);
        else addBox(ld, ly, lu, at, y, u, mat, opt);
      };

      /* the shadow gap under the coping: one continuous recess, 90 mm deep
         and 220 mm tall. It used to be filled with 46 mm bronze fins at a
         128 mm pitch, which at any distance moiréd into a dark striped band;
         a smooth recess reads as a crisp architectural shadow line and costs
         one box instead of a hundred.                                      */
      const ribbon = (axis, at, a, b, y0, y1) => {
        const w = b - a, c = (a + b) / 2;
        put(axis, at, c, (y0 + y1) / 2, w - 0.02, y1 - y0, T - 0.18, M.dark, { cast: false });
      };

      /* a pier: a stepped vertical, its pale cap proud of the coping */
      const pier = (axis, at, u, h, w = 0.62) => {
        put(axis, at, u, h / 2, w, h, T + 0.22, wallStone, { uv: 0.4 });
        put(axis, at, u, h + 0.05, w + 0.16, 0.10, T + 0.34, M.stonePale, { uv: 0.42 });
      };

      /* one straight run of the tall wall: plinth, panel, ribbon, coping */
      function run(axis, at, from, to, h) {
        const dir = to > from ? 1 : -1, L = Math.abs(to - from);
        const mid = from + dir * L / 2;
        const top = h - CAP - REV;                     // 1.76
        put(axis, at, mid, (PL - 0.36) / 2, L, PL + 0.36, T + 0.20, M.stonePale, { uv: 0.42 });
        put(axis, at, mid, (PL + top - 0.22) / 2, L, top - 0.22 - PL, T, wallStone, { uv: 0.4 });
        put(axis, at, mid, top + REV / 2, L, REV, T - 0.15, wallStone, { uv: 0.4 });
        put(axis, at, mid, top + REV + CAP / 2, L, CAP, CAP_D, M.stonePale, { uv: 0.42 });

        const nSeg = Math.max(1, Math.round(L / 6.1)), segL = L / nSeg;
        for (let i = 0; i < nSeg; i++) {
          const a = from + dir * (segL * i + 0.33), b = from + dir * (segL * (i + 1) - 0.33);
          if (Math.abs(b - a) > 0.5) ribbon(axis, at, Math.min(a, b), Math.max(a, b), top - 0.22, top);
        }
        for (let i = 1; i < nSeg; i++) pier(axis, at, from + dir * segL * i, h + 0.14);
      }

      /* the rear: a low stone wall with a bronze cap and tall piers, open to
         the sky between them, so the water, the meadow and the city beyond
         stay one view. A wall seen along its length reads solid whatever its
         louvres do; only a real void keeps the horizon.                    */
      function rearRun(from, to) {
        const at = ESTATE.z0, L = Math.abs(to - from), mid = (from + to) / 2;
        put('x', at, mid, (PL - 0.36) / 2, L, PL + 0.36, T + 0.20, M.stonePale, { uv: 0.42 });
        put('x', at, mid, (PL + REAR_BAND) / 2, L, REAR_BAND - PL, T, M.stonePale, { uv: 0.42 });
        // a bronze reveal runs the wall at waist height, and a thin cap on top
        put('x', at, mid, 0.66, L, 0.05, T - 0.05, M.bronze, { cast: false });
        put('x', at, mid, REAR_TOP - 0.025, L, 0.05, T + 0.02, M.bronze, { cast: false });

        /* the 2.0 m wall stands in the pool's mirror as a dark band under the
           skyline, so the rear face is lowered to the 1.35 m rail height the
           terrace already uses */
        put('x', at, mid, (PL + REAR_TOP) / 2, L, REAR_TOP - PL, T, M.stonePale, { uv: 0.42 });

        const nSeg = Math.max(1, Math.round(L / 6.1)), segL = L / nSeg;
        for (let i = 1; i < nSeg; i++) pier('x', at, from + segL * i, 1.50, 0.55);
      }

      /* a corner pier reconciles the 2.06 m side with the low rear */
      function cornerPier(x, z) {
        addBox(1.00, 2.58, 1.00, x, 0.99, z, wallStone, { uv: 0.4 });
        addBox(1.02, 0.03, 1.02, x, 1.80, z, M.bronze, { cast: false });
        addBox(1.14, 0.10, 1.14, x, 2.33, z, M.stonePale, { uv: 0.42 });
      }

      /* the gate piers: 2.9 m of stone, a bronze joint, a warm slot inside */
      const gateGlow = M.glow.clone();
      gateGlow.opacity = 0.20;
      function gatePier(x, s) {
        addBox(1.42, 0.80, 1.22, x, -0.06, ESTATE.z1, M.stonePale, { uv: 0.42 });
        addBox(1.30, 2.34, 1.10, x, 1.61, ESTATE.z1, wallStone, { uv: 0.4 });
        addBox(1.32, 0.025, 1.12, x, 1.10, ESTATE.z1, M.bronze, { cast: false });
        addBox(1.32, 0.025, 1.12, x, 2.28, ESTATE.z1, M.bronze, { cast: false });
        addBox(1.48, 0.14, 1.28, x, 2.85, ESTATE.z1, M.stonePale, { uv: 0.42 });
        const fx = x + s * 0.66;
        addBox(0.035, 1.54, 0.19, fx, 1.62, ESTATE.z1, M.bronze, { uv: 0.5 });
        addBox(0.03, 0.92, 0.05, fx + s * 0.026, 1.62, ESTATE.z1, warmLamp, { cast: false, receive: false });
        const q = new THREE.PlaneGeometry(0.5, 1.7);
        q.rotateY(s > 0 ? Math.PI / 2 : -Math.PI / 2);
        q.translate(fx + s * 0.05, 1.62, ESTATE.z1);
        queue(q, gateGlow, false, false, 4);
      }

      /* travertine troughs: a bronze reveal under the rim, soil just below it */
      function planterHard(P) {
        if (P.kind === 'existing') return;
        const y0 = P.y, h = P.h;
        if (P.kind === 'round') {
          const body = new THREE.CylinderGeometry(P.r, P.r, h, 26);
          body.translate(P.x, y0 + h / 2, P.z);
          queue(body, wallStone, true, true);
          const lip = new THREE.CylinderGeometry(P.r, P.r, 0.07, 26);
          lip.translate(P.x, y0 + h - 0.035, P.z);
          queue(lip, M.stonePale, true, true);
          const groove = new THREE.CylinderGeometry(P.r + 0.002, P.r + 0.002, 0.018, 26);
          groove.translate(P.x, y0 + h - 0.079, P.z);
          queue(groove, M.dark, true, true);
          const soil = new THREE.CylinderGeometry(P.r - 0.055, P.r - 0.055, 0.05, 22);
          soil.translate(P.x, y0 + h - 0.045, P.z);
          queue(soil, M.dark, false, true);
        } else {
          addBox(P.w, h, P.d, P.x, y0 + h / 2, P.z, wallStone, { uv: 0.5 });
          addBox(P.w, 0.07, P.d, P.x, y0 + h - 0.035, P.z, M.stonePale, { uv: 0.5 });
          addBox(P.w + 0.004, 0.018, P.d + 0.004, P.x, y0 + h - 0.079, P.z, M.dark, { uv: 0.5 });
          addBox(P.w - 0.12, 0.05, P.d - 0.12, P.x, y0 + h - 0.045, P.z, M.dark, { cast: false });
        }
      }

      /* the four sides, a gate pier at each side of the entrance */
      run('x', ESTATE.z1, ESTATE.x0 + CORNER, GA, ESTATE.h);
      run('x', ESTATE.z1, GB, ESTATE.x1 - CORNER, ESTATE.h);
      run('z', ESTATE.x0, ESTATE.z0 + CORNER, ESTATE.z1 - CORNER, ESTATE.h);
      run('z', ESTATE.x1, ESTATE.z0 + CORNER, ESTATE.z1 - CORNER, ESTATE.h);
      rearRun(ESTATE.x0 + CORNER, ESTATE.x1 - CORNER);

      cornerPier(ESTATE.x0, ESTATE.z0);
      cornerPier(ESTATE.x0, ESTATE.z1);
      cornerPier(ESTATE.x1, ESTATE.z0);
      cornerPier(ESTATE.x1, ESTATE.z1);

      gatePier(GA - 0.65, 1);
      gatePier(GB + 0.65, -1);

      /* architectural CCTV: matte dark-bronze housings with a lens glass and
         a small status LED, aimed down over the court and the corners. One
         housing builder, six mounts; everything batched into existing
         materials except the tiny LED, which is one shared emissive.       */
      const cctvLed = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.30, 0.22) });
      const cctv = (x, y, z, ry, rx) => {
        const g = new THREE.BoxGeometry(0.30, 0.13, 0.15);
        if (rx) g.rotateX(rx);
        g.rotateY(ry);
        g.translate(x, y, z);
        queue(g, M.dark, true, true);
        // the lens ring, facing the camera's look direction
        const lg = new THREE.CylinderGeometry(0.055, 0.062, 0.05, 14);
        lg.rotateX(Math.PI / 2 + (rx || 0));
        lg.rotateY(ry);
        lg.translate(x + Math.sin(ry) * 0.15 * Math.cos(rx || 0), y - Math.sin(rx || 0) * 0.15, z + Math.cos(ry) * 0.15 * Math.cos(rx || 0));
        queue(lg, M.glassDark, true, false);
        // a small mounting arm back to the wall
        const arm = new THREE.BoxGeometry(0.05, 0.05, 0.14);
        arm.rotateY(ry);
        arm.translate(x - Math.sin(ry) * 0.09, y + 0.02, z - Math.cos(ry) * 0.09);
        queue(arm, M.bronze, true, true);
        // the status LED on the housing's side
        const led = new THREE.BoxGeometry(0.018, 0.018, 0.012);
        led.rotateY(ry);
        led.translate(x - Math.sin(ry) * 0.14, y + 0.045, z - Math.cos(ry) * 0.14 + 0.05);
        queue(led, cctvLed, false, false);
      };
      // on the inner faces of both gate piers, aimed down the drive court
      cctv(-1.55 + 0.42, 2.58, ESTATE.z1 - 0.62, -0.55, -0.38);
      cctv(GB + 0.65 - 0.42, 2.58, ESTATE.z1 - 0.62, 0.55, -0.38);
      // on the villa's upper front corners, covering the porch and the wing
      cctv(S.x0 + 0.30, 7.52, S.z1 + 0.30, -2.35, -0.42);
      cctv(S.x1 - 0.30, 7.52, S.z1 + 0.30, 2.35, -0.42);
      // the wing's outer corner, over the east yard and the play court
      cctv(WING.x1 - 0.28, 3.42, WING.z1 - 0.30, 2.75, -0.45);

      PLANTERS.forEach(planterHard);

      /* ── the ground where it meets the wall ─────────────────────────────
         Contact shading on both faces of every run, under the gate and corner
         piers, and under each planter. It is the cheapest realism in the
         scene: nothing looks pasted on when the ground darkens into it.   */
      const aoY = 0.026;
      for (const sd of [-1, 1]) {
        contactBand('x', ESTATE.z1, ESTATE.x0, GA - 0.65, sd, 1.8, aoY);
        contactBand('x', ESTATE.z1, GB + 0.65, ESTATE.x1, sd, 1.8, aoY);
        contactBand('z', ESTATE.x0, ESTATE.z0, ESTATE.z1, sd, 1.8, aoY);
        contactBand('z', ESTATE.x1, ESTATE.z0, ESTATE.z1, sd, 1.8, aoY);
        contactBand('x', ESTATE.z0, ESTATE.x0, ESTATE.x1, sd, 1.5, aoY);
      }
      contactShadow(GA - 0.65, ESTATE.z1, 2.3, 2.1, true, aoY + 0.002);
      contactShadow(GB + 0.65, ESTATE.z1, 2.3, 2.1, true, aoY + 0.002);
      for (const [px, pz] of [[ESTATE.x0, ESTATE.z0], [ESTATE.x0, ESTATE.z1],
                              [ESTATE.x1, ESTATE.z0], [ESTATE.x1, ESTATE.z1]]) {
        contactShadow(px, pz, 2.0, 2.0, true, aoY + 0.002);
      }
      for (const P of PLANTERS) {
        const w = P.kind === 'round' ? P.r * 2.6 : P.w + 0.6;
        const d = P.kind === 'round' ? P.r * 2.6 : P.d + 0.6;
        contactShadow(P.x, P.z, w, d, true, P.y + 0.024);
      }
    }

    /* ─────────────────────────────────────────────────────────────────────
       7 · interior
       Ground floor: one oak plain from the entry to the rear glass, the hall
       open the full 8 m to a skylight, the stair hanging in that void, and the
       living room set back under the gallery. The second floor is a gallery
       that wraps the void on three sides — a bridge over the entry, a landing
       where the stair arrives, and a run of rooms behind glass along the front.
       ───────────────────────────────────────────────────────────────────── */
    addPlane(G.x1 - G.x0 - 0.5, G.z1 - G.z0 - 0.5, (G.x0 + G.x1) / 2, 0.012, (G.z0 + G.z1) / 2, M.oakFloor, { uv: 1 / 3.1 });
    addPlane(WING.x1 - WING.x0 - 0.4, WING.z1 - WING.z0 - 0.4, (WING.x0 + WING.x1) / 2, 0.014, (WING.z0 + WING.z1) / 2, M.oakFloor, { uv: 1 / 3.1 });
    // a stone threshold inside the door, then oak
    addPlane(3.0, 1.1, 0, 0.02, G.z1 - 0.55, M.stonePale, { uv: 0.5 });

    await nextTick();

    /* ── the second-floor plate, built around the atrium ────────────────── */
    {
      const plate = (x0, x1, z0, z1) => {
        addBox(x1 - x0, F2 - DECK, z1 - z0, (x0 + x1) / 2, (DECK + F2) / 2, (z0 + z1) / 2, M.plaster, { uv: 0.4 });
        addPlane(x1 - x0 - 0.02, z1 - z0 - 0.02, (x0 + x1) / 2, F2 + 0.004, (z0 + z1) / 2, M.oakFloor, { uv: 1 / 3.1 });
      };
      plate(S.x0, ATRIUM.x0, S.z0, S.z1);            // west gallery
      plate(ATRIUM.x1, S.x1, S.z0, S.z1);            // east gallery
      plate(ATRIUM.x0, ATRIUM.x1, ATRIUM.z1, S.z1);  // the bridge over the entry
      // bronze fascia round the void edge, and the shadow line under it
      addBox(0.06, F2 - DECK + 0.02, ATRIUM.z1 - ATRIUM.z0, ATRIUM.x0, (DECK + F2) / 2, (ATRIUM.z0 + ATRIUM.z1) / 2, M.bronze, { uv: 0.5, cast: false });
      addBox(0.06, F2 - DECK + 0.02, ATRIUM.z1 - ATRIUM.z0, ATRIUM.x1, (DECK + F2) / 2, (ATRIUM.z0 + ATRIUM.z1) / 2, M.bronze, { uv: 0.5, cast: false });
      addBox(ATRIUM.x1 - ATRIUM.x0, F2 - DECK + 0.02, 0.06, (ATRIUM.x0 + ATRIUM.x1) / 2, (DECK + F2) / 2, ATRIUM.z1, M.bronze, { uv: 0.5, cast: false });
      // a stone floor on the loggia, where the upper floor meets the air
      addPlane(LOGGIA.x1 - LOGGIA.x0 - 0.1, LOGGIA.z1 - LOGGIA.z0 - 0.1, (LOGGIA.x0 + LOGGIA.x1) / 2, F2 + 0.008, (LOGGIA.z0 + LOGGIA.z1) / 2, M.stonePale, { uv: 0.5 });
    }

    /* ── the stair: 16 oak treads on a bronze stringer, in the void ─────── */
    {
      const n = 16, rise = F2 / n, run = 0.30, sx = -10.0, w = 1.5;
      const zBot = 3.18, zTop = zBot - (n - 1) * run;
      for (let i = 0; i < n; i++) {
        const y = (i + 1) * rise, z = zBot - i * run;
        addBox(w, 0.075, run + 0.05, sx, y - 0.038, z, M.oak, { uv: 0.6 });
      }
      // the stringer: a plate on the east side, following the flight
      {
        const len = Math.hypot(zBot - zTop + 0.4, F2);
        const g = new THREE.BoxGeometry(0.05, 0.28, len);
        g.rotateX(Math.atan2(F2, zBot - zTop + 0.4));
        g.translate(sx + w / 2 + 0.02, F2 / 2 - 0.02, (zBot + zTop) / 2);
        queue(g, M.bronze, true, true);
      }
      // a glass balustrade following the flight
      {
        const z0 = zBot + 0.16, z1 = zTop - 0.02, y0 = rise + 0.06, y1 = F2 + 0.06, hh = 1.02, px = sx + w / 2 + 0.05;
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
        // bronze handrail over it
        const hrPts = [];
        for (let i = 0; i <= 6; i++) {
          const s = i / 6;
          hrPts.push(new THREE.Vector3(px, y0 + hh + s * (y1 - y0) + 0.03, z0 + s * (z1 - z0)));
        }
        const hr = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hrPts), 16, 0.026, 8), M.bronze);
        hr.castShadow = true; world.add(hr);
      }
      // the landing: a small plate at the top, into the west gallery
      addBox(1.9, 0.12, 1.3, -10.1, F2 - 0.06, zTop - 0.65, M.stonePale, { uv: 0.5 });
      addBox(1.94, 0.05, 1.34, -10.1, F2 - 0.14, zTop - 0.65, M.bronze, { uv: 0.5, cast: false });
      railZ(zTop - 1.3, zTop, -9.18, F2, 1.04);
      railX(-10.6, -9.18, zTop - 1.28, F2, 1.04);
      contactShadow(-10.0, 0.05, 1.8, 4.6, true, 0.02);
    }

    /* ── gallery balustrades: glass, bronze shoe, bronze cap ────────────── */
    railZ(ATRIUM.z0, -2.55, ATRIUM.x0, F2, 1.05);
    railX(ATRIUM.x0, ATRIUM.x1, ATRIUM.z1, F2, 1.05);
    railZ(ATRIUM.z0, ATRIUM.z1, ATRIUM.x1, F2, 1.05);

    /* ── ceilings: plaster at 8.15, cut around the skylight ─────────────── */
    {
      const L = SKY.x0, R = SKY.x1, B = SKY.z0, F = SKY.z1;
      addPlane(S.x1 - S.x0, B - S.z0, (S.x0 + S.x1) / 2, RL - 0.02, (S.z0 + B) / 2, M.plaster, { uv: 0.35, faceDown: true });
      addPlane(S.x1 - S.x0, S.z1 - F, (S.x0 + S.x1) / 2, RL - 0.02, (F + S.z1) / 2, M.plaster, { uv: 0.35, faceDown: true });
      addPlane(L - S.x0, F - B, (S.x0 + L) / 2, RL - 0.02, (B + F) / 2, M.plaster, { uv: 0.35, faceDown: true });
      addPlane(S.x1 - R, F - B, (R + S.x1) / 2, RL - 0.02, (B + F) / 2, M.plaster, { uv: 0.35, faceDown: true });
      // the reveal of the light well, and its bronze trim
      for (const [x, z, w, d] of [[(L + R) / 2, B - 0.02, R - L, 0.04], [(L + R) / 2, F + 0.02, R - L, 0.04],
        [L - 0.02, (B + F) / 2, 0.04, F - B], [R + 0.02, (B + F) / 2, 0.04, F - B]]) {
        addBox(w, 0.42, d, x, RL + 0.2, z, M.plaster, { uv: 0.4, cast: false });
      }
    }

    /* ── the living room ──────────────────────────────────────────────────
       Low bouclé sectional on a woven rug, a fluted oak coffee table with
       thrown vessels, one framed work on the limestone, and a brass linear
       pendant dropped 5.5 m out of the ceiling. Every edge is bevelled. */
    {
      const g = new THREE.PlaneGeometry(4.7, 3.6);
      g.rotateX(-Math.PI / 2);
      g.translate(-5.0, 0.034, -3.5);
      queue(g, M.rugWoven, false, true);
    }
    {
      const sx = -5.2, sz = -4.45;
      addSoft(3.42, 0.10, 1.0, 0.03, sx, 0.07, sz, M.dark, { uv: 0.5 });
      addSoft(3.52, 0.28, 1.14, 0.06, sx, 0.27, sz, M.boucle, { uv: 0.55 });
      for (let i = 0; i < 2; i++) {
        addSoft(1.68, 0.16, 1.02, 0.07, sx - 0.85 + i * 1.7, 0.485, sz + 0.04, M.boucle, { uv: 0.5, seg: 3 });
      }
      addSoft(3.52, 0.50, 0.20, 0.06, sx, 0.60, sz - 0.52, M.boucle, { uv: 0.55 });
      for (let i = 0; i < 2; i++) {
        addSoft(1.64, 0.46, 0.24, 0.09, sx - 0.85 + i * 1.7, 0.68, sz - 0.42,
          M.boucle, { uv: 0.5, rx: -0.13, seg: 3 });
      }
      for (const ax of [sx - 1.76, sx + 1.76]) {
        addSoft(0.20, 0.40, 1.16, 0.09, ax, 0.44, sz, M.boucle, { uv: 0.5, seg: 3 });
      }
      addSoft(1.02, 0.24, 1.5, 0.05, sx - 1.36, 0.26, -3.66, M.boucle, { uv: 0.55 });
      addSoft(0.96, 0.14, 1.42, 0.07, sx - 1.36, 0.46, -3.66, M.boucle, { uv: 0.5, seg: 3 });
      const throws = [
        [-6.05, 0.72, -4.72, 0.44, M.linenB, 0.14, -0.22],
        [-4.35, 0.70, -4.74, 0.42, M.linenA, -0.10, -0.20],
        [-4.86, 0.66, -4.80, 0.38, M.boucle, 0.05, -0.26],
        [-6.40, 0.55, -3.30, 0.46, M.linenA, 0.42, 0.06]
      ];
      for (const [x, y, z, s, mat, rz, rx] of throws) {
        addSoft(s, s, 0.15, 0.06, x, y, z, mat, { uv: 0.6, rz, rx, seg: 3 });
      }

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
      megaVessel('wood_vase',
        [[0.001, 0], [0.055, 0.006], [0.078, 0.10], [0.048, 0.21], [0.052, 0.30], [0.036, 0.35]],
        -5.28, 0.375, -2.94, M.ceramic, 24);
      megaVessel('clay_vase',
        [[0.001, 0], [0.075, 0], [0.135, 0.02], [0.158, 0.085], [0.148, 0.098], [0.128, 0.072], [0.062, 0.013], [0.001, 0.012]],
        -4.58, 0.375, -3.02, M.stoneVessel, 24, { hScale: 2.4 });
      addBox(0.34, 0.035, 0.24, -5.55, 0.392, -2.72, M.dark, { uv: 0.5 });
      addBox(0.31, 0.03, 0.22, -5.53, 0.424, -2.73, M.linenB, { uv: 0.6 });

      megaVessel('clay_vase',
        [[0.001, 0], [0.13, 0.01], [0.19, 0.22], [0.14, 0.48], [0.10, 0.62], [0.115, 0.70], [0.10, 0.72]],
        -8.55, 0.012, -1.55, M.stoneVessel, 26);

      contactShadow(-5.2, -4.45, 4.1, 1.7, false, 0.032);
      contactShadow(-6.56, -3.66, 1.5, 1.9, false, 0.032);
      contactShadow(-4.85, -2.9, 2.2, 1.35, false, 0.032);
      contactShadow(-8.55, -1.55, 0.86, 0.86, false, 0.032);
      contactShadow(-10.0, -1.9, 1.9, 1.6, false, 0.03);
    }

    /* ── the entry itself: a runner, a stone bench, one tall vessel ─────── */
    {
      const g = new THREE.PlaneGeometry(2.7, 4.6);
      g.rotateX(-Math.PI / 2);
      g.translate(0, 0.038, 4.0);
      queue(g, M.linenA, false, true);
      addBox(2.74, 0.02, 4.64, 0, 0.028, 4.0, M.rugEdge, { cast: false });
      addBox(1.9, 0.09, 0.5, 2.9, 0.42, 4.4, M.stonePale, { uv: 0.5 });
      for (const dz of [-0.72, 0.72]) addBox(0.42, 0.38, 0.06, 2.9, 0.19, 4.4 + dz, M.bronze, { uv: 0.5, cast: false });
      megaVessel('clay_vase',
        [[0.001, 0], [0.14, 0.01], [0.19, 0.24], [0.13, 0.5], [0.1, 0.66], [0.11, 0.72]],
        2.9, 0.47, 3.2, M.stoneVessel, 22);
      contactShadow(2.9, 4.4, 2.2, 1.0, false, 0.03);
      contactShadow(2.9, 3.2, 0.7, 0.7, false, 0.03);
    }

    /* ── framed work, on the rear stone beside the sliding wall ─────────── */
    {
      const az = G.z0 + G.t / 2 + 0.03, ax = -9.35, ay = 2.12;
      const aw = 1.7, ah = 1.2;
      const art = new THREE.PlaneGeometry(aw, ah);
      art.translate(ax, ay, az + 0.03);
      queue(art, M.art, false, false);
      const fw = 0.03, fd = 0.045;
      addBox(aw + fw * 2, fw, fd, ax, ay + ah / 2 + fw / 2, az + 0.012, M.bronze, { uv: 0.6 });
      addBox(aw + fw * 2, fw, fd, ax, ay - ah / 2 - fw / 2, az + 0.012, M.bronze, { uv: 0.6 });
      addBox(fw, ah, fd, ax - aw / 2 - fw / 2, ay, az + 0.012, M.bronze, { uv: 0.6 });
      addBox(fw, ah, fd, ax + aw / 2 + fw / 2, ay, az + 0.012, M.bronze, { uv: 0.6 });
    }

    /* ── brass linear pendant, hung the full height of the hall ─────────── */
    {
      const px = -4.85, pz = -2.9, py = 2.62;
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
        addBox(0.013, RL - 0.06 - py, 0.013, px + cx, (RL - 0.06 + py) / 2, pz, M.bronze, { cast: false, receive: false });
      }
      const pl = new THREE.PointLight(0xffc287, MOBILE ? 8 : 16, 10, 2);
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

    /* ── the dining room in the wing ────────────────────────────────────── */
    {
      const tx = 9.6, tz = -1.3;
      addBox(3.6, 0.07, 1.15, tx, 0.745, tz, M.walnut, { uv: 0.6 });
      addBox(0.5, 0.71, 0.9, tx - 1.2, 0.36, tz, M.walnut, { uv: 0.6 });
      addBox(0.5, 0.71, 0.9, tx + 1.2, 0.36, tz, M.walnut, { uv: 0.6 });
      const chair = (x, z, ry) => {
        const c = Math.cos(ry), s = Math.sin(ry);
        const at = (dx, dz) => [x + dx * c - dz * s, z + dx * s + dz * c];
        const [bx, bz] = at(0, 0);
        addSoft(0.46, 0.05, 0.44, 0.02, bx, 0.45, bz, M.oak, { uv: 0.6, ry });
        for (const [dx, dz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) {
          const [lx, lz] = at(dx, dz);
          addBox(0.032, 0.43, 0.032, lx, 0.215, lz, M.bronze, { uv: 0.5 });
        }
        const [bkx, bkz] = at(0, -0.21);
        addSoft(0.44, 0.42, 0.05, 0.02, bkx, 0.68, bkz, M.oak, { uv: 0.6, ry });
      };
      for (const x of [8.4, 9.6, 10.8]) { chair(x, -2.05, 0); chair(x, -0.55, Math.PI); }
      // a long low sideboard against the rear glass, and the pendants over it
      addBox(4.2, 0.86, 0.75, 9.8, 0.43, -5.2, M.stonePale, { uv: 0.5 });
      addBox(4.4, 0.06, 0.95, 9.8, 0.89, -5.2, M.concrete, { uv: 0.5 });
      megaVessel('clay_vase', [[0.001, 0], [0.09, 0.01], [0.12, 0.2], [0.08, 0.34], [0.09, 0.4]],
        9.0, 0.92, -5.2, M.stoneVessel, 20, { hScale: 1.4 });
      for (const x of [8.4, 9.6, 10.8]) {
        addBox(0.03, 2.0, 0.03, x, 1.75, -1.3, M.bronze, { cast: false, receive: false });
        addSoft(0.2, 0.12, 0.2, 0.03, x, 0.72, -1.3, M.brass, { seg: 2 });
      }
      contactShadow(tx, tz, 4.0, 1.6, false, 0.032);
    }

    /* ── the gallery above: a console, a runner, a warm room behind glass ── */
    {
      // the bridge over the entry, with its own rug and a low console
      const g = new THREE.PlaneGeometry(4.2, 1.7);
      g.rotateX(-Math.PI / 2);
      g.translate(-4.4, F2 + 0.02, 5.0);
      queue(g, M.rugWoven, false, true);
      addBox(2.4, 0.06, 0.42, -4.4, F2 + 0.76, 7.9, M.walnut, { uv: 0.6 });
      for (const dx of [-1.05, 1.05]) addBox(0.05, 0.73, 0.36, -4.4 + dx, F2 + 0.365, 7.9, M.bronze, { uv: 0.5 });
      megaVessel('wood_vase', [[0.001, 0], [0.07, 0.01], [0.1, 0.16], [0.06, 0.3], [0.07, 0.35]], -5.0, F2 + 0.79, 7.9, M.ceramic, 20, { hScale: 3.4 });
      addBox(0.26, 0.03, 0.2, -3.7, F2 + 0.81, 7.9, M.linenB, { uv: 0.6 });
      // a framed work over it, on the front wall between the windows
      {
        const aw = 1.15, ah = 0.92, ax = -5.2, ay = F2 + 1.75, az = S.z1 - S.t / 2 - 0.02;
        const art = new THREE.PlaneGeometry(aw, ah);
        art.translate(ax, ay, az);
        queue(art, M.art, false, false);
        addBox(aw + 0.05, 0.025, 0.04, ax, ay + ah / 2, az, M.bronze, { uv: 0.6 });
        addBox(aw + 0.05, 0.025, 0.04, ax, ay - ah / 2, az, M.bronze, { uv: 0.6 });
      }
      // a walnut wardrobe run along the east gallery, and a tall vessel
      addBox(0.55, 2.5, 3.4, S.x1 - 0.62, F2 + 1.25, -3.2, M.walnutVert, { uv: 0.6 });
      megaVessel('clay_vase',
        [[0.001, 0], [0.16, 0.01], [0.22, 0.26], [0.16, 0.55], [0.12, 0.72], [0.13, 0.8]],
        S.x1 - 1.05, F2 + 0.01, -0.4, M.stoneVessel, 24);
      // the glazed screen that closes the front rooms off the gallery
      {
        const z = 4.6, x0 = ATRIUM.x0, x1 = -3.2;
        const g2 = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, RL - F2 - 0.1), M.glass);
        g2.position.set((x0 + x1) / 2, (F2 + RL) / 2, z);
        g2.renderOrder = 3;
        world.add(g2);
        addBox(x1 - x0, 0.07, 0.12, (x0 + x1) / 2, RL - 0.06, z, M.bronze, { uv: 0.5 });
        addBox(x1 - x0, 0.07, 0.12, (x0 + x1) / 2, F2 + 0.04, z, M.bronze, { uv: 0.5 });
        for (const x of [x0 + 0.02, -8.2, -5.6, x1 - 0.02]) {
          addBox(0.06, RL - F2 - 0.1, 0.1, x, (F2 + RL) / 2, z, M.bronze, { uv: 0.5 });
        }
        addBox(0.9, RL - F2 - 0.1, 0.1, -3.65, (F2 + RL) / 2, z, M.bronze, { uv: 0.5 });
      }
      contactShadow(-4.4, 7.9, 2.6, 0.7, false, F2 + 0.01);

      // the front room reads as a bedroom from the drive: a low bed, its
      // headboard against the loggia wall, and two lamps on walnut cubes
      {
        const bx = -4.0, bz = 7.0;
        addBox(0.1, 1.15, 2.0, -5.02, F2 + 0.58, bz, M.walnutVert, { uv: 0.6 });     // headboard
        addBox(2.3, 0.24, 1.9, bx, F2 + 0.12, bz, M.walnut, { uv: 0.6 });            // base
        addSoft(2.16, 0.28, 1.78, 0.09, bx, F2 + 0.34, bz, M.linenA, { uv: 0.6, seg: 3 });
        addSoft(1.4, 0.12, 1.75, 0.06, bx + 0.42, F2 + 0.5, bz, M.boucle, { uv: 0.55, seg: 3 });
        for (const dz of [-0.44, 0.44]) {
          addSoft(0.62, 0.16, 0.44, 0.07, -4.6, F2 + 0.55, bz + dz, M.linenA, { uv: 0.6, seg: 3 });
        }
        for (const dz of [-1.12, 1.12]) {
          addBox(0.46, 0.44, 0.46, -4.72, F2 + 0.22, bz + dz, M.walnut, { uv: 0.6 });
          addLathe([[0.001, 0], [0.1, 0.01], [0.13, 0.16], [0.1, 0.24], [0.11, 0.26]],
            -4.72, F2 + 0.45, bz + dz, M.ceramic, 18);
        }
        contactShadow(bx, bz, 2.6, 2.2, false, F2 + 0.012);
      }
    }

    /* ── interior lighting ─────────────────────────────────────────────── */
    const warm = 0xffbf85;
    const addPoint = (x, y, z, intensity, dist, color = warm, castShadow = false) => {
      const l = new THREE.PointLight(color, intensity, dist, 2);
      l.position.set(x, y, z);
      /*  A shadow-casting point light is a cube map: six faces of the whole
          estate, baked into the first frame, per light. Four of them were
          costing more than the sun's 768² map and everything else in the
          first frame put together (measured: first frame 13.3 s -> 7.1 s
          under software GL). A phone keeps the light and loses the cube map;
          the lamp still lights the room, the wall behind it just does not
          draw a second shadow of the sofa. A laptop or desktop keeps both,
          whatever its core count. */
      if (castShadow && !MOBILE) {
        l.castShadow = true;
        const sm = 512;
        l.shadow.mapSize.set(sm, sm);
        l.shadow.camera.near = 0.12;
        l.shadow.camera.far = dist + 4;
        l.shadow.bias = -0.0009;
        l.shadow.normalBias = 0.035;
      }
      scene.add(l);
      return l;
    };
    addPoint(0.0, 4.2, 3.4, MOBILE ? 17 : 26, 18, warm, true);
    addPoint(-3.6, 3.4, -2.4, MOBILE ? 19 : 31, 22, warm, true);
    addPoint(0.6, 2.5, -0.6, MOBILE ? 8.5 : 12, 9, warm, true);
    addPoint(9.0, 2.6, -1.6, MOBILE ? 9.5 : 14, 14, warm, true);
    addPoint(2.0, -0.7, -14.0, MOBILE ? 5 : 8, 13, 0xbfe2d8);
    // the light well: cool daylight falling into the hall
    addPoint(-5.6, 7.7, -2.1, MOBILE ? 10 : 18, 14, 0xdce6f2);
    // the upper floor, seen through the glass
    addPoint(-4.2, 6.6, 6.0, MOBILE ? 10.5 : 16.5, 12, 0xffc290);
    addPoint(1.0, 3.4, 4.8, MOBILE ? 7 : 12, 11, 0xffc79a);
    addPoint(-6.4, 6.4, -3.4, MOBILE ? 7 : 11, 12, 0xffc290);

    // a recessed spot washing the framed work on the rear wall
    {
      const spot = new THREE.SpotLight(0xffc89c, MOBILE ? 12 : 24, 11, 0.5, 0.78, 2);
      spot.position.set(-9.35, 6.9, -4.6);
      spot.target.position.set(-9.35, 1.9, -5.9);
      scene.add(spot, spot.target);
    }

    /* cove strips: warm light at the top of the hall, and under the galleries */
    const coveMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.05, 1.44, 0.86) });
    addBox(ATRIUM.x1 - ATRIUM.x0, 0.03, 0.06, (ATRIUM.x0 + ATRIUM.x1) / 2, RL - 0.12, ATRIUM.z0 + 0.06, coveMat, { cast: false, receive: false });
    addBox(ATRIUM.x1 - ATRIUM.x0, 0.03, 0.06, (ATRIUM.x0 + ATRIUM.x1) / 2, RL - 0.12, ATRIUM.z1 - 0.06, coveMat, { cast: false, receive: false });
    addBox(0.06, 0.03, ATRIUM.z1 - ATRIUM.z0, ATRIUM.x0 + 0.06, RL - 0.12, (ATRIUM.z0 + ATRIUM.z1) / 2, coveMat, { cast: false, receive: false });
    addBox(0.06, 0.03, ATRIUM.z1 - ATRIUM.z0, ATRIUM.x1 - 0.06, RL - 0.12, (ATRIUM.z0 + ATRIUM.z1) / 2, coveMat, { cast: false, receive: false });
    addBox(0.05, 0.03, ATRIUM.z1 - ATRIUM.z0, ATRIUM.x0 + 0.05, F2 - 0.02, (ATRIUM.z0 + ATRIUM.z1) / 2, coveMat, { cast: false, receive: false });
    addBox(ATRIUM.x1 - ATRIUM.x0, 0.03, 0.05, (ATRIUM.x0 + ATRIUM.x1) / 2, F2 - 0.02, ATRIUM.z1 - 0.05, coveMat, { cast: false, receive: false });

    /* ── recessed downlights ──────────────────────────────────────────────
       The hall is eight metres to the ceiling and reads flat without them.
       A recess (a dark ring) and a warm lens, both merged into two draws,
       with one extra point light high in the void to bounce off the plaster
       above the gallery. The lenses are HDR so the bloom picks them up. */
    {
      const lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.6, 3.05, 1.86) });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x2b2722, roughness: 0.55, metalness: 0.3, envMapIntensity: 0.6 });
      const haloMat = new THREE.MeshBasicMaterial({
        map: M.glow.map, transparent: true, opacity: 0.34,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
      });
      const downlight = (x, y, z) => {
        // a shallow trim ring, flush with the soffit, and the lens just inside
        const ring = new THREE.CylinderGeometry(0.115, 0.098, 0.028, 16, 1, true);
        ring.translate(x, y - 0.004, z);
        queue(ring, trimMat, false, false);
        const lens = new THREE.CircleGeometry(0.092, 16);
        lens.rotateX(Math.PI / 2);            // face down
        lens.translate(x, y - 0.016, z);
        queue(lens, lensMat, false, false);
        const halo = new THREE.CircleGeometry(0.5, 16);
        halo.rotateX(Math.PI / 2);
        halo.translate(x, y - 0.019, z);
        queue(halo, haloMat, false, false, 4);
      };
      // the living room, under the gallery soffit
      for (const [x, z] of [[-9.5, -4.7], [-7.4, -4.7], [-9.5, -2.7], [-7.4, -2.7]]) downlight(x, F2 - 0.02, z);
      // the hall ceiling, set clear of the skylight
      for (const [x, z] of [[-9.9, -4.9], [-1.2, -4.9], [-9.9, 1.9], [-1.2, 1.9]]) downlight(x, RL - 0.02, z);
      // the wing, over the dining table
      for (const [x, z] of [[8.4, -1.3], [10.4, -1.3], [12.4, -1.3]]) downlight(x, WING.h - 0.04, z);
      // and the upper floor, seen through the front glass
      for (const [x, z] of [[-9.0, 6.4], [-6.0, 6.4]]) downlight(x, RL - 0.02, z);
    }
    // the ceiling bounce high in the void, and a low warm bounce off the oak
    addPoint(-5.4, 7.5, -2.2, MOBILE ? 7 : 13, 13, 0xffb982);
    addPoint(-7.2, 0.7, -3.2, MOBILE ? 2.2 : 3.6, 7, 0xffcb9c);

    // bollards on the terrace
    const bollard = (x, z) => {
      addBox(0.12, 0.5, 0.12, x, 0.25, z, M.bronze, { uv: 0.5 });
      addBox(0.1, 0.04, 0.1, x, 0.5, z, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.7, 1.0) }), { cast: false, receive: false });
      addPoint(x, 0.62, z, MOBILE ? 2.5 : 4, 5, 0xffb877);
    };
    bollard(-6.6, -8.6); bollard(9.6, -8.6);

    await nextTick();

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
      /* the scanned Paper Flower sprigs: one card in five of the procedural
         bracts is replaced by a whole scanned cluster (SUBSTITUTES.md §0), so
         the mass reads as real bougainvillea and the drawn card survives as
         the fine detail between them. Four atlases now: magenta, magenta +
         white, white + magenta and a yellow flowering, so a run of troughs is
         not one colour repeated.                                          */
      const pfMats = [[], [], [], []], pfCols = [[], [], [], []];
      let pfBias = -1;
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
        if (bMats.length % 5 === 0) {
          const w = pfBias >= 0 ? pfBias : ((bMats.length >> 2) & 1);
          vd.rotation.set(rr(-1.1, 1.1), rr(0, 6.3), rr(-1.6, 1.6));
          const sc = rr(0.34, 0.60) * (MOBILE ? 0.86 : 1);
          vd.scale.set(sc, sc, sc);
          vd.updateMatrix();
          pfMats[w].push(vd.matrix.clone());
          const v = rr(0.80, 0.98);
          vc.setRGB(v, v * rr(0.94, 1.0), v * rr(0.92, 1.0));
          pfCols[w].push(vc.clone());
        }
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
      function runner(pts, { r = 0.038, density = 1, droop = 0.55, spread = 0.34, pick = 0, mat = M.bark } = {}) {
        const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal', 0.5);
        queue(limb(curve, { r0: r, r1: r * 0.4, radial: 6, tubular: 18, tile: 0.45 }), mat, true, false);
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

      // 1 · one clean run over the terrace pergola. This is the only place on
      //     the building the bougainvillea is allowed to climb: the entry
      //     canopy, the porch columns, the pier beside the door, the upper
      //     windows and the rear wall are bare stone now, which is what the
      //     villa wanted all along.

      // 2 · over the terrace pergola, both beams and the hanging edge
      runner([[4.4, 3.4, -9.5], [6.2, 3.44, -9.56], [8.0, 3.4, -9.5], [9.9, 3.36, -9.46]],
        { r: 0.045, density: 1.6, droop: 1.2, spread: 0.42, pick: 4 });
      runner([[4.4, 3.38, -6.8], [6.4, 3.42, -6.84], [8.4, 3.38, -6.8], [9.9, 3.34, -6.78]],
        { r: 0.04, density: 1.4, droop: 0.9, spread: 0.38, pick: 5 });
      for (let x = 4.6; x < 9.8; x += 0.62) {
        runner([[x, 3.4, -9.5], [x + rr(-0.1, 0.1), 3.05, -9.62], [x + rr(-0.16, 0.16), 2.62, -9.55]],
          { r: 0.022, density: 1.2, droop: 0.75, spread: 0.3, pick: 1 });
      }
      for (const [px2, pz2] of [[9.8, -9.5], [4.5, -9.5]]) {
        runner([[px2 + 0.1, 0.05, pz2 + 0.1], [px2 + 0.12, 1.1, pz2 + 0.14], [px2 + 0.08, 2.3, pz2 + 0.1],
                [px2 + 0.1, 3.1, pz2 + 0.12]], { r: 0.036, density: 1.1, droop: 0.4, spread: 0.3, pick: 0 });
      }

      // 3 · up the roof-deck pergola only, far from the facade
      runner([[10.6, 6.72, -4.4], [12.4, 6.76, -2.0], [14.4, 6.7, 0.6], [15.6, 6.66, 2.2]],
        { r: 0.04, density: 1.1, droop: 1.2, spread: 0.4, pick: 1 });

      function mass(x0, x1, y0, y1, z0, z1, count, pick) {
        for (let i = 0; i < count; i++) {
          const x = rr(x0, x1), y = rr(y0, y1), z = rr(z0, z1);
          bract(x, y, z, rr(0.07, 0.16), pick + i);
          if (i % 3 === 0) vleaf(x + rr(-0.1, 0.1), y - rr(0.02, 0.12), z + rr(-0.1, 0.1), rr(0.07, 0.15));
        }
      }
      mass(4.2, 9.85, 2.70, 3.55, -9.72, -9.3, MOBILE ? 170 : 430, 4);    // terrace pergola
      mass(10.5, 15.7, 6.35, 6.85, -4.4, 2.2, MOBILE ? 90 : 210, 1);      // roof-deck pergola

      /* ── the terrace and roof-deck planters, planted ──────────────────────
         A green body of leaves fills each trough, and the flowers arrive as
         racemes: tight balls of bracts over the crown and the outer shoulder,
         the way bougainvillea actually flowers, plus two canes spilling over
         the stone. Same instanced cards as the house, so fifteen planted
         troughs cost no new draw.                                          */
      const pf = (a, b) => a + (b - a) * rnd();
      for (const P of PLANTERS) {
        const rim = P.y + P.h;
        const rx = (P.kind === 'round' ? P.r * 1.55 : P.w) * 0.5;
        const rz = (P.kind === 'round' ? P.r * 1.55 : P.d) * 0.5;
        const k = MOBILE ? 0.5 : 1;
        /* the troughs on the roof deck and the main roof are planted with
           scanned species first (fountain grass, ribbon plant, snake plant,
           laurel, cane palm, ground cover) and only a light flowering over
           them, so no two roof troughs carry the same plant */
        const roofTop = P.y > 1.0;
        pfBias = P.pick % 4;
        /* the dome of the planting: high at the centre, low at the stone */
        const dome = (q) => roofTop
          ? rim + (0.05 + 0.50 * (1 - q * q)) * P.spread
          : rim + (0.10 + 0.90 * (1 - q * q)) * P.spread;

        /* the green body */
        const nl = Math.round(P.count * 0.9 * k);
        for (let i = 0; i < nl; i++) {
          const a = rnd() * 6.283, q = Math.pow(rnd(), 0.62);
          vleaf(P.x + Math.cos(a) * q * rx,
                roofTop ? rim + (dome(q) - rim) * pf(0.35, 1) : dome(q) * pf(0.32, 1),
                P.z + Math.sin(a) * q * rz, roofTop ? pf(0.055, 0.105) : pf(0.075, 0.155));
        }

        /* racemes: tight balls of bracts, denser on the sunny shoulder */
        const nc = roofTop
          ? Math.max(3, Math.round((P.w || P.r * 2) * 1.0))
          : Math.max(5, Math.round((P.w || P.r * 2) * 3.6));
        for (let c = 0; c < nc; c++) {
          const a = rnd() * 6.283, q = Math.pow(rnd(), 0.45);
          const cx = P.x + Math.cos(a) * q * rx * 0.94;
          const cz = P.z + Math.sin(a) * q * rz * 0.94;
          const cy = roofTop ? rim + (dome(q) - rim) * pf(0.45, 1.0) : dome(q) * pf(0.66, 1.0);
          const n = Math.round(pf(17, 30) * k) + 6;
          for (let i = 0; i < n; i++) {
            const th = rnd() * 6.283, ph = Math.acos(pf(-0.7, 1));
            const rad = pf(0.012, 0.115);
            bract(cx + Math.sin(ph) * Math.cos(th) * rad * 1.2,
                  cy + Math.cos(ph) * rad * 0.8,
                  cz + Math.sin(ph) * Math.sin(th) * rad * 1.2,
                  pf(0.055, 0.108), P.pick + i + c);
          }
          if (c % 2 === 0) vleaf(cx, cy - 0.05, cz, pf(0.08, 0.15));
        }

        /* two canes arching out of the soil and spilling over the rim, on the
           terrace troughs only: a roof planter is read from below, so there
           is nothing to spill over */
        for (let k2 = 0; k2 < (roofTop ? 0 : 2); k2++) {
          const a = rnd() * 6.283, sx = Math.cos(a), sz = Math.sin(a);
          const r0 = pf(0.06, 0.22);
          runner([
            [P.x + sx * r0, rim - 0.18, P.z + sz * r0],
            [P.x + sx * rx * 0.58, rim + P.spread * 0.70, P.z + sz * rz * 0.58],
            [P.x + sx * rx * 1.22, rim + P.spread * 0.48, P.z + sz * rz * 1.22],
            [P.x + sx * rx * 1.66, rim - 0.08, P.z + sz * rz * 1.66]
          ], { r: 0.016, density: 0.9, droop: 0.28, spread: 0.14, pick: P.pick + 3, mat: M.oakDark });
        }
      }

      /* ── the front wall: one clipped bougainvillea, on purpose ────────────
         Rooted in a travertine trough on the porch apron, against the stone
         pier between the living-room glass and the entry. Three canes climb
         the pier, the crown spills under the cedar soffit and two runners
         drop over the porch edge. It never reaches the glass, the door head
         or the upper windows: this is the one place on the house the paper
         flower is allowed to grow.                                        */
      {
        const PX0 = -3.02, PX1 = -1.50, PZ0 = 6.74, PZ1 = 7.28;
        const w = PX1 - PX0, dd = PZ1 - PZ0, cx = (PX0 + PX1) / 2, cz = (PZ0 + PZ1) / 2;
        const H = 0.50, th = 0.065;
        /* the trough: a travertine box, one course of stone, 60 mm proud of
           the apron so it casts its own shadow line */
        addBox(w, 0.06, dd, cx, 0.09, cz, M.stonePale, { uv: 0.5 });
        for (const s of [-1, 1]) {
          addBox(w, H, th, cx, 0.06 + H / 2, cz + s * (dd / 2 - th / 2), M.stonePale, { uv: 0.5 });
          addBox(th, H, dd - th * 2, cx + s * (w / 2 - th / 2), 0.06 + H / 2, cz, M.stonePale, { uv: 0.5 });
        }
        addPlane(w - th * 2 - 0.02, dd - th * 2 - 0.02, cx, 0.06 + H - 0.09, cz, M.dark, { receive: true });
        contactShadow(cx, cz, w + 0.34, dd + 0.34, true, 0.065);

        const RY = 0.06 + H - 0.10;          // soil
        const RX = cx - 0.06;
        /* the canes: three woody stems, thickening at the base */
        runner([[RX + 0.02, RY, 6.98], [RX + 0.06, 1.30, 6.97], [RX - 0.02, 2.30, 6.95],
                [RX + 0.04, 3.30, 6.95], [RX, 3.84, 6.96]],
          { r: 0.042, density: 1.5, droop: 0.22, spread: 0.20, pick: 0 });
        runner([[RX - 0.30, RY - 0.02, 7.04], [RX - 0.36, 1.45, 6.98], [RX - 0.30, 2.55, 6.96],
                [RX - 0.22, 3.55, 6.97], [RX - 0.18, 3.86, 7.02]],
          { r: 0.034, density: 1.3, droop: 0.22, spread: 0.18, pick: 1 });
        runner([[RX + 0.34, RY - 0.02, 6.98], [RX + 0.40, 1.5, 6.96], [RX + 0.34, 2.6, 6.95],
                [RX + 0.26, 3.6, 6.96], [RX + 0.22, 3.86, 7.00]],
          { r: 0.032, density: 1.3, droop: 0.2, spread: 0.18, pick: 3 });

        /* the climb: four loose strands up the pier, never a slab of colour,
           each with its own green so the wall reads as a vine, not a ribbon */
        const nS = LEAN ? 44 : 120;
        for (let s = 0; s < 4; s++) {
          const bx = PX0 + 0.22 + s * 0.34;
          mass(bx - 0.19, bx + 0.19, 0.62, 3.62, 6.90, 7.10, nS, s + 1);
          for (let k = 0; k < (LEAN ? 26 : 64); k++) {
            vleaf(bx + rr(-0.30, 0.30), rr(0.55, 3.65), 6.90 + rr(-0.03, 0.16), rr(0.08, 0.16));
          }
        }
        /* the crown: it lifts off the pier and runs the soffit, twice as deep in
           z as the climb and thinning at both ends, the way a clipped vine
           flowers where the sun catches it */
        mass(PX0 - 0.10, PX1 + 0.26, 3.56, 4.02, 6.90, 7.84, LEAN ? 210 : 520, 2);
        mass(PX0 - 0.05, PX0 + 1.05, 3.66, 4.03, 7.62, 8.02, LEAN ? 55 : 140, 4);
        mass(PX1 - 0.55, PX1 + 0.34, 3.62, 4.02, 7.30, 7.86, LEAN ? 45 : 120, 0);
        for (let k = 0; k < (LEAN ? 30 : 78); k++) {
          vleaf(rr(PX0 - 0.12, PX1 + 0.26), rr(3.56, 4.0), rr(6.9, 7.9), rr(0.08, 0.15));
        }

        /* two runners spilling over the porch edge, so the crown has weight */
        for (const [tx, tz] of [[RX - 0.55, 7.75], [RX + 0.42, 7.7]]) {
          runner([[tx, 3.92, 7.35], [tx + rr(-0.08, 0.08), 3.62, 7.72],
                  [tx + rr(-0.12, 0.12), 3.20, 7.94], [tx + rr(-0.12, 0.12), 2.86, 8.02]],
            { r: 0.018, density: 1.5, droop: 0.5, spread: 0.26, pick: 5, mat: M.bark });
        }
        /* a little green at the soil line, so the canes are planted */
        for (let i = 0; i < (LEAN ? 10 : 22); i++) {
          vleaf(cx + rr(-0.62, 0.62), RY + rr(0.02, 0.16), cz + rr(-0.2, 0.2), rr(0.09, 0.16));
        }
      }

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

      /* the four scanned Paper Flower atlases, over the same masses */
      const pfTex = [loadAtlas('paperflower_pf09.webp'), loadAtlas('paperflower_pf02.webp'),
                     loadAtlas('paperflower_pf01.webp'), loadAtlas('paperflower_pf00.webp')];
      for (let w = 0; w < 4; w++) {
        if (!pfMats[w].length) continue;
        const mat = windify(new THREE.MeshStandardMaterial({
          map: pfTex[w], alphaTest: 0.40, side: THREE.DoubleSide,
          roughness: 0.80, metalness: 0.0, envMapIntensity: 0.55,
          emissive: new THREE.Color(0x1c0710), emissiveIntensity: 0.10
        }), { amp: 0.075, freq: 1.45, height: 3.4, soft: 0.22, fill: [0.16, 0.10, 0.12], trans: 0.18 });
        const mesh = new THREE.InstancedMesh(bGeo, mat, pfMats[w].length);
        pfMats[w].forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, pfCols[w][i]); });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        world.add(mesh);
      }
    }

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
      const driveHalf = (t) => t > tWALL
        ? lerp(1.62, 1.52, clamp((t - tWALL) / (1 - tWALL)))
        : lerp(1.65, 1.44, t);

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
        if (onStreet(x, z, 2.6)) return true;                              // the city streets and their pavements
        if (driveDist(x, z) < 1.05) return true;                            // the walk, shoulders included
        if (x > -5.2 && x < 5.2 && z > G.z1 - 0.2 && z < 9.6) return true;  // the entry apron
        if (x > -5.4 && x < 7.1 && z > 8.8 && z < 25.4) return true;        // the arrival court
        if (estateBand(x, z)) return true;                                   // the wall's footprint
        if (x > G.x0 - 1.2 && x < WING.x1 + 1.2 && z > G.z0 - 1.2 && z < S.z1 + 1.3) return true;
        if (x > -4.4 && x < 4.2 && z > S.z1 && z < 12.2) return true;   // the entrance walk
        if (x > -9.8 && x < 12.8 && z > -10.4 && z < -5.5) return true;
        if (x > POOL.x0 - 1.1 && x < POOL.x1 + 1.1 && z > POOL.z0 - 1.1 && z < POOL.z1 + 1.1) return true;
        // the carport court, the wellness pavilion, the play court and the
        // garden beds keep their own surfaces; no lawn tufts on them
        if (x > 5.6 && x < 13.6 && z > 11.2 && z < 17.8) return true;
        if (x > 2.1 && x < 7.0 && z > 11.6 && z < 17.4) return true;   // its link apron
        if (x > 5.8 && x < 10.2 && z > 16.8 && z < 25.4) return true;  // its driveway spur
        if (x > -15.0 && x < -7.9 && z > -14.7 && z < -9.1) return true;
        if (x > 17.9 && x < 26.5 && z > -3.8 && z < 6.2) return true;
        if (x > -17.4 && x < -13.0 && z > -5.0 && z < -2.2) return true;
        if (x > -17.5 && x < -14.6 && z > -9.2 && z < -7.2) return true;
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
              /* the lawn mat is the garden's own carpet: it ends at the estate
                 wall, so it can never lie over the new city streets */
              'vec2 le = abs(vWPos.xz - vec2(1.75, -4.75)) - vec2(29.25, 29.75);\n' +
              'float lsd = length(max(le, vec2(0.0))) + min(max(le.x, le.y), 0.0);\n' +
              'float lawnFade = 1.0 - smoothstep(0.0, 7.0, lsd);\n' +
              'diffuseColor.a *= lawnFade;\n' +
              /* the pool is cut out of the mat as well as the ground: without
                 this the garden carpet lies a translucent skin over the water
                 and the pool reads as a murky green mirror instead of water */
              'vec2 poolQ = abs(vWPos.xz - vec2(2.6, -14.7)) - vec2(6.05, 5.15);\n' +
              'float poolSd = length(max(poolQ, vec2(0.0))) + min(max(poolQ.x, poolQ.y), 0.0);\n' +
              'if (poolSd < 0.03) discard;\n' +
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

      /* the lawn: a lean phone carries 9–12k tufts instead of 19k. The blades
         are drawn wider (see uBladeW) so the same ground still reads as turf,
         which is a tenth of the vertex work for no visible hole */
      const N = Math.round((LEAN ? (LOWRAM ? 4200 : 12000) : (TABLET ? 30000 : 40000)) * clamp(opts.grassDensity, 0.15, 1));
      ctxStats.grassTufts = N;
      const aRoot = new Float32Array(N * 3);
      const aParam = new Float32Array(N * 4);
      const aTint = new Float32Array(N);

      let i = 0, guard = 0;
      while (i < N && guard < N * 10) {
        guard++;
        let x, z;
        const roll = rnd();
        if (roll < 0.50) {
          // along the drive — this is where the camera actually is
          const t = 0.20 + 0.80 * Math.pow(rnd(), 0.5);
          const p = drive.getPoint(t);
          const tan = drive.getTangent(t);
          const nx = -tan.z, nz = tan.x;
          const side = rnd() > 0.5 ? 1 : -1;
          const off = side * (1.45 + Math.pow(rnd(), 1.25) * 22);
          x = p.x + nx * off; z = p.z + nz * off;
        } else if (roll < 0.69) {
          /* the rear garden behind the villa: the lawn the pool sits in. It is
             sampled on its own so the back of the house is a lawn, not a
             thinning-out of the front field. */
          x = -19.5 + Math.pow(rnd(), 0.82) * 36;
          z = -6.2 - Math.pow(rnd(), 0.82) * 23.5;
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
        /* on a lean phone the lawn carries two thirds of the tufts, so each
           card is drawn a fifth wider: same coverage, fewer vertices */
        const w = h * rr(1.15, 1.75) * (LEAN ? 1.22 : 1);

        // a little jitter, so the sampling never shows as rows
        x += rr(-0.35, 0.35); z += rr(-0.35, 0.35);
        aRoot[i * 3] = x;
        aRoot[i * 3 + 1] = bend(x, z) + 0.015;   // the root follows the land
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
            vec3 lush = vec3(0.175, 0.215, 0.098);
            vec3 straw = vec3(0.315, 0.282, 0.158);
            vec3 base = mix(lush, straw, dry);

            // per-tuft light, and a root that sits in its own shadow — but a
            // mown lawn has no black root, only a deeper green
            base *= 0.58 + 0.50 * smoothstep(-0.02, 0.85, position.y);
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
            if (texel.a < 0.36) discard;

            vec3 albedo = vCol * texel.rgb * 2.62;

            // a card's face is mostly up-facing, so the light comes from the sky
            vec3 N = normalize(vec3(0.0, 1.0, 0.0));
            float ndl = max(dot(N, uSunDir), 0.0);
            /* a card's normal is the sky, but the sun still rakes across a mown
               lawn at 17° and lights most of each blade: at 1.16 the field sat
               in permanent half-shade and read as scrub */
            vec3 col = albedo * (uSkyCol * 1.62 + uSunCol * ndl * 2.05);
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
      dummy.scale.set(s * 1.3, s * 1.3, s * 1.3);
      dummy.updateMatrix();
      leafMatrices.push(dummy.matrix.clone());
      // silver, not green: the tint stays neutral so the card reads grey-sage
      tmpCol.setRGB(lit * rr(0.92, 1.02), lit * rr(0.96, 1.04), lit * rr(0.92, 1.02));
      leafColors.push(tmpCol.clone());
    }

    /* v6 put every card at a random 3D angle, so most stood edge-on to the
       camera and the crown leaked light. A card in a canopy lies tangent to
       its crown: the face turns outward along the crown radius, with a random
       roll and a small tilt so the layers never line up into planes. */
    const _cardN = new THREE.Vector3(), _cardQ = new THREE.Quaternion(),
      _cardZ = new THREE.Vector3(0, 0, 1);
    function faceAt(x, y, z, s, lit, nx, ny, nz) {
      _cardN.set(nx, ny, nz);
      if (_cardN.lengthSq() < 1e-6) _cardN.set(0, 1, 0);
      _cardN.normalize();
      _cardQ.setFromUnitVectors(_cardZ, _cardN);
      dummy.position.set(x, y, z);
      dummy.quaternion.copy(_cardQ);
      dummy.rotateZ(rr(0, Math.PI * 2));
      dummy.rotateX(rr(-0.40, 0.40));
      dummy.rotateY(rr(-0.40, 0.40));
      dummy.scale.set(s * 1.55 * rr(0.90, 1.10), s * 1.55 * rr(0.90, 1.10), s);
      dummy.updateMatrix();
      leafMatrices.push(dummy.matrix.clone());
      tmpCol.setRGB(lit * rr(0.92, 1.02), lit * rr(0.96, 1.04), lit * rr(0.92, 1.02));
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
        }), M.oliveBark, true, false);
        tips.push({ p: end, s: rr(0.85, 1.25) * scale, from: c.getPoint(0.45) });

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
          }), M.oliveTwig, true, false);
          tips.push({ p: tp, s: rr(0.6, 0.95) * scale, from });
        }
      }

      /* ── the crown ──────────────────────────────────────────────────────
         An olive's crown is one broad, low, irregular mass, wider than it is
         tall: a handful of overlapping lobes rather than a ball on a stick.
         Every card lies tangent to its lobe and turns its face outward, with a
         random roll and a small tilt, so the layers close into a felted silver
         surface from every angle and the rim still breaks up ragged. Two
         clumps sit deep in the core so the gaps between cards read as shadow
         in the canopy rather than as sky. */
      const ccx = x + lean * 0.95, ccz = z + leanZ * 0.95, ccy = h * 0.97;
      const R = 1.60 * scale;
      const lobes = [
        [0.00, 0.06, 0.02, 1.00],
        [-0.70, -0.08, 0.42, 0.74],
        [0.72, 0.02, -0.36, 0.80],
        [-0.30, 0.40, -0.60, 0.58],
        [0.34, 0.34, 0.58, 0.56],
        // a low lobe that rounds the underside and closes over the fork
        [0.10, -0.56, 0.24, 0.62]
      ];
      for (const [ox, oy, oz, lr] of lobes) {
        const lx = ccx + ox * scale, ly = ccy + oy * scale, lz = ccz + oz * scale;
        const rx = R * lr, ry = R * lr * 0.76, rz = R * lr;
        const n = Math.round((MOBILE ? 190 : 430) * lr);
        for (let i = 0; i < n; i++) {
          const a = rnd() * Math.PI * 2, b = Math.acos(rr(-1, 1));
          const dx = Math.sin(b) * Math.cos(a), dy = Math.cos(b), dz = Math.sin(b) * Math.sin(a);
          // most leaves on the surface, the rest filling a thickness behind it
          const k = 0.54 + 0.46 * Math.pow(rnd(), 0.55);
          const px = lx + dx * rx * k, py = ly + dy * ry * k, pz = lz + dz * rz * k;
          const up = clamp((py - (ccy - R * 0.8)) / (R * 1.6));
          const size = (0.16 + 0.11 * k) * scale * rr(0.84, 1.18);
          faceAt(px, py, pz, size, 0.62 + 0.40 * up + rr(-0.05, 0.05), dx, dy * 1.7, dz);
        }
      }
      // every limb and twig wears its own leaves out to its tip, so no bare
      // olive wood is left standing out of the crown like straw
      for (const tip of tips) {
        const cardsPer = MOBILE ? 22 : 38;
        for (let k = 0; k < cardsPer; k++) {
          const a = rnd() * Math.PI * 2, b = Math.acos(rr(-1, 1));
          const u = rr(0.42, 1.0);
          const bx = lerp(tip.from.x, tip.p.x, u);
          const by = lerp(tip.from.y, tip.p.y, u);
          const bz = lerp(tip.from.z, tip.p.z, u);
          const rad = Math.pow(rnd(), 0.45) * tip.s * (0.85 - 0.30 * u);
          const px = bx + Math.sin(b) * Math.cos(a) * rad;
          const py = by + Math.cos(b) * rad * 0.66 + rr(0, 0.08) * tip.s;
          const pz = bz + Math.sin(b) * Math.sin(a) * rad;
          faceAt(px, py, pz, rr(0.13, 0.24) * scale,
            0.66 + 0.26 * clamp((py - h * 0.7) / (h * 0.6)) + rr(-0.05, 0.05),
            px - ccx, py - ccy, pz - ccz);
        }
      }
      // the core: cards through the middle of the mass, turned every way, so
      // the crown is a volume with shade in it rather than a shell round a hole
      {
        const n = LOWRAM ? 56 : (MOBILE ? 150 : 320);
        for (let i = 0; i < n; i++) {
          const a = rnd() * Math.PI * 2, b = Math.acos(rr(-1, 1));
          const k = Math.pow(rnd(), 0.7) * 0.72;
          const px = ccx + Math.sin(b) * Math.cos(a) * R * k;
          const py = ccy + Math.cos(b) * R * 0.74 * k;
          const pz = ccz + Math.sin(b) * Math.sin(a) * R * k;
          const up = clamp((py - (ccy - R * 0.8)) / (R * 1.6));
          cardAt(px, py, pz, rr(0.13, 0.24) * scale, 0.60 + 0.30 * up + rr(-0.04, 0.04));
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
  const K = Math.max(4, Math.round((MOBILE ? 7 : 11) * dense));
  const hx = Math.cos(az), hz = Math.sin(az);
  const ct = Math.cos(twist), st = Math.sin(twist);
  const lat = new THREE.Vector3(-hz * ct, st, hx * ct);   // across the frond
  const fold = 0.30;                                      // how deep the V is

  const rib = (s) => new THREE.Vector3(
    ox + hx * len * s,
    oy + len * (Math.sin(pitch) * s - droop * s * s),
    oz + hz * len * s);

  const pos = [], col = [], uv = [], idx = [];
  let vo = 0;
  for (let k = 0; k <= K; k++) {
    const s = k / K;
    const p = rib(s);
    // the frond's outline: narrow at the base, fullest at 40%, short at the tip
    const w = len * 0.155 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.10 + s * 0.94)), 0.55) * (1 - 0.30 * s);
    const shade = 0.60 + 0.42 * Math.min(1, s * 1.4);     // dark at the crown, lit at the tip
    for (const side of [-1, 0, 1]) {
      const q = p.clone()
        .addScaledVector(lat, side * w)
        .addScaledVector(new THREE.Vector3(0, 1, 0), -Math.abs(side) * w * fold);
      pos.push(q.x, q.y, q.z);
      uv.push(0.5 + side * 0.5, s);
      col.push(shade * (side === 0 ? 1.05 : 1.0), shade * (side === 0 ? 1.06 : 1.02), shade * (side === 0 ? 1.0 : 0.92));
    }
    if (k < K) {
      const a = vo;
      idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
    }
    vo += 3;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // fronds read lit from above on both faces, so the underside is never black
  const na = g.attributes.normal;
  for (let i = 0; i < na.count; i++) na.setY(i, Math.abs(na.getY(i)) + 0.55);
  // the rachis points, for the tube the caller draws along the rib
  const pts = [];
  for (let k = 0; k <= K * 2; k++) pts.push(rib(k / (K * 2)));
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
      const nF = MOBILE ? 27 : 44;
      for (let i = 0; i < nF; i++) {
        const az = (i / nF) * Math.PI * 2 + rr(-0.14, 0.14);
        const rank = i % 3;                     // 0 skirt, 1 middle, 2 upper
        const pitch = rank === 0 ? rr(-0.42, -0.02)
          : rank === 1 ? rr(0.18, 0.62)
            : rr(0.66, 1.18);
        const len = rr(2.8, 4.1) * scale * (rank === 0 ? 0.92 : 1.0);
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

      /*  Coconuts: the bunch a date palm carries under its crown. Six to ten
          husks hung just below the fronds where the light catches them. Bigger
          than a real nut on purpose: at 390 px a true 15 cm coconut is a single
          pixel, and the point of him asking for them is that you can see them.
          Queued into one merged mesh per material, so the quartet of palms adds
          no draw call. */
      {
        const nB = 2;
        for (let b = 0; b < nB; b++) {
          const az = (b / nB) * Math.PI * 2 + rr(-0.55, 0.55);
          const rad = 0.46 * scale;
          const cx = top.x + Math.cos(az) * rad;
          const cz = top.z + Math.sin(az) * rad;
          const cy = top.y - 0.86 * scale;
          const n = LOWRAM ? 6 : 6 + Math.round(rnd() * 4);
          for (let k = 0; k < n; k++) {
            const r = (0.15 + rr(-0.012, 0.02)) * scale;
            const g = new THREE.SphereGeometry(r, 6, 5);
            const ang = (k / n) * Math.PI * 2 + rr(-0.35, 0.35);
            const out = rr(0.04, 0.17) * scale;
            const drop = rr(0, 0.34) * scale;
            g.translate(cx + Math.cos(ang) * out, cy - drop, cz + Math.sin(ang) * out);
            const t = drop / (0.34 * scale);           // green at the crown, husk lower
            const col = new THREE.Color().setHSL(0.17 - 0.095 * t, 0.46 + 0.10 * t, 0.28 - 0.09 * t).convertSRGBToLinear();
            const ca = new Float32Array(g.attributes.position.count * 3);
            for (let v = 0; v < g.attributes.position.count; v++) {
              ca[v * 3] = col.r; ca[v * 3 + 1] = col.g; ca[v * 3 + 2] = col.b;
            }
            g.setAttribute('color', new THREE.BufferAttribute(ca, 3));
            queue(g, M.coconut, true, false);
          }
        }
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
    /*  The two olive balls that used to stand here were the last cartoon
        silhouettes in the approach: a crown of cards on a smooth trunk. They
        are now two Quixel planting groups — a fan palm, a spineless yucca and
        a clump of spotted laurel each — laid out through the mega-spot table
        at the end of the build, so every leaf in the foreground is a scan. */

    /* date palms: four Gulf date palms standing on the four corners of the
       house + terrace + pool plinth, the way four minarets frame the Taj. One
       height, one lean length, each leaning out along the plinth's own
       diagonal, so the quartet is a measured set rather than a grove: the
       approach passes between the front pair, and the orbit turns inside them.
       Kept clear of the gravel, the entry canopy, the wing and the pool. */
    const PALM_FRAME = { cx: 1.0, cz: -2.0, h: 10.8, bend: 0.52 };
    [[-19.2, 13.0], [22.4, 13.0], [-19.2, -26.4], [22.4, -26.4]]
      .forEach(([x, z]) => {
        const dir = Math.atan2(z - PALM_FRAME.cz, x - PALM_FRAME.cx);
        addPalm(x, z, 1, { h: PALM_FRAME.h, bend: PALM_FRAME.bend, dir });
      });

    // the palms are their own materials, so the quartet switches as one group
    setPalms = (on) => {
      for (const m of [M.palmBark, M.palmCrown, M.palmLeaf, M.palmRachis, M.palmDry, M.dates, M.coconut]) {
        const mesh = BUCKET_MESH.get(m);
        if (mesh) mesh.visible = !!on;
      }
      drawFrame();
    };

    // (low shrubs are grass tufts and vine skirts now — no separate pass)

    await nextTick();

    /* ── the country beyond the wall ───────────────────────────────────────
       The estate has to stand in a real place, not on a table. Out in the
       dunes: a scatter of date palms seen at 40–160 m, where only the
       silhouette reads, so each is a leaning trunk and a crown of eleven
       ribbon fronds — a couple of hundred triangles instead of twenty
       thousand. And low scrub between them, tinted into the same dune tones
       as the ground so nothing looks placed in a row.                      */
    {
      /** A palm for the middle distance: silhouette first, detail never. */
      const farPalm = (x, z, scale) => {
        const base = terrainH(x, z);
        const h = rr(5.2, 7.8) * scale;
        const dir = rr(0, 6.3), lean = rr(0.35, 1.25) * scale;
        const dx = Math.cos(dir), dz = Math.sin(dir);
        const spine = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x, base - 0.15, z),
          new THREE.Vector3(x + dx * lean * 0.3, base + h * 0.42, z + dz * lean * 0.3),
          new THREE.Vector3(x + dx * lean * 0.68, base + h * 0.76, z + dz * lean * 0.68),
          new THREE.Vector3(x + dx * lean, base + h, z + dz * lean)
        ], false, 'centripetal', 0.5);
        queue(limb(spine, {
          r0: 0.26 * scale, r1: 0.155 * scale, radial: 6, tubular: 8,
          flare: 0.34, flareLen: 0.55 * scale, tile: 0.5 * scale
        }), M.palmBark, false, true);
        const top = spine.getPointAt(1);
        const nF = 11;
        for (let i = 0; i < nF; i++) {
          const az = (i / nF) * 6.283 + rr(-0.22, 0.22);
          const up = i % 2 === 0;
          const f = frondGeo(top.x, top.y + rr(-0.08, 0.12), top.z, az,
            up ? rr(0.25, 0.85) : rr(-0.32, 0.05),
            rr(2.0, 3.1) * scale, up ? rr(0.5, 0.8) : rr(0.6, 1.0),
            rr(-0.45, 0.45), 0.3);
          queue(f.geo, up ? M.palmLeaf : M.palmDry, false, false);
        }
        contactShadow(x + dx * lean * 0.2, z + dz * lean * 0.2, 1.4 * scale, 1.4 * scale, true, base + 0.04);
      };

      const spots = [];
      const target = MOBILE ? 9 : 19;
      for (let guard = 0; spots.length < target && guard < 900; guard++) {
        const a = rr(0, 6.283), r = 38 + Math.pow(rnd(), 0.62) * 118;
        const x = 2 + Math.cos(a) * r, z = -6 + Math.sin(a) * r * 1.05;
        if (x > ESTATE.x0 - 5 && x < ESTATE.x1 + 5 && z > ESTATE.z0 - 5 && z < ESTATE.z1 + 5) continue;
        if (onStreet(x, z, 3.5)) continue;                            // out of the traffic
        if (Math.abs(x - driveCX(z)) < 9 && z > ESTATE.z1) continue;   // off the lane
        if (spots.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 13)) continue;
        spots.push([x, z]);
        farPalm(x, z, rr(0.86, 1.22));
      }

      /* scrub: two or three dark clumps per bush, sitting on the sand */
      const nScrub = MOBILE ? 24 : 46;
      for (let i = 0, guard = 0; i < nScrub && guard < 1200; guard++) {
        const a = rr(0, 6.283), r = 150 + Math.pow(rnd(), 0.7) * 260;
        const x = 2 + Math.cos(a) * r, z = -6 + Math.sin(a) * r * 1.05;
        if (onStreet(x, z, 2)) continue;
        if (x > ESTATE.x0 - 2.5 && x < ESTATE.x1 + 2.5 && z > ESTATE.z0 - 2.5 && z < ESTATE.z1 + 2.5) continue;
        if (Math.abs(x - driveCX(z)) < 7 && z > ESTATE.z1) continue;
        const y = terrainH(x, z);
        const s = rr(0.55, 1.25);
        const hue = rr(0.19, 0.25), sat = rr(0.18, 0.34), lit = rr(0.10, 0.20);
        for (let k = 0; k < 3; k++) {
          clumpAt(x + rr(-0.6, 0.6) * s, y + rr(0.16, 0.42) * s, z + rr(-0.6, 0.6) * s,
            s * rr(0.5, 0.9), s * rr(0.35, 0.6), s * rr(0.5, 0.9), hue, sat, lit);
        }
        i++;
      }
    }

    /* ─────────────────────────────────────────────────────────────────────
       10b · the neighbourhood
       The villa no longer stands on a dune with a rumour of a city on the
       horizon: it stands in the middle of a Dubai neighbourhood. Four avenues
       wrap the plot, a cross grid runs out to the mid-rise ring, and the
       approach is a boulevard that comes in off the desert road between walled
       villas and apartment blocks. Every piece of it is outside the 58.5 ×
       59.5 m estate wall, and every piece of it is merged into the batches
       that were already there, so the whole city costs a handful of draws.
       ───────────────────────────────────────────────────────────────────── */
    {
      /* ── a local frame: each plot is authored at the origin and then put
         where it belongs, so a house can face any of the four streets ────── */
      const frameOf = (x, z, ry) => new THREE.Matrix4().makeRotationY(ry).setPosition(x, 0, z);
      const uBox = (mat, w, h, d, lx, ly, lz, f, uv = 0) => {
        const g = new THREE.BoxGeometry(w, h, d);
        if (uv) worldUV(g, uv);
        g.translate(lx, ly, lz);
        if (f) g.applyMatrix4(f);
        queue(g, mat, false, true, 0);
      };

      /* ── the streets: asphalt, kerb, sidewalk, centre line ────────────────
         Each street is a plane and a pair of raised sidewalks, so the road has
         a real 15 cm kerb to sit in. Every surface is nudged a fraction of a
         millimetre apart by its index: two coplanar surfaces at a crossing
         would otherwise z-fight along the whole intersection.               */
      let si = 0;
      for (const S of STREETS) {
        const yA = 0.030 + si * 0.0012;
        const yW = 0.075 + si * 0.0009;
        const len = S.to - S.from, mid = (S.from + S.to) / 2;
        const alongX = S.axis === 'x';
        if (alongX) addPlane(len, S.half * 2, mid, yA, S.at, M.asphalt, { uv: 0.34 });
        else addPlane(S.half * 2, len, S.at, yA, mid, M.asphalt, { uv: 0.34 });
        for (const sd of [-1, 1]) {
          const o = sd * (S.half + 0.14 + S.walk / 2);
          if (alongX) {
            addBox(len, 0.17, 0.30, mid, 0.085, S.at + sd * (S.half + 0.15), M.stonePale, { uv: 0.44, cast: false });
            addBox(len, 0.15, S.walk, mid, yW, S.at + o, M.pave, { uv: 0.42, cast: false });
          } else {
            addBox(0.30, 0.17, len, S.at + sd * (S.half + 0.15), 0.085, mid, M.stonePale, { uv: 0.44, cast: false });
            addBox(S.walk, 0.15, len, S.at + o, yW, mid, M.pave, { uv: 0.42, cast: false });
          }
        }
        if (S.main) {
          for (let u = S.from + 9; u < S.to - 9; u += 8) {
            if (alongX) addPlane(3.4, 0.15, u, yA + 0.004, S.at, M.line);
            else addPlane(0.15, 3.4, S.at, yA + 0.004, u, M.line);
          }
        }
        si++;
      }
      // a zebra crossing on the front avenue, either side of the villa's gate
      for (const cxz of [-9.5, 13.5]) {
        for (let k = 0; k < 5; k++) {
          addPlane(0.55, 7.6, cxz + k * 1.15, 0.036, 40.0, M.line);
        }
      }

      /* ── street lamps: a bronze pole, an arm over the asphalt, a warm head ── */
      const lamp = (x, z, ry) => {
        const f = frameOf(x, z, ry);
        uBox(M.bronze, 0.16, 0.06, 0.16, 0, 0.03, 0, f);
        uBox(M.bronze, 0.115, 5.1, 0.115, 0, 2.55, 0, f);
        uBox(M.bronze, 0.085, 0.085, 1.15, 0, 5.04, -0.5, f);
        uBox(M.lampLit, 0.46, 0.10, 0.24, 0, 4.98, -1.0, f);
        uBox(M.bronze, 0.26, 0.06, 0.34, 0, 5.06, -1.0, f);
        contactShadow(x, z, 0.85, 0.85, true, 0.032);
      };

      /* ── a street palm: silhouette and a real crown, about 200 triangles ── */
      const streetPalm = (x, z, scale) => {
        const h = rr(6.2, 9.0) * scale;
        const dir = rr(0, 6.283), lean = rr(0.25, 0.85);
        const dx = Math.cos(dir), dz = Math.sin(dir);
        const spine = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x, -0.1, z),
          new THREE.Vector3(x + dx * lean * 0.32, h * 0.42, z + dz * lean * 0.32),
          new THREE.Vector3(x + dx * lean * 0.72, h * 0.78, z + dz * lean * 0.72),
          new THREE.Vector3(x + dx * lean, h, z + dz * lean)
        ], false, 'centripetal', 0.5);
        queue(limb(spine, {
          r0: 0.24 * scale, r1: 0.15 * scale, radial: 6, tubular: 8,
          flare: 0.4, flareLen: 0.7 * scale, tile: 0.5 * scale
        }), M.palmBark, false, true);
        const top = spine.getPointAt(1);
        for (let i = 0; i < 9; i++) {
          const az = (i / 9) * 6.283 + rr(-0.24, 0.24);
          const up = i % 2 === 0;
          const f = frondGeo(top.x, top.y + rr(-0.08, 0.1), top.z, az,
            up ? rr(0.3, 0.9) : rr(-0.3, 0.05),
            rr(2.1, 3.2) * scale, up ? rr(0.5, 0.8) : rr(0.6, 1.0), rr(-0.5, 0.5), 0.32);
          queue(f.geo, up ? M.palmLeaf : M.palmDry, false, false);
        }
        contactShadow(x + dx * lean * 0.2, z + dz * lean * 0.2, 1.3 * scale, 1.3 * scale, true, 0.032);
      };

      const nearHome = (x, z, r) => Math.hypot(x - HOME.x, z - HOME.z) < r;
      /** On the approach boulevard itself: no lamp or palm may stand in it. */
      const onBoulevard = (x, z, pad = 0) => z > 8 && z < 720 && Math.abs(x - driveCX(z)) < 6.8 + pad;

      /* ── the approach becomes a boulevard ──────────────────────────────────
         Inside the gate the drive is gravel, as it should be. The moment it
         clears the estate wall it is a street: asphalt over the gravel, kerbs,
         sidewalks and a planted verge on both sides, running out of the
         neighbourhood the way it always ran out of sight. The camera comes in
         along it, so this is the surface the whole first act plays over.      */
      {
        /* the boulevard runs from the far end of the approach up to the wall,
           never past it: inside the wall the surface is the stone walk */
        const tGate = tWALL;
        const yOf = (p) => terrainH(p.x, p.z);
        const strip = (w, y, lift, mat, segs = 120) => {
          const pos = [], uv = [], idx = [];
          const runLen = drive.getLength();
          for (let i = 0; i <= segs; i++) {
            const t = lerp(0, tGate, i / segs), p = drive.getPoint(t), tan = drive.getTangent(t);
            const nx = -tan.z, nz = tan.x, l = Math.hypot(nx, nz) || 1;
            const yy = yOf(p) + lift;
            for (const s of [-1, 1]) {
              pos.push(p.x + (nx / l) * w * s, yy, p.z + (nz / l) * w * s);
              // world-scale UVs, so the scanned tarmac keeps its grain size
              uv.push((s * w + w) * 0.34, (i / segs) * runLen * 0.34);
            }
            if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
          }
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
          g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
          g.setIndex(idx);
          g.computeVertexNormals();
          queue(g, mat, false, true, 0);
        };
        strip(3.6, 0, 0.048, M.asphalt);
        for (const sd of [-1, 1]) {
          // a sidewalk down each side of the boulevard, kerb-high
          const pos = [], uv = [], idx = [];
          const N = 120;
          for (let i = 0; i <= N; i++) {
            const t = lerp(0, tGate, i / N), p = drive.getPoint(t), tan = drive.getTangent(t);
            const nx = -tan.z, nz = tan.x, l = Math.hypot(nx, nz) || 1;
            const o0 = sd * 3.62, o1 = sd * 5.78;
            for (const [o, yy] of [[o0, 0.15], [o1, 0.15]]) {
              pos.push(p.x + (nx / l) * o, yOf(p) + yy, p.z + (nz / l) * o);
              uv.push(o, i * 0.5);
            }
            if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
          }
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
          g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
          g.setIndex(idx);
          g.computeVertexNormals();
          queue(g, M.pave, false, true, 0);
        }
        // the centre line, dashed, so the boulevard reads as a street from the
        // very first frame and the eye has a scale to walk down
        for (let i = 0; i < 24; i++) {
          const t = lerp(0, tGate, (i + 0.5) / 24);
          const p = drive.getPoint(t), tan = drive.getTangent(t);
          const g = new THREE.PlaneGeometry(0.16, 2.9);
          g.rotateX(-Math.PI / 2);
          g.rotateY(Math.atan2(tan.x, tan.z));
          g.translate(p.x, 0.058, p.z);
          queue(g, M.line, false, true, 0);
        }

        // lamps down each side every twenty metres, and a palm or two on the
        // outer half only: the approach itself stays a clear view of the house
        for (let i = 0; i < 6; i++) {
          const t = lerp(0, tGate, (i + 0.5) / 6);
          const p = drive.getPoint(t), tan = drive.getTangent(t);
          const nx = -tan.z, nz = tan.x, l = Math.hypot(nx, nz) || 1;
          for (const sd of [-1, 1]) {
            const lx = p.x + (nx / l) * sd * 5.95, lz = p.z + (nz / l) * sd * 5.95;
            if (nearHome(lx, lz, 34)) continue;
            lamp(lx, lz, Math.atan2((nx / l) * sd, (nz / l) * sd));
          }
          if (i < 3) continue;
          const sdP = i % 2 === 0 ? 1 : -1;
          const px = p.x + (nx / l) * sdP * 9.6, pz = p.z + (nz / l) * sdP * 9.6;
          if (!nearHome(px, pz, 36)) streetPalm(px, pz, rr(0.98, 1.18));
        }
      }

      /* ── a walled garden, for the plots the orbit turns through ────────────
         The ring just outside the estate keeps its gardens but not its houses,
         so the camera never flies through a roof: boundary walls, a gate, two
         palms. It reads as the walled compounds a Dubai villa street is made
         of, and it means the ring is never empty ground.                     */
      const gardenAt = (x, z, ry, w, d) => {
        const f = frameOf(x, z, ry);
        const gh = 1.9;
        uBox(M.stonePale, w, gh, 0.3, 0, gh / 2, d / 2, f, 0.45);
        uBox(M.stonePale, w, gh, 0.3, 0, gh / 2, -d / 2, f, 0.45);
        uBox(M.stonePale, 0.3, gh, d, -w / 2, gh / 2, 0, f, 0.45);
        uBox(M.stonePale, 0.3, gh, d, w / 2, gh / 2, 0, f, 0.45);
        uBox(M.stonePale, 0.5, 2.3, 0.5, -1.9, 1.15, d / 2, f, 0.45);
        uBox(M.stonePale, 0.5, 2.3, 0.5, 1.9, 1.15, d / 2, f, 0.45);
        streetPalm(x + rr(-w * 0.3, w * 0.3), z + rr(-d * 0.2, d * 0.2), rr(0.85, 1.1));
        streetPalm(x + rr(-w * 0.3, w * 0.3), z + rr(-d * 0.2, d * 0.2), rr(0.85, 1.1));
      };

      // lamps + palms down all eight streets, staggered so nothing lines up
      for (const S of STREETS) {
        const alongX = S.axis === 'x';
        const step = S.main ? 30 : 38;
        for (let u = S.from + 16; u < S.to - 10; u += step) {
          for (const sd of [-1, 1]) {
            const off = sd * (S.half + 0.28 + S.walk - 0.55);
            const x = alongX ? u : S.at + off;
            const z = alongX ? S.at + off : u;
            // never inside the estate, and never over its gate or in the road
            if (x > ESTATE.x0 - 1.5 && x < ESTATE.x1 + 1.5 && z > ESTATE.z0 - 1.5 && z < ESTATE.z1 + 1.5) continue;
            if (Math.abs(z - ESTATE.z1) < 4 && x > -3 && x < 12) continue;
            if (onBoulevard(x, z, 1.5)) continue;
            const ry = alongX ? (sd > 0 ? 0 : Math.PI) : (sd > 0 ? Math.PI / 2 : -Math.PI / 2);
            lamp(x, z, ry);
            // a palm between every two lamps, and only on the closest streets:
            // a planted verge, not a forest of trunks in the camera's way
            const k = Math.round((u - S.from) / step);
            if (S.main && k % 2 === 0 && nearHome(x, z, 150)) {
              const px = alongX ? u + step * 0.5 : S.at + sd * (S.half + 1.15);
              const pz = alongX ? S.at + sd * (S.half + 1.15) : u + step * 0.5;
              if (!nearHome(px, pz, 34) && !onBoulevard(px, pz, 2)) streetPalm(px, pz, rr(0.95, 1.2));
            }
          }
        }
      }

      /* ── the plots ────────────────────────────────────────────────────────
         The grid between the streets, 25 cells: the middle one is the estate.
         Each cell is cut into plots of about thirty metres, and each plot gets
         a walled villa or a low/mid-rise block, set back from the pavement.
         Nothing may come within 54 m of the house, so the orbit at 48 m never
         passes through a building, and nothing may block the boulevard.      */
      const XG = [-170, -114, -42, 46, 118, 174];
      const ZG = [-178, -118, -50, 40, 106, 178];

      const villaAt = (x, z, ry, w, d, wallMat) => {
        const f = frameOf(x, z, ry);
        const h1 = 3.45, h2 = 6.9;
        // the ground floor, glazed along its street face
        uBox(wallMat, w, h1, d, 0, h1 / 2, 0, f, 0.4);
        uBox(M.glassDark, w * 0.62, 2.55, 0.14, -w * 0.08, 1.4, d / 2 + 0.02, f);
        uBox(M.bronze, w * 0.62 + 0.24, 0.13, 0.2, -w * 0.08, 2.74, d / 2 + 0.04, f);
        // the upper storey, pushed to one end so the other end is a terrace
        const uw = w * 0.66, ud = d * 0.96, ux = (w - uw) / 2 - 0.5;
        uBox(wallMat, uw, h2 - h1, ud, ux, (h1 + h2) / 2, 0, f, 0.4);
        uBox(M.glassDark, 0.14, 1.5, ud * 0.62, ux + uw / 2 + 0.02, 5.3, -d * 0.1, f);
        uBox(M.glassDark, uw * 0.6, 1.4, 0.13, ux, 5.35, ud / 2 + 0.02, f);
        // roof slab, parapet, and the terrace's glass balustrade
        uBox(M.stonePale, uw + 0.6, 0.24, ud + 0.6, ux, h2 + 0.12, 0, f, 0.5);
        uBox(wallMat, uw + 0.6, 0.62, 0.26, ux, h2 + 0.55, ud / 2 + 0.17, f, 0.4);
        uBox(wallMat, uw + 0.6, 0.62, 0.26, ux, h2 + 0.55, -ud / 2 - 0.17, f, 0.4);
        uBox(M.glass, w - uw - 0.9, 1.05, 0.04, -(w + uw) / 2 + 0.75, h1 + 0.55, d / 2 - 0.3, f);
        // entry canopy + a stair box on the roof
        uBox(M.stonePale, w * 0.34, 0.16, 2.1, -w / 2 + 1.2, 3.05, d / 2 + 0.9, f, 0.5);
        uBox(M.concrete, 1.5, 1.15, 1.3, ux - uw * 0.2, h2 + 0.9, -ud * 0.2, f, 0.35);
        // a low walled garden, with its gate facing the street
        const gw = w + 12, gd = d + 11, gh = 1.85;
        uBox(M.stonePale, gw, gh, 0.3, 0, gh / 2, gd / 2, f, 0.45);
        uBox(M.stonePale, gw, gh, 0.3, 0, gh / 2, -gd / 2, f, 0.45);
        uBox(M.stonePale, 0.3, gh, gd, -gw / 2, gh / 2, 0, f, 0.45);
        uBox(M.stonePale, 0.3, gh, gd, gw / 2, gh / 2, 0, f, 0.45);
        uBox(M.stonePale, 0.55, 2.3, 0.55, -2.4, 1.15, gd / 2, f, 0.45);
        uBox(M.stonePale, 0.55, 2.3, 0.55, 2.4, 1.15, gd / 2, f, 0.45);
        uBox(M.pave, 4.2, 0.06, 5.2, 0, 0.03, gd / 2 - 2.6, f, 0.15);
        contactShadow(x, z, w + 6, d + 6, true, 0.033);
      };

      const towerAt = (x, z, ry, w, d, floors, mat) => {
        const f = frameOf(x, z, ry);
        const fh = 3.35, h = floors * fh, base = 4.4;
        // a two-storey podium of shops and lobbies, then the shaft above
        uBox(M.concrete, w * 1.22, base, d * 1.22, 0, base / 2, 0, f, 0.3);
        uBox(M.stonePale, w * 1.28, 0.28, d * 1.28, 0, base + 0.12, 0, f, 0.42);
        uBox(mat, w, h, d, 0, base + h / 2, 0, f, 1 / 14);
        uBox(M.concrete, w + 0.5, 0.3, d + 0.5, 0, base + h + 0.15, 0, f, 0.3);
        uBox(M.concrete, w * 0.52, 1.7, d * 0.4, -w * 0.1, base + h + 1.0, -d * 0.18, f, 0.3);
        uBox(M.stonePale, 0.55, h * 0.96, 0.85, w / 2 - 0.05, base + h / 2, d / 2 - 0.35, f, 0.3);
        contactShadow(x, z, w * 1.5, d * 1.5, true, 0.033);
      };

      let plots = 0;
      for (let ci = 0; ci < XG.length - 1; ci++) {
        for (let cj = 0; cj < ZG.length - 1; cj++) {
          if (ci === 2 && cj === 2) continue;                       // the estate itself
          const xa = XG[ci] + 9.5, xb = XG[ci + 1] - 9.5;
          const za = ZG[cj] + 9.5, zb = ZG[cj + 1] - 9.5;
          const nx = Math.max(1, Math.round((xb - xa) / 30));
          const nz = Math.max(1, Math.round((zb - za) / 30));
          const pw = (xb - xa) / nx, pd = (zb - za) / nz;
          const outer = Math.abs((xa + xb) / 2) > 100 || Math.abs((za + zb) / 2) > 100;
          for (let i = 0; i < nx; i++) {
            for (let j = 0; j < nz; j++) {
              const cx = xa + (i + 0.5) * pw, cz = za + (j + 0.5) * pd;
              // keep the boulevard clear
              if (cz > 12 && cz < 186 && Math.abs(cx - driveCX(cz)) < 17) continue;
              // a garden plot in the ring the orbit turns through has no house
              const inside = nearHome(cx, cz, 74);
              const ry = i % 2 === 0 ? 0 : Math.PI;   // facing the street at either end
              const wMax = Math.min(pw - 9, 26), dMax = Math.min(pd - 9, 24);
              if (inside) {
                gardenAt(cx, cz, ry, Math.min(pw - 7, 22), Math.min(pd - 7, 20));
                continue;
              }
              if (wMax < 9 || dMax < 8) continue;
              const dHome = Math.hypot(cx - HOME.x, cz - HOME.z);
              /* a lean device keeps the two streets the camera can read and
                 leaves the rest of the grid to the mid-ground ring: at 150 m
                 through a 0.002 fog nobody counts the villas */
              if (dHome > (LOWRAM ? 110 : 150) && LEAN) continue;
              // close in, the street is villas; the blocks start a street back
              const towerChance = dHome < 150 ? 0.12 : (dHome < 220 ? 0.34 : 0.44);
              if (rnd() < towerChance && wMax > 11 && dMax > 11) {
                const floors = 2 + Math.floor(Math.pow(rnd(), 1.4) * (dHome < 150 ? 2 : (dHome < 220 ? 5 : 7)));
                const fac = [M.facadeWarm, M.facadeWhite, M.facadeWarm, M.facadeSand, M.facadeWhite, M.facadeCool][Math.floor(rnd() * 6)];
                towerAt(cx + rr(-1.5, 1.5), cz + rr(-1.5, 1.5), ry,
                        Math.min(wMax, 20 + rr(-3, 4)), Math.min(dMax, 17 + rr(-3, 4)),
                        floors, fac);
              } else {
                villaAt(cx + rr(-2, 2), cz + rr(-2, 2), ry,
                        Math.min(wMax, rr(11, 17)), Math.min(dMax, rr(9, 13)),
                        rnd() < 0.55 ? M.plaster : M.stonePale);
                if (rnd() < 0.7) streetPalm(cx + rr(-6, 6), cz + rr(4, 8), rr(0.8, 1.05));
              }
              plots++;
            }
          }
        }
      }

      /* ── the middle ground ────────────────────────────────────────────────
         Between the last street of the grid and the first ring of towers there
         must be more city, or the towers look like they stand in a field. Two
         hundred-odd low blocks in rows, with no street detail: at 200 m only
         the massing, the height and the colour read anyway.                 */
      {
        const bands = LEAN ? (LOWRAM ? 1 : 2) : (TABLET ? 4 : 5);
        for (let b = 0; b < bands; b++) {
          const r = 190 + (b + 0.5) * 28;
          const n = Math.round((2 * Math.PI * r) / 32);
          for (let i = 0; i < n; i++) {
            const ang = (i / n) * Math.PI * 2 + rr(-0.015, 0.015);
            const jit = rr(-6, 6);
            const x = HOME.x + Math.cos(ang) * (r + jit);
            const z = HOME.z + Math.sin(ang) * (r + jit);
            if (Math.abs(x) < 178 && Math.abs(z) < 186) continue;      // the grid already has this
            if (z > 8 && z < 720 && Math.abs(x - driveCX(z)) < 22) continue;
            const w = rr(14, 27), d = rr(12, 24);
            const floors = 2 + Math.floor(Math.pow(rnd(), 1.6) * (b < 2 ? 5 : 8));
            towerAt(x, z, rnd() < 0.5 ? 0 : Math.PI, w, d, floors,
                    [M.facadeWarm, M.facadeWhite, M.facadeSand, M.facadeWarm, M.facadeWhite][Math.floor(rnd() * 5)]);
          }
        }
      }
    }

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

      const cardGeo = leafGeo.clone();
      const cells = new Float32Array(leafMatrices.length);
      for (let i = 0; i < cells.length; i++) cells[i] = Math.floor(rnd() * 4);
      cardGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 1));
      const cards = new THREE.InstancedMesh(cardGeo, M.leaf, leafMatrices.length);
      leafMatrices.forEach((m, i) => { cards.setMatrixAt(i, m); cards.setColorAt(i, leafColors[i]); });
      cards.instanceMatrix.needsUpdate = true;
      if (cards.instanceColor) cards.instanceColor.needsUpdate = true;
      // a card casts on its neighbours, and the sun map is frozen after one
      // pass: a dense crown would shadow itself solid. The tree's ground
      // shadow is the soft contact ellipse beneath it instead.
      cards.castShadow = false;
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
            uThreshold: { value: 1.30 },
            uKnee: { value: 0.86 }
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
            uTexel: { value: new THREE.Vector2(1 / 256, 1 / 256) },
            uScale: { value: 1 }
          },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
          fragmentShader: /* glsl */`
            uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uTexel; uniform float uScale;
            varying vec2 vUv;
            void main(){
              vec2 o = uDir * uTexel * uScale;
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
            uBTexel: { value: new THREE.Vector2(1 / 256, 1 / 256) },
            uBloom: { value: 0.11 },
            uVeil: { value: 0.028 },
            uExposure: { value: 0.84 },
            uSaturation: { value: 0.06 },
            uContrast: { value: 0.075 },
            uBrightness: { value: 0.004 },
            uVignetteFrom: { value: 0.62 },
            uVignetteTo: { value: 1.28 },
            uVignetteColor: { value: new THREE.Color(0x0f1113) },
            uVignette: { value: 0.30 },
            uVigAspect: { value: new THREE.Vector2(1, 1) },
            uSeed: { value: 0 },
            uFade: { value: 1 }
          },
          vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
          fragmentShader: /* glsl */`
            uniform sampler2D tScene; uniform sampler2D tBloom;
            uniform vec2 uBTexel;
            uniform float uBloom, uVeil, uSaturation, uContrast, uBrightness, uExposure;
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
              vec2 px = uBTexel;
              vec3 c = texture2D(tScene, vUv).rgb;

              /* two scales of glow: a tight one that keeps a specular a
                 specular, and a wide veil that lets the sunlit stone and the
                 warm lenses bleed into the air around them */
              vec3 b1 = texture2D(tBloom, vUv).rgb;
              vec3 b2 = (texture2D(tBloom, vUv + px * vec2( 5.0,  3.0)).rgb
                       + texture2D(tBloom, vUv + px * vec2(-5.0, -3.0)).rgb
                       + texture2D(tBloom, vUv + px * vec2( 3.0, -5.0)).rgb
                       + texture2D(tBloom, vUv + px * vec2(-3.0,  5.0)).rgb
                       + texture2D(tBloom, vUv + px * vec2( 0.0,  6.0)).rgb
                       + texture2D(tBloom, vUv + px * vec2( 0.0, -6.0)).rgb
                       + texture2D(tBloom, vUv + px * vec2( 6.0,  0.0)).rgb
                       + texture2D(tBloom, vUv + px * vec2(-6.0,  0.0)).rgb) * 0.125;
              c += (b1 * 0.72 + b2 * 0.28) * uBloom;
              c += b2 * uVeil;

              c = toSRGB(aces(c));

              float luma = dot(c, vec3(0.299, 0.587, 0.114));
              /* split tone: the shadows cool a hair, the highlights warm, which
                 is what makes a golden-hour frame read as film rather than
                 as a render */
              c *= mix(vec3(0.985, 0.996, 1.016), vec3(1.030, 1.008, 0.976),
                       smoothstep(0.10, 0.88, luma));
              c = mix(vec3(luma), c, 1.0 + uSaturation);
              c = 0.5 + (1.0 + uContrast) * (c - 0.5);
              // a hair of toe lift so the deepest shadows keep their colour
              c = c * 0.972 + 0.014;
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
            compMat.uniforms.uBTexel.value.set(1 / qw, 1 / qh);
          },
          draw() {
            renderer.setRenderTarget(sceneRT);
            renderer.render(scene, camera);

            // bright pass (quarter res)
            quadMesh.material = brightMat;
            brightMat.uniforms.tDiffuse.value = sceneRT.texture;
            renderer.setRenderTarget(brightRT);
            renderer.render(quadScene, quadCam);

            // three separable blur passes, each a little wider: the last one
            // is the veil the sunlit stone bleeds into
            let src = brightRT;
            for (let i = 0; i < 2; i++) {
              blurMat.uniforms.uScale.value = 1 + i * 0.9;
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
            blurMat.uniforms.uScale.value = 1;

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
       10b · the Megascans layer

       Quixel Megascans props, placed by hand where the drawing had a stand-in
       and where the garden wanted more: boulders in the gravel beds, fountains
       of grass on the kitchen side of the pool, a palm cluster at each end of
       the deck, sansevierias and ribbon plants in the troughs, the tall clay
       vessels swapped in the rooms. Each asset is one GLB, fetched after the
       first frame, instanced once, and dressed with the same wind the
       procedural foliage uses. A prop that fails to arrive leaves its
       procedural twin visible — nothing is ever missing from the scene.
       ───────────────────────────────────────────────────────────────────── */
    const MEGA_SPOTS = [
      /* the west gravel beds: boulders and drifts of fountain grass */
      ['rock_formation', -16.35, 0.045, -3.75, 0.70, null, 0.62],
      ['boulder',        -15.05, 0.045, -4.25, 2.20, null, 0.50],
      ['sandstone',      -14.20, 0.045, -3.05, 1.10, null, 0.46],
      ['fountain_grass', -16.75, 0.030, -2.90, 1.20, 0.95, null],
      ['fountain_grass', -15.70, 0.030, -3.10, 4.00, 1.05, null, false],
      ['fountain_grass', -14.55, 0.030, -4.25, 2.60, 0.90, null],
      ['fountain_grass', -16.90, 0.030, -4.55, 5.40, 1.00, null, false],
      /* the smaller bed by the west corner */
      ['sandstone',      -16.35, 0.045, -8.15, 0.30, null, 0.40],
      ['fountain_grass', -15.05, 0.030, -7.85, 3.10, 0.85, null],
      ['fountain_grass', -14.60, 0.030, -8.60, 1.70, 0.78, null],
      /* dry tufts along the lawn's west edge, where the garden gives way */
      ['grass_tuft',     -12.90, 0.030, -6.20, 0.90, 1.05, null],
      ['grass_tuft',     -13.45, 0.030, -3.40, 2.40, 0.95, null],
      ['grass_tuft',     -12.60, 0.030, -1.20, 4.10, 1.10, null],
      ['grass_tuft',     -13.20, 0.030,  0.90, 5.30, 1.00, null],
      ['grass_tuft',     -12.80, 0.030, -8.90, 1.50, 0.90, null],
      /* the far side of the pool: two boulders and a palm at each end */
      ['boulder',         -5.30, 0.020, -20.60, 1.40, null, 0.55],
      ['boulder',         10.00, 0.020, -19.20, 0.40, null, 0.70],
      ['palm',            -6.60, 0.020, -22.20, 0.80, 1.90, null],
      ['palm',            11.40, 0.020, -12.40, 3.60, 1.60, null],
      /* the deck-edge troughs, planted under the bougainvillea */
      ['snake_plant',     -8.60, 0.600,  -9.06, 0.40, 0.62, null],
      ['snake_plant',     -6.60, 0.600,  -9.06, 2.90, 0.55, null],
      ['ribbon_plant',    -4.60, 0.600,  -9.06, 1.60, 1.15, null],
      ['ribbon_plant',    10.90, 0.600,  -7.00, 3.20, 1.25, null],
      /* the troughs across the water */
      ['lady_palm',       -2.20, 0.560, -20.35, 0.90, 1.25, null],
      ['lady_palm',        4.90, 0.560, -20.35, 4.40, 1.15, null],
      /* the two stone cubes on the roof deck */
      ['lady_palm',        5.20, 4.555,   2.60, 0.70, 1.40, null],
      ['lady_palm',        5.20, 4.555,  -5.20, 3.90, 1.30, null, false]
    ];
    for (const sp of MEGA_SPOTS) {
      megaSpot(sp[0], sp[1], sp[2], sp[3], { yaw: sp[4], s: sp[5] == null ? undefined : sp[5],
        h: sp[6] == null ? undefined : sp[6], mobile: sp[7] !== false });
    }

    /* ── the scanned planting, the props, and the street furniture ────────
       SUBSTITUTES.md §1–§4, placed where the camera actually goes. Each of
       these replaces a drawn stand-in: the two olive balls in the forecourt,
       the flat hedge boxes, the empty deck pots, the plain gate posts. The
       whole set is 3.9 MB of GLB and about 23k triangles, instanced per key. */
    {
      const P = (key, x, z, h, yaw = null, mobile = true) =>
        megaSpot(key, x, 0.02, z, { h, yaw: yaw == null ? undefined : yaw, mobile });

      /* the forecourt group left of the drive: the tree the approach passes */
      P('tropical_palm', -9.8, 18.9, 3.1, 0.9);
      P('yucca_a', -8.1, 18.2, 2.0, 2.1);
      P('laurel', -10.9, 19.9, 1.55, 0.4);
      P('laurel', -8.35, 20.15, 1.30, 2.8);
      P('laurel', -10.2, 17.7, 1.15, 4.2);
      P('ground_cover', -9.5, 19.3, 0.26, 1.0);
      P('ground_cover', -8.8, 18.8, 0.22, 3.1);
      P('ground_cover', -10.3, 18.6, 0.24, 5.0);

      /* the right-hand group, giving the approach its parallax */
      P('fan_palm', 13.9, 34.1, 2.7, 1.4);
      P('yucca_a', 12.5, 33.45, 1.85, 3.3);
      P('laurel', 14.95, 35.2, 1.45, 0.9);
      P('cane_palm', 12.15, 35.25, 1.35, 2.2);
      P('ground_cover', 13.3, 34.4, 0.24, 0.2);
      P('ground_cover', 14.2, 33.7, 0.21, 2.4);

      /* the gate court: planting at both piers, inside the wall line */
      P('laurel', -4.7, 22.5, 1.45, 1.1);
      P('cane_palm', -6.5, 21.6, 1.30, 3.4);
      P('laurel', 13.5, 22.4, 1.50, 2.0);
      P('yucca_a', 14.9, 21.6, 1.85, 0.6);
      P('ground_cover', -5.6, 22.0, 0.24, 4.0);
      P('ground_cover', 14.2, 22.1, 0.22, 1.7);

      /* the pool terrace: the two ends of the deck, off the swim line */
      P('yucca_a', 12.15, -6.1, 1.75, 1.2);
      P('fan_palm', -7.5, -18.6, 2.15, 2.6);
      P('cane_palm', -6.8, -19.6, 1.25, 0.3);
      P('ground_cover', -7.0, -18.2, 0.24, 2.2);
      P('ground_cover', 11.8, -6.7, 0.22, 3.6);

      /* the concrete pots, the bollards at the gate, the bench at the water */
      megaSpot('pot_bowl', 11.95, 0.02, -12.3, { s: 1.0, yaw: 0.3 });
      megaSpot('pot_taper', -6.95, 0.02, -11.15, { s: 1.0, yaw: 1.9 });
      megaSpot('pot_bowl', 5.85, 0.02, 9.4, { s: 0.9, yaw: 2.4 });
      megaSpot('pot_taper', -5.95, 0.02, 9.6, { s: 0.85, yaw: 0.7 });
      megaSpot('bollard', 1.55, 0.02, 26.8, { s: 1.0, yaw: 0 });
      megaSpot('bollard', 7.45, 0.02, 26.8, { s: 1.0, yaw: 0 });
      megaSpot('bench', 12.9, 0.02, -19.9, { s: 1.0, yaw: 1.5708 });

      /* the children's court: the scanned timber bench at its west edge, a run
         of beach boulders as stepping stones in from the lawn, and ground
         cover in the joints of the limestone curb */
      megaSpot('bench', 18.25, 0.035, 1.55, { s: 1.0, yaw: Math.PI / 2 });
      megaSpot('boulder', 14.2, 0.02, 2.55, { s: 0.40, yaw: 0.7 });
      megaSpot('boulder', 15.5, 0.02, 1.95, { s: 0.36, yaw: 2.1 });
      megaSpot('boulder', 16.7, 0.02, 1.55, { s: 0.38, yaw: 4.0 });
      megaSpot('boulder', 17.75, 0.02, 1.35, { s: 0.34, yaw: 1.3 });
      megaSpot('ground_cover', 18.55, 0.02, 5.75, { h: 0.26, yaw: 0.9 });
      megaSpot('ground_cover', 25.95, 0.02, -3.25, { h: 0.24, yaw: 2.6 });
      megaSpot('ground_cover', 18.55, 0.02, -3.25, { h: 0.25, yaw: 4.2 });
      megaSpot('laurel', 18.15, 0.02, 6.6, { h: 1.15, yaw: 1.7 });
      megaSpot('laurel', 26.3, 0.02, 6.35, { h: 1.05, yaw: 3.3 });

      /* the roof-deck and main-roof troughs, planted species by species so no
         two troughs carry the same thing: Quixel fountain grass, ribbon plant,
         snake plant, spotted laurel, cane palm and ground cover, standing in
         the soil of each trough where the flowering cards are now sparse */
      const rfD = 4.05 + 0.45, rfR = 8.53 + 0.40;
      const RP = (key, x, z, y, h, yaw = 0) => megaSpot(key, x, y, z, { h, yaw });
      /* the roof deck over the wing */
      RP('fountain_grass', 6.9, 3.0, rfD, 0.70, 0.4);
      RP('ribbon_plant', 7.9, 3.0, rfD, 0.72, 2.2);
      RP('laurel', 11.9, -5.45, rfD, 0.82, 1.1);
      RP('cane_palm', 12.85, -5.45, rfD, 0.78, 3.0);
      RP('ground_cover', 5.2, 2.6, rfD, 0.30, 0.8);
      RP('snake_plant', 5.2, -5.2, rfD, 0.58, 2.4);
      /* the main roof, south edge over the terrace */
      RP('fountain_grass', -13.8, -6.95, rfR, 0.78, 0.6);
      RP('snake_plant', -13.2, -6.95, rfR, 0.54, 2.0);
      RP('ribbon_plant', -8.9, -6.95, rfR, 0.72, 1.2);
      RP('laurel', -8.3, -6.95, rfR, 0.74, 3.4);
      RP('cane_palm', -1.3, -6.95, rfR, 0.80, 0.2);
      RP('ground_cover', -0.7, -6.95, rfR, 0.30, 1.9);
      RP('fountain_grass', 3.1, -6.95, rfR, 0.74, 4.1);
      RP('ribbon_plant', 3.7, -6.95, rfR, 0.68, 2.6);
      /* the main roof, north edge */
      RP('laurel', -13.1, 9.45, rfR, 0.78, 0.9);
      RP('fountain_grass', -12.5, 9.45, rfR, 0.70, 2.5);
      RP('ribbon_plant', -7.7, 9.45, rfR, 0.72, 1.6);
      RP('snake_plant', -7.1, 9.45, rfR, 0.54, 3.3);
      RP('cane_palm', -1.9, 9.45, rfR, 0.84, 0.4);
      RP('ground_cover', -1.3, 9.45, rfR, 0.28, 2.1);
      RP('laurel', 3.3, 9.45, rfR, 0.74, 3.8);
      RP('fountain_grass', 3.9, 9.45, rfR, 0.68, 1.0);
      /* the main roof, west edge */
      RP('fountain_grass', -15.03, -4.9, rfR, 0.74, 1.4);
      RP('ribbon_plant', -15.03, -4.3, rfR, 0.68, 2.7);
      RP('laurel', -15.03, 0.1, rfR, 0.78, 0.3);
      RP('cane_palm', -15.03, 0.7, rfR, 0.82, 3.1);
      RP('snake_plant', -15.03, 5.1, rfR, 0.54, 1.8);
      RP('ground_cover', -15.03, 5.7, rfR, 0.28, 0.6);
      /* the main roof, east edge */
      RP('ribbon_plant', 5.67, -4.9, rfR, 0.72, 0.8);
      RP('fountain_grass', 5.67, -4.3, rfR, 0.68, 2.3);
      RP('cane_palm', 5.67, 0.1, rfR, 0.80, 1.5);
      RP('laurel', 5.67, 0.7, rfR, 0.74, 3.6);
      RP('ground_cover', 5.67, 5.1, rfR, 0.28, 1.2);
      RP('fountain_grass', 5.67, 5.7, rfR, 0.64, 4.4);
    }

    const megaStats = { loaded: 0, failed: 0, assets: [] };
    let shadowDirty = false;
    /* ── the scanned props, in two waves ──────────────────────────────────
       Wave one is what stands in the first four stops: the pots and bollards
       of the entry, the forecourt planting, the pool ends. Wave two — the
       rear boulders, the roof troughs, the play-court pieces, none of which
       the camera sees before the amenities stop — follows once the first wave
       has landed, or when the scroll reaches that part of the take. A 4 GB
       phone takes wave one only: seven draws of scanned planting is the most
       its WebGL budget should carry, and the procedural stand-ins stay in
       place for everything else.                                          */
    const MEGA_WAVE1 = ['pot_bowl', 'pot_taper', 'bollard', 'bench', 'laurel', 'yucca_a',
                        'cane_palm', 'fan_palm', 'ground_cover', 'tropical_palm'];
    let megaTotal = 0, megaDone = 0, megaWave2 = false;
    function megaPlaceModels(only) {
      if (opts.models === false || !megaSpots.length || !THREE) return;
      let base = opts.modelBase;
      if (!base) {
        try { base = new URL('./models/', import.meta.url).href; }
        catch (_) { base = './models/'; }
      }
      const all = [...new Set(megaSpots.map((sp) => sp.key))];
      if (!megaTotal) megaTotal = all.length;
      const keys = only || all;
      let next = 0, live = 0;
      const maxLive = LEAN ? 3 : 8;
      const pump = () => {
        while (live < maxLive && next < keys.length) {
          const key = keys[next++];
          const spots = megaSpots.filter((sp) => sp.key === key && (sp.mobile || !MOBILE));
          if (!spots.length) { megaDone++; continue; }
          live++;
          loadMegaModel(THREE, base + key + '.glb', MOBILE ? 12000 : 9000).then((model) => {
            const info = MEGA_ASSETS[key] || {};
            const mat = model.material;
            mat.envMapIntensity = (key === 'clay_vase' || key === 'wood_vase') ? 1.0 : 0.85;
            if (info.wind) {
              windify(mat, {
                amp: info.wind, freq: 1.35, height: 2.2, base: -1.2,
                soft: info.soft || 0, fill: [0.10, 0.125, 0.075], trans: 0.22
              });
            }
            model.geometry.computeBoundingBox();
            const bb = model.geometry.boundingBox;
            const bh = Math.max(0.02, bb.max.y - bb.min.y);
            const mesh = new THREE.InstancedMesh(model.geometry, mat, spots.length);
            mesh.name = 'megascans:' + key;
            const d = new THREE.Object3D(), col = new THREE.Color();
            spots.forEach((sp, i) => {
              const s = sp.h ? sp.h / bh : (sp.s || 1);
              d.position.set(sp.x, sp.y, sp.z);
              d.rotation.set(0, sp.yaw, 0);
              d.scale.set(s, (sp.sy || s), s);
              d.updateMatrix();
              mesh.setMatrixAt(i, d.matrix);
              const v = 0.90 + ((i * 0.618) % 1) * 0.12;
              col.setRGB(v, v * (0.985 + (i % 3) * 0.008), v * 0.97);
              mesh.setColorAt(i, col);
            });
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            mesh.castShadow = !!info.shadow;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
            world.add(mesh);
            for (const fb of megaFallbacks.get(key) || []) fb.visible = false;
            megaStats.loaded++;
            megaStats.assets.push(key + '×' + spots.length);
            if (info.shadow) shadowDirty = true;
            settle();
          }).catch((err) => {
            megaStats.failed++;
            if (megaStats.failed === 1) console.warn('[megascans] ' + key + ' not loaded:', (err && err.message) || err);
            settle();
          }).finally(() => { live--; pump(); });
        }
      };
      /* one shadow refresh once everything that was asked for has landed */
      const settle = () => {
        megaDone++;
        if (shadowDirty && megaDone >= megaTotal) {
          renderer.shadowMap.needsUpdate = true;
          shadowDirty = false;
          drawFrame();
        }
      };
      pump();
    }
    if (opts.models !== false) {
      const wave1 = () => {
        if (destroyed) return;
        /*  A phone gets no scanned props at all: the 10 first-wave GLBs
            are ~1.7 MB to fetch and parse and ~20 MB of textures to hold,
            right when the phone is already paying for the first frame. The
            procedural stand-ins are already standing in every one of those
            spots, so the scene is complete without them. A laptop, even a
            small one, keeps wave one and skips only wave two below. */
        if (MOBILE) { megaStats.deferred = 'phone'; return; }
        megaPlaceModels(MEGA_WAVE1);
        if (LOWRAM) { megaStats.deferred = 'low-ram'; return; }
        /* wave two waits for the wave-one requests to have had the link to
           themselves, then rides in behind them */
        const rest = [...new Set(megaSpots.map((sp) => sp.key))].filter((k) => !MEGA_WAVE1.includes(k));
        const second = () => { if (!destroyed && !megaWave2) { megaWave2 = true; megaPlaceModels(rest); } };
        if (typeof requestIdleCallback === 'function') requestIdleCallback(second, { timeout: 6000 });
        else setTimeout(second, 3200);
        setTimeout(second, 4200);
      };
      const kick = () => {
        if (destroyed) return;
        if (typeof requestIdleCallback === 'function') requestIdleCallback(wave1, { timeout: 2600 });
        else setTimeout(wave1, 900);
      };
      /* after the first frame, not before it */
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => requestAnimationFrame(kick));
      else kick();
    }

    /* ─────────────────────────────────────────────────────────────────────
       11 · camera choreography
       ───────────────────────────────────────────────────────────────────── */
    const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

    const CAMERA_KEYS = [
      { t: 0.000, p: [15.2, 3.3, 62.0], l: [0.0, 4.6, 2.2], fov: 30 },
      { t: 0.075, p: [14.6, 3.1, 58.0], l: [0.0, 4.5, 1.8], fov: 31 },
      { t: 0.150, p: [13.8, 2.9, 50.0], l: [0.0, 4.2, 1.2], fov: 32 },
      { t: 0.225, p: [12.0, 2.7, 42.0], l: [0.0, 3.9, 0.6], fov: 34 },
      { t: 0.300, p: [11.2, 2.4, 38.0], l: [0.0, 3.7, 0.4], fov: 36 },
      { t: 0.355, p: [8.8, 2.2, 30.0], l: [0.4, 3.4, 1.2], fov: 39 },
      { t: 0.400, p: [6.0, 2.0, 23.0], l: [0.4, 2.9, 3.4], fov: 42 },
      { t: 0.440, p: [3.2, 1.85, 17.4], l: [0.0, 2.4, 5.6], fov: 45 },
      { t: 0.470, p: [1.2, 1.74, 13.2], l: [0.0, 2.1, 6.2], fov: 46 },
      { t: 0.488, p: [0.3, 1.72, 10.0], l: [0.0, 2.02, 5.6], fov: 46 },
      { t: 0.505, p: [0.0, 1.68, 7.7], l: [0.0, 1.98, 3.0], fov: 47 },
      { t: 0.522, p: [0.0, 1.66, 6.9], l: [0.0, 1.95, 0.6], fov: 47 },
      { t: 0.545, p: [0.0, 1.70, 4.8], l: [-1.2, 2.20, -1.4], fov: 48 },
      { t: 0.575, p: [-0.6, 1.76, 3.2], l: [-3.6, 2.50, -3.0], fov: 50 },
      { t: 0.615, p: [-1.5, 1.86, 1.6], l: [-6.4, 2.20, -3.4], fov: 50 },
      { t: 0.655, p: [-2.3, 1.94, 0.6], l: [-6.6, 2.20, -4.6], fov: 50 },
      { t: 0.705, p: [-2.6, 1.96, 0.2], l: [-5.8, 2.15, -5.6], fov: 49 },
      { t: 0.745, p: [-2.0, 1.94, -2.4], l: [-5.2, 2.05, -6.6], fov: 49 },
      { t: 0.762, p: [-0.7, 1.93, -4.4], l: [-3.0, 1.95, -8.0], fov: 48 },
      { t: 0.776, p: [0.3, 1.91, -6.0], l: [1.0, 1.75, -11.0], fov: 49 },
      /* Stop 04 is the terrace itself: out of the sliding wall by 0.786, and
         parked on the open deck from there on, so the Amenities copy is read
         over the pool, with the pergola only framing the right edge */
      { t: 0.786, p: [-0.8, 1.95, -8.6], l: [8.0, 1.30, -16.0], fov: 54 },
      { t: 0.858, p: [-0.8, 1.95, -8.6], l: [8.0, 1.30, -16.0], fov: 54 }
    ];

    const posCurve = new THREE.CatmullRomCurve3(CAMERA_KEYS.map(k => V3(k.p)), false, 'centripetal', 0.5);
    const tgtCurve = new THREE.CatmullRomCurve3(CAMERA_KEYS.map(k => V3(k.l)), false, 'centripetal', 0.5);
    posCurve.arcLengthDivisions = 800;
    tgtCurve.arcLengthDivisions = 800;

    const ORBIT_T0 = 0.858;
    const ORBIT = {
      cx: 0.5, cz: -1.0,
      r0: Math.hypot(0.1, -6.9),
      a0: Math.atan2(0.1, -6.9),
      y0: 1.90, r1: 48, y1: 14, turns: 1.0
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
      const r = lerp(ORBIT.r0, ORBIT.r1, Math.pow(s, 0.45));
      const y = lerp(ORBIT.y0, ORBIT.y1, Math.pow(s, 0.85));
      tmpPos.set(ORBIT.cx + Math.sin(ang) * r, y, ORBIT.cz + Math.cos(ang) * r);

      sampleCurve(tgtCurve, ORBIT_T0, tmpTgt);
      orbitTgt.set(0.5, lerp(4.6, 3.2, smoothstep(0.35, 1, s)), -1.0);
      tmpTgt.lerp(orbitTgt, smoothstep(0, 0.16, s));
      return lerp(44, 38, smoothstep(0, 1, s));
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

const rect0 = scrollHost.getBoundingClientRect();
const visible0 = rect0.top < window.innerHeight + 240 && rect0.bottom > -240;
let pTarget = STOPS[opts.startStop] ?? 0, pSmooth = pTarget, lastApplied = -1, visible = visible0, started = false;
/* when the page last moved, for the deferred work that must not run mid-flick */
let lastScrollAt = 0;
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

/* the HUD's five acts, cut where the copy hands over: 01 location, 02 exterior,
   03 interior, 04 amenities, 05 pricing & handover */
const STAGE_EDGES = [0, 0.36, 0.575, 0.716, 0.855, 1.01];
const STATIC_VIEWS = [0.0, 0.30, 0.47, 0.528, 0.705, 0.845, 0.94, 1.0];

/* ── one scroll reading, one progress value ───────────────────────────────
   The track's own document offset is measured on resize, never per frame, so
   the loop never forces layout. Each frame reads the scroll the page is
   ACTUALLY at — Lenis' applied value when it is driving (window.__lenis.scroll,
   which is what the sticky DOM is drawn at), otherwise window.scrollY — and
   turns it into this frame's progress. No second lerp sits on top of Lenis'
   smoothing: the camera, the copy blocks, the HUD stage, the bar and the %
   all read this one number, so the 3D can never drift from the DOM. */
let trackTop = 0, trackSpan = 1;

function measureScroll() {
  const rect = scrollHost.getBoundingClientRect();
  trackTop = rect.top + window.scrollY;
  const fixed = Math.min(window.innerHeight, rect.height);
  trackSpan = Math.max(1, rect.height - fixed);
}

function scrollY() {
  const lenis = window.__lenis;
  if (lenis && typeof lenis.scroll === 'number') return lenis.scroll;
  return window.scrollY || window.pageYOffset || 0;
}

function readProgress() {
  if (!opts.scrollDriven) return;
  const p = clamp((scrollY() - trackTop) / trackSpan);
  if (p !== pTarget) { pTarget = p; lastScrollAt = performance.now(); }
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

  const dark = smoothstep(0.505, 0.535, p) * (1 - smoothstep(0.552, 0.60, p));
  const warmUp = smoothstep(0.53, 0.60, p) * (1 - smoothstep(0.70, 0.76, p));
  if (veil) veil.style.opacity = (0.09 + dark * 0.30).toFixed(3);
  if (grade) grade.style.opacity = (0.82 + dark * 0.18 - warmUp * 0.16).toFixed(3);
  if (bloomEl) bloomEl.style.opacity = (warmUp * 0.30 + smoothstep(0.86, 0.98, p) * 0.10).toFixed(3);

  if (dust) dust.uniforms.uOpacity.value = smoothstep(0.54, 0.63, p) * (1 - smoothstep(0.80, 0.86, p)) * (MOBILE ? 0.40 : 0.48);
  if (opts.onProgress) { try { opts.onProgress(p, stage); } catch (_) { /* host's problem */ } }
}

let exposure = 0.83;

/*  The frame governor. A phone that cannot hold the budget loses resolution
    before it loses frames: the section is a scroll-driven film, and a soft frame
    that keeps up reads far better than a sharp one that stutters. One step every
    twenty frames, never back up (stepping up again oscillates), and only on the
    lean tier, so a desktop keeps the pixels it paid for. */
let govFrames = 0, govSpan = 0, govStep = 0;

function applyCamera(t, dt) {
  const fov = cameraAt(t);
  camera.position.copy(tmpPos);
  camera.up.set(0, 1, 0);
  camera.lookAt(tmpTgt);
  if (!REDUCED && opts.interactive) { camera.rotateY(lookYaw); camera.rotateX(lookPitch); }

  const aspect = camera.aspect;
  /*  A portrait frame multiplies the vertical field of view so a 18.7 m facade
      still fits the width. 1.46 fitted it with room to spare and left a third
      of a phone screen as empty road under the house; 1.30 crops the frame to
      the building, which is how the approach reads in a portrait editorial
      shot, and still holds the whole porch, the vine and the garage bay. */
  const portrait = aspect < 1.1 ? lerp(1, 1.30, clamp((1.1 - aspect) / 0.7)) : 1;
  const f = fov * portrait;
  if (Math.abs(camera.fov - f) > 0.01) { camera.fov = f; camera.updateProjectionMatrix(); }

  /* a phone sees a narrow slice of the world: back the camera off along the
     view ray on the exterior half of the take, so a 30 m facade still fits the
     frame at the approach and the door is centred by the time we reach it */
  if (portrait > 1.02 && t < 0.48) {
    const k = 1 + 0.035 * portrait * (1 - smoothstep(0.26, 0.47, t));
    tmpPos.sub(tmpTgt).multiplyScalar(k).add(tmpTgt);
    camera.position.copy(tmpPos);
  }

  const dark = smoothstep(0.508, 0.538, t) * (1 - smoothstep(0.556, 0.61, t));
  const inside = smoothstep(0.56, 0.64, t) * (1 - smoothstep(0.74, 0.78, t));
  const target = 0.83 - dark * 0.22 + inside * 0.30;
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

/* A lost context (a phone under memory pressure, a GPU reset) must not leave a
   black rectangle: three re-initialises itself on restore, and the next frame
   redraws the frozen product. On the way down the depth map is handed back,
   because on a 4 GB phone that 768² buffer is often the last straw. */
let contextLost = false;
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  contextLost = true;
  canvas.classList.remove('is-ready');
  container.classList.remove('is-ready');
  container.classList.add('webgl-paused');
  try { if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } } catch (_) {}
}, { signal });
canvas.addEventListener('webglcontextrestored', () => {
  contextLost = false;
  container.classList.remove('webgl-paused');
  try { renderer.shadowMap.needsUpdate = true; } catch (_) {}
  resize();
  drawFrame();
  canvas.classList.add('is-ready');
  schedule();
}, { signal });

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

window.addEventListener('scroll', () => { readProgress(); schedule(); }, { passive: true, signal });
window.addEventListener('resize', () => { resize(); measureScroll(); readProgress(); }, { passive: true, signal });

let ro = null, io = null;
if ('ResizeObserver' in window) { ro = new ResizeObserver(resize); ro.observe(section); }
if (opts.pausedOffscreen && 'IntersectionObserver' in window) {
  io = new IntersectionObserver((es) => {
    visible = es[0].isIntersecting;
    // out of view: the loop is stopped below, so nothing renders; back in
    // view: pick the clock up again without a jump and restart the loop.
    if (visible) { clock.getDelta(); schedule(); }
  }, { rootMargin: '200px 0px' });
  io.observe(scrollHost);
}

const clock = new THREE.Clock();
let elapsed = 0;
let paused = false;
let rafId = 0;
let destroyed = false;

/* One frame at a time: the loop parks itself the moment the section leaves the
   viewport, so scrolling never competes with a second live WebGL loop. The one
   exception is the first frame: the build now starts while the section is still
   below the fold, and that frame has to paint there, under the poster, or the
   reader arrives at a section that has not rendered yet. Once it is painted the
   loop parks exactly as before. */
function schedule() {
  if (rafId || paused || destroyed) return;
  if (!visible && started) return;
  rafId = requestAnimationFrame(tick);
}

function tick() {
  rafId = 0;
  const dt = Math.min(0.1, clock.getDelta());
  if (paused || destroyed || contextLost) return;
  if (!visible && started) return;
  elapsed += dt;

  /* autoplay: a slow pass over the take, ping-pong or looping */
  if (!opts.scrollDriven && (opts.autoplay || opts.loop)) {
    autoP += dt * 0.035 * (opts.speed || 1) * autoDir;
    if (autoP > 0.995) { autoP = 0.995; autoDir = opts.loop ? -1 : 1; if (!opts.loop) { paused = true; } }
    if (autoP < 0.005) { autoP = 0.005; autoDir = 1; }
    pTarget = autoP;
  }

  /* the scroll is read every frame, not only on scroll events: Lenis writes
     several positions between two events, and a frame that missed one showed
     the camera a step behind the copy. */
  if (opts.scrollDriven) readProgress();

  if (REDUCED) {
    let best = STATIC_VIEWS[0];
    for (const v of STATIC_VIEWS) if (Math.abs(v - pTarget) < Math.abs(best - pTarget)) best = v;
    pSmooth = best;
    lookYaw = lookPitch = 0;
  } else {
    /* scrollDriven: lock straight to the reading (Lenis is the smoothing);
       autoplay: a gentle follower so the loop eases by itself */
    if (opts.scrollDriven) pSmooth = pTarget;
    else pSmooth += (pTarget - pSmooth) * (1 - Math.exp(-dt * 3.8));
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

  if (LEAN) {
    govFrames++;
    govSpan += dt * 1000;
    if (govFrames >= (govStep ? 10 : 20)) {
      const avg = govSpan / govFrames;
      govFrames = 0; govSpan = 0;
      if (avg > 26 && govStep < 3) {
        govStep++;
        const next = Math.max(0.7, Math.round((renderer.getPixelRatio() - 0.15) * 100) / 100);
        renderer.setPixelRatio(next);
        ctxStats.dpr = next;
        resize();
      }
    }
  }

  if (!started) {
    started = true;
    // the world never moves: bake the shadow map once, then stop updating
    renderer.shadowMap.autoUpdate = false;
    canvas.classList.add('is-ready');
    container.classList.add('is-ready');
    canvas.classList.remove('is-loading');
    /* a lean phone: the deferred scans, then the scratch canvases handed back */
    if (LEAN) {
      schedulePhotoUpgrade();
      setTimeout(releaseScratchCanvases, 9000);
    }
  }

  schedule();
}

resize();
measureScroll();
readProgress();
pSmooth = pTarget;
applyCamera(pSmooth, 1);
paintOverlays(pSmooth);

/*  A phone's first frame is mostly shader compilation, and on a driver that
    supports KHR_parallel_shader_compile (Chrome on Android, Safari 16+) those
    programs link off the main thread. Kick them off here, keep the main thread
    free for the poster fade and the first scroll, and never wait longer than
    this: a driver without the extension resolves at once, and a slow one gets
    a synchronous compile in drawFrame() anyway. */
if (LEAN && typeof renderer.compileAsync === 'function') {
  let compiled = false;
  try {
    await Promise.race([
      renderer.compileAsync(scene, camera).then(() => { compiled = true; }),
      new Promise((r) => setTimeout(r, 2200))
    ]);
  } catch (_) { compiled = false; }
  ctxStats.asyncCompile = compiled;
}

clock.start();
schedule();

/* ── scratch canvases ──────────────────────────────────────────────────────
   Half the canvases this file bakes are intermediates: a height field a normal
   map was derived from, a drawing composited into a larger sheet, an atlas
   composited from pieces. They are never uploaded. Once the frame has been
   drawn, zero the ones no live texture points at and give the backing store
   back: a 4 GB phone needs that memory more than we do.                   */
let scratchReleased = false;
function releaseScratchCanvases() {
  if (scratchReleased || destroyed) return;
  scratchReleased = true;
  let freed = 0, bytes = 0;
  for (const c of CANVAS_KEEP) {
    /* a canvas a texture still points at stays: three re-uploads from it on
       a context restore, and a zeroed one would come back blank */
    if (c.__asTex) continue;
    if (!c.width || !c.height) continue;
    bytes += c.width * c.height * 4;
    c.width = 0; c.height = 0;
    freed++;
  }
  ctxStats.scratchCanvasesFreed = freed;
  ctxStats.scratchMbFreed = Math.round(bytes / 1048576 * 10) / 10;
}

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
    if (next.city != null) setCity(!!next.city);
    if (next.scrollDriven != null && next.scrollDriven) readProgress();
    if (next.quality != null && next.quality !== before.quality) return 'remount';
    return true;
  },
  camera, scene, renderer, section, sun, waterMat, dust, THREE, materials: M, build: BUILD,
  /* the site, for the checks that have to know where the walls are */
  site: { estate: ESTATE, planters: PLANTERS },
  megascans: megaStats,
  get stats() {
    return {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
      tier: MOBILE ? (LOWRAM ? 'lite+lowram' : 'lite') : (TABLET ? 'tablet' : 'high'),
      lean: LEAN, lowram: LOWRAM, dpr: renderer.getPixelRatio(),
      shadowMap: sun.shadow.mapSize.x,
      grassTufts: ctxStats.grassTufts,
      photoPhase2: photoPhase2,
      scratchCanvasesFreed: ctxStats.scratchCanvasesFreed,
      scratchMbFreed: ctxStats.scratchMbFreed
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

/*  Only a fault during the build is ours: once the first frame has painted, an
    unrelated script on the page (a font CDN, an analytics tag, a Framer
    override) must not be able to blank a working scene. */
const failIfBooting = (err) => { if (!started) fail(err); };
window.addEventListener('error', (e) => failIfBooting(e.error || e.message), { signal });
window.addEventListener('unhandledrejection', (e) => failIfBooting(e.reason), { signal });

return handle;
    } catch (err) {
      fail(err);
      return null;
    }
  }
}


/* ───────────────────────────────────────────────────────────────────
   The page integration. On a page that already carries the walkthrough markup
   (#walk containing a canvas) the scene mounts itself the moment this module
   is evaluated — the page only fetches the module once its own first screen is
   done, so the build is already below the fold's bill. No extra script, no
   config. A host that calls createWalkthrough itself (the Framer component, a
   test page) never reaches this block.
   ─────────────────────────────────────────────────────────────────── */
(function autoMount() {
  if (typeof document === 'undefined') return;
  const host = document.getElementById('walk');
  if (!host || !host.querySelector('canvas')) return;
  let armed = false;
  const go = () => {
    if (armed) return;
    armed = true;
    Promise.resolve(createWalkthrough(host, {}))
      .then((inst) => { window.__shadestateWalk = inst; })
      .catch((e) => console.error(e));
  };
  /*  Build now, in the idle time that follows the page's own load. Arming on a
      resting thumb — the old gate — is what held the first frame back until the
      reader stopped scrolling at the section, and that wait is exactly the
      "it takes time to load" he reported. The build is staged across idle
      slices and paints its first frame under the poster even while the section
      is still below the fold, so arriving at the section costs nothing: the
      canvas is already there. If the thumb somehow beats the build, the poster
      holds the frame and the canvas takes over underneath it. */
  go();
})();
