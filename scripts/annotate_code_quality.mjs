#!/usr/bin/env node
/*
Annotate Code Climate JSON findings with Control IDs and parameters from a control table.

Usage:
  node ci/scripts/annotate_code_quality.mjs input.json output.json

Inputs:
- input.json: Code Climate v2 array of issue objects
- CONTROL_TABLE (env, optional): path to CSV control catalog (see ci/controls/controls.csv)
- CONTROL_JSON (env, optional): path to JSON control catalog (see ci/controls/owasp_controls.json)

Behavior:
- Adds controlIds: ["AUTH-01", ...] into issue object (under remediation metadata)
- Prefixes check_name with [AUTH-01] when a single best match is found
- Appends a Parameters footer in description with Domain, Risk, Methods, Evidence
- Writes a summary file alongside output: <output>.controls-summary.json

This is heuristic for rule-based tools and keyword-based mapping for generic issues. Extend ruleMap below freely.
*/

import fs from "fs";
import path from "path";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
    console.error(
        "Usage: node ci/scripts/annotate_code_quality.mjs input.json output.json",
    );
    process.exit(2);
}

function readJSON(p) {
    return JSON.parse(fs.readFileSync(p, "utf8"));
}

function tryLoadControls() {
    const csvPath =
        process.env.CONTROL_TABLE || path.resolve("ci/controls/controls.csv");
    const jsonPath =
        process.env.CONTROL_JSON ||
        path.resolve("ci/controls/owasp_controls.json");
    if (fs.existsSync(csvPath)) {
        const raw = fs
            .readFileSync(csvPath, "utf8")
            .split(/\r?\n/)
            .filter(Boolean);
        const header = raw
            .shift()
            .split(",")
            .map((s) => s.trim());
        const rows = raw.map((line) => {
            // naive CSV split good enough for simple values (no quotes/commas inside)
            const cols = line.split(",");
            const rec = {};
            header.forEach((h, i) => (rec[h] = (cols[i] || "").trim()));
            return rec;
        });
        const map = new Map();
        for (const r of rows) {
            if (!r.ID) continue;
            map.set(r.ID, r);
        }
        return map;
    }
    if (fs.existsSync(jsonPath)) {
        const obj = readJSON(jsonPath);
        const map = new Map();
        for (const rec of obj.controls || []) map.set(rec.id, rec);
        return map;
    }
    return new Map();
}

// Lightweight rule → control mapping (extend as needed)
// Includes OWASP generic rules + CTDL/WIKA rules for WISE/ESCM
const ruleMap = [
    // --- OWASP / Generic Security Rules ---
    {
        match: /sql\s*injection|g201|parameteri(sed|zed)\s*queries|fmt\.sprintf.*(select|insert|update|delete)/i,
        controls: ["VAL-02", "CTDL-01"],
    },
    {
        match: /xss|cross\s*site\s*scripting|html\s*escape|innerHTML/i,
        controls: ["VAL-03", "CTDL-03"],
    },
    { match: /csrf/i, controls: ["SESS-06", "WIKA-Q15"] },
    { match: /csp|content-security-policy/i, controls: ["VAL-04"] },
    { match: /hsts/i, controls: ["CRYPTO-02"] },
    { match: /tls|ssl\s*version|weak\s*cipher/i, controls: ["CRYPTO-01"] },
    {
        match: /hardcoded\s*(secret|password|api[-_ ]?key)|gitleaks/i,
        controls: ["AUTH-08"],
    },
    { match: /bcrypt|argon2|scrypt|password\s*hash/i, controls: ["AUTH-01"] },
    { match: /jwt/i, controls: ["AUTH-10"] },
    { match: /cors/i, controls: ["API-05"] },
    { match: /rate\s*limit|throttling/i, controls: ["API-02", "AVA-01"] },
    { match: /open\s*redirect/i, controls: ["VAL-08"] },
    {
        match: /dockerfile|hadolint|privileged|latest\s*tag/i,
        controls: ["CONF-08"],
    },
    {
        match: /samesite|httponly|secure\s*cookie/i,
        controls: ["SESS-02", "SESS-06"],
    },
    {
        match: /logging\s*.*(password|token|secret|pii)/i,
        controls: ["LOG-02", "WIKA-Q08"],
    },
    { match: /timeout|circuit\s*breaker/i, controls: ["AVA-02"] },

    // --- CTDL Rules (Citadel Framework Domain) ---
    {
        match: /DB::raw|DB::select|DB::statement|raw\s*query|raw\s*sql/i,
        controls: ["CTDL-01"],
    },
    {
        match: /\$fillable|fillable\s*=/i,
        controls: ["CTDL-02", "WIKA-Q03"],
    },
    {
        match: /\{!!\s*.*\s*!!\}|unescaped\s*(blade\s*)?output/i,
        controls: ["CTDL-03"],
    },
    {
        match: /middleware.*cek_login|middleware.*basic_auth|middleware.*jwt\.verify|missing\s*auth\s*middleware/i,
        controls: ["CTDL-04", "WIKA-Q14"],
    },
    {
        match: /\$request->validate|missing\s*validation|inline\s*validation/i,
        controls: ["CTDL-05", "WIKA-Q02"],
    },
    {
        match: /ComponentsPage::make|citadel\s*lifecycle|make.*view.*business.*schema.*render/i,
        controls: ["CTDL-06"],
    },
    {
        match: /HasCreator|created_by|updated_by|missing\s*creator\s*trait/i,
        controls: ["CTDL-07"],
    },
    {
        match: /ActivityLogged|spatie.*activity|missing\s*activity\s*log/i,
        controls: ["CTDL-08"],
    },
    {
        match: /label\(\)|color\(\)|CitadelEnum|enum.*without.*label/i,
        controls: ["CTDL-09"],
    },
    {
        match: /\$table.*escm_|table\s*prefix|missing\s*table\s*prefix/i,
        controls: ["CTDL-10"],
    },
    {
        match: /checkAccessPermission|missing\s*permission\s*check/i,
        controls: ["CTDL-11"],
    },
    {
        match: /non.?CRUD\s*action|separate\s*method|propose|release|esign/i,
        controls: ["CTDL-12"],
    },
    {
        match: /Backbone\s*interface|BACKBONE\[001\]|schema.*component/i,
        controls: ["CTDL-13"],
    },
    {
        match: /::make\(|Makeable|new\s+Component/i,
        controls: ["CTDL-14"],
    },
    {
        match: /HasNumbering|UseNumbering|auto.*number|document\s*numbering/i,
        controls: ["CTDL-15"],
    },

    // --- WIKA Rules (WIKA/ESCM Domain) ---
    {
        match: /Observer\s*(class)?|app\/Observers/i,
        controls: ["WIKA-Q01"],
    },
    {
        match: /Form\s*Request|app\/Http\/Requests/i,
        controls: ["WIKA-Q02"],
    },
    {
        match: /apiRes\(|api\s*response\s*helper/i,
        controls: ["WIKA-Q04"],
    },
    {
        match: /sync\s*(service|mechanism)|external\s*data\s*sync/i,
        controls: ["WIKA-Q05", "WIKA-Q06"],
    },
    {
        match: /Sync\\Service\\Base|extend\s*Base\s*(sync)?/i,
        controls: ["WIKA-Q06"],
    },
    {
        match: /scopeProject|ESCM::scope|tenant\s*isolation|missing\s*scope/i,
        controls: ["WIKA-Q07"],
    },
    {
        match: /password\s*mask|pin\s*mask|sensitive\s*log|masking/i,
        controls: ["WIKA-Q08"],
    },
    {
        match: /SoftDeletes|soft\s*delete/i,
        controls: ["WIKA-Q09"],
    },
    {
        match: /business\s*key|foreign\s*key.*number/i,
        controls: ["WIKA-Q10"],
    },
    {
        match: /morphMany.*Approval|ApprovableContract|ReleaseStrategy/i,
        controls: ["WIKA-Q11"],
    },
    {
        match: /ProcurementModule|getProcurementNumber|historyModelName/i,
        controls: ["WIKA-Q12"],
    },
    {
        match: /Route::resource|route.*resource/i,
        controls: ["WIKA-Q13"],
    },
    {
        match: /VerifyCsrfToken|\$except\s*=.*csrf/i,
        controls: ["WIKA-Q15"],
    },
];

function inferControls(issue) {
    const hay = [issue.check_name, issue.description, issue.content?.body]
        .filter(Boolean)
        .join("\n");
    const hits = new Set();
    for (const r of ruleMap)
        if (r.match.test(hay)) r.controls.forEach((c) => hits.add(c));
    return Array.from(hits);
}

function enrichDescription(desc, ctl, record) {
    const parts = [desc || ""];
    const p = [];
    if (record?.domain) p.push(`Domain: ${record.domain}`);
    if (record?.risk) p.push(`Risk: ${record.risk}`);
    if (record?.methods) p.push(`Methods: ${record.methods}`);
    if (record?.evidence) p.push(`Evidence: ${record.evidence}`);
    if (p.length)
        parts.push(
            "",
            `Parameters [${ctl}]`,
            p.map((x) => `- ${x}`).join("\n"),
        );
    return parts.join("\n");
}

const issues = readJSON(inPath);
const catalog = tryLoadControls();
const summary = {};

for (const it of issues) {
    const controls = inferControls(it);
    if (!controls.length) continue;
    it.remediation = it.remediation || {};
    it.remediation.controlIds = controls;

    // Prefix check_name with [ID] when single and not already present
    if (controls.length === 1 && !/^\[.*\]/.test(it.check_name)) {
        it.check_name = `[${controls[0]}] ${it.check_name}`;
    }

    // Enrich description with parameters for first control
    const first = controls[0];
    const rec = catalog.get(first);
    it.description = enrichDescription(it.description, first, rec);

    // Count
    for (const c of controls) summary[c] = (summary[c] || 0) + 1;
}

fs.writeFileSync(outPath, JSON.stringify(issues, null, 2));
fs.writeFileSync(
    outPath.replace(/\.json$/i, ".controls-summary.json"),
    JSON.stringify(summary, null, 2),
);
console.log(
    `Annotated ${issues.length} issues. Control hits: ${
        Object.keys(summary).length
    }.`,
);
