// RunHistory.tsx — daftar run lampau (audit), dipaginasi 5 per halaman.
// Navigasi: nomor halaman (dengan ellipsis bila banyak) + Sebelumnya/Berikutnya.
// Klik baris memuat run ke laporan utama.
import { useEffect, useState } from "react";
import type { HistorySummary } from "../types";

const PER_PAGE = 5;

interface Props {
    runs: HistorySummary[];
    activeId: string | null;
    onSelect: (id: string) => void;
}

// Daftar nomor halaman ringkas: 1 … (cur-1) cur (cur+1) … total
function pageItems(total: number, cur: number): (number | "ellipsis")[] {
    const out: (number | "ellipsis")[] = [];
    for (let p = 1; p <= total; p++) {
        if (p === 1 || p === total || (p >= cur - 1 && p <= cur + 1)) {
            out.push(p);
        } else if (out[out.length - 1] !== "ellipsis") {
            out.push("ellipsis");
        }
    }
    return out;
}

export function RunHistory({ runs, activeId, onSelect }: Props) {
    const [page, setPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(runs.length / PER_PAGE));
    const newest = runs[0]?.id;

    // Run baru ditambahkan (newest berubah) → kembali ke halaman 1.
    useEffect(() => {
        setPage(1);
    }, [newest]);

    if (runs.length === 0) {
        return <div className="hist hist--empty">Belum ada run tersimpan.</div>;
    }

    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PER_PAGE;
    const end = Math.min(start + PER_PAGE, runs.length);
    const shown = runs.slice(start, end);

    return (
        <section className="hist">
            <div className="hist__bar">
                <h3 className="hist__title">Riwayat run (audit)</h3>
                <span className="hist__count">
                    Menampilkan {start + 1}–{end} dari {runs.length}
                </span>
            </div>

            <div className="hist__list">
                {shown.map((r) => (
                    <button
                        key={r.id}
                        className={`hist__item${activeId === r.id ? " is-active" : ""}`}
                        onClick={() => onSelect(r.id)}
                        title="Muat run ini (fallback rekaman berstempel waktu)"
                    >
                        <span className="hist__when">{r.timestamp_display}</span>
                        <span className="hist__m">
                            {r.overallRisk && (
                                <span
                                    className={`risk risk--${r.overallRisk} risk--sm`}
                                >
                                    {r.overallRisk.toUpperCase()}
                                </span>
                            )}
                            {typeof r.findingsTotal === "number" && (
                                <span className="hist__n">
                                    {r.findingsTotal} temuan
                                </span>
                            )}
                        </span>
                    </button>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="pager">
                    <button
                        className="pager__btn"
                        disabled={safePage <= 1}
                        onClick={() => setPage(safePage - 1)}
                    >
                        ‹ Sebelumnya
                    </button>
                    <div className="pager__nums">
                        {pageItems(totalPages, safePage).map((it, i) =>
                            it === "ellipsis" ? (
                                <span key={`gap-${i}`} className="pager__gap">
                                    …
                                </span>
                            ) : (
                                <button
                                    key={it}
                                    className={`pager__num${it === safePage ? " is-active" : ""}`}
                                    onClick={() => setPage(it)}
                                >
                                    {it}
                                </button>
                            ),
                        )}
                    </div>
                    <button
                        className="pager__btn"
                        disabled={safePage >= totalPages}
                        onClick={() => setPage(safePage + 1)}
                    >
                        Berikutnya ›
                    </button>
                </div>
            )}
        </section>
    );
}
