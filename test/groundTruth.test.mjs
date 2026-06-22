import { test } from "node:test";
import assert from "node:assert/strict";
import {
    GROUND_TRUTH,
    OFFICIAL_METRICS,
    getGroundTruth,
} from "../server/data/ground_truth.mjs";

test("ada tepat 30 rule (15 CTDL + 15 WIKA)", () => {
    assert.equal(GROUND_TRUTH.length, 30);
    assert.equal(GROUND_TRUTH.filter((r) => r.domain === "CTDL").length, 15);
    assert.equal(GROUND_TRUTH.filter((r) => r.domain === "WIKA").length, 15);
});

test("tepat 11 rule berverdict TP", () => {
    const tp = GROUND_TRUTH.filter((r) => r.expert_verdict === "TP");
    assert.equal(tp.length, 11);
    const ids = tp.map((r) => r.rule_id).sort();
    assert.deepEqual(ids, [
        "CTDL-01", "CTDL-02", "CTDL-03", "CTDL-05", "CTDL-06",
        "CTDL-07", "CTDL-10", "CTDL-11", "WIKA-Q05", "WIKA-Q07", "WIKA-Q08",
    ].sort());
});

test("setiap rule punya field wajib", () => {
    for (const r of GROUND_TRUTH) {
        assert.ok(r.rule_id, "rule_id");
        assert.ok(["CTDL", "WIKA"].includes(r.domain), "domain");
        assert.ok(r.title, "title");
        assert.ok(r.file, "file");
        assert.ok(Array.isArray(r.experiments) && r.experiments.length, "experiments");
        assert.ok(["TP", "FN"].includes(r.expert_verdict), "verdict");
    }
});

test("metrik resmi cocok skripsi", () => {
    assert.equal(OFFICIAL_METRICS.precision, 1.0);
    assert.equal(OFFICIAL_METRICS.tp, 11);
    assert.equal(OFFICIAL_METRICS.fp, 0);
    assert.equal(OFFICIAL_METRICS.fn, 19);
    assert.equal(OFFICIAL_METRICS.recall_ctdl, 0.533);
    assert.equal(OFFICIAL_METRICS.recall_wika, 0.2);
});

test("getGroundTruth mengembalikan rules + official", () => {
    const g = getGroundTruth();
    assert.equal(g.rules.length, 30);
    assert.equal(g.official.f1, 0.537);
});
