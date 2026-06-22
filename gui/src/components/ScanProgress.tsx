// ScanProgress.tsx — indikator scan AI live: bar bergerak (indeterminate) +
// penghitung detik berjalan + label tahap yang BERGANTI dengan transisi
// crossfade vertikal (teks baru naik dari bawah & memudar masuk, teks lama
// naik ke atas & memudar keluar — saling tumpang, sedikit overshoot). Loop.
import { useEffect, useRef, useState } from "react";

const STAGES = [
    "Menyiapkan diff seeded (EXP-01 + EXP-02)…",
    "Reviewer AI membaca diff & menandai pelanggaran konvensi…",
    "Memeriksa aturan CTDL (teknis) & WIKA (tacit)…",
    "Menyaring halusinasi (peta file:line) & dedup temuan…",
    "Menghitung Precision / Recall / F1…",
];

export function ScanProgress() {
    const [secs, setSecs] = useState(0);
    const [stage, setStage] = useState(0);
    // Teks lama yang sedang "keluar" (naik + memudar) saat tahap berganti.
    const [exiting, setExiting] = useState<{ idx: number; key: number } | null>(
        null,
    );
    const prevRef = useRef(0);

    useEffect(() => {
        const t0 = Date.now();
        const tick = setInterval(
            () => setSecs(Math.floor((Date.now() - t0) / 1000)),
            250,
        );
        // Loop: berputar terus selama scan berjalan.
        const adv = setInterval(
            () => setStage((s) => (s + 1) % STAGES.length),
            3000,
        );
        return () => {
            clearInterval(tick);
            clearInterval(adv);
        };
    }, []);

    // Saat tahap berganti, tahap sebelumnya menjadi elemen yang keluar.
    useEffect(() => {
        if (prevRef.current !== stage) {
            setExiting({ idx: prevRef.current, key: Date.now() });
            prevRef.current = stage;
        }
    }, [stage]);

    // Bersihkan elemen keluar setelah animasinya selesai.
    useEffect(() => {
        if (!exiting) return;
        const t = setTimeout(() => setExiting(null), 650);
        return () => clearTimeout(t);
    }, [exiting]);

    return (
        <div className="scan" role="status" aria-live="polite">
            <div className="scan__bar">
                <div className="scan__fill" />
            </div>
            <div className="scan__row">
                <div className="scan__stagewrap">
                    {exiting && (
                        <span
                            key={exiting.key}
                            className="scan__stage scan__stage--out"
                        >
                            {STAGES[exiting.idx]}
                        </span>
                    )}
                    <span key={stage} className="scan__stage scan__stage--in">
                        {STAGES[stage]}
                    </span>
                </div>
                <span className="scan__timer">{secs} dtk</span>
            </div>
        </div>
    );
}
