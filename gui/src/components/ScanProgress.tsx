// ScanProgress.tsx — indikator scan AI live. Saat `progress` (0..1) diberikan,
// bar bersifat DETERMINATE: lebar isian = progres NYATA dari server (lihat
// /api/evaluate/stream), bergerak mulus via transition CSS. Label tahap berasal
// dari milestone nyata (mis. "Memeriksa EXP-01 (3/8 potongan)…") dan berganti
// dengan crossfade. Bar full-bleed; saat `exiting` true ia menyusut ke tengah
// & memudar sebelum hasil ditampilkan oleh App.
import { useEffect, useRef, useState } from "react";

export function ScanProgress({
    exiting = false,
    progress,
    label,
}: {
    exiting?: boolean;
    progress?: number;
    label?: string;
}) {
    const [secs, setSecs] = useState(0);
    // Teks lama yang "keluar" (naik + memudar) saat label berganti.
    const [leaving, setLeaving] = useState<{ text: string; key: number } | null>(
        null,
    );
    const prevLabel = useRef("");

    useEffect(() => {
        const t0 = Date.now();
        const tick = setInterval(
            () => setSecs(Math.floor((Date.now() - t0) / 1000)),
            250,
        );
        return () => clearInterval(tick);
    }, []);

    const current = label || "Menyiapkan…";

    useEffect(() => {
        if (prevLabel.current && prevLabel.current !== current) {
            setLeaving({ text: prevLabel.current, key: Date.now() });
        }
        prevLabel.current = current;
    }, [current]);

    useEffect(() => {
        if (!leaving) return;
        const t = setTimeout(() => setLeaving(null), 650);
        return () => clearTimeout(t);
    }, [leaving]);

    const determinate = typeof progress === "number";
    const pct = Math.max(0, Math.min(100, Math.round((progress ?? 0) * 100)));

    return (
        <div
            className={`scan${exiting ? " scan--out" : ""}`}
            role="status"
            aria-live="polite"
        >
            <div
                className={`scan__bar${determinate ? " scan__bar--det" : ""}`}
            >
                {determinate ? (
                    <div
                        className="scan__progress"
                        style={{ width: `${pct}%` }}
                    />
                ) : (
                    <div className="scan__fill" />
                )}
            </div>
            <div className="scan__card">
                <div className="scan__row">
                    <div className="scan__stagewrap">
                        {leaving && (
                            <span
                                key={leaving.key}
                                className="scan__stage scan__stage--out"
                            >
                                {leaving.text}
                            </span>
                        )}
                        <span
                            key={current}
                            className="scan__stage scan__stage--in"
                        >
                            {current}
                        </span>
                    </div>
                    <span className="scan__timer">
                        {determinate ? `${pct}% · ${secs} dtk` : `${secs} dtk`}
                    </span>
                </div>
            </div>
        </div>
    );
}
