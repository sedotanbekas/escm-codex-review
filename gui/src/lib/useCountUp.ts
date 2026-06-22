// useCountUp.ts — animasi angka naik 0 → target (easeOutCubic). Menghormati
// prefers-reduced-motion (langsung tampil nilai akhir bila pengguna meminta).
import { useEffect, useRef, useState } from "react";

export function prefersReducedMotion(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

// Mengembalikan string angka terformat (decimals desimal) yang beranimasi.
export function useCountUp(target: number, decimals = 0, durationMs = 900): string {
    const [val, setVal] = useState(prefersReducedMotion() ? target : 0);
    const raf = useRef<number | null>(null);

    useEffect(() => {
        if (prefersReducedMotion()) {
            setVal(target);
            return;
        }
        const t0 = performance.now();
        const step = (now: number) => {
            const p = Math.min((now - t0) / durationMs, 1);
            const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
            setVal(target * eased);
            if (p < 1) raf.current = requestAnimationFrame(step);
        };
        raf.current = requestAnimationFrame(step);
        return () => {
            if (raf.current) cancelAnimationFrame(raf.current);
        };
    }, [target, durationMs]);

    return val.toFixed(decimals);
}
