#!/usr/bin/env python3
"""Build the two portable deliverables from walkthrough/scene.js.

    dist/shadestate-walkthrough.js      one self-contained file: three.js + scene
    dist/shadestate-walkthrough.min.js  the same, comments stripped (Embed route)
    dist/shadestate-walkthrough.css     the three rules the embed needs
    framer/ShadestateWalkthrough.tsx    the Framer code component, scene inlined,
                                        property controls wired to the scene

No bundler, no network: three.js is a single ES module with one export list at
the end, so the bundle replaces that list with a namespace object and drops the
export keyword from the scene. Run from the repository root:

    python3 build/build.py
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCENE = os.path.join(ROOT, "walkthrough", "scene.js")
if not os.path.exists(SCENE):
    SCENE = os.path.join(ROOT, "scene.js")
THREE = os.path.join(os.path.dirname(SCENE), "vendor", "three.module.js")
OUT = os.path.join(ROOT, "dist")
FRAMER = os.path.join(ROOT, "framer")


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"  {os.path.relpath(p, ROOT):52s} {len(s) / 1024:8.1f} kB")


def strip_auto_mount(src):
    """The scene mounts itself on a page that already has #walk; a bundle that a
    host mounts by hand must not."""
    i = src.find("(function autoMount() {")
    if i < 0:
        return src
    start = src.rfind("/*", 0, i)
    start = src.rfind("\n", 0, start) if start > 0 else i
    end = src.find("})();", i) + len("})();\n")
    return src[:start] + src[end:]


def scene_body(src):
    s = strip_auto_mount(src)
    s = s.replace("export async function createWalkthrough", "async function createWalkthrough")
    s = s.replace("export function", "function")
    # import.meta is a parse error in a classic script
    s = s.replace("import.meta.url", "(document.currentScript && document.currentScript.src) || location.href")
    # the bundle brings its own three
    s = s.replace("let THREE = null;   /* the namespace, loaded once and shared by every instance */",
                  "let THREE = __THREE__;   /* the namespace, provided by the bundle */")
    return s


def three_bundle():
    src = read(THREE)
    m = re.search(r"\nexport \{([^}]*)\};?\s*$", src)
    if not m:
        sys.exit("could not find three's export list")
    names = [n.strip() for n in m.group(1).split(",") if n.strip()]
    body = src[: m.start()]
    # three lives in its own scope: a concatenated bundle shares one top-level
    # scope, and a collision on any internal name would break the whole file
    ns = "const __THREE__ = (function () {\n" + body + "\nreturn {" + ", ".join(names) + "};\n})();\n"
    return ns


def minify(js):
    # conservative: full-line // comments and /* */ blocks only. Nothing that can
    # sit inside a string is touched.
    js = re.sub(r"/\*[\s\S]*?\*/", "", js)
    out = []
    for line in js.split("\n"):
        s = line.strip()
        if not s or s.startswith("//"):
            continue
        out.append(s)
    return "\n".join(out)


def main():
    src = read(SCENE)
    body = scene_body(src)

    print("building")
    prelude = ("/* Shadestate walkthrough — one portable file.\n"
               "   three.js r160 (MIT) and the scene, no imports, no assets.\n"
               "   window.ShadestateWalkthrough.createWalkthrough(el, options)\n"
               "   Auto-mounts any element with data-shadestate-walkthrough. */\n")
    tail = """
window.ShadestateWalkthrough = {
  createWalkthrough, STOPS, DEFAULTS: { ...DEFAULTS }, BUILD
};

/* Embed route: drop <div data-shadestate-walkthrough></div> in the page and the
   bundle mounts it, reading the look from data- attributes on the div. */
(function mountEmbeds() {
  function mountAll() {
    const els = document.querySelectorAll('[data-shadestate-walkthrough]');
    for (const el of els) {
      if (el.__shadestate) continue;
      const d = el.dataset;
      el.__shadestate = createWalkthrough(el, {
        scrollDriven: d.scroll !== '0',
        autoplay: d.autoplay === '1',
        loop: d.loop !== '0',
        startStop: d.stop || 'approach',
        speed: d.speed ? parseFloat(d.speed) : 1,
        timeOfDay: d.tod || 'morning',
        cloudCover: d.cover != null ? parseFloat(d.cover) : undefined,
        grassDensity: d.grass != null ? parseFloat(d.grass) : undefined,
        waterRipples: d.water != null ? parseFloat(d.water) : undefined,
        palms: d.palms !== '0',
        quality: d.quality || 'auto',
        pausedOffscreen: d.pause !== '0'
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll);
  else mountAll();
  window.addEventListener('load', mountAll);
})();
"""
    js = (prelude + "(function () {\n'use strict';\n" + three_bundle() + "\n" + body + "\n" + tail + "})();\n")
    write(os.path.join(OUT, "shadestate-walkthrough.js"), js)
    write(os.path.join(OUT, "shadestate-walkthrough.min.js"), minify(js))

    css = """/* the only stylesheet the walkthrough needs */
.shadestate-walkthrough, [data-shadestate-walkthrough] {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #0e0c09;
}
.shadestate-walkthrough > canvas, [data-shadestate-walkthrough] > canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.shadestate-walkthrough.is-loading, [data-shadestate-walkthrough]:not(:has(canvas.is-ready)) {
  background: #0e0c09;
}
"""
    write(os.path.join(OUT, "shadestate-walkthrough.css"), css)

    # ── the Framer code component ────────────────────────────────────────
    tsx = read(os.path.join(ROOT, "build", "framer-wrapper.tsx"))
    comp = tsx.replace("/*__SCENE__*/", body)
    write(os.path.join(FRAMER, "ShadestateWalkthrough.tsx"), comp)


if __name__ == "__main__":
    main()
