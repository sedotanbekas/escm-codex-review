# Graph Report - .  (2026-07-06)

## Corpus Check
- 84 files · ~75,707 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 383 nodes · 538 edges · 27 communities (20 shown, 7 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 15 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Review Engine Core|Review Engine Core]]
- [[_COMMUNITY_Report UI Components|Report UI Components]]
- [[_COMMUNITY_API Client Layer|API Client Layer]]
- [[_COMMUNITY_Server And Fixtures|Server And Fixtures]]
- [[_COMMUNITY_UAT Consent Flow|UAT Consent Flow]]
- [[_COMMUNITY_Review Prompts Rulebook|Review Prompts Rulebook]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Run History Storage|Run History Storage]]
- [[_COMMUNITY_Node Package Scripts|Node Package Scripts]]
- [[_COMMUNITY_Report Generation|Report Generation]]
- [[_COMMUNITY_SUS Survey Widgets|SUS Survey Widgets]]
- [[_COMMUNITY_Issue Enrichment|Issue Enrichment]]
- [[_COMMUNITY_Evaluation Matching|Evaluation Matching]]
- [[_COMMUNITY_Graphify Instructions|Graphify Instructions]]
- [[_COMMUNITY_SUS In App UAT|SUS In App UAT]]
- [[_COMMUNITY_Prism Types|Prism Types]]
- [[_COMMUNITY_Dropdown Control|Dropdown Control]]
- [[_COMMUNITY_Graphify Extraction|Graphify Extraction]]
- [[_COMMUNITY_Oracle Setup Script|Oracle Setup Script]]
- [[_COMMUNITY_Oracle Deployment|Oracle Deployment]]
- [[_COMMUNITY_Update Script|Update Script]]
- [[_COMMUNITY_Static Summary Page|Static Summary Page]]
- [[_COMMUNITY_Graphify Outputs|Graphify Outputs]]
- [[_COMMUNITY_Graphify Pipeline|Graphify Pipeline]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `buildReport()` - 13 edges
3. `Codex Review GUI` - 9 edges
4. `scripts` - 7 edges
5. `collectControlIdsFromIssue()` - 7 edges
6. `reviewSource()` - 7 edges
7. `parseJsonSafe()` - 5 edges
8. `HealthResponse` - 5 edges
9. `RulebookEntry` - 5 edges
10. `HistorySummary` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Advisory Only Precision First` --semantically_similar_to--> `Codex Review GUI`  [INFERRED] [semantically similar]
  HANDOVER.md → README.md
- `Oracle Cloud Deployment` --semantically_similar_to--> `Oracle VM Deployment`  [AMBIGUOUS] [semantically similar]
  deploy/README.md → HANDOVER.md
- `Claude Graphify Project Instructions` --semantically_similar_to--> `Graphify Project Instructions`  [INFERRED] [semantically similar]
  CLAUDE.md → AGENTS.md
- `Shared Review Engine` --semantically_similar_to--> `Codex Review GUI`  [INFERRED] [semantically similar]
  HANDOVER.md → README.md
- `Diff Review Rulebook Conventions` --semantically_similar_to--> `Thirty Rule Review Rulebook`  [INFERRED] [semantically similar]
  prompts/codex_diff_review.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Graphify Build Pipeline** — codex_skills_graphify_skill_graphify_pipeline, codex_skills_graphify_skill_structural_extraction, codex_skills_graphify_skill_semantic_extraction, codex_skills_graphify_skill_graph_outputs, codex_skills_graphify_references_update_incremental_update [EXTRACTED 1.00]
- **Code Review Rulebook Family** — readme_rulebook_30, prompts_codex_diff_review_rulebook_conventions, prompts_codex_full_scan_rulebook_30_rules, prompts_codex_security_only_security_rules, handover_advisory_precision [INFERRED 0.95]
- **UAT Red Carpet Flow** — docs_superpowers_plans_2026_06_26_sus_inapp_uat_sus_inapp_uat_plan, docs_superpowers_plans_2026_06_26_sus_inapp_uat_backend_uat_endpoint, docs_superpowers_plans_2026_06_26_sus_inapp_uat_apps_script_proxy, docs_superpowers_plans_2026_06_26_sus_inapp_uat_email_uniqueness, docs_superpowers_plans_2026_06_26_sus_inapp_uat_red_carpet_overlay [EXTRACTED 1.00]

## Communities (27 total, 7 thin omitted)

### Community 0 - "Review Engine Core"
Cohesion: 0.06
Nodes (43): applySeverityFloorFromControls(), batchPieces(), buildSyntheticDiffFromFiles(), callOpenAI(), chunkText(), codeToSyntheticDiff(), collectControlIdsFromIssue(), collectControlIdsFromText() (+35 more)

### Community 1 - "Report UI Components"
Cohesion: 0.05
Nodes (36): InfoHint(), DomBar(), SEV_LABEL, SEV_SHORT, contohPelanggaran(), Props, RulebookModal(), baseName() (+28 more)

### Community 2 - "API Client Layer"
Cohesion: 0.08
Nodes (34): accessHeaders(), ApiHttpError, checkUatEmail(), clearAccessCode(), getHealth(), getHistory(), getHistoryRun(), getRulebook() (+26 more)

### Community 3 - "Server And Fixtures"
Cohesion: 0.07
Nodes (27): getGroundTruth(), GROUND_TRUTH, OFFICIAL_METRICS, getLeadDevValidation(), LEAD_DEV_VALIDATION, ACCESS_CODE, ALLOWED_UPLOAD_EXTENSIONS, app (+19 more)

### Community 4 - "UAT Consent Flow"
Cohesion: 0.09
Nodes (22): postUat(), Props, UatConsent(), COMMON_DOMAIN_TYPOS, DemoValue, FREQ_OPTS, normalizeEmail(), PENGALAMAN_OPTS (+14 more)

### Community 5 - "Review Prompts Rulebook"
Cohesion: 0.10
Nodes (23): Frontend Rewrite, Task 9 Report, Advisory Only Precision First, Codex Review GUI Handover, Dual Repo Boundary, Shared Review Engine, Merge Request Diff Review Prompt, Diff Review JSON Output Schema (+15 more)

### Community 6 - "Frontend Dependencies"
Cohesion: 0.10
Nodes (20): dependencies, framer-motion, prismjs, react, react-dom, description, devDependencies, @types/react (+12 more)

### Community 7 - "TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+9 more)

### Community 8 - "Run History Storage"
Cohesion: 0.17
Nodes (14): BULAN, formatWIB(), getRun(), HARI, listRuns(), recordRun(), SEV_RANK, sha256() (+6 more)

### Community 9 - "Node Package Scripts"
Cohesion: 0.13
Nodes (14): dependencies, express, description, name, private, scripts, cli:diff, cli:full (+6 more)

### Community 10 - "Report Generation"
Cohesion: 0.35
Nodes (9): buildReport(), cleanCheck(), domainOfRuleId(), emptyCounts(), groupComponent(), groupType(), isSCA(), overallRiskOf() (+1 more)

### Community 11 - "SUS Survey Widgets"
Cohesion: 0.33
Nodes (6): Props, SusItem(), Props, SusScale(), SCALE_LABELS, SUS_ITEMS

### Community 12 - "Issue Enrichment"
Cohesion: 0.25
Nodes (6): catalog, issues, readJSON(), ruleMap, summary, tryLoadControls()

### Community 13 - "Evaluation Matching"
Cohesion: 0.42
Nodes (6): basename(), computeMetrics(), evaluate(), matchDetections(), ruleIdOf(), rules

### Community 14 - "Graphify Instructions"
Cohesion: 0.40
Nodes (5): Graphify Project Instructions, Claude Graphify Project Instructions, Graph Query Traversal, Incremental Update, Existing Graph Fast Path

### Community 15 - "SUS In App UAT"
Cohesion: 0.50
Nodes (5): Apps Script Proxy, Backend UAT Endpoint, Email Uniqueness Rule, Red Carpet Overlay, SUS In App UAT Plan

### Community 16 - "Prism Types"
Cohesion: 0.40
Nodes (4): prismjs, prismjs/components/*, prismjs/plugins/*, prismjs/themes/*

### Community 18 - "Graphify Extraction"
Cohesion: 0.67
Nodes (3): Subagent Extraction Schema, Semantic Extraction, Structural Extraction

## Ambiguous Edges - Review These
- `Oracle VM Deployment` → `Oracle Cloud Deployment`  [AMBIGUOUS]
  deploy/README.md · relation: semantically_similar_to

## Knowledge Gaps
- **157 isolated node(s):** `oracle-setup.sh script`, `update.sh script`, `name`, `version`, `private` (+152 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Oracle VM Deployment` and `Oracle Cloud Deployment`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `buildReport()` connect `Report Generation` to `Review Engine Core`, `Report UI Components`, `Server And Fixtures`?**
  _High betweenness centrality (0.224) - this node is a cross-community bridge._
- **Why does `baseName()` connect `Report UI Components` to `Report Generation`?**
  _High betweenness centrality (0.219) - this node is a cross-community bridge._
- **Why does `collectControlIdsFromIssue()` connect `Review Engine Core` to `Report Generation`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `Codex Review GUI` (e.g. with `Frontend Rewrite` and `Advisory Only Precision First`) actually correct?**
  _`Codex Review GUI` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `oracle-setup.sh script`, `update.sh script`, `name` to the rest of the system?**
  _160 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Review Engine Core` be split into smaller, more focused modules?**
  _Cohesion score 0.058069381598793365 - nodes in this community are weakly interconnected._