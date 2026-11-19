/**
 * Shadestate — Hero
 * ---------------------------------------------------------------------------
 * Framer Code Component · React + TypeScript + framer-motion
 *
 * How to use it in Framer
 *   1. Assets → Code → New Code File → name it "ShadestateHero" → paste this file.
 *   2. Drag "ShadestateHero" onto the canvas and set its width to Fill.
 *   3. Properties panel: drop in your hero image, edit the copy, adjust colours.
 *
 * Design notes
 *   • FIND-style composition: full-bleed photograph, centred serif headline,
 *     one restrained CTA pair, a thin statistics bar at the foot.
 *   • Opening: image settles from 1.12 → 1, headline lines rise out of masks,
 *     eyebrow/sub/CTA fade up with a short stagger. On scroll the image
 *     continues to zoom and the copy lifts away.
 *   • Everything is transform/opacity only — no layout shift while scrolling.
 *   • Reduced motion: all entrance and scroll transforms are skipped.
 *   • Fonts: add Cormorant Garamond + Plus Jakarta Sans under
 *     Site Settings → Fonts, then pass their names in the two font properties.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

type ImageValue = string | { src?: string; srcSet?: string } | null | undefined

function imageUrl(image: ImageValue): string | undefined {
    if (!image) return undefined
    if (typeof image === "string") return image
    return image.src
}

interface Stat {
    value: string
    label: string
}

interface Props {
    eyebrow: string
    headline: string
    headlineAccent: string
    subline: string
    primaryLabel: string
    secondaryLabel: string
    image?: ImageValue
    imageAlt: string
    stats: Stat[]
    coordinates: string
    showFrame: boolean
    background: string
    paper: string
    ink: string
    accent: string
    displayFont: string
    textFont: string
    imagePosition: number
    onPrimary?: () => void
    onSecondary?: () => void
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
                paddingBottom: "0.09em",
                marginBottom: "-0.09em",
            }}
        >
            <motion.span
                initial={reduced ? false : { yPercent: 112 }}
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
 * @framerSupportedLayoutHeight auto
 */
export default function ShadestateHero(props: Props) {
    const {
        eyebrow,
        headline,
        headlineAccent,
        subline,
        primaryLabel,
        secondaryLabel,
        image,
        imageAlt,
        stats,
        coordinates,
        showFrame,
        background,
        paper,
        ink,
        accent,
        displayFont,
        textFont,
        imagePosition,
        onPrimary,
        onSecondary,
        style,
    } = props

    const reduced = useReducedMotion() ?? false
    const ref = useRef<HTMLDivElement>(null)
    const [mounted, setMounted] = useState(false)
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start start", "end start"],
    })
    const imageScale = useTransform(scrollYProgress, [0, 1], [1, 1.14])
    const copyY = useTransform(scrollYProgress, [0, 1], [0, -90])
    const copyOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0])
    const footOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

    useEffect(() => {
        setMounted(true)
    }, [])

    const serif = `${displayFont}, "Cormorant Garamond", Georgia, serif`
    const sans = `${textFont}, "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`
    const src = imageUrl(image)

    const statsList = useMemo<Stat[]>(
        () => (stats && stats.length ? stats : [{ value: "14", label: "Developments" }]),
        [stats]
    )

    const eyebrowStyle: CSSProperties = {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        margin: 0,
        fontFamily: sans,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        color: "rgba(247,244,239,0.8)",
    }

    return (
        <section
            ref={ref}
            style={{
                ...style,
                position: "relative",
                width: "100%",
                minHeight: 720,
                height: "100svh",
                overflow: "hidden",
                background,
                color: paper,
                boxSizing: "border-box",
                isolation: "isolate",
            }}
        >
            {/* Photograph */}
            <motion.div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: "-5% 0",
                    zIndex: -2,
                    scale: imageScale,
                    willChange: "transform",
                }}
            >
                {src ? (
                    <motion.img
                        src={src}
                        alt={imageAlt}
                        initial={reduced ? false : { scale: 1.12 }}
                        animate={reduced ? undefined : { scale: 1 }}
                        transition={{ duration: 2.4, ease: [0.23, 1, 0.32, 1] }}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            objectPosition: `50% ${imagePosition}%`,
                            willChange: "transform",
                        }}
                    />
                ) : (
                    <div
                        style={{
                            width: "100%",
                            height: "100%",
                            background: "linear-gradient(160deg, #6d6152 0%, #2b2620 60%, #1c1a17 100%)",
                        }}
                    />
                )}
            </motion.div>

            {/* Veil */}
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: -1,
                    background:
                        "linear-gradient(180deg, rgba(16,14,11,.58) 0%, rgba(16,14,11,.10) 32%, rgba(16,14,11,.20) 62%, rgba(14,12,10,.82) 100%)",
                }}
            />

            {/* Survey frame */}
            {showFrame ? (
                <div
                    aria-hidden="true"
                    style={{
                        position: "absolute",
                        inset: "clamp(16px, 2.3vw, 36px)",
                        zIndex: 1,
                        border: "1px solid rgba(247,244,239,0.13)",
                        pointerEvents: "none",
                    }}
                >
                    {(
                        [
                            { top: -1, left: -1, borderRight: 0, borderBottom: 0 },
                            { top: -1, right: -1, borderLeft: 0, borderBottom: 0 },
                            { bottom: -1, left: -1, borderRight: 0, borderTop: 0 },
                            { bottom: -1, right: -1, borderLeft: 0, borderTop: 0 },
                        ] as CSSProperties[]
                    ).map((corner, i) => (
                        <span
                            key={i}
                            style={{
                                position: "absolute",
                                width: 15,
                                height: 15,
                                border: "1px solid rgba(247,244,239,0.55)",
                                ...corner,
                            }}
                        />
                    ))}
                </div>
            ) : null}

            {/* Copy */}
            <motion.div
                style={{
                    position: "relative",
                    zIndex: 2,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: "clamp(90px, 12vh, 160px) clamp(20px, 5vw, 72px) clamp(120px, 16vh, 180px)",
                    y: reduced ? 0 : copyY,
                    opacity: reduced ? 1 : copyOpacity,
                }}
            >
                {eyebrow ? (
                    <motion.p
                        style={eyebrowStyle}
                        initial={reduced ? false : { opacity: 0, y: 14 }}
                        animate={reduced ? undefined : { opacity: 1, y: 0 }}
                        transition={{ duration: 0.9, delay: 0.15, ease: [0.23, 1, 0.32, 1] }}
                    >
                        {eyebrow}
                    </motion.p>
                ) : null}

                <h1
                    style={{
                        margin: "18px 0 0",
                        maxWidth: "17ch",
                        fontFamily: serif,
                        fontWeight: 300,
                        fontSize: "clamp(46px, 8.6vw, 124px)",
                        lineHeight: 0.94,
                        letterSpacing: "-0.028em",
                        color: paper,
                        textWrap: "balance",
                    }}
                >
                    <MaskedLine delay={0.25} reduced={reduced || !mounted}>
                        {headline}
                    </MaskedLine>
                    {headlineAccent ? (
                        <MaskedLine delay={0.36} reduced={reduced || !mounted}>
                            <em style={{ fontStyle: "italic", color: "#E6DFD3" }}>{headlineAccent}</em>
                        </MaskedLine>
                    ) : null}
                </h1>

                {subline ? (
                    <motion.p
                        initial={reduced ? false : { opacity: 0, y: 18 }}
                        animate={reduced ? undefined : { opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.62, ease: [0.23, 1, 0.32, 1] }}
                        style={{
                            margin: "22px 0 0",
                            maxWidth: "46ch",
                            fontFamily: sans,
                            fontWeight: 300,
                            fontSize: "clamp(15px, 1.02vw, 17px)",
                            lineHeight: 1.72,
                            color: "rgba(247,244,239,0.82)",
                            textWrap: "pretty",
                        }}
                    >
                        {subline}
                    </motion.p>
                ) : null}

                <motion.div
                    initial={reduced ? false : { opacity: 0, y: 18 }}
                    animate={reduced ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.78, ease: [0.23, 1, 0.32, 1] }}
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "clamp(14px, 2vw, 26px)",
                        marginTop: "clamp(26px, 3.6vh, 38px)",
                    }}
                >
                    {primaryLabel ? (
                        <button
                            type="button"
                            onClick={onPrimary}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "16px 28px",
                                borderRadius: 999,
                                border: `1px solid ${paper}`,
                                background: paper,
                                color: ink,
                                fontFamily: sans,
                                fontSize: 11,
                                fontWeight: 500,
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                cursor: "pointer",
                            }}
                        >
                            {primaryLabel}
                            <span aria-hidden="true">→</span>
                        </button>
                    ) : null}

                    {secondaryLabel ? (
                        <button
                            type="button"
                            onClick={onSecondary}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "14px 2px",
                                border: "none",
                                borderBottom: "1px solid rgba(247,244,239,0.42)",
                                background: "transparent",
                                color: paper,
                                fontFamily: sans,
                                fontSize: 11,
                                fontWeight: 500,
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                cursor: "pointer",
                            }}
                        >
                            {secondaryLabel}
                            <span aria-hidden="true">→</span>
                        </button>
                    ) : null}
                </motion.div>
            </motion.div>

            {/* Foot: stats + coordinates */}
            <motion.div
                style={{
                    position: "absolute",
                    inset: "auto 0 0 0",
                    zIndex: 2,
                    padding: "0 clamp(20px, 5vw, 72px) clamp(24px, 3.6vh, 38px)",
                    opacity: reduced ? 1 : footOpacity,
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "flex-end",
                        justifyContent: "space-between",
                        gap: 22,
                        flexWrap: "wrap",
                        paddingTop: 18,
                        borderTop: "1px solid rgba(247,244,239,0.16)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            gap: "clamp(20px, 3.4vw, 52px)",
                            flexWrap: "wrap",
                        }}
                    >
                        {statsList.map((stat) => (
                            <div
                                key={stat.label}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 3,
                                    alignItems: "center",
                                }}
                            >
                                <span
                                    style={{
                                        fontFamily: serif,
                                        fontSize: "clamp(22px, 2vw, 28px)",
                                        lineHeight: 1,
                                        color: paper,
                                    }}
                                >
                                    {stat.value}
                                </span>
                                <span
                                    style={{
                                        fontFamily: sans,
                                        fontSize: 9,
                                        letterSpacing: "0.22em",
                                        textTransform: "uppercase",
                                        color: "rgba(247,244,239,0.5)",
                                    }}
                                >
                                    {stat.label}
                                </span>
                            </div>
                        ))}
                    </div>
                    <span
                        style={{
                            fontFamily: sans,
                            fontSize: 9,
                            letterSpacing: "0.2em",
                            color: "rgba(247,244,239,0.42)",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {coordinates}
                    </span>
                </div>
            </motion.div>
        </section>
    )
}

ShadestateHero.defaultProps = {
    eyebrow: "Est. 1998 — Lisbon · Comporta · Cascais",
    headline: "Houses made to be",
    headlineAccent: "inherited.",
    subline:
        "A small Portuguese studio. A deliberate number of houses, cut from local limestone and made to hold their light for a century.",
    primaryLabel: "View the developments",
    secondaryLabel: "Request a private viewing",
    imageAlt: "A low villa of warm limestone and timber screens at golden hour.",
    stats: [
        { value: "14", label: "Developments" },
        { value: "€1.2B", label: "Portfolio" },
        { value: "28", label: "Awards" },
    ],
    coordinates: "38°42′N   9°08′W",
    showFrame: true,
    background: "#1C1A17",
    paper: "#F7F4EF",
    ink: "#1C1A17",
    accent: "#9A7B56",
    displayFont: "Cormorant Garamond",
    textFont: "Plus Jakarta Sans",
    imagePosition: 58,
}

addPropertyControls(ShadestateHero, {
    eyebrow: { type: ControlType.String, title: "Eyebrow", defaultValue: ShadestateHero.defaultProps.eyebrow },
    headline: { type: ControlType.String, title: "Headline", defaultValue: ShadestateHero.defaultProps.headline },
    headlineAccent: {
        type: ControlType.String,
        title: "Italic line",
        defaultValue: ShadestateHero.defaultProps.headlineAccent,
    },
    subline: {
        type: ControlType.String,
        title: "Subline",
        displayTextArea: true,
        defaultValue: ShadestateHero.defaultProps.subline,
    },
    primaryLabel: { type: ControlType.String, title: "Primary CTA", defaultValue: "View the developments" },
    secondaryLabel: { type: ControlType.String, title: "Secondary CTA", defaultValue: "Request a private viewing" },
    image: { type: ControlType.Image, title: "Hero image" },
    imageAlt: { type: ControlType.String, title: "Image alt", defaultValue: "Architectural residence" },
    imagePosition: {
        type: ControlType.Number,
        title: "Focus Y %",
        min: 0,
        max: 100,
        step: 1,
        defaultValue: 58,
    },
    stats: {
        type: ControlType.Array,
        title: "Statistics",
        control: {
            type: ControlType.Object,
            controls: {
                value: { type: ControlType.String, title: "Value", defaultValue: "14" },
                label: { type: ControlType.String, title: "Label", defaultValue: "Developments" },
            },
        },
        defaultValue: ShadestateHero.defaultProps.stats,
    },
    coordinates: { type: ControlType.String, title: "Coordinates", defaultValue: "38°42′N   9°08′W" },
    showFrame: { type: ControlType.Boolean, title: "Survey frame", defaultValue: true },
    background: { type: ControlType.Color, title: "Background", defaultValue: "#1C1A17" },
    paper: { type: ControlType.Color, title: "Paper", defaultValue: "#F7F4EF" },
    ink: { type: ControlType.Color, title: "Ink", defaultValue: "#1C1A17" },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#9A7B56" },
    displayFont: { type: ControlType.String, title: "Display font", defaultValue: "Cormorant Garamond" },
    textFont: { type: ControlType.String, title: "Text font", defaultValue: "Plus Jakarta Sans" },
    onPrimary: { type: ControlType.EventHandler, title: "On primary" },
    onSecondary: { type: ControlType.EventHandler, title: "On secondary" },
})
