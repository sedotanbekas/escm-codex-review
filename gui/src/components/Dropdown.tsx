// Dropdown.tsx — dropdown custom bertema LAMAN UTAMA (navy/biru terang).
// Animasi & perilaku sama dengan UatSelect (fade framer-motion, tutup via
// klik-luar/Esc, pilih via pointerDown + keyboard), hanya beda tema.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface Option {
    value: string;
    label: string;
}

interface Props {
    value: string;
    onChange: (v: string) => void;
    options: Option[];
    placeholder?: string;
    pulse?: boolean; // denyut halus untuk menarik perhatian saat tertutup
}

export function Dropdown({
    value,
    onChange,
    options,
    placeholder = "— pilih —",
    pulse = false,
}: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const suppressToggleRef = useRef(false);
    const suppressTimerRef = useRef<number | null>(null);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    useEffect(
        () => () => {
            if (suppressTimerRef.current)
                window.clearTimeout(suppressTimerRef.current);
        },
        [],
    );

    function selectOption(v: string) {
        suppressToggleRef.current = true;
        if (suppressTimerRef.current)
            window.clearTimeout(suppressTimerRef.current);
        suppressTimerRef.current = window.setTimeout(() => {
            suppressToggleRef.current = false;
            suppressTimerRef.current = null;
        }, 220);
        onChange(v);
        setOpen(false);
        buttonRef.current?.blur();
    }

    function toggleOpen() {
        if (suppressToggleRef.current) {
            suppressToggleRef.current = false;
            return;
        }
        setOpen((o) => !o);
    }

    const selected = options.find((o) => o.value === value);

    return (
        <div
            className={`dd${open ? " is-open" : ""}${pulse && !open ? " dd--pulse" : ""}`}
            ref={ref}
        >
            <button
                ref={buttonRef}
                type="button"
                className={`dd__btn${selected ? "" : " is-placeholder"}`}
                onClick={toggleOpen}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span>{selected ? selected.label : placeholder}</span>
                <span className="dd__chev" aria-hidden>
                    ▾
                </span>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.ul
                        className="dd__panel"
                        role="listbox"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.14, ease: "easeOut" }}
                    >
                        {options.map((o) => (
                            <li
                                key={o.value}
                                role="option"
                                aria-selected={o.value === value}
                                tabIndex={0}
                                className={`dd__opt${o.value === value ? " is-sel" : ""}`}
                                onPointerDown={(e) => {
                                    e.preventDefault();
                                    selectOption(o.value);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        selectOption(o.value);
                                    }
                                }}
                            >
                                {o.label}
                            </li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}
