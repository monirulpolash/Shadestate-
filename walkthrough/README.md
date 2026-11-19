# Casa da Luz — procedural 3D walkthrough

A scroll-driven, cinematic walkthrough of a Shadestate villa. You start far out on a
gravel drive, travel through the front door, glide through a double-height limestone hall,
step out through the sliding rear wall onto the terrace, and end orbiting the house.

**Everything is generated in code.** No `.glb`, no `.jpg`, no HDRI. Every texture is drawn
into a `<canvas>` at runtime, every form is built from primitives, and one procedural
equirect sky is both the visible background *and* the PMREM environment map — so a window
mullion, the pool and the horizon always reflect the same sun.

```
walkthrough/
├── scene.js                the whole experience (ES module, ~3,030 lines)
├── walkthrough.css         HUD, grading layers, editorial overlay, fallback —
│                           every selector scoped to #walk for the host page
├── vendor/three.module.js  three.js r160, vendored (see "Three.js" below)
└── README.md
```

It is already embedded in `../index.html` (section `#walkthrough`, page position 6);
its Framer twin is `../framer/ShadestateWalkthrough.tsx`. The standalone page it was
built on (`index.html`, `style.css`, `fonts/`) is gone — the host page loads the same
two Google families, so the woff2 set is not shipped twice.

---

## 1. Run it

Any static server works; ES modules need `http://`, not `file://`.

```bash
cd real-estate-template      # the folder that holds index.html
python3 -m http.server 8080
# open http://localhost:8080/#walkthrough
```

`?post=0` disables the post-processing chain (useful for profiling on weak GPUs).

### Three.js

three.js **r160.1** is vendored at `vendor/three.module.js` and imported as
`./vendor/three.module.js`. Nothing else is fetched at runtime: the two webfonts are local
woff2 files, so the page works completely offline and the console stays clean with no
third-party requests. To use the CDN instead, replace the import at the top of `scene.js`:

```js
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
```

---

## 2. How it is built

### Materials, all procedural

| surface | how |
|---|---|
| travertine / limestone | `makeStone()` — radial mottling, sedimentary bands, ~5k pores, grain speckle; a grayscale height canvas is turned into a normal map by `normalFromHeight()`, plus a roughness map |
| oak floor | `makeOakFloor()` — staggered planks, per-plank tone, grain strokes, knots, dark board gaps; normal map from the gaps |
| concrete | `makeConcrete()` — speckle, mottling, form-board seams |
| gravel drive | `makeGravel()` — 9k pebbles, dust, strong normal map |
| meadow | `makeMeadow()` — grass strokes over mottled base + normal map |
| limestone ashlar | `makeAshlar()` — five courses, staggered joints, per-block tone, sediment bands, joints recessed in the normal map |
| olive foliage | `makeLeafCluster()` — ~1,900 leaves over a soft green body, so thin cards fuse instead of reading as puffballs |
| bark | `makeBarkTextures()` — long flaking fissures with a lit lip, lichen, plus normal and roughness maps; trunks are swept, tapered, root-flared tubes (`limb()`) |
| grass | one instanced draw of 62k blades (12k mobile) in tufts — per-blade tint, dark base to sunlit tip, backlit rim, two gust frequencies, hand-applied fog |
| bougainvillea | `makeBractCard()` (three papery bracts round a small eye) and `makeVineLeafCard()`, tinted per instance in magenta / crimson / coral / warm pink |
| water | `makeWaterNormal()` — three wave sets → tileable normal map, driving a `ShaderMaterial` (Fresnel, sun glitter, sparkle) that mixes it over a half-res planar mirror |
| linen | fibre strokes |

### Shader detail (`onBeforeCompile`)

`weather()` injects a world-space value-noise pass into `MeshStandardMaterial`:
large-scale grime, vertical rain streaks and a darkened base where a wall meets the
ground. It is what stops the 2.5 m-tiled bitmap from reading as wallpaper: the pattern
never repeats because it is driven by world position, not UV.

### Geometry that you can actually walk through

`addWall()` splits a wall on every hole edge, so the door, the windows and the clerestories
are **real voids with the wall's own reveal depth** — the camera passes through them.
The rear facade is a five-bay sliding wall with one bay open; the camera exits through it.

### Draw calls

Static geometry is baked into world space and merged per material (`queue()` /
`mergeGeos()`), so the whole estate costs ~25–50 draw calls instead of ~900. Foliage,
the oak slat screen, shrubs and pebbles are `InstancedMesh`. The sun never moves, so the
shadow map is rendered once and then frozen (`shadowMap.autoUpdate = false`).

### Lighting

Golden hour: one warm directional key (4.6), a cool hemisphere fill (0.13) and the sky as
IBL. Interior point lights **cast shadows** (1024² cube maps, baked once) — without that,
light passes straight through walls and every room is flooded into flat beige. Cove strips
are emissive at HDR values so the bloom has something real to catch.

### Post-processing (`renderOrder` after the Lusion reference)

```
scene (linear HDR, half-float RT)
  → bloom   : high-pass (threshold 2.0) → ¼-res separable blur ×2   [10]
  → final   : ACES tone map → saturation → contrast → aspect-corrected
              vignette → 1/255 dither → exact sRGB transfer         [30]
  → screen
```

Tone mapping lives in the composite so the glow keeps its highlights. Mobile skips the
chain entirely (three renders straight to the canvas) and the CSS grade takes over.

### Scroll

Rendered progress eases with `p += (target - p) * (1 - exp(-11 * dt))` — frame-rate
independent, so it feels identical at 30, 60 or 144 fps. The canvas is `sticky` inside a
`600vh` section and is paused by `IntersectionObserver` when off-screen.

---

## 3. The camera map

`CAMERA_KEYS` in `scene.js` is the whole choreography: `{ t, p:[x,y,z], l:[x,y,z], fov }`.

| t | position | look-at | stage |
|---|---|---|---|
| 0.000 | 15.6, 5.2, 61 | 0, 4.5, 2.5 | wide establishing shot, 61 m out |
| 0.075–0.150 | → 12.8, 4.2, 46 | house | slow dolly along the drive, trees parallax past |
| 0.225–0.355 | → 8.6, 2.7, 30 | house | continues, camera drops toward eye height |
| 0.400–0.472 | → 1.0, 1.70, 13.5 | 0, 2.05, 5.8 | straightens onto the entry axis |
| 0.492–0.512 | 0, 1.66, 9.4 → 0, 1.65, 6.5 | 0, 1.90, 2.0 | **through the door** (exposure dips, vignette closes) |
| 0.534–0.565 | → −0.2, 1.74, 2.3 | −2.4, 2.3, −3 | interior blooms warm, fov opens to 50 |
| 0.610–0.660 | → −1.5, 2.02, −0.7 | −8.4, 3.2, 0.4 | stairwell + mezzanine |
| 0.705–0.780 | → 0.6, 1.80, −5.4 | 3.4, 1.75, −12 | turns toward the rear glazing |
| 0.808–0.830 | 1.2, 1.78, −7.0 → 1.4, 1.95, −9.2 | pool | **out through the open slider** |
| 0.860 → 1.000 | orbital | house centre | **360° orbit**: radius 8.1 → 34 m, height 2.0 → 14 m |

The spline is a `CatmullRomCurve3` (centripetal) and each key owns an equal slice of the
curve parameter, so the curve passes **exactly** through every authored point — which is
what keeps the doorway framing precise at speed. At `t = 0.86` the path hands over to an
analytic orbit (`ORBIT`), matched in position *and* direction, so there is no seam.

### Changing the shot

- **Move the camera:** edit a key's `p` / `l` / `fov`. Add keys freely — the lookup maps
  index → `t`, so inserting a key only re-slices timing.
- **Faster/slower pass through the door:** shift the `t` values around 0.49–0.53.
- **More or fewer orbit turns:** `ORBIT.turns` (1 = one full revolution over the last 14%).

---

## 4. Changing the house

`A` and `B` are the two volumes; every wall, roof, floor and opening is derived from them:

```js
const A = { x0: -10, x1: 4, z0: -6, z1: 6, h: 6.8, t: 0.5 };  // stone, double height
const B = { x0: 3.6, x1: 13, z0: -6, z1: 3.2, h: 3.9, t: 0.42 }; // timber wing
const DOOR = { a: -1.15, b: 1.15, top: 2.95 };
const REAR = { a: -6.0, b: 2.2, top: 3.35 };
const POOL = { x0: -3.2, x1: 8.4, z0: -19.6, z1: -9.8 };
```

- **Wider house:** change `x1` of `A`/`B` and the `REAR.a/b` opening to match.
- **Taller/darker:** `h` on both volumes (the roof, plinth and parapet follow).
- **New opening:** add `{ a, b, y0, y1 }` to the wall's `holes` array *and* call `glaze()`
  with the same numbers if you want glass in it.
- **The camera path must be re-checked** whenever you move a wall the camera passes
  through: keep the door, the rear slider and the orbit radius clear.

---

## 5. How it sits inside `real-estate-template/`

It is integrated (page position 6, inside the template's own `#walkthrough` section).
What was actually done, in case you move or re-embed it:

1. **Files** — `scene.js`, `walkthrough.css`, `vendor/`, this README. `style.css` became
   `walkthrough.css` **with every selector prefixed by `#walk`** and its `:root` tokens
   moved onto `#walk`, so it cannot touch the host's `.btn`, `.eyebrow`, `.display`,
   `--espresso` or heading rules in either direction. The local `fonts/` and `fonts.css`
   were dropped: the host already loads Cormorant Garamond + Plus Jakarta Sans.

2. **Head** — one extra stylesheet, after the host's own:

   ```html
   <link rel="stylesheet" href="walkthrough/walkthrough.css">
   ```

3. **Markup** — the `<section class="walk" id="walk"> … </section>` block (canvas,
   grading layers, HUD, the six editorial overlays, the CSS poster fallback) sits under
   the template's `<div class="walkthrough__head">`. The closing paper's CTA points at
   the host's `#inquire`.

4. **Module** — before `</body>`:

   ```html
   <script type="module" src="walkthrough/scene.js"></script>
   ```

5. **Ids** — the module looks up `#walk` and `#scene`; the host uses `#walkthrough`
   and `#shadestate-3d`, so both are free. Inside the section the scene also queries
   `.copy__item`, `.walk__*`, `.hud*` — all unique to this block.

6. **Sticky** — the section is `600vh` tall on purpose (the scroll rail). Two rules:

   - no ancestor may be a scroll container. The host's `.walkthrough` uses
     `overflow: clip` (not `hidden`) for exactly this reason, and
     `html`/`body` must not get `overflow: hidden` while the section is on screen.
   - a window-based smooth scroller (Lenis) is fine — it moves the real scroll
     offset. A library that transforms a wrapper (or scroll-snapping) is not.

7. **Failure** — `fail()` adds `.no-webgl` to the section itself (as well as to
   `<html>`), and the error listeners only react to this module's own failures, so an
   unrelated error elsewhere on the host page cannot hide the section.

The `?post=0` switch still works on the host URL while profiling.

---

## 6. Framer

`ShadestateWalkthrough.tsx` is a self-contained Code Component containing the same scene.

1. **Assets → Code → New File**, name it `ShadestateWalkthrough.tsx`, paste the file.
2. **Insert → Code Component → ShadestateWalkthrough**.
3. Property controls: `Rail (vh)`, `Eyebrow`, `Lines`, `Stone`, `Field`.
4. Set the component's height to anything — it renders its own `railVh × 100vh` rail with a
   sticky canvas inside, and reads the page scroll.

It imports three from `https://esm.sh/three@0.160.1` at runtime, so the first paint waits
for that fetch (show a colour placeholder). For a fully self-hosted build, replace that
import with a bundled copy.

---

## 7. Performance

| | desktop | mobile |
|---|---|---|
| pixel ratio cap | 2 | 1.5 |
| shadow map | 2048² + four 1024² point cubes (baked once) | 1024² + four 512² |
| post chain | bloom + grade (5 passes at ¼ res) | none, CSS grade only |
| leaves / shrubs / pebbles | 100% | ~55% |
| grass blades | 62k (1 draw) | 12k (1 draw) |
| draw calls | ~55–200 depending on stage (approach 118, terrace 57) | ~40 |
| triangles | ~630k approach, ~1.24M terrace | ~320k |

Additional discipline:

- `IntersectionObserver` stops the loop when the section is off-screen.
- The shadow maps are rendered **once** and frozen — the estate never moves.
- `ResizeObserver` keeps the canvas and every render target in sync.
- `prefers-reduced-motion` snaps to eight authored still views and disables drag-look,
  water and dust animation; there is no interpolated camera motion at all.
- No WebGL → the section collapses to a CSS poster with the same typography
  (`.fallback`), no three.js is loaded.

---

## 8. Known limitations

- **The water's mirror is planar and half-res.** It reflects what is above the surface
  (house, trees, sky) from a second camera reflected about the water plane; the pass is
  skipped unless the pool is on screen, within 52 m and the eye is above the surface, and
  mobile falls back to a sky-colour reflection.
- **No SSAO/GTAO.** Contact darkening comes from the sun shadow map, the baked point-light
  cubes and the shader's base darkening. Corners at oblique angles can look a touch light.
- **The interior furniture is modelled from primitives** (sofa, table, stair, pendant,
  lamp, island) and reads well at walk-through speed, less so if you freeze and stare.
- **Frames animate the camera, the water, the grass, the leaf and bract sway and the dust
  motes**; the buildings, trunks and shadows are static, which is why the shadow maps can
  be frozen. Sway is one shared clock in the vertex shader, so it costs one uniform.
- **Pinned scroll** assumes the document scrolls. Scroll-hijacking libraries that transform
  a wrapper will break the sticky canvas (see integration step 7).
