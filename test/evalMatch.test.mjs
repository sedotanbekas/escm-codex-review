import { test } from "node:test";
import assert from "node:assert/strict";
import { matchDetections, computeMetrics, evaluate } from "../scripts/evalMatch.mjs";

const rules = [
    { rule_id: "CTDL-01", domain: "CTDL", file: "Foo.php", expert_verdict: "TP" },
    { rule_id: "WIKA-Q07", domain: "WIKA", file: "Foo.php", expert_verdict: "TP" },
    { rule_id: "CTDL-09", domain: "CTDL", file: "Bar.php", expert_verdict: "FN" },
];

function f(rule, path, line = 1) {
    return { check_name: `[${rule}] something`, location: { path, lines: { begin: line } } };
}

test("mendeteksi rule lewat rule_id + basename berkas", () => {
    const findings = [f("CTDL-01", "app/Http/Controllers/Foo.php", 8)];
    const { perRule } = matchDetections(findings, rules);
    const c1 = perRule.find((p) => p.rule_id === "CTDL-01");
    assert.equal(c1.detected, true);
    assert.equal(c1.finding.location.lines.begin, 8);
});

test("rule tak terdeteksi bila berkas beda", () => {
    const findings = [f("CTDL-01", "app/Models/Other.php")];
    const { perRule } = matchDetections(findings, rules);
    assert.equal(perRule.find((p) => p.rule_id === "CTDL-01").detected, false);
});

test("finding rule_id tak dikenal → FP", () => {
    const findings = [f("CTDL-99", "app/Foo.php")];
    const { fpFindings } = matchDetections(findings, rules);
    assert.equal(fpFindings.length, 1);
});

test("computeMetrics menghitung P/R/F1", () => {
    const perRule = [
        { rule_id: "CTDL-01", domain: "CTDL", detected: true },
        { rule_id: "WIKA-Q07", domain: "WIKA", detected: false },
        { rule_id: "CTDL-09", domain: "CTDL", detected: false },
    ];
    const m = computeMetrics(perRule, 0);
    assert.equal(m.tp, 1);
    assert.equal(m.fn, 2);
    assert.equal(m.fp, 0);
    assert.equal(m.precision, 1);
    assert.equal(Number(m.recall.toFixed(3)), 0.333);
});

test("evaluate menggabungkan match + metrik", () => {
    const findings = [f("CTDL-01", "x/Foo.php"), f("WIKA-Q07", "y/Foo.php")];
    const { metrics } = evaluate(findings, rules);
    assert.equal(metrics.tp, 2);
});
