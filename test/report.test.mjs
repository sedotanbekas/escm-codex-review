import { test } from "node:test";
import assert from "node:assert/strict";
import {
    buildReport,
    groupType,
    domainOfRuleId,
    overallRiskOf,
} from "../server/report.mjs";

function f(check, path, sev = "major", line = 10, rec = "fix it") {
    return {
        check_name: check,
        severity: sev,
        location: { path, lines: { begin: line } },
        recommendation: rec,
    };
}

test("severity breakdown + overall risk", () => {
    const r = buildReport({
        findings: [
            f("SAST | [CTDL-01] x", "app/Http/Controllers/Foo.php", "critical"),
            f("SAST | [WIKA-Q07] y", "app/Models/Bar.php", "major"),
        ],
        controlTotal: 51,
    });
    assert.equal(r.severity.critical, 1);
    assert.equal(r.severity.major, 1);
    assert.equal(r.executive.overallRisk, "critical");
});

test("component overview dihitung CTDL vs WIKA (famili lain diabaikan)", () => {
    const r = buildReport({
        findings: [
            f("SAST | [CTDL-01] x", "a/Foo.php"),
            f("SAST | [CTDL-11] y", "a/Foo.php"),
            f("SAST | [WIKA-Q07] z", "a/Bar.php"),
            f("SAST | [AUTH-08] hardcoded", "a/Baz.php"), // bukan CTDL/WIKA
        ],
        controlTotal: 51,
    });
    assert.equal(r.componentByDomain.CTDL, 2);
    assert.equal(r.componentByDomain.WIKA, 1);
});

test("top findings dibatasi, dibersihkan, & komponen benar", () => {
    const r = buildReport({
        findings: [
            f("SAST | [CTDL-01] Raw SQL", "app/Http/Controllers/Foo.php", "major", 12),
        ],
        controlTotal: 51,
        topN: 5,
    });
    assert.equal(r.topFindings.length, 1);
    assert.equal(r.topFindings[0].type, "SAST");
    assert.equal(r.topFindings[0].check, "[CTDL-01] Raw SQL");
    assert.equal(r.topFindings[0].line, 12);
    assert.equal(r.topFindings[0].component, "backend");
});

test("top findings: kolom 'source' dari dataset asal (EXP)", () => {
    const tagged = { ...f("SAST | [CTDL-01] x", "a/Foo.php"), dataset: "EXP-02" };
    const r = buildReport({ findings: [tagged], controlTotal: 51 });
    assert.equal(r.topFindings[0].source, "EXP-02");
    // tanpa tag → null (mis. run lama)
    const r2 = buildReport({ findings: [f("SAST | [CTDL-01] x", "a/Foo.php")], controlTotal: 51 });
    assert.equal(r2.topFindings[0].source, null);
});

test("rulebook compliance: kontrol unik / total", () => {
    const r = buildReport({
        findings: [
            f("SAST | [CTDL-01] x", "a/Foo.php"),
            f("SAST | [CTDL-01] dup", "a/Foo2.php"),
        ],
        controlTotal: 51,
    });
    assert.equal(r.rulebook.total, 51);
    assert.equal(r.rulebook.triggered, 1); // CTDL-01 dihitung sekali
    assert.ok(r.rulebook.sampleIds.includes("CTDL-01"));
});

test("metrics live + official diteruskan apa adanya", () => {
    const live = { precision: 0.5, recall: 0.3, f1: 0.37, tp: 6, fp: 6, fn: 14, recall_ctdl: 0.4, recall_wika: 0.2 };
    const official = { precision: 1, recall: 0.367, f1: 0.537, tp: 11, fp: 0, fn: 19, recall_ctdl: 0.533, recall_wika: 0.2 };
    const r = buildReport({ findings: [], metrics: live, official, controlTotal: 51 });
    assert.equal(r.metrics.live.precision, 0.5);
    assert.equal(r.metrics.official.precision, 1);
});

test("metrics null bila tak diberi", () => {
    const r = buildReport({ findings: [], controlTotal: 51 });
    assert.equal(r.metrics, null);
});

test("usage & estimasi biaya dihitung bila pricing ada", () => {
    const cost = {
        calls: 2,
        prompt_tokens: 1_000_000,
        completion_tokens: 1_000_000,
        total_tokens: 2_000_000,
        api: "chat",
    };
    const r = buildReport({
        findings: [],
        cost,
        pricing: { inPer1M: 0.15, outPer1M: 0.6, currency: "USD" },
        controlTotal: 51,
    });
    assert.equal(r.usage.estimatedCost.amount, 0.75);
    assert.equal(r.usage.calls, 2);
});

test("helper murni: groupType, domainOfRuleId, overallRiskOf", () => {
    assert.equal(groupType("SCA | dep foo"), "SCA");
    assert.equal(groupType("SAST | [CTDL-01] x"), "SAST");
    assert.equal(domainOfRuleId("WIKA-Q07"), "WIKA");
    assert.equal(domainOfRuleId("AUTH-08"), "OTHER");
    assert.equal(overallRiskOf({ blocker: 0, critical: 0, major: 0, minor: 1, info: 0 }), "minor");
});
