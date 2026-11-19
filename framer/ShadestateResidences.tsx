/**
 * Shadestate — Residences & Plans
 * ---------------------------------------------------------------------------
 * Framer Code Component · React + TypeScript + framer-motion
 *
 * How to use it in Framer
 *   1. Assets → Code → New Code File → "ShadestateResidences" → paste.
 *   2. Drag it in, width Fill.
 *   3. Edit the developments in the properties panel. Each development holds
 *      its own residences (types) with area, terrace, plot, bedrooms,
 *      orientation and price; the schematic plan is drawn from a preset.
 *
 * Behaviour
 *   • Development tabs + residence type pills.
 *   • Animated schematic floor plan (wall lines draw in, labels fade).
 *   • Specification sheet and three comparison bars (interior / terrace / plot).
 *   • "Request this residence" calls onInquire(development, residence).
 *   • Reduced motion skips the plan draw-in.
 * ---------------------------------------------------------------------------
 */

import { useMemo, useState } from "react"
import type { CSSProperties } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

type PlanKey = "villa" | "penthouse" | "apartment" | "house"

interface Residence {
    name: string
    beds: number
    interior: number
    terrace: number
    plot: number
    orientation: string
    degrees: number
    price: string
    meta: string
    plan?: PlanKey
}

interface Development {
    name: string
    location: string
    year: string
    architect: string
    description: string
    residences: Residence[]
}

interface Props {
    eyebrow: string
    heading: string
    headingAccent: string
    note: string
    developments: Development[]
    background: string
    panel: string
    paper: string
    accent: string
    muted: string
    displayFont: string
    textFont: string
    onInquire?: (development: string, residence: string) => void
    style?: CSSProperties
}

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1]

/** Schematic plans in a 340 × 250 view box. */
const PLANS: Record<PlanKey, {
    outer: number[]
    walls: number[][]
    terrace: number[]
    pool?: number[]
    labels: Array<[number, number, string]>
}> = {
    villa: {
        outer: [25, 32, 198, 176],
        walls: [[124, 32, 124, 208], [25, 120, 124, 120], [124, 152, 223, 152]],
        terrace: [238, 32, 78, 176],
        pool: [248, 78, 58, 60],
        labels: [[74, 74, "Living"], [74, 168, "Suite"], [174, 92, "Kitchen"], [174, 184, "Bed"]],
    },
    penthouse: {
        outer: [28, 44, 204, 164],
        walls: [[28, 124, 232, 124], [136, 44, 136, 124]],
        terrace: [248, 44, 68, 164],
        labels: [[82, 84, "Living"], [184, 84, "Study"], [88, 172, "Suite"]],
    },
    apartment: {
        outer: [46, 56, 168, 150],
        walls: [[46, 128, 214, 128], [136, 56, 136, 128]],
        terrace: [226, 56, 88, 150],
        labels: [[90, 92, "Living"], [90, 172, "Suite"], [176, 92, "Bath"]],
    },
    house: {
        outer: [20, 38, 224, 172],
        walls: [[20, 116, 244, 116], [104, 38, 104, 208], [176, 38, 176, 116]],
        terrace: [252, 38, 62, 172],
        pool: [258, 68, 50, 54],
        labels: [[62, 78, "Living"], [140, 78, "Kitchen"], [62, 166, "Suite"], [210, 166, "Guest"]],
    },
}

const DEFAULT_DEVELOPMENTS: Development[] = [
    {
        name: "Casa da Luz",
        location: "Comporta, Portugal",
        year: "2026",
        architect: "Estúdio Almeida",
        description:
            "Eight low houses arranged around a shared olive grove, each opening onto its own walled courtyard and pool.",
        residences: [
            {
                name: "Garden Villa", beds: 4, interior: 412, terrace: 96, plot: 640,
                orientation: "South-west", degrees: 225, price: "€3.85M",
                meta: "4 bedrooms · ground floor · private pool", plan: "villa",
            },
            {
                name: "Courtyard Villa", beds: 5, interior: 486, terrace: 120, plot: 810,
                orientation: "South", degrees: 180, price: "€4.6M",
                meta: "5 bedrooms · walled courtyard · pool", plan: "villa",
            },
        ],
    },
    {
        name: "Alto Príncipe",
        location: "Príncipe Real, Lisbon",
        year: "2027",
        architect: "Nuno Falcão",
        description:
            "A 1920s palace rebuilt from the inside: six apartments around a planted lightwell, with the original stone stair restored.",
        residences: [
            {
                name: "Garden Apartment", beds: 3, interior: 212, terrace: 38, plot: 0,
                orientation: "East", degrees: 90, price: "€2.95M",
                meta: "3 bedrooms · raised ground floor · planted terrace", plan: "apartment",
            },
            {
                name: "Penthouse Duplex", beds: 4, interior: 342, terrace: 74, plot: 0,
                orientation: "West", degrees: 270, price: "€3.4M",
                meta: "4 bedrooms · two levels · roof terrace", plan: "penthouse",
            },
        ],
    },
    {
        name: "Maré Residences",
        location: "Cascais, Portugal",
        year: "2028",
        architect: "Atelier Sousa",
        description:
            "Fourteen apartments stepping down toward the shoreline, each with a planted terrace deep enough to eat on.",
        residences: [
            {
                name: "Sea Apartment", beds: 2, interior: 128, terrace: 24, plot: 0,
                orientation: "South", degrees: 180, price: "€1.45M",
                meta: "2 bedrooms · first floor · sea-facing terrace", plan: "apartment",
            },
            {
                name: "Terrace Apartment", beds: 3, interior: 186, terrace: 48, plot: 0,
                orientation: "South-west", degrees: 225, price: "€1.9M",
                meta: "3 bedrooms · corner · wraparound terrace", plan: "apartment",
            },
        ],
    },
    {
        name: "Miradouro Terrace",
        location: "Graça, Lisbon",
        year: "2025",
        architect: "Nuno Falcão",
        description:
            "Three penthouses above Graça, each with a travertine roof terrace facing the castle and the river.",
        residences: [
            {
                name: "Roof Penthouse", beds: 3, interior: 248, terrace: 96, plot: 0,
                orientation: "South-west", degrees: 225, price: "€5.6M",
                meta: "3 bedrooms · top floor · 96 m² roof terrace", plan: "penthouse",
            },
        ],
    },
    {
        name: "Quinta do Vale",
        location: "Alentejo, Portugal",
        year: "2023",
        architect: "Estúdio Almeida",
        description:
            "Five estate houses on a working cork and olive farm, built from stone quarried on the property itself.",
        residences: [
            {
                name: "Farmhouse", beds: 4, interior: 364, terrace: 0, plot: 1200,
                orientation: "South", degrees: 180, price: "Sold",
                meta: "4 bedrooms · estate garden · private well", plan: "house",
            },
        ],
    },
    {
        name: "Shadestate House",
        location: "Comporta, Portugal",
        year: "2019",
        architect: "Tomás Shadestate",
        description:
            "The house we built for ourselves: a single residence behind timber screens, with a reflecting pool over the archive.",
        residences: [
            {
                name: "Principal House", beds: 6, interior: 612, terrace: 140, plot: 2400,
                orientation: "West", degrees: 270, price: "Sold",
                meta: "6 bedrooms · 2.4 ha plot · guest wing", plan: "house",
            },
        ],
    },
]

function FormatArea(n: number): string {
    return n ? `${n.toLocaleString("en-GB")} m²` : "—"
}

/** @framerSupportedLayoutWidth any @framerSupportedLayoutHeight auto */
export default function ShadestateResidences(props: Props) {
    const {
        eyebrow,
        heading,
        headingAccent,
        note,
        developments,
        background,
        panel,
        paper,
        accent,
        muted,
        displayFont,
        textFont,
        onInquire,
        style,
    } = props

    const list = developments && developments.length ? developments : DEFAULT_DEVELOPMENTS
    const [devIndex, setDevIndex] = useState(0)
    const [typeIndex, setTypeIndex] = useState(0)
    const reduced = useReducedMotion() ?? false

    const serif = `${displayFont}, "Cormorant Garamond", Georgia, serif`
    const sans = `${textFont}, "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`

    const dev = list[Math.min(devIndex, list.length - 1)]
    const residence = dev.residences[Math.min(typeIndex, dev.residences.length - 1)]
    const plan = PLANS[(residence.plan ?? "villa") as PlanKey]

    const maxMetric = useMemo(
        () => Math.max(residence.interior, residence.terrace, residence.plot, 1),
        [residence]
    )

    const specs: Array<[string, string]> = [
        ["Interior", FormatArea(residence.interior)],
        ["Terrace", FormatArea(residence.terrace)],
        ["Bedrooms", `${residence.beds} bedroom${residence.beds === 1 ? "" : "s"}`],
        ["Orientation", residence.orientation],
        ["Architect", dev.architect],
        ["Tenure", "Freehold"],
    ]

    const metrics: Array<[string, number]> = [
        ["Interior", residence.interior],
        ["Terrace", residence.terrace],
        ["Plot", residence.plot],
    ]

    return (
        <section
            style={{
                ...style,
                width: "100%",
                padding: "clamp(64px, 9vw, 140px) clamp(20px, 4.4vw, 64px)",
                background,
                boxSizing: "border-box",
            }}
        >
            <style>{`
                .sd-res-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 40px; flex-wrap: wrap; max-width: 1360px; margin: 0 auto clamp(28px, 4vw, 48px); }
                .sd-res-panel { max-width: 1360px; margin: 0 auto; padding: clamp(20px, 3.2vw, 46px); position: relative; overflow: hidden; }
                .sd-res-body { display: grid; grid-template-columns: 1fr; gap: 32px; padding-top: clamp(24px, 3vw, 44px); }
                @media (min-width: 900px) { .sd-res-body { grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr); gap: clamp(28px, 4.6vw, 72px); } }
                .sd-res-tabs { display: flex; gap: 22px; overflow-x: auto; scrollbar-width: none; padding-bottom: 18px; border-bottom: 1px solid rgba(247,244,239,.14); }
                .sd-res-tabs::-webkit-scrollbar { display: none; }
                .sd-res-tab { background: none; border: 0; border-bottom: 1px solid transparent; padding: 6px 0 8px; cursor: pointer; white-space: nowrap; font-size: 11px; letter-spacing: .13em; text-transform: uppercase; transition: color .35s, border-color .35s; }
                .sd-res-specs { display: grid; grid-template-columns: 1fr 1fr; gap: 1px 24px; border-top: 1px solid rgba(247,244,239,.12); margin-top: 24px; }
                @media (max-width: 520px) { .sd-res-specs { grid-template-columns: 1fr; } }
                .sd-res-metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 26px; }
                @media (max-width: 560px) { .sd-res-metrics { grid-template-columns: 1fr; } }
                .sd-plan { position: relative; aspect-ratio: 34 / 25; border: 1px solid rgba(247,244,239,.1); overflow: hidden;
                    background: repeating-linear-gradient(0deg, rgba(247,244,239,.045) 0 1px, transparent 1px 28px),
                                repeating-linear-gradient(90deg, rgba(247,244,239,.045) 0 1px, transparent 1px 28px), #191712; }
                .sd-plan svg { width: 100%; height: 100%; display: block; }
                .sd-plan .wall { fill: none; stroke: rgba(247,244,239,.72); stroke-width: 2.2; }
                .sd-plan .inner { fill: none; stroke: rgba(247,244,239,.32); stroke-width: 1; }
                .sd-plan .terrace { fill: rgba(154,123,86,.10); stroke: rgba(185,154,116,.6); stroke-width: 1; stroke-dasharray: 5 4; }
                .sd-plan .pool { fill: rgba(154,123,86,.26); stroke: rgba(185,154,116,.6); stroke-width: .8; }
                .sd-plan .label { fill: rgba(247,244,239,.5); font-size: 6.8px; letter-spacing: .16em; text-transform: uppercase; }
                .sd-plan .compass { position: absolute; top: 14px; right: 14px; width: 40px; height: 40px; opacity: .7; }
                .sd-plan .scale { position: absolute; left: 14px; bottom: 12px; display: flex; align-items: center; gap: 8px; font-size: 8px; letter-spacing: .14em; text-transform: uppercase; color: rgba(247,244,239,.34); }
                .sd-plan .scale i { display: block; width: 44px; height: 1px; background: rgba(247,244,239,.28); }
            `}</style>

            {/* Head */}
            <div className="sd-res-head">
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
                            fontSize: "clamp(34px, 4.4vw, 58px)",
                            lineHeight: 1.04,
                            letterSpacing: "-0.018em",
                            color: paper,
                        }}
                    >
                        {heading} <em style={{ fontStyle: "italic", color: accent }}>{headingAccent}</em>
                    </h2>
                </div>
                <p
                    style={{
                        maxWidth: 330,
                        margin: 0,
                        fontFamily: sans,
                        fontSize: 13.5,
                        lineHeight: 1.78,
                        color: muted,
                    }}
                >
                    {note}
                </p>
            </div>

            {/* Panel */}
            <div className="sd-res-panel" style={{ background: panel }}>
                <div className="sd-res-tabs" role="tablist" aria-label="Development">
                    {list.map((d, i) => {
                        const on = i === devIndex
                        return (
                            <button
                                key={d.name}
                                type="button"
                                role="tab"
                                aria-selected={on}
                                className="sd-res-tab"
                                onClick={() => {
                                    setDevIndex(i)
                                    setTypeIndex(0)
                                }}
                                style={{
                                    color: on ? paper : "rgba(247,244,239,.42)",
                                    borderBottomColor: on ? accent : "transparent",
                                    fontFamily: sans,
                                }}
                            >
                                <span style={{ color: accent, marginRight: 7, fontSize: 9 }}>{String(i + 1).padStart(2, "0")}</span>
                                {d.name}
                            </button>
                        )
                    })}
                </div>

                <div className="sd-res-body">
                    {/* Left: identity, types, specs, CTA */}
                    <div>
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
                            style={{
                                margin: "12px 0 0",
                                fontFamily: serif,
                                fontWeight: 300,
                                fontSize: "clamp(28px, 3.4vw, 44px)",
                                lineHeight: 1.02,
                                letterSpacing: "-0.018em",
                                color: paper,
                            }}
                        >
                            {dev.name}
                        </h3>
                        <p
                            style={{
                                margin: "14px 0 0",
                                maxWidth: "46ch",
                                fontFamily: sans,
                                fontSize: 13.5,
                                lineHeight: 1.8,
                                color: "rgba(247,244,239,.6)",
                            }}
                        >
                            {dev.description}
                        </p>

                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 22 }}>
                            {dev.residences.map((r, i) => {
                                const on = i === typeIndex
                                return (
                                    <button
                                        key={r.name}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => setTypeIndex(i)}
                                        style={{
                                            padding: "9px 15px 8px",
                                            borderRadius: 999,
                                            border: `1px solid ${on ? paper : "rgba(247,244,239,.2)"}`,
                                            background: on ? paper : "transparent",
                                            color: on ? panel : "rgba(247,244,239,.66)",
                                            fontFamily: sans,
                                            fontSize: 10,
                                            letterSpacing: "0.14em",
                                            textTransform: "uppercase",
                                            cursor: "pointer",
                                        }}
                                    >
                                        {r.name}
                                    </button>
                                )
                            })}
                        </div>

                        <AnimatePresence mode="wait">
                            <motion.dl
                                key={`${dev.name}-${residence.name}`}
                                initial={reduced ? false : { opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={reduced ? undefined : { opacity: 0, y: -6 }}
                                transition={{ duration: 0.35, ease: EASE }}
                                className="sd-res-specs"
                            >
                                {specs.map(([label, value]) => (
                                    <div
                                        key={label}
                                        style={{
                                            padding: "12px 0",
                                            borderBottom: "1px solid rgba(247,244,239,.07)",
                                        }}
                                    >
                                        <dt
                                            style={{
                                                margin: 0,
                                                fontFamily: sans,
                                                fontSize: 9,
                                                letterSpacing: "0.22em",
                                                textTransform: "uppercase",
                                                color: "rgba(247,244,239,.38)",
                                                marginBottom: 4,
                                            }}
                                        >
                                            {label}
                                        </dt>
                                        <dd style={{ margin: 0, fontFamily: sans, fontSize: 13.5, color: "rgba(247,244,239,.88)" }}>
                                            {value}
                                        </dd>
                                    </div>
                                ))}
                            </motion.dl>
                        </AnimatePresence>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 18,
                                flexWrap: "wrap",
                                marginTop: 26,
                            }}
                        >
                            <button
                                type="button"
                                onClick={() => onInquire?.(dev.name, residence.name)}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 12,
                                    padding: "15px 26px",
                                    borderRadius: 999,
                                    border: `1px solid ${paper}`,
                                    background: paper,
                                    color: panel,
                                    fontFamily: sans,
                                    fontSize: 11,
                                    fontWeight: 500,
                                    letterSpacing: "0.14em",
                                    textTransform: "uppercase",
                                    cursor: "pointer",
                                }}
                            >
                                Request this residence
                                <span aria-hidden="true">→</span>
                            </button>
                            <span
                                style={{
                                    fontFamily: sans,
                                    fontSize: 11,
                                    letterSpacing: "0.12em",
                                    textTransform: "uppercase",
                                    color: "rgba(247,244,239,.55)",
                                }}
                            >
                                {residence.price} · guide price
                            </span>
                        </div>
                    </div>

                    {/* Right: plan + metrics */}
                    <div>
                        <div className="sd-plan">
                            <svg viewBox="0 0 340 250" role="img" aria-label={`Schematic plan of the ${residence.name}`}>
                                <AnimatePresence mode="wait">
                                    <motion.g
                                        key={`${dev.name}-${residence.name}`}
                                        initial={reduced ? false : { opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={reduced ? undefined : { opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <motion.rect
                                            x={plan.terrace[0]}
                                            y={plan.terrace[1]}
                                            width={plan.terrace[2]}
                                            height={plan.terrace[3]}
                                            className="terrace"
                                            initial={reduced ? false : { pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 1, ease: EASE }}
                                        />
                                        {plan.pool ? (
                                            <motion.rect
                                                x={plan.pool[0]}
                                                y={plan.pool[1]}
                                                width={plan.pool[2]}
                                                height={plan.pool[3]}
                                                className="pool"
                                                initial={reduced ? false : { opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ duration: 0.6, delay: 0.3 }}
                                            />
                                        ) : null}
                                        <motion.rect
                                            x={plan.outer[0]}
                                            y={plan.outer[1]}
                                            width={plan.outer[2]}
                                            height={plan.outer[3]}
                                            className="wall"
                                            initial={reduced ? false : { pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 1.1, ease: EASE }}
                                        />
                                        {plan.walls.map((w, i) => (
                                            <motion.line
                                                key={i}
                                                x1={w[0]}
                                                y1={w[1]}
                                                x2={w[2]}
                                                y2={w[3]}
                                                className="inner"
                                                initial={reduced ? false : { pathLength: 0 }}
                                                animate={{ pathLength: 1 }}
                                                transition={{ duration: 0.9, delay: 0.2 + i * 0.08, ease: EASE }}
                                            />
                                        ))}
                                        {plan.labels.map(([x, y, text], i) => (
                                            <motion.text
                                                key={text + i}
                                                x={x}
                                                y={y}
                                                textAnchor="middle"
                                                className="label"
                                                style={{ fontFamily: sans }}
                                                initial={reduced ? false : { opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                transition={{ duration: 0.5, delay: 0.5 + i * 0.06 }}
                                            >
                                                {text}
                                            </motion.text>
                                        ))}
                                    </motion.g>
                                </AnimatePresence>
                            </svg>

                            <svg className="compass" viewBox="0 0 48 48" aria-hidden="true">
                                <circle cx="24" cy="24" r="21" fill="none" stroke="rgba(247,244,239,.22)" strokeWidth="0.8" />
                                <text x="24" y="6.4" textAnchor="middle" fill="rgba(247,244,239,.5)" style={{ fontFamily: sans, fontSize: 5, letterSpacing: "0.2em" }}>
                                    N
                                </text>
                                <motion.path
                                    d="M24 8 L29 30 L24 26 L19 30 Z"
                                    fill="#B99A74"
                                    animate={{ rotate: residence.degrees }}
                                    transition={{ duration: 0.8, ease: EASE }}
                                    style={{ transformOrigin: "24px 24px" }}
                                />
                            </svg>

                            <span className="scale" style={{ fontFamily: sans }}>
                                <span>0</span>
                                <i />
                                <span>5 m</span>
                            </span>
                        </div>

                        <div
                            style={{
                                display: "flex",
                                alignItems: "baseline",
                                justifyContent: "space-between",
                                gap: 16,
                                flexWrap: "wrap",
                                marginTop: 14,
                            }}
                        >
                            <span style={{ fontFamily: serif, fontSize: 20, color: paper }}>{residence.name}</span>
                            <span
                                style={{
                                    fontFamily: sans,
                                    fontSize: 9.5,
                                    letterSpacing: "0.16em",
                                    textTransform: "uppercase",
                                    color: "rgba(247,244,239,.4)",
                                }}
                            >
                                {residence.meta}
                            </span>
                        </div>

                        <div className="sd-res-metrics">
                            {metrics.map(([label, value]) => (
                                <div key={label}>
                                    <span
                                        style={{
                                            display: "block",
                                            fontFamily: sans,
                                            fontSize: 8.5,
                                            letterSpacing: "0.2em",
                                            textTransform: "uppercase",
                                            color: "rgba(247,244,239,.36)",
                                        }}
                                    >
                                        {label}
                                    </span>
                                    <span
                                        style={{
                                            display: "block",
                                            marginTop: 5,
                                            fontFamily: serif,
                                            fontSize: 20,
                                            color: paper,
                                        }}
                                    >
                                        {FormatArea(value)}
                                    </span>
                                    <span
                                        style={{
                                            display: "block",
                                            height: 1,
                                            marginTop: 10,
                                            background: "rgba(247,244,239,.14)",
                                        }}
                                    >
                                        <motion.span
                                            key={`${label}-${value}`}
                                            initial={reduced ? false : { scaleX: 0 }}
                                            animate={{ scaleX: 1 }}
                                            transition={{ duration: 0.9, ease: EASE }}
                                            style={{
                                                display: "block",
                                                height: "100%",
                                                width: `${Math.max(2, (value / maxMetric) * 100)}%`,
                                                background: "#B99A74",
                                                transformOrigin: "left",
                                            }}
                                        />
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}

ShadestateResidences.defaultProps = {
    eyebrow: "05 — Residences & Plans",
    heading: "Read the",
    headingAccent: "plans.",
    note: "Choose a house, then a residence. Every figure is drawn from the architect's specification sheet — areas are internal, terraces counted separately.",
    developments: DEFAULT_DEVELOPMENTS,
    background: "#F7F4EF",
    panel: "#1C1A17",
    paper: "#F7F4EF",
    accent: "#9A7B56",
    muted: "#6B6459",
    displayFont: "Cormorant Garamond",
    textFont: "Plus Jakarta Sans",
}

addPropertyControls(ShadestateResidences, {
    eyebrow: { type: ControlType.String, title: "Eyebrow", defaultValue: "05 — Residences & Plans" },
    heading: { type: ControlType.String, title: "Heading", defaultValue: "Read the" },
    headingAccent: { type: ControlType.String, title: "Italic", defaultValue: "plans." },
    note: {
        type: ControlType.String,
        title: "Note",
        displayTextArea: true,
        defaultValue: ShadestateResidences.defaultProps.note,
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
                architect: { type: ControlType.String, title: "Architect", defaultValue: "Studio" },
                description: {
                    type: ControlType.String,
                    title: "Description",
                    displayTextArea: true,
                    defaultValue: "A short description.",
                },
                residences: {
                    type: ControlType.Array,
                    title: "Residences",
                    control: {
                        type: ControlType.Object,
                        controls: {
                            name: { type: ControlType.String, title: "Name", defaultValue: "Garden Villa" },
                            beds: { type: ControlType.Number, title: "Beds", min: 1, max: 8, step: 1, defaultValue: 4 },
                            interior: { type: ControlType.Number, title: "Interior m²", min: 0, max: 2000, step: 1, defaultValue: 412 },
                            terrace: { type: ControlType.Number, title: "Terrace m²", min: 0, max: 1000, step: 1, defaultValue: 96 },
                            plot: { type: ControlType.Number, title: "Plot m²", min: 0, max: 10000, step: 10, defaultValue: 640 },
                            orientation: { type: ControlType.String, title: "Orientation", defaultValue: "South-west" },
                            degrees: { type: ControlType.Number, title: "Compass °", min: 0, max: 359, step: 1, defaultValue: 225 },
                            price: { type: ControlType.String, title: "Price", defaultValue: "€3.85M" },
                            meta: { type: ControlType.String, title: "Meta", defaultValue: "4 bedrooms · private pool" },
                            plan: {
                                type: ControlType.Enum,
                                title: "Plan",
                                options: ["villa", "penthouse", "apartment", "house"],
                                optionTitles: ["Villa", "Penthouse", "Apartment", "House"],
                                defaultValue: "villa",
                            },
                        },
                    },
                    defaultValue: [],
                },
            },
        },
        defaultValue: DEFAULT_DEVELOPMENTS,
    },
    background: { type: ControlType.Color, title: "Background", defaultValue: "#F7F4EF" },
    panel: { type: ControlType.Color, title: "Panel", defaultValue: "#1C1A17" },
    paper: { type: ControlType.Color, title: "Paper", defaultValue: "#F7F4EF" },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#9A7B56" },
    muted: { type: ControlType.Color, title: "Muted", defaultValue: "#6B6459" },
    displayFont: { type: ControlType.String, title: "Display font", defaultValue: "Cormorant Garamond" },
    textFont: { type: ControlType.String, title: "Text font", defaultValue: "Plus Jakarta Sans" },
    onInquire: { type: ControlType.EventHandler, title: "On inquire" },
})
