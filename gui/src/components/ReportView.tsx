// ReportView.tsx — render "Codex Review Summary" bergaya GitLab dari satu run.
// Komposisi ringkas: Ringkasan (+ keparahan) · Temuan utama (snippet kode
// terfokus) · Asal temuan (CTDL vs WIKA) · Pemakaian & biaya · Kepatuhan
// (collapsible). Menampilkan seluruh temuan yang lolos guard+dedup.
import { Fragment, useEffect, useState } from "react";
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
import { InfoHint } from "./InfoHint";

const SEV_LABEL: Record<Severity, string> = {
    blocker: "BLOCKER",
    critical: "CRITICAL",
    major: "MAJOR",
    minor: "MINOR",
    info: "INFO",
};

// Label ringkas (untuk chip keparahan di Ringkasan).
const SEV_SHORT: Record<Severity, string> = {
    blocker: "blocker",
    critical: "kritis",
    major: "berat",
    minor: "ringan",
    info: "info",
};

function RiskBadge({ risk, sm }: { risk: Severity; sm?: boolean }) {
    return (
        <span className={`risk risk--${risk}${sm ? " risk--sm" : ""}`}>
            {SEV_LABEL[risk]}
        </span>
    );
}

function SectionTitle({
    children,
    sub,
}: {
    children: ReactNode;
    sub?: ReactNode;
}) {
    return (
        <div className="sec__head">
            <h2 className="sec__h">{children}</h2>
            {sub && <p className="sec__sub">{sub}</p>}
        </div>
    );
}

// Pill rule id berwarna sesuai domain (CTDL biru, WIKA ungu).
function RulePill({ id }: { id: string }) {
    const u = id.toUpperCase();
    const fam = u.startsWith("WIKA") ? "wika" : "ctdl";
    return <span className={`rule rule--${fam}`}>{id}</span>;
}

// Ringkasan: risiko keseluruhan + penjelasan dasarnya + chip keparahan ringkas.
function Executive({
    exec,
    sev,
}: {
    exec: ReportData["executive"];
    sev: ReportData["severity"];
}) {
    const chips: [Severity, number][] = [
        ["blocker", sev.blocker],
        ["critical", sev.critical],
        ["major", sev.major],
        ["minor", sev.minor],
        ["info", sev.info],
    ];
    return (
        <section className="sec" id="nav-ringkasan" data-navlabel="Ringkasan">
            <SectionTitle sub="Penilaian keseluruhan & saran singkat dari AI.">
                Ringkasan
            </SectionTitle>
            <p className="sec__p">
                Tingkat risiko keseluruhan:{" "}
                <RiskBadge risk={exec.overallRisk} />{" "}
                <InfoHint text="Diambil dari temuan TERPARAH (severity tertinggi) — standar industri (GitLab/SonarQube). Jadi 1 temuan kritis → risiko kritis, walau temuan lain ringan. Lihat rincian per tingkat di bawah." />
            </p>
            <div className="sevchips">
                {chips.map(([k, v]) => (
                    <span
                        key={k}
                        className={`sevchip${v === 0 ? " sevchip--zero" : ""}`}
                    >
                        <span className={`dot dot--${k}`} />
                        {v} {SEV_SHORT[k]}
                    </span>
                ))}
            </div>
            <p className="sec__p sec__p--muted">{exec.guidance}</p>
        </section>
    );
}

// Pemakaian & biaya AI — ringkas (chip sebaris).
function UsageCost({ usage }: { usage: ReportData["usage"] }) {
    const ec = usage.estimatedCost;
    return (
        <section className="sec" id="nav-biaya" data-navlabel="Pemakaian & biaya">
            <SectionTitle sub="Banyaknya teks yang diproses AI pada scan ini & perkiraan biayanya.">
                Pemakaian &amp; biaya AI
            </SectionTitle>
            <div className="usage-chips">
                <span className="uchip">🤖 {usage.model}</span>
                <span className="uchip">{usage.calls} panggilan</span>
                <span className="uchip">
                    {usage.total_tokens.toLocaleString("id-ID")} token{" "}
                    <InfoHint text="Token = satuan potongan teks yang diproses AI; dasar perhitungan biaya." />
                </span>
                <span className="uchip">
                    {ec
                        ? `~${ec.currency} ${ec.amount.toFixed(4)}`
                        : "biaya: —"}
                </span>
            </div>
        </section>
    );
}

// Satu snippet kode terfokus (jendela di sekitar baris yang dimaksud AI).
function Snippet({
    f,
}: {
    f: ReportData["topFindings"][number];
}) {
    const lines = f.snippet || [];
    return (
        <div className="tf-code">
            <div className="tf-code__head">
                <span className="tf-code__path">
                    {f.path}
                    {f.line ? `:${f.line}` : ""}
                </span>
                {f.source && <span className="tf-code__exp">{f.source}</span>}
            </div>
            <div className="tf-code__pre">
                {lines.map((ln, k) => (
                    <div
                        key={k}
                        className={`cl cl--${ln.type}${ln.target ? " cl--target" : ""}`}
                    >
                        <span className="cl__no">{ln.n ?? ""}</span>
                        <span className="cl__sign">
                            {ln.type === "add"
                                ? "+"
                                : ln.type === "del"
                                  ? "-"
                                  : " "}
                        </span>
                        <span className="cl__txt">{ln.text || " "}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TopFindings({
    items,
    onOpenRulebook,
}: {
    items: ReportData["topFindings"];
    onOpenRulebook: () => void;
}) {
    const [open, setOpen] = useState<number | null>(null);

    return (
        <section className="sec" id="nav-temuan" data-navlabel="Temuan utama">
            <div className="sec__headrow">
                <SectionTitle sub="Pelanggaran yang ditemukan AI + saran perbaikan. Klik baris untuk melihat kode yang dimaksud.">
                    Temuan utama
                </SectionTitle>
                <button
                    className="btn btn--ghost btn--sm"
                    onClick={onOpenRulebook}
                >
                    📋 Lihat semua aturan tim
                </button>
            </div>
            {items.length === 0 ? (
                <p className="sec__p">Tidak ada temuan.</p>
            ) : (
                <div className="tf-wrap">
                    <table className="tf">
                        <thead>
                            <tr>
                                <th aria-label="lihat kode" />
                                <th>Keparahan</th>
                                <th>Aturan</th>
                                <th>Sumber</th>
                                <th>Masalah</th>
                                <th>Saran perbaikan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((f, i) => {
                                const hasCode = Boolean(
                                    f.snippet && f.snippet.length,
                                );
                                const isOpen = open === i;
                                return (
                                    <Fragment key={i}>
                                        <tr
                                            className={`tf__row${hasCode ? " tf__row--click" : ""}${isOpen ? " is-open" : ""}`}
                                            onClick={
                                                hasCode
                                                    ? () =>
                                                          setOpen(
                                                              isOpen ? null : i,
                                                          )
                                                    : undefined
                                            }
                                            // Bisa dibuka via keyboard (Enter/Spasi), bukan hanya klik.
                                            tabIndex={hasCode ? 0 : undefined}
                                            aria-expanded={
                                                hasCode ? isOpen : undefined
                                            }
                                            onKeyDown={
                                                hasCode
                                                    ? (e) => {
                                                          if (
                                                              e.key ===
                                                                  "Enter" ||
                                                              e.key === " "
                                                          ) {
                                                              e.preventDefault();
                                                              setOpen(
                                                                  isOpen
                                                                      ? null
                                                                      : i,
                                                              );
                                                          }
                                                      }
                                                    : undefined
                                            }
                                        >
                                            <td className="tf__exp" aria-hidden>
                                                {hasCode ? (
                                                    <span className="tf__chev">
                                                        ▸
                                                    </span>
                                                ) : (
                                                    ""
                                                )}
                                            </td>
                                            <td>
                                                <RiskBadge
                                                    risk={f.severity}
                                                    sm
                                                />
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
                                        {hasCode && isOpen && (
                                            <tr className="tf__coderow">
                                                <td colSpan={6}>
                                                    <Snippet f={f} />
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
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
        <section className="sec" id="nav-asal" data-navlabel="Asal temuan">
            <SectionTitle sub="Temuan dikelompokkan menurut jenis aturan yang dilanggar.">
                Asal temuan: aturan umum vs khas WIKA{" "}
                <InfoHint text="Aturan umum (CTDL) berlaku di banyak proyek. Aturan khas WIKA hanya diketahui tim internal WIKA — paling sulit dikenali AI." />
            </SectionTitle>
            <div className="dombars">
                <DomBar
                    label="Aturan umum (CTDL)"
                    n={dom.CTDL}
                    pct={pct(dom.CTDL)}
                    fam="ctdl"
                />
                <DomBar
                    label="Aturan khas WIKA"
                    n={dom.WIKA}
                    pct={pct(dom.WIKA)}
                    fam="wika"
                />
            </div>
        </section>
    );
}

// Kepatuhan aturan — opsional, tersembunyi default (collapsible).
function Rulebook({ rb }: { rb: ReportData["rulebook"] }) {
    return (
        <details
            className="sec sec--collapse"
            id="nav-kepatuhan"
            data-navlabel="Kepatuhan aturan"
        >
            <summary className="sec__summary">
                <span className="sec__chev" aria-hidden>
                    ▸
                </span>
                Kepatuhan terhadap aturan — berapa aturan tim yang dilanggar
                (klik untuk lihat)
            </summary>
            <div className="sec__collapsebody">
                <p className="sec__p">
                    Aturan yang terpicu:{" "}
                    <b>
                        {rb.triggered}/{rb.total}
                    </b>
                    {rb.pct !== null ? ` (${rb.pct}%)` : ""}
                </p>
                {rb.sampleIds.length > 0 && (
                    <p className="sec__p sec__ids">
                        Kode aturan terpicu: {rb.sampleIds.join(", ")}
                        {rb.moreCount > 0 ? ` (+${rb.moreCount} lagi)` : ""}
                    </p>
                )}
            </div>
        </details>
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
                        <span className="mr__time">
                            · {data.timestamp_display}
                        </span>
                    </div>
                    <span className={`mr__src mr__src--${data.source}`}>
                        {sourceLabel}
                    </span>
                    <span className="mr__badge">Maintainer</span>
                </header>

                <h1 className="mr__title">Codex Review Summary</h1>
                <p className="mr__caption">
                    Laporan otomatis dari AI — meniru komentar yang muncul di
                    sistem kode tim (GitLab).
                </p>

                <div className="mr__meta">
                    <div>
                        Proyek:{" "}
                        <span className="mono">
                            najib221doank/escm-web-laravel
                        </span>
                    </div>
                    <div>
                        Berkas: <span className="mono">{dataset || "—"}</span>
                    </div>
                    <div>
                        Model: <span className="mono">{r.usage.model}</span>
                    </div>
                </div>

                <div className="mr__body">
                    <Executive exec={r.executive} sev={r.severity} />
                    <TopFindings
                        items={r.topFindings}
                        onOpenRulebook={openRulebook}
                    />
                    <ComponentOverview dom={r.componentByDomain} />
                    <UsageCost usage={r.usage} />
                    <Rulebook rb={r.rulebook} />
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
