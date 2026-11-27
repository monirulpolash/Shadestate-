/* House 01 — a neutral walkthrough for any developer's project.
   Built from shadestate-3d/template/src by build/build-template.py. Do not edit
   this file: edit the source parts and run the build again.

   Everything the look depends on is in the config block at the top of this
   file: brand, palette (limestone | white | sand), sun (golden | morning | dusk),
   pool, scroll length, and the three copy lines.
*/

/* ─────────────────────────────────────────────────────────────────────────────
   HOUSE 01 — a neutral walkthrough for any developer's project
   ─────────────────────────────────────────────────────────────────────────────

   One villa, one camera, three beats. Nothing in the scene names a city, a
   district or a brand: the massing is a modern house archetype, the skyline is
   haze, and every colour and every word comes from the block below.

   ── the whole look and the whole script, in one place ───────────────────────

     brand      the label in the corner. '' hides it, null hides the corner.
     palette    'limestone' | 'white' | 'sand'   (three complete material sets)
     sun        'golden' | 'morning' | 'dusk'    (one committed time of day)
     pool       true | false                     (false lays a lawn terrace)
     scroll     scroll length multiplier          (1 = the authored length)
     copy       one line per beat, in beat order. Three beats, three lines.
     props      false skips the scanned models (the scene stays whole without)
     poster     the still shown until the first frame

   Any of them can be overridden on the URL while reviewing:
     /template/?palette=sand&sun=dusk&pool=0&scroll=1.4&props=0

   ─────────────────────────────────────────────────────────────────────────── */

const TEMPLATE = {
  brand: 'Residence 01',
  palette: 'limestone',
  sun: 'golden',
  pool: true,
  scroll: 1,
  copy: ['Arrive.', 'The whole site.', 'Room to breathe.'],
  props: true,
  poster: 'poster.webp'
};

/* ── palettes ────────────────────────────────────────────────────────────────
   Each set is a complete house, not a tint: the stone and its shadow side, the
   window metal, the timber, the floor behind the glass, the deck, and the water
   the pool holds. `frameMetal` lets a white house keep a painted oak window and
   a sand house keep black steel.                                               */

const PALETTES = {
  limestone: {
    label: 'Limestone and bronze',
    stone: 0xe9e0cd, stoneShade: 0xd8cbb2, stoneDeep: 0xc4b69b,
    frame: 0x4a3a2a, frameMetal: 0.85, frameRough: 0.36,
    soffit: 0xb9835a, floor: 0xc99b6a, deck: 0xe4d9c3,
    poolTile: 0x9ecfcc, water: [0.012, 0.128, 0.136],
    grass: 0x7d8a52, gravel: 0xcfc4ad
  },
  white: {
    label: 'White and oak',
    stone: 0xf5f2e9, stoneShade: 0xe8e3d6, stoneDeep: 0xd6cfbf,
    frame: 0x8a5f3c, frameMetal: 0.2, frameRough: 0.5,
    soffit: 0xc99a6b, floor: 0xd3a976, deck: 0xefeade,
    poolTile: 0xa9d8d8, water: [0.016, 0.150, 0.150],
    grass: 0x76864f, gravel: 0xdad2c1
  },
  sand: {
    label: 'Sand and charcoal',
    stone: 0xd9c6a6, stoneShade: 0xc6b08f, stoneDeep: 0xa8937a,
    frame: 0x2b2b2d, frameMetal: 0.7, frameRough: 0.42,
    soffit: 0x8a6440, floor: 0xb4855a, deck: 0xdccfb6,
    poolTile: 0x8fc4c2, water: [0.010, 0.115, 0.125],
    grass: 0x7a8450, gravel: 0xc9bda4
  }
};

/* ── the light ──────────────────────────────────────────────────────────────
   Late afternoon, committed. The sun sits low off the approach facade, the sky
   carries the blue that low sun leaves behind, and the shadow side of every
   wall is lit by the whole dome rather than a single fill. One preset is in
   force at a time; nothing in the scene mixes two.                            */

const SKY_PRESETS = {
  golden: {
    stops: [[0, '#3a5c8e'], [78, '#3f6296'], [58, '#466a9d'], [38, '#5477a8'],
      [24, '#6785b3'], [15, '#8296bb'], [10, '#9fa9c0'], [6.5, '#bcb9ba'],
      [5.0, '#d2c5b2'], [3.8, '#e0caa9'], [2.8, '#e9cf9f'], [2.0, '#efd5a3'],
      [1.2, '#f5ddae'], [0.5, '#fae5c0']],
    horizon: '#e6d3b6', below: ['#e1cfb4', '#c6ae90', '#98836b', '#4f4739'],
    sun: [-0.80, 0.20, 0.56], sunCol: [1.78, 1.06, 0.56], sunInt: 4.4, light: 0xffc78a,
    sunGlow: 'rgba(255,236,198,.90)', lit: [255, 236, 208], shade: [176, 178, 196],
    fog: 0xe6d3b4, fogDensity: 0.0026, exposure: 1.02, warm: 0.55
  },
  morning: {
    stops: [[0, '#3d6b9c'], [78, '#4170a1'], [58, '#4776a7'], [38, '#5484b1'],
      [24, '#668fba'], [15, '#7ba2c4'], [10, '#93b4d0'], [6.5, '#aec6da'],
      [5.0, '#c4d2dc'], [3.8, '#d8d9cf'], [2.8, '#e6dec9'], [2.0, '#efe3c9'],
      [1.2, '#f5e9cd'], [0.5, '#f9eed5']],
    horizon: '#e3d8c4', below: ['#e0d5c1', '#c0b49c', '#8f8571', '#4c4639'],
    sun: [-0.86, 0.30, 0.41], sunCol: [1.55, 1.02, 0.64], sunInt: 4.6, light: 0xffd2a0,
    sunGlow: 'rgba(255,247,224,.88)', lit: [253, 249, 238], shade: [186, 194, 210],
    fog: 0xe3d6c0, fogDensity: 0.0022, exposure: 1.12, warm: 0.10
  },
  dusk: {
    stops: [[0, '#22355e'], [78, '#263a64'], [58, '#2c426d'], [38, '#394f7c'],
      [24, '#4a5c88'], [15, '#657092'], [10, '#84849a'], [6.5, '#a89a98'],
      [5.0, '#c4a68d'], [3.8, '#d9a878'], [2.8, '#e8ae70'], [2.0, '#f0b677'],
      [1.2, '#f5c489'], [0.5, '#f8d3a2']],
    horizon: '#ddc3a0', below: ['#c9b39a', '#b08867', '#82685a', '#3c3630'],
    sun: [-0.96, 0.075, 0.28], sunCol: [1.85, 0.86, 0.40], sunInt: 3.4, light: 0xffa968,
    sunGlow: 'rgba(255,214,160,.92)', lit: [252, 224, 190], shade: [138, 142, 168],
    fog: 0xc9b39a, fogDensity: 0.0024, exposure: 0.96, warm: 0.9
  }
};

/* second-stage grade: blooms the sun off stone and glass, then the film curve */
const LOOK = {
  bloom: 0.17,
  veil: 0.05,
  saturation: 0.14,
  contrast: 0.10,
  vignette: 0.5
};

/* the camera's three beats, as fractions of the scroll. The copy windows are
   read off the same table, so a line can never drift away from its beat. */
const BEATS = [
  { in: -0.050, out: 0.290 },  // 01 street: the massing, three blocks
  { in: 0.470, out: 0.680 },   // 02 over the roof terrace
  { in: 0.790, out: 1.040 }    // 03 out over the infinity edge and the water
];

/* ─────────────────────────────────────────────────────────────────────────────
   1 · kit — procedural ink and clipboard
   Canvas-baked stone, timber, concrete, foliage and water normal maps. No
   photographs, no downloaded textures: every material in this scene is drawn
   at boot, so a template can be dropped on any host without carrying assets
   anyone else has to license. Each maker bakes luminance detail; colour comes
   from the palette, one material multiply away.
   ───────────────────────────────────────────────────────────────────────────── */
const PHOTO = {};   /* surface sets, filled by the asset layer when present */
const _photoTexCache = new Map();

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
   2 · surface grain

   The surfaces here are drawn by this file. A photographed set, when the
   asset layer brings one, is laid underneath the drawing as grain; without
   one the drawing stands alone, so nothing in the scene depends on a download.
   ───────────────────────────────────────────────────────────────────────────── */

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

/** A loaded photo set as a three.js map, or null when there is none: every
    caller treats null as "keep the drawn surface". */
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

/** The same, but each cell takes a different crop, so a 4x4 deck of pavers is
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
function makeAsphalt() {
  const S = TS(512), c = cv(S), g = c.getContext('2d');
  const hc = cv(S), hg = hc.getContext('2d');
  const a = PHOTO.asphalt;
  if (a) {
    /* Luminosity over a warm mid-grey: the scan supplies the aggregate and the
       patched, oil-stained figure; the base supplies Dubai tarmac's tone, so
       the street does not go either blue-grey or soot-black. */
    g.fillStyle = '#5c5b58';
    g.fillRect(0, 0, S, S);
    g.save();
    g.globalCompositeOperation = 'luminosity';
    g.globalAlpha = 0.78;
    g.drawImage(a.color, 0, 0, S, S);
    g.globalCompositeOperation = 'soft-light';
    g.globalAlpha = 0.34;
    g.drawImage(a.color, 0, 0, S, S);
    g.restore();
    hg.fillStyle = '#7a7a7a'; hg.fillRect(0, 0, S, S);
    return {
      map: c,
      normal: a.normal ? photoCanvas(a.normal, 512) : null,
      rough: a.rough ? photoCanvas(a.rough, 512) : null
    };
  }
  g.fillStyle = '#5c5854'; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#7a7a7a'; hg.fillRect(0, 0, S, S);
  for (let i = 0; i < 24000; i++) {
    const v = rnd();
    g.fillStyle = v > 0.55 ? `rgba(190,186,178,${rr(0.03, 0.10).toFixed(3)})` : `rgba(24,22,20,${rr(0.03, 0.11).toFixed(3)})`;
    const s = rr(0.8, 2.2);
    g.fillRect(rnd() * S, rnd() * S, s, s);
    if (v > 0.7) hg.fillStyle = `rgba(${rnd() > 0.5 ? 190 : 60},${rnd() > 0.5 ? 190 : 60},${rnd() > 0.5 ? 190 : 60},.18)`;
  }
  return { map: c, normal: normalFromHeight(hc, 0.55) };
}

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
  g.fillStyle = '#cfc7b7'; g.fillRect(0, 0, S, S);
  hg.fillStyle = '#9a9a9a'; hg.fillRect(0, 0, S, S);
  // 4 × 4 pavers, each a slightly different warm grey, with a recessed joint
  const n = 4, t = S / n;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const l = rr(-9, 9), warm = rr(-4, 5);
      g.fillStyle = `rgb(${200 + l + warm},${193 + l},${180 + l - warm})`;
      g.fillRect(i * t + 1.2, j * t + 1.2, t - 2.4, t - 2.4);
      hg.fillStyle = `rgb(${168 + l},168,168)`;
      hg.fillRect(i * t + 1.2, j * t + 1.2, t - 2.4, t - 2.4);
    }
  }
  /* a different crop of real travertine into each of the sixteen pavers, so a
     deck never repeats one piece of stone sixteen times */
  const trav = PHOTO.travertine;
  if (trav) {
    photoCrops(g, trav.color, S, n, { mode: 'luminosity', alpha: 0.62, srcTiles: 3 });
    photoCrops(g, trav.color, S, n, { mode: 'soft-light', alpha: 0.25, srcTiles: 3 });
    /* the joints survive the photo: re-cut the recess line and its lit edge */
    g.save();
    for (let j = 0; j < n; j++) {
      g.fillStyle = 'rgba(150,138,116,.55)';
      g.fillRect(0, j * t - 1.1, S, 2.2);
      g.fillRect(j * t - 1.1, 0, 2.2, S);
      g.fillStyle = 'rgba(255,252,244,.30)';
      g.fillRect(0, j * t + 1.1, S, 0.9);
      g.fillRect(j * t + 1.1, 0, 0.9, S);
      hg.fillStyle = 'rgba(46,46,46,.9)';
      hg.fillRect(0, j * t - 1.1, S, 2.2);
      hg.fillRect(j * t - 1.1, 0, 2.2, S);
    }
    g.restore();
  }
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = rnd() > 0.5 ? `rgba(255,252,242,${rr(0.02, 0.07).toFixed(3)})` : `rgba(120,112,96,${rr(0.02, 0.08).toFixed(3)})`;
    g.fillRect(rnd() * S, rnd() * S, rr(1, 2), rr(1, 2));
  }
  return { map: c, normal: normalFromHeight(hc, 1.1) };
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
   module scope: the three.js namespace, shared by every instance on the page,
   and the one yield the boot uses to let the browser answer a scroll.
   ───────────────────────────────────────────────────────────────────────────── */
let THREE = null;

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

/* ─────────────────────────────────────────────────────────────────────────────
   2 · boot — the container, the tier, the renderer, the camera
   ───────────────────────────────────────────────────────────────────────────── */
export async function createWalkthrough(container, options = {}) {
  if (!container || !container.nodeType) throw new Error('createWalkthrough: a container element is required');

  /* the config block is the authoring surface; a host that mounts this scene
     passes the same keys, and the URL overrides them for review only */
  const CFG = { ...TEMPLATE, ...options };
  if (typeof location !== 'undefined' && location.search) {
    const q = new URLSearchParams(location.search);
    if (q.has('palette')) CFG.palette = q.get('palette');
    if (q.has('sun')) CFG.sun = q.get('sun');
    if (q.has('pool')) CFG.pool = q.get('pool') !== '0';
    if (q.has('scroll')) CFG.scroll = parseFloat(q.get('scroll'));
    if (q.has('props')) CFG.props = q.get('props') !== '0';
    if (q.has('quality')) CFG.quality = q.get('quality');
  }
  const PAL = PALETTES[CFG.palette] || PALETTES.limestone;
  const SUN = SKY_PRESETS[CFG.sun] || SKY_PRESETS.golden;
  const COPY = Array.isArray(CFG.copy) && CFG.copy.length ? CFG.copy : TEMPLATE.copy;

  /* ── device tier ──────────────────────────────────────────────────────── */
  const REDUCED = options.reducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hostW = container.clientWidth || window.innerWidth;
  const lite = CFG.quality === 'lite' || (CFG.quality !== 'high' && (hostW <= 820 ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 1100)));
  const MOBILE = lite;
  LOWRAM = (navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4;
  LEAN = MOBILE || LOWRAM;
  const TABLET = !MOBILE && Math.min(hostW, window.innerWidth) <= 1024;
  const TIER_DPR = LOWRAM ? 1.0 : (MOBILE ? 1.25 : (TABLET ? 1.4 : 1.75));
  const DPR_MAX = TIER_DPR;
  LITE_TEX = LEAN;
  NRM_CAP = LEAN ? 256 : (TABLET ? 768 : 0);

  const section = container;
  /* the element that scrolls may be taller than the box the canvas fills: the
     page's track is 340svh and the stage inside it is one screen */
  const scrollHost = options.scrollTarget
    ? (typeof options.scrollTarget === 'string' ? document.querySelector(options.scrollTarget) : options.scrollTarget)
    : section;
  const RUNWAY = (MOBILE ? 300 : 340) * (CFG.scroll > 0 ? CFG.scroll : 1);
  /* a host with its own track owns its own length; a bare container gets one */
  if (!options.scrollTarget) scrollHost.style.height = RUNWAY + 'svh';

  let canvas = container.querySelector('canvas');
  let ownsCanvas = false;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'house-canvas';
    container.appendChild(canvas);
    ownsCanvas = true;
  }
  if (ownsCanvas) {
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    canvas.setAttribute('role', 'img');
  }
  canvas.classList.add('is-loading');

  function fail(err) {
    console.error(err);
    canvas.classList.remove('is-loading');
    container.classList.add('no-webgl');
  }

  if (!THREE) THREE = options.three || null;
  if (!THREE) {
    let url = options.threeUrl || '';
    if (!url) {
      try { url = new URL('./vendor/three.module.js', import.meta.url).href; }
      catch (_) { url = './vendor/three.module.js'; }
    }
    THREE = await import(/* @vite-ignore */ url);
  }

  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !MOBILE && !/[?&]aa=0/.test(location.search),
      powerPreference: 'high-performance',
      alpha: false, stencil: false,
      preserveDrawingBuffer: /[?&]capture=1/.test(location.search)
    });
  } catch (err) {
    fail(err);
    return null;
  }

  const ctxStats = { lowram: LOWRAM, lean: LEAN, dpr: 0, shadowMap: 0 };
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, DPR_MAX));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = SUN.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;
  renderer.autoClear = true;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(SUN.fog, SUN.fogDensity);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 4200);
  const world = new THREE.Group();
  scene.add(world);

/* ─────────────────────────────────────────────────────────────────────────────
   3 · sky, sun and air

   One equirect sky, one sun, one fog. The visible dome samples the preset's
   elevation stops directly, so the gradient the eye sees is the same one the
   PMREM environment hands to stone, glass and water.
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

    
/* ── height-based haze ─────────────────────────────────────────────────────
   three's fog is depth-only, which lays the same veil on the house at 20 m and
   on a skyline 600 m out. Air is not like that: the mist sits in the first
   twenty metres and thins with altitude, so the far silhouettes sink into the
   ground haze while the villa, at eye level, stays crisp. One varying and a
   multiply on the materials that already carry fog. This is the height fog the
   Shadestate lighting pass introduced; the template inherits it. */
if (!THREE.ShaderChunk.__houseHeightFog) {
  THREE.ShaderChunk.__houseHeightFog = true;
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
    fogFactor *= mix( 1.0, 0.58, smoothstep( 2.0, 55.0, vFogH ) );
    gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
  #endif`;
}

/* ── the visible dome ───────────────────────────────────────────────────────
   A sphere at the far clip, drawn first, depth off. Its fragment shader reads
   the same elevation stops the equirect was painted from and blends them over
   the cloud band, so the sky the eye sees and the sky the stone reflects are
   one sky.                                                                  */
const skyDomeUniforms = {
  uStops: { value: Array.from({ length: 16 }, () => new THREE.Vector4(0, 0, 0, 0)) },
  uStopCount: { value: 14 },
  uHor: { value: new THREE.Color(0.8, 0.8, 0.8) },
  uFogC: { value: new THREE.Color(0.8, 0.8, 0.8) },
  uSunV: { value: new THREE.Vector3(...SUN.sun).normalize() },
  uSunCol: { value: new THREE.Color(1, 1, 1) },
  uCover: { value: 0.5 },
  uWarm: { value: SUN.warm },
  uCloud: { value: 1 },
  uTime: { value: 0 }
};

function setSkyDome(preset, cover) {
  const P = preset || SKY_PRESETS.golden;
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
  skyDomeUniforms.uWarm.value = P.warm == null ? 0.1 : P.warm;
  skyDomeUniforms.uCover.value = clamp(cover, 0, 1);
}

setSkyDome(SUN, 0.46);

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

await nextTick();

/* ── the equirect that becomes the environment ────────────────────────────── */
const CLOUD_COVER = 0.46;
let skyTexture = makeSky(CFG.sun, CLOUD_COVER);
const SUN_DIR = new THREE.Vector3(...SUN.sun).normalize();
const pmrem = new THREE.PMREMGenerator(renderer);
pmrem.compileEquirectangularShader();
scene.environment = pmrem.fromEquirectangular(skyTexture).texture;

/* ── sun ──────────────────────────────────────────────────────────────────── */
const sun = new THREE.DirectionalLight(SUN.light, SUN.sunInt);
sun.position.copy(SUN_DIR).multiplyScalar(120);
sun.target.position.set(0, 0, -4);
sun.castShadow = true;
/* a 4 GB phone gets a 1024 px map: 1 MB of depth instead of 4, and at 390 css
   px there is no edge anyone can see */
const SM = LEAN ? 1024 : (TABLET ? 1536 : 2048);
ctxStats.shadowMap = SM;
sun.shadow.mapSize.set(SM, SM);
sun.shadow.camera.left = -42;
sun.shadow.camera.right = 42;
sun.shadow.camera.top = 42;
sun.shadow.camera.bottom = -42;
sun.shadow.camera.near = 40;
sun.shadow.camera.far = 240;
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

/* the dome is the fill: a low sun leaves the shadow side of a stone wall lit
   by the whole sky, and by the warm bounce off the paving in front of it */
scene.add(new THREE.HemisphereLight(0xc6d8ea, 0xb09a72, MOBILE ? 0.80 : 0.95));
scene.add(new THREE.AmbientLight(0xe4d9c4, MOBILE ? 0.20 : 0.28));

/* a breath of fill from the side the sun has left, so a shaded carport is
   blue-grey rather than black. No shadow: it only lifts the dark side. */
{
  const fill = new THREE.DirectionalLight(0xa8c0dd, MOBILE ? 0.22 : 0.32);
  fill.position.set(0.55, 0.42, -0.75).multiplyScalar(80);
  scene.add(fill);
}

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
   4 · the house
   Three masses: a two-storey main volume, a single-storey wing whose roof is
   the terrace, and a garage block that reaches toward the street. Pale stone,
   bronze-framed glass, cedar under every slab, warm oak behind the glass. The
   plan is a modern villa archetype: it reads as a developer's house in any
   market because there is nothing in it to place it in one.

   Axes: x runs east, z runs toward the street (the camera arrives from +z),
   the ground is y = 0.
   ───────────────────────────────────────────────────────────────────────────── */
const HOUSE = {
  main:  { x0: -9.0, x1: 7.0, z0: -9.5, z1: 1.5, h: 7.2, mid: 3.9 },
  wing:  { x0: 7.0, x1: 17.2, z0: -6.4, z1: 1.2, h: 3.8 },
  garage:{ x0: 6.8, x1: 15.2, z0: 3.6, z1: 10.2, h: 3.4 }
};
const POOL = { x0: -1.0, x1: 11.0, z0: -16.4, z1: -10.6 };
const DECK = { x0: -11.0, x1: 16.0, z0: -17.4, z1: -9.4 };
const WATER_Y = -0.10;           /* water sits a hand below the coping */
const DECK_Y = 0.16;             /* travertine deck top */

/* ── procedural surfaces, tinted by the palette ───────────────────────────── */
await nextTick();
const ashlar = makeAshlar([244, 241, 234], 5);
const plainStone = makeStone('#f3f0e9', '120,110,96');
const pavingTex = makePaving();
const oakFloor = makeOakFloor();
const oakWoodTex = makeWoodGrain([214, 190, 164], [138, 106, 74], [246, 232, 214]);
const cedarWoodTex = makeWoodGrain([196, 148, 104], [116, 74, 44], [232, 194, 152]);
const concreteTex = makeConcrete();
const gravelTex = makeGravel();
const meadowTex = makeMeadow();
const lawnTex = makeLawnMat();
const poolTileTex = makePoolTile();
const asphaltTex = makeAsphalt();

const tune = (t, rx, ry) => { t.anisotropy = 4; t.repeat.set(rx, ry); return t; };

const M = {};
M.stone = weather(new THREE.MeshStandardMaterial({
  map: tex(ashlar.map, { srgb: true, repeat: [1, 1] }),
  normalMap: tex(ashlar.normal),
  roughnessMap: tex(ashlar.rough),
  color: PAL.stone,
  roughness: 1.0, metalness: 0.0,
  normalScale: new THREE.Vector2(0.9, 0.9),
  envMapIntensity: 0.42
}), { grime: 0.10, streak: 0.16, base: 0.2, scale: 0.3 });

M.stonePale = weather(new THREE.MeshStandardMaterial({
  map: tex(plainStone.map, { srgb: true, repeat: [2, 2] }),
  normalMap: tex(plainStone.normal),
  roughnessMap: tex(plainStone.rough),
  color: PAL.stoneShade,
  roughness: 1.0, metalness: 0.0,
  normalScale: new THREE.Vector2(0.7, 0.7),
  envMapIntensity: 0.5
}), { grime: 0.06, streak: 0.1, base: 0.14, scale: 0.34 });

/* the coping and the kerb: the same stone, sawn, no joints */
M.coping = new THREE.MeshStandardMaterial({
  map: tex(plainStone.map, { srgb: true, repeat: [3, 1] }),
  color: PAL.stone,
  roughness: 0.72, metalness: 0.0, envMapIntensity: 0.5
});

M.deck = weather(new THREE.MeshStandardMaterial({
  map: tex(pavingTex.map, { srgb: true, repeat: [1, 1] }),
  normalMap: tex(pavingTex.normal),
  color: PAL.deck,
  roughness: 1.0, metalness: 0.0,
  normalScale: new THREE.Vector2(0.65, 0.65),
  envMapIntensity: 0.42
}), { grime: 0.05, streak: 0.06, base: 0.1, scale: 0.28 });

M.paving = new THREE.MeshStandardMaterial({
  map: tex(pavingTex.map, { srgb: true, repeat: [2, 2] }),
  normalMap: tex(pavingTex.normal),
  color: PAL.stoneShade,
  roughness: 0.9, metalness: 0.0,
  normalScale: new THREE.Vector2(0.55, 0.55),
  envMapIntensity: 0.4
});

M.concrete = new THREE.MeshStandardMaterial({
  map: tex(concreteTex.map, { srgb: true }),
  normalMap: tex(concreteTex.normal),
  color: PAL.stoneDeep,
  roughness: 0.92, metalness: 0.0,
  normalScale: new THREE.Vector2(0.8, 0.8),
  envMapIntensity: 0.5
});

M.frame = new THREE.MeshStandardMaterial({
  color: PAL.frame, metalness: PAL.frameMetal, roughness: PAL.frameRough,
  envMapIntensity: 1.35
});
M.frameDark = new THREE.MeshStandardMaterial({ color: 0x1f1f21, metalness: 0.6, roughness: 0.44, envMapIntensity: 1.1 });

M.soffit = new THREE.MeshStandardMaterial({
  map: tex(cedarWoodTex.map, { srgb: true, repeat: [1, 1] }),
  normalMap: tex(cedarWoodTex.normal),
  color: 0xffffff,
  roughness: 0.62, metalness: 0.0,
  normalScale: new THREE.Vector2(0.5, 0.5),
  envMapIntensity: 0.5
});
M.soffitTint = new THREE.MeshStandardMaterial({
  map: tex(cedarWoodTex.map, { srgb: true }),
  normalMap: tex(cedarWoodTex.normal),
  color: PAL.soffit,
  roughness: 0.62, metalness: 0.0, envMapIntensity: 0.5
});
M.soffitV = new THREE.MeshStandardMaterial({
  map: tex(cedarWoodTex.map, { srgb: true }),
  normalMap: tex(cedarWoodTex.normal),
  color: PAL.soffit,
  roughness: 0.62, metalness: 0.0, envMapIntensity: 0.5
});
M.soffitV.map.center.set(0.5, 0.5);
M.soffitV.map.rotation = Math.PI / 2;

M.cedar = new THREE.MeshStandardMaterial({
  map: tex(cedarWoodTex.map, { srgb: true }),
  normalMap: tex(cedarWoodTex.normal),
  color: PAL.soffit,
  roughness: 0.7, metalness: 0.0, envMapIntensity: 0.4
});

M.floor = new THREE.MeshStandardMaterial({
  map: tex(oakFloor.map, { srgb: true, repeat: [1, 1] }),
  normalMap: oakFloor.normal ? tex(oakFloor.normal) : null,
  color: PAL.floor,
  roughness: 0.5, metalness: 0.0,
  normalScale: new THREE.Vector2(0.55, 0.55),
  envMapIntensity: 0.65
});

M.plaster = new THREE.MeshStandardMaterial({
  map: tex(plainStone.map, { srgb: true, repeat: [1, 1] }),
  color: 0xf4efe4, roughness: 0.94, metalness: 0.0, envMapIntensity: 0.22
});

M.glass = (() => {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xa9c2c4, metalness: 0.38, roughness: 0.03,
    transparent: true, opacity: 0.22, ior: 1.52,
    clearcoat: 1.0, clearcoatRoughness: 0.014,
    envMapIntensity: 3.4, side: THREE.DoubleSide, depthWrite: false,
    specularIntensity: 1.0
  });
  /* real glass is clear face-on and a mirror at grazing angles: the alpha and
     a little sky bounce follow the Fresnel term, so the room stays readable
     and the pane still holds the sky */
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       float ndv = clamp(abs(dot(normalize(geometryNormal), normalize(vViewPosition))), 0.0, 1.0);
       float fres = pow(1.0 - ndv, 2.4);
       gl_FragColor.a = clamp(mix(0.15, 0.86, fres), 0.0, 1.0);
       gl_FragColor.rgb += vec3(0.40, 0.49, 0.53) * fres * 1.2;`
    );
  };
  return m;
})();

M.railGlass = (() => {
  const m = M.glass.clone();
  m.opacity = 0.16;
  m.metalness = 0.4;
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       float ndv2 = clamp(abs(dot(normalize(geometryNormal), normalize(vViewPosition))), 0.0, 1.0);
       float fres2 = pow(1.0 - ndv2, 3.0);
       gl_FragColor.a = clamp(mix(0.10, 0.48, fres2), 0.0, 0.5);
       gl_FragColor.rgb += vec3(0.42, 0.50, 0.54) * fres2 * 0.9;`
    );
  };
  return m;
})();

M.frosted = new THREE.MeshStandardMaterial({
  color: 0xe9e2d6, roughness: 0.62, metalness: 0.0,
  transparent: true, opacity: 0.62, envMapIntensity: 1.0,
  emissive: 0xffb877, emissiveIntensity: 0.35
});

M.warmGlow = new THREE.MeshBasicMaterial({ color: 0xffd2a0, fog: false });
M.poolTile = new THREE.MeshStandardMaterial({
  map: tex(poolTileTex.map, { srgb: true, repeat: [1, 1] }),
  normalMap: tex(poolTileTex.normal),
  color: PAL.poolTile,
  roughness: 0.24, metalness: 0.05, envMapIntensity: 0.9
});
M.poolBand = new THREE.MeshStandardMaterial({ color: 0x1c3431, roughness: 0.2, metalness: 0.05, envMapIntensity: 0.7 });
M.brass = new THREE.MeshStandardMaterial({ color: 0xb08a4e, roughness: 0.28, metalness: 1.0, envMapIntensity: 1.6 });
M.steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.34, metalness: 0.9, envMapIntensity: 1.2 });
M.charcoal = new THREE.MeshStandardMaterial({ color: 0x33322f, roughness: 0.6, metalness: 0.2, envMapIntensity: 0.7 });
M.linen = new THREE.MeshStandardMaterial({ color: 0xd9cfbc, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.35 });
M.charcoalFabric = new THREE.MeshStandardMaterial({ color: 0x4a4741, roughness: 0.96, metalness: 0.0, envMapIntensity: 0.3 });
M.gravel = new THREE.MeshStandardMaterial({
  map: tex(gravelTex.map, { srgb: true, repeat: [6, 6] }),
  normalMap: tex(gravelTex.normal),
  color: PAL.gravel, roughness: 1.0, metalness: 0.0, envMapIntensity: 0.3
});
/* the map already carries the green: tinting it with a green again squares
   the value and turns a lawn black */
M.lawn = new THREE.MeshStandardMaterial({
  map: tex(lawnTex, { srgb: true, repeat: [8, 8] }),
  color: new THREE.Color(0xc6d38a).multiplyScalar(1.35), roughness: 1.0, metalness: 0.0,
  envMapIntensity: 0.3
});
M.meadow = new THREE.MeshStandardMaterial({
  map: tex(meadowTex.map, { srgb: true, repeat: [26, 26] }),
  color: new THREE.Color(0xd9e2a8).multiplyScalar(1.55), roughness: 1.0, metalness: 0.0, envMapIntensity: 0.3
});
M.asphalt = new THREE.MeshStandardMaterial({
  map: tex(asphaltTex.map, { srgb: true, repeat: [4, 4] }),
  normalMap: tex(asphaltTex.normal),
  color: 0x8c8a86, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.3
});

/* ── geometry helpers ─────────────────────────────────────────────────────── */
const _geo = new Map();

/** A box whose UVs are metres, not normalised: one tile of the material every
    `tile` metres on every face, so a 16 m wall shows sixteen metres of stone
    instead of one stretched tile. Memoised per size. */
function boxGeo(w, h, d, tile = 3.1) {
  const k = w.toFixed(3) + '|' + h.toFixed(3) + '|' + d.toFixed(3) + '|' + tile;
  let g = _geo.get(k);
  if (g) return g;
  g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  /* BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 verts each) */
  const sx = [d / tile, d / tile, w / tile, w / tile, w / tile, w / tile];
  const sy = [h / tile, h / tile, d / tile, d / tile, h / tile, h / tile];
  for (let f = 0; f < 6; f++) {
    for (let i = 0; i < 4; i++) {
      const k2 = f * 4 + i;
      uv.setXY(k2, uv.getX(k2) * sx[f], uv.getY(k2) * sy[f]);
    }
  }
  uv.needsUpdate = true;
  _geo.set(k, g);
  return g;
}

/** A box whose own world UV scale is metres, so a 9 m wall does not stretch
    one tile of stone over its whole face. */
function box(mat, w, h, d, x, y, z, { cast = true, receive = true, uv = 3.1, rotY = 0 } = {}) {
  const m = new THREE.Mesh(boxGeo(w, h, d, uv), mat);
  m.position.set(x, y, z);
  if (rotY) m.rotation.y = rotY;
  m.castShadow = cast; m.receiveShadow = receive;
  world.add(m);
  return m;
}

/** Horizontal slab, top at y. */
function slab(mat, w, d, x, top, z, t = 0.3, opts) {
  return box(mat, w, t, d, x, top - t / 2, z, opts);
}

/** A stone wall from (x0,z0) to (x1,z1) at full height, axis-aligned. */
function wallRun(mat, x0, z0, x1, z1, y0, y1, t = 0.3) {
  const w = Math.abs(x1 - x0) || t, d = Math.abs(z1 - z0) || t;
  return box(mat, w, y1 - y0, d, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

/** Four bars around an opening, in the plane of the wall. */
function frameAround(mat, w, h, t, depth, x, y, z, axis = 'z') {
  const hw = w / 2 - t / 2, hh = h / 2 - t / 2;
  if (axis === 'z') {
    box(mat, w, t, depth, x, y + hh, z, { uv: 1 });
    box(mat, w, t, depth, x, y - hh, z, { uv: 1 });
    box(mat, t, h - t * 2, depth, x - hw + t / 2, y, z, { uv: 1 });
    box(mat, t, h - t * 2, depth, x + hw - t / 2, y, z, { uv: 1 });
  } else {
    box(mat, depth, t, w, x, y + hh, z, { uv: 1 });
    box(mat, depth, t, w, x, y - hh, z, { uv: 1 });
    box(mat, depth, h - t * 2, t, x, y, z - hw + t / 2, { uv: 1 });
    box(mat, depth, h - t * 2, t, x, y, z + hw - t / 2, { uv: 1 });
  }
}

/** A glazed opening with its bronze frame and a mid rail: the villa's window. */
function glaze(w, h, x, y, z, axis = 'z', bays = 2) {
  const depth = 0.12;
  if (axis === 'z') {
    box(M.glass, w - 0.1, h - 0.1, depth, x, y, z, { cast: false, receive: false });
    frameAround(M.frame, w, h, 0.075, 0.14, x, y, z, 'z');
    for (let i = 1; i <= bays - 1; i++) {
      box(M.frame, 0.055, h - 0.14, 0.13, x - w / 2 + (w / bays) * i, y, z, { uv: 1 });
    }
  } else {
    box(M.glass, depth, h - 0.1, w - 0.1, x, y, z, { cast: false, receive: false });
    frameAround(M.frame, w, h, 0.075, 0.14, x, y, z, 'x');
    for (let i = 1; i <= bays - 1; i++) {
      box(M.frame, 0.13, h - 0.14, 0.055, x, y, z - w / 2 + (w / bays) * i, { uv: 1 });
    }
  }
}

/* ── the main volume ──────────────────────────────────────────────────────── */
{
  const H = HOUSE.main;
  const w = H.x1 - H.x0, d = H.z1 - H.z0;
  const cx = (H.x0 + H.x1) / 2, cz = (H.z0 + H.z1) / 2;

  /* ground storey: stone on its two ends, glass between, recessed 1.1 m so the
     upper floor reads as a single plane laid on top */
  box(M.stone, 2.6, H.mid, d, H.x0 + 1.3, H.mid / 2, cz, { uv: 0.4 });          // west pier
  box(M.stone, 2.6, H.mid, d, H.x1 - 1.3, H.mid / 2, cz, { uv: 0.4 });          // east pier
  box(M.stone, 3.2, H.mid, 1.2, -3.4, H.mid / 2, H.z1 - 0.6, { uv: 0.4 });      // front pier, entry side
  /* the rear is the wall the pool sees: a full-height sliding glazed wall
     between the two stone piers, with a stone lintel over it */
  glaze(13.4, 3.5, -1.0, 1.85, H.z0 - 0.02, 'z', 4);
  box(M.stone, 13.4, 0.45, 0.3, -1.0, 3.72, H.z0 + 0.05, { cast: false });

  /* front: a glazed wall between the piers, the entry in the middle */
  glaze(6.4, 3.3, -4.4, 1.72, H.z1 - 0.15, 'z', 3);
  glaze(3.0, 3.3, 2.2, 1.72, H.z1 - 0.15, 'z', 2);


  /* west and east ends: one tall slot each */
  glaze(3.4, 2.9, H.x0 + 0.06, 2.4, cz + 1.0, 'x', 1);
  glaze(3.4, 2.9, H.x1 - 0.06, 2.4, cz - 1.6, 'x', 1);

  /* the upper floor: one stone plane, cantilevered 1.1 m past the glass */
  const up0 = H.mid, upH = H.h - H.mid;
  box(M.stone, w, upH, d + 1.1, cx, up0 + upH / 2, cz + 0.55, { uv: 0.36 });
  /* its ribbon window, held off the stone by a bronze reveal */
  box(M.frameDark, 11.6, 2.0, 0.16, -1.4, up0 + 1.55, H.z1 + 1.12, { uv: 1 });
  box(M.glass, 11.3, 1.8, 0.1, -1.4, up0 + 1.55, H.z1 + 1.2, { cast: false, receive: false });
  for (let i = 0; i < 5; i++) box(M.frame, 0.06, 1.8, 0.13, -7.0 + i * 2.8, up0 + 1.55, H.z1 + 1.19, { uv: 1 });

  /* roof: a deep flat slab, a crisp fascia, and the terrace above it */
  slab(M.coping, w + 1.5, d + 2.1, cx, H.h + 0.36, cz + 0.55, 0.36, { uv: 0.5 });
  box(M.frameDark, w + 1.52, 0.12, d + 2.12, cx, H.h + 0.06, cz + 0.55, { cast: false, receive: false });

  /* the terrace floor and its glass balustrade */
  slab(M.deck, w - 0.9, d - 0.9, cx, H.h + 0.42, cz + 0.1, 0.06, { cast: false });
  const bal = (w2, d2, x, z, axis) => {
    box(M.railGlass, axis === 'x' ? w2 : 0.03, 0.9, axis === 'x' ? 0.03 : d2, x, H.h + 0.92, z, { cast: false, receive: false });
    box(M.frame, axis === 'x' ? w2 : 0.06, 0.05, axis === 'x' ? 0.06 : d2, x, H.h + 1.43, z, { uv: 1 });
  };
  bal(w - 1.0, 0, cx, H.z1 + 1.56, 'x');
  bal(0, d - 1.0, H.x0 - 0.72, cz + 0.1, 'z');
  bal(0, d - 1.0, H.x1 + 0.72, cz + 0.1, 'z');

  /* the terrace, furnished: a pergola over its west third, two loungers, and
     three planters along the parapet. It is the frame the second beat reads. */
  {
    const ty = H.h + 0.42;
    const px0 = H.x0 + 1.4, px1 = H.x0 + 4.6, pz0 = H.z0 + 1.4, pz1 = H.z1 - 1.4;
    for (const px of [px0, px1]) for (const pz of [pz0, pz1]) {
      box(M.frame, 0.1, 2.4, 0.1, px, ty + 1.2, pz, { uv: 1 });
    }
    for (let i = 0; i < 8; i++) {
      box(M.soffitTint, px1 - px0 + 1.0, 0.1, 0.12, (px0 + px1) / 2, ty + 2.45, pz0 + 0.2 + i * ((pz1 - pz0 - 0.4) / 7), { uv: 1 });
    }
    /* two loungers, facing the view */
    for (let i = 0; i < 2; i++) {
      const lx = 0.4 + i * 1.9, lz = H.z0 + 3.0;
      box(M.soffitTint, 1.7, 0.12, 0.62, lx, ty + 0.28, lz, { uv: 1 });
      box(M.linen, 1.6, 0.1, 0.58, lx, ty + 0.36, lz, { cast: false, uv: 1 });
      box(M.soffitTint, 1.7, 0.42, 0.08, lx, ty + 0.56, lz - 0.34, { uv: 1 });
      box(M.frame, 0.06, 0.28, 0.06, lx - 0.75, ty + 0.14, lz - 0.24, { uv: 1 });
      box(M.frame, 0.06, 0.28, 0.06, lx + 0.75, ty + 0.14, lz - 0.24, { uv: 1 });
    }
    /* three planters along the rear parapet */
    for (let i = 0; i < 3; i++) {
      const bx = -1.0 + i * 2.6;
      box(M.stonePale, 1.1, 0.55, 1.1, bx, ty + 0.28, H.z0 + 1.3, { uv: 1 });
      box(M.lawn, 0.95, 0.22, 0.95, bx, ty + 0.6, H.z0 + 1.3, { cast: false, uv: 1 });
    }
  }

  /* the entry: a bronze portal in a deep reveal, cedar under the canopy */
  box(M.frameDark, 3.0, 3.3, 0.24, 0.0, 1.66, H.z1 + 0.02, { uv: 1 });
  box(M.charcoal, 1.65, 2.9, 0.1, 0.0, 1.45, H.z1 + 0.16, { uv: 1 });
  box(M.brass, 0.05, 1.1, 0.05, 0.72, 1.5, H.z1 + 0.24, { uv: 1 });
  slab(M.soffitTint, 6.2, 4.4, 0.0, H.mid - 0.05, H.z1 + 2.2, 0.12, { cast: true });
  box(M.frame, 0.16, H.mid - 0.2, 0.16, -2.8, (H.mid - 0.2) / 2, H.z1 + 4.2, { uv: 1 });
  box(M.frame, 0.16, H.mid - 0.2, 0.16, 2.8, (H.mid - 0.2) / 2, H.z1 + 4.2, { uv: 1 });

  /* the stone apron and its two steps, in the same stone as the walls */
  slab(M.coping, 6.4, 3.2, 0.0, 0.16, H.z1 + 3.4, 0.16, { cast: false });
  slab(M.coping, 7.2, 0.5, 0.0, 0.09, H.z1 + 5.2, 0.09, { cast: false });

  /* interior, read through the glass: oak floor, one plaster volume, a stair */
  slab(M.floor, 13.4, 9.0, -1.0, 0.13, cz - 0.4, 0.12, { cast: false });
  box(M.plaster, 3.6, H.mid, 4.4, 4.2, H.mid / 2, -5.0, { cast: false });
  for (let i = 0; i < 9; i++) {
    box(M.soffitTint, 1.5, 0.09, 0.28, 1.4, 0.34 + i * 0.36, -0.2 - i * 0.3, { cast: false });
  }
  box(M.glass, 0.04, 1.0, 2.6, 2.6, 1.6, -1.6, { cast: false, receive: false });

  /* the room behind the glass: two warm washes on the rear wall, and on the
     desktop one shadowless lamp. A phone keeps the emissive alone. */
  const wash = new THREE.MeshBasicMaterial({ color: 0xffca92, transparent: true, opacity: 0.5, fog: false });
  box(wash, 9.0, 0.9, 0.04, -1.5, 2.9, -8.9, { cast: false, receive: false });
  box(wash, 3.0, 0.5, 0.04, 3.6, 2.4, -8.9, { cast: false, receive: false });
  if (!MOBILE) {
    const lamp = new THREE.PointLight(0xffc08a, 9, 16, 2);
    lamp.position.set(-1.0, 2.6, -6.0);
    scene.add(lamp);
  }
  /* a low sofa and a rug, just enough to read as a furnished room */
  box(M.linen, 3.2, 0.42, 1.0, -3.0, 0.42, -6.2, { cast: false });
  box(M.linen, 3.2, 0.55, 0.24, -3.0, 0.72, -6.7, { cast: false });
  slab(M.charcoalFabric, 4.4, 3.0, -3.0, 0.16, -6.2, 0.04, { cast: false });
}

/* ── the wing: one storey, its roof is the terrace ────────────────────────── */
{
  const W = HOUSE.wing;
  const w = W.x1 - W.x0, d = W.z1 - W.z0;
  const cx = (W.x0 + W.x1) / 2, cz = (W.z0 + W.z1) / 2;
  box(M.plaster, w - 0.4, W.h, d - 0.4, cx, W.h / 2, cz, { cast: false });
  /* its front and east faces are glass behind a cedar screen */
  glaze(w - 1.2, 3.0, cx, 1.62, W.z1 - 0.1, 'z', 5);
  glaze(d - 1.2, 3.0, W.x1 - 0.1, 1.62, cz, 'x', 4);
  /* the wing's rear faces the pool: glass behind a cedar screen, so the water
     has a lit, layered backdrop rather than a blank wall */
  glaze(w - 2.2, 3.0, cx, 1.62, W.z0 + 0.02, 'z', 4);
  box(M.stone, 1.5, W.h, 1.4, W.x0 + 0.75, W.h / 2, W.z1 - 0.7, { uv: 0.4 });
  box(M.stone, w, W.h, 0.9, cx, W.h / 2, W.z0 + 0.45, { uv: 0.4 });
  slab(M.coping, w + 1.0, d + 1.0, cx, W.h + 0.34, cz, 0.34, { uv: 0.5 });
  slab(M.deck, w - 0.6, d - 0.6, cx, W.h + 0.4, cz, 0.06, { cast: false });
  box(M.railGlass, 0.03, 0.9, d - 0.8, W.x1 + 0.42, W.h + 0.9, cz, { cast: false, receive: false });
  box(M.frame, 0.06, 0.05, d - 0.8, W.x1 + 0.42, W.h + 1.4, cz, { uv: 1 });

  /* the cedar screen: one slat every 26 cm, instanced so it is one draw */
  const slatGeo = boxGeo(0.07, 3.0, 0.16);
  const n = 22;
  const inst = new THREE.InstancedMesh(slatGeo, M.cedar, n);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    mtx.makeTranslation(W.x0 + 1.9 + i * ((w - 2.4) / n), 1.62, W.z1 + 0.34);
    inst.setMatrixAt(i, mtx);
  }
  inst.castShadow = true; inst.receiveShadow = true;
  world.add(inst);
  slab(M.soffitTint, w - 1.0, 0.9, cx, 3.34, W.z1 + 0.42, 0.1, { cast: true });

  /* the terrace pergola on the wing roof: four posts, rafters, no clutter */
  const px0 = W.x1 - 4.6, px1 = W.x1 - 0.8, pz0 = cz - 2.6, pz1 = cz + 2.6;
  for (const px of [px0, px1]) for (const pz of [pz0, pz1]) {
    box(M.frame, 0.1, 2.5, 0.1, px, W.h + 1.65, pz, { uv: 1 });
  }
  box(M.soffitTint, px1 - px0 + 0.5, 0.12, 0.14, (px0 + px1) / 2, W.h + 2.95, pz0, { uv: 1 });
  box(M.soffitTint, px1 - px0 + 0.5, 0.12, 0.14, (px0 + px1) / 2, W.h + 2.95, pz1, { uv: 1 });
  for (let i = 0; i < 9; i++) {
    box(M.soffitTint, 0.1, 0.16, pz1 - pz0 + 0.9, px0 - 0.2 + i * ((px1 - px0 + 0.4) / 8), W.h + 3.05, cz, { uv: 1 });
  }
}

/* ── the garage block, and the carport that reaches for the street ────────── */
{
  const G = HOUSE.garage;
  const w = G.x1 - G.x0, d = G.z1 - G.z0;
  const cx = (G.x0 + G.x1) / 2, cz = (G.z0 + G.z1) / 2;
  box(M.stone, w, G.h, d, cx, G.h / 2, cz, { uv: 0.38 });
  /* the sectional door: bronze ribs, one panel */
  box(M.frame, 5.6, 2.9, 0.14, cx - 0.4, 1.45, G.z1 + 0.02, { uv: 1 });
  for (let i = 0; i < 6; i++) {
    box(M.frame, 5.5, 0.04, 0.06, cx - 0.4, 0.16 + i * 0.54, G.z1 + 0.1, { cast: false });
  }
  slab(M.coping, w + 1.2, d + 1.0, cx, G.h + 0.34, cz, 0.34, { uv: 0.5 });
  slab(M.deck, w - 0.8, d - 0.8, cx, G.h + 0.4, cz, 0.06, { cast: false });

  /* the carport: a stone fin off the garage, a slab, two slim columns, and the
     car standing under it facing the street */
  const cpX0 = G.x1, cpX1 = G.x1 + 5.6;
  const cpZ0 = G.z0 + 0.6, cpZ1 = G.z1;
  slab(M.coping, cpX1 - cpX0 + 0.4, cpZ1 - cpZ0 + 0.6, (cpX0 + cpX1) / 2, 3.16, (cpZ0 + cpZ1) / 2, 0.32, { uv: 0.5 });
  slab(M.soffitTint, cpX1 - cpX0, cpZ1 - cpZ0, (cpX0 + cpX1) / 2, 3.0, (cpZ0 + cpZ1) / 2, 0.1, { cast: false });
  box(M.stone, 0.34, 3.0, cpZ1 - cpZ0, cpX1 - 0.17, 1.5, (cpZ0 + cpZ1) / 2, { uv: 0.4 });
  box(M.frame, 0.14, 3.0, 0.14, cpX1 - 0.9, 1.5, cpZ1 - 0.3, { uv: 1 });
  slab(M.coping, cpX1 - cpX0 + 0.6, cpZ1 - cpZ0 + 0.4, (cpX0 + cpX1) / 2, 0.09, (cpZ0 + cpZ1) / 2, 0.09, { cast: false });

  /* EV: a small dark column on the garage's east face, a green pilot light */
  box(M.charcoal, 0.22, 0.5, 0.16, G.x1 + 0.02, 1.15, G.z1 - 1.1, { uv: 1 });
  box(M.warmGlow, 0.05, 0.05, 0.02, G.x1 + 0.13, 1.28, G.z1 - 1.1, { cast: false, receive: false });
  box(M.frameDark, 0.03, 0.24, 0.03, G.x1 + 0.02, 0.86, G.z1 - 1.1, { uv: 1 });
}

/* ─────────────────────────────────────────────────────────────────────────────
   5 · the ground, the deck, and the water
   The villa stands on a paved plateau; behind it the land falls away, so the
   pool's far edge is a real horizon rather than a wall. The water is one
   shader: a planar mirror on desktop, the sky's own colour on a phone.
   ───────────────────────────────────────────────────────────────────────────── */

/* ── the land ─────────────────────────────────────────────────────────────── */
{
  /* The lawn is laid around the terrace, never under it: one plane at the
     water's level would cover the pool. Four pieces, meeting the paving. */
  const lawnPiece = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.meadow);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, -0.02, z);
    m.receiveShadow = true;
    world.add(m);
    return m;
  };
  /* the lawn wraps the terrace on four sides and runs to the field behind */
  lawnPiece(49, 100, -35.5, -10);                                  // west
  lawnPiece(44, 100, 38, -10);                                     // east
  lawnPiece(DECK.x1 - DECK.x0, 49.4, 2.5, 15.3);                   // forecourt side
  lawnPiece(DECK.x1 - DECK.x0, 22.6, 2.5, -28.7);                  // rear

  /* the field: one plane from the garden to the haze, falling five metres over
     four hundred, so the eye reads a valley and the horizon sits above the
     water when the lens is low */
  const soilMat = M.meadow.clone();
  soilMat.map = M.meadow.map.clone();
  soilMat.map.needsUpdate = true;
  soilMat.map.repeat.set(48, 22);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(900, 430, 1, 1), soilMat);
  far.rotation.x = -Math.PI / 2 + 0.0116;
  far.position.set(0, -2.55, -255);
  far.receiveShadow = false;
  world.add(far);

  /* the deck's far edge is a stone face dropped to the field */
  box(M.stonePale, 34, 2.6, 0.4, 2.5, DECK_Y - 1.3, DECK.z0 - 0.2, { cast: false });
}

/* ── the terrace: travertine paving, laid around the water ───────────────── */
{
  const D = DECK, P = POOL, T = DECK_Y;
  const midZ = (P.z0 + P.z1) / 2, midX = (P.x0 + P.x1) / 2;
  /* four slabs, not one: the pool is a hole in the terrace, not a box under it */
  /* the far strip, the near strip, then the two ends between them */
  slab(M.deck, D.x1 - D.x0, P.z0 - D.z0, (D.x0 + D.x1) / 2, T, (D.z0 + P.z0) / 2, T, { cast: false });
  slab(M.deck, D.x1 - D.x0, D.z1 - P.z1, (D.x0 + D.x1) / 2, T, (P.z1 + D.z1) / 2, T, { cast: false });
  slab(M.deck, P.x0 - D.x0, P.z1 - P.z0, (D.x0 + P.x0) / 2, T, midZ, T, { cast: false });
  slab(M.deck, D.x1 - P.x1, P.z1 - P.z0, (P.x1 + D.x1) / 2, T, midZ, T, { cast: false });
  /* the coping: a sawn band around the water, one centimetre proud */
  const cw = 0.45;
  slab(M.coping, POOL.x1 - POOL.x0 + cw * 2, cw, midX, T + 0.02, POOL.z1 + cw / 2, 0.1, { cast: false });
  slab(M.coping, POOL.x1 - POOL.x0 + cw * 2, cw, midX, T + 0.02, POOL.z0 - cw / 2, 0.1, { cast: false });
  slab(M.coping, cw, POOL.z1 - POOL.z0, POOL.x0 - cw / 2, T + 0.02, midZ, 0.1, { cast: false });
  slab(M.coping, cw, POOL.z1 - POOL.z0, POOL.x1 + cw / 2, T + 0.02, midZ, 0.1, { cast: false });
}

/* ── the forecourt, the drive, the street ─────────────────────────────────── */
{
  /* entry court, from the porch to the gate line */
  slab(M.paving, 21.0, 9.0, 2.0, 0.1, 10.0, 0.1, { cast: false });
  /* drive: from the street to the carport */
  slab(M.paving, 5.4, 13.0, 17.6, 0.1, 16.5, 0.1, { cast: false });
  /* the street the camera arrives on */
  slab(M.asphalt, 90, 7.0, 0, 0.02, 26.0, 0.06, { cast: false });
  slab(M.coping, 90, 0.35, 0, 0.13, 22.35, 0.16, { cast: false });
  /* the far side of the street: a low garden wall, nothing loud */
  slab(M.stonePale, 90, 0.5, 0, 1.5, 30.2, 0.5, { uv: 0.5 });
}

/* The scene grades in two different places: the composite pass on desktop, the
   renderer on a phone. The water is a raw ShaderMaterial, so it has to follow
   the same path rather than guess: with post on it writes linear and the
   composite does ACES; with post off it applies the same curve itself. */
const WATER_POST = !MOBILE && renderer.capabilities.isWebGL2 && !/[?&]post=0/.test(location.search);
const WATER_GRADE_GLSL = WATER_POST ? '' : /* glsl */`
  vec3 rrtOdt(vec3 v){
    vec3 a = v * (v + 0.0245786) - 0.000090537;
    vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
    return a / b;
  }
  vec4 acesSRGB(vec3 color){
    const mat3 inMat = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 outMat = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    color *= ${SUN.exposure.toFixed(3)} / 0.6;
    color = outMat * rrtOdt(inMat * color);
    color = clamp(color, 0.0, 1.0);
    color = mix(color * 12.92, 1.055 * pow(color, vec3(0.41666)) - 0.055, step(vec3(0.0031308), color));
    return vec4(color, 1.0);
  }
`;
const WATER_OUT = WATER_POST ? '' : 'gl_FragColor = acesSRGB(gl_FragColor.rgb * gl_FragColor.a);';

/* ── the pool basin, with an infinity edge on its far side ────────────────── */
{
  const px = (POOL.x0 + POOL.x1) / 2, pz = (POOL.z0 + POOL.z1) / 2;
  const w = POOL.x1 - POOL.x0, d = POOL.z1 - POOL.z0;
  const floorY = -1.55;

  /* the floor and the walls, tiled; the near wall is a bench */
  box(M.poolTile, w, 0.12, d, px, floorY, pz, { cast: false });
  box(M.poolTile, 0.12, 1.55, d, POOL.x0 + 0.06, floorY / 2 + 0.05, pz, { cast: false });
  box(M.poolTile, 0.12, 1.55, d, POOL.x1 - 0.06, floorY / 2 + 0.05, pz, { cast: false });
  box(M.poolTile, w, 1.55, 0.12, px, floorY / 2 + 0.05, POOL.z1 - 0.06, { cast: false });
  box(M.poolTile, w, 0.42, 0.9, px, -1.34, POOL.z1 - 0.55, { cast: false });
  /* steps into the shallow end, on the east side */
  for (let i = 0; i < 3; i++) {
    box(M.poolTile, 1.9, 0.26, 0.34, POOL.x1 - 1.5, -1.45 + i * 0.26 + 0.13, POOL.z1 - 0.9 - i * 0.34, { cast: false });
  }
  /* the waterline band, in a darker tile, all round but the spill edge */
  const bY = WATER_Y + 0.05;
  box(M.poolBand, w, 0.12, 0.05, px, bY, POOL.z1 - 0.03, { cast: false });
  box(M.poolBand, 0.05, 0.12, d, POOL.x0 + 0.03, bY, pz, { cast: false });
  box(M.poolBand, 0.05, 0.12, d, POOL.x1 - 0.03, bY, pz, { cast: false });

  /* ── the infinity edge ──────────────────────────────────────────────────
     At the far side the coping stops: the water runs to a machined stone lip
     set exactly level, spills a thin sheet into a catch channel below, and the
     channel's own water sits dark and quiet. Nothing beyond the lip but the
     land falling away. */
  const edgeZ = POOL.z0;
  box(M.coping, w + 0.9, 0.16, 0.34, px, WATER_Y - 0.02, edgeZ - 0.17, { cast: true });
  /* the channel: two lips and a dark trough */
  box(M.coping, w + 0.9, 0.3, 0.16, px, WATER_Y - 0.30, edgeZ - 0.40, { cast: true });
  box(M.coping, w + 0.9, 0.42, 0.16, px, WATER_Y - 0.35, edgeZ - 0.92, { cast: true });
  box(M.charcoal, w + 0.7, 0.08, 0.5, px, WATER_Y - 0.44, edgeZ - 0.66, { cast: false });
  /* the channel water, nearly still, almost black */
  const chan = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.7, 0.5), new THREE.MeshStandardMaterial({
    color: 0x24413f, roughness: 0.06, metalness: 0.2, envMapIntensity: 1.6,
    transparent: true, opacity: 0.92
  }));
  chan.rotation.x = -Math.PI / 2;
  chan.position.set(px, WATER_Y - 0.32, edgeZ - 0.66);
  world.add(chan);

  /* the spill sheet: one thin sheet of water falling 0.28 m into the channel,
     drawn after the water so it reads as the surface tipping over the lip */
  const sheetUniforms = { uTime: { value: 0 }, uSunDir: { value: SUN_DIR.clone() } };
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.7, 0.34), new THREE.ShaderMaterial({
    uniforms: sheetUniforms,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uSunDir; varying vec2 vUv;
      void main(){
        /* vertical streaks that travel down the sheet, air drawn into it */
        float s = sin((vUv.x * 190.0) + sin(vUv.x * 41.0 + uTime * 0.9) * 2.2);
        float streak = 0.5 + 0.5 * s;
        float body = smoothstep(0.0, 0.22, vUv.y) * (1.0 - smoothstep(0.72, 1.0, vUv.y));
        vec3 col = mix(vec3(0.055, 0.235, 0.235), vec3(0.72, 0.86, 0.86), streak * 0.55 + 0.18);
        float a = body * (0.34 + 0.22 * streak);
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.62));
      }`
  }));
  sheet.position.set(px, WATER_Y - 0.17, edgeZ - 0.335);
  sheet.renderOrder = 3;
  world.add(sheet);
  var spillSheet = sheet;

  /* ── the water ──────────────────────────────────────────────────────────
     No mirror pass: the reflection is built from the sky's own colours, the
     reflected ray's elevation and the sun's column, which is what an infinity
     edge reflects anyway (open land, low sun, one long warm band). Two scrolling
     normal sets make the ripples, and near the spill edge the slope is damped
     to nothing: that water is level by definition, and the edge line has to be
     a line. Same code on every tier. */
  const waterNormalTex = tex(makeWaterNormal(512));

  const waterUniforms = {
    tNormal: { value: waterNormalTex },
    uTime: { value: 0 },
    uSunDir: { value: SUN_DIR.clone() },
    uSunCol: { value: new THREE.Color(1.78, 1.12, 0.70) },
    uDeep: { value: new THREE.Color(...PAL.water) },
    uShallow: { value: new THREE.Color(PAL.water[0] + 0.03, PAL.water[1] + 0.15, PAL.water[2] + 0.13) },
    uSkyCol: { value: new THREE.Color(0.20, 0.34, 0.62) },
    uHorizon: { value: new THREE.Color(SUN.fog) },
    uFogDensity: { value: SUN.fogDensity },
    uRipples: { value: 1 },
    uMin: { value: new THREE.Vector2(POOL.x0, POOL.z0) },
    uMax: { value: new THREE.Vector2(POOL.x1, POOL.z1) },
    uEdgeZ: { value: POOL.z0 }
  };

  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      varying vec3 vToEye;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mv = viewMatrix * wp;
        vToEye = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      ${WATER_GRADE_GLSL}
      uniform sampler2D tNormal;
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunCol;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      uniform vec3 uSkyCol;
      uniform vec3 uHorizon;
      uniform float uFogDensity;
      uniform float uRipples;
      uniform vec2 uMin;
      uniform vec2 uMax;
      uniform float uEdgeZ;
      varying vec3 vWorld;
      varying vec3 vToEye;

      void main() {
        vec2 uv0 = vWorld.xz;
        vec2 uv = uv0 + vec2(sin(uv0.y * 0.21 + uTime * 0.05), cos(uv0.x * 0.19 - uTime * 0.04)) * 0.5;

        /* a long swell, a chop, and the fine cat's paws that catch the light */
        vec3 a = texture2D(tNormal, uv * 0.085 + vec2(uTime * 0.014, uTime * 0.008)).rgb * 2.0 - 1.0;
        vec3 b = texture2D(tNormal, uv * 0.031 - vec2(uTime * 0.007, -uTime * 0.010)).rgb * 2.0 - 1.0;
        vec3 c = texture2D(tNormal, uv * 0.24 + vec2(-uTime * 0.030, uTime * 0.024)).rgb * 2.0 - 1.0;
        float gust = 0.80 + 0.32 * sin(uv0.x * 0.045 + sin(uv0.y * 0.052) * 1.7 + uTime * 0.06);
        vec2 slope = (a.xy * 0.46 + b.xy * 0.60 + c.xy * 0.30) * uRipples * gust;

        /* the last 2.4 m before the spill edge goes slack */
        float toEdge = uEdgeZ - vWorld.z;
        slope *= mix(0.06, 1.0, smoothstep(0.0, 2.4, toEdge));

        vec3 V = normalize(cameraPosition - vWorld);
        float dist = length(vToEye);
        /* ripples flatten with distance, or the far end of the pool boils */
        float nearK = 1.0 - smoothstep(8.0, 30.0, dist) * 0.7;
        vec3 N = normalize(vec3(slope.x * 0.22, 1.0, slope.y * 0.22));
        N = normalize(mix(vec3(0.0, 1.0, 0.0), N, nearK * 0.9 + 0.1));

        /* exact unpolarised Fresnel for air into water */
        float cosi = clamp(dot(N, V), 0.0, 1.0);
        float s2 = (1.0 / 1.333) * (1.0 / 1.333) * (1.0 - cosi * cosi);
        float fres = 1.0;
        if (s2 < 1.0) {
          float ct = sqrt(1.0 - s2);
          float rs = (cosi - 1.333 * ct) / (cosi + 1.333 * ct);
          float rp = (1.333 * cosi - ct) / (1.333 * cosi + ct);
          fres = 0.5 * (rs * rs + rp * rp);
        }

        /* what the surface reflects: the sky by elevation, warm at the ridge,
           blue overhead, with the sun's own column laid down the middle */
        vec3 R = reflect(-V, N);
        float el = clamp(R.y, -1.0, 1.0);
        vec3 refl = mix(uHorizon, uSkyCol, smoothstep(-0.01, 0.26, el));
        refl = mix(refl, uSkyCol * 1.05, smoothstep(0.24, 0.95, el));
        vec2 rh = normalize(vec3(R.x, 0.0, R.z)).xz;
        vec2 sh = normalize(vec3(uSunDir.x, 0.0, uSunDir.z)).xz;
        float sunCol = pow(clamp(dot(rh, sh), 0.0, 1.0), 7.0) * (1.0 - smoothstep(0.02, 0.42, el));
        refl += uSunCol * sunCol * 0.22;

        /* the body: absorption, so the pale floor shows through near the shelf
           and the deep end goes turquoise */
        vec2 door = min(vWorld.xz - uMin, uMax - vWorld.xz);
        float edgeD = min(door.x, door.y);
        float shallow = 1.0 - smoothstep(0.0, 0.6, edgeD);
        float sunFace = clamp(dot(N, uSunDir), 0.0, 1.0);
        float shim = sin(uv0.x * 1.55 + uTime * 0.55 + sin(uv0.y * 1.20 - uTime * 0.40) * 1.6)
                   * sin(uv0.y * 1.42 - uTime * 0.47 + sin(uv0.x * 1.05 + uTime * 0.33) * 1.5);
        shim = pow(abs(shim), 1.4);
        vec3 body = mix(uDeep, uShallow, 0.18 + 0.40 * sunFace + shallow * 0.42);
        body += uShallow * shim * 0.55;

        /* the mirror takes over as the eye flattens; the body rules looking down */
        vec3 col = mix(body, refl, clamp(fres * 2.1, 0.0, 0.95));

        /* sun glitter: one tight core with a wide, wind-stretched falloff */
        vec3 H = normalize(uSunDir + V);
        col += uSunCol * pow(max(dot(N, H), 0.0), 540.0) * 1.5;
        col += uSunCol * pow(max(dot(N, H), 0.0), 90.0) * pow(max(c.x, 0.0), 2.0) * 0.28;

        float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
        col = mix(col, uHorizon, clamp(fog, 0.0, 1.0));

        float lookDown = smoothstep(0.0, 0.85, cosi);
        float alpha = mix(0.62, 0.97, clamp(fres * 1.9, 0.0, 1.0));
        alpha *= mix(0.86, 1.0, smoothstep(0.0, 0.45, edgeD));
        gl_FragColor = vec4(min(col, vec3(0.94, 0.97, 0.99)), alpha);
        ${WATER_OUT}
      }`
  });

  const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.08, d + 0.04), waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(px, WATER_Y, pz - 0.02);
  waterMesh.renderOrder = 2;
  world.add(waterMesh);
  var water = waterMesh;

  waterUniforms.uTime = WIND.time;
  spillSheet.material.uniforms.uTime = WIND.time;
  (window.__house || (window.__house = {})).water = waterUniforms;
  window.__house.mesh = waterMesh;
  window.__house.THREE = THREE;
}

/* ─────────────────────────────────────────────────────────────────────────────
   6 · the garden
   Six amenity moments, no more: the infinity edge, a cedar sauna at its west
   end, a pergola over an outdoor kitchen at its east, a sunken lounge with a
   fire pit on the lawn, an outdoor shower by the water, and the car's charge
   point on the garage wall. Everything reads in a wide shot; nothing is
   fiddly enough to cost a draw call on a phone.
   ───────────────────────────────────────────────────────────────────────────── */

const glowTex = tex(makeGlowTexture(), { srgb: true });
const aoTex = tex(makeContactShadowTexture());

/** A soft warm pool of light on a surface: the sauna door, the fire bowl. */
function glowSprite(x, y, z, size, colour, opacity) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: colour, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false
  }));
  s.position.set(x, y, z);
  s.scale.set(size, size, 1);
  s.renderOrder = 4;
  world.add(s);
  return s;
}

/** Contact shade under a thing that stands on the ground. */
function contact(x, z, w, d, opacity = 0.55, y = 0.17) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({
    map: aoTex, transparent: true, opacity, depthWrite: false, color: 0x000000
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.renderOrder = 1;
  world.add(m);
  return m;
}

/* ── the sauna: one cedar box on the deck, lit from inside ─────────────────── */
{
  const S = { x0: -10.2, x1: -5.6, z0: -17.0, z1: -13.2, h: 2.86 };
  const sx = (S.x0 + S.x1) / 2, sz = (S.z0 + S.z1) / 2;
  const w = S.x1 - S.x0, d = S.z1 - S.z0;
  const base = DECK_Y;

  /* the box: cedar cladding, vertical, with a shadow gap at the base */
  box(M.cedar, w, S.h - 0.22, d, sx, base + 0.22 + (S.h - 0.22) / 2, sz, { uv: 0.4 });
  /* its roof: one shallow pitch, falling toward the pool, a crisp metal edge */
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.14, d + 0.5), M.frameDark);
  roof.position.set(sx, base + S.h + 0.16, sz);
  roof.rotation.x = 0.055;
  roof.castShadow = true; roof.receiveShadow = true;
  world.add(roof);
  box(M.soffitTint, w - 0.1, 0.07, d - 0.1, sx, base + S.h + 0.06, sz, { uv: 1 });

  /* the door, frosted, in its bronze frame, at the pool end */
  box(M.frameDark, 0.1, 2.3, 1.02, S.x1 - 0.02, base + 1.16, sz + 0.5, { uv: 1 });
  box(M.frosted, 0.06, 2.14, 0.88, S.x1 + 0.02, base + 1.16, sz + 0.5, { cast: false, receive: false });
  box(M.frameDark, 0.05, 0.06, 0.34, S.x1 + 0.08, base + 1.06, sz + 0.2, { uv: 1 });
  /* a narrow window beside it */
  box(M.frosted, 0.05, 0.7, 1.2, S.x1 + 0.01, base + 1.85, sz - 1.0, { cast: false, receive: false });
  box(M.frameDark, 0.08, 0.78, 1.28, S.x1 - 0.01, base + 1.85, sz - 1.0, { uv: 1 });

  /* inside: a bench along the far wall, the stove, a warm wall behind them */
  box(M.soffitTint, 0.55, 0.09, d - 1.4, S.x0 + 0.75, base + 0.52, sz - 0.2, { cast: false });
  box(M.soffitTint, 0.09, 0.42, d - 1.4, S.x0 + 0.5, base + 0.28, sz - 0.2, { cast: false });
  box(M.charcoal, 0.55, 0.7, 0.5, sx + 0.6, base + 0.4, S.z0 + 1.0, { cast: false });
  box(M.warmGlow, 0.3, 0.16, 0.3, sx + 0.6, base + 0.62, S.z0 + 1.0, { cast: false, receive: false });
  /* the glow: emissive, never a second shadow light, so a phone pays nothing */
  glowing: {
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.1), new THREE.MeshBasicMaterial({
      color: 0xffc79a, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide, fog: false
    }));
    inner.position.set(S.x0 + 0.9, base + 1.3, sz - 0.3);
    inner.rotation.y = Math.PI / 2;
    world.add(inner);
  }
  glowSprite(S.x1 + 0.5, base + 1.15, sz + 0.4, 2.6, 0xffb066, 0.2);
  glowSprite(S.x1 + 0.35, base + 1.85, sz - 1.0, 1.3, 0xffa860, 0.12);
  /* the light it throws on the travertine in front of the door */
  contact(S.x1 + 0.55, sz + 0.5, 5.0, 3.4, 0.22, base + 0.01);
  contact(sx, sz, w + 1.6, d + 1.6, 0.5, base + 0.005);
}

/* ── pergola over the outdoor kitchen, at the east end of the deck ────────── */
{
  const P = { x0: 8.8, x1: 13.4, z0: -10.2, z1: -6.8 };
  const px = (P.x0 + P.x1) / 2, pz = (P.z0 + P.z1) / 2;
  const base = DECK_Y;
  const H = 2.62;
  for (const x of [P.x0, P.x1]) for (const z of [P.z0, P.z1]) {
    box(M.frame, 0.12, H, 0.12, x, base + H / 2, z, { uv: 1 });
  }
  /* two beams and eleven rafters, cedar, with a little overhang toward the water */
  box(M.soffitTint, P.x1 - P.x0 + 1.5, 0.16, 0.14, px, base + H + 0.08, P.z0, { uv: 1 });
  box(M.soffitTint, P.x1 - P.x0 + 1.5, 0.16, 0.14, px, base + H + 0.08, P.z1, { uv: 1 });
  for (let i = 0; i < 11; i++) {
    box(M.soffitTint, 0.09, 0.18, P.z1 - P.z0 + 0.9, P.x0 - 0.65 + i * ((P.x1 - P.x0 + 1.3) / 10), base + H + 0.22, pz, { uv: 1 });
  }

  /* the counter: one stone mass, a steel grill set into it, two stools */
  box(M.stonePale, 3.4, 0.92, 0.8, px - 0.1, base + 0.46, P.z0 + 0.75, { uv: 0.5 });
  box(M.coping, 3.5, 0.07, 0.9, px - 0.1, base + 0.955, P.z0 + 0.75, { cast: false });
  box(M.charcoal, 0.9, 0.1, 0.55, px - 0.1, base + 0.99, P.z0 + 0.75, { cast: false });
  for (let i = 0; i < 6; i++) {
    box(M.steel, 0.72, 0.03, 0.032, px - 0.1, base + 1.05, P.z0 + 0.55 + i * 0.08, { cast: false });
  }
  for (let i = 0; i < 2; i++) {
    box(M.charcoal, 0.42, 0.06, 0.42, px - 0.9 + i * 1.5, base + 0.64, P.z0 + 1.75, { uv: 1 });
    box(M.charcoal, 0.06, 0.62, 0.06, px - 0.9 + i * 1.5, base + 0.33, P.z0 + 1.75, { uv: 1 });
  }
  contact(px, pz, 5.6, 6.4, 0.22, base + 0.005);
}

/* ── the sunken lounge and its fire pit, on the lawn west of the deck ─────── */
{
  const L = { x0: -17.4, x1: -12.4, z0: -13.0, z1: -8.0 };
  const lx = (L.x0 + L.x1) / 2, lz = (L.z0 + L.z1) / 2;
  const depth = 0.44;
  const w = L.x1 - L.x0, d = L.z1 - L.z0;

  /* the pit: four stone benches framing a sunken floor */
  slab(M.paving, w, d, lx, 0.02, lz, 0.06, { cast: false });
  box(M.stonePale, w, depth, 0.6, lx, -depth / 2, L.z0 + 0.3, { uv: 0.5 });
  box(M.stonePale, w, depth, 0.6, lx, -depth / 2, L.z1 - 0.3, { uv: 0.5 });
  box(M.stonePale, 0.6, depth, d - 1.2, L.x0 + 0.3, -depth / 2, lz, { uv: 0.5 });
  box(M.stonePale, 0.6, depth, d - 1.2, L.x1 - 0.3, -depth / 2, lz, { uv: 0.5 });
  /* seat cushions on two sides only: restraint */
  box(M.linen, w - 1.4, 0.11, 0.58, lx, 0.06, L.z1 - 0.3, { cast: false });
  box(M.linen, 0.58, 0.11, d - 1.6, L.x0 + 0.3, 0.06, lz, { cast: false });
  box(M.charcoalFabric, 0.5, 0.34, 0.5, L.x0 + 0.9, 0.2, L.z1 - 0.75, { cast: false });

  /* the fire bowl: stone ring, cold dark centre, embers glowing */
  const fx = lx, fz = lz - 0.2;
  box(M.stonePale, 1.25, 0.34, 1.25, fx, 0.17, fz, { uv: 0.5 });
  box(M.charcoal, 0.92, 0.06, 0.92, fx, 0.35, fz, { cast: false });
  box(M.warmGlow, 0.62, 0.04, 0.62, fx, 0.37, fz, { cast: false, receive: false });
  glowSprite(fx, 0.56, fz, 1.4, 0xff9a4e, 0.26);
  contact(lx, lz, w + 2.4, d + 2.4, 0.3, 0.02);
}

/* ── the outdoor shower, between the sauna and the water ─────────────────── */
{
  const x = -3.2, z = -16.0;
  const base = DECK_Y;
  box(M.coping, 1.5, 0.06, 1.3, x, base + 0.03, z, { cast: false });
  box(M.stonePale, 1.5, 0.14, 1.3, x, base + 0.09, z, { cast: true });
  /* two slatted screens, the corner left open to the view */
  const slat = boxGeo(0.9, 0.05, 0.06);
  const inst = new THREE.InstancedMesh(slat, M.cedar, 20);
  const mtx = new THREE.Matrix4();
  let k = 0;
  for (let i = 0; i < 10; i++) {
    mtx.makeTranslation(x - 0.62 + i * 0.135, base + 1.9, z - 0.62);
    inst.setMatrixAt(k++, mtx);
    mtx.makeTranslation(x - 0.62 + i * 0.135, base + 1.9, z + 0.62);
    inst.setMatrixAt(k++, mtx);
  }
  inst.castShadow = true;
  world.add(inst);
  box(M.frame, 0.05, 2.2, 0.05, x - 0.6, base + 1.1, z - 0.62, { uv: 1 });
  box(M.frame, 0.05, 2.2, 0.05, x - 0.6, base + 1.1, z + 0.62, { uv: 1 });
  /* the riser and a rain head on a curved arm */
  box(M.brass, 0.045, 2.1, 0.045, x - 0.55, base + 1.05, z, { uv: 1 });
  box(M.brass, 0.5, 0.04, 0.04, x - 0.32, base + 2.12, z, { uv: 1 });
  box(M.brass, 0.26, 0.03, 0.26, x - 0.1, base + 2.08, z, { uv: 1 });
  box(M.charcoal, 0.14, 0.1, 0.05, x - 0.55, base + 1.12, z, { uv: 1 });
}

/* ── the boundary: pale stone walls and a bronze gate the drive passes ────── */
{
  const H = 2.1, T = 0.32;
  /* front wall, with the gate opening at the drive */
  wallRun(M.stonePale, -21.0, 21.0, 15.3, 21.0, 0, H, T);
  wallRun(M.stonePale, 20.7, 21.0, 21.6, 21.0, 0, H, T);
  /* piers either side of the gate */
  box(M.stonePale, 0.6, 2.5, 0.6, 15.3, 1.25, 21.0, { uv: 0.5 });
  box(M.stonePale, 0.6, 2.5, 0.6, 20.7, 1.25, 21.0, { uv: 0.5 });
  /* the gate: vertical bronze bars, hung from the east pier, standing open */
  for (let i = 0; i < 9; i++) {
    box(M.frame, 0.06, 1.9, 0.06, 19.9 - 0.36, 1.0, 20.2 + i * 0.05, { uv: 1 });
  }
  box(M.frame, 0.9, 0.06, 0.06, 19.6, 1.95, 20.4, { uv: 1 });
  box(M.frame, 0.9, 0.06, 0.06, 19.6, 0.12, 20.4, { uv: 1 });

  /* the two side walls run back to the garden and step down at the rear */
  wallRun(M.stonePale, -21.0, 21.0, -21.0, -18.0, 0, H, T);
  wallRun(M.stonePale, 21.6, 21.0, 21.6, -18.0, 0, H, T);
  wallRun(M.stonePale, -21.0, -18.0, -21.0, -30.0, 0, 1.4, T);
  wallRun(M.stonePale, 21.6, -18.0, 21.6, -30.0, 0, 1.4, T);
  /* a low hedge along the rear edge, so the drop is a garden edge */
  box(M.meadow, 42, 0.7, 1.1, 0.3, 0.3, -18.3, { cast: false });
}

/* ── cypresses: the only procedural planting that survives the scan pass ──── */
{
  const cyTex = tex(makeCypressSurface(), { srgb: true });
  const cypMat = new THREE.MeshStandardMaterial({
    map: cyTex, color: 0x81905c, roughness: 0.95, metalness: 0.0, envMapIntensity: 0.45
  });
  const spots = [
    [19.9, 1.2, 1.0], [19.9, -2.2, 0.86], [-19.6, -8.5, 1.1], [-19.6, -12.4, 0.92]
  ];
  for (const [x, z, s] of spots) {
    const g = new THREE.ConeGeometry(0.62 * s, 5.6 * s, 8, 3);
    const m = new THREE.Mesh(g, cypMat);
    m.position.set(x, 2.8 * s, z);
    m.castShadow = true; m.receiveShadow = true;
    world.add(m);
    contact(x, z, 1.8 * s, 1.8 * s, 0.4, 0.03);
  }
}

/* ── the country beyond: a tree line, then hazy silhouettes ──────────────── */
{
  /* the tree line: one long, low mass at 90 to 170 m on three sides, dark and
     fully fogged. From the deck it is a band of vegetation, nothing to read. */
  const beltMat = new THREE.MeshBasicMaterial({ color: 0x232e1d, fog: true });
  for (let i = 0; i < 9; i++) {
    const x = -260 + i * 66 + (i % 3) * 14;
    const z = -210 - Math.abs(Math.sin(i * 2.7)) * 120;
    const h = 5.0 + Math.abs(Math.cos(i * 1.9)) * 3.0;
    const m = new THREE.Mesh(new THREE.BoxGeometry(58 + (i % 4) * 16, h, 18), beltMat);
    m.position.set(x, -4.4 + h / 2, z);
    m.rotation.y = 0.12 * (i % 3 - 1);
    world.add(m);
  }

  /* the skyline: nothing identifiable, in any direction, most of it haze */
  const blockMat = new THREE.MeshBasicMaterial({ color: 0x3c3934, fog: true });
  const boxes = [];
  const B = MOBILE ? 22 : 44;
  for (let i = 0; i < B; i++) {
    const a = (i / B) * Math.PI * 2 + 0.3;
    const r = 520 + Math.abs(Math.sin(i * 5.3)) * 420;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r * 0.9 - 260;
    const h = 8 + Math.abs(Math.cos(i * 2.1)) * 26;
    const w = 18 + Math.abs(Math.sin(i * 1.3)) * 30;
    const geoW = new THREE.BoxGeometry(w, h, w * (0.7 + Math.abs(Math.cos(i)) * 0.6));
    const m = new THREE.Mesh(geoW, blockMat);
    m.position.set(x, -7 + h / 2, z);
    m.rotation.y = a * 0.7;
    boxes.push(m);
    world.add(m);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   7 · the scanned models
   A small glTF 2.0 binary reader — one mesh per primitive, integer-quantised
   attributes read as they are written, no Draco, no KTX2, no extensions beyond
   the material ones. Every model is fetched after the first frame, each with a
   deadline; a prop that does not arrive leaves the scene exactly as drawn.

   The car is a free CC0 mid-size SUV (tevy.dev, re-encoded here to 166 kB, no
   textures). The planting, pots and bench are the Quixel Megascans props the
   Shadestate build already carries, served from ../walkthrough/models/ so the
   template does not duplicate them.
   ───────────────────────────────────────────────────────────────────────────── */
/* the car ships beside the scene; the Megascans props are shared with the main
   build, one directory over, so the template does not duplicate 8 MB */
const CAR_URL = options.carUrl || './models/suv.glb';
const PROP_BASE = options.propBase || '../walkthrough/models/';

function glbParts(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a GLB');
  let off = 12, json = null, bin = null;
  while (off + 8 <= buf.byteLength) {
    const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
    const start = off + 8;
    if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, start, len)));
    else if (type === 0x004E4942) bin = buf.slice(start, start + len);
    off = start + len + ((4 - (len % 4)) % 4);
  }
  if (!json) throw new Error('no JSON chunk');
  return { json, bin };
}

function glbAccessor(json, bin, index) {
  const a = json.accessors[index];
  const bv = json.bufferViews[a.bufferView];
  const comps = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
  const TA = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }[a.componentType];
  const base = (bv.byteOffset || 0) + (a.byteOffset || 0);
  const need = comps * TA.BYTES_PER_ELEMENT;
  const stride = bv.byteStride || need;
  if (stride === need) return { array: new TA(bin, base, a.count * comps), comps, normalized: !!a.normalized };
  /* interleaved: gather into a tight array */
  const out = new TA(a.count * comps);
  const dv = new DataView(bin);
  for (let i = 0; i < a.count; i++) {
    for (let c = 0; c < comps; c++) {
      const o = base + i * stride + c * TA.BYTES_PER_ELEMENT;
      out[i * comps + c] = TA === Float32Array ? dv.getFloat32(o, true)
        : TA === Uint16Array ? dv.getUint16(o, true)
        : TA === Int16Array ? dv.getInt16(o, true)
        : TA === Uint8Array ? dv.getUint8(o)
        : TA === Int8Array ? dv.getInt8(o) : dv.getUint32(o, true);
    }
  }
  return { array: out, comps, normalized: !!a.normalized };
}

function loadModel(url, timeout = 9000) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => ctl && ctl.abort(), timeout);
  return fetch(url, ctl ? { signal: ctl.signal, mode: 'cors' } : { mode: 'cors' })
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
    .then((buf) => {
      clearTimeout(timer);
      const { json, bin } = glbParts(buf);
      const matCache = new Map();
      const geoCache = new Map();

      function materialAt(i) {
        if (i == null) return new THREE.MeshStandardMaterial({ color: 0xbdb6a8, roughness: 0.8 });
        if (matCache.has(i)) return matCache.get(i);
        const def = json.materials[i] || {};
        const pbr = def.pbrMetallicRoughness || {};
        const col = pbr.baseColorFactor || [1, 1, 1, 1];
        const em = def.emissiveFactor || [0, 0, 0];
        const emS = (def.extensions && def.extensions.KHR_materials_emissive_strength && def.extensions.KHR_materials_emissive_strength.emissiveStrength) || 1;
        const transmission = !!(def.extensions && def.extensions.KHR_materials_transmission);
        const clearcoat = def.extensions && def.extensions.KHR_materials_clearcoat;
        const alpha = pbr.baseColorFactor && pbr.baseColorFactor[3] != null ? pbr.baseColorFactor[3] : 1;
        let m;
        if (transmission || def.alphaMode === 'BLEND' || alpha < 1) {
          m = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(col[0], col[1], col[2]),
            metalness: 0, roughness: 0.04, transparent: true, opacity: 0.42,
            ior: 1.5, envMapIntensity: 2.4, depthWrite: false, side: THREE.DoubleSide
          });
        } else if (clearcoat) {
          m = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(col[0], col[1], col[2]),
            metalness: pbr.metallicFactor != null ? pbr.metallicFactor : 0,
            roughness: pbr.roughnessFactor != null ? pbr.roughnessFactor : 1,
            clearcoat: 1, clearcoatRoughness: clearcoat.clearcoatRoughnessFactor != null ? clearcoat.clearcoatRoughnessFactor : 0.05,
            envMapIntensity: 1.55, side: THREE.DoubleSide
          });
        } else {
          m = new THREE.MeshStandardMaterial({
            color: new THREE.Color(col[0], col[1], col[2]),
            metalness: pbr.metallicFactor != null ? pbr.metallicFactor : 0,
            roughness: pbr.roughnessFactor != null ? pbr.roughnessFactor : 1,
            emissive: new THREE.Color(em[0], em[1], em[2]).multiplyScalar(emS > 1 ? 1 : 1),
            envMapIntensity: 1.0, side: THREE.DoubleSide
          });
          if (emS > 1) m.emissive.multiplyScalar(emS);
        }
        m.name = def.name || '';
        matCache.set(i, m);
        return m;
      }

      function geometryAt(pi) {
        if (geoCache.has(pi)) return geoCache.get(pi);
        const prim = json.meshes[pi].primitives[0];
        const g = new THREE.BufferGeometry();
        const P = glbAccessor(json, bin, prim.attributes.POSITION);
        g.setAttribute('position', new THREE.BufferAttribute(P.array, 3, P.normalized));
        if (prim.attributes.NORMAL != null) {
          const N = glbAccessor(json, bin, prim.attributes.NORMAL);
          g.setAttribute('normal', new THREE.BufferAttribute(N.array, 3, N.normalized));
        }
        if (prim.attributes.TEXCOORD_0 != null) {
          const T = glbAccessor(json, bin, prim.attributes.TEXCOORD_0);
          g.setAttribute('uv', new THREE.BufferAttribute(T.array, 2, T.normalized));
        }
        if (prim.indices != null) {
          g.setIndex(new THREE.BufferAttribute(glbAccessor(json, bin, prim.indices).array, 1));
        }
        if (prim.attributes.NORMAL == null) g.computeVertexNormals();
        g.computeBoundingSphere();
        geoCache.set(pi, g);
        return g;
      }

      function nodeAt(ni, parent) {
        const n = json.nodes[ni];
        const o = new THREE.Group();
        o.name = n.name || '';
        if (n.matrix) {
          const m = new THREE.Matrix4().fromArray(n.matrix);
          m.decompose(o.position, o.quaternion, o.scale);
        } else {
          if (n.translation) o.position.fromArray(n.translation);
          if (n.rotation) o.quaternion.fromArray(n.rotation);
          if (n.scale) o.scale.fromArray(n.scale);
        }
        if (n.mesh != null) {
          const prim = json.meshes[n.mesh].primitives[0];
          const mesh = new THREE.Mesh(geometryAt(n.mesh), materialAt(prim.material));
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          o.add(mesh);
        }
        if (n.children) for (const c of n.children) o.add(nodeAt(c, o));
        parent.add(o);
        return o;
      }

      const root = new THREE.Group();
      const sceneDef = json.scenes[json.scene || 0];
      for (const ni of sceneDef.nodes) root.add(nodeAt(ni, new THREE.Group()));
      root.userData.json = json;
      return root;
    })
    .catch((e) => { clearTimeout(timer); throw e; });
}

/** Place a loaded model: metres, on the ground, turned to face a direction. */
function place(obj, x, y, z, rotY = 0, scale = 1) {
  obj.position.set(x, y, z);
  obj.rotation.y = rotY;
  obj.scale.setScalar(scale);
  obj.updateMatrixWorld(true);
  world.add(obj);
  return obj;
}

/* ── the placements ─────────────────────────────────────────────────────────
   A template has to survive on a cheap phone, so the props arrive in waves:
   the car first (it is the one object the eye checks), then the planting, then
   the pots, bench and stone. A 4 GB phone gets the car, the bench and two pots
   and nothing else.                                                        */
const PROPS = [
  /* the car, under the carport, nose to the street */
  { key: 'suv', x: 17.4, y: 0.02, z: 7.0, rot: Math.PI * 0.02, scale: 1.0, wave: 1, lean: true },
  /* trees: one laurel on the west lawn, one at the rear-east corner */
  { key: 'laurel', x: -18.4, y: 0.0, z: -5.4, rot: 0.7, scale: 1.55, wave: 2, lean: false, file: 'laurel.glb', base: PROP_BASE },
  { key: 'laurel', x: 19.6, y: 0.0, z: -12.6, rot: 2.4, scale: 1.35, wave: 2, lean: false, file: 'laurel.glb', base: PROP_BASE },
  /* palms: one at the east end of the deck, one beyond the lawn edge */
  { key: 'fan_palm', x: 19.4, y: 0.0, z: -16.6, rot: 1.1, scale: 1.0, wave: 2, lean: false, file: 'fan_palm.glb', base: PROP_BASE },
  { key: 'cane_palm', x: -19.2, y: 0.0, z: -15.4, rot: 2.0, scale: 0.95, wave: 2, lean: false, file: 'cane_palm.glb', base: PROP_BASE },
  /* the planting around the water and the sauna */
  { key: 'snake_plant', x: -4.6, y: DECK_Y, z: -12.2, rot: 0.4, scale: 0.9, wave: 2, lean: false, file: 'snake_plant.glb', base: PROP_BASE },
  { key: 'snake_plant', x: 11.9, y: DECK_Y, z: -9.9, rot: 2.2, scale: 0.8, wave: 2, lean: false, file: 'snake_plant.glb', base: PROP_BASE },
  { key: 'yucca_a', x: -10.9, y: 0.0, z: -10.6, rot: 1.0, scale: 0.9, wave: 2, lean: false, file: 'yucca_a.glb', base: PROP_BASE },
  { key: 'ground_cover', x: -6.4, y: DECK_Y, z: -12.0, rot: 0.0, scale: 1.1, wave: 2, lean: false, file: 'ground_cover.glb', base: PROP_BASE },
  { key: 'fountain_grass', x: 15.2, y: 0.0, z: -9.0, rot: 2.8, scale: 1.0, wave: 2, lean: false, file: 'fountain_grass.glb', base: PROP_BASE },
  /* pots: at the entry, and at the sauna door */
  { key: 'pot_taper', x: -2.9, y: 0.16, z: 0.5, rot: 0.3, scale: 0.85, wave: 2, lean: true, file: 'pot_taper.glb', base: PROP_BASE },
  { key: 'pot_bowl', x: 3.1, y: 0.16, z: 0.4, rot: 1.4, scale: 0.9, wave: 2, lean: true, file: 'pot_bowl.glb', base: PROP_BASE },
  /* the bench on the deck, facing the water */
  { key: 'bench', x: 13.6, y: DECK_Y, z: -9.7, rot: Math.PI, scale: 1.0, wave: 2, lean: true, file: 'bench.glb', base: PROP_BASE },
  /* two stones in the gravel bed at the west wall */
  { key: 'boulder', x: -15.6, y: 0.0, z: -2.4, rot: 1.0, scale: 0.55, wave: 2, lean: false, file: 'boulder.glb', base: PROP_BASE },
  { key: 'boulder', x: -13.9, y: 0.0, z: -4.6, rot: 2.6, scale: 0.38, wave: 2, lean: false, file: 'boulder.glb', base: PROP_BASE },
  { key: 'sandstone', x: -14.8, y: 0.0, z: -6.6, rot: 0.5, scale: 0.5, wave: 2, lean: false, file: 'sandstone.glb', base: PROP_BASE }
];

let propsDone = 0;
const propStats = { asked: 0, loaded: 0, failed: 0 };

function loadProps() {
  if (CFG.props === false) return;
  const spots = PROPS.filter((p) => !(LEAN && !p.lean));
  propStats.asked = spots.length;

  const load = (p) => {
    const url = p.key === 'suv' ? CAR_URL : (p.base || PROP_BASE) + (p.file || (p.key + '.glb'));
    return loadModel(url, p.key === 'suv' ? 11000 : 9000).then((obj) => {
      place(obj, p.x, p.y, p.z, p.rot, p.scale);
      propsDone++;
      propStats.loaded++;
      if (p.key === 'laurel' || p.key === 'fan_palm' || p.key === 'cane_palm') {
        const c = new THREE.Mesh(new THREE.PlaneGeometry(2.6 * p.scale, 2.6 * p.scale), new THREE.MeshBasicMaterial({
          map: aoTex, transparent: true, opacity: 0.34, depthWrite: false, color: 0x000000
        }));
        c.rotation.x = -Math.PI / 2;
        c.position.set(p.x, p.y + 0.02, p.z);
        world.add(c);
      }
      if (p.key === 'suv') {
        const c = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 5.4), new THREE.MeshBasicMaterial({
          map: aoTex, transparent: true, opacity: 0.6, depthWrite: false, color: 0x000000
        }));
        c.rotation.x = -Math.PI / 2;
        c.rotation.z = p.rot;
        c.position.set(p.x, 0.05, p.z);
        world.add(c);
      }
      return obj;
    }).catch(() => { propStats.failed++; return null; });
  };

  /* wave one: the car, as soon as the first frame is up */
  const first = spots.filter((p) => p.wave === 1);
  const rest = spots.filter((p) => p.wave !== 1);
  const runFirst = () => Promise.all(first.map(load)).then(() => {
    /* wave two: the planting and the furniture, on idle */
    const go = () => Promise.all(rest.map(load));
    if (typeof requestIdleCallback === 'function') requestIdleCallback(go, { timeout: 5000 });
    else setTimeout(go, 1400);
  });
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(runFirst));
  } else {
    runFirst();
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   8 · camera, scroll, grade, loop
   Three beats on one continuous move: the street reveal, the rise over the roof
   terrace, and out across the pool to the spill edge. One scroll reading drives
   the camera, the copy and the progress hairline, so nothing can drift.
   ───────────────────────────────────────────────────────────────────────────── */

const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

/* The move. t is the scroll fraction; p is the eye, l the point it holds, fov
   the lens. The camera rises monotonically to the roof and settles level over
   the water, so the whole take reads as one crane move, never a bounce. */
const CAMERA_KEYS = [
  /* 01 · the street, from the drive: the three masses read as one house */
  { t: 0.000, p: [19.0, 4.20, 33.0], l: [-1.2, 4.6, 0.8], fov: 32 },
  { t: 0.100, p: [16.0, 3.90, 28.4], l: [-0.6, 4.4, -0.4], fov: 33 },
  { t: 0.210, p: [12.0, 3.40, 22.8], l: [0.2, 4.0, -1.6], fov: 34 },
  /* 02 · the rise: up the front, over the parapet, the terrace opening below */
  { t: 0.320, p: [8.6, 3.90, 17.8], l: [0.6, 3.9, -3.4], fov: 35 },
  { t: 0.420, p: [6.4, 6.60, 13.6], l: [0.8, 4.2, -5.4], fov: 36 },
  { t: 0.510, p: [8.2, 7.6, 13.0], l: [0.0, 4.2, -6.0], fov: 38 },
  { t: 0.590, p: [9.2, 11.2, 8.6], l: [0.2, 3.6, -8.0], fov: 39 },
  { t: 0.670, p: [10.0, 13.8, 2.6], l: [1.0, 2.6, -11.0], fov: 41 },
  /* 03 · around the east side and out over the pool, settling behind it */
  { t: 0.760, p: [9.4, 12.0, -4.4], l: [2.0, 1.4, -14.0], fov: 41 },
  { t: 0.840, p: [11.4, 8.6, -10.4], l: [1.2, 1.8, -9.6], fov: 42 },
  { t: 0.920, p: [15.4, 7.2, -15.4], l: [0.6, 2.0, -8.2], fov: 43 },
  { t: 1.000, p: [17.2, 6.3, -19.6], l: [0.4, 2.0, -7.6], fov: 43 }
];

const posCurve = new THREE.CatmullRomCurve3(CAMERA_KEYS.map((k) => V3(k.p)), false, 'centripetal', 0.5);
const tgtCurve = new THREE.CatmullRomCurve3(CAMERA_KEYS.map((k) => V3(k.l)), false, 'centripetal', 0.5);
posCurve.arcLengthDivisions = 800;
tgtCurve.arcLengthDivisions = 800;

const _tmpPos = new THREE.Vector3(), _tmpTgt = new THREE.Vector3();

function sampleCurve(curve, t, out) {
  const n = CAMERA_KEYS.length;
  if (t <= CAMERA_KEYS[0].t) return out.copy(curve.getPoint(0));
  if (t >= CAMERA_KEYS[n - 1].t) return out.copy(curve.getPoint(1));
  let i = 0;
  while (i < n - 2 && t > CAMERA_KEYS[i + 1].t) i++;
  const s = (t - CAMERA_KEYS[i].t) / (CAMERA_KEYS[i + 1].t - CAMERA_KEYS[i].t);
  /* the segment is eased, not the whole curve: each key is a beat that the eye
     can rest on, and the move between two keys is a single gesture */
  const e = s * s * (3 - 2 * s);
  return out.copy(curve.getPoint((i + e) / (n - 1)));
}

function fovAt(t) {
  const n = CAMERA_KEYS.length;
  if (t <= CAMERA_KEYS[0].t) return CAMERA_KEYS[0].fov;
  if (t >= CAMERA_KEYS[n - 1].t) return CAMERA_KEYS[n - 1].fov;
  let i = 0;
  while (i < n - 2 && t > CAMERA_KEYS[i + 1].t) i++;
  const s = (t - CAMERA_KEYS[i].t) / (CAMERA_KEYS[i + 1].t - CAMERA_KEYS[i].t);
  const e = s * s * (3 - 2 * s);
  return lerp(CAMERA_KEYS[i].fov, CAMERA_KEYS[i + 1].fov, e);
}

/* ── overlay: one line per beat, the brand, a hairline ────────────────────── */
const copyEls = Array.from(document.querySelectorAll('.copy__item'));
const brandEl = document.querySelector('.brand');
if (brandEl) brandEl.textContent = CFG.brand || '';
const barEl = document.getElementById('houseBar');
copyEls.forEach((el, i) => {
  const line = el.querySelector('.copy__line');
  if (line) line.textContent = COPY[i] || '';
  const b = BEATS[i];
  el.style.setProperty('--in', b ? b.in : 0.5);
  el.style.setProperty('--out', b ? b.out : 0.6);
});

function paintOverlays(p) {
  for (let i = 0; i < copyEls.length; i++) {
    const b = BEATS[i];
    if (!b) continue;
    const fadeIn = smoothstep(b.in, b.in + 0.06, p);
    const fadeOut = 1 - smoothstep(b.out - 0.05, b.out, p);
    const a = Math.min(fadeIn, fadeOut);
    const el = copyEls[i];
    el.style.opacity = a.toFixed(3);
    el.style.transform = `translate3d(0, ${((1 - a) * 18).toFixed(2)}px, 0)`;
    el.style.visibility = a < 0.01 ? 'hidden' : 'visible';
  }
  if (barEl) barEl.style.transform = `scaleX(${clamp(p).toFixed(4)})`;
  const hint = document.querySelector('.scrollhint');
  if (hint) hint.style.opacity = (1 - smoothstep(0.02, 0.09, p)).toFixed(3);
}

/* ── the scroll: one reading, damped once ─────────────────────────────────── */
let pTarget = 0, pSmooth = 0, lastPainted = -1;
let trackTop = 0, trackSpan = 1;

function measureScroll() {
  const rect = scrollHost.getBoundingClientRect();
  const vh = window.innerHeight;
  trackTop = rect.top + (window.scrollY || window.pageYOffset || 0);
  trackSpan = Math.max(1, rect.height - vh);
}

function readProgress() {
  const y = window.scrollY || window.pageYOffset || 0;
  const raw = (y - trackTop) / trackSpan;
  /* the scroll length multiplier: 1 is the authored runway; a smaller page can
     shorten or lengthen the take without touching a camera key */
  return clamp(raw);
}

window.addEventListener('scroll', () => { pTarget = readProgress(); }, { passive: true });
window.addEventListener('resize', () => { measureScroll(); pTarget = readProgress(); });
measureScroll();
pTarget = readProgress();
pSmooth = pTarget;

/* ── grade: bloom, film curve, vignette ────────────────────────────────────
   Desktop only. A phone keeps the renderer's own tone mapping and a CSS
   gradient; nothing in this block runs on the mobile tier. */
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
      uniforms: { tDiffuse: { value: null }, uThreshold: { value: 1.16 }, uKnee: { value: 0.86 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse; uniform float uThreshold; uniform float uKnee;
        varying vec2 vUv;
        void main(){
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          gl_FragColor = vec4(c * smoothstep(uThreshold, uThreshold + uKnee, l), 1.0);
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
        uBloom: { value: LOOK.bloom },
        uVeil: { value: LOOK.veil },
        uExposure: { value: SUN.exposure },
        uSaturation: { value: LOOK.saturation },
        uContrast: { value: LOOK.contrast },
        uBrightness: { value: 0.004 },
        uVignetteFrom: { value: 0.62 },
        uVignetteTo: { value: 1.28 },
        uVignetteColor: { value: new THREE.Color(0x14110d) },
        uVignette: { value: LOOK.vignette },
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
          c *= mix(vec3(0.982, 0.995, 1.022), vec3(1.034, 1.010, 0.972),
                   smoothstep(0.10, 0.88, luma));
          c = mix(vec3(luma), c, 1.0 + uSaturation);
          c = 0.5 + (1.0 + uContrast) * (c - 0.5);
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
      sceneRT, brightRT, blurA, blurB, quadMesh, quadCam, quadScene, brightMat, blurMat, compMat,
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
        quadMesh.material = brightMat;
        brightMat.uniforms.tDiffuse.value = sceneRT.texture;
        renderer.setRenderTarget(brightRT);
        renderer.render(quadScene, quadCam);
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
        quadMesh.material = compMat;
        compMat.uniforms.tScene.value = sceneRT.texture;
        compMat.uniforms.tBloom.value = blurB.texture;
        compMat.uniforms.uSeed.value = (performance.now() * 0.06) % 1000;
        renderer.setRenderTarget(null);
        renderer.render(quadScene, quadCam);
      }
    };
    /* the composite owns tone mapping, so the scene renders linear HDR */
    renderer.toneMapping = THREE.NoToneMapping;
  } catch (err) {
    console.warn('post pipeline unavailable', err);
    post = null;
  }
}

/* ── frame ────────────────────────────────────────────────────────────────── */
function applyCamera(t, dt) {
  const fov = fovAt(t);
  sampleCurve(posCurve, t, _tmpPos);
  sampleCurve(tgtCurve, t, _tmpTgt);
  if (_tmpPos.y < WATER_Y + 0.55) _tmpPos.y = WATER_Y + 0.55;
  camera.position.copy(_tmpPos);
  camera.lookAt(_tmpTgt);
  /* Portrait: the same lens would crop the house out of a phone frame, so the
     eye backs off along its own view axis and lifts a little, and the lens
     opens a third of a stop. Landscape is untouched. */
  const aspect = camera.aspect;
  const portrait = aspect < 1.15 ? clamp(1.15 / Math.max(0.4, aspect), 1, 2.05) : 1;
  if (portrait > 1) {
    const back = _tmpTgt.clone().sub(_tmpPos).normalize().multiplyScalar(-(portrait - 1) * 10.5);
    _tmpPos.add(back);
    _tmpPos.y += (portrait - 1) * 1.4;
  }
  camera.fov = fov * (1 + (portrait - 1) * 0.16);
  camera.updateProjectionMatrix();
  return fov;
}

function resize() {
  const w = section.clientWidth || window.innerWidth;
  /* a sticky stage is one screen: never let a taller track become the drawing
     buffer (340svh of canvas is three times the pixels for no picture) */
  const h = Math.min(section.clientHeight || window.innerHeight, window.innerHeight) || window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  if (post) post.setSize(w, h);
  measureScroll();
}

const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
if (ro) ro.observe(section);

const clock = new THREE.Clock();
let elapsed = 0, paused = false, rafId = 0, destroyed = false;
const coarse = MOBILE;
let lastFrameTime = 0;

function drawFrame() {
  renderer.info.reset();
  if (post) post.draw();
  else renderer.render(scene, camera);
}

function tick() {
  if (destroyed) return;
  rafId = requestAnimationFrame(tick);
  if (paused) return;
  const dt = Math.min(0.1, clock.getDelta());
  elapsed += dt;
  WIND.time.value = elapsed;
  skyDomeUniforms.uTime.value = elapsed;

  pTarget = readProgress();
  /* one damped follow, frame-rate independent: the camera never snaps */
  pSmooth += (pTarget - pSmooth) * (REDUCED ? 1 : (1 - Math.exp(-dt * 3.4)));
  if (Math.abs(pTarget - pSmooth) < 0.00004) pSmooth = pTarget;

  applyCamera(pSmooth, dt);
  if (Math.abs(pSmooth - lastPainted) > 0.0008) {
    paintOverlays(pSmooth);
    lastPainted = pSmooth;
  }
  drawFrame();
  canvas.classList.remove('is-loading');
  const poster = document.querySelector('.house__poster');
  if (poster && !poster.classList.contains('is-gone')) {
    poster.classList.add('is-gone');
    setTimeout(() => { poster.style.display = 'none'; }, 900);
  }
  lastFrameTime = performance.now();
}

/* ── first paint, then the models ─────────────────────────────────────────── */
resize();
applyCamera(pSmooth, 0);
paintOverlays(pSmooth);
await nextTick();
/* one frame drawn before the loader is revealed: the poster is the still, the
   canvas joins it silently under the fade */
drawFrame();
ctxStats.firstFrameMs = Math.round(performance.now());
canvas.classList.remove('is-loading');
loadProps();
tick();

/* ── the handle ───────────────────────────────────────────────────────────── */
const handle = {
  version: 'house-01/1.0',
  stats: ctxStats,
  props: propStats,
  progress(t) {
    if (t == null) return pSmooth;
    pTarget = pSmooth = clamp(t);
    applyCamera(pSmooth, 0);
    paintOverlays(pSmooth);
    drawFrame();
    return pSmooth;
  },
  /* point the lens anywhere, for authoring: an eye, a target, a lens */
  shot(p, l, fov) {
    camera.position.set(p[0], p[1], p[2]);
    camera.lookAt(l[0], l[1], l[2]);
    camera.fov = fov || 36;
    camera.updateProjectionMatrix();
    drawFrame();
    return true;
  },
  /* recolor what the palette owns, without rebuilding a texture */
  setPalette(name) {
    const p = PALETTES[name];
    if (!p) return false;
    M.stone.color.setHex(p.stone);
    M.stonePale.color.setHex(p.stoneShade);
    M.coping.color.setHex(p.stone);
    M.deck.color.setHex(p.deck);
    M.paving.color.setHex(p.stoneShade);
    M.concrete.color.setHex(p.stoneDeep);
    M.frame.color.setHex(p.frame);
    M.frame.metalness = p.frameMetal;
    M.frame.roughness = p.frameRough;
    M.soffitTint.color.setHex(p.soffit);
    M.soffitV.color.setHex(p.soffit);
    M.cedar.color.setHex(p.soffit);
    M.floor.color.setHex(p.floor);
    M.grass && M.grass.color.setHex(p.grass);
    M.lawn.color.setHex(p.grass);
    M.gravel.color.setHex(p.gravel);
    M.poolTile.color.setHex(p.poolTile);
    const w = (window.__house && window.__house.water) || null;
    if (w) {
      w.uDeep.value.setRGB(p.water[0], p.water[1], p.water[2]);
      w.uShallow.value.setRGB(p.water[0] + 0.04, p.water[1] + 0.13, p.water[2] + 0.11);
    }
    drawFrame();
    return true;
  },
  start() { if (paused) { paused = false; clock.getDelta(); tick(); } },
  stop() { paused = true; },
  destroy() {
    destroyed = true;
    cancelAnimationFrame(rafId);
    if (ro) ro.disconnect();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) { for (const k in m) { const v = m[k]; if (v && v.isTexture) v.dispose(); } m.dispose(); }
      }
    });
    renderer.dispose();
    if (post) { post.sceneRT.dispose(); post.brightRT.dispose(); post.blurA.dispose(); post.blurB.dispose(); }
  }
};

window.__houseHandle = handle;
window.__cam = camera;
window.__scene = scene;
return handle;
}
