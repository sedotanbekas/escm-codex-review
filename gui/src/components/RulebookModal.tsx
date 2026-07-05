// RulebookModal.tsx — overlay menampilkan rulebook konvensi WISE/ESCM (30 aturan
// inti yang ditegakkan bot). Murni "produk": hanya aturan + contoh, TANPA hasil
// evaluasi (validitas/TP-FN, temuan AI, catatan). Klik baris → contoh lokasi &
// bentuk pelanggaran. Tutup via × , klik backdrop, atau Esc.
import { Fragment, useEffect, useState } from "react";
import type { RulebookEntry } from "../types";

interface Props {
    entries: RulebookEntry[] | null; // null = sedang dimuat
    onClose: () => void;
}

// Netralkan teks dari gaya lembar evaluasi ("Sengaja menaruh…") jadi netral.
function contohPelanggaran(t: string): string {
    return String(t || "").replace(/^Sengaja\s+/i, "");
}

export function RulebookModal({ entries, onClose }: Props) {
    const [openId, setOpenId] = useState<number | null>(null);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="modal" role="dialog" aria-modal="true" onClick={onClose}>
            <div className="modal__box" onClick={(e) => e.stopPropagation()}>
                <div className="modal__head">
                    <div>
                        <h3 className="modal__title">
                            Rulebook konvensi WISE/ESCM
                        </h3>
                        {entries && (
                            <p className="modal__sub">
                                {entries.length} aturan inti yang ditegakkan bot
                                (CTDL + WIKA). Klik baris untuk detail.
                            </p>
                        )}
                    </div>
                    <button
                        className="modal__x"
                        onClick={onClose}
                        aria-label="Tutup"
                    >
                        ×
                    </button>
                </div>

                <div className="modal__scroll">
                    {!entries ? (
                        <p className="modal__loading">Memuat rulebook…</p>
                    ) : (
                        <table className="rb">
                            <thead>
                                <tr>
                                    <th>Rule ID</th>
                                    <th>Aturan</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((e) => {
                                    const isOpen = openId === e.id;
                                    const fam =
                                        e.domain === "WIKA" ? "wika" : "ctdl";
                                    return (
                                        <Fragment key={e.id}>
                                            <tr
                                                className={`rb__row${isOpen ? " is-open" : ""}`}
                                                onClick={() =>
                                                    setOpenId(
                                                        isOpen ? null : e.id,
                                                    )
                                                }
                                                // Bisa dibuka via keyboard (Enter/Spasi).
                                                tabIndex={0}
                                                aria-expanded={isOpen}
                                                onKeyDown={(ev) => {
                                                    if (
                                                        ev.key === "Enter" ||
                                                        ev.key === " "
                                                    ) {
                                                        ev.preventDefault();
                                                        setOpenId(
                                                            isOpen
                                                                ? null
                                                                : e.id,
                                                        );
                                                    }
                                                }}
                                            >
                                                <td>
                                                    <span
                                                        className={`rule rule--${fam}`}
                                                    >
                                                        {e.rule_id}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="rb__aturan">
                                                        <span>
                                                            {e.rule_singkat}
                                                        </span>
                                                        <span
                                                            className="rb__chev"
                                                            aria-hidden
                                                        >
                                                            ▸
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                            {isOpen && (
                                                <tr className="rb__detail">
                                                    <td colSpan={2}>
                                                        <div className="rbd">
                                                            <p>
                                                                <b>
                                                                    Contoh
                                                                    lokasi:
                                                                </b>{" "}
                                                                <span className="mono">
                                                                    {
                                                                        e.lokasi_contoh
                                                                    }
                                                                </span>
                                                            </p>
                                                            <p>
                                                                <b>
                                                                    Contoh
                                                                    pelanggaran:
                                                                </b>{" "}
                                                                {contohPelanggaran(
                                                                    e.pelanggaran,
                                                                )}
                                                            </p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
