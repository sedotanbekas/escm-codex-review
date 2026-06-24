// api.ts — Klien HTTP tipis ke backend. Semua akses jaringan terpusat di sini
// agar komponen UI fokus ke tampilan (separation of concerns).
import type {
    HealthResponse,
    EvalResponse,
    HistorySummary,
    RulebookEntry,
    SeededDataset,
    ScanProgress,
    ApiError,
} from "./types";

// Saat dev, Vite mem-proxy /api → backend (lihat vite.config.ts). Saat di-build
// & disajikan server.mjs, path /api juga relatif. Jadi base = "".
const BASE = "";

async function parseJsonSafe<T>(res: Response): Promise<T> {
    const text = await res.text();
    try {
        return JSON.parse(text) as T;
    } catch {
        throw new Error(
            `Respons server bukan JSON valid (status ${res.status}).`,
        );
    }
}

export async function getHealth(): Promise<HealthResponse> {
    return parseJsonSafe<HealthResponse>(await fetch(`${BASE}/api/health`));
}

// Laporan rekaman default (statis, anti-gagal). null bila belum ada rekaman.
export async function getRecordedReport(): Promise<EvalResponse | null> {
    const data = await parseJsonSafe<
        EvalResponse | { ok: true; recorded: null }
    >(await fetch(`${BASE}/api/report/recorded`));
    if ("recorded" in data && data.recorded === null) return null;
    return data as EvalResponse;
}

// Error dengan kode HTTP, agar pemanggil bisa menangani 401 (passcode) / 429.
export class ApiHttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

const ACCESS_CODE_KEY = "codexAccessCode";
export function setAccessCode(code: string) {
    localStorage.setItem(ACCESS_CODE_KEY, code.trim());
}
export function clearAccessCode() {
    localStorage.removeItem(ACCESS_CODE_KEY);
}
function accessHeaders(): Record<string, string> {
    const code = localStorage.getItem(ACCESS_CODE_KEY);
    return code ? { "x-access-code": code } : {};
}

// Evaluasi live: memanggil AI (memakai token). Mengirim passcode bila ada.
export async function postEvaluate(): Promise<EvalResponse> {
    const res = await fetch(`${BASE}/api/evaluate`, {
        method: "POST",
        headers: accessHeaders(),
    });
    if (!res.ok) {
        const err = await parseJsonSafe<ApiError>(res).catch(() => null);
        throw new ApiHttpError(
            res.status,
            err?.error || `Evaluasi gagal (HTTP ${res.status}).`,
        );
    }
    return parseJsonSafe<EvalResponse>(res);
}

// Evaluasi live STREAMING: melapor progres NYATA via onProgress (dibaca dari
// NDJSON), lalu mengembalikan hasil akhir. Mengirim passcode bila ada.
export async function postEvaluateStream(
    onProgress: (p: ScanProgress) => void,
): Promise<EvalResponse> {
    const res = await fetch(`${BASE}/api/evaluate/stream`, {
        method: "POST",
        headers: accessHeaders(),
    });
    if (!res.ok || !res.body) {
        const err = await parseJsonSafe<ApiError>(res).catch(() => null);
        throw new ApiHttpError(
            res.status,
            err?.error || `Evaluasi gagal (HTTP ${res.status}).`,
        );
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let final: EvalResponse | null = null;

    const handleLine = (line: string) => {
        const t = line.trim();
        if (!t) return;
        let msg: { type?: string; pct?: number; label?: string; error?: string };
        try {
            msg = JSON.parse(t);
        } catch {
            return;
        }
        if (msg.type === "progress") {
            onProgress({
                pct: Number(msg.pct) || 0,
                label: String(msg.label || ""),
            });
        } else if (msg.type === "result") {
            final = msg as unknown as EvalResponse;
        } else if (msg.type === "error") {
            throw new Error(msg.error || "Evaluasi gagal.");
        }
    };

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
            handleLine(buf.slice(0, nl));
            buf = buf.slice(nl + 1);
        }
    }
    handleLine(buf); // baris terakhir tanpa newline penutup
    if (!final) throw new Error("Stream selesai tanpa hasil.");
    return final;
}

export async function getHistory(): Promise<HistorySummary[]> {
    const d = await parseJsonSafe<{ runs: HistorySummary[] }>(
        await fetch(`${BASE}/api/history`),
    );
    return d.runs;
}

export async function getHistoryRun(id: string): Promise<EvalResponse> {
    return parseJsonSafe<EvalResponse>(await fetch(`${BASE}/api/history/${id}`));
}

// Isi dataset seeded (kedua patch EXP-01/EXP-02) untuk panel kode. Tanpa token.
export async function getDataset(): Promise<SeededDataset[]> {
    const d = await parseJsonSafe<{ datasets: SeededDataset[] }>(
        await fetch(`${BASE}/api/dataset`),
    );
    return d.datasets;
}

// Rulebook tervalidasi Lead Dev IT WIKA (30 aturan). Tanpa token.
export async function getRulebook(): Promise<RulebookEntry[]> {
    const d = await parseJsonSafe<{ rulebook: RulebookEntry[] }>(
        await fetch(`${BASE}/api/rulebook`),
    );
    return d.rulebook;
}
