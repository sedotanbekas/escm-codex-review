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
import { InfoHint } from "./InfoHint";

const SEV_LABEL: Record<Severity, string> = {
    blocker: "BLOCKER",
    critical: "CRITICAL",
    major: "MAJOR",
    minor: "MINOR",
    info: "INFO",
};

// Nama tingkat keparahan dalam bahasa awam (untuk daftar breakdown).
const SEV_ID: Record<Severity, string> = {
    blocker: "Sangat serius (blocker)",
    critical: "Kritis",
    major: "Berat",
    minor: "Ringan",
    info: "Info",
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
            <SectionTitle sub="Penilaian keseluruhan & saran singkat dari AI.">
                Ringkasan
            </SectionTitle>
            <p className="sec__p">
                Tingkat risiko keseluruhan:{" "}
                <RiskBadge risk={exec.overallRisk} />{" "}
                <InfoHint text="Seberapa serius temuan paling berat — dari Info (ringan) sampai Blocker (sangat serius/menghambat)." />
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
            <SectionTitle sub="Jumlah temuan di tiap tingkat, dari paling ringan (info) ke paling serius (blocker).">
                Tingkat keparahan temuan
            </SectionTitle>
            <ul className="sevlist">
                {rows.map(([k, v]) => (
                    <li key={k}>
                        <span className={`dot dot--${k}`} />
                        {SEV_ID[k]}: <b>{v}</b>
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
            <SectionTitle sub="Seberapa banyak teks yang diproses AI & perkiraan biayanya. Mode “hasil tersimpan” = 0.">
                Pemakaian &amp; biaya AI
            </SectionTitle>
            <p className="sec__p">
                Model AI: {usage.model}
                {usage.api ? ` (${usage.api})` : ""}
            </p>
            <p className="sec__p">Jumlah panggilan ke AI: {usage.calls}</p>
            <p className="sec__p">
                Token{" "}
                <InfoHint text="Satuan potongan teks yang diproses AI — dasar perhitungan biaya." />
                : masuk={usage.prompt_tokens}, keluar=
                {usage.completion_tokens}, total={usage.total_tokens}
            </p>
            <p className="sec__p">
                Perkiraan biaya:{" "}
                {ec
                    ? `${ec.currency} ${ec.amount.toFixed(4)}`
                    : "belum dihitung (harga belum diisi)"}
            </p>
        </section>
    );
}

function TopFindings({ items }: { items: ReportData["topFindings"] }) {
    return (
        <section className="sec">
            <SectionTitle sub="Pelanggaran yang ditemukan AI, beserta saran perbaikannya.">
                Temuan utama
            </SectionTitle>
            {items.length === 0 ? (
                <p className="sec__p">Tidak ada temuan.</p>
            ) : (
                <div className="tf-wrap">
                    <table className="tf">
                        <thead>
                            <tr>
                                <th>Keparahan</th>
                                <th>Aturan</th>
                                <th>Sumber</th>
                                <th>Masalah</th>
                                <th>Saran perbaikan</th>
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

function Rulebook({
    rb,
    onOpen,
}: {
    rb: ReportData["rulebook"];
    onOpen: () => void;
}) {
    return (
        <section className="sec">
            <SectionTitle sub="Berapa banyak aturan tim yang tersentuh oleh temuan ini.">
                Kepatuhan terhadap aturan{" "}
                <InfoHint text="“Aturan tim” = daftar konvensi internal WISE/ESCM yang harus dipatuhi developer. Angka ini menunjukkan berapa aturan yang dilanggar pada contoh ini." />
            </SectionTitle>
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
            <button className="btn btn--ghost btn--sm" onClick={onOpen}>
                📋 Lihat semua aturan tim (konvensi WISE/ESCM)
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
            <p className="mr__caption">
                Laporan otomatis dari AI — meniru komentar yang muncul di sistem
                kode tim (GitLab).
            </p>

            <div className="mr__meta">
                <div>
                    Proyek:{" "}
                    <span className="mono">najib221doank/escm-web-laravel</span>
                </div>
                <div>
                    Contoh: <span className="mono">{dataset || "—"}</span>
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
