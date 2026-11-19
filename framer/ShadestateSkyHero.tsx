/**
 * Shadestate · Sky Hero
 * ---------------------------------------------------------------------------
 * Framer Code Component · React + TypeScript + framer-motion
 *
 * The layered hero: a painted sky, an architectural cutout rising out of the
 * lower half, and a band of mist drifting across its base, with the headline
 * centred in the clear air above the building.
 *
 * How to use it in Framer
 *   1. Assets → Code → New Code File → name it "ShadestateSkyHero" → paste this file.
 *   2. Drag "ShadestateSkyHero" onto the canvas and set its width to Fill.
 *   3. Properties panel: drop in the three layers (sky, building, mist) and
 *      edit the copy. The layers must keep their transparent edges: the
 *      building and the mist are cut-outs, not photographs.
 *
 * Design notes
 *   • Composition follows the FIND Real Estate hero: sky, centred dark display
 *     headline, one pill CTA, building rising from the lower half, mist over
 *     the bottom edge.
 *   • Scroll moves the three layers at different speeds (sky down, building up,
 *     mist up) and lifts the copy away, transform/opacity only.
 *   • Reduced motion: entrance and scroll transforms are skipped.
 *   • Fonts: add Plus Jakarta Sans under Site Settings → Fonts and pass its
 *     name in the Display font property.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

type ImageValue = string | { src?: string; srcSet?: string } | null | undefined

function imageUrl(image: ImageValue): string | undefined {
    if (!image) return undefined
    if (typeof image === "string") return image
    return image.src
}

interface Props {
    headline: string
    subline: string
    sublineMuted: string
    primaryLabel: string
    skyImage?: ImageValue
    buildingImage?: ImageValue
    mistImage?: ImageValue
    buildingAlt: string
    buildingTop: number
    buildingWidth: number
    buildingOffsetX: number
    mistHeight: number
    background: string
    fadeColor: string
    ink: string
    muted: string
    displayFont: string
    textFont: string
    onPrimary?: () => void
    style?: CSSProperties
}

/** A line that rises out of a mask. */
function MaskedLine({
    children,
    delay = 0,
    reduced,
    style,
}: {
    children: ReactNode
    delay?: number
    reduced: boolean
    style?: CSSProperties
}) {
    return (
        <span
            style={{
                display: "block",
                overflow: "hidden",
                paddingBottom: "0.06em",
                marginBottom: "-0.06em",
            }}
        >
            <motion.span
                initial={reduced ? false : { yPercent: 110 }}
                animate={reduced ? undefined : { yPercent: 0 }}
                transition={{ duration: 1.15, delay, ease: [0.23, 1, 0.32, 1] }}
                style={{ display: "block", willChange: "transform", ...style }}
            >
                {children}
            </motion.span>
        </span>
    )
}

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight fixed
 */
export default function ShadestateSkyHero(props: Props) {
    const {
        headline,
        subline,
        sublineMuted,
        primaryLabel,
        skyImage,
        buildingImage,
        mistImage,
        buildingAlt,
        buildingTop,
        buildingWidth,
        buildingOffsetX,
        mistHeight,
        background,
        fadeColor,
        ink,
        muted,
        displayFont,
        textFont,
        onPrimary,
        style,
    } = props

    const reduced = useReducedMotion() ?? false
    const ref = useRef<HTMLDivElement>(null)
    const [mounted, setMounted] = useState(false)

    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end start"],
    })

    const skyY = useTransform(scrollYProgress, [0, 1], ["0%", "4%"])
    const skyScale = useTransform(scrollYProgress, [0, 1], [1.02, 1.1])
    const buildingY = useTransform(scrollYProgress, [0, 1], ["0%", "-6%"])
    const buildingScale = useTransform(scrollYProgress, [0, 1], [1, 1.03])
    const mistY = useTransform(scrollYProgress, [0, 1], ["0%", "-22%"])
    const copyY = useTransform(scrollYProgress, [0, 1], [0, -90])
    const copyOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0])

    useEffect(() => {
        setMounted(true)
    }, [])

    const sky = imageUrl(skyImage)
    const building = imageUrl(buildingImage)
    const mist = imageUrl(mistImage)

    const display = `${displayFont}, "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`
    const text = `${textFont}, "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`

    return (
        <section
            ref={ref}
            style={{
                ...style,
                position: "relative",
                width: "100%",
                height: "100svh",
                minHeight: 560,
                overflow: "hidden",
                isolation: "isolate",
                background,
                boxSizing: "border-box",
                fontFamily: text,
            }}
        >
            {/* 1 · sky */}
            <motion.div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: "-3% 0",
                    zIndex: 0,
                    y: reduced ? 0 : skyY,
                    scale: reduced ? 1.02 : skyScale,
                    willChange: "transform",
                }}
            >
                {sky ? (
                    <img
                        src={sky}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 42%" }}
                    />
                ) : (
                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            background: "linear-gradient(180deg, #9ec0dd 0%, #cfdcea 58%, #f1d6c0 100%)",
                        }}
                    />
                )}
            </motion.div>

            {/* 2 · the building, rising out of the lower half */}
            <motion.div
                style={{
                    position: "absolute",
                    top: `${buildingTop}%`,
                    left: `${buildingOffsetX}%`,
                    width: `${buildingWidth}%`,
                    zIndex: 1,
                    transformOrigin: "50% 100%",
                    y: reduced ? 0 : buildingY,
                    scale: reduced ? 1 : buildingScale,
                    willChange: "transform",
                    pointerEvents: "none",
                }}
            >
                {building ? (
                    <motion.img
                        src={building}
                        alt={buildingAlt}
                        initial={reduced ? false : { scale: 1.05, y: "3%" }}
                        animate={reduced ? undefined : { scale: 1, y: "0%" }}
                        transition={{ duration: 1.9, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}
                        style={{ width: "100%", height: "auto", display: "block", willChange: "transform" }}
                    />
                ) : null}
            </motion.div>

            {/* 3 · mist across the lower edge */}
            <motion.div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: `-${Math.round(mistHeight * 0.7)}%`,
                    height: `${mistHeight}%`,
                    zIndex: 2,
                    y: reduced ? 0 : mistY,
                    willChange: "transform",
                    pointerEvents: "none",
                }}
            >
                {mist ? (
                    <img
                        src={mist}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
                    />
                ) : null}
            </motion.div>

            {/* the hero dissolves into the page */}
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: -1,
                    height: "26%",
                    zIndex: 3,
                    pointerEvents: "none",
                    background: `linear-gradient(180deg, rgba(255,255,255,0) 0%, ${fadeColor} 100%)`,
                }}
            />

            {/* copy */}
            <motion.div
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 4,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: "clamp(70px, 10vh, 140px) clamp(20px, 5vw, 72px) clamp(90px, 18vh, 190px)",
                    y: reduced ? 0 : copyY,
                    opacity: reduced ? 1 : copyOpacity,
                }}
            >
                <h1
                    style={{
                        margin: 0,
                        maxWidth: "min(92vw, 1200px)",
                        fontFamily: display,
                        fontWeight: 700,
                        fontSize: "clamp(42px, 7.15vw, 142px)",
                        lineHeight: 0.98,
                        letterSpacing: "-0.035em",
                        color: ink,
                        textWrap: "balance",
                    }}
                >
                    <MaskedLine delay={0.2} reduced={reduced || !mounted}>
                        {headline}
                    </MaskedLine>
                </h1>

                {subline || sublineMuted ? (
                    <motion.p
                        initial={reduced ? false : { opacity: 0, y: 18 }}
                        animate={reduced ? undefined : { opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.6, ease: [0.23, 1, 0.32, 1] }}
                        style={{
                            margin: "clamp(14px, 2.2vh, 26px) 0 0",
                            maxWidth: "min(92vw, 940px)",
                            fontFamily: text,
                            fontWeight: 500,
                            fontSize: "clamp(15px, 1.52vw, 26px)",
                            lineHeight: 1.42,
                            letterSpacing: "-0.006em",
                            color: ink,
                            textWrap: "balance",
                        }}
                    >
                        {subline}{" "}
                        <span style={{ color: muted }}>{sublineMuted}</span>
                    </motion.p>
                ) : null}

                {primaryLabel ? (
                    <motion.button
                        type="button"
                        onClick={onPrimary}
                        initial={reduced ? false : { opacity: 0, y: 18 }}
                        animate={reduced ? undefined : { opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.75, ease: [0.23, 1, 0.32, 1] }}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 14,
                            marginTop: "clamp(22px, 3.4vh, 38px)",
                            padding: "17px 26px 17px 30px",
                            borderRadius: 999,
                            border: "none",
                            background: ink,
                            color: fadeColor,
                            fontFamily: text,
                            fontSize: 12,
                            fontWeight: 500,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            cursor: "pointer",
                            boxShadow: "0 10px 30px -14px rgba(20,18,15,.55)",
                        }}
                    >
                        {primaryLabel}
                        <span aria-hidden="true">→</span>
                    </motion.button>
                ) : null}
            </motion.div>
        </section>
    )
}

ShadestateSkyHero.defaultProps = {
    headline: "Find What Moves You",
    subline: "Curated architecture. Quiet light.",
    sublineMuted: "Homes built to outlast trends.",
    primaryLabel: "Explore Residences",
    buildingAlt:
        "A modern residence of pale brick and floor-to-ceiling glass, its planted terraces catching the first warm light of the day.",
    buildingTop: 58.6,
    buildingWidth: 100,
    buildingOffsetX: 0,
    mistHeight: 70,
    background: "#cfe0ef",
    fadeColor: "#F7F4EF",
    ink: "#14120F",
    muted: "rgba(20,18,15,0.5)",
    displayFont: "Plus Jakarta Sans",
    textFont: "Plus Jakarta Sans",
}

addPropertyControls(ShadestateSkyHero, {
    headline: { type: ControlType.String, title: "Headline", defaultValue: ShadestateSkyHero.defaultProps.headline },
    subline: {
        type: ControlType.String,
        title: "Subline",
        defaultValue: ShadestateSkyHero.defaultProps.subline,
    },
    sublineMuted: {
        type: ControlType.String,
        title: "Subline (quiet)",
        defaultValue: ShadestateSkyHero.defaultProps.sublineMuted,
    },
    primaryLabel: {
        type: ControlType.String,
        title: "CTA label",
        defaultValue: ShadestateSkyHero.defaultProps.primaryLabel,
    },
    skyImage: { type: ControlType.Image, title: "Sky layer" },
    buildingImage: { type: ControlType.Image, title: "Building layer" },
    mistImage: { type: ControlType.Image, title: "Mist layer" },
    buildingAlt: {
        type: ControlType.String,
        title: "Building alt",
        defaultValue: "Architectural residence",
    },
    buildingTop: {
        type: ControlType.Number,
        title: "Building top %",
        min: 0,
        max: 100,
        step: 0.5,
        defaultValue: 58.6,
    },
    buildingWidth: {
        type: ControlType.Number,
        title: "Building width %",
        min: 40,
        max: 200,
        step: 1,
        defaultValue: 100,
    },
    buildingOffsetX: {
        type: ControlType.Number,
        title: "Building left %",
        min: -80,
        max: 80,
        step: 1,
        defaultValue: 0,
    },
    mistHeight: {
        type: ControlType.Number,
        title: "Mist height %",
        min: 0,
        max: 140,
        step: 2,
        defaultValue: 70,
    },
    background: { type: ControlType.Color, title: "Sky fallback", defaultValue: "#cfe0ef" },
    fadeColor: { type: ControlType.Color, title: "Page colour", defaultValue: "#F7F4EF" },
    ink: { type: ControlType.Color, title: "Ink", defaultValue: "#14120F" },
    muted: { type: ControlType.Color, title: "Ink muted", defaultValue: "#8A8078" },
    displayFont: { type: ControlType.String, title: "Display font", defaultValue: "Plus Jakarta Sans" },
    textFont: { type: ControlType.String, title: "Text font", defaultValue: "Plus Jakarta Sans" },
    onPrimary: { type: ControlType.EventHandler, title: "On primary" },
})
