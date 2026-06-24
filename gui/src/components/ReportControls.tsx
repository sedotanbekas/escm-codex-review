// ReportControls.tsx — bar kontrol: pilih dataset + Jalankan (tampilkan laporan
// rekaman, aman) + Scan ulang (live, memakai token) + status backend.
import type { HealthResponse } from "../types";

interface Props {
    health: HealthResponse | null;
    running: boolean;
    onRun: () => void; // tampilkan laporan rekaman (anti-gagal)
    onRescan: () => void; // scan ulang live (memanggil AI)
    // Notifikasi singkat yang muncul TURUN dari bawah tombol "Jalankan"
    // (mis. saat rekaman sudah tampil & "Jalankan" diklik lagi). `key`
    // berubah tiap pemicu agar animasinya selalu mengulang.
    notice?: { msg: string; key: number } | null;
    // Dataset terpilih (null = belum dipilih). Saat null: dropdown placeholder +
    // pulse, tombol nonaktif. Saat terpilih: dropdown berubah jadi chip.
    selectedDataset?: string | null;
    onSelectDataset?: (id: string) => void;
}

const DATASETS = [
    { id: "thesis", label: "2 contoh kode bermasalah (dari skripsi)" },
];

export function ReportControls({
    health,
    running,
    onRun,
    onRescan,
    notice,
    selectedDataset = null,
    onSelectDataset,
}: Props) {
    const keyOk = health?.apiKeyConfigured ?? false;
    const picked = Boolean(selectedDataset);
    const chosen = DATASETS.find((d) => d.id === selectedDataset);
    return (
        <div className="controls">
            <div className="controls__left">
                <label className="controls__lbl" htmlFor="ds">
                    Contoh kode
                </label>
                {picked ? (
                    <span className="ds-chip" title={chosen?.label}>
                        <span className="ds-chip__check" aria-hidden>
                            ✓
                        </span>
                        {chosen?.label ?? "Dataset terpilih"}
                    </span>
                ) : (
                    <select
                        id="ds"
                        className="select select--pulse"
                        defaultValue=""
                        onChange={(e) =>
                            e.target.value && onSelectDataset?.(e.target.value)
                        }
                    >
                        <option value="" disabled>
                            — Pilih contoh kode —
                        </option>
                        {DATASETS.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.label}
                            </option>
                        ))}
                    </select>
                )}
                <span className="ctl-runwrap">
                    <button
                        className="btn btn--primary"
                        onClick={onRun}
                        disabled={running || !picked}
                        title={
                            picked
                                ? "Tampilkan hasil contoh yang sudah tersimpan (cepat, tanpa biaya)"
                                : "Pilih contoh kode dulu"
                        }
                    >
                        Lihat hasil contoh
                    </button>
                    {notice && (
                        <span
                            key={notice.key}
                            className="runnotice"
                            role="status"
                            aria-live="polite"
                        >
                            {notice.msg}
                        </span>
                    )}
                </span>
                <button
                    className="btn btn--ghost"
                    onClick={onRescan}
                    disabled={running || !keyOk || !picked}
                    title={
                        !picked
                            ? "Pilih contoh kode dulu"
                            : keyOk
                              ? "Memanggil AI sungguhan saat ini juga (butuh beberapa detik & sedikit biaya)"
                              : "Isi OPENAI_API_KEY di .env untuk mengaktifkan"
                    }
                >
                    {running ? "AI sedang memeriksa…" : "↻ Periksa ulang dengan AI"}
                </button>
            </div>
            <span
                className={`statuspill ${
                    health ? (keyOk ? "is-up" : "is-warn") : "is-down"
                }`}
            >
                {health
                    ? `${health.model} · ${keyOk ? "key ✓" : "key ✗"} · ${health.rulesLoaded} kontrol`
                    : "backend offline"}
            </span>
        </div>
    );
}
