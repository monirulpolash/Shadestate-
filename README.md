# Shadestate — Architectural Residences

A warm, editorial real-estate template for a Portuguese development studio.
Built as a single static page, plus a set of Framer code components that
reproduce the same experience inside Framer.

**Palette** Alabaster `#F7F4EF` · Ivory deep `#F1ECE3` · Sand `#E6DFD3` ·
Bronze `#9A7B56` · Espresso `#1C1A17`
**Type** Cormorant Garamond 300 (display) · Plus Jakarta Sans 400/500 (text)

---

## 1. What is in the box

```
real-estate-template/
├── index.html                    the page
├── styles.css                    design system + layout + motion states
├── script.js                     interactions, Lenis + GSAP choreography
├── project.html                  one residence, driven by ?project=<slug>
├── project.css                   its own type system and layout
├── project.js                    project data + rendering + interactions
├── FramerDevelopmentsSection.tsx single-file Framer variant (kept for older projects)
├── framer/                       modular Framer code components (new)
│   ├── ShadestateHero.tsx        the original photographic hero
│   ├── ShadestateSkyHero.tsx     the earlier layer-drift hero (superseded by
│   │                             the scroll take in index.html)
│   ├── ShadestateDevelopments.tsx
│   ├── ShadestateResidences.tsx
│   ├── ShadestateInquiry.tsx
│   └── ShadestateWalkthrough.tsx  the 3D walkthrough as a Framer code component
├── walkthrough/                  the 3D walkthrough (see §5)
│   ├── scene.js                  the whole scene: textures, house, camera, post
│   ├── walkthrough.css           its styling, scoped to #walk
│   ├── vendor/three.module.js    three.js r160, vendored — no CDN needed
│   └── README.md                 camera map, how to re-proportion the house
├── assets/                       7 architectural images + local GSAP/Lenis fallbacks
│   ├── img/                      the project page's photography, plans, masterplan
│   └── hero-find/                the hero layers: back.jpg (sky, 1920w),
│                                 house.webp (cut-out building, 1920w RGBA),
│                                 cloud.webp (drifting cloud, 1600w RGBA),
│                                 smoke.webp (mist, 1920w RGBA),
│                                 wordmark.svg (SHADESTATE + DEVELOPMENTS,
│                                 filled — used as the composite's mask)
├── preview-desktop.png           hero at 1440 × 900
├── preview-mobile.png            hero at 390 × 844
└── previews/                     section and state captures (incl. the walkthrough)
```

Every path is relative: the folder works unzipped anywhere, over `file://`,
or behind any static host.

---

## 2. Page order (design direction §6)

1. **Hero** — one scroll take over five viewports. A painted dawn sky, a
   centred display headline, one pill CTA, an architectural cut-out rising out
   of the lower half, two clouds drifting apart, and a band of mist that climbs
   from the floor. The wordmark draws itself as a hairline and is then filled by
   the building, clipped to its letterforms. Sticky stage, `500vh` desktop
   (`350vh` mobile).
2. **Press strip** — slow marquee of publication names.
3. **Philosophy + figures** — sticky portrait beside the studio statement,
   four counters.
4. **Featured project** — Hale Arden pattern: the image starts inset and small
   and grows to full-bleed as it enters the viewport (transform + clip-path
   only), with a three-part approach note beneath.
5. **Developments** — asymmetric offset grid, live filters (All / Available /
   Upcoming / Completed); every card opens `project.html?project=<slug>`, a
   full residence page (specification, gallery, floor plans, map, FAQ). The
   featured project links to its page the same way.
6. **3D walkthrough** — a pinned 600vh scroll take of Casa da Luz: approach,
   door, hall, terrace, orbit. Fully procedural WebGL (see §5).
7. **Residences & plans** — interactive typology explorer: development tabs,
   residence pills, schematic plan drawn in SVG, specification sheet,
   comparison bars, "request this residence" that prefills the inquiry.
8. **Craft & materials** — sticky material photograph, parallax, palette.
9. **Private inquiry** — dark section, validated concierge form, confirmation
   summary.
10. **Footer** — wordmark reveal, studio details, fine print.

---

## 3. Run it

```bash
# any static server works
python3 -m http.server 8000
# open http://localhost:8000
```

GSAP, ScrollTrigger and Lenis load from jsDelivr. If the CDN is unreachable
(or blocked), `script.js` falls back to the local copies in `assets/vendor/`
automatically. Nothing else is fetched at runtime.

**No JavaScript** → the page renders fully as a static layout (header becomes
static, navigation visible, all copy and images in place). **Reduced motion**
→ no curtain, no Lenis, no scroll animation, no transforms: the finished page.

---

## 4. How the motion is built

| Moment | Technique |
|---|---|
| Arch-mask intro | Three dark panels (left, right, crown with a semicircular bottom) driven by `--arch-w` / `--arch-h`; the arch rises and widens to reveal the hero. Wordmark lines rise, a counter runs 00→100. |
| Hero | CSS-sticky stage inside a 500vh section (350vh on mobile). One GSAP timeline, `scrub: 0.1`, `start: top top`, `end: bottom top`, default ease `power1.out`: building `y -40% scale 1.3` and mist `y 70% → 0` over 0→1; clouds `x ±15%`; copy `y 20% scale .9` and out by 0.2; wordmark in at 0.10 with `strokeDashoffset` drawn over 0.10→0.40 and out 0.28→0.48; the building-in-the-wordmark composite in at 0.30 as the plain building fades. The arrival (sky 1.1→1, clouds settling, building fading up) only animates the images, never the layers. |
| Type reveals | `script.js` splits display type into measured lines wrapped in overflow masks; `expo.out` yPercent 112 → 0, 85ms stagger. Re-splits after fonts load and on resize. |
| Image reveals | `clip-path: inset(0 0 100% 0)` → `inset(0)` plus scale 1.1 → 1, once per element. |
| Featured project | Container `scale .72 → 1` and `clip-path inset(0 9%) → 0` while the inner image counter-scales `1.35 → 1`: inset to full-bleed, transform-only. |
| Developments filter | Fade + stagger out, `display:none` swap, `ScrollTrigger.refresh()`, fade + stagger in. |
| Cursor | Desktop-only pill ("View residence", "Explore", "Request") that magnetises to cards and CTAs; `quickTo` on x/y. |
| Buttons | Magnetic offset on hover (`quickTo`, 0.22 strength), elastic return. |

Eases follow the direction: `cubic-bezier(.23,1,.32,1)` (`expo.out`), durations
.35 / .45 / .7 / 1.2 / 2.4s. Everything is transform or opacity; nothing in
the scroll path triggers layout.

---

## 5. The 3D walkthrough

Page position 6 is a scroll-driven walk through Casa da Luz — the whole house is
generated in code (no model, no photo, no HDRI), and three.js r160 is vendored in
`walkthrough/vendor/`, so the section fetches nothing at runtime.

```html
<meta … >
<link rel="stylesheet" href="walkthrough/walkthrough.css">   <!-- after styles.css -->
…
<section class="walkthrough" id="walkthrough" data-nav="light">
  <div class="shell"> … section heading … </div>
  <section class="walk" id="walk">          <!-- 600vh tall: the scroll rail -->
    <div class="walk__sticky">             <!-- 100vh, position: sticky -->
      <canvas id="scene" class="walk__canvas"></canvas>
      … HUD, editorial overlays, CSS poster fallback …
    </div>
  </section>
</section>
…
<script type="module" src="walkthrough/scene.js"></script>  <!-- before </body> -->
```

How it is wired:

- **Scroll** — `scene.js` finds `#walk` and `#scene`, reads the section's own
  progress from the document scroll (`-rect.top / (height - innerHeight)`) and
eases it frame-rate-independently. Nothing is pinned by a JS transform, so any
window-based smooth scroller (Lenis, included) drives it correctly.
- **Ancestors must not become scroll containers.** `.walkthrough` uses
  `overflow: clip`, not `hidden` — a `hidden` ancestor would un-stick the canvas.
  The same goes for any wrapper you add around the section.
- **CSS is scoped to `#walk`** (every selector, plus its own `--alabaster`,
  `--serif`, `--pad`-style tokens), so nothing collides with `styles.css`: the
template's `.btn`, `.eyebrow`, `:root` tokens and `h2` rules are untouched, and
`.copy__item`, `.hud*`, `.fallback*` cannot leak onto other sections.
- **Fonts** — the section uses the Cormorant Garamond / Plus Jakarta Sans pair the
  page already loads from Google Fonts, so no extra webfont request is made.
- **Fallback** — without WebGL, or if the module fails, the section adds
  `.no-webgl` to itself and collapses to a pure-CSS illustration with the same
typography; the page keeps scrolling normally.
- **Cost** — ~25–105 draw calls, shadow maps baked once and frozen, the render
  loop stops off-screen (`IntersectionObserver`), and it is skipped entirely on
  `prefers-reduced-motion` (eight authored stills instead). Add `?post=0` to the
  URL to switch the bloom/grade chain off while profiling.

Changing the shot or the house is documented in `walkthrough/README.md` — the
camera keys are one array (`CAMERA_KEYS`), and the building is two boxes (`A`, `B`).

---

## 6. Framer: copy-paste steps

The four components in `framer/` are self-contained Framer code files
(React + TypeScript + `framer-motion` + `addPropertyControls`). No external
CSS, no imports from this folder, no assets.

### 6.1 Add the fonts (once)

1. In Framer, open **Site Settings → Fonts**.
2. Add **Cormorant Garamond** (300, 400, italic 300) and
   **Plus Jakarta Sans** (300, 400, 500).
3. Keep the family names exactly as above — the components default to them.

### 6.2 Add the components

For each file:

1. In the Framer canvas, open the **Assets** panel → **Code** → **New Code File**.
2. Name it exactly `ShadestateHero` (or `ShadestateSkyHero` for the layered
   version), `ShadestateDevelopments`,
   `ShadestateResidences`, `ShadestateInquiry`.
3. Delete the placeholder content and paste the whole `.tsx` file.
4. Wait for the green check in the code editor (no imports to install —
   `react`, `framer-motion` and `framer` are provided).
5. Close the editor. The component appears under **Assets → Code**; drag it
   onto the canvas.

### 6.3 Set the layout

For every component:

- Width: **Fill** (or a fixed desktop width; they are responsive).
- Height: **Auto** (the components measure themselves).
- Background: leave transparent — each component paints its own section.

### 6.4 Wire the content

Each component exposes its copy, colours, fonts and images as properties:

| Component | Property groups |
|---|---|
| `ShadestateHero` | Eyebrow, headline + italic line, subline, two CTAs, hero image + focus %, statistics array, coordinates, survey frame toggle, colours, fonts, `onPrimary` / `onSecondary` events. |
| `ShadestateSkyHero` | The earlier layer-drift hero: sky / building / mist images (PNG with alpha), headline, subline + quiet subline, CTA label, building top / width / left, mist height, colours, fonts, `onPrimary` event. It predates the five-viewport scroll take now in `index.html`, which needs ScrollTrigger and so is not ported here. |
| `ShadestateDevelopments` | Heading trio, note, developments array (image, status, price, bedrooms, size, architect, description, **types**, amenities), filters toggle, columns, colours, fonts, `onInquire` event. |
| `ShadestateResidences` | Heading trio, note, developments array (each with residences: beds, interior, terrace, plot, orientation, compass°, price, meta, plan preset), colours, fonts, `onInquire` event. |
| `ShadestateInquiry` | Heading trio, intro, studio address/email/phone/hours, destinations array (name + residences), colours, fonts, `onSubmitted` event. |

Replace the default images with your own in the properties panel — the
components never reference `assets/`.

### 6.5 Page assembly

1. Create a page, add a **Stack** with vertical layout and 0 gap.
2. Drop in: `ShadestateHero` → a Marque/ticker for press → your philosophy
   block → `ShadestateDevelopments` → `ShadestateResidences` →
   `ShadestateInquiry`.
3. Navigation: add anchors on the section frames (`#philosophy`,
   `#developments`, `#residences`, `#inquire`) and point the hero CTAs at them
   by wiring `onPrimary` to a **Scroll to** action.
4. The developments `onInquire` event can Scroll-to the inquiry section; the
   residences `onInquire` can do the same.
5. Set the page background to `#F7F4EF` and the text colour to `#1C1A17`.

### 6.6 Reduced motion in Framer

All four components respect `useReducedMotion()`: entrance animations and
plan draw-ins are skipped, and the layouts render in their final state.

### 6.7 Alternative to code: native Framer

If you would rather build natively, the mapping is:
- Hero → stack with image + text, Appear effects (y 20 → 0, 0.9s, ease
  `[0.23, 1, 0.32, 1]`) and a scroll transform on the image (scale 1 → 1.12).
- Developments → CMS collection (6 items) + Collection List, 2 columns, offset
  every second card with a top margin, filter with a variant or a small code
  override.
- Residences → CMS with a Plans collection (area, terrace, plot, beds,
  orientation, price) and a tab component.
- Inquiry → Framer Form with the same fields; hook the form's success state to
  the confirmation panel.

---

## 7. Verified

Measured in headless Chromium, served from `localhost`:

- **Console errors** 0 · **page errors** 0 · **failed requests** 0
  (1440 × 900, 1024 × 768, 390 × 844).
- **Broken images** 0 of 12 · **unresolved anchors** 0.
- **Horizontal overflow** none at any width (`scrollWidth === innerWidth` at
  1440 / 1024 / 390, at every section).
- **Filters** Available → "Showing 2 of 6", 2 cards visible.
- **Modal** opens, fills 6 specs and the residence types, closes on Escape.
- **Explorer** tab + type switch updates the plan, the specification and the
  metrics; prefill sets development, residence and note, and focuses the form.
- **Form** blocks with 2 errors on empty submit, then confirms with a summary
  (development, residence, date).
- **Featured project** measured mid-scroll: scale 0.81 → 0.94 → 1.00 and width
  1170 → 1355 → 1440 px, inner image 1.29 → 1.0.
- **No-JS** renders the full page (static header, visible nav, hero and all
  sections).
- **Reduced motion** renders with no curtain, no split masks, no transforms.

Verified again with the walkthrough in place (headless Chromium, WebGL via
SwiftShader, 1440 × 900 and 390 × 844):

- **Console** 0 errors, 0 warnings · **page errors** 0 · **failed requests** 0 ·
  **HTTP ≥ 400** 0 — the only requests are the page, `styles.css`,
  `walkthrough/walkthrough.css`, `walkthrough/scene.js`,
  `walkthrough/vendor/three.module.js`, `script.js`, the images and the CDN
  GSAP/Lenis builds.
- **Horizontal overflow** none at any of 11 scroll positions across the page at
  both sizes (`scrollWidth === clientWidth` at every one).
- **The sticky canvas holds**: `.walk__sticky` sits at `top: 0` from 0 % to 99 %
  of the section's 5400 px rail at 1440 × 900 (4389 px at 390 wide), the canvas
  fills the viewport at every step, and the HUD stage/progress advance 01 → 05.
- **Nothing else breaks**: leaving the section returns the page to normal scroll,
  the next section lands at the top, the closing "Enquire" panel inside the
  walkthrough links to `#inquire` and lands on the form, and the Lenis/GSAP
  behaviour of the rest of the page is unchanged.

Verified again after the hero rewrite and the project pages (headless
Chromium, 1440 × 900 and 390 × 844):

- **Console** 0 errors · **page errors** 0 · **failed requests** 0 ·
  **HTTP ≥ 400** 0 · **broken images** 0 of 16 on `index.html` and 0 of 16 on a
  project page, after scrolling each from top to bottom.
- **Horizontal overflow** none (the hero's clouds, smoke and mist are clipped
  by `.hero__bg`; `scrollWidth === innerWidth` at both sizes, at every
  checkpoint).
- **Hero measured against the reference tween**: at 18 % of the section the
  building is at `scale 1.098 / y −167.9` and the copy is at `opacity 0.01`;
  at 35 % the wordmark is at `opacity 0.42`, the composite at `0.75` and the
  plain building at `0.25`; at 78 % the mist has risen to `y 3 %`.
- **Cards** `a.dev-card__open` on all six residences → `project.html?project=`
  opens the right page (`Casa da Luz`, `Alto Príncipe`, …) with the right
  title, price and specification; the featured project links to
  `project.html?project=quinta-do-vale`.
- **No-JS** renders the hero as one static viewport (no giant empty scroll).
- **Reduced motion** renders the hero at 100svh with no transforms.

Screenshots: `preview-desktop.png`, `preview-hero-scroll-1.png` (18 % — copy
behind the rising building, wordmark drawing), `preview-hero-scroll-2.png`
(35 % — the building filling the wordmark), `preview-mobile.png`, and `previews/`
(`walkthrough-3d-desktop.png`, `walkthrough-3d-mobile.png`, plus every UI state).
A single full-page capture no longer represents the page: the walkthrough only
exists in the viewport, so it is captured at its own section instead.

---

## 8. Notes and credits

- Copy, names and figures are fictional and were written for this template.
  Nothing is transmitted or stored: the inquiry and enquiry forms are validated
  in the browser and show a local confirmation only.
- Motion patterns are original implementations. Structural references studied
  for this build: FIND Real Estate (hero choreography), Hale Arden (project
  image scale-on-scroll), Era Residence (arch-mask intro timing).
- **The four hero layer images** (`assets/hero-find/back.jpg`, `house.webp`,
  `cloud.webp`, `smoke.webp`) are the reference treatment's own artwork, kept
  so the choreography can be judged exactly; the wordmark itself is ours
  (Plus Jakarta Sans outlines, generated into `wordmark.svg`). Replace those
  four with licensed photography before any commercial use.
- The project page (`project.html`) keeps its own type system (Inter) and its
  own inventory — including three Dubai projects — so it reads as the detail
  template it is; align it with the site's Cormorant/Plus Jakarta pair if the
  two are to share one voice.
- Fonts are Google Fonts under the SIL Open Font License.
- GSAP and Lenis keep their own licences; local copies in `assets/vendor/` are
  the same public builds as the CDN links.

### Editing tips

- Colours and spacing: `:root` in `styles.css` (`--alabaster`, `--espresso`,
  `--sand`, `--bronze`, `--ink-60`, `--ink-10`, `--section-y`).
- Developments and residences: one data object at the top of `script.js`
  (`DEVELOPMENTS`) feeds the cards, the modal, the explorer and the form.
- The preloader runs once per session; delete the `sessionStorage` guard in
  `intro()` if you want it on every load.
