// pin_report.mjs — bekukan run HISTORY terbaru menjadi laporan rekaman default
// (server/data/recorded_report.json) yang ikut di-commit, supaya GUI punya
// laporan "anti-gagal" untuk demo sidang & lintas device.
//
// Pakai: jalankan evaluasi live sekali (tombol "Scan ulang (live)" di GUI atau
// POST /api/evaluate), lalu:  npm run pin-report
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listRuns, getRun } from "./history.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HISTORY_DIR = path.join(__dirname, "..", "history");
const OUT = path.join(__dirname, "data", "recorded_report.json");

const runs = listRuns(HISTORY_DIR);
if (!runs.length) {
    console.error(
        "[pin] Belum ada run di history/. Jalankan evaluasi live dulu " +
            '(tombol "Scan ulang (live)" di GUI).',
    );
    process.exit(1);
}

const latest = getRun(HISTORY_DIR, runs[0].id);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(latest, null, 2));

console.log(`[pin] Laporan rekaman default diperbarui dari run: ${latest.id}`);
console.log(`[pin] Waktu run        : ${latest.timestamp_display}`);
console.log(`[pin] Ditulis ke       : ${OUT}`);
console.log(
    "[pin] Jangan lupa commit: git add .codex-review/server/data/recorded_report.json",
);
