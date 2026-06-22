// App.tsx — orkestrasi GUI laporan "Codex Review Summary" (gaya GitLab).
// Alur: pilih dataset → "Jalankan" (tampilkan laporan rekaman, aman) atau
// "Scan ulang (live)" (panggil AI). Riwayat run bisa dimuat ulang.
import { useEffect, useState } from "react";
import type {
    HealthResponse,
    EvalResponse,
    HistorySummary,
    RequestStatus,
} from "./types";
import {
    getHealth,
    getRecordedReport,
    postEvaluate,
    getHistory,
    getHistoryRun,
    ApiHttpError,
    setAccessCode,
    clearAccessCode,
} from "./api";
import { ReportControls } from "./components/ReportControls";
import { ReportView } from "./components/ReportView";
import { RunHistory } from "./components/RunHistory";
import { ScanProgress } from "./components/ScanProgress";

export default function App() {
    const [health, setHealth] = useState<HealthResponse | null>(null);
    const [status, setStatus] = useState<RequestStatus>("idle");
    const [error, setError] = useState<string | null>(null);
    const [current, setCurrent] = useState<EvalResponse | null>(null);
    const [history, setHistory] = useState<HistorySummary[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    // Bedakan jenis loading: "live" (scan AI, pakai bar) vs "load" (muat
    // rekaman/riwayat, instan → banner ringkas).
    const [loadingKind, setLoadingKind] = useState<"live" | "load" | null>(
        null,
    );

    useEffect(() => {
        getHealth().then(setHealth).catch(() => setHealth(null));
        getHistory().then(setHistory).catch(() => setHistory([]));
    }, []);

    // "Jalankan" — tampilkan laporan rekaman (statis, anti-gagal).
    async function showRecorded() {
        setStatus("loading");
        setLoadingKind("load");
        setError(null);
        try {
            const rec = await getRecordedReport();
            if (!rec) {
                setStatus("idle");
                setError(
                    'Belum ada laporan rekaman. Tekan "Scan ulang (live)" untuk membuatnya, lalu jalankan `npm run pin-report` agar tersimpan sebagai default.',
                );
                return;
            }
            setCurrent(rec);
            setActiveId(rec.runId);
            setStatus("success");
        } catch (e) {
            setError(
                e instanceof Error ? e.message : "Gagal memuat laporan rekaman.",
            );
            setStatus("error");
        }
    }

    // "Scan ulang (live)" — panggil AI sungguhan, simpan ke riwayat.
    // Bila server minta passcode (401), minta sekali lalu coba ulang.
    async function runLive(isRetry = false) {
        setStatus("loading");
        setLoadingKind("live");
        setError(null);
        try {
            const res = await postEvaluate();
            setCurrent(res);
            setActiveId(res.runId);
            setStatus("success");
            getHistory().then(setHistory).catch(() => {});
        } catch (e) {
            if (e instanceof ApiHttpError && e.status === 401) {
                if (!isRetry) {
                    const code = window.prompt(
                        "Scan live butuh passcode (by invitation). Masukkan passcode:",
                    );
                    if (code && code.trim()) {
                        setAccessCode(code);
                        return runLive(true);
                    }
                    setError("Scan live dibatalkan — butuh passcode.");
                    setStatus("error");
                    return;
                }
                clearAccessCode();
                setError("Passcode salah. Coba lagi.");
                setStatus("error");
                return;
            }
            setError(e instanceof Error ? e.message : "Kesalahan tak dikenal.");
            setStatus("error");
        }
    }

    async function loadRun(id: string) {
        setStatus("loading");
        setLoadingKind("load");
        setError(null);
        try {
            const run = await getHistoryRun(id);
            setCurrent(run);
            setActiveId(id);
            setStatus("success");
        } catch {
            setError("Gagal memuat run dari riwayat.");
            setStatus("error");
        }
    }

    return (
        <div className="page">
            <div className="page__bar">
                <div className="page__brand">
                    codex<span>//</span>review
                    <em>— reproduksi laporan WISE/ESCM</em>
                </div>
            </div>

            <ReportControls
                health={health}
                running={status === "loading"}
                onRun={showRecorded}
                onRescan={() => runLive()}
            />

            {status === "loading" &&
                (loadingKind === "live" ? (
                    <ScanProgress />
                ) : (
                    <div className="banner banner--load">Memuat laporan…</div>
                ))}
            {error && status !== "loading" && (
                <div className="banner banner--error">{error}</div>
            )}

            {current ? (
                <ReportView data={current} />
            ) : (
                !error &&
                status !== "loading" && (
                    <div className="empty">
                        <p className="empty__lead">
                            Pilih dataset lalu tekan <b>Jalankan</b> untuk
                            menampilkan laporan.
                        </p>
                        <p className="empty__sub">
                            "Scan ulang (live)" memanggil AI sungguhan (perlu
                            API key &amp; token).
                        </p>
                    </div>
                )
            )}

            <RunHistory
                runs={history}
                activeId={activeId}
                onSelect={loadRun}
            />

            <footer className="foot">
                advisory-only · precision-first · GUI independen — mesin sama
                dengan pipeline CI
            </footer>
        </div>
    );
}
