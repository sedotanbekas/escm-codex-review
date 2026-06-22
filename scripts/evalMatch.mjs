// evalMatch.mjs — pencocokan deteksi AI ke ground-truth + metrik IR.
// Aturan match: rule_id eksplisit pada check_name cocok DAN basename berkas cocok.

function basename(p = "") {
    return String(p).split(/[\\/]/).pop();
}

function ruleIdOf(checkName = "") {
    const m = String(checkName).match(/\[([A-Z]+-[A-Z0-9]+)\]/i);
    return m ? m[1].toUpperCase() : null;
}

export function matchDetections(findings, rules) {
    const detById = new Map(); // rule_id -> finding (pertama yang cocok)
    const knownIds = new Set(rules.map((r) => r.rule_id));
    const fpFindings = [];

    for (const fnd of findings) {
        const id = ruleIdOf(fnd.check_name);
        if (!id || !knownIds.has(id)) {
            // Finding ber-rule_id dikenal tapi BUKAN salah satu dari 30 seed →
            // FP. Finding tanpa rule_id sah dianggap "noise" (tak terhubung ke
            // seed mana pun) dan tidak dihitung — sesuai definisi pencocokan spec.
            if (id) fpFindings.push(fnd);
            continue;
        }
        const rule = rules.find((r) => r.rule_id === id);
        const okFile =
            basename(fnd.location?.path || "").toLowerCase() ===
            basename(rule.file).toLowerCase();
        if (okFile && !detById.has(id)) {
            detById.set(id, fnd);
        } else if (okFile) {
            // Deteksi benar kedua untuk rule yang sama: first-wins, tidak
            // menambah TP maupun FP (tidak menggelembungkan metrik).
        } else {
            fpFindings.push(fnd); // rule dikenal tapi di berkas tak ber-seed
        }
    }

    const perRule = rules.map((r) => ({
        rule_id: r.rule_id,
        domain: r.domain,
        expert_verdict: r.expert_verdict,
        detected: detById.has(r.rule_id),
        finding: detById.get(r.rule_id) || null,
    }));

    return { perRule, fpFindings };
}

export function computeMetrics(perRule, fpCount = 0) {
    const tp = perRule.filter((p) => p.detected).length;
    const fn = perRule.length - tp;
    const fp = fpCount;
    // Saat tak ada deteksi sama sekali (tp+fp=0), precision=0 (bukan 1) agar
    // run kosong tampil jujur, simetris dengan recall.
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    const dom = (d) => perRule.filter((p) => p.domain === d);
    const recallDom = (d) => {
        const g = dom(d);
        const t = g.filter((p) => p.detected).length;
        return g.length ? t / g.length : 0;
    };

    return {
        tp, fp, fn,
        precision: Number(precision.toFixed(3)),
        recall: Number(recall.toFixed(3)),
        f1: Number(f1.toFixed(3)),
        recall_ctdl: Number(recallDom("CTDL").toFixed(3)),
        recall_wika: Number(recallDom("WIKA").toFixed(3)),
    };
}

export function evaluate(findings, rules) {
    const { perRule, fpFindings } = matchDetections(findings, rules);
    const metrics = computeMetrics(perRule, fpFindings.length);
    return { perRule, metrics, fpFindings };
}
