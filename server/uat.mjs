// uat.mjs — validasi payload UAT + forwarder ke Google Apps Script.
// Backend hanya MENERUSKAN; data final ada di Google Sheet.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const COMMON_DOMAIN_TYPOS = new Map([
    ["gmail.comm", "gmail.com"],
    ["gmai.com", "gmail.com"],
    ["gmial.com", "gmail.com"],
    ["yahoo.comm", "yahoo.com"],
    ["outlook.comm", "outlook.com"],
]);

export function validateEmailAddress(email) {
    if (typeof email !== "string") return { ok: false, error: "Email tidak valid." };
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) return { ok: false, error: "Email tidak valid." };
    const [, domain = ""] = trimmed.split("@");
    const suggestion = COMMON_DOMAIN_TYPOS.get(domain);
    if (suggestion) {
        return { ok: false, error: `Domain email tampak salah. Mungkin maksud Anda ${suggestion}.` };
    }
    return { ok: true };
}

export function validateUatPayload(body) {
    if (!body || typeof body !== "object") return { ok: false, error: "Body kosong." };
    if (body.consent !== true) return { ok: false, error: "Persetujuan wajib." };
    const emailVerdict = validateEmailAddress(body.email);
    if (!emailVerdict.ok) return emailVerdict;
    for (const f of ["peran", "pengalaman", "freqTools"]) {
        if (typeof body[f] !== "string" || !body[f].trim()) {
            return { ok: false, error: `Field ${f} wajib.` };
        }
    }
    const a = body.answers;
    if (!Array.isArray(a) || a.length !== 10) return { ok: false, error: "Jawaban harus 10 item." };
    for (const v of a) {
        if (!Number.isInteger(v) || v < 1 || v > 5) return { ok: false, error: "Jawaban harus 1..5." };
    }
    return { ok: true };
}

export async function forwardToAppsScript(url, opts, fetchImpl = fetch) {
    const { method = "POST", payload, query } = opts || {};
    let target = url;
    let init;
    if (method === "GET") {
        const qs = new URLSearchParams(query || {}).toString();
        target = qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
        init = { method: "GET" };
    } else {
        init = { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload || {}) };
    }
    const res = await fetchImpl(target, init);
    const text = await res.text();
    if (!res.ok) throw new Error(`Apps Script ${res.status}: ${text.slice(0, 200)}`);
    try { return JSON.parse(text); } catch (_) { throw new Error("Apps Script tidak mengembalikan JSON valid."); }
}
