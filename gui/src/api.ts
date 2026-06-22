// api.ts — Klien HTTP tipis ke backend. Semua akses jaringan terpusat di sini
// agar komponen UI fokus ke tampilan (separation of concerns).
import type {
    HealthResponse,
    EvalResponse,
    HistorySummary,
    RulebookEntry,
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

export async function getHistory(): Promise<HistorySummary[]> {
    const d = await parseJsonSafe<{ runs: HistorySummary[] }>(
        await fetch(`${BASE}/api/history`),
    );
    return d.runs;
}

export async function getHistoryRun(id: string): Promise<EvalResponse> {
    return parseJsonSafe<EvalResponse>(await fetch(`${BASE}/api/history/${id}`));
}

// Rulebook tervalidasi Lead Dev IT WIKA (30 aturan). Tanpa token.
export async function getRulebook(): Promise<RulebookEntry[]> {
    const d = await parseJsonSafe<{ rulebook: RulebookEntry[] }>(
        await fetch(`${BASE}/api/rulebook`),
    );
    return d.rulebook;
}
