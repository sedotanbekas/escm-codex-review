// reviewEngine.mjs
// -----------------------------------------------------------------------------
// Mesin inti Codex Review, di-refactor dari run_codex.mjs menjadi fungsi murni
// yang bisa dipanggil oleh:
//   1) run_codex.mjs  (CLI / GitLab CI/CD)  — jalur lama, tidak berubah perilaku
//   2) server.mjs     (backend HTTP untuk GUI) — jalur baru
//
// Prinsip yang dijaga (knowledge pack §9):
//   - advisory-only & precision-first (hallucination guard tetap aktif → FP=0)
//   - tanpa fine-tuning (prompting/few-shot di file prompt, tidak diubah di sini)
//   - secret via env var (engine TIDAK membaca env; apiKey diserahkan via config)
//
// Engine ini SENGAJA tidak menyentuh process.argv / fs untuk argumen / process.env.
// Semua I/O (baca prompt, baca diff, tulis artefak, baca secret) tetap menjadi
// tanggung jawab pemanggil (run_codex.mjs atau server.mjs). Dengan begitu kontrak
// CLI yang dipakai .gitlab-ci.yml tidak berubah sama sekali.
// -----------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import crypto from "crypto";

// --- Konstanta domain (sebelumnya variabel modul di run_codex.mjs) ------------

export const severityWeight = {
    info: 0,
    minor: 1,
    major: 2,
    critical: 3,
    blocker: 4,
};

const controlRiskFloor = {
    high: "major",
    medium: "minor",
    low: "info",
};

const controlIdPattern =
    /\b(?:CTDL-\d+|WIKA-Q\d+|AUTH-\d+|SESS-\d+|VAL-\d+|CRYPTO-\d+|API-\d+|LOG-\d+|CONF-\d+|AVA-\d+)\b/gi;

// JSON schema untuk structured output OpenAI (Code Climate v2 compatible)
export const reviewSchema = {
    type: "object",
    additionalProperties: false,
    required: ["issues", "summary_markdown"],
    properties: {
        issues: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                required: [
                    "description",
                    "check_name",
                    "severity",
                    "location",
                    "confidence",
                    "categories",
                    "fingerprint",
                    "references",
                    "recommendation",
                    "tests",
                    "notes",
                ],
                properties: {
                    description: { type: "string" },
                    check_name: { type: "string" },
                    severity: {
                        type: "string",
                        enum: ["info", "minor", "major", "critical", "blocker"],
                    },
                    confidence: {
                        type: "string",
                        enum: ["low", "medium", "high"],
                    },
                    categories: { type: "array", items: { type: "string" } },
                    fingerprint: { type: "string" },
                    location: {
                        type: "object",
                        additionalProperties: false,
                        required: ["path", "lines"],
                        properties: {
                            path: { type: "string" },
                            lines: {
                                type: "object",
                                additionalProperties: false,
                                required: ["begin"],
                                properties: { begin: { type: "integer" } },
                            },
                        },
                    },
                    references: { type: "array", items: { type: "string" } },
                    recommendation: { type: "string" },
                    tests: { type: "array", items: { type: "string" } },
                    notes: { type: "string" },
                },
            },
        },
        summary_markdown: { type: "string" },
    },
};

// --- Helper CSV / kontrol (dipindahkan apa adanya) ----------------------------

function parseCsvLine(line) {
    const out = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (ch === "," && !inQuotes) {
            out.push(cur.trim());
            cur = "";
            continue;
        }
        cur += ch;
    }
    out.push(cur.trim());
    return out;
}

// Memuat katalog risiko kontrol dari controls.csv.
// controlTablePath (opsional) menimpa lokasi default — sebelumnya env CONTROL_TABLE.
export function loadControlRiskCatalog(controlTablePath = null) {
    const candidates = [
        controlTablePath ? path.resolve(controlTablePath) : null,
        path.resolve(".codex-review/controls/controls.csv"),
        path.resolve("ci/controls/controls.csv"),
        path.resolve("controls/controls.csv"),
    ].filter(Boolean);

    const controlPath = candidates.find((p) => fs.existsSync(p));
    if (!controlPath) {
        return { sourcePath: null, riskById: new Map() };
    }

    const lines = fs
        .readFileSync(controlPath, "utf8")
        .split(/\r?\n/)
        .filter((line) => line.trim());
    if (lines.length <= 1) {
        return { sourcePath: controlPath, riskById: new Map() };
    }

    const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
    const idIndex = header.indexOf("id");
    const riskIndex = header.indexOf("risk");
    if (idIndex < 0 || riskIndex < 0) {
        return { sourcePath: controlPath, riskById: new Map() };
    }

    const riskById = new Map();
    for (let i = 1; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        const id = (cols[idIndex] || "").trim().toUpperCase();
        const risk = (cols[riskIndex] || "").trim().toLowerCase();
        if (!id) continue;
        if (!["high", "medium", "low"].includes(risk)) continue;
        riskById.set(id, risk);
    }

    return { sourcePath: controlPath, riskById };
}

function collectControlIdsFromText(text = "") {
    const found = String(text).match(controlIdPattern) || [];
    return Array.from(new Set(found.map((id) => id.toUpperCase())));
}

export function collectControlIdsFromIssue(issue) {
    const hay = [
        issue?.check_name,
        issue?.description,
        issue?.notes,
        issue?.recommendation,
    ]
        .filter(Boolean)
        .join("\n");
    return collectControlIdsFromText(hay);
}

function applySeverityFloorFromControls(issue, riskById) {
    if (!riskById || riskById.size === 0) return issue;
    const ids = collectControlIdsFromIssue(issue);
    if (!ids.length) return issue;

    let requiredFloor = null;
    for (const id of ids) {
        const risk = riskById.get(id);
        if (!risk) continue;
        const floor = controlRiskFloor[risk];
        if (!floor) continue;
        if (
            !requiredFloor ||
            severityWeight[floor] > severityWeight[requiredFloor]
        ) {
            requiredFloor = floor;
        }
    }
    if (!requiredFloor) return issue;

    const current = String(issue.severity || "minor").toLowerCase();
    const currentWeight = severityWeight[current] ?? severityWeight.minor;
    if (currentWeight >= severityWeight[requiredFloor]) return issue;

    issue.severity = requiredFloor;
    const floorNote = `Severity normalized to ${requiredFloor.toUpperCase()} based on control risk floor.`;
    if (!String(issue.notes || "").includes(floorNote)) {
        issue.notes = issue.notes ? `${issue.notes}\n${floorNote}` : floorNote;
    }
    return issue;
}

// --- Chunking & pengumpulan input (dipindahkan apa adanya) --------------------

function chunkText(label, text, maxChunkChars) {
    const chunks = [];
    for (let i = 0; i < text.length; i += maxChunkChars) {
        const slice = text.slice(i, i + maxChunkChars);
        chunks.push(`### ${label} (part ${chunks.length + 1})\n\n${slice}`);
    }
    return chunks;
}

function isProbablyBinary(buf) {
    const text = buf.toString("utf8");
    const control = text.replace(/[\r\n\t\f\b -]/g, "");
    return control.length / text.length < 0.9;
}

// --- Glob helpers (dipindahkan apa adanya) ---
function globToRegExp(glob) {
    let g = glob
        .replace(/[.+^${}()|\\]/g, "\\$&")
        .replace(/\*\*/g, "::DOUBLESTAR::")
        .replace(/\*/g, "[^/]*")
        .replace(/::DOUBLESTAR::/g, ".*")
        .replace(/\?/g, ".");
    return new RegExp(`^${g}$`);
}
function parseGlobList(envVal) {
    if (!envVal) return [];
    return envVal
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map(globToRegExp);
}
function matchesAny(file, regexps) {
    return regexps.some((re) => re.test(file));
}

// Mengumpulkan seluruh berkas repo untuk full scan.
// cfg: { repoRoot, allowedExts, maxFileChars, excludeGlobs, securityOnlyGlobs, log }
export function gatherFullRepoPieces(cfg) {
    const {
        repoRoot,
        allowedExts,
        maxFileChars,
        excludeGlobsRaw = "",
        securityOnlyGlobsRaw = "",
        log = () => {},
    } = cfg;

    const fileListRaw = execSync("git ls-files", { cwd: repoRoot })
        .toString()
        .trim();
    const files = fileListRaw ? fileListRaw.split("\n") : [];
    const pieces = [];
    const excludeGlobs = parseGlobList(excludeGlobsRaw);
    const securityOnlyGlobs = parseGlobList(securityOnlyGlobsRaw);
    const securityOnlySet = new Set();

    log(`[codex] full-scan: ${files.length} tracked files`);

    for (const file of files) {
        if (!file) continue;
        const abs = path.join(repoRoot, file);
        try {
            const stat = fs.statSync(abs);
            if (!stat.isFile()) continue;
            if (stat.size === 0) continue;
            if (
                securityOnlyGlobs.length &&
                matchesAny(file, securityOnlyGlobs)
            ) {
                securityOnlySet.add(file);
            }
            if (excludeGlobs.length && matchesAny(file, excludeGlobs)) {
                continue;
            }
            const ext = path.extname(file).toLowerCase();
            if (allowedExts.length && ext && !allowedExts.includes(ext)) {
                continue;
            }
            if (stat.size > maxFileChars * 4) {
                log(`[codex] skip large file (${stat.size} bytes): ${file}`);
                continue;
            }
            const buf = fs.readFileSync(abs);
            if (buf.length === 0) continue;
            if (isProbablyBinary(buf)) {
                log(`[codex] skip probable binary file: ${file}`);
                continue;
            }
            const content = buf.toString("utf8");
            if (!content.trim()) continue;
            const trimmed =
                content.length > maxFileChars
                    ? content.slice(0, maxFileChars) + "\n... [truncated]"
                    : content;
            pieces.push(`FILE: ${file}\n\n${trimmed}`);
        } catch (err) {
            log(`[codex] error reading ${file}: ${err.message}`);
        }
    }

    const overview = execSync("git status --short --branch", {
        cwd: repoRoot,
    }).toString();
    pieces.unshift(`REPO OVERVIEW\n\n${overview}`);
    return { pieces, securityOnlySet };
}

// Memecah teks diff menjadi pieces per-file.
// cfg: { diffText, maxChunkChars, diffExtsRaw, log }
export function gatherDiffPieces(cfg) {
    const { diffText, maxChunkChars, diffExtsRaw = "", log = () => {} } = cfg;

    if (!diffText.trim()) {
        log("[codex] diff file empty, returning placeholder chunk");
        return ["No diff content provided."];
    }

    const diffCodeExts = new Set(
        (
            diffExtsRaw ||
            ".php,.blade.php,.js,.mjs,.cjs,.ts,.vue,.env,.sql,.sh"
        )
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean),
    );
    const diffNoExtFiles = new Set([
        "Dockerfile",
        "Dockerfile.test",
        "Dockerfile.test_po",
        "Makefile",
        ".env",
        ".env.example",
    ]);

    function isReviewable(baseName, effectiveExt) {
        if (effectiveExt && diffCodeExts.has(effectiveExt)) return true;
        if (diffNoExtFiles.has(baseName)) return true;
        if (baseName.startsWith("Dockerfile")) return true;
        return false;
    }

    const fileDiffs = diffText
        .split(/(?=^diff --git )/m)
        .filter((s) => s.trim());
    if (fileDiffs.length <= 1) {
        return [`MERGE REQUEST2 DIFF\n\n${diffText}`];
    }

    const pieces = [];
    let skipped = 0;
    for (let i = 0; i < fileDiffs.length; i++) {
        const fd = fileDiffs[i];
        const headerMatch = fd.match(/^diff --git a\/(.+?) b\/(.+)/);
        const fileName = headerMatch ? headerMatch[2] : "";
        const ext = path.extname(fileName).toLowerCase();
        const isBladePhp = fileName.endsWith(".blade.php");
        const effectiveExt = isBladePhp ? ".blade.php" : ext;

        const baseName = path.basename(fileName);
        if (!isReviewable(baseName, effectiveExt)) {
            log(
                `[codex] diff skip non-code file: ${fileName} (${effectiveExt || "no-ext"})`,
            );
            skipped++;
            continue;
        }

        if (fd.length > maxChunkChars) {
            log(
                `[codex] diff sub-splitting oversized file: ${fileName} (${fd.length} chars)`,
            );
            const subChunks = chunkText(
                `DIFF FILE ${fileName}`,
                fd,
                maxChunkChars,
            );
            for (const sc of subChunks) {
                pieces.push(sc);
            }
        } else {
            pieces.push(
                `DIFF FILE ${i + 1}/${fileDiffs.length} (${fileName})\n\n${fd}`,
            );
        }
    }

    log(
        `[codex] diff split into ${pieces.length} pieces (${skipped} non-code files skipped)`,
    );
    return { pieces, skipped };
}

// Mengelompokkan pieces menjadi chunk yang muat di context window.
export function batchPieces(piecesArr, label, maxChunkChars) {
    const out = [];
    let buffer = "";
    let labelIndex = 0;
    for (const piece of piecesArr) {
        const sep = buffer ? "\n\n---\n\n" : "";
        if (buffer.length + sep.length + piece.length > maxChunkChars) {
            if (buffer) {
                out.push(`### ${label} ${++labelIndex}\n\n${buffer}`);
                buffer = "";
            }
        }
        buffer += (buffer ? sep : "") + piece;
    }
    if (buffer) out.push(`### ${label} ${++labelIndex}\n\n${buffer}`);
    return out;
}

// -----------------------------------------------------------------------------
// BARU: ubah kode mentah (paste dari GUI) menjadi "diff sintetis" satu file.
// Tujuan: jalur GUI input "Kode" tetap melewati hallucination guard, mapping
// file:line, dan dedup yang sama dengan jalur diff — tidak ada logika ilmiah
// yang dilewati, sehingga klaim precision tetap valid.
//
// Setiap baris kode dijadikan baris tambahan (+) dalam satu hunk, dengan header
// unified-diff yang sah, sehingga regex `^\+\+\+ b/(.+)$` dan pemetaan baris di
// run_codex.mjs/engine bekerja apa adanya. Nomor baris pada hunk dimulai dari 1
// agar lokasi temuan dari model sinkron dengan baris kode asli.
// -----------------------------------------------------------------------------
export function codeToSyntheticDiff(code, fileName = "submitted_snippet.php") {
    const safeName = String(fileName || "submitted_snippet.php").replace(
        /^[\/.]+/,
        "",
    );
    const lines = String(code).replace(/\r\n/g, "\n").split("\n");
    // Buang baris kosong terakhir akibat trailing newline agar count akurat
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    const count = lines.length || 1;
    const body = (lines.length ? lines : [""])
        .map((l) => `+${l}`)
        .join("\n");
    return (
        `diff --git a/${safeName} b/${safeName}\n` +
        `new file mode 100644\n` +
        `index 0000000..1111111\n` +
        `--- /dev/null\n` +
        `+++ b/${safeName}\n` +
        `@@ -0,0 +1,${count} @@\n` +
        `${body}\n`
    );
}

// -----------------------------------------------------------------------------
// assessInput — gerbang validasi input untuk jalur GUI.
//
// Reviewer hanya meninjau hal yang memang KODE. Ini meniru perilaku pipeline CI
// yang melewati berkas non-kode. Tujuannya mencegah false positive yang dipicu
// input non-kode (mis. mengetik "blablabla" di nama file controller → model
// mengarang temuan dari nama berkas). Guard lokasi (file:line) tidak menangkap
// kasus ini karena file sintetisnya "nyata"; maka kita saring di hulu.
//
// Mengembalikan { ok: boolean, reason?: string }. Tidak memanggil API.
// -----------------------------------------------------------------------------
export function assessInput(source, inputType = "code") {
    const text = String(source || "");
    const trimmed = text.trim();
    if (!trimmed) {
        return { ok: false, reason: "Input kosong — tempel kode atau diff lebih dulu." };
    }

    if (inputType === "diff") {
        const looksDiff =
            /(^|\n)diff --git /.test(text) ||
            /(^|\n)@@ /.test(text) ||
            /(^|\n)\+\+\+ /.test(text) ||
            /(^|\n)--- /.test(text);
        if (!looksDiff) {
            return {
                ok: false,
                reason: "Ini tidak tampak seperti unified diff (tidak ada 'diff --git' atau '@@'). Tempel diff yang valid, atau pindah ke mode Kode.",
            };
        }
        return { ok: true };
    }

    // Mode kode: butuh sejumlah "sinyal kode" agar bukan sekadar teks/kata acak.
    const signals = [
        /<\?php/i,
        /\bfunction\b/,
        /\bclass\b/,
        /\bnamespace\b/,
        /\buse\s/,
        /\breturn\b/,
        /\b(public|private|protected)\b/,
        /\b(if|foreach|while|switch|for)\b/,
        /[;{}]/,
        /\$\w+/,
        /->/,
        /::/,
        /=>/,
        /\([^)]*\)/,
    ];
    let hits = 0;
    for (const re of signals) {
        if (re.test(text)) hits++;
    }

    if (hits < 2) {
        return {
            ok: false,
            reason: "Input tidak tampak seperti kode sumber PHP/Laravel. Tempel potongan kode yang sebenarnya (mis. berisi function, variabel $…, atau ekspresi seperti DB::select(...)).",
        };
    }
    return { ok: true };
}

// --- Parsing payload OpenAI (dipindahkan apa adanya) --------------------------

function parseResponsesPayload(data, text, chunkIndex, log) {
    try {
        const outputs = Array.isArray(data?.output) ? data.output : [];
        for (const out of outputs) {
            const content = Array.isArray(out?.content) ? out.content : [];
            const jsonBlock = content.find(
                (c) =>
                    c &&
                    (c.type === "output_json" ||
                        c.type === "json" ||
                        c.type === "parsed"),
            );
            if (jsonBlock?.json) return jsonBlock.json;

            const textBlock = content.find(
                (c) => c && (c.type === "output_text" || c.type === "text"),
            );
            if (textBlock?.text && String(textBlock.text).trim()) {
                try {
                    return JSON.parse(textBlock.text);
                } catch (_) {
                    // ignore, try other blocks
                }
            }
        }
        if (typeof data?.output_text === "string" && data.output_text.trim()) {
            return JSON.parse(data.output_text);
        }
    } catch (e) {
        log(`[codex] chunk ${chunkIndex + 1} parseResponses error: ${e.message}`);
    }
    return null;
}

function parseChatPayload(data, text, chunkIndex, log) {
    const message = data?.choices?.[0]?.message;
    const finishReason = data?.choices?.[0]?.finish_reason;

    function tryRepairJson(raw) {
        if (!raw || typeof raw !== "string") return null;
        let s = raw.trim();
        s = s
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/```\s*$/, "")
            .trim();
        try {
            return JSON.parse(s);
        } catch (_) {
            // truncated — extract complete objects
        }
        const issuesStart = s.indexOf('"issues"');
        if (issuesStart < 0) return null;
        const arrStart = s.indexOf("[", issuesStart);
        if (arrStart < 0) return null;

        const issues = [];
        let depth = 0;
        let objStart = -1;
        for (let i = arrStart + 1; i < s.length; i++) {
            const ch = s[i];
            if (ch === "{" && objStart < 0) {
                objStart = i;
                depth = 1;
            } else if (ch === "{" && objStart >= 0) {
                depth++;
            } else if (ch === "}" && objStart >= 0) {
                depth--;
                if (depth === 0) {
                    const objStr = s.slice(objStart, i + 1);
                    try {
                        issues.push(JSON.parse(objStr));
                    } catch (_) {
                        // incomplete object, skip
                    }
                    objStart = -1;
                }
            }
        }

        if (issues.length > 0) {
            log(
                `[codex] chunk ${chunkIndex + 1} JSON REPAIR: salvaged ${issues.length} issues from truncated response`,
            );
            return {
                issues,
                summary_markdown: "(truncated response — partial results)",
            };
        }
        return null;
    }

    if (message && Array.isArray(message.content)) {
        const jsonPart =
            message.content.find((part) => part.type === "json") ??
            message.content.find((part) => part.type === "output_json");
        if (jsonPart?.json) return jsonPart.json;

        const textPart =
            message.content.find((part) => part.type === "text") ??
            message.content.find((part) => part.type === "output_text");
        if (textPart?.text && String(textPart.text).trim()) {
            try {
                return JSON.parse(textPart.text);
            } catch (err) {
                log(
                    `[codex] chunk ${chunkIndex + 1} JSON.parse (chat text content) failed: ${err.message}`,
                );
            }
        }
    }

    if (
        message &&
        typeof message.content === "string" &&
        message.content.trim()
    ) {
        try {
            return JSON.parse(message.content);
        } catch (err) {
            log(
                `[codex] chunk ${chunkIndex + 1} JSON.parse (chat string content) failed: ${err.message}`,
            );
        }
    }

    if (typeof data?.output_text === "string" && data.output_text.trim()) {
        try {
            return JSON.parse(data.output_text);
        } catch (err) {
            log(
                `[codex] chunk ${chunkIndex + 1} JSON.parse (legacy output_text) failed: ${err.message}`,
            );
        }
    }
    if (data?.output_json) return data.output_json;

    if (finishReason === "length") {
        const rawContent =
            message?.content ||
            (typeof data?.output_text === "string" ? data.output_text : null);
        log(
            `[codex] chunk ${chunkIndex + 1} response truncated (finish_reason=length), attempting JSON repair...`,
        );
        const repaired = tryRepairJson(
            typeof rawContent === "string"
                ? rawContent
                : JSON.stringify(rawContent),
        );
        if (repaired) return repaired;
    }
    return null;
}

// Memanggil OpenAI untuk satu chunk. Semua konfigurasi diserahkan via `cfg`,
// termasuk recordUsage callback agar statistik biaya dikumpulkan oleh pemanggil.
// cfg: { apiKey, model, maxOutputTokens, disableResponses, recordUsage, log }
export async function callOpenAI(promptText, payloadText, chunkIndex, cfg) {
    const {
        apiKey,
        model,
        maxOutputTokens,
        disableResponses,
        recordUsage = () => {},
        log = () => {},
    } = cfg;

    const responsesBody = {
        model,
        input: `${promptText}\n\n---\n\n${payloadText}`,
        temperature: 0,
        max_output_tokens: maxOutputTokens,
        text: {
            format: {
                name: "codex_review",
                type: "json_schema",
                json_schema: {
                    name: "codex_review",
                    schema: reviewSchema,
                    strict: true,
                },
            },
        },
    };

    try {
        if (!disableResponses) {
            const res = await fetch("https://api.openai.com/v1/responses", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(responsesBody),
            });

            const text = await res.text();
            log(
                `[codex] responses chunk ${chunkIndex + 1} status=${res.status} length=${text.length}`,
            );

            if (res.status === 401) {
                log(`[codex] 401 body (responses): ${text}`);
                throw new Error("401 Unauthorized from OpenAI API");
            }

            if (res.status === 200) {
                let data;
                try {
                    data = JSON.parse(text);
                } catch (err) {
                    log(
                        `[codex] responses parse error chunk ${chunkIndex + 1}: ${err.message}`,
                    );
                }
                if (data) {
                    if (data.usage) {
                        recordUsage("responses", chunkIndex, data.usage);
                    }
                    const parsed = parseResponsesPayload(
                        data,
                        text,
                        chunkIndex,
                        log,
                    );
                    if (parsed) return parsed;
                    log(
                        `[codex] responses parse returned null, will try chat fallback`,
                    );
                }
            } else {
                log(
                    `[codex] responses non-200: ${text.slice(0, 400)}... (will try chat fallback)`,
                );
            }
        }
    } catch (err) {
        log(
            `[codex] responses call failed: ${err.message} (will try chat fallback)`,
        );
    }

    const chatBody = {
        model,
        messages: [
            { role: "system", content: promptText },
            { role: "user", content: payloadText },
        ],
        temperature: 0,
        max_tokens: maxOutputTokens,
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "codex_review",
                schema: reviewSchema,
                strict: true,
            },
        },
    };

    const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(chatBody),
    });

    const chatText = await chatRes.text();
    log(
        `[codex] chat chunk ${chunkIndex + 1} status=${chatRes.status} length=${chatText.length}`,
    );
    if (chatRes.status === 401) {
        log(`[codex] 401 body (chat): ${chatText}`);
        throw new Error("401 Unauthorized from OpenAI API");
    }
    if (chatRes.status !== 200) {
        log(`[codex] chat non-200 body: ${chatText.slice(0, 400)}...`);
        throw new Error(`OpenAI API error (status ${chatRes.status})`);
    }

    let chatData;
    try {
        chatData = JSON.parse(chatText);
    } catch (err) {
        log(`[codex] chat parse error chunk ${chunkIndex + 1}: ${err.message}`);
        throw err;
    }
    if (chatData?.usage) {
        recordUsage("chat", chunkIndex, chatData.usage);
    }
    const parsedChat = parseChatPayload(chatData, chatText, chunkIndex, log);
    if (parsedChat) return parsedChat;

    log(
        `[codex] unexpected chat response chunk ${chunkIndex + 1}: ${chatText.slice(0, 400)}...`,
    );
    return { issues: [], summary_markdown: "" };
}

// --- Normalisasi & Code Climate (dipindahkan apa adanya) ----------------------

export function normaliseIssue(issue) {
    const clone = { ...issue };
    if (!clone.confidence) clone.confidence = "medium";
    if (!Array.isArray(clone.categories) || clone.categories.length === 0) {
        clone.categories = ["Security"];
    }
    if (!clone.location || typeof clone.location.path !== "string") {
        clone.location = {
            path: "unknown",
            lines: { begin: 1 },
        };
    } else if (
        !clone.location.lines ||
        typeof clone.location.lines.begin !== "number"
    ) {
        clone.location.lines = { begin: 1 };
    }
    if (!clone.fingerprint) {
        const hash = crypto
            .createHash("sha1")
            .update(
                `${clone.check_name}|${clone.description}|${clone.location.path}|${clone.location.lines.begin}`,
            )
            .digest("hex");
        clone.fingerprint = hash;
    }
    if (!Array.isArray(clone.references)) clone.references = [];
    if (!Array.isArray(clone.tests)) clone.tests = [];
    if (!clone.recommendation) {
        clone.recommendation = "Provide a concrete remediation step.";
    }
    if (!clone.notes) clone.notes = "";
    return clone;
}

export function toCodeClimate(issue) {
    return {
        type: "issue",
        engine_name: "codex",
        description: issue.description,
        check_name: issue.check_name,
        fingerprint: issue.fingerprint,
        severity: issue.severity,
        categories: issue.categories,
        location: issue.location,
        remediation_points: 0,
    };
}

// -----------------------------------------------------------------------------
// Orkestrasi inti: menerima chunks + knownFiles + config, menjalankan worker
// pool ke OpenAI, lalu menerapkan hallucination guard + dedup + severity floor.
// Mengembalikan { aggregated, summaries, hallucinatedCount }.
//
// Ini adalah jantung yang dipakai BERSAMA oleh CLI dan GUI. Logikanya identik
// dengan loop worker di run_codex.mjs lama.
// -----------------------------------------------------------------------------
export async function runReviewTasks({
    tasks,
    knownFiles,
    controlCatalog,
    concurrency,
    openAiConfig,
    onProgress = () => {},
    log = () => {},
}) {
    const aggregated = [];
    const summaries = [];
    const seen = new Map();
    let hallucinatedCount = 0;

    let next = 0;
    let done = 0;
    const total = tasks.length;
    const workers = Math.max(1, Math.min(concurrency, total || 1));
    // Lapor total chunk di awal (untuk progress bar GUI). CLI memakai default
    // no-op sehingga perilakunya tidak berubah.
    onProgress(0, total);

    async function worker() {
        while (true) {
            const i = next++;
            if (i >= total) break;
            const { prompt, payload } = tasks[i];
            try {
                const result = await callOpenAI(prompt, payload, i, {
                    ...openAiConfig,
                    log,
                });
                const issues = Array.isArray(result?.issues)
                    ? result.issues
                    : [];
                for (const issue of issues) {
                    const normalised = applySeverityFloorFromControls(
                        normaliseIssue(issue),
                        controlCatalog.riskById,
                    );
                    // Strict locations: buang minor/info tanpa path valid
                    if (
                        !normalised.location ||
                        typeof normalised.location.path !== "string" ||
                        !normalised.location.path.trim()
                    ) {
                        const sev = String(
                            normalised.severity || "",
                        ).toLowerCase();
                        if (sev === "minor" || sev === "info") {
                            continue;
                        }
                        normalised.location = {
                            path: "unknown",
                            lines: { begin: 1 },
                        };
                    }
                    // Hallucination guard: buang temuan untuk file tak dikenal
                    const fPath = (normalised.location?.path || "").replace(
                        /^\/+/,
                        "",
                    );
                    if (fPath && fPath !== "unknown" && knownFiles.size > 0) {
                        let matched = knownFiles.has(fPath);
                        if (!matched) {
                            for (const kf of knownFiles) {
                                if (
                                    kf.endsWith(fPath) ||
                                    fPath.endsWith(kf) ||
                                    (kf.endsWith("/" + path.basename(fPath)) &&
                                        path.basename(fPath) ===
                                            path.basename(kf))
                                ) {
                                    matched = true;
                                    if (
                                        kf.endsWith(fPath) ||
                                        fPath.endsWith(kf)
                                    ) {
                                        normalised.location.path = kf.endsWith(
                                            fPath,
                                        )
                                            ? kf
                                            : fPath;
                                    }
                                    break;
                                }
                            }
                        }
                        if (!matched) {
                            log(
                                `[codex] HALLUCINATION filtered: "${fPath}" not in known files`,
                            );
                            hallucinatedCount++;
                            continue;
                        }
                    }
                    // Dedup by content (rule + path + line)
                    const ruleMatch = (normalised.check_name || "").match(
                        /\[([A-Z]+-[A-Z0-9]+)\]/i,
                    );
                    const ruleId = ruleMatch
                        ? ruleMatch[1].toUpperCase()
                        : (normalised.check_name || "").slice(0, 60);
                    const dedupPath = normalised.location?.path || "unknown";
                    const dedupLine = normalised.location?.lines?.begin || 0;
                    const dedupKey = `${ruleId}|${dedupPath}|${dedupLine}`;
                    if (!seen.has(dedupKey)) {
                        aggregated.push(normalised);
                        seen.set(dedupKey, true);
                    } else {
                        log(`[codex] DEDUP filtered: ${dedupKey}`);
                    }
                }
                if (result?.summary_markdown) {
                    summaries.push(result.summary_markdown.trim());
                }
            } catch (err) {
                log(`[codex] chunk ${i + 1} failed: ${err.message}`);
            }
            done++;
            onProgress(done, total);
        }
    }

    const pool = Array.from({ length: workers }, () => worker());
    await Promise.all(pool);

    return { aggregated, summaries, hallucinatedCount };
}

// -----------------------------------------------------------------------------
// reviewSource — orkestrasi tingkat tinggi untuk jalur GUI (server.mjs).
//
// Menerima input langsung dari pengguna (kode mentah ATAU diff) dan mengembalikan
// hasil review lengkap, tanpa menyentuh filesystem untuk input/output. Server
// HTTP cukup memanggil fungsi ini lalu mengirim hasilnya sebagai JSON.
//
// Jalur "kode" dibungkus menjadi diff sintetis lebih dulu (codeToSyntheticDiff)
// agar hallucination guard, pemetaan file:line, dan dedup berjalan identik dengan
// jalur diff — menjaga klaim precision tetap valid.
//
// params:
//   source       : string  — isi kode atau teks diff dari pengguna
//   inputType    : "code" | "diff"
//   mode         : "diff"  — (full scan butuh repo nyata; GUI selalu mode diff)
//   prompt       : string  — isi system prompt (few-shot rulebook)
//   fileName     : string  — nama berkas untuk input "code" (opsional)
//   controlCatalog, openAiConfig: lihat runReviewTasks
//   maxChunkChars, concurrency, diffExtsRaw, log
//
// return: { issues, summaries, hallucinatedCount, counts, overallRisk,
//           triggeredControlIds, knownFiles }
// -----------------------------------------------------------------------------
export async function reviewSource({
    source,
    inputType = "code",
    prompt,
    fileName = "submitted_snippet.php",
    controlCatalog,
    openAiConfig,
    maxChunkChars = 120000,
    concurrency = 4,
    diffExtsRaw = "",
    onProgress = () => {},
    log = () => {},
}) {
    // 1) Normalisasi input menjadi teks diff.
    const diffText =
        inputType === "code"
            ? codeToSyntheticDiff(source, fileName)
            : String(source || "");

    // 2) knownFiles dari header diff (sama seperti run_codex.mjs mode diff).
    const knownFiles = new Set();
    const diffPathRegex = /^\+\+\+\s+b\/(.+)$/gm;
    let m;
    while ((m = diffPathRegex.exec(diffText)) !== null) {
        knownFiles.add(m[1]);
    }

    // 3) Pecah jadi pieces lalu batch jadi chunks.
    const res = gatherDiffPieces({ diffText, maxChunkChars, diffExtsRaw, log });
    const pieces = Array.isArray(res) ? res : res.pieces;
    const chunks = batchPieces(pieces, "Batch", maxChunkChars);

    // 4) Jalankan review (OpenAI + guard + dedup).
    const tasks = chunks.map((payload) => ({ prompt, payload }));
    const { aggregated, summaries, hallucinatedCount } = await runReviewTasks({
        tasks,
        knownFiles,
        controlCatalog,
        concurrency,
        openAiConfig,
        onProgress,
        log,
    });

    // 5) Statistik ringkas untuk ditampilkan di GUI.
    const counts = { blocker: 0, critical: 0, major: 0, minor: 0, info: 0 };
    for (const it of aggregated) {
        const sev = (it.severity || "minor").toLowerCase();
        if (counts[sev] !== undefined) counts[sev]++;
    }
    const overallRisk =
        counts.blocker > 0
            ? "blocker"
            : counts.critical > 0
              ? "critical"
              : counts.major > 0
                ? "major"
                : counts.minor > 0
                  ? "minor"
                  : "info";

    const triggeredControlIds = new Set();
    for (const issue of aggregated) {
        for (const id of collectControlIdsFromIssue(issue)) {
            if (
                controlCatalog.riskById.size === 0 ||
                controlCatalog.riskById.has(id)
            ) {
                triggeredControlIds.add(id);
            }
        }
    }

    return {
        issues: aggregated,
        summaries,
        hallucinatedCount,
        counts,
        overallRisk,
        triggeredControlIds: Array.from(triggeredControlIds).sort(),
        knownFiles: Array.from(knownFiles),
    };
}
