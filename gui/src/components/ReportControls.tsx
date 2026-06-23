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
}

const DATASETS = [{ id: "thesis", label: "2 patch skripsi (EXP-01 + EXP-02)" }];

export function ReportControls({
    health,
    running,
    onRun,
    onRescan,
    notice,
}: Props) {
    const keyOk = health?.apiKeyConfigured ?? false;
    return (
        <div className="controls">
            <div className="controls__left">
                <label className="controls__lbl" htmlFor="ds">
                    Dataset seeded
                </label>
                <select id="ds" className="select" defaultValue="thesis">
                    {DATASETS.map((d) => (
                        <option key={d.id} value={d.id}>
                            {d.label}
                        </option>
                    ))}
                </select>
                <span className="ctl-runwrap">
                    <button
                        className="btn btn--primary"
                        onClick={onRun}
                        disabled={running}
                    >
                        Jalankan
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
                    disabled={running || !keyOk}
                    title={
                        keyOk
                            ? "Memanggil AI sungguhan (memakai token & internet)"
                            : "Isi OPENAI_API_KEY di .codex-review/.env untuk mengaktifkan"
                    }
                >
                    {running ? "Memindai…" : "↻ Scan ulang (live)"}
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
