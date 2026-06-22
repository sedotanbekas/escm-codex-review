// ground_truth.mjs — 30 core rules (15 CTDL + 15 WIKA) sebagai ground-truth
// evaluasi skripsi. Diturunkan dari docs/evaluation/core_rule_evaluation_matrix.csv
// dan verdict pakar pada docs/evaluation/bab4_final.md (Tabel 4.2–4.4).
// NILAI INI STATIS & OTORITATIF — jangan ubah tanpa data evaluasi baru.

export const GROUND_TRUTH = [
    { rule_id: "CTDL-01", domain: "CTDL", title: "Wajib Eloquent ORM — dilarang raw query", file: "PurchaseOrderController.php", experiments: ["EXP-01", "EXP-02"], expert_verdict: "TP", expected_floor_severity: "major", seed_clarity: "strong", summary: "DB::select() dengan konkatenasi string." },
    { rule_id: "CTDL-02", domain: "CTDL", title: "Mass assignment via $guarded", file: "Vendor.php", experiments: ["EXP-01"], expert_verdict: "TP", expected_floor_severity: "major", seed_clarity: "strong", summary: "Model bisnis memakai $fillable, bukan $guarded=['id']." },
    { rule_id: "CTDL-03", domain: "CTDL", title: "Blade escaping — dilarang {!! !!} tanpa sanitasi", file: "search.blade.php", experiments: ["EXP-01"], expert_verdict: "TP", expected_floor_severity: "major", seed_clarity: "strong", summary: "Output Blade tidak ter-escape." },
    { rule_id: "CTDL-04", domain: "CTDL", title: "Middleware auth pada protected routes", file: "web.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "major", seed_clarity: "strong", summary: "Route web/API tanpa middleware auth." },
    { rule_id: "CTDL-05", domain: "CTDL", title: "Inline validation wajib di controller", file: "PurchaseOrderController.php", experiments: ["EXP-01", "EXP-02"], expert_verdict: "TP", expected_floor_severity: "minor", seed_clarity: "strong", summary: "store() tanpa $request->validate([...])." },
    { rule_id: "CTDL-06", domain: "CTDL", title: "Citadel Page lifecycle pattern wajib", file: "detail.blade.php", experiments: ["EXP-02"], expert_verdict: "TP", expected_floor_severity: "minor", seed_clarity: "medium", summary: "Flow halaman tidak memakai ComponentsPage lifecycle." },
    { rule_id: "CTDL-07", domain: "CTDL", title: "HasCreator trait wajib pada model bisnis", file: "Vendor.php", experiments: ["EXP-01"], expert_verdict: "TP", expected_floor_severity: "major", seed_clarity: "strong", summary: "Model bisnis tanpa trait HasCreator." },
    { rule_id: "CTDL-08", domain: "CTDL", title: "ActivityLogged trait wajib pada model bisnis", file: "PurchaseOrder.php", experiments: ["EXP-01", "EXP-02"], expert_verdict: "FN", expected_floor_severity: "minor", seed_clarity: "strong", summary: "Model bisnis tanpa trait ActivityLogged." },
    { rule_id: "CTDL-09", domain: "CTDL", title: "Enum status dengan label() dan color()", file: "PurchaseOrder.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "minor", seed_clarity: "medium", summary: "Status string helper, bukan PHP 8.1 Enum." },
    { rule_id: "CTDL-10", domain: "CTDL", title: "Custom table name prefix escm_", file: "Vendor.php", experiments: ["EXP-01"], expert_verdict: "TP", expected_floor_severity: "info", seed_clarity: "strong", summary: "Tanpa $table eksplisit berprefix escm_." },
    { rule_id: "CTDL-11", domain: "CTDL", title: "Permission check via checkAccessPermission()", file: "PurchaseOrderController.php", experiments: ["EXP-01", "EXP-02"], expert_verdict: "TP", expected_floor_severity: "major", seed_clarity: "strong", summary: "Method bisnis tanpa checkAccessPermission()." },
    { rule_id: "CTDL-12", domain: "CTDL", title: "Aksi non-CRUD sebagai method tersendiri", file: "PurchaseOrderController.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "minor", seed_clarity: "strong", summary: "approve/release digabung dalam update_status generik." },
    { rule_id: "CTDL-13", domain: "CTDL", title: "Schema component implement Backbone", file: "detail.blade.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "major", seed_clarity: "medium", summary: "Komponen Citadel tak penuhi kontrak Backbone." },
    { rule_id: "CTDL-14", domain: "CTDL", title: "Makeable pattern untuk factory instantiation", file: "detail.blade.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "info", seed_clarity: "strong", summary: "new Table(...) bukan ::make(...)." },
    { rule_id: "CTDL-15", domain: "CTDL", title: "HasNumbering trait untuk auto-numbering", file: "PurchaseOrder.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "minor", seed_clarity: "strong", summary: "Model procurement tanpa HasNumbering/UseNumbering." },
    { rule_id: "WIKA-Q01", domain: "WIKA", title: "Tanpa Observer class — semua di boot method", file: "PurchaseOrderObserver.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "info", seed_clarity: "strong", summary: "Observer class baru padahal standar pakai boot()." },
    { rule_id: "WIKA-Q02", domain: "WIKA", title: "Tanpa Form Request — validasi inline", file: "PurchaseOrderRequest.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "minor", seed_clarity: "strong", summary: "Form Request class padahal standar inline." },
    { rule_id: "WIKA-Q03", domain: "WIKA", title: "$guarded bukan $fillable", file: "PurchaseOrder.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "minor", seed_clarity: "strong", summary: "Model procurement memakai $fillable." },
    { rule_id: "WIKA-Q04", domain: "WIKA", title: "Response pattern apiRes() untuk JSON", file: "PurchaseOrderController.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "info", seed_clarity: "strong", summary: "response()->json(...) bukan apiRes()." },
    { rule_id: "WIKA-Q05", domain: "WIKA", title: "Sync mechanism mandatory untuk data eksternal", file: "PurchaseOrderController.php", experiments: ["EXP-02"], expert_verdict: "TP", expected_floor_severity: "major", seed_clarity: "strong", summary: "Ambil data SAP langsung di controller tanpa sync service." },
    { rule_id: "WIKA-Q06", domain: "WIKA", title: "Sync service harus extend Base", file: "SapPurchaseOrderSync.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "minor", seed_clarity: "strong", summary: "Sync service tak extend Base." },
    { rule_id: "WIKA-Q07", domain: "WIKA", title: "Scope-based data access multi-tenant", file: "PurchaseOrderController.php", experiments: ["EXP-02"], expert_verdict: "TP", expected_floor_severity: "major", seed_clarity: "strong", summary: "Akses data tanpa ESCM::scopeProject(auth()->user())." },
    { rule_id: "WIKA-Q08", domain: "WIKA", title: "Password/PIN masking di semua log", file: "PurchaseOrderController.php", experiments: ["EXP-02"], expert_verdict: "TP", expected_floor_severity: "major", seed_clarity: "strong", summary: "Log menyimpan password/pin mentah." },
    { rule_id: "WIKA-Q09", domain: "WIKA", title: "SoftDeletes hanya untuk entitas tertentu", file: "PurchaseOrder.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "info", seed_clarity: "strong", summary: "SoftDeletes pada model yang tak diizinkan." },
    { rule_id: "WIKA-Q10", domain: "WIKA", title: "Relationship key menggunakan business key", file: "PurchaseOrder.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "minor", seed_clarity: "weak", summary: "Relationship key inkonsisten." },
    { rule_id: "WIKA-Q11", domain: "WIKA", title: "Approval workflow via morphMany pattern", file: "PurchaseOrderController.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "major", seed_clarity: "medium", summary: "Approval tanpa ApprovableContract/ReleaseStrategyModel." },
    { rule_id: "WIKA-Q12", domain: "WIKA", title: "Procurement module interface wajib", file: "PurchaseOrder.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "minor", seed_clarity: "strong", summary: "Entitas procurement tak implement ProcurementModule." },
    { rule_id: "WIKA-Q13", domain: "WIKA", title: "Explicit route bukan Route::resource()", file: "web.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "info", seed_clarity: "strong", summary: "Route::resource() bukan definisi eksplisit." },
    { rule_id: "WIKA-Q14", domain: "WIKA", title: "Multi-layer authentication", file: "web.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "major", seed_clarity: "weak", summary: "Layer auth session/basic/jwt tak lengkap." },
    { rule_id: "WIKA-Q15", domain: "WIKA", title: "CSRF protection tanpa exception", file: "VerifyCsrfToken.php", experiments: ["EXP-02"], expert_verdict: "FN", expected_floor_severity: "major", seed_clarity: "strong", summary: "$except diisi padahal harus kosong." },
];

export const OFFICIAL_METRICS = {
    precision: 1.0,
    recall: 0.367,
    f1: 0.537,
    tp: 11,
    fp: 0,
    fn: 19,
    recall_ctdl: 0.533,
    recall_wika: 0.2,
};

export function getGroundTruth() {
    return { rules: GROUND_TRUTH, official: OFFICIAL_METRICS };
}
