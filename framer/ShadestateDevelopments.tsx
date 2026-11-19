/**
 * Shadestate · Developments
 * ---------------------------------------------------------------------------
 * Framer Code Component · React + TypeScript + framer-motion
 *
 * How to use it in Framer
 *   1. Assets → Code → New Code File → "ShadestateDevelopments" → paste.
 *   2. Drag it onto the canvas, width Fill.
 *   3. Add one item per development in the properties panel (image, status,
 *      prices, types, amenities). Filters and the modal build themselves.
 *
 * Behaviour
 *   • Filter chips with live counts (All / Available / Upcoming / Completed).
 *   • Two-column offset grid on desktop, single column on phones.
 *   • Hover: image zooms 1.045 and the card title shifts 4px.
 *   • Card click opens a detail modal: specs, residence types, amenities,
 *     inquire CTA. Escape or backdrop closes it; focus is restored.
 *   • Motion: AnimatePresence for filter and modal, ease [0.23, 1, 0.32, 1].
 * ---------------------------------------------------------------------------
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

type Status = "Available" | "Upcoming" | "Completed"
type ImageValue = string | { src?: string; srcSet?: string } | null | undefined

function imageUrl(image: ImageValue): string | undefined {
    if (!image) return undefined
    if (typeof image === "string") return image
    return image.src
}

interface ResidenceType {
    name: string
    meta: string
    price: string
}

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
    types?: ResidenceType[]
    amenities?: string[]
}

interface Props {
    eyebrow: string
    heading: string
    headingAccent: string
    note: string
    developments: Development[]
    showFilters: boolean
    background: string
    paper: string
    ink: string
    muted: string
    accent: string
    displayFont: string
    textFont: string
    columns: number
    onInquire?: (name: string) => void
    style?: CSSProperties
}

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1]
const STATUS_BG: Record<Status, { bg: string; fg: string }> = {
    Available: { bg: "#1C1A17", fg: "#F7F4EF" },
    Upcoming: { bg: "#9A7B56", fg: "#FFF9F0" },
    Completed: { bg: "#F7F4EF", fg: "#1C1A17" },
}

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
        amenities: ["Private pool", "Olive grove", "Cellar", "Concierge", "Staff studio"],
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
            { name: "Garden Apartment", meta: "3 bedrooms · raised ground floor · planted terrace", price: "€2.95M" },
            { name: "Penthouse Duplex", meta: "4 bedrooms · two levels · roof terrace", price: "€3.4M – €3.9M" },
        ],
        amenities: ["Planted lightwell", "Bronze lift", "Concierge", "Garage", "Wine room"],
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
        types: [
            { name: "Sea Apartment", meta: "2 bedrooms · first floor · sea-facing terrace", price: "€1.45M – €1.6M" },
            { name: "Terrace Apartment", meta: "3 bedrooms · corner · wraparound terrace", price: "€1.9M – €2.3M" },
        ],
        amenities: ["Sea-facing terraces", "Residents’ pool", "Gym", "Garage", "Beach path"],
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
        types: [{ name: "Farmhouse", meta: "4 bedrooms · estate garden · private well", price: "Sold 2023" }],
        amenities: ["Private well", "Cork and olive farm", "Pool", "Guest annexe", "Stables"],
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
        types: [{ name: "Roof Penthouse", meta: "3 bedrooms · top floor · 96 m² roof terrace", price: "€5.6M" }],
        amenities: ["Private roof terrace", "River views", "Furnished by commission", "Lift", "Garage"],
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
        types: [{ name: "Principal House", meta: "6 bedrooms · 2.4 ha plot · guest wing", price: "Sold 2019" }],
        amenities: ["Reflecting pool", "Archive", "Olive grove", "Guest wing", "Sea path"],
    },
]

const FILTERS = ["All", "Available", "Upcoming", "Completed"] as const
type Filter = (typeof FILTERS)[number]

/** @framerSupportedLayoutWidth any @framerSupportedLayoutHeight auto */
export default function ShadestateDevelopments(props: Props) {
    const {
        eyebrow,
        heading,
        headingAccent,
        note,
        developments,
        showFilters,
        background,
        paper,
        ink,
        muted,
        accent,
        displayFont,
        textFont,
        columns,
        onInquire,
        style,
    } = props

    const serif = `${displayFont}, "Cormorant Garamond", Georgia, serif`
    const sans = `${textFont}, "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`
    const list = developments && developments.length ? developments : DEFAULT_DEVELOPMENTS

    const [filter, setFilter] = useState<Filter>("All")
    const [active, setActive] = useState<Development | null>(null)
    const modalRef = useRef<HTMLDivElement | null>(null)

    const counts = useMemo(() => {
        const map: Record<string, number> = { All: list.length }
        list.forEach((d) => {
            map[d.status] = (map[d.status] ?? 0) + 1
        })
        return map
    }, [list])

    const filtered = useMemo(
        () => (filter === "All" ? list : list.filter((d) => d.status === filter)),
        [filter, list]
    )

    useEffect(() => {
        if (!active) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setActive(null)
        }
        document.addEventListener("keydown", onKey)
        const previous = document.body.style.overflow
        document.body.style.overflow = "hidden"
        modalRef.current?.focus({ preventScroll: true })
        return () => {
            document.removeEventListener("keydown", onKey)
            document.body.style.overflow = previous
        }
    }, [active])

    const line = "rgba(28,26,23,0.12)"

    return (
        <section
            style={{
                ...style,
                position: "relative",
                width: "100%",
                padding: "clamp(64px, 9vw, 140px) clamp(20px, 4.4vw, 64px)",
                background,
                color: ink,
                boxSizing: "border-box",
            }}
        >
            <style>{`
                .sd-dev-grid { display: grid; grid-template-columns: 1fr; gap: 44px; max-width: 1360px; margin: 0 auto; align-items: start; }
                @media (min-width: 810px) {
                    .sd-dev-grid { grid-template-columns: repeat(${Math.max(1, Math.min(2, columns))}, minmax(0, 1fr)); gap: 64px 32px; }
                    .sd-dev-grid > *:nth-child(even) { margin-top: 72px; }
                }
                .sd-dev-card { position: relative; display: flex; flex-direction: column; min-width: 0; cursor: pointer; }
                .sd-dev-media { position: relative; overflow: hidden; background: #E6DFD3; aspect-ratio: 4 / 3; }
                .sd-dev-card:nth-child(2) .sd-dev-media,
                .sd-dev-card:nth-child(3) .sd-dev-media { aspect-ratio: 4 / 4.6; }
                .sd-dev-card:hover .sd-dev-img { transform: scale(1.045); }
                .sd-dev-card:hover .sd-dev-name { transform: translateX(4px); }
                .sd-dev-img { width: 100%; height: 100%; object-fit: cover; transition: transform 1.2s cubic-bezier(.23,1,.32,1); }
                .sd-dev-name { transition: transform .6s cubic-bezier(.23,1,.32,1); }
                .sd-dev-card:focus-visible { outline: 2px solid #9A7B56; outline-offset: 6px; }
            `}</style>

            {/* Head */}
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    gap: 40,
                    flexWrap: "wrap",
                    maxWidth: 1360,
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
                            fontFamily: sans,
                            fontSize: 11,
                            fontWeight: 500,
                            letterSpacing: "0.15em",
                            textTransform: "uppercase",
                            color: accent,
                        }}
                    >
                        <span aria-hidden="true" style={{ width: 38, height: 1, background: accent, opacity: 0.55 }} />
                        {eyebrow}
                    </p>
                    <h2
                        style={{
                            margin: "20px 0 0",
                            fontFamily: serif,
                            fontWeight: 300,
                            fontSize: "clamp(34px, 4.4vw, 60px)",
                            lineHeight: 1.04,
                            letterSpacing: "-0.018em",
                            color: ink,
                            maxWidth: "16ch",
                        }}
                    >
                        {heading}{" "}
                        <em style={{ fontStyle: "italic", color: accent }}>{headingAccent}</em>
                    </h2>
                </div>
                {note ? (
                    <p
                        style={{
                            maxWidth: 320,
                            margin: 0,
                            fontFamily: sans,
                            fontSize: 14,
                            lineHeight: 1.78,
                            color: muted,
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
                        gap: 18,
                        flexWrap: "wrap",
                        maxWidth: 1360,
                        margin: "clamp(30px, 4vw, 54px) auto 0",
                        paddingBottom: 18,
                        borderBottom: `1px solid ${line}`,
                    }}
                >
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {FILTERS.map((f) => {
                            const on = filter === f
                            return (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFilter(f)}
                                    aria-pressed={on}
                                    style={{
                                        padding: "9px 17px",
                                        borderRadius: 999,
                                        border: "none",
                                        background: on ? ink : "transparent",
                                        color: on ? paper : muted,
                                        fontFamily: sans,
                                        fontSize: 11,
                                        fontWeight: 500,
                                        letterSpacing: "0.14em",
                                        textTransform: "uppercase",
                                        cursor: "pointer",
                                        transition: "background .35s, color .35s",
                                    }}
                                >
                                    {f}
                                    <span style={{ marginLeft: 6, opacity: 0.55 }}>{counts[f] ?? 0}</span>
                                </button>
                            )
                        })}
                    </div>
                    <p
                        aria-live="polite"
                        style={{
                            margin: 0,
                            fontFamily: sans,
                            fontSize: 10.5,
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            color: muted,
                        }}
                    >
                        Showing {filtered.length} of {list.length}
                    </p>
                </div>
            ) : null}

            {/* Grid */}
            <div className="sd-dev-grid" style={{ marginTop: "clamp(32px, 4vw, 56px)" }}>
                <AnimatePresence initial={false} mode="popLayout">
                    {filtered.map((dev, index) => {
                        const src = imageUrl(dev.image)
                        const chip = STATUS_BG[dev.status] ?? STATUS_BG.Available
                        return (
                            <motion.article
                                key={dev.name}
                                layout
                                initial={{ opacity: 0, y: 22 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.6, ease: EASE, delay: index * 0.04 }}
                                className="sd-dev-card"
                                role="button"
                                tabIndex={0}
                                onClick={() => setActive(dev)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault()
                                        setActive(dev)
                                    }
                                }}
                            >
                                <div className="sd-dev-media">
                                    {src ? (
                                        <img src={src} alt={dev.name} className="sd-dev-img" />
                                    ) : (
                                        <div
                                            style={{
                                                position: "absolute",
                                                inset: 0,
                                                display: "grid",
                                                placeItems: "center",
                                                background: "linear-gradient(135deg,#E6DFD3,#C9BBA4)",
                                                color: accent,
                                                fontFamily: serif,
                                                fontStyle: "italic",
                                                fontSize: 26,
                                            }}
                                        >
                                            {dev.name}
                                        </div>
                                    )}
                                    <span
                                        style={{
                                            position: "absolute",
                                            top: 16,
                                            left: 16,
                                            padding: "7px 13px 6px",
                                            borderRadius: 999,
                                            background: chip.bg,
                                            color: chip.fg,
                                            fontFamily: sans,
                                            fontSize: 9,
                                            fontWeight: 500,
                                            letterSpacing: "0.18em",
                                            textTransform: "uppercase",
                                        }}
                                    >
                                        {dev.status}
                                    </span>
                                </div>

                                <div style={{ paddingTop: 20, display: "flex", flexDirection: "column", gap: 7 }}>
                                    <p
                                        style={{
                                            margin: 0,
                                            fontFamily: sans,
                                            fontSize: 10,
                                            letterSpacing: "0.2em",
                                            textTransform: "uppercase",
                                            color: accent,
                                        }}
                                    >
                                        {dev.location} · {dev.year}
                                    </p>
                                    <h3
                                        className="sd-dev-name"
                                        style={{
                                            margin: 0,
                                            fontFamily: serif,
                                            fontWeight: 400,
                                            fontSize: "clamp(24px, 2.3vw, 32px)",
                                            lineHeight: 1.1,
                                            letterSpacing: "-0.012em",
                                            color: ink,
                                        }}
                                    >
                                        {dev.name}
                                    </h3>
                                    <p style={{ margin: 0, fontFamily: sans, fontSize: 13, color: muted }}>
                                        {dev.bedrooms} · {dev.size}
                                    </p>
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "baseline",
                                            justifyContent: "space-between",
                                            gap: 16,
                                            marginTop: 10,
                                            paddingTop: 14,
                                            borderTop: `1px solid ${line}`,
                                        }}
                                    >
                                        <span
                                            style={{
                                                fontFamily: sans,
                                                fontSize: 11,
                                                letterSpacing: "0.13em",
                                                textTransform: "uppercase",
                                                color: ink,
                                            }}
                                        >
                                            From {dev.priceFrom}
                                        </span>
                                        <span
                                            style={{
                                                fontFamily: sans,
                                                fontSize: 10,
                                                letterSpacing: "0.16em",
                                                textTransform: "uppercase",
                                                color: accent,
                                            }}
                                        >
                                            Details →
                                        </span>
                                    </div>
                                </div>
                            </motion.article>
                        )
                    })}
                </AnimatePresence>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {active ? (
                    <motion.div
                        key="modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        onClick={() => setActive(null)}
                        style={{
                            position: "fixed",
                            inset: 0,
                            zIndex: 40,
                            display: "grid",
                            placeItems: "center",
                            padding: 16,
                            background: "rgba(14,12,10,0.66)",
                            backdropFilter: "blur(10px)",
                            WebkitBackdropFilter: "blur(10px)",
                        }}
                    >
                        <motion.div
                            ref={modalRef}
                            role="dialog"
                            aria-modal="true"
                            aria-label={active.name}
                            tabIndex={-1}
                            initial={{ opacity: 0, y: 26, scale: 0.985 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 18 }}
                            transition={{ duration: 0.45, ease: EASE }}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                position: "relative",
                                width: "min(100%, 1080px)",
                                maxHeight: "88vh",
                                overflow: "hidden",
                                display: "grid",
                                gridTemplateColumns: "45% 55%",
                                background: paper,
                                boxShadow: "0 50px 120px -40px rgba(0,0,0,.6)",
                            }}
                            className="sd-dev-modal"
                        >
                            <style>{`
                                @media (max-width: 760px) {
                                    .sd-dev-modal { grid-template-columns: 1fr !important; grid-template-rows: 220px minmax(0,1fr); }
                                }
                            `}</style>
                            <div style={{ position: "relative", background: "#E6DFD3", minHeight: 280 }}>
                                {imageUrl(active.image) ? (
                                    <img
                                        src={imageUrl(active.image)}
                                        alt={active.name}
                                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                                    />
                                ) : null}
                            </div>

                            <div style={{ padding: "clamp(24px, 3.2vw, 46px)", overflowY: "auto", maxHeight: "88vh" }}>
                                <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                                    <span
                                        style={{
                                            padding: "6px 11px 5px",
                                            borderRadius: 999,
                                            background: (STATUS_BG[active.status] ?? STATUS_BG.Available).bg,
                                            color: (STATUS_BG[active.status] ?? STATUS_BG.Available).fg,
                                            fontFamily: sans,
                                            fontSize: 9,
                                            letterSpacing: "0.16em",
                                            textTransform: "uppercase",
                                        }}
                                    >
                                        {active.status}
                                    </span>
                                    <span
                                        style={{
                                            fontFamily: sans,
                                            fontSize: 10,
                                            letterSpacing: "0.2em",
                                            textTransform: "uppercase",
                                            color: muted,
                                        }}
                                    >
                                        {active.location} · {active.year}
                                    </span>
                                </div>

                                <h3
                                    style={{
                                        margin: "16px 0 0",
                                        fontFamily: serif,
                                        fontWeight: 300,
                                        fontSize: "clamp(28px, 3.2vw, 42px)",
                                        lineHeight: 1.04,
                                        letterSpacing: "-0.018em",
                                        color: ink,
                                    }}
                                >
                                    {active.name}
                                </h3>

                                <p
                                    style={{
                                        margin: "14px 0 0",
                                        fontFamily: sans,
                                        fontSize: 14,
                                        lineHeight: 1.8,
                                        color: "#514C42",
                                        maxWidth: "52ch",
                                    }}
                                >
                                    {active.description}
                                </p>

                                <dl
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "1fr 1fr",
                                        gap: "1px 22px",
                                        margin: "24px 0 0",
                                        padding: "16px 0",
                                        borderTop: `1px solid ${line}`,
                                        borderBottom: `1px solid ${line}`,
                                    }}
                                >
                                    {[
                                        ["Completion", active.completion],
                                        ["Typology", active.bedrooms],
                                        ["Internal area", active.size],
                                        ["Architect", active.architect],
                                    ].map(([label, value]) => (
                                        <div key={label} style={{ padding: "8px 0" }}>
                                            <dt
                                                style={{
                                                    fontFamily: sans,
                                                    fontSize: 9,
                                                    letterSpacing: "0.22em",
                                                    textTransform: "uppercase",
                                                    color: muted,
                                                    marginBottom: 4,
                                                }}
                                            >
                                                {label}
                                            </dt>
                                            <dd style={{ margin: 0, fontFamily: sans, fontSize: 13.5, color: ink }}>
                                                {value}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>

                                {active.types && active.types.length ? (
                                    <div style={{ marginTop: 24 }}>
                                        <p
                                            style={{
                                                margin: "0 0 10px",
                                                fontFamily: sans,
                                                fontSize: 9.5,
                                                fontWeight: 600,
                                                letterSpacing: "0.24em",
                                                textTransform: "uppercase",
                                                color: accent,
                                            }}
                                        >
                                            Residence types
                                        </p>
                                        <ul style={{ margin: 0, padding: 0, listStyle: "none", borderTop: `1px solid ${line}` }}>
                                            {active.types.map((t) => (
                                                <li
                                                    key={t.name}
                                                    style={{
                                                        display: "grid",
                                                        gridTemplateColumns: "1fr auto",
                                                        gap: "3px 18px",
                                                        padding: "12px 0",
                                                        borderBottom: `1px solid ${line}`,
                                                    }}
                                                >
                                                    <span style={{ fontFamily: serif, fontSize: 18, color: ink }}>{t.name}</span>
                                                    <span
                                                        style={{
                                                            gridRow: "1 / span 2",
                                                            gridColumn: 2,
                                                            alignSelf: "center",
                                                            fontFamily: sans,
                                                            fontSize: 11.5,
                                                            color: ink,
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {t.price}
                                                    </span>
                                                    <span
                                                        style={{
                                                            fontFamily: sans,
                                                            fontSize: 9.5,
                                                            letterSpacing: "0.1em",
                                                            textTransform: "uppercase",
                                                            color: muted,
                                                        }}
                                                    >
                                                        {t.meta}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null}

                                {active.amenities && active.amenities.length ? (
                                    <div style={{ marginTop: 22, display: "flex", flexWrap: "wrap", gap: 7 }}>
                                        {active.amenities.map((a) => (
                                            <span
                                                key={a}
                                                style={{
                                                    padding: "6px 12px",
                                                    border: `1px solid ${line}`,
                                                    borderRadius: 999,
                                                    fontFamily: sans,
                                                    fontSize: 9.5,
                                                    letterSpacing: "0.1em",
                                                    textTransform: "uppercase",
                                                    color: muted,
                                                }}
                                            >
                                                {a}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}

                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        gap: 16,
                                        flexWrap: "wrap",
                                        marginTop: 28,
                                        paddingTop: 20,
                                        borderTop: `1px solid ${line}`,
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onInquire?.(active.name)
                                            setActive(null)
                                        }}
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 12,
                                            padding: "14px 24px",
                                            borderRadius: 999,
                                            border: `1px solid ${ink}`,
                                            background: ink,
                                            color: paper,
                                            fontFamily: sans,
                                            fontSize: 11,
                                            fontWeight: 500,
                                            letterSpacing: "0.14em",
                                            textTransform: "uppercase",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Request the presentation
                                        <span aria-hidden="true">→</span>
                                    </button>
                                    <span
                                        style={{
                                            fontFamily: sans,
                                            fontSize: 11,
                                            letterSpacing: "0.12em",
                                            textTransform: "uppercase",
                                            color: muted,
                                        }}
                                    >
                                        From {active.priceFrom}
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => setActive(null)}
                                aria-label="Close"
                                style={{
                                    position: "absolute",
                                    top: 14,
                                    right: 14,
                                    width: 42,
                                    height: 42,
                                    display: "grid",
                                    placeItems: "center",
                                    borderRadius: "50%",
                                    border: "none",
                                    background: "rgba(247,244,239,0.92)",
                                    color: ink,
                                    fontSize: 18,
                                    lineHeight: 1,
                                    cursor: "pointer",
                                }}
                            >
                                ×
                            </button>
                        </motion.div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </section>
    )
}

ShadestateDevelopments.defaultProps = {
    eyebrow: "03 · The Portfolio",
    heading: "Current &",
    headingAccent: "coming houses",
    note: "Six addresses, each with its own architect and its own weather. Prices are quoted as guide prices, excluding transfer taxes.",
    developments: DEFAULT_DEVELOPMENTS,
    showFilters: true,
    background: "#F1ECE3",
    paper: "#F7F4EF",
    ink: "#1C1A17",
    muted: "#6B6459",
    accent: "#9A7B56",
    displayFont: "Cormorant Garamond",
    textFont: "Plus Jakarta Sans",
    columns: 2,
}

const developmentControl = {
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
            types: {
                type: ControlType.Array,
                title: "Types",
                control: {
                    type: ControlType.Object,
                    controls: {
                        name: { type: ControlType.String, title: "Name", defaultValue: "Garden Villa" },
                        meta: { type: ControlType.String, title: "Meta", defaultValue: "4 bedrooms · 412 m²" },
                        price: { type: ControlType.String, title: "Price", defaultValue: "€3.85M" },
                    },
                },
                defaultValue: [],
            },
            amenities: {
                type: ControlType.Array,
                title: "Amenities",
                control: { type: ControlType.String, defaultValue: "Pool" },
                defaultValue: [],
            },
        },
    },
    defaultValue: DEFAULT_DEVELOPMENTS,
}

addPropertyControls(ShadestateDevelopments, {
    eyebrow: { type: ControlType.String, title: "Eyebrow", defaultValue: "03 · The Portfolio" },
    heading: { type: ControlType.String, title: "Heading", defaultValue: "Current &" },
    headingAccent: { type: ControlType.String, title: "Italic", defaultValue: "coming houses" },
    note: {
        type: ControlType.String,
        title: "Note",
        displayTextArea: true,
        defaultValue: ShadestateDevelopments.defaultProps.note,
    },
    developments: developmentControl,
    showFilters: { type: ControlType.Boolean, title: "Filters", defaultValue: true },
    columns: {
        type: ControlType.Number,
        title: "Columns",
        min: 1,
        max: 2,
        step: 1,
        defaultValue: 2,
    },
    background: { type: ControlType.Color, title: "Background", defaultValue: "#F1ECE3" },
    paper: { type: ControlType.Color, title: "Paper", defaultValue: "#F7F4EF" },
    ink: { type: ControlType.Color, title: "Ink", defaultValue: "#1C1A17" },
    muted: { type: ControlType.Color, title: "Muted", defaultValue: "#6B6459" },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#9A7B56" },
    displayFont: { type: ControlType.String, title: "Display font", defaultValue: "Cormorant Garamond" },
    textFont: { type: ControlType.String, title: "Text font", defaultValue: "Plus Jakarta Sans" },
    onInquire: { type: ControlType.EventHandler, title: "On inquire" },
})
