# Shadestate — Dubai & Saudi Arabia

A complete static site for a fictional Gulf developer: nine residences across Dubai and
Saudi Arabia, a three-step enquiry, a 3D relief map, a scroll-driven villa walkthrough and
an editorial journal. No framework, no build step, no runtime dependencies beyond GSAP,
ScrollTrigger and Lenis (with local fallbacks) and the vendored Three.js.

**Palette** White `#FFFFFF` · Bone `#F7F4EF` · Ink `#111111` · Gold `#C9A55A`
**Type** Cormorant Garamond 300 (display) · Plus Jakarta Sans 300–700 (body & UI)

---

## Pages

| File | What it is |
|---|---|
| `index.html` | Home — FIND hero take, studio thesis, four featured developments, four disciplines, 3D presence map, 3D villa walkthrough with an end-of-orbit viewing CTA, private-viewing band |
| `projects.html` | The catalogue — nine developments, filters by status and country, numbered hairline rows with a cursor-following preview |
| `about.html` | Studio & legacy — story, how we build, project timeline, Hale Arden-style leadership list with a sticky portrait, awards |
| `project.html?project=<slug>` | One residence — status-aware payment plan, AED/SAR/USD toggle, five-action bar, landmarks, gallery, availability-aware floor plans with click-to-zoom, neighbourhood map, masterplan, FAQ, three next residences, the same 3D walkthrough |
| `contact.html` | Three-step guided enquiry `(01/03 → 03/03)` with live Dubai and Riyadh clocks, direct WhatsApp/call/email channels and a confirmation naming the advisor |
| `blog.html` | Journal — six essays, category filters, an inline reader at `?article=<slug>` |
| `privacy.html`, `terms.html` | Legal pages with a sticky section index and 1px hairline prose |
| `404.html` | Oversized 404 and a way home |

All nine project slugs: `arbour-townhomes`, `diriyah-courtyard-villas`, `sun-bliss-residence`,
`red-sea-horizon`, `skyline-towers`, `palm-crest-villas`, `luxurious-villas`,
`wadi-alula-residences`, `al-nakheel-house`.

## Design system

`site.css` is the single source of tokens: colour, the display/body scale, tracking, line
heights, `--section-y`, the 1280 px container, the 1 px hairline and the easing registry.
`styles.css` holds the home-page sections, `pages.css` the inner-page layouts and
`project.css` the project page (its tokens are aligned by the `project-page` rules in
`site.css`). Every page loads the same two Google Fonts families and the same shared shell:
topbar with a `elementsFromPoint` colour probe, clip-path menu, page transition, char-roll
links, magnetic buttons, dark skyline footer with a letter-by-letter wordmark.

## Data

One source of truth: `assets/js/projects-data.js` (`window.SHADE_PROJECTS`) feeds the home
page, the catalogue, the project page, the enquiry pre-fill and the 3D map pins.
`assets/js/journal-data.js` holds the journal essays. `map/land.json` is a simplified
Natural Earth outline of the Arabian Peninsula used by `map/presence.js`.

## The 3D pieces

- `walkthrough/scene.js` — the procedural Three.js villa, shared by `index.html` and
  `project.html`; untouched by this build and ready to be replaced by the upgraded scene.
- `map/presence.js` — extruded land, glowing pins, drag-to-orbit, wheel zoom, HTML
  annotations and a project card. Falls back cleanly when WebGL is unavailable.

## Run it

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Every path is relative, so the folder also works unzipped over `file://`. Lenis, GSAP and
ScrollTrigger fall back to `assets/vendor/` if the CDN is unreachable. With JavaScript off
the pages still render: header links, copy, images and all nine enquiry steps are readable.
`prefers-reduced-motion` disables the transition, the scroll takes and the orbit.

## Preview captures

`preview-home-desktop.png`, `preview-map-desktop.png`, `preview-projects.png`,
`preview-about.png`, `preview-mobile.png` — 1440×900 and 390×844.
