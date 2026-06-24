// SeededViewer.tsx — panel kode "seeded violations" (2 patch EXP-01/EXP-02)
// dengan syntax highlighting penuh (Prism: diff + PHP) & font Fira Code.
//
// Dua mode:
//  - "hero"        : tampil besar setelah dataset dipilih (sebelum dijalankan).
//                    Saat `exiting` true, memudar ke atas sebelum hasil muncul.
//  - "collapsible" : seksi tertutup (<details>) di atas hasil, bisa di-expand.
import { useEffect, useRef } from "react";
import type { SeededDataset } from "../types";
import Prism from "prismjs";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-clike";
import "prismjs/components/prism-markup-templating";
import "prismjs/components/prism-php";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-diff";
import "prismjs/plugins/diff-highlight/prism-diff-highlight";
import "prismjs/themes/prism-tomorrow.css";
import "prismjs/plugins/diff-highlight/prism-diff-highlight.css";

const SEEDED_TOTAL = 30; // total seeded violations (ground truth) di kedua patch.

interface Props {
    datasets: SeededDataset[];
    mode: "hero" | "collapsible";
    exiting?: boolean;
}

export function SeededViewer({ datasets, mode, exiting = false }: Props) {
    const ref = useRef<HTMLDivElement>(null);

    // Highlight sekali saat konten siap (konten statis → tidak re-render).
    useEffect(() => {
        if (ref.current) Prism.highlightAllUnder(ref.current);
    }, [datasets]);

    const body = (
        <div className="seeded__body" ref={ref}>
            {datasets.map((ds) => (
                <section className="seeded__file" key={ds.exp}>
                    <header className="seeded__filehead">
                        <span className="seeded__exp">{ds.exp}</span>
                        <code className="seeded__path">{ds.file}</code>
                    </header>
                    <pre className="seeded__pre">
                        <code className="language-diff-php">{ds.content}</code>
                    </pre>
                </section>
            ))}
        </div>
    );

    if (mode === "collapsible") {
        return (
            <details className="seeded seeded--collapse">
                <summary className="seeded__summary">
                    <span className="seeded__chev" aria-hidden>
                        ▸
                    </span>
                    Lihat contoh kode bermasalah ({datasets.length} berkas ·{" "}
                    {SEEDED_TOTAL} kesalahan)
                </summary>
                {body}
            </details>
        );
    }

    return (
        <div className={`seeded seeded--hero${exiting ? " seeded--out" : ""}`}>
            <div className="seeded__herohead">
                <h2 className="seeded__title">
                    Contoh kode yang sengaja dibuat bermasalah
                </h2>
                <p className="seeded__sub">
                    {datasets.length} berkas · {SEEDED_TOTAL} kesalahan sengaja
                    ditanam sebagai <b>“kunci jawaban”</b> untuk menguji
                    ketelitian AI. Tekan <b>“Lihat hasil contoh”</b> atau{" "}
                    <b>“Periksa ulang dengan AI”</b>.
                </p>
            </div>
            {body}
        </div>
    );
}
