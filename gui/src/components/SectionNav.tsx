// SectionNav.tsx — navigasi per-bagian yang ADAPTIF (mengikuti bagian yang
// sedang ada di halaman). Bagian ditandai lewat atribut `id` + `data-navlabel`.
//
//  - Desktop (>=880px): dot minimalis di kanan-tengah; label muncul saat hover
//    atau saat bagian aktif. Klik → scroll halus ke bagian itu.
//  - Mobile  (<880px) : disembunyikan; diganti tombol mengambang (FAB) yang,
//    saat diketuk, memunculkan overlay daftar bagian (tidak menutupi konten).
//
// BackToTop: tombol "↑" mengambang yang muncul setelah menggulir, untuk kembali
// ke atas tanpa scroll manual.
import { useCallback, useEffect, useState } from "react";

interface NavItem {
    id: string;
    label: string;
}

export function SectionNav({ refreshKey }: { refreshKey: string }) {
    const [items, setItems] = useState<NavItem[]>([]);
    const [active, setActive] = useState<string | null>(null);
    const [open, setOpen] = useState(false);

    // (Re)scan bagian ber-atribut [data-navlabel] tiap konten berubah.
    useEffect(() => {
        const els = Array.from(
            document.querySelectorAll<HTMLElement>("[data-navlabel]"),
        );
        setItems(
            els
                .filter((el) => el.id)
                .map((el) => ({
                    id: el.id,
                    label: el.dataset.navlabel || "",
                })),
        );
    }, [refreshKey]);

    const computeActive = useCallback(() => {
        let best: string | null = null;
        let bestTop = -Infinity;
        for (const it of items) {
            const el = document.getElementById(it.id);
            if (!el) continue;
            const top = el.getBoundingClientRect().top;
            if (top <= 140 && top > bestTop) {
                bestTop = top;
                best = it.id;
            }
        }
        if (!best && items[0]) best = items[0].id;
        setActive(best);
    }, [items]);

    useEffect(() => {
        if (items.length === 0) return;
        let raf = 0;
        const onScroll = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(computeActive);
        };
        computeActive();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, [items, computeActive]);

    const go = (id: string) => {
        document
            .getElementById(id)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        setOpen(false);
    };

    if (items.length < 2) return null;

    return (
        <>
            <nav className="snav" aria-label="Navigasi bagian">
                <ul className="snav__list">
                    {items.map((it) => (
                        <li key={it.id}>
                            <button
                                type="button"
                                className={`snav__item${active === it.id ? " is-active" : ""}`}
                                onClick={() => go(it.id)}
                            >
                                <span className="snav__label">{it.label}</span>
                                <span className="snav__dot" aria-hidden />
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            <button
                type="button"
                className="snav-fab"
                aria-label="Navigasi bagian"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                ☰
            </button>
            {open && (
                <div className="snav-sheet" onClick={() => setOpen(false)}>
                    <div
                        className="snav-sheet__box"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="snav-sheet__head">Lompat ke bagian</div>
                        <ul>
                            {items.map((it) => (
                                <li key={it.id}>
                                    <button
                                        type="button"
                                        className={`snav-sheet__item${active === it.id ? " is-active" : ""}`}
                                        onClick={() => go(it.id)}
                                    >
                                        {it.label}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </>
    );
}

export function BackToTop() {
    const [show, setShow] = useState(false);
    useEffect(() => {
        const onScroll = () => setShow(window.scrollY > 320);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);
    if (!show) return null;
    return (
        <button
            type="button"
            className="backtop"
            aria-label="Kembali ke atas"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
            ↑
        </button>
    );
}
