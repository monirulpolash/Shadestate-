/**
 * Shadestate · Private Inquiry
 * ---------------------------------------------------------------------------
 * Framer Code Component · React + TypeScript + framer-motion
 *
 * How to use it in Framer
 *   1. Assets → Code → New Code File → "ShadestateInquiry" → paste.
 *   2. Drag it in, width Fill.
 *   3. Set the studio details and the list of destinations (each with its
 *      residences) in the properties panel. The two selects build themselves.
 *
 * Behaviour
 *   • Validates name, email, phone (optional) and viewing date in the browser.
 *   • Nothing is sent anywhere: on submit the panel switches to a confirmation
 *     summary. Connect `onSubmitted` to your own form handler or Framer form.
 *   • Errors are announced with aria-invalid and inline messages.
 *   • Live Lisbon clock in the studio column.
 * ---------------------------------------------------------------------------
 */

import { useEffect, useMemo, useState } from "react"
import type { CSSProperties, ChangeEvent, FormEvent } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { addPropertyControls, ControlType } from "framer"

interface Destination {
    name: string
    residences: string[]
}

interface Props {
    eyebrow: string
    heading: string
    headingAccent: string
    intro: string
    studioAddress: string
    studioEmail: string
    studioPhone: string
    studioHours: string
    destinations: Destination[]
    background: string
    paper: string
    accent: string
    muted: string
    displayFont: string
    textFont: string
    onSubmitted?: (payload: { name: string; email: string; destination: string; residence: string; date: string }) => void
    style?: CSSProperties
}

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1]

const DEFAULT_DESTINATIONS: Destination[] = [
    { name: "General enquiry", residences: [] },
    { name: "Casa da Luz", residences: ["Garden Villa", "Courtyard Villa"] },
    { name: "Alto Príncipe", residences: ["Garden Apartment", "Penthouse Duplex"] },
    { name: "Maré Residences", residences: ["Sea Apartment", "Terrace Apartment"] },
    { name: "Quinta do Vale", residences: ["Farmhouse"] },
    { name: "Miradouro Terrace", residences: ["Roof Penthouse"] },
    { name: "Shadestate House", residences: ["Principal House"] },
]

function useLisbonTime() {
    const [time, setTime] = useState("")
    useEffect(() => {
        const tick = () => {
            try {
                setTime(
                    new Intl.DateTimeFormat("en-GB", {
                        timeZone: "Europe/Lisbon",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                    }).format(new Date())
                )
            } catch (e) {
                setTime("")
            }
        }
        tick()
        const id = window.setInterval(tick, 20000)
        return () => window.clearInterval(id)
    }, [])
    return time
}

/** @framerSupportedLayoutWidth any @framerSupportedLayoutHeight auto */
export default function ShadestateInquiry(props: Props) {
    const {
        eyebrow,
        heading,
        headingAccent,
        intro,
        studioAddress,
        studioEmail,
        studioPhone,
        studioHours,
        destinations,
        background,
        paper,
        accent,
        muted,
        displayFont,
        textFont,
        onSubmitted,
        style,
    } = props

    const list = destinations && destinations.length ? destinations : DEFAULT_DESTINATIONS
    const reduced = useReducedMotion() ?? false
    const time = useLisbonTime()

    const serif = `${displayFont}, "Cormorant Garamond", Georgia, serif`
    const sans = `${textFont}, "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`

    const [values, setValues] = useState({
        name: "",
        email: "",
        phone: "",
        date: "",
        destination: list[0]?.name ?? "",
        residence: "",
        message: "",
    })
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [sent, setSent] = useState(false)

    const residences = useMemo(() => {
        const found = list.find((d) => d.name === values.destination)
        return found ? found.residences : []
    }, [list, values.destination])

    const today = useMemo(() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    }, [])

    const set = (key: keyof typeof values) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setValues((v) => ({ ...v, [key]: e.target.value }))
        setErrors((prev) => {
            if (!prev[key]) return prev
            const next = { ...prev }
            delete next[key]
            return next
        })
    }

    const validate = () => {
        const next: Record<string, string> = {}
        if (values.name.trim().length < 2) next.name = "Please tell us your name."
        if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(values.email.trim())) next.email = "Please enter a valid email address."
        if (values.phone.trim() && values.phone.replace(/[^\d]/g, "").length < 7) {
            next.phone = "Please enter a number we can reach you on."
        }
        if (values.date && values.date < today) next.date = "Please choose today or a future date."
        return next
    }

    const submit = (e: FormEvent) => {
        e.preventDefault()
        const found = validate()
        setErrors(found)
        if (Object.keys(found).length) return
        onSubmitted?.({
            name: values.name.trim(),
            email: values.email.trim(),
            destination: values.destination,
            residence: values.residence,
            date: values.date,
        })
        setSent(true)
    }

    const fieldStyle: CSSProperties = {
        width: "100%",
        padding: "11px 2px",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid rgba(247,244,239,0.2)",
        color: paper,
        fontFamily: sans,
        fontSize: 15,
        fontWeight: 300,
        outline: "none",
        colorScheme: "dark",
        boxSizing: "border-box",
    }

    const labelStyle: CSSProperties = {
        display: "block",
        marginBottom: 6,
        fontFamily: sans,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: "rgba(247,244,239,0.55)",
    }

    return (
        <section
            style={{
                ...style,
                width: "100%",
                padding: "clamp(64px, 9vw, 150px) clamp(20px, 4.4vw, 64px)",
                background,
                color: paper,
                boxSizing: "border-box",
            }}
        >
            <style>{`
                .sd-inq { max-width: 1360px; margin: 0 auto; display: grid; grid-template-columns: 1fr; gap: 44px; }
                @media (min-width: 940px) { .sd-inq { grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: clamp(40px, 6vw, 104px); } }
                .sd-inq-row { display: grid; grid-template-columns: 1fr; gap: 22px; }
                @media (min-width: 620px) { .sd-inq-row { grid-template-columns: 1fr 1fr; } }
                .sd-inq input::placeholder, .sd-inq textarea::placeholder { color: rgba(247,244,239,0.28); }
                .sd-inq input:focus, .sd-inq select:focus, .sd-inq textarea:focus { border-bottom-color: ${accent}; }
                .sd-inq select { appearance: none; -webkit-appearance: none; }
                .sd-inq select option { background: #1C1A17; color: #F7F4EF; }
            `}</style>

            <div className="sd-inq">
                {/* Left column */}
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
                            margin: "22px 0 0",
                            maxWidth: "14ch",
                            fontFamily: serif,
                            fontWeight: 300,
                            fontSize: "clamp(36px, 4.4vw, 62px)",
                            lineHeight: 1.02,
                            letterSpacing: "-0.02em",
                            color: paper,
                        }}
                    >
                        {heading} <em style={{ fontStyle: "italic", color: accent }}>{headingAccent}</em>
                    </h2>

                    <p
                        style={{
                            margin: "22px 0 0",
                            maxWidth: "40ch",
                            fontFamily: sans,
                            fontSize: 15,
                            lineHeight: 1.78,
                            color: "rgba(247,244,239,0.68)",
                        }}
                    >
                        {intro}
                    </p>

                    <dl
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "22px 26px",
                            margin: "clamp(32px, 4vw, 50px) 0 0",
                            paddingTop: 26,
                            borderTop: "1px solid rgba(247,244,239,0.16)",
                        }}
                    >
                        {[
                            ["Studio", studioAddress],
                            ["Direct", `${studioEmail}\n${studioPhone}`],
                            ["Hours", studioHours],
                            ["Lisbon", `${time} local time`],
                        ].map(([label, value]) => (
                            <div key={label}>
                                <dt
                                    style={{
                                        margin: 0,
                                        fontFamily: sans,
                                        fontSize: 9.5,
                                        letterSpacing: "0.22em",
                                        textTransform: "uppercase",
                                        color: accent,
                                        marginBottom: 6,
                                    }}
                                >
                                    {label}
                                </dt>
                                <dd
                                    style={{
                                        margin: 0,
                                        fontFamily: sans,
                                        fontSize: 13.5,
                                        lineHeight: 1.7,
                                        color: "rgba(247,244,239,0.72)",
                                        whiteSpace: "pre-line",
                                    }}
                                >
                                    {value}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>

                {/* Form */}
                <div>
                    <AnimatePresence mode="wait">
                        {!sent ? (
                            <motion.form
                                key="form"
                                onSubmit={submit}
                                noValidate
                                initial={false}
                                exit={reduced ? undefined : { opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                style={{
                                    display: "grid",
                                    gap: 22,
                                    padding: "clamp(22px, 3vw, 42px)",
                                    border: "1px solid rgba(247,244,239,0.16)",
                                    background: "rgba(247,244,239,0.02)",
                                }}
                            >
                                <div className="sd-inq-row">
                                    <div>
                                        <label htmlFor="sd-name" style={labelStyle}>
                                            Full name
                                        </label>
                                        <input
                                            id="sd-name"
                                            value={values.name}
                                            onChange={set("name")}
                                            placeholder="Alexandra Reis"
                                            aria-invalid={!!errors.name}
                                            style={{ ...fieldStyle, borderBottomColor: errors.name ? "#C08A74" : undefined }}
                                        />
                                        {errors.name ? (
                                            <p style={{ margin: "7px 0 0", fontFamily: sans, fontSize: 11, color: "#D9A38C" }}>
                                                {errors.name}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div>
                                        <label htmlFor="sd-email" style={labelStyle}>
                                            Email
                                        </label>
                                        <input
                                            id="sd-email"
                                            type="email"
                                            value={values.email}
                                            onChange={set("email")}
                                            placeholder="you@example.com"
                                            aria-invalid={!!errors.email}
                                            style={{ ...fieldStyle, borderBottomColor: errors.email ? "#C08A74" : undefined }}
                                        />
                                        {errors.email ? (
                                            <p style={{ margin: "7px 0 0", fontFamily: sans, fontSize: 11, color: "#D9A38C" }}>
                                                {errors.email}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="sd-inq-row">
                                    <div>
                                        <label htmlFor="sd-phone" style={labelStyle}>
                                            Telephone <span style={{ opacity: 0.6 }}>optional</span>
                                        </label>
                                        <input
                                            id="sd-phone"
                                            type="tel"
                                            value={values.phone}
                                            onChange={set("phone")}
                                            placeholder="+351 900 000 000"
                                            style={{ ...fieldStyle, borderBottomColor: errors.phone ? "#C08A74" : undefined }}
                                        />
                                        {errors.phone ? (
                                            <p style={{ margin: "7px 0 0", fontFamily: sans, fontSize: 11, color: "#D9A38C" }}>
                                                {errors.phone}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div>
                                        <label htmlFor="sd-date" style={labelStyle}>
                                            Preferred viewing
                                        </label>
                                        <input
                                            id="sd-date"
                                            type="date"
                                            min={today}
                                            value={values.date}
                                            onChange={set("date")}
                                            style={{ ...fieldStyle, borderBottomColor: errors.date ? "#C08A74" : undefined }}
                                        />
                                        {errors.date ? (
                                            <p style={{ margin: "7px 0 0", fontFamily: sans, fontSize: 11, color: "#D9A38C" }}>
                                                {errors.date}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="sd-inq-row">
                                    <div>
                                        <label htmlFor="sd-destination" style={labelStyle}>
                                            Development
                                        </label>
                                        <select
                                            id="sd-destination"
                                            value={values.destination}
                                            onChange={(e) => {
                                                setValues((v) => ({ ...v, destination: e.target.value, residence: "" }))
                                            }}
                                            style={fieldStyle}
                                        >
                                            {list.map((d) => (
                                                <option key={d.name} value={d.name}>
                                                    {d.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="sd-residence" style={labelStyle}>
                                            Residence type
                                        </label>
                                        <select
                                            id="sd-residence"
                                            value={values.residence}
                                            onChange={set("residence")}
                                            style={fieldStyle}
                                        >
                                            <option value="">Any remaining residence</option>
                                            {residences.map((r) => (
                                                <option key={r} value={r}>
                                                    {r}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="sd-message" style={labelStyle}>
                                        A note for the studio <span style={{ opacity: 0.6 }}>optional</span>
                                    </label>
                                    <textarea
                                        id="sd-message"
                                        rows={3}
                                        value={values.message}
                                        onChange={set("message")}
                                        placeholder="We are looking for a house near Comporta, ideally with four bedrooms and a garden for our children…"
                                        style={{ ...fieldStyle, resize: "vertical", minHeight: 84, lineHeight: 1.65 }}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    style={{
                                        justifySelf: "start",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 12,
                                        marginTop: 6,
                                        padding: "16px 28px",
                                        borderRadius: 999,
                                        border: `1px solid ${paper}`,
                                        background: paper,
                                        color: "#1C1A17",
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

                                <p style={{ margin: 0, fontFamily: sans, fontSize: 11, color: "rgba(247,244,239,0.4)" }}>
                                    We reply within one business day. Your details are never shared or sold.
                                </p>
                            </motion.form>
                        ) : (
                            <motion.div
                                key="sent"
                                initial={reduced ? false : { opacity: 0, y: 14 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, ease: EASE }}
                                style={{
                                    padding: "clamp(26px, 3vw, 44px)",
                                    border: "1px solid rgba(247,244,239,0.16)",
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "flex-start",
                                    gap: 14,
                                }}
                            >
                                <svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true" style={{ fill: "none", stroke: accent, strokeWidth: 1.1 }}>
                                    <circle cx="24" cy="24" r="23" opacity="0.5" />
                                    <path d="m15 24.5 6.5 6.5L34 18" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>

                                <h3
                                    style={{
                                        margin: 0,
                                        fontFamily: serif,
                                        fontWeight: 300,
                                        fontSize: "clamp(28px, 3vw, 38px)",
                                        lineHeight: 1.1,
                                        color: paper,
                                    }}
                                >
                                    Thank you, {values.name.trim().split(/\s+/)[0] || "and welcome"}.
                                </h3>

                                <p style={{ margin: 0, fontFamily: sans, fontSize: 14, lineHeight: 1.75, color: "rgba(247,244,239,0.68)", maxWidth: "44ch" }}>
                                    Your enquiry is with the studio. A partner will write to you within one business day
                                    with the full presentation.
                                </p>

                                <dl
                                    style={{
                                        width: "100%",
                                        margin: "6px 0 0",
                                        paddingTop: 16,
                                        borderTop: "1px solid rgba(247,244,239,0.14)",
                                        display: "grid",
                                        gap: 8,
                                    }}
                                >
                                    {[
                                        ["Development", values.destination],
                                        ["Residence", values.residence || "Any remaining"],
                                        ["Viewing", values.date || "To be agreed"],
                                    ].map(([label, value]) => (
                                        <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                                            <dt style={{ fontFamily: sans, fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(247,244,239,0.42)" }}>
                                                {label}
                                            </dt>
                                            <dd style={{ margin: 0, fontFamily: sans, fontSize: 12.5, color: "rgba(247,244,239,0.85)" }}>
                                                {value}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>

                                <button
                                    type="button"
                                    onClick={() => setSent(false)}
                                    style={{
                                        marginTop: 8,
                                        padding: 0,
                                        border: "none",
                                        borderBottom: `1px solid ${accent}`,
                                        background: "none",
                                        color: accent,
                                        fontFamily: sans,
                                        fontSize: 11,
                                        letterSpacing: "0.14em",
                                        textTransform: "uppercase",
                                        cursor: "pointer",
                                    }}
                                >
                                    Send another enquiry
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </section>
    )
}

ShadestateInquiry.defaultProps = {
    eyebrow: "07 · Private viewings",
    heading: "Come and stand",
    headingAccent: "in the light.",
    intro:
        "Viewings are by appointment and always with one of the partners. Tell us which house interests you and we will send the full presentation, with plans, specification and availability, before you travel.",
    studioAddress: "Avenida da Liberdade 214\n1250-149 Lisboa, Portugal",
    studioEmail: "inquiries@shadestate.com",
    studioPhone: "+351 21 000 0000",
    studioHours: "Monday – Friday\n09:00 – 18:00 WET",
    destinations: DEFAULT_DESTINATIONS,
    background: "#1C1A17",
    paper: "#F7F4EF",
    accent: "#B99A74",
    muted: "#6B6459",
    displayFont: "Cormorant Garamond",
    textFont: "Plus Jakarta Sans",
}

addPropertyControls(ShadestateInquiry, {
    eyebrow: { type: ControlType.String, title: "Eyebrow", defaultValue: "07 · Private viewings" },
    heading: { type: ControlType.String, title: "Heading", defaultValue: "Come and stand" },
    headingAccent: { type: ControlType.String, title: "Italic", defaultValue: "in the light." },
    intro: {
        type: ControlType.String,
        title: "Intro",
        displayTextArea: true,
        defaultValue: ShadestateInquiry.defaultProps.intro,
    },
    studioAddress: {
        type: ControlType.String,
        title: "Address",
        displayTextArea: true,
        defaultValue: "Avenida da Liberdade 214\n1250-149 Lisboa, Portugal",
    },
    studioEmail: { type: ControlType.String, title: "Email", defaultValue: "inquiries@shadestate.com" },
    studioPhone: { type: ControlType.String, title: "Phone", defaultValue: "+351 21 000 0000" },
    studioHours: {
        type: ControlType.String,
        title: "Hours",
        displayTextArea: true,
        defaultValue: "Monday – Friday\n09:00 – 18:00 WET",
    },
    destinations: {
        type: ControlType.Array,
        title: "Destinations",
        control: {
            type: ControlType.Object,
            controls: {
                name: { type: ControlType.String, title: "Name", defaultValue: "New Development" },
                residences: {
                    type: ControlType.Array,
                    title: "Residences",
                    control: { type: ControlType.String, defaultValue: "Garden Villa" },
                    defaultValue: [],
                },
            },
        },
        defaultValue: DEFAULT_DESTINATIONS,
    },
    background: { type: ControlType.Color, title: "Background", defaultValue: "#1C1A17" },
    paper: { type: ControlType.Color, title: "Paper", defaultValue: "#F7F4EF" },
    accent: { type: ControlType.Color, title: "Accent", defaultValue: "#B99A74" },
    muted: { type: ControlType.Color, title: "Muted", defaultValue: "#6B6459" },
    displayFont: { type: ControlType.String, title: "Display font", defaultValue: "Cormorant Garamond" },
    textFont: { type: ControlType.String, title: "Text font", defaultValue: "Plus Jakarta Sans" },
    onSubmitted: { type: ControlType.EventHandler, title: "On submitted" },
})
