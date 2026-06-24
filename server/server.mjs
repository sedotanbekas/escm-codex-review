#!/usr/bin/env node
// server.mjs — Backend HTTP tipis untuk GUI Codex Review.
// -----------------------------------------------------------------------------
// Tugasnya HANYA: terima permintaan dari frontend → panggil reviewSource() di
// reviewEngine.mjs (mesin yang sama dengan CLI/CI) → balas JSON.
//
// Tidak ada logika review di sini. Pemisahan tegas backend↔frontend, dan mesin
// dipakai bersama dengan pipeline GitLab CI/CD.
//
// Prinsip dijaga:
//   - OPENAI_API_KEY hanya dibaca di sisi server (tidak pernah ke browser).
//   - advisory-only: server hanya melaporkan temuan, tidak mengubah kode.
// -----------------------------------------------------------------------------
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import {
    loadControlRiskCatalog,
    reviewSource,
} from "../scripts/reviewEngine.mjs";
import { getGroundTruth } from "./data/ground_truth.mjs";
import { getLeadDevValidation } from "./data/lead_dev_validation.mjs";
import { evaluate } from "../scripts/evalMatch.mjs";
import { recordRun, listRuns, getRun, sha256 } from "./history.mjs";
import { buildReport } from "./report.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, ".."); // .codex-review/
const REPO_ROOT = path.resolve(ROOT, ".."); // root repo

// --- Loader .env ringan (tanpa dependensi dotenv) ----------------------------
// Membaca .codex-review/.env bila ada, mengisi process.env untuk kunci yang
// belum di-set dari environment sungguhan (environment menang atas file).
function loadEnvFile(envPath) {
    if (!fs.existsSync(envPath)) return;
    const text = fs.readFileSync(envPath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq < 0) continue;
        const key = line.slice(0, eq).trim();
        let val = line.slice(eq + 1).trim();
        // Buang kutip pembungkus jika ada
        if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
        ) {
            val = val.slice(1, -1);
        }
        if (key && process.env[key] === undefined) {
            process.env[key] = val;
        }
    }
}
loadEnvFile(path.join(ROOT, ".env"));

// --- Secret (Base64-aware, sama seperti run_codex.mjs) -----------------------
function getSecret(name) {
    const direct = process.env[name];
    if (direct && direct.trim()) return direct.trim();
    const b64 = process.env[`${name}_B64`];
    if (b64 && b64.trim()) {
        try {
            return Buffer.from(b64.trim(), "base64").toString("utf8").trim();
        } catch (_) {}
    }
    return "";
}

// --- Konfigurasi -------------------------------------------------------------
const PORT = parseInt(process.env.PORT || "8787", 10);
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const MAX_OUTPUT_TOKENS = parseInt(process.env.MAX_OUTPUT_TOKENS || "2000", 10);
const CONCURRENCY = parseInt(process.env.CODEX_CONCURRENCY || "4", 10);
const MAX_CHARS_PER_CHUNK = parseInt(
    process.env.MAX_CHARS_PER_CHUNK || "120000",
    10,
);
const DISABLE_RESPONSES =
    String(process.env.OPENAI_DISABLE_RESPONSES || "false").toLowerCase() ===
    "true";

// Gerbang akses untuk endpoint live (scan AI memakai token OpenAI-mu).
// ACCESS_CODE kosong = TANPA gerbang (mode lokal/dev). Di hosting publik, WAJIB
// di-set agar hanya yang diundang (punya passcode) bisa menjalankan scan live.
const ACCESS_CODE = (process.env.ACCESS_CODE || "").trim();
// Batas jumlah scan live per jam (lindungi anggaran token). Global, in-memory.
const MAX_LIVE_PER_HOUR = parseInt(process.env.MAX_LIVE_PER_HOUR || "20", 10);

// Lokasi prompt few-shot (rulebook). GUI memakai prompt diff review.
const PROMPT_DIFF_PATH = path.join(ROOT, "prompts", "codex_diff_review.md");

const HISTORY_DIR = path.join(ROOT, "history");
// Laporan rekaman default (statis, ikut di-commit) untuk demo anti-gagal.
const RECORDED_PATH = path.join(__dirname, "data", "recorded_report.json");
const SEED_PATCHES = [
    { exp: "EXP-01", path: path.join(ROOT, "tests", "sample_mr.patch") },
    { exp: "EXP-02", path: path.join(ROOT, "tests", "stress_test_rulebook.patch") },
];

// Cache peta { exp: { path: <blok diff berkas> } } dari patch seeded, untuk
// snippet kode di Top findings. Dibangun sekali (isi patch statis).
let _seededDiffsCache = null;
function getSeededDiffs() {
    if (_seededDiffsCache) return _seededDiffsCache;
    const out = {};
    for (const ds of SEED_PATCHES) {
        try {
            if (!fs.existsSync(ds.path)) continue;
            const text = fs.readFileSync(ds.path, "utf8");
            const map = {};
            const blocks = text
                .split(/(?=^diff --git )/m)
                .filter((s) => s.trim());
            for (const b of blocks) {
                const m = b.match(/^diff --git a\/(.+?) b\/(.+)$/m);
                const p = m ? m[2].trim() : null;
                if (p) map[p] = b.replace(/\s+$/, "");
            }
            out[ds.exp] = map;
        } catch (_) {}
    }
    _seededDiffsCache = out;
    return out;
}

// Muat katalog kontrol sekali saat start (untuk severity floor & coverage).
const controlCatalog = loadControlRiskCatalog(
    path.join(ROOT, "controls", "controls.csv"),
);

// --- Penyusun respons laporan (dipakai bersama evaluate/history/recorded) -----
function pricingFromEnv() {
    const inP = parseFloat(process.env.CODEX_PRICE_PROMPT_PER_1M || "NaN");
    const outP = parseFloat(process.env.CODEX_PRICE_COMPLETION_PER_1M || "NaN");
    if (Number.isNaN(inP) || Number.isNaN(outP)) return null;
    return {
        inPer1M: inP,
        outPer1M: outP,
        currency: process.env.CODEX_PRICE_CURRENCY || "USD",
    };
}

// Ubah satu run tersimpan menjadi bentuk respons (EvalResponse) + laporan
// terstruktur "Codex Review Summary" siap-render untuk GUI.
function runToResponse(run, source = "history") {
    const { official } = getGroundTruth();
    const report = buildReport({
        findings: run.findings || [],
        metrics: run.metrics_live || null,
        official,
        cost: run.cost || null,
        model: run.model || MODEL,
        controlTotal: controlCatalog.riskById.size,
        pricing: pricingFromEnv(),
        seededDiffs: getSeededDiffs(),
    });
    return {
        ok: true,
        source,
        runId: run.id,
        timestamp_display: run.timestamp_display,
        model: run.model,
        datasets: run.datasets,
        metrics_live: run.metrics_live,
        perRule: run.per_rule,
        fpFindings: run.fp_findings,
        cost: run.cost,
        report,
    };
}

// --- Gerbang akses + rate-limit untuk /api/evaluate (lindungi token) ---------
const liveHits = [];
function rateLimitOk() {
    const now = Date.now();
    const cutoff = now - 3600_000;
    while (liveHits.length && liveHits[0] < cutoff) liveHits.shift();
    if (liveHits.length >= MAX_LIVE_PER_HOUR) return false;
    liveHits.push(now);
    return true;
}
function accessOk(req, res) {
    if (!ACCESS_CODE) return true; // tanpa gerbang (lokal/dev)
    const got = (req.get("x-access-code") || "").trim();
    if (got !== ACCESS_CODE) {
        res.status(401).json({ error: "Passcode salah atau belum diisi." });
        return false;
    }
    return true;
}

// --- App ---------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: "2mb" }));

// CORS sederhana untuk mode dev (frontend Vite di port lain).
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, x-access-code");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
});

// Health check — laporkan apakah kunci tersedia TANPA membocorkannya.
app.get("/api/health", (req, res) => {
    const hasKey = Boolean(getSecret("OPENAI_API_KEY"));
    res.json({
        ok: true,
        model: MODEL,
        apiKeyConfigured: hasKey,
        rulesLoaded: controlCatalog.riskById.size,
        promptLoaded: fs.existsSync(PROMPT_DIFF_PATH),
        recordedAvailable: fs.existsSync(RECORDED_PATH),
        accessRequired: Boolean(ACCESS_CODE),
    });
});


// Ground-truth + angka resmi (statis).
app.get("/api/groundtruth", (req, res) => {
    res.json(getGroundTruth());
});

// Rulebook tervalidasi Lead Dev IT WIKA (30 aturan inti + verdict pakar).
app.get("/api/rulebook", (req, res) => {
    res.json({ rulebook: getLeadDevValidation() });
});

// Evaluasi live: scan kedua patch seeded → cocokkan → metrik → simpan riwayat.
app.post("/api/evaluate", async (req, res) => {
    try {
        if (!accessOk(req, res)) return;
        if (!rateLimitOk()) {
            return res.status(429).json({
                error: `Batas ${MAX_LIVE_PER_HOUR} scan live per jam tercapai. Coba lagi nanti.`,
            });
        }
        const apiKey = getSecret("OPENAI_API_KEY");
        if (!apiKey) {
            return res.status(503).json({
                error: "OPENAI_API_KEY belum diset. Isi .codex-review/.env.",
            });
        }
        const prompt = fs.readFileSync(PROMPT_DIFF_PATH, "utf8");
        const { rules } = getGroundTruth();

        const cost = { calls: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, api: null };
        const recordUsage = (kind, _i, u) => {
            if (!u) return;
            cost.api = cost.api || kind;
            cost.calls += 1;
            cost.prompt_tokens += Number(u.prompt_tokens || 0);
            cost.completion_tokens += Number(u.completion_tokens || 0);
            cost.total_tokens += Number(u.total_tokens || 0);
        };

        const allFindings = [];
        const datasets = [];
        for (const ds of SEED_PATCHES) {
            if (!fs.existsSync(ds.path)) continue;
            const patchText = fs.readFileSync(ds.path, "utf8");
            datasets.push({ exp: ds.exp, sha256: sha256(patchText) });
            const result = await reviewSource({
                source: patchText,
                inputType: "diff",
                prompt,
                controlCatalog,
                openAiConfig: {
                    apiKey, model: MODEL, maxOutputTokens: MAX_OUTPUT_TOKENS,
                    disableResponses: DISABLE_RESPONSES, recordUsage,
                },
                maxChunkChars: MAX_CHARS_PER_CHUNK,
                concurrency: CONCURRENCY,
                log: () => {},
            });
            // Tandai tiap temuan dengan dataset asalnya (EXP-01/EXP-02) agar
            // tabel Top findings bisa menampilkan kolom "Sumber".
            for (const issue of result.issues) issue.dataset = ds.exp;
            allFindings.push(...result.issues);
        }

        const { perRule, metrics, fpFindings } = evaluate(allFindings, rules);
        const { id, } = recordRun(HISTORY_DIR, {
            model: MODEL,
            datasets,
            metrics_live: metrics,
            per_rule: perRule,
            fp_findings: fpFindings,
            findings: allFindings,
            cost,
            git_commit: process.env.CI_COMMIT_SHA || null,
        });
        const saved = getRun(HISTORY_DIR, id);
        res.json(runToResponse(saved, "live"));
    } catch (err) {
        console.error("[server] /api/evaluate error:", err);
        res.status(500).json({ error: "Gagal menjalankan evaluasi. Cek log server." });
    }
});

// Versi STREAMING dari evaluate: mengalirkan progres NYATA (NDJSON, satu objek
// per baris) saat tiap potongan kode selesai diproses, lalu hasil akhir. Dipakai
// GUI untuk loading bar yang jujur. Logika inti identik dengan /api/evaluate.
app.post("/api/evaluate/stream", async (req, res) => {
    // Gerbang & limit dicek SEBELUM streaming (masih boleh balas JSON error).
    if (!accessOk(req, res)) return;
    if (!rateLimitOk()) {
        return res.status(429).json({
            error: `Batas ${MAX_LIVE_PER_HOUR} scan live per jam tercapai. Coba lagi nanti.`,
        });
    }
    const apiKey = getSecret("OPENAI_API_KEY");
    if (!apiKey) {
        return res.status(503).json({
            error: "OPENAI_API_KEY belum diset. Isi .env.",
        });
    }

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    const send = (obj) => res.write(JSON.stringify(obj) + "\n");

    try {
        const prompt = fs.readFileSync(PROMPT_DIFF_PATH, "utf8");
        const { rules } = getGroundTruth();

        const cost = { calls: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, api: null };
        const recordUsage = (kind, _i, u) => {
            if (!u) return;
            cost.api = cost.api || kind;
            cost.calls += 1;
            cost.prompt_tokens += Number(u.prompt_tokens || 0);
            cost.completion_tokens += Number(u.completion_tokens || 0);
            cost.total_tokens += Number(u.total_tokens || 0);
        };

        const present = SEED_PATCHES.filter((ds) => fs.existsSync(ds.path));
        const D = present.length || 1;
        send({ type: "progress", pct: 0.02, label: "Menyiapkan contoh kode…" });

        const allFindings = [];
        const datasets = [];
        for (let di = 0; di < present.length; di++) {
            const ds = present[di];
            const patchText = fs.readFileSync(ds.path, "utf8");
            datasets.push({ exp: ds.exp, sha256: sha256(patchText) });
            const result = await reviewSource({
                source: patchText,
                inputType: "diff",
                prompt,
                controlCatalog,
                openAiConfig: {
                    apiKey, model: MODEL, maxOutputTokens: MAX_OUTPUT_TOKENS,
                    disableResponses: DISABLE_RESPONSES, recordUsage,
                },
                maxChunkChars: MAX_CHARS_PER_CHUNK,
                concurrency: CONCURRENCY,
                // Progres NYATA: tiap chunk selesai → kabari GUI. Dua dataset
                // dibagi rata (0–90%), 90–100% untuk pencocokan & penilaian.
                onProgress: (chunkDone, chunkTotal) => {
                    const within = chunkTotal > 0 ? chunkDone / chunkTotal : 0;
                    const pct = ((di + within) / D) * 0.9;
                    send({
                        type: "progress",
                        pct,
                        label: chunkTotal
                            ? `Memeriksa ${ds.exp} (${chunkDone}/${chunkTotal} potongan)…`
                            : `Memeriksa ${ds.exp}…`,
                    });
                },
                log: () => {},
            });
            for (const issue of result.issues) issue.dataset = ds.exp;
            allFindings.push(...result.issues);
        }

        send({ type: "progress", pct: 0.93, label: "Mencocokkan temuan & menilai…" });
        const { perRule, metrics, fpFindings } = evaluate(allFindings, rules);
        const { id } = recordRun(HISTORY_DIR, {
            model: MODEL,
            datasets,
            metrics_live: metrics,
            per_rule: perRule,
            fp_findings: fpFindings,
            findings: allFindings,
            cost,
            git_commit: process.env.CI_COMMIT_SHA || null,
        });
        const saved = getRun(HISTORY_DIR, id);
        send({ type: "progress", pct: 1, label: "Selesai" });
        send({ type: "result", ...runToResponse(saved, "live") });
        res.end();
    } catch (err) {
        console.error("[server] /api/evaluate/stream error:", err);
        try {
            send({
                type: "error",
                error: "Gagal menjalankan evaluasi. Cek log server.",
            });
        } catch (_) {}
        res.end();
    }
});

// Riwayat run.
app.get("/api/history", (req, res) => {
    res.json({ runs: listRuns(HISTORY_DIR) });
});
app.get("/api/history/:id", (req, res) => {
    const run = getRun(HISTORY_DIR, req.params.id);
    if (!run) return res.status(404).json({ error: "Run tidak ditemukan." });
    res.json(runToResponse(run, "history"));
});

// Laporan rekaman default (statis, anti-gagal saat demo). Dibekukan dari run
// live terbaik via `npm run pin-report`, lalu di-commit agar ikut lintas device.
app.get("/api/report/recorded", (req, res) => {
    if (!fs.existsSync(RECORDED_PATH)) {
        return res.json({ ok: true, recorded: null });
    }
    try {
        const run = JSON.parse(fs.readFileSync(RECORDED_PATH, "utf8"));
        res.json(runToResponse(run, "recorded"));
    } catch (err) {
        console.error("[server] gagal baca recorded_report:", err.message);
        res.json({ ok: true, recorded: null });
    }
});

// Konten dataset seeded (kedua patch EXP-01/EXP-02) untuk panel kode di GUI.
app.get("/api/dataset", (req, res) => {
    try {
        const datasets = SEED_PATCHES.map((ds) => ({
            exp: ds.exp,
            file: path.relative(ROOT, ds.path).replace(/\\/g, "/"),
            content: fs.readFileSync(ds.path, "utf8"),
        }));
        res.json({ ok: true, datasets });
    } catch (err) {
        console.error("[server] gagal baca dataset seeded:", err.message);
        res.status(500).json({ error: "Gagal memuat dataset seeded." });
    }
});

// Sajikan GUI hasil build (gui/dist) bila ada — untuk mode produksi/demo.
const GUI_DIST = path.join(ROOT, "gui", "dist");
if (fs.existsSync(GUI_DIST)) {
    app.use(express.static(GUI_DIST));
    app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api/")) return next();
        res.sendFile(path.join(GUI_DIST, "index.html"));
    });
}

app.listen(PORT, () => {
    const hasKey = Boolean(getSecret("OPENAI_API_KEY"));
    console.log(`\n[codex-gui] Backend berjalan di http://localhost:${PORT}`);
    console.log(`[codex-gui] Model           : ${MODEL}`);
    console.log(
        `[codex-gui] API key          : ${hasKey ? "terdeteksi ✓" : "BELUM diset — isi .codex-review/.env"}`,
    );
    console.log(
        `[codex-gui] Rulebook         : ${controlCatalog.riskById.size} kontrol dimuat`,
    );
    console.log(
        `[codex-gui] GUI build        : ${fs.existsSync(GUI_DIST) ? "disajikan dari gui/dist" : "belum di-build (pakai vite dev server)"}\n`,
    );
});
