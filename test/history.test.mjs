import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { sha256, formatWIB, recordRun, listRuns, getRun } from "../server/history.mjs";

function tmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), "codex-hist-"));
}

test("sha256 deterministik", () => {
    assert.equal(sha256("abc"), sha256("abc"));
    assert.notEqual(sha256("abc"), sha256("abd"));
});

test("formatWIB menghasilkan string berstempel WIB", () => {
    const s = formatWIB(new Date("2026-06-19T07:32:00Z")); // 14:32 WIB
    assert.match(s, /WIB$/);
    assert.match(s, /2026/);
});

test("recordRun lalu getRun mengembalikan data sama", () => {
    const dir = tmpDir();
    const { id } = recordRun(dir, { metrics_live: { tp: 5 }, findings: [] });
    const run = getRun(dir, id);
    assert.equal(run.metrics_live.tp, 5);
    assert.ok(run.timestamp_iso);
    assert.ok(run.timestamp_display);
});

test("listRuns mengembalikan ringkasan terbaru dulu", () => {
    const dir = tmpDir();
    recordRun(dir, { metrics_live: { tp: 1 } });
    recordRun(dir, { metrics_live: { tp: 2 } });
    const runs = listRuns(dir);
    assert.equal(runs.length, 2);
    assert.ok(runs[0].timestamp_iso >= runs[1].timestamp_iso);
});

test("getRun id tak ada → null", () => {
    assert.equal(getRun(tmpDir(), "tidak-ada"), null);
});
