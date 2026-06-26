import { test } from "node:test";
import assert from "node:assert/strict";
import { validateUatPayload, forwardToAppsScript } from "../server/uat.mjs";

function goodBody() {
    return { consent: true, email: "dimas@wika.co.id", peran: "Backend Developer",
        pengalaman: "3-5 tahun", freqTools: "Sering",
        answers: [4, 2, 4, 2, 5, 2, 4, 1, 4, 2], komentar: "" };
}
test("payload valid lolos", () => { assert.deepEqual(validateUatPayload(goodBody()), { ok: true }); });
test("consent false ditolak", () => { assert.equal(validateUatPayload({ ...goodBody(), consent: false }).ok, false); });
test("email invalid ditolak", () => { assert.equal(validateUatPayload({ ...goodBody(), email: "x" }).ok, false); });
test("email typo domain umum ditolak", () => { assert.equal(validateUatPayload({ ...goodBody(), email: "rafifn.a18@gmail.comm" }).ok, false); });
test("answers bukan 10 ditolak", () => { assert.equal(validateUatPayload({ ...goodBody(), answers: [1, 2, 3] }).ok, false); });
test("answers di luar 1..5 ditolak", () => { assert.equal(validateUatPayload({ ...goodBody(), answers: [4,2,4,2,5,2,4,1,4,9] }).ok, false); });
test("forwardToAppsScript GET menempel query & parse JSON", async () => {
    let calledUrl = "";
    const fakeFetch = async (url) => { calledUrl = url; return { ok: true, status: 200, text: async () => JSON.stringify({ exists: true }) }; };
    const out = await forwardToAppsScript("https://script/x", { method: "GET", query: { email: "a@b.com" } }, fakeFetch);
    assert.equal(out.exists, true);
    assert.match(calledUrl, /email=a%40b\.com/);
});
test("forwardToAppsScript non-2xx melempar", async () => {
    const fakeFetch = async () => ({ ok: false, status: 500, text: async () => "err" });
    await assert.rejects(() => forwardToAppsScript("https://script/x", { method: "POST", payload: {} }, fakeFetch));
});
