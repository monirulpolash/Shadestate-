# Casa da Luz — procedural 3D walkthrough

A scroll-driven, cinematic walkthrough of a Shadestate villa. You start far out on a
gravel drive, travel through the front door, cross a double-height travertine hall with a
gallery over it, step out through the sliding rear wall onto the pool terrace, and end
orbiting a two-storey house with a city standing on the horizon behind it.

The house is 18.7 m wide and 14.4 m deep over two floors: a recessed, entirely glazed
ground floor under an upper storey that overhangs it by 1.8 m at the front and 1.6 m at
the west, a loggia cut into that upper front, a floating oak stair in the void, a glass
gallery around it, a bridge over the entry, a roof lantern over the hall skylight, and a
roof deck with a pergola over the single-storey wing.

**Everything is generated in code.** No `.glb`, no `.jpg`, no HDRI. Every texture is drawn
into a `<canvas>` at runtime, every form is built from primitives, and one procedural
equirect sky is both the visible background *and* the PMREM environment map — so a window
mullion, the pool and the horizon always reflect the same sun.

```
shadestate-3d/
├── index.html              page + editorial overlay
├── style.css               typography, HUD, grading layers, fallbacks
├── scene.js                the whole experience (ES module, ~3,000 lines)
├── fonts.css               @font-face for the two local webfonts
├── fonts/                  Cormorant Garamond + Plus Jakarta Sans (latin woff2)
├── vendor/three.module.js  three.js r160, vendored (see "Three.js" below)
├── ShadestateWalkthrough.tsx  self-contained Framer Code Component
├── previews/               captured frames of each stage
└── README.md
```

---

## 1. Run it

Any static server works; ES modules need `http://`, not `file://`.

```bash
cd shadestate-3d
python3 -m http.server 8080
# open http://localhost:8080/
```

`?post=0` disables the post-processing chain (useful for profiling on weak GPUs).
`?aa=0` drops MSAA; `?capture=1` keeps the drawing buffer so tooling can screenshot it.

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
| limestone ashlar | `makeAshlar()` — five courses of staggered blocks, per-block tone, sediment bands and open pores, joints recessed in the height map |
| olive foliage | `makeLeafCluster()` — a soft green body under ~1,900 leaves on an alpha card, instanced |
| bark | `makeBarkTextures()` — long flaking fissures with a lit lip, lichen, plus normal and roughness maps |
| pool tile | `makePoolTile()` — 8 × 8 pale green-grey ceramic with grout |
| bougainvillea | `makeBractCard()` (three papery bracts) and `makeVineLeafCard()`, tinted per instance |
| cypress surface | `makeCypressSurface()` — dark green, vertically streaked, almost black in shade |
| cypress needles | `makeNeedleCluster()` — a thousand short sprays on an alpha card, instanced |
| date palm trunk | `makePalmBark()` — overlapping leaf-base diamonds down a dusty grey column |
| oak / walnut joinery | `makeWoodGrain()` — long grain, cathedral figure around knots, open pores, plus a normal map |
| bouclé | `makeBoucle()` — loop-pile arcs over a slubbed wool ground |
| wool rug | `makeRug()` — weft ribs, warp threads, flecks, a fine 2048² weave |
| framed work | `makeArtwork()` — warm paper, one ochre disc, one ink gesture |
| the city | a 128 × 256 canvas of window bays (a few lamps left on) as map and emissive map, per-instance tint, and an aerial-haze mix in the fragment shader |
| water | `makeWaterNormal()` — three interfering wave sets → tileable normal map, scrolled in the shader |
| linen | fibre strokes |

### Shader detail (`onBeforeCompile`)

`weather()` injects a world-space value-noise pass into `MeshStandardMaterial`:
large-scale grime, vertical rain streaks and a darkened base where a wall meets the
ground. It is what stops the 2.5 m-tiled bitmap from reading as wallpaper: the pattern
never repeats because it is driven by world position, not UV.

### Landscape, water, paper flower

- **Olives.** Each olive is a swept, tapered, root-flared trunk on a kinked spine
  (`limb()` builds a `TubeGeometry`-style tube with per-ring radius and bark UVs along
  the grain), five forking limbs, two or three twigs each, buttress roots, and a crown of
  displaced foliage clumps (body + shadow) wrapped in alpha cards for the silhouette.
- **Cypresses.** Not cards: a flared trunk under a closed surface of revolution whose
  radius is modulated by height *and* by angle, so both its silhouette and its shading
  change as you walk past. Tiered clumps sit inside that body for organic mass, and
  instanced needle cards at its surface give the ragged edge. It reads as one volume from
  any angle, at 3 m or at 100 m.
- **Date palms.** Ten of them. The trunk is a chain of short tapered cylinders laid along
  a leaning spline, each segment stepping wider than its base to leave a leaf-base collar;
  a crownshaft, a crown of 26 arched fronds plus an inner whorl, six dry skirt fronds and
  three date clusters. A frond is real geometry — a rachis with two ranks of leaflet
  triangles in a twisted frame, so the crown has depth instead of reading as a fern.
- Clumps, cards, needles and vine bracts all sway on the GPU: `windify()` replaces
  `project_vertex` so the displacement happens in world space after instancing, driven by
  one shared `WIND.time` uniform.
- **Grass.** One `InstancedBufferGeometry` draw of ~62k blades in tufts. Placement follows
  the drive, the house apron and a wide falloff, skips paving and the pool, and shortens
  where the lawn meets the gravel. The shader bends each blade by its own height with two
  gust frequencies, shades it from a dark base to a sunlit tip (per-blade tint), adds a
  backlit rim and applies fog by hand.
- **Water.** A `ShaderMaterial` over the basin: two scrolling wave normal sets drive a
  Fresnel mix between a deep-teal body and a **planar reflection** of the house, trees and
  sky, plus sun glitter. The mirror is a second camera reflected about the water plane,
  rendered into a half-resolution target only when the pool is on screen, close enough and
  the eye is above it; the water and the basin are on layer 1 so the mirror pass skips them.
  Underwater tiles get moving caustics from `caustic()`; there is a bench, steps and a
  dark waterline band. Mobile skips the mirror and falls back to a sky-colour reflection.
- **Paper flower.** Bougainvillea runners are swept stems along the entry canopy, the
  pergola beams, the wing's roof edge, the wall by the door and the rear wall. Leaves and
  bract clusters are instanced cards with per-instance magenta/crimson/coral colour,
  a touch of emissive warmth and the same wind sway, with extra dense `mass()` fills where
  the vine is established.

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
| 0.000 | 15.2, 3.3, 62 | 0, 4.6, 2.2 | the drive, whole villa and both palms in frame |
| 0.075–0.150 | → 13.8, 2.9, 50 | house | slow dolly down the gravel |
| 0.225–0.300 | → 11.2, 2.4, 38 | house | continues, camera at walking height |
| 0.355–0.440 | → 3.2, 1.85, 17.4 | 0, 2.4, 5.6 | straightens onto the entry axis, under the porch |
| 0.470–0.522 | 1.2, 1.74, 13.2 → 0, 1.66, 6.9 | 0, 1.95, 0.6 | **through the door** (exposure dips, vignette closes) |
| 0.545–0.615 | → −1.5, 1.86, 1.6 | −6.4, 2.2, −3.4 | hall opens to 8 m, the stair and gallery above |
| 0.655–0.705 | → −2.6, 1.96, 0.2 | −5.8, 2.15, −5.6 | the living room, the rear glass, the city beyond |
| 0.745–0.800 | → −0.1, 1.84, −4.2 | 1.8, 2.1, −10.4 | turns toward the sliding wall |
| 0.816–0.836 | 0.7, 1.80, −5.9 → 7.2, 1.58, −8.6 | pool | **out through the open bay**, a glide east along the terrace |
| 0.845 | 10.4, 1.42, −11.2 | −3.0, 2.1, −15.0 | **the terrace**: the house corner, the pool, the skyline |
| 0.858 → 1.000 | orbital | house centre | **360° orbit**: radius 15 → 48 m, height 1.9 → 14 m |

The spline is a `CatmullRomCurve3` (centripetal) and each key owns an equal slice of the
curve parameter, so it passes **exactly** through every authored point.

On a phone the take would crop a 30 m facade, so `applyCamera` backs the camera off along
its own view ray on the exterior half (up to 6% at the door approach) and widens the fov by
up to 46%; by t = 0.47 both return to normal, so the doorway framing is identical.

### Changing the shot

- **Move the camera:** edit a key's `p` / `l` / `fov`. Add keys freely — the lookup maps
  index → `t`, so inserting a key only re-slices timing.
- **Faster/slower pass through the door:** shift the `t` values around 0.49–0.53.
- **More or fewer orbit turns:** `ORBIT.turns` (1 = one full revolution over the last 14%).

---

## 4. Changing the house

Four constants in section 6 carry the whole massing — every wall, roof, opening, slab and
camera clearance is derived from them:

```js
const G    = { x0: -12.5, x1: 4.0, z0: -6.0, z1: 6.6, h: 4.05, t: 0.54 };  // glazed ground floor
const S    = { x0: -14.1, x1: 4.6, z0: -6.0, z1: 8.4, y0: 4.05, y1: 8.15 }; // overhanging upper floor
const WING = { x0: 4.0, x1: 16.2, z0: -6.0, z1: 3.4, h: 3.72 };            // one storey + roof deck
const ATRIUM = { x0: -10.6, x1: 1.4, z0: -6.0, z1: 2.4 };                  // the void through both
const DOOR = { a: -1.3, b: 1.3, top: 3.05 };
const REAR = { a: -6.4, b: 1.6, top: 3.85 };
const SKY  = { x0: -8.4, x1: -2.8, z0: -5.2, z1: 0.9 };                    // hall skylight / lantern
```

- **Wider:** change `G.x1` / `S.x1` and the wing's `x0`; the roof, porch soffit and slab
  fascia follow the upper volume, the glazing must be re-listed with the same numbers.
- **Taller:** `S.y1` (roof underside) lifts the upper storey, the parapet and the lantern.
- **Bigger atrium:** `ATRIUM` moves the galleries, the stair landing, the glass rails and
  the four ceiling strips together.
- **A new opening:** add `{ a, b, y0, y1 }` to that wall's `holes` array *and* call `glaze()`
  with the same numbers, or the hole stays empty.
- **The camera path must be re-checked** whenever you move a wall it passes through: the
  door (z = G.z1), the rear slider's open bay (x 0…1.6) and the orbit radius all depend on
  it.

The city is its own block, section 5c: `N` towers over x ±340 m at z −205…−450 m, heights
8–26 m plus crowns, four landmarks to 56 m, then `setCity()` toggles both instanced meshes.
The shader mixes each fragment toward `uHaze` below ~8 m of height, which is what keeps the
bases from standing on the lawn; `cityMood()` re-tints it per sky preset.

## 5. Fold it into `real-estate-template/`

The template is being rewritten by another task, so **nothing here touches that folder**.
When you are ready, this is the whole integration:

1. **Copy the folder in** (keeping the name avoids path edits):

   ```bash
   cp -r shadestate-3d real-estate-template/walkthrough
   ```

   That brings `scene.js`, `style.css` → rename to `walkthrough.css`, `index.html`
   (as a reference), `fonts/`, `fonts.css`, `vendor/`.

2. **In `real-estate-template/index.html`**, add before `</head>`:

   ```html
   <link rel="stylesheet" href="walkthrough/walkthrough.css">
   <link rel="stylesheet" href="walkthrough/fonts.css">
   ```

3. **Paste the section** — copy the whole `<section class="walk" id="walk"> … </section>`
   block from `walkthrough/index.html` and place it after the template's hero.

4. **Add the canvas id** — the module looks up `#walk` and `#scene`; if the template
   already uses either id, rename it in the pasted markup *and* at the top of `scene.js`.

5. **Load the module** just before `</body>`:

   ```html
   <script type="module" src="walkthrough/scene.js"></script>
   ```

6. **Typography:** the walkthrough's overlay uses the same Cormorant Garamond /
   Plus Jakarta Sans pair and the same palette as the template (`#F7F4EF`, `#1C1A17`,
   `#9A7B56`, `#E6DFD3`), so no restyling is needed. If the template already loads those
   fonts from Google, delete `walkthrough/fonts.css` and skip step 2's second line.

7. **Beware:** the section is `600vh` tall on purpose (the scroll rail). If the template's
   scroll snapping or smooth-scroll library re-writes `transform` on `body` or a wrapper,
   the sticky canvas will break — disable it for this section.

The `?post=0` switch is handy here: keep it on a `<html data-post="0">` attribute if the
template ships other heavy WebGL above the fold.

---

## 6. Framer

The scene is portable: one call mounts it into any element and hands back a handle.

```js
const inst = await createWalkthrough(el, options)   // el: any sized element
inst.setProgress(0.47); inst.setOptions({ palms: false }); inst.destroy();
```

Nothing is read from the page — no ids, no global CSS, no asset paths. Every texture is
generated in the canvas, three.js is the only dependency, and `destroy()` removes the
canvas, its listeners, its observers, its render targets and every geometry, material and
texture it created. The live page keeps its own thin integration at the bottom of
`scene.js` (`autoMount`), which is skipped on any page without `#walk`.

There are two ways into Framer. **Use the code component** — it is the only one that gives
you the controls in the Framer panel.

### 6a. Code component (recommended)

`framer/ShadestateWalkthrough.tsx` — the scene inlined, three.js from npm.

1. In Framer: **Assets → Code → New File**, name it `ShadestateWalkthrough.tsx`.
2. Paste the whole file (it is self-contained; ~220 kB, and it is generated — see below).
3. **Insert → Code Component → ShadestateWalkthrough**, then drag it to fill the section.
4. Style it in the panel. All the look controls are on the right.

Controls, in plain words:

| Group | Control | What it does |
|---|---|---|
| Copy | **Show copy** | The scroll copy over the scene, on/off. |
| Copy | **Approach · headline / subtitle** | The line and note over the drive (default *Architecture with permanence.*). |
| Copy | **Entry · headline / subtitle** | The large line at the door (default *Honest materials.*). |
| Copy | **Interior · headline / subtitle** | The line in the hall (default *Room to breathe.*). |
| Copy | **Terrace · headline / subtitle** | The line held from the terrace through the orbit (default *Built to stay.*). |
| Camera | **Follow scroll** | The camera follows the page's scroll through the component. Off: it plays the take by itself. |
| Camera | **Autoplay** | Start the walk on its own (shown when Follow scroll is off). |
| Camera | **Open on** | Where it starts: Approach / Door / Inside / Terrace / Orbit. |
| Camera | **Speed** | How fast the camera moves, 0.2–3×. |
| Camera | **Loop** | Play the take back and forth instead of stopping at the end. |
| Look | **Light** | Morning / Noon / Golden hour / Dusk — sky, sun height, colour and the light on the house. |
| Look | **Clouds** | 0 clear … 1 overcast. |
| Look | **Grass** | Density of the meadow, 0.15–1. Lower is cheaper. |
| Look | **Water ripples** | Strength of the pool's surface movement, 0–2. |
| Look | **Corner palms** | The four date palms on the four sides of the house, on/off. |
| Look | **City skyline** | The distant skyline beyond the pool, on/off. |
| Performance | **Quality** | Auto (phones get the lite tier) / High / Lite. Changing this rebuilds the scene. |
| Performance | **Pause off-screen** | Stops rendering when the section leaves the viewport. Leave it on. |
| Performance | **Max pixel ratio** | Cap on the drawing buffer, 1–2. 1.5 is already crisp for this render. |
| Performance | **Height (px)** | 0 fills the frame; set a height for a fixed-height section inside a scrolling page. |

Defaults are the approved look: the Option C copy, morning light, 55% cloud, full grass,
ripples on, four palms, the city on, quality auto, pause off-screen on. Dropping the component in changes nothing until
you touch a control.

Because it imports `three` from npm (the local build is r160), Framer resolves whatever
version is current. If a future three ever breaks it, pin the import to
`https://esm.sh/three@0.160.1` — it is a single line at the top of the file.

### 6b. Embed route (a hosted bundle, no controls)

`dist/shadestate-walkthrough.min.js` is the same scene with three.js inlined — one file,
no imports, 1.2 MB (≈330 kB gzipped). Upload it next to the site (it is already on
`shadestate.vercel.app/walkthrough/`), then in Framer use **Insert → Embed**:

```html
<div data-shadestate-walkthrough
     data-scroll="1"      <!-- 0 = autoplay -->
     data-autoplay="0"
     data-stop="approach" <!-- approach|entry|interior|terrace|orbit -->
     data-tod="morning"   <!-- morning|noon|golden|dusk -->
     data-cover="0.55"    <!-- clouds 0..1 -->
     data-grass="1"       <!-- 0.15..1 -->
     data-water="1"       <!-- ripples 0..2 -->
     data-palms="1"
     data-city="1"        <!-- 0 = open country behind the pool -->
     data-quality="auto"  <!-- auto|high|lite -->
     style="width:100%;height:640px"></div>
<script src="https://shadestate.vercel.app/walkthrough/shadestate-walkthrough.min.js"></script>
<link rel="stylesheet" href="https://shadestate.vercel.app/walkthrough/shadestate-walkthrough.css">
```

The bundle mounts every `[data-shadestate-walkthrough]` element on the page. It carries no
panel controls — that is the trade for a two-line install.

### Rebuilding the packages

`scene.js` is the source. Both packages are generated from it:

```bash
python3 build/build.py      # writes dist/* and framer/ShadestateWalkthrough.tsx
```

Both may be verified on their own, outside the site:

```bash
python3 -m http.server 8080 -d dist
# http://localhost:8080/standalone-test.html   (embed route)
# http://localhost:8080/api-test.html          (createWalkthrough + destroy)
```

---

## 7. Performance

| | desktop | mobile |
|---|---|---|
| pixel ratio cap | 1.5 | 1.25 |
| shadow map | 2048² + four 1024² point cubes (baked once) | 1024² + four 512² |
| post chain | bloom + grade (5 passes at ¼ res) | none, CSS grade only |
| grass | 32k tuft cards ≈ 300k blades, 1 draw | 16k cards ≈ 150k blades, 1 draw |
| leaves / bracts / pebbles | 100% | ~50% |
| planar reflection | half-res, only when the pool is in frame | off |
| clouds | one canvas pass at boot, zero per frame | half-res canvas pass |
| draw calls | ~140 (materials × shadow/receive variants, static) | ~127 |
| shadow maps | 1536² sun + four 512² point cubes (each baked once) | 1024² + four 512² |

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

- **The water's mirror is planar and half-res.** It reflects what is above the surface,
  not the tiles below it, and it is skipped on mobile and beyond ~52 m.
- **No SSAO/GTAO.** Contact darkening comes from the sun shadow map, the baked point-light
  cubes and the shader's base darkening. Corners at oblique angles can look a touch light.
- **The interior furniture is still modelled from primitives**, but every edge is
  bevelled (`roundedBoxGeo()`), the sofa is bouclé on a woven rug with a fluted walnut
  table, thrown vessels, a brass linear pendant and a framed work under a 2700 K spot; it
  holds up when you stop and look, though a real chair would not be out of place.
- **Dust motes and the camera path are the only per-frame animation** — everything else is
  static, which is why the shadow maps can be frozen.
- **Pinned scroll** assumes the document scrolls. Scroll-hijacking libraries that transform
  a wrapper will break the sticky canvas (see integration step 7).
