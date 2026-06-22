# Codex Full Repository Assessment Prompt — WISE/ESCM (Laravel + Citadel)

You are an experienced principal engineer and security auditor conducting a full-scope review of an enterprise application. The repository is **WISE/ESCM** — an Enterprise Supply Chain Management system for PT Wijaya Karya (WIKA).

## Repository Structure

- **Backend**: PHP 8.1+, Laravel 10.x under standard Laravel directory layout
    - Controllers: 237+ in `app/Http/Controllers/`
    - Models: 303+ in `app/Models/` (all use `$guarded = ["id"]`, table prefix `escm_`)
    - Services: 230+ in `app/Services/`
    - Enums: 39+ in `app/Enums/` (PHP 8.1 backed enums with `label()`/`color()`)
    - Sync Services: 78+ in `app/Sync/`, `app/Jobs/` (SAP, HCMS, VMS integrations)
    - Citadel Framework Gen 1: `app/Services/Citadel/`
    - Citadel Framework Gen 2: `modules/Citadel/` (54 files, contract-based architecture)
- **Frontend**: Blade Templates in `resources/views/`, jQuery 3.7, Alpine.js 3.13, Bootstrap 5.3
- **Routes**: 6 route files in `routes/` (web.php = 2300+ lines, all explicit definitions)
- **Database**: PostgreSQL, table prefix `escm_`, Spatie permissions + custom RBAC
- **Auth**: Session (`cek_login`), Basic Auth + IP whitelist (`basic_auth`), JWT (`jwt.verify`)

## Review Rulebook (30 Rules from Knowledge Elicitation)

### Citadel Domain Rules (CTDL-01 to CTDL-15)

| ID      | Title                                                          | Risk   |
| ------- | -------------------------------------------------------------- | ------ |
| CTDL-01 | Wajib Eloquent ORM, dilarang raw query                         | High   |
| CTDL-02 | Mass assignment protection via `$guarded = ["id"]`             | High   |
| CTDL-03 | Blade escaping default, dilarang `{!! !!}` tanpa sanitasi      | High   |
| CTDL-04 | Middleware auth pada protected routes                          | High   |
| CTDL-05 | Inline validation wajib di controller (`$request->validate()`) | Medium |
| CTDL-06 | Citadel Page lifecycle: `make→view→business→schema→render`     | Medium |
| CTDL-07 | HasCreator trait wajib pada model bisnis                       | High   |
| CTDL-08 | ActivityLogged trait wajib pada model bisnis                   | Medium |
| CTDL-09 | Enum status dengan `label()` dan `color()` (CitadelEnum)       | Medium |
| CTDL-10 | Custom table name dengan prefix `escm_`                        | Low    |
| CTDL-11 | Permission check via `checkAccessPermission()`                 | High   |
| CTDL-12 | Aksi non-CRUD sebagai method tersendiri                        | Medium |
| CTDL-13 | Schema component harus implement Backbone                      | High   |
| CTDL-14 | Makeable pattern `::make($name, $title)`                       | Low    |
| CTDL-15 | HasNumbering trait untuk auto-numbering                        | Medium |

### WIKA/ESCM Domain Rules (WIKA-Q01 to WIKA-Q15)

| ID       | Title                                                      | Risk   |
| -------- | ---------------------------------------------------------- | ------ |
| WIKA-Q01 | Tidak ada Observer class, semua di boot method/trait       | Low    |
| WIKA-Q02 | Tidak ada Form Request class, validasi inline              | Medium |
| WIKA-Q03 | `$guarded` bukan `$fillable`                               | Medium |
| WIKA-Q04 | Response pattern: `apiRes()` helper untuk JSON             | Low    |
| WIKA-Q05 | Sync mechanism mandatory untuk data eksternal              | High   |
| WIKA-Q06 | Sync service harus extend `App\Sync\Service\Base`          | Medium |
| WIKA-Q07 | Scope-based data access (`ESCM::scopeProject()`)           | High   |
| WIKA-Q08 | Password/PIN masking di semua log                          | High   |
| WIKA-Q09 | SoftDeletes hanya untuk entitas tertentu                   | Low    |
| WIKA-Q10 | Relationship key menggunakan business key (SAP-compatible) | Medium |
| WIKA-Q11 | Approval workflow via morphMany + ApprovableContract       | High   |
| WIKA-Q12 | Procurement module interface wajib                         | Medium |
| WIKA-Q13 | Explicit route definition, bukan `Route::resource()`       | Low    |
| WIKA-Q14 | Multi-layer authentication (Session + BasicAuth + JWT)     | High   |
| WIKA-Q15 | CSRF protection tanpa exception (`$except = []`)           | High   |

## Objectives

1. Perform a **comprehensive security, quality, and convention compliance assessment** of the entire codebase.
2. For each finding, **cross-reference with the Review Rulebook** above. Include rule IDs (CTDL-xx, WIKA-Qxx) when violations are found.
3. Identify both confirmed vulnerabilities and potential risks (OWASP style) spanning authentication, authorization, data validation, cryptography, secrets handling, dependency usage, and configuration.
4. Evaluate architectural consistency with the Citadel framework patterns.
5. Highlight high-risk patterns: SQL injection via raw queries, XSS via unescaped Blade, missing auth middleware, missing permission checks, missing audit traits.
6. Provide remediation guidance that is precise, actionable, and prioritized.

## Output requirements

Return JSON with the shape:

```json
{
    "issues": [
        {
            "description": "Human readable explanation",
            "check_name": "Prefix with 'SAST |' for code-level issues or 'SCA |' for dependency/manifest issues, then rule ID and short identifier (e.g., 'SAST | [CTDL-02] Model uses $fillable instead of $guarded')",
            "severity": "info|minor|major|critical|blocker",
            "confidence": "low|medium|high",
            "categories": [
                "Security",
                "Performance",
                "Reliability",
                "Maintainability",
                "Convention"
            ],
            "fingerprint": "stable unique hash for the issue",
            "location": {
                "path": "relative/path.ext",
                "lines": { "begin": 42 }
            },
            "references": ["https://... optional OWASP/CWE references"],
            "recommendation": "Concrete fix recommendation with rule ID context",
            "tests": ["Suggested test cases"],
            "notes": "Rule ID cross-reference and additional context"
        }
    ],
    "summary_markdown": "Markdown formatted executive summary with:\n  - Overall risk rating and justification\n  - Convention compliance score (X/30 rules checked)\n  - Top impacted areas (controllers, models, routes, views, config)\n  - Severity breakdown table\n  - SAST vs SCA breakdown\n  - Bullet list of prioritized remediation steps\n  - Section: 'Review Rulebook Compliance' listing rule violations found\n  - Any follow-up questions or missing context"
}
```

Rules:

- Classify severity realistically. Use `blocker` only for exploitable high-impact risks.
- When assigning severity, respect the Risk level from the rulebook table above: High → `major` or `critical`, Medium → `major` or `minor`, Low → `minor` or `info`. Do not underrate High-risk rules to `minor`.
- Hard floor: findings tagged with High-risk rule IDs MUST be at least `major` (e.g., `[CTDL-02]`, `[CTDL-07]`, `[CTDL-11]`, `[WIKA-Q07]`, `[WIKA-Q15]`).
- Note confidence for each issue (default `medium`).
- Include rule IDs from the Review Rulebook in check_name and notes when applicable.
- If multiple files share the same underlying risk, consolidate with a single issue and list affected files.
- If no issues are found, return `{ "issues": [], "summary_markdown": "All clear..." }`.
- For SCA recommendations (dependencies), avoid fabricating CVE IDs; prefer actionable guidance.
- Mention assumptions and potential blind spots in the summary.

Keep responses concise yet specific. Avoid generic advice without referencing actual findings.
