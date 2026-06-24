// report.mjs — Menyusun "Codex Review Summary" terstruktur (gaya GitLab) dari
// hasil review, untuk ditampilkan di GUI.
//
// PENTING: modul ini TIDAK menyentuh scripts/run_codex.mjs (kontrak CLI/CI tetap
// utuh). Ia meniru bagian penyusun markdown di run_codex.mjs, tetapi mengembalikan
// DATA TERSTRUKTUR (bukan teks markdown) sehingga frontend bebas merendernya.
//
// Komposisi seksi (sesuai permintaan revisi GUI):
//   1) executive   2) metrics (P/R/F1 live vs pakar)   3) severity
//   4) usage       5) topFindings                       6) componentByDomain (CTDL vs WIKA)
//   7) rulebook
import {
    severityWeight,
    collectControlIdsFromIssue,
} from "../scripts/reviewEngine.mjs";

function emptyCounts() {
    return { blocker: 0, critical: 0, major: 0, minor: 0, info: 0 };
}

export function overallRiskOf(counts) {
    if (counts.blocker > 0) return "blocker";
    if (counts.critical > 0) return "critical";
    if (counts.major > 0) return "major";
    if (counts.minor > 0) return "minor";
    return "info";
}

const isSCA = (name = "") => /\bSCA\b/i.test(name);
export function groupType(name = "") {
    return isSCA(name) ? "SCA" : "SAST";
}

// Pengelompokan komponen ala Laravel/WISE — disalin dari run_codex.mjs agar kolom
// "Component" di tabel Top findings tampil identik dengan laporan GitLab.
export function groupComponent(p = "") {
    if (
        p.startsWith("app/Http/Controllers/") ||
        p.startsWith("app/Models/") ||
        p.startsWith("app/Services/") ||
        p.startsWith("app/Sync/") ||
        p.startsWith("app/Jobs/") ||
        p.startsWith("app/Enums/") ||
        p.startsWith("app/Rules/") ||
        p.startsWith("app/Providers/") ||
        p.startsWith("app/Http/Middleware/") ||
        p.startsWith("routes/")
    )
        return "backend";
    if (
        p.startsWith("modules/Citadel/") ||
        p.startsWith("app/Services/Citadel/") ||
        p.startsWith("packages/citadel/")
    )
        return "citadel";
    if (
        p.startsWith("resources/views/") ||
        p.startsWith("resources/js/") ||
        p.startsWith("resources/css/") ||
        p.startsWith("resources/scss/") ||
        p.startsWith("public/") ||
        p.endsWith(".blade.php") ||
        p.endsWith(".vue")
    )
        return "frontend";
    if (
        p.startsWith("database/") ||
        p.startsWith("config/") ||
        p === "docker-compose.yml" ||
        /Dockerfile$/.test(p)
    )
        return "infra";
    return "other";
}

function ruleIdOf(checkName = "") {
    const m = String(checkName).match(/\[([A-Z]+-[A-Z0-9]+)\]/i);
    return m ? m[1].toUpperCase() : null;
}

// Domain aturan dari rule_id: CTDL, WIKA, atau OTHER (mis. AUTH/CRYPTO/SESS).
export function domainOfRuleId(id = "") {
    const u = String(id).toUpperCase();
    if (u.startsWith("CTDL")) return "CTDL";
    if (u.startsWith("WIKA")) return "WIKA";
    return "OTHER";
}

function cleanCheck(name = "") {
    return String(name)
        .replace(/^(SAST|SCA)\s*\|\s*/i, "")
        .trim();
}

// -----------------------------------------------------------------------------
// buildReport — fungsi murni: dari kumpulan findings (+ metrik & biaya) menjadi
// objek laporan terstruktur. Tidak ada I/O, mudah diuji.
//
// params:
//   findings     : Issue[]   — temuan teragregasi (sudah lolos guard+dedup)
//   metrics      : metrik live { precision, recall, f1, tp, fp, fn, recall_ctdl, recall_wika } | null
//   official     : angka resmi pakar (bentuk sama) | null
//   cost         : { calls, prompt_tokens, completion_tokens, total_tokens, api } | null
//   model        : string
//   controlTotal : number    — jumlah kontrol di katalog (mis. 51)
//   pricing      : { inPer1M, outPer1M, currency } | null
//   topN         : number    — batas baris Top findings (default 10)
// -----------------------------------------------------------------------------
export function buildReport({
    findings = [],
    metrics = null,
    official = null,
    cost = null,
    model = "gpt-4o-mini",
    controlTotal = 0,
    pricing = null,
    topN = 10,
    seededDiffs = null, // { [exp]: { [path]: <blok diff berkas> } }
} = {}) {
    // 1) Severity breakdown + overall risk
    const counts = emptyCounts();
    for (const it of findings) {
        const sev = String(it.severity || "minor").toLowerCase();
        if (counts[sev] !== undefined) counts[sev]++;
    }
    const overallRisk = overallRiskOf(counts);

    // 2) Top findings (urut severity terberat → path)
    const sorted = [...findings].sort((a, b) => {
        const sr =
            (severityWeight[String(b.severity).toLowerCase()] ?? 0) -
            (severityWeight[String(a.severity).toLowerCase()] ?? 0);
        if (sr !== 0) return sr;
        return String(a.location?.path || "").localeCompare(
            String(b.location?.path || ""),
        );
    });
    // Snippet kode: blok diff berkas yang ditunjuk temuan, diambil dari patch
    // seeded (seededDiffs). Inilah kode yang BENAR-BENAR direview AI, sehingga
    // penguji bisa melihat & menilai validitasnya langsung.
    const snippetFor = (exp, fpath) => {
        if (!seededDiffs || !exp) return null;
        const fileMap = seededDiffs[exp];
        if (!fileMap) return null;
        const p = String(fpath || "").replace(/^\/+/, "");
        if (fileMap[p]) return fileMap[p];
        for (const key of Object.keys(fileMap)) {
            if (key.endsWith(p) || p.endsWith(key)) return fileMap[key];
        }
        return null;
    };
    const topFindings = sorted.slice(0, topN).map((f) => {
        const full = cleanCheck(f.check_name); // tanpa prefix "SAST |"
        return {
            severity: String(f.severity || "").toLowerCase(),
            type: groupType(f.check_name),
            component: groupComponent(f.location?.path || ""),
            ruleId: ruleIdOf(f.check_name) || "—", // kolom "Aturan" (rule terpicu)
            source: f.dataset || null, // dataset asal (EXP-01/EXP-02) → kolom "Sumber"
            path: f.location?.path || "unknown",
            line: f.location?.lines?.begin || 1,
            check: full,
            // deskripsi tanpa prefix "[CTDL-01]" (rule id sudah jadi kolom sendiri)
            descr: full.replace(/^\[[A-Za-z]+-[A-Za-z0-9]+\]\s*/, ""),
            recommendation: f.recommendation || "",
            // blok diff berkas terkait (null bila tak ditemukan)
            snippet: snippetFor(f.dataset, f.location?.path),
        };
    });

    // 3) Component overview: dihitung per domain aturan (CTDL vs WIKA saja)
    const componentByDomain = { CTDL: 0, WIKA: 0 };
    for (const it of findings) {
        const dom = domainOfRuleId(ruleIdOf(it.check_name) || "");
        if (dom === "CTDL" || dom === "WIKA") componentByDomain[dom]++;
    }

    // 4) Rulebook compliance (kontrol unik yang terpicu / total katalog)
    const triggered = new Set();
    for (const it of findings) {
        for (const id of collectControlIdsFromIssue(it))
            triggered.add(id.toUpperCase());
    }
    const triggeredIds = Array.from(triggered).sort();
    const rulebook = {
        triggered: triggeredIds.length,
        total: controlTotal,
        pct: controlTotal
            ? Number(((triggeredIds.length / controlTotal) * 100).toFixed(1))
            : null,
        sampleIds: triggeredIds.slice(0, 12),
        moreCount: Math.max(0, triggeredIds.length - 12),
    };

    // 5) Usage & cost (estimasi biaya bila harga tersedia)
    let estimatedCost = null;
    if (
        pricing &&
        cost &&
        Number.isFinite(pricing.inPer1M) &&
        Number.isFinite(pricing.outPer1M)
    ) {
        estimatedCost = {
            currency: pricing.currency || "USD",
            amount: Number(
                (
                    (Number(cost.prompt_tokens || 0) / 1e6) * pricing.inPer1M +
                    (Number(cost.completion_tokens || 0) / 1e6) *
                        pricing.outPer1M
                ).toFixed(4),
            ),
            inPer1M: pricing.inPer1M,
            outPer1M: pricing.outPer1M,
        };
    }
    const usage = {
        model,
        api: cost?.api || null,
        calls: cost?.calls || 0,
        prompt_tokens: cost?.prompt_tokens || 0,
        completion_tokens: cost?.completion_tokens || 0,
        total_tokens: cost?.total_tokens || 0,
        estimatedCost,
    };

    // 6) Executive summary
    const executive = {
        overallRisk,
        guidance:
            "Prioritaskan temuan severity tinggi (blocker/critical) lebih dulu, lalu major.",
    };

    return {
        executive,
        metrics: metrics ? { live: metrics, official: official || null } : null,
        severity: counts,
        usage,
        topFindings,
        componentByDomain,
        rulebook,
        findingsTotal: findings.length,
    };
}
