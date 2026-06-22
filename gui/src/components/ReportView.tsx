// ReportView.tsx — render "Codex Review Summary" bergaya GitLab dari satu run.
// Komposisi (produk murni, tanpa metrik evaluasi): Executive · Severity · Usage
// & cost · Top findings · Component overview (CTDL vs WIKA) · Rulebook compliance.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type {
    EvalResponse,
    ReportData,
    Severity,
    RulebookEntry,
} from "../types";
import { getRulebook } from "../api";
import { useCountUp, prefersReducedMotion } from "../lib/useCountUp";
import { RulebookModal } from "./RulebookModal";

const SEV_LABEL: Record<Severity, string> = {
    blocker: "BLOCKER",
    critical: "CRITICAL",
    major: "MAJOR",
    minor: "MINOR",
    info: "INFO",
};

function RiskBadge({ risk, sm }: { risk: Severity; sm?: boolean }) {
    return (
        <span className={`risk risk--${risk}${sm ? " risk--sm" : ""}`}>
            {SEV_LABEL[risk]}
        </span>
    );
}

function SectionTitle({ children }: { children: ReactNode }) {
    return <h2 className="sec__h">{children}</h2>;
}

// Pill rule id berwarna sesuai domain (CTDL biru, WIKA ungu).
function RulePill({ id }: { id: string }) {
    const u = id.toUpperCase();
    const fam = u.startsWith("WIKA")
        ? "wika"
        : u.startsWith("CTDL")
          ? "ctdl"
          : "other";
    return <span className={`rule rule--${fam}`}>{id}</span>;
}

function Executive({ exec }: { exec: ReportData["executive"] }) {
    return (
        <section className="sec">
            <SectionTitle>Executive summary</SectionTitle>
            <p className="sec__p">
                Overall risk: <RiskBadge risk={exec.overallRisk} />
            </p>
            <p className="sec__p">{exec.guidance}</p>
        </section>
    );
}

function SeverityBreakdown({ sev }: { sev: ReportData["severity"] }) {
    const rows: [Severity, number][] = [
        ["blocker", sev.blocker],
        ["critical", sev.critical],
        ["major", sev.major],
        ["minor", sev.minor],
        ["info", sev.info],
    ];
    return (
        <section className="sec">
            <SectionTitle>Severity breakdown</SectionTitle>
            <ul className="sevlist">
                {rows.map(([k, v]) => (
                    <li key={k}>
                        <span className={`dot dot--${k}`} />
                        {k}: <b>{v}</b>
                    </li>
                ))}
            </ul>
        </section>
    );
}

function UsageCost({ usage }: { usage: ReportData["usage"] }) {
    const ec = usage.estimatedCost;
    return (
        <section className="sec">
            <SectionTitle>Usage and cost</SectionTitle>
            <p className="sec__p">
                Model: {usage.model}
                {usage.api ? ` (${usage.api})` : ""}
            </p>
            <p className="sec__p">Calls: {usage.calls}</p>
            <p className="sec__p">
                Tokens: prompt={usage.prompt_tokens}, completion=
                {usage.completion_tokens}, total={usage.total_tokens}
            </p>
            <p className="sec__p">
                Estimated cost:{" "}
                {ec
                    ? `${ec.currency} ${ec.amount.toFixed(4)} (in=${ec.inPer1M}/1M, out=${ec.outPer1M}/1M)`
                    : "harga belum diset (CODEX_PRICE_*_PER_1M)"}
            </p>
        </section>
    );
}

function TopFindings({ items }: { items: ReportData["topFindings"] }) {
    return (
        <section className="sec">
            <SectionTitle>Top findings</SectionTitle>
            {items.length === 0 ? (
                <p className="sec__p">Tidak ada temuan.</p>
            ) : (
                <div className="tf-wrap">
                    <table className="tf">
                        <thead>
                            <tr>
                                <th>Sev</th>
                                <th>Aturan</th>
                                <th>Sumber</th>
                                <th>Check</th>
                                <th>Remediation</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((f, i) => (
                                <tr key={i}>
                                    <td>
                                        <RiskBadge risk={f.severity} sm />
                                    </td>
                                    <td>
                                        <RulePill id={f.ruleId} />
                                    </td>
                                    <td className="tf__src">
                                        {f.source ?? "—"}
                                    </td>
                                    <td>{f.descr}</td>
                                    <td className="tf__rem">
                                        {f.recommendation}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function DomBar({
    label,
    n,
    pct,
    fam,
}: {
    label: string;
    n: number;
    pct: number;
    fam: string;
}) {
    const count = useCountUp(n, 0);
    const [w, setW] = useState(prefersReducedMotion() ? pct : 0);
    useEffect(() => {
        if (prefersReducedMotion()) {
            setW(pct);
            return;
        }
        const id = requestAnimationFrame(() => setW(pct));
        return () => cancelAnimationFrame(id);
    }, [pct]);
    return (
        <div className="dombar">
            <div className="dombar__top">
                <span>{label}</span>
                <b>{count}</b>
            </div>
            <div className="dombar__track">
                <div
                    className={`dombar__fill dombar__fill--${fam}`}
                    style={{ width: `${w}%` }}
                />
            </div>
        </div>
    );
}

function ComponentOverview({ dom }: { dom: ReportData["componentByDomain"] }) {
    const total = dom.CTDL + dom.WIKA;
    const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
    return (
        <section className="sec">
            <SectionTitle>Component overview</SectionTitle>
            <div className="dombars">
                <DomBar
                    label="CTDL — teknis/universal"
                    n={dom.CTDL}
                    pct={pct(dom.CTDL)}
                    fam="ctdl"
                />
                <DomBar
                    label="WIKA — khas organisasi (tacit)"
                    n={dom.WIKA}
                    pct={pct(dom.WIKA)}
                    fam="wika"
                />
            </div>
        </section>
    );
}

function Rulebook({
    rb,
    onOpen,
}: {
    rb: ReportData["rulebook"];
    onOpen: () => void;
}) {
    return (
        <section className="sec">
            <SectionTitle>Rulebook compliance summary</SectionTitle>
            <p className="sec__p">
                Rules triggered:{" "}
                <b>
                    {rb.triggered}/{rb.total}
                </b>
                {rb.pct !== null ? ` (${rb.pct}%)` : ""}
            </p>
            {rb.sampleIds.length > 0 && (
                <p className="sec__p sec__ids">
                    Triggered rule IDs: {rb.sampleIds.join(", ")}
                    {rb.moreCount > 0 ? ` (+${rb.moreCount} lagi)` : ""}
                </p>
            )}
            <button className="btn btn--ghost btn--sm" onClick={onOpen}>
                📋 Lihat rulebook lengkap (konvensi WISE/ESCM)
            </button>
        </section>
    );
}

export function ReportView({ data }: { data: EvalResponse }) {
    const r = data.report;
    const [rbOpen, setRbOpen] = useState(false);
    const [rbData, setRbData] = useState<RulebookEntry[] | null>(null);

    function openRulebook() {
        setRbOpen(true);
        if (!rbData) getRulebook().then(setRbData).catch(() => setRbData([]));
    }

    const sourceLabel =
        data.source === "live"
            ? "live"
            : data.source === "recorded"
              ? "rekaman"
              : "riwayat";
    const dataset = data.datasets?.map((d) => d.exp).join(" + ");
    const ec = r.usage.estimatedCost;

    return (
        <>
        <article className="mr">
            <header className="mr__head">
                <div className="mr__avatar" aria-hidden="true">
                    C
                </div>
                <div className="mr__who">
                    <span className="mr__author">codex</span>{" "}
                    <span className="mr__handle">@project_61_bot</span>{" "}
                    <span className="mr__time">· {data.timestamp_display}</span>
                </div>
                <span className={`mr__src mr__src--${data.source}`}>
                    {sourceLabel}
                </span>
                <span className="mr__badge">Maintainer</span>
            </header>

            <h1 className="mr__title">Codex Review Summary</h1>

            <div className="mr__meta">
                <div>
                    Project:{" "}
                    <span className="mono">najib221doank/escm-web-laravel</span>
                </div>
                <div>
                    Dataset: <span className="mono">{dataset || "—"}</span>
                </div>
                <div>
                    Model: <span className="mono">{r.usage.model}</span>
                </div>
                <div className="mr__usageline">
                    Usage: calls={r.usage.calls}, tokens(total)=
                    {r.usage.total_tokens}
                    {ec
                        ? ` → est. cost: ${ec.currency} ${ec.amount.toFixed(4)}`
                        : ""}
                </div>
            </div>

            <div className="mr__body">
                <Executive exec={r.executive} />
                <SeverityBreakdown sev={r.severity} />
                <UsageCost usage={r.usage} />
                <TopFindings items={r.topFindings} />
                <ComponentOverview dom={r.componentByDomain} />
                <Rulebook rb={r.rulebook} onOpen={openRulebook} />
            </div>
        </article>
        {rbOpen && (
            <RulebookModal
                entries={rbData}
                onClose={() => setRbOpen(false)}
            />
        )}
        </>
    );
}
