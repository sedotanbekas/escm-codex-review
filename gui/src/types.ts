// types.ts — Bentuk data yang dipertukarkan dengan backend GUI.
// Selaras dengan reviewEngine.mjs (Code Climate v2), server.mjs, & report.mjs.

export type Severity = "info" | "minor" | "major" | "critical" | "blocker";
export type Confidence = "low" | "medium" | "high";

export interface IssueLocation {
    path: string;
    lines: { begin: number };
}

export interface Issue {
    description: string;
    check_name: string;
    severity: Severity;
    confidence: Confidence;
    categories: string[];
    fingerprint: string;
    location: IssueLocation;
    references: string[];
    recommendation: string;
    tests: string[];
    notes: string;
}

export interface SeverityCounts {
    blocker: number;
    critical: number;
    major: number;
    minor: number;
    info: number;
}

export interface CostStats {
    calls: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    api: string | null;
}

export interface HealthResponse {
    ok: boolean;
    model: string;
    apiKeyConfigured: boolean;
    rulesLoaded: number;
    promptLoaded: boolean;
    recordedAvailable: boolean;
    accessRequired?: boolean;
}

export interface ApiError {
    error: string;
}

// State mesin UI — eksplisit agar tampilan tak pernah menggantung.
export type RequestStatus = "idle" | "loading" | "success" | "error";

export type Domain = "CTDL" | "WIKA";
export type Verdict = "TP" | "FN";

export interface OfficialMetrics {
    precision: number;
    recall: number;
    f1: number;
    tp: number;
    fp: number;
    fn: number;
    recall_ctdl: number;
    recall_wika: number;
}
export type LiveMetrics = OfficialMetrics;

export interface PerRuleResult {
    rule_id: string;
    domain: Domain;
    expert_verdict: Verdict;
    detected: boolean;
    finding: Issue | null;
}

// --- Laporan terstruktur "Codex Review Summary" (dari report.mjs) -------------
export interface ReportExecutive {
    overallRisk: Severity;
    guidance: string;
}
export interface ReportEstimatedCost {
    currency: string;
    amount: number;
    inPer1M: number;
    outPer1M: number;
}
export interface ReportUsage {
    model: string;
    api: string | null;
    calls: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    estimatedCost: ReportEstimatedCost | null;
}
export interface ReportTopFinding {
    severity: Severity;
    type: string;
    component: string;
    ruleId: string;
    source: string | null;
    path: string;
    line: number;
    check: string;
    descr: string;
    recommendation: string;
}

// Satu baris rulebook tervalidasi Lead Dev IT WIKA (dari /api/rulebook).
export interface RulebookEntry {
    id: number;
    rule_id: string;
    domain: Domain;
    rule_singkat: string;
    lokasi_contoh: string;
    pelanggaran: string;
    temuan_ai: string;
    validitas: "Valid" | "Tidak Valid";
    severity_sesuai: string;
    catatan: string;
}
export interface ReportRulebook {
    triggered: number;
    total: number;
    pct: number | null;
    sampleIds: string[];
    moreCount: number;
}
export interface ReportMetrics {
    live: LiveMetrics;
    official: OfficialMetrics | null;
}
export interface ReportData {
    executive: ReportExecutive;
    metrics: ReportMetrics | null;
    severity: SeverityCounts;
    usage: ReportUsage;
    topFindings: ReportTopFinding[];
    componentByDomain: { CTDL: number; WIKA: number };
    rulebook: ReportRulebook;
    findingsTotal: number;
}

export type ReportSource = "live" | "recorded" | "history";

export interface EvalResponse {
    ok: true;
    source: ReportSource;
    runId: string;
    timestamp_display: string;
    model: string;
    datasets: { exp: string; sha256: string }[];
    metrics_live: LiveMetrics;
    perRule: PerRuleResult[];
    fpFindings: Issue[];
    cost: CostStats;
    report: ReportData;
}

export interface HistorySummary {
    id: string;
    timestamp_iso: string;
    timestamp_display: string;
    metrics_live: LiveMetrics | null;
    findingsTotal?: number;
    overallRisk?: Severity;
}
