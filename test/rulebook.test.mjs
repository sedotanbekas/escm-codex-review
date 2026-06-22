import { test } from "node:test";
import assert from "node:assert/strict";
import { LEAD_DEV_VALIDATION, getLeadDevValidation } from "../server/data/lead_dev_validation.mjs";
import { GROUND_TRUTH } from "../server/data/ground_truth.mjs";

test("ada 30 aturan (15 CTDL + 15 WIKA)", () => {
    assert.equal(LEAD_DEV_VALIDATION.length, 30);
    assert.equal(LEAD_DEV_VALIDATION.filter((r) => r.domain === "CTDL").length, 15);
    assert.equal(LEAD_DEV_VALIDATION.filter((r) => r.domain === "WIKA").length, 15);
});

test("tepat 11 baris 'Valid' (TP)", () => {
    const valid = LEAD_DEV_VALIDATION.filter((r) => r.validitas === "Valid");
    assert.equal(valid.length, 11);
});

test("set 'Valid' SAMA dengan 11 TP di ground_truth (anti-drift)", () => {
    const validIds = LEAD_DEV_VALIDATION.filter((r) => r.validitas === "Valid")
        .map((r) => r.rule_id).sort();
    const tpIds = GROUND_TRUTH.filter((r) => r.expert_verdict === "TP")
        .map((r) => r.rule_id).sort();
    assert.deepEqual(validIds, tpIds);
});

test("setiap baris punya field wajib & validitas terbatas", () => {
    for (const r of LEAD_DEV_VALIDATION) {
        assert.ok(r.rule_id, "rule_id");
        assert.ok(["CTDL", "WIKA"].includes(r.domain), "domain");
        assert.ok(r.rule_singkat, "rule_singkat");
        assert.ok(r.lokasi_contoh, "lokasi_contoh");
        assert.ok(["Valid", "Tidak Valid"].includes(r.validitas), "validitas");
    }
});

test("getLeadDevValidation mengembalikan array 30", () => {
    assert.equal(getLeadDevValidation().length, 30);
});
