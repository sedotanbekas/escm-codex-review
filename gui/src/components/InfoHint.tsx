// InfoHint.tsx — ikon "(?)" kecil di sebelah istilah teknis. Hover (desktop)
// atau ketuk (mobile) menampilkan penjelasan singkat bahasa awam. Tutup dengan
// klik di luar. Dipakai agar GUI ramah penguji non-teknis tanpa membuang istilah.
import { useEffect, useRef, useState } from "react";

export function InfoHint({ text, label }: { text: string; label?: string }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);

    return (
        <span className={`hint${open ? " hint--open" : ""}`} ref={ref}>
            <button
                type="button"
                className="hint__btn"
                aria-label={label || "Penjelasan istilah"}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                ?
            </button>
            <span className="hint__pop" role="tooltip">
                {text}
            </span>
        </span>
    );
}
