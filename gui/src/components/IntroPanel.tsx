// IntroPanel.tsx — panel sambutan di paling atas: menjelaskan "apa ini" dalam
// 1-2 kalimat + 3 langkah cara pakai, ditujukan untuk audiens non-teknis
// (penguji). Tombol "Daftar istilah" membuka glosarium.
export function IntroPanel({ onOpenGlossary }: { onOpenGlossary: () => void }) {
    return (
        <section className="intro" id="nav-intro" data-navlabel="Apa ini?">
            <div className="intro__head">
                <h2 className="intro__title">Apa ini?</h2>
                <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={onOpenGlossary}
                >
                    📖 Daftar istilah
                </button>
            </div>
            <p className="intro__lead">
                Ini <b>alat peraga (demo)</b> dari sebuah <b>asisten AI</b> yang
                membaca kode program aplikasi <b>WISE/ESCM</b> milik WIKA, lalu
                menandai bagian yang melanggar aturan tim pengembang — mirip
                senior yang mengoreksi pekerjaan, tapi otomatis. AI hanya{" "}
                <b>memberi saran</b>, tidak mengubah kode.
            </p>
            <ol className="intro__steps">
                <li>
                    <span className="intro__num">1</span>
                    <span>
                        <b>Pilih contoh kode</b> di kotak pilihan (saat ini ada 1
                        pilihan).
                    </span>
                </li>
                <li>
                    <span className="intro__num">2</span>
                    <span>
                        Klik <b>“Lihat hasil contoh”</b> (cepat, tanpa biaya)
                        atau <b>“Periksa ulang dengan AI”</b> (memanggil AI
                        sungguhan).
                    </span>
                </li>
                <li>
                    <span className="intro__num">3</span>
                    <span>
                        <b>Baca laporannya</b>: ringkasan, daftar temuan, dan
                        saran perbaikan.
                    </span>
                </li>
            </ol>
        </section>
    );
}
