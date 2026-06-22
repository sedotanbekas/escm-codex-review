// history.mjs — penyimpanan riwayat run (audit trail) berstempel waktu.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function sha256(text) {
    return crypto.createHash("sha256").update(String(text)).digest("hex");
}

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Format ke Waktu Indonesia Barat (UTC+7) tanpa dependensi tz.
export function formatWIB(date) {
    const wib = new Date(date.getTime() + 7 * 3600 * 1000);
    const hari = HARI[wib.getUTCDay()];
    const tgl = wib.getUTCDate();
    const bln = BULAN[wib.getUTCMonth()];
    const thn = wib.getUTCFullYear();
    const jam = String(wib.getUTCHours()).padStart(2, "0");
    const mnt = String(wib.getUTCMinutes()).padStart(2, "0");
    return `${hari}, ${tgl} ${bln} ${thn}, ${jam}.${mnt} WIB`;
}

export function recordRun(dir, run) {
    fs.mkdirSync(dir, { recursive: true });
    const now = new Date();
    const iso = now.toISOString();
    // Prefix timestamp (tetap urut secara leksikografis) + suffix acak agar dua
    // run pada milidetik yang sama tidak saling menimpa berkasnya.
    const id =
        iso.replace(/[:.]/g, "-") + "-" + crypto.randomBytes(4).toString("hex");
    const payload = {
        id,
        timestamp_iso: iso,
        timestamp_display: formatWIB(now),
        ...run,
    };
    const file = path.join(dir, `run-${id}.json`);
    fs.writeFileSync(file, JSON.stringify(payload, null, 2));
    return { id, path: file };
}

// Ringkasan "produk" dari sebuah run: jumlah temuan + risiko tertinggi.
const SEV_RANK = ["blocker", "critical", "major", "minor"];
function summarizeFindings(findings) {
    const arr = Array.isArray(findings) ? findings : [];
    const counts = { blocker: 0, critical: 0, major: 0, minor: 0, info: 0 };
    for (const f of arr) {
        const s = String(f?.severity || "").toLowerCase();
        if (counts[s] !== undefined) counts[s]++;
    }
    let overallRisk = "info";
    for (const s of SEV_RANK) {
        if (counts[s] > 0) {
            overallRisk = s;
            break;
        }
    }
    return { findingsTotal: arr.length, overallRisk };
}

export function listRuns(dir) {
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir).filter((f) => f.startsWith("run-") && f.endsWith(".json"));
    const runs = [];
    for (const f of files) {
        try {
            const r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
            const sum = summarizeFindings(r.findings);
            runs.push({
                id: r.id,
                timestamp_iso: r.timestamp_iso,
                timestamp_display: r.timestamp_display,
                metrics_live: r.metrics_live || null,
                findingsTotal: sum.findingsTotal,
                overallRisk: sum.overallRisk,
            });
        } catch (_) {}
    }
    runs.sort((a, b) => (a.timestamp_iso < b.timestamp_iso ? 1 : -1));
    return runs;
}

export function getRun(dir, id) {
    const file = path.join(dir, `run-${id}.json`);
    if (!fs.existsSync(file)) return null;
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (_) {
        return null;
    }
}
