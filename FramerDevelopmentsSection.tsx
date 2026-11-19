/**
 * Shadestate · Developments Section
 * ---------------------------------------------------------------------------
 * A self-contained Framer Code Component (React + TypeScript).
 *
 * How to use it in Framer:
 *   1. Assets → Code → New Code File → paste this file.
 *   2. Drag the component onto the canvas and set the width (it is responsive).
 *   3. Open the properties panel: drop in your own images, edit the copy, and
 *      set the accent / paper / ink colours to match the rest of the page.
 *
 * Current build
 *   • The Awwwards build of this section now lives in `framer/ShadestateDevelopments.tsx`
 *     (asymmetric offset grid, residence types in the modal, animated filters).
 *     This single-file variant is kept for projects already using it; the two are
 *     interchangeable and share the same property model.
 *
 * Notes
 *   • Fonts: the design uses Cormorant Garamond (display) and Plus Jakarta Sans
 *     (text). Add them under Site Settings → Fonts in Framer, or pass any Google
 *     font name in the two font properties.
 *   • Every list item in `developments` is a separate control, so the section can
 *     be edited without touching code.
 *   • Nothing is fetched or stored: the inquiry button only calls your own
 *     `onInquire` handler (optional property).
 * ---------------------------------------------------------------------------
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

type Status = "Available" | "Upcoming" | "Completed"

type ImageValue = string | { src?: string; srcSet?: string } | null | undefined

interface Development {
    name: string
    location: string
    year: string
    status: Status
    image?: ImageValue
    priceFrom: string
    bedrooms: string
    size: string
    completion: string
    architect: string
    description: string
    types?: Array<{ name: string; meta: string; price: string }>
}

/** Framer's Image control returns either a URL string or a { src, srcSet } object. */
function imageUrl(image: ImageValue): string | undefined {
    if (!image) return undefined
    if (typeof image === "string") return image
    return image.src
}

interface Props {
    eyebrow: string
    heading: string
    headingAccent: string
    note: string
    developments: Development[]
    showFilters: boolean
    backgroundColor: string
    paperColor: string
    inkColor: string
    mutedColor: string
    accentColor: string
    displayFont: string
    textFont: string
    onInquire?: (name: string) => void
    style?: CSSProperties
}

/* -------------------------------------------------------------------------- */
/*  Default content                                                           */
/* -------------------------------------------------------------------------- */

const DEFAULT_DEVELOPMENTS: Development[] = [
    {
        name: "Casa da Luz",
        location: "Comporta, Portugal",
        year: "2026",
        status: "Available",
        priceFrom: "€3.85M",
        bedrooms: "4–5 bedrooms",
        size: "412–486 m²",
        completion: "Q3 2026",
        architect: "Estúdio Almeida",
        description:
            "Eight low houses arranged around a shared olive grove, each opening onto its own walled courtyard and pool. The travertine comes from a single quarry batch, so every façade carries the same grain.",
        types: [
            { name: "Garden Villa", meta: "4 bedrooms · ground floor · private pool", price: "€3.85M – €4.2M" },
            { name: "Courtyard Villa", meta: "5 bedrooms · walled courtyard · pool", price: "€4.6M – €5.1M" },
        ],
    },
    {
        name: "Alto Príncipe",
        location: "Príncipe Real, Lisbon",
        year: "2027",
        status: "Upcoming",
        priceFrom: "€2.95M",
        bedrooms: "3–4 bedrooms",
        size: "212–342 m²",
        completion: "Q2 2027",
        architect: "Nuno Falcão",
        description:
            "A 1920s palace rebuilt from the inside: six apartments and duplexes around a planted lightwell, with the original stone stair restored and a new bronze lift core dropped into the centre.",
        types: [
            { name: "Garden Apartment", meta: "3 bedrooms · raised ground floor", price: "€2.95M" },
            { name: "Penthouse Duplex", meta: "4 bedrooms · two levels · roof terrace", price: "€3.4M – €3.9M" },
        ],
    },
    {
        name: "Maré Residences",
        location: "Cascais, Portugal",
        year: "2028",
        status: "Upcoming",
        priceFrom: "€1.45M",
        bedrooms: "2–3 bedrooms",
        size: "128–186 m²",
        completion: "2028",
        architect: "Atelier Sousa",
        description:
            "Fourteen apartments stepping down toward the Cascais shoreline, each with a planted terrace deep enough to eat on. The building sits back behind the coastal road.",
    },
    {
        name: "Quinta do Vale",
        location: "Alentejo, Portugal",
        year: "2023",
        status: "Completed",
        priceFrom: "Sold out",
        bedrooms: "4 bedrooms",
        size: "364 m²",
        completion: "2023",
        architect: "Estúdio Almeida",
        description:
            "Five estate houses on a working cork and olive farm, built from stone quarried on the property itself. Completed in 2023 and fully sold.",
    },
    {
        name: "Miradouro Terrace",
        location: "Graça, Lisbon",
        year: "2025",
        status: "Available",
        priceFrom: "€5.6M",
        bedrooms: "3 bedrooms",
        size: "248 m² + 96 m² terrace",
        completion: "2025",
        architect: "Nuno Falcão",
        description:
            "Three penthouses above Graça, each with a travertine roof terrace facing the castle and the river. The last residence is offered with its furniture.",
    },
    {
        name: "Shadestate House",
        location: "Comporta, Portugal",
        year: "2019",
        status: "Completed",
        priceFrom: "Sold",
        bedrooms: "6 bedrooms",
        size: "612 m²",
        completion: "2019",
        architect: "Tomás Shadestate",
        description:
            "The house we built for ourselves: a single residence hidden behind timber screens, with a reflecting pool that doubles as the roof of the archive below.",
    },
]

/* -------------------------------------------------------------------------- */
/*  Status styling                                                            */
/* -------------------------------------------------------------------------- */

const STATUS_STYLE: Record<Status, { bg: string; fg: string }> = {
    Available: { bg: "#1C1A17", fg: "#F7F4EF" },
    Upcoming: { bg: "#9A7B56", fg: "#FFF9F0" },
    Completed: { bg: "#F7F4EF", fg: "#1C1A17" },
}

/* -------------------------------------------------------------------------- */
/*  Small pieces                                                              */
/* -------------------------------------------------------------------------- */

function StatusPill({
    status,
    compact,
}: {
    status: Status
    compact?: boolean
}) {
    const palette = STATUS_STYLE[status] ?? STATUS_STYLE.Available
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                padding: compact ? "6px 11px 5px" : "7px 13px 6px",
                borderRadius: 999,
                background: palette.bg,
                color: palette.fg,
                fontFamily: "var(--shadestate-sans)",
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                lineHeight: 1,
                whiteSpace: "nowrap",
            }}
        >
            {status}
        </span>
    )
}

function Placeholder({ name }: { name: string }) {
    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                background:
                    "linear-gradient(135deg, #E6DFD3 0%, #D9CFBD 55%, #C9BBA4 100%)",
                color: "#9A7B56",
                fontFamily: "var(--shadestate-serif)",
                fontStyle: "italic",
                fontSize: 28,
            }}
        >
            {name}
        </div>
    )
}

/* -------------------------------------------------------------------------- */
/*  Detail modal                                                              */
/* -------------------------------------------------------------------------- */

function DetailModal({
    dev,
    onClose,
    onInquire,
    colors,
}: {
    dev: Development
    onClose: () => void
    onInquire: (name: string) => void
    colors: { paper: string; ink: string; muted: string; accent: string; line: string }
}) {
    const closeRef = useRef<HTMLButtonElement | null>(null)

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        document.addEventListener("keydown", onKey)
        closeRef.current?.focus({ preventScroll: true })
        return () => document.removeEventListener("keydown", onKey)
    }, [onClose])

    const specs: Array<[string, string]> = [
        ["Completion", dev.completion],
        ["Typology", dev.bedrooms],
        ["Internal area", dev.size],
        ["Architect", dev.architect],
    ]

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 20,
                display: "grid",
                placeItems: "center",
                padding: 16,
                background: "rgba(14, 12, 10, 0.62)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
            }}
        >
            <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={dev.name}
                initial={{ opacity: 0, y: 24, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.99 }}
                transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                onClick={(e) => e.stopPropagation()}
                style={{
                    position: "relative",
                    width: "min(100%, 1040px)",
                    maxHeight: "88vh",
                    overflow: "hidden",
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
                    background: colors.paper,
                    boxShadow: "0 40px 100px -30px rgba(0,0,0,0.5)",
                }}
            >
                <div style={{ position: "relative", minHeight: 320, background: "#E6DFD3" }}>
                    {imageUrl(dev.image) ? (
                        <img
                            src={imageUrl(dev.image)}
                            alt={dev.name}
                            style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                            }}
                        />
                    ) : (
                        <Placeholder name={dev.name} />
                    )}
                </div>

                <div
                    style={{
                        padding: "clamp(24px, 3vw, 46px)",
                        overflowY: "auto",
                        maxHeight: "88vh",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                            flexWrap: "wrap",
                            fontFamily: "var(--shadestate-sans)",
                            fontSize: 10,
                            letterSpacing: "0.2em",
                            textTransform: "uppercase",
                            color: colors.muted,
                        }}
                    >
                        <StatusPill status={dev.status} compact />
                        <span>{dev.location}</span>
                    </div>

                    <h3
                        style={{
                            margin: "16px 0 0",
                            fontFamily: "var(--shadestate-serif)",
                            fontWeight: 300,
                            fontSize: "clamp(30px, 3.4vw, 44px)",
                            lineHeight: 1.05,
                            letterSpacing: "-0.015em",
                            color: colors.ink,
                        }}
                    >
                        {dev.name}
                    </h3>

                    <p
                        style={{
                            margin: "16px 0 0",
                            fontFamily: "var(--shadestate-sans)",
                            fontSize: 14.5,
                            lineHeight: 1.75,
                            color: "#514C42",
                        }}
                    >
                        {dev.description}
                    </p>

                    <dl
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "1px 22px",
                            margin: "26px 0 0",
                            padding: "18px 0",
                            borderTop: `1px solid ${colors.line}`,
                            borderBottom: `1px solid ${colors.line}`,
                        }}
                    >
                        {specs.map(([label, value]) => (
                            <div key={label} style={{ padding: "8px 0" }}>
                                <dt
                                    style={{
                                        fontFamily: "var(--shadestate-sans)",
                                        fontSize: 9,
                                        letterSpacing: "0.22em",
                                        textTransform: "uppercase",
                                        color: colors.muted,
                                        marginBottom: 5,
                                    }}
                                >
                                    {label}
                                </dt>
                                <dd
                                    style={{
                                        margin: 0,
                                        fontFamily: "var(--shadestate-sans)",
                                        fontSize: 13.5,
                                        color: colors.ink,
                                    }}
                                >
                                    {value}
                                </dd>
                            </div>
                        ))}
                    </dl>

                    {dev.types && dev.types.length ? (
                        <div style={{ marginTop: 24 }}>
                            <h4
                                style={{
                                    margin: "0 0 10px",
                                    fontFamily: "var(--shadestate-sans)",
                                    fontSize: 9.5,
                                    fontWeight: 600,
                                    letterSpacing: "0.24em",
                                    textTransform: "uppercase",
                                    color: colors.accent,
                                }}
                            >
                                Residence types
                            </h4>
                            <ul style={{ margin: 0, padding: 0, listStyle: "none", borderTop: `1px solid ${colors.line}` }}>
                                {dev.types.map((t) => (
                                    <li
                                        key={t.name}
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "1fr auto",
                                            gap: "3px 18px",
                                            padding: "12px 0",
                                            borderBottom: `1px solid ${colors.line}`,
                                        }}
                                    >
                                        <span style={{ fontFamily: "var(--shadestate-serif)", fontSize: 18, color: colors.ink }}>
                                            {t.name}
                                        </span>
                                        <span
                                            style={{
                                                gridRow: "1 / span 2",
                                                gridColumn: 2,
                                                alignSelf: "center",
                                                fontFamily: "var(--shadestate-sans)",
                                                fontSize: 11.5,
                                                color: colors.ink,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            {t.price}
                                        </span>
                                        <span
                                            style={{
                                                fontFamily: "var(--shadestate-sans)",
                                                fontSize: 9.5,
                                                letterSpacing: "0.1em",
                                                textTransform: "uppercase",
                                                color: colors.muted,
                                            }}
                                        >
                                            {t.meta}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : null}

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 18,
                            flexWrap: "wrap",
                            marginTop: 28,
                            paddingTop: 22,
                            borderTop: `1px solid ${colors.line}`,
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => onInquire(dev.name)}
                            style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "14px 24px",
                                borderRadius: 999,
                                border: `1px solid ${colors.ink}`,
                                background: colors.ink,
                                color: colors.paper,
                                fontFamily: "var(--shadestate-sans)",
                                fontSize: 11,
                                fontWeight: 500,
                                letterSpacing: "0.16em",
                                textTransform: "uppercase",
                                cursor: "pointer",
                            }}
                        >
                            Request the presentation
                            <span aria-hidden="true">→</span>
                        </button>
                        <p
                            style={{
                                margin: 0,
                                fontFamily: "var(--shadestate-sans)",
                                fontSize: 11,
                                letterSpacing: "0.12em",
                                textTransform: "uppercase",
                                color: colors.muted,
                            }}
                        >
                            From {dev.priceFrom}
                        </p>
                    </div>
                </div>

                <button
                    ref={closeRef}
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    style={{
                        position: "absolute",
                        top: 14,
                        right: 14,
                        width: 40,
                        height: 40,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: "50%",
                        border: "none",
                        background: "rgba(247,244,239,0.92)",
                        color: "#1C1A17",
                        fontSize: 18,
                        lineHeight: 1,
                        cursor: "pointer",
                    }}
                >
                    ×
                </button>
            </motion.div>
        </motion.div>
    )
}

/* -------------------------------------------------------------------------- */
/*  Section                                                                   */
/* -------------------------------------------------------------------------- */

const FILTERS = ["All", "Available", "Upcoming", "Completed"] as const
type Filter = (typeof FILTERS)[number]

/**
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight auto
 */
export default function ShadestateDevelopments(props: Props) {
    const {
        eyebrow,
        heading,
        headingAccent,
        note,
        developments,
        showFilters,
        backgroundColor,
        paperColor,
        inkColor,
        mutedColor,
        accentColor,
        displayFont,
        textFont,
        onInquire,
        style,
    } = props

    const [filter, setFilter] = useState<Filter>("All")
    const [active, setActive] = useState<Development | null>(null)

    const list = developments && developments.length ? developments : DEFAULT_DEVELOPMENTS

    const filtered = useMemo(() => {
        if (filter === "All") return list
        return list.filter((d) => d.status === filter)
    }, [filter, list])

    const counts = useMemo(() => {
        const map: Record<string, number> = { All: list.length }
        list.forEach((d) => {
            map[d.status] = (map[d.status] ?? 0) + 1
        })
        return map
    }, [list])

    const colors = {
        paper: paperColor,
        ink: inkColor,
        muted: mutedColor,
        accent: accentColor,
        line: "rgba(28,26,23,0.12)",
    }

    const handleInquire = (name: string) => {
        setActive(null)
        onInquire?.(name)
    }

    const cssVars = {
        "--shadestate-serif": `${displayFont}, "Cormorant Garamond", Georgia, serif`,
        "--shadestate-sans": `${textFont}, "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`,
    } as CSSProperties

    return (
        <section
            style={{
                ...style,
                ...cssVars,
                position: "relative",
                width: "100%",
                padding: "clamp(56px, 8vw, 120px) clamp(20px, 5vw, 64px)",
                background: backgroundColor,
                color: inkColor,
                boxSizing: "border-box",
            }}
        >
            {/* Section head */}
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    gap: 32,
                    flexWrap: "wrap",
                    maxWidth: 1320,
                    margin: "0 auto",
                }}
            >
                <div>
                    <p
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 14,
                            margin: 0,
                            fontFamily: "var(--shadestate-sans)",
                            fontSize: 10,
                            fontWeight: 500,
                            letterSpacing: "0.22em",
                            textTransform: "uppercase",
                            color: accentColor,
                        }}
                    >
                        <span
                            aria-hidden="true"
                            style={{
                                display: "inline-block",
                                width: 34,
                                height: 1,
                                background: accentColor,
                                opacity: 0.55,
                            }}
                        />
                        {eyebrow}
                    </p>
                    <h2
                        style={{
                            margin: "20px 0 0",
                            fontFamily: "var(--shadestate-serif)",
                            fontWeight: 300,
                            fontSize: "clamp(34px, 4.4vw, 60px)",
                            lineHeight: 1.06,
                            letterSpacing: "-0.015em",
                            color: inkColor,
                        }}
                    >
                        {heading}{" "}
                        <em style={{ fontStyle: "italic", color: accentColor }}>{headingAccent}</em>
                    </h2>
                </div>

                {note ? (
                    <p
                        style={{
                            maxWidth: 300,
                            margin: 0,
                            fontFamily: "var(--shadestate-sans)",
                            fontSize: 13.5,
                            lineHeight: 1.75,
                            color: mutedColor,
                        }}
                    >
                        {note}
                    </p>
                ) : null}
            </div>

            {/* Filters */}
            {showFilters ? (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 20,
                        flexWrap: "wrap",
                        maxWidth: 1320,
                        margin: "clamp(32px, 4vw, 54px) auto 0",
                        paddingBottom: 18,
                        borderBottom: `1px solid ${colors.line}`,
                    }}
                >
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {FILTERS.map((f) => {
                            const isActive = filter === f
                            return (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFilter(f)}
                                    aria-pressed={isActive}
                                    style={{
                                        padding: "9px 16px",
                                        borderRadius: 999,
                                        border: `1px solid ${isActive ? inkColor : "transparent"}`,
                                        background: isActive ? inkColor : "transparent",
                                        color: isActive ? paperColor : mutedColor,
                                        fontFamily: "var(--shadestate-sans)",
                                        fontSize: 11,
                                        fontWeight: 500,
                                        letterSpacing: "0.14em",
                                        textTransform: "uppercase",
                                        cursor: "pointer",
                                        transition: "all 0.3s ease",
                                    }}
                                >
                                    {f}
                                    <span style={{ marginLeft: 6, opacity: 0.55 }}>
                                        {counts[f] ?? 0}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                    <p
                        aria-live="polite"
                        style={{
                            margin: 0,
                            fontFamily: "var(--shadestate-sans)",
                            fontSize: 10.5,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            color: mutedColor,
                        }}
                    >
                        Showing {filtered.length} of {list.length}
                    </p>
                </div>
            ) : null}

            {/* Grid */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
                    gap: "clamp(32px, 4vw, 64px)",
                    maxWidth: 1320,
                    margin: "clamp(30px, 4vw, 48px) auto 0",
                    alignItems: "start",
                }}
            >
                <AnimatePresence initial={false} mode="popLayout">
                    {filtered.map((dev, index) => (
                        <motion.article
                            key={dev.name}
                            layout
                            initial={{ opacity: 0, y: 18 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            whileHover="hover"
                            transition={{
                                duration: 0.5,
                                ease: [0.16, 1, 0.3, 1],
                                delay: index * 0.04,
                            }}
                            style={{
                                position: "relative",
                                display: "flex",
                                flexDirection: "column",
                                marginTop: index % 2 === 1 ? "clamp(0px, 4vw, 64px)" : 0,
                            }}
                        >
                            <div
                                style={{
                                    position: "relative",
                                    overflow: "hidden",
                                    aspectRatio: index % 4 === 1 ? "4 / 4.6" : "4 / 3",
                                    background: "#E6DFD3",
                                }}
                            >
                                {imageUrl(dev.image) ? (
                                    <motion.img
                                        src={imageUrl(dev.image)}
                                        alt={dev.name}
                                        variants={{ hover: { scale: 1.045 } }}
                                        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            width: "100%",
                                            height: "100%",
                                            objectFit: "cover",
                                        }}
                                    />
                                ) : (
                                    <Placeholder name={dev.name} />
                                )}
                                <div style={{ position: "absolute", top: 16, left: 16 }}>
                                    <StatusPill status={dev.status} />
                                </div>
                            </div>

                            <div style={{ paddingTop: 20 }}>
                                <p
                                    style={{
                                        margin: 0,
                                        fontFamily: "var(--shadestate-sans)",
                                        fontSize: 10,
                                        letterSpacing: "0.2em",
                                        textTransform: "uppercase",
                                        color: accentColor,
                                    }}
                                >
                                    {dev.location} · {dev.year}
                                </p>
                                <h3
                                    style={{
                                        margin: "8px 0 0",
                                        fontFamily: "var(--shadestate-serif)",
                                        fontWeight: 400,
                                        fontSize: "clamp(24px, 2.4vw, 32px)",
                                        lineHeight: 1.12,
                                        letterSpacing: "-0.01em",
                                        color: inkColor,
                                    }}
                                >
                                    {dev.name}
                                </h3>
                                <p
                                    style={{
                                        margin: "6px 0 0",
                                        fontFamily: "var(--shadestate-sans)",
                                        fontSize: 13,
                                        color: mutedColor,
                                    }}
                                >
                                    {dev.bedrooms} · {dev.size}
                                </p>

                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "baseline",
                                        justifyContent: "space-between",
                                        gap: 16,
                                        marginTop: 12,
                                        paddingTop: 14,
                                        borderTop: `1px solid ${colors.line}`,
                                    }}
                                >
                                    <span
                                        style={{
                                            fontFamily: "var(--shadestate-sans)",
                                            fontSize: 11,
                                            letterSpacing: "0.13em",
                                            textTransform: "uppercase",
                                            color: inkColor,
                                        }}
                                    >
                                        From {dev.priceFrom}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setActive(dev)}
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 7,
                                            padding: 0,
                                            border: "none",
                                            background: "none",
                                            cursor: "pointer",
                                            fontFamily: "var(--shadestate-sans)",
                                            fontSize: 10.5,
                                            letterSpacing: "0.16em",
                                            textTransform: "uppercase",
                                            color: accentColor,
                                        }}
                                    >
                                        Details <span aria-hidden="true">→</span>
                                    </button>
                                </div>
                            </div>

                            {/* Whole-card click target (keyboard accessible) */}
                            <button
                                type="button"
                                onClick={() => setActive(dev)}
                                aria-label={`View details for ${dev.name}`}
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    width: "100%",
                                    border: "none",
                                    background: "transparent",
                                    cursor: "pointer",
                                    zIndex: 1,
                                }}
                            />
                        </motion.article>
                    ))}
                </AnimatePresence>
            </div>

            <AnimatePresence>
                {active ? (
                    <DetailModal
                        dev={active}
                        onClose={() => setActive(null)}
                        onInquire={handleInquire}
                        colors={colors}
                    />
                ) : null}
            </AnimatePresence>
        </section>
    )
}

/* -------------------------------------------------------------------------- */
/*  Property controls                                                         */
/* -------------------------------------------------------------------------- */

ShadestateDevelopments.defaultProps = {
    eyebrow: "02 · The Portfolio",
    heading: "Current &",
    headingAccent: "coming houses",
    note: "Six addresses, each with its own architect and its own weather. Prices are quoted as guide prices, excluding transfer taxes.",
    developments: DEFAULT_DEVELOPMENTS,
    showFilters: true,
    backgroundColor: "#F1ECE3",
    paperColor: "#F7F4EF",
    inkColor: "#1C1A17",
    mutedColor: "#6B6459",
    accentColor: "#9A7B56",
    displayFont: "Cormorant Garamond",
    textFont: "Plus Jakarta Sans",
}

addPropertyControls(ShadestateDevelopments, {
    eyebrow: {
        type: ControlType.String,
        title: "Eyebrow",
        defaultValue: "02 · The Portfolio",
    },
    heading: {
        type: ControlType.String,
        title: "Heading",
        defaultValue: "Current &",
    },
    headingAccent: {
        type: ControlType.String,
        title: "Accent",
        defaultValue: "coming houses",
    },
    note: {
        type: ControlType.String,
        title: "Note",
        displayTextArea: true,
        defaultValue:
            "Six addresses, each with its own architect and its own weather. Prices are quoted as guide prices, excluding transfer taxes.",
    },
    developments: {
        type: ControlType.Array,
        title: "Developments",
        control: {
            type: ControlType.Object,
            controls: {
                name: { type: ControlType.String, title: "Name", defaultValue: "New Development" },
                location: { type: ControlType.String, title: "Location", defaultValue: "Lisbon, Portugal" },
                year: { type: ControlType.String, title: "Year", defaultValue: "2027" },
                status: {
                    type: ControlType.Enum,
                    title: "Status",
                    options: ["Available", "Upcoming", "Completed"],
                    optionTitles: ["Available", "Upcoming", "Completed"],
                    defaultValue: "Available",
                },
                image: { type: ControlType.Image, title: "Image" },
                priceFrom: { type: ControlType.String, title: "Price", defaultValue: "€2.5M" },
                bedrooms: { type: ControlType.String, title: "Bedrooms", defaultValue: "3–4 bedrooms" },
                size: { type: ControlType.String, title: "Size", defaultValue: "240 m²" },
                completion: { type: ControlType.String, title: "Completion", defaultValue: "Q4 2027" },
                architect: { type: ControlType.String, title: "Architect", defaultValue: "Studio" },
                description: {
                    type: ControlType.String,
                    title: "Description",
                    displayTextArea: true,
                    defaultValue: "A short editorial description of the development.",
                },
            },
        },
        defaultValue: DEFAULT_DEVELOPMENTS,
    },
    showFilters: {
        type: ControlType.Boolean,
        title: "Filters",
        defaultValue: true,
    },
    backgroundColor: { type: ControlType.Color, title: "Background", defaultValue: "#F1ECE3" },
    paperColor: { type: ControlType.Color, title: "Paper", defaultValue: "#F7F4EF" },
    inkColor: { type: ControlType.Color, title: "Ink", defaultValue: "#1C1A17" },
    mutedColor: { type: ControlType.Color, title: "Muted", defaultValue: "#6B6459" },
    accentColor: { type: ControlType.Color, title: "Accent", defaultValue: "#9A7B56" },
    displayFont: {
        type: ControlType.String,
        title: "Display font",
        defaultValue: "Cormorant Garamond",
    },
    textFont: {
        type: ControlType.String,
        title: "Text font",
        defaultValue: "Plus Jakarta Sans",
    },
})
