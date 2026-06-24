// GlossaryModal.tsx — daftar istilah + arti sederhana untuk audiens non-teknis
// (penguji). Memakai gaya modal yang sama dgn RulebookModal. Tutup via ×,
// klik backdrop, atau Esc.
import { useEffect } from "react";

const TERMS: { term: string; tech?: string; arti: string }[] = [
    {
        term: "Asisten AI / reviewer",
        tech: "GPT-4o-mini",
        arti: "Program kecerdasan buatan yang membaca kode lalu menandai bagian yang melanggar aturan tim — seperti senior yang mengoreksi, tapi otomatis.",
    },
    {
        term: "Contoh kode bermasalah",
        tech: "seeded violations",
        arti: "Kode yang SENGAJA dibuat salah sebagai 'kunci jawaban' untuk menguji seberapa teliti AI menemukan kesalahan.",
    },
    {
        term: "Pelanggaran / temuan",
        tech: "violation / finding",
        arti: "Satu bagian kode yang melanggar aturan tim, beserta saran perbaikannya.",
    },
    {
        term: "Tingkat keparahan",
        tech: "severity",
        arti: "Seberapa serius sebuah temuan: dari Info (ringan) hingga Blocker (sangat serius/menghambat).",
    },
    {
        term: "Aturan umum",
        tech: "CTDL",
        arti: "Aturan teknis yang berlaku umum di banyak proyek (mis. jangan menulis query database secara mentah).",
    },
    {
        term: "Aturan khas WIKA",
        tech: "WIKA-Q",
        arti: "Aturan internal khas WIKA yang tidak tertulis di mana pun — hanya diketahui tim senior. Paling sulit dikenali AI.",
    },
    {
        term: "Akurasi",
        tech: "Precision",
        arti: "Dari semua yang ditandai AI, berapa persen yang memang benar pelanggaran.",
    },
    {
        term: "Cakupan",
        tech: "Recall",
        arti: "Dari semua pelanggaran yang sebenarnya ada, berapa persen yang berhasil ditemukan AI.",
    },
    {
        term: "Hasil tersimpan",
        tech: "recorded",
        arti: "Hasil contoh yang sudah dibekukan — tampil cepat tanpa memanggil AI / biaya.",
    },
    {
        term: "Periksa ulang dengan AI",
        tech: "live scan",
        arti: "Memanggil AI sungguhan saat itu juga (butuh beberapa detik & sedikit biaya 'token').",
    },
    {
        term: "Token",
        arti: "Satuan potongan teks yang diproses AI — dasar perhitungan biaya pemakaian.",
    },
    {
        term: "Hanya memberi saran",
        tech: "advisory-only",
        arti: "Bot hanya memberi komentar/saran, TIDAK mengubah atau menghapus kode.",
    },
];

export function GlossaryModal({ onClose }: { onClose: () => void }) {
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
                        <h3 className="modal__title">Daftar istilah</h3>
                        <p className="modal__sub">
                            Arti singkat istilah di halaman ini, dalam bahasa
                            sehari-hari.
                        </p>
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
                    <dl className="gloss">
                        {TERMS.map((t) => (
                            <div className="gloss__row" key={t.term}>
                                <dt className="gloss__term">
                                    {t.term}
                                    {t.tech && (
                                        <span className="gloss__tech">
                                            {t.tech}
                                        </span>
                                    )}
                                </dt>
                                <dd className="gloss__arti">{t.arti}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </div>
        </div>
    );
}
