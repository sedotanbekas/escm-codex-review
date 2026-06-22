import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const PORT = 8790;
let proc;

before(async () => {
    // On Windows, import.meta.url pathname has %20 for spaces and a leading /
    // before the drive letter. Strip the leading slash and decode percent-encoding.
    const rawPath = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
    const cwd = decodeURIComponent(rawPath);
    proc = spawn(process.execPath, ["server/server.mjs"], {
        cwd,
        env: { ...process.env, PORT: String(PORT) },
        stdio: "ignore",
    });
    for (let i = 0; i < 40; i++) {
        try {
            const r = await fetch(`http://localhost:${PORT}/api/health`);
            if (r.ok) return;
        } catch (_) {}
        await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error("server tidak siap");
});

after(() => proc?.kill());

test("GET /api/groundtruth → 30 rule + official", async () => {
    const r = await fetch(`http://localhost:${PORT}/api/groundtruth`);
    const d = await r.json();
    assert.equal(d.rules.length, 30);
    assert.equal(d.official.precision, 1.0);
});

test("GET /api/history → array (boleh kosong)", async () => {
    const r = await fetch(`http://localhost:${PORT}/api/history`);
    const d = await r.json();
    assert.ok(Array.isArray(d.runs));
});

test("GET /api/history/tidak-ada → 404", async () => {
    const r = await fetch(`http://localhost:${PORT}/api/history/tidak-ada`);
    assert.equal(r.status, 404);
});
