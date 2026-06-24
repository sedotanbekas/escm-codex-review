# HANDOVER — Codex Review GUI (WISE/ESCM)

> Dokumen konteks untuk **AI/asisten berikutnya** (atau diriku sendiri) yang melanjutkan proyek ini di PC lain. Baca ini lebih dulu. Tidak ada rahasia di sini — passcode & API key ditulis sebagai placeholder.

---

## 0. Cara pakai dokumen ini
- Ini proyek **GUI demo** untuk sidang skripsi. Tujuannya tampil meyakinkan & jujur ke **penguji non-teknis**.
- Pengguna (Rafif) **melakukan SEMUA operasi git sendiri** (commit/push). Asisten: **jangan** commit/push.
- Bahasa UI: **Indonesia, ramah awam** di permukaan + istilah teknis tetap ada (tooltip `(?)` & glosarium).
- Prinsip produk: **advisory-only** (cuma memberi saran, tak mengubah kode) & **precision-first** (lebih baik diam daripada salah tuduh; FP harus tetap 0).

## 1. Apa proyek ini
Bot *code review* berbantuan AI (GPT-4o-mini) untuk aplikasi **WISE/ESCM** (Laravel + framework internal "Citadel" + React) milik PT Wijaya Karya. Bot menegakkan **rulebook 30 aturan** (15 **CTDL** = teknis/umum, 15 **WIKA-Q** = khas organisasi/tacit) yang dielisitasi dari lead dev. Bot aslinya jalan di **GitLab CI/CD**; GUI ini adalah **peraga independen** yang memakai **mesin review yang SAMA** dengan pipeline.

Hasil evaluasi (dihitung diam-diam di backend, **tidak ditampilkan di GUI**): Precision 1.000 · Recall 0.367 · F1 0.537 · TP 11 · FP 0 · FN 19.

## 2. ⚠️ DUA REPO — JANGAN TERTUKAR (paling sering bikin bingung)
```
c:\Users\SEDOTANBEKAS\Documents\intern\
├── escm-web-laravel\         ← MONOREPO WISE (aplikasi WIKA, RAHASIA)
│   ├── app/ modules/ ...       remote: repo.wika.co.id/najib221doank/escm-web-laravel (GitLab PRIVAT)
│   └── .codex-review\          bot ASLI (CLI + CI). Push ke GitLab privat. JANGAN dipublikasikan.
│
└── escm-codex-review\        ← REPO INI (publik di GitHub: ucok-hub/escm-codex-review)
                                SALINAN bersih bot + GUI. Yang DI-DEPLOY. Edit di SINI.
```
- **Edit untuk GUI/deploy → di `escm-codex-review`** (repo ini), lalu push ke GitHub → update VM.
- `.codex-review` di monorepo adalah sumber asli untuk pipeline CI; **kode WISE tak boleh bocor ke publik**.
- **Catatan divergensi:** perubahan UI terbaru ada di repo ini; salinan `escm-web-laravel/.codex-review/gui` **tertinggal** (belum di-mirror). Lihat §10.

## 3. Menjalankan lokal (Node 20+)
```bash
# dari root repo ini (escm-codex-review)
npm install
cd gui && npm install && npm run build && cd ..
cp .env.example .env          # isi OPENAI_API_KEY (untuk scan live). ACCESS_CODE kosong = tanpa gerbang
npm run server                # http://localhost:8787
```
- "Lihat hasil contoh" (tombol primary) = laporan **rekaman** statis (tanpa token). Bekukan ulang dari run live terbaik: `npm run pin-report` → `server/data/recorded_report.json`.
- "Periksa ulang dengan AI" = scan **live** (butuh `OPENAI_API_KEY`).

## 4. Arsitektur
**Backend** `server/server.mjs` (Express) — memuat `.env` sendiri (loader ringan, bukan dotenv), menyajikan `gui/dist`. Endpoint:
- `GET /api/health` · `GET /api/rulebook` · `GET /api/dataset` (isi 2 patch seeded) · `GET /api/report/recorded` · `GET /api/history` · `GET /api/history/:id`
- `POST /api/evaluate` (JSON, sekali balas) — masih ada, tapi GUI **tidak** memakainya lagi.
- `POST /api/evaluate/stream` (**dipakai GUI**) — **NDJSON streaming**: kirim `{type:"progress",pct,label}` per potongan kode lalu `{type:"result",...EvalResponse}`. Gerbang `ACCESS_CODE` + rate-limit dicek SEBELUM streaming.

**Mesin review** `scripts/reviewEngine.mjs` — **DIPAKAI BERSAMA** CLI (`scripts/run_codex.mjs`, dipanggil `.gitlab-ci.yml`) & server. **JANGAN ubah kontrak CLI.** `reviewSource()` & `runReviewTasks()` menerima callback **opsional** `onProgress(done,total)` (default no-op → CLI tak terpengaruh). Logika ilmiah (hallucination guard file:line, dedup, severity floor) tak boleh dilewati.

**Frontend** `gui/` (React 18 + Vite + TypeScript, strict):
- `App.tsx` — orkestrasi + state machine + guard `beforeunload`.
- `components/`: `IntroPanel` ("Apa ini?"+3 langkah), `ReportControls` (pilih contoh→chip, tombol), `SeededViewer` (panel kode seeded, Prism+Fira Code), `ScanProgress` (bar progres NYATA determinate), `ReportView` (laporan gaya GitLab; tabel "Temuan utama" baris bisa di-expand → snippet kode), `RunHistory` (paginasi 5/hal), `RulebookModal`, `GlossaryModal`, `InfoHint` (tooltip `(?)`), `SectionNav`+`BackToTop`.
- `lib/useCountUp.ts` (animasi angka + `prefersReducedMotion`), `prism.d.ts` (shim tipe prismjs).
- `styles.css` — tema navy (`--ink #112D4E`, `--blue #3F72AF`, `--soft/--tint #DBE2EF`, `--bg #F9F7F7`). Hormati `prefers-reduced-motion`.
- Dependensi penting: `prismjs` (syntax highlight diff+PHP), `react`, `vite`.

## 5. Deployment (Oracle Cloud VM)
- Instance **`codex-vm`**, region **ap-singapore-1**, Ubuntu 22.04, **shape `VM.Standard.E5.Flex`** (1 OCPU/1GB) + **swap 2GB**.
- ⚠️ **E5.Flex BERBAYAR** (bukan Always Free; shape gratis E2.1.Micro/A1.Flex habis kapasitas di Singapore). Akun sudah **Pay As You Go**.
  - **Kebijakan biaya:** **Stop** VM saat tidak dipakai (instance stopped ≈ $0; boot volume 47GB masih dalam jatah gratis 200GB), **Start** sebelum demo/sidang. **Public IP tetap** saat stop/start (lepas hanya saat *terminate*). Pasang **Budget alert** $1.
- **URL:** `http://161.118.237.165:8787` (perlu ingress port 8787 di OCI Security List — sudah dibuka).
- **SSH:** `ssh -i C:\SSH\ssh-key-2026-06-23.key ubuntu@161.118.237.165` (user `ubuntu`).
- App jalan via **systemd `codex-review`** (auto-restart, enabled → hidup sendiri setelah boot). `.env` ada di `~/escm-codex-review/.env` di VM (berisi `OPENAI_API_KEY` & `ACCESS_CODE` asli — JANGAN commit).
- **Update (TIDAK otomatis):**
  ```bash
  cd ~/escm-codex-review && bash deploy/update.sh
  ```
  `update.sh` = `git fetch` + `git reset --hard origin/master` (kebal drift `package-lock.json`) + `npm install` + build gui + restart service.
- Helper deploy: `deploy/oracle-setup.sh` (setup awal VM), `deploy/update.sh`, `deploy/Caddyfile` (opsional HTTPS), `deploy/README.md`, `render.yaml`, `Dockerfile` (alternatif host container).

## 6. Fitur yang SUDAH ada (status: selesai & ter-build)
1. Laporan **gaya GitLab "Codex Review Summary"** (blok: Ringkasan, Tingkat keparahan, Pemakaian & biaya, Temuan utama, Asal temuan CTDL vs WIKA, Kepatuhan aturan).
2. **Hybrid**: rekaman (cepat, token-free) + scan live (AI).
3. **Gerbang passcode** (`ACCESS_CODE`) + rate-limit untuk scan live di IP publik.
4. **Tema navy**, animasi halus, paginasi riwayat (5/halaman).
5. **Perombakan ramah-awam**: IntroPanel, tooltip `(?)` (InfoHint), penjelasan tiap blok, glosarium; label sehari-hari ("Lihat hasil contoh", "Periksa ulang dengan AI", "Contoh kode bermasalah").
6. **Alur naratif dataset**: pilih contoh → panel **seeded violations** (kode berwarna, Fira Code, scroll) → jalankan → hasil; seeded jadi collapsible di atas hasil.
7. **Loading bar JUJUR (streaming)**: progres nyata per potongan kode via `/api/evaluate/stream`; bar determinate + gerak mulus + kilau; label nyata.
8. **Navigasi**: dot nav adaptif kanan-tengah (desktop) / tombol mengambang→overlay (mobile); **back-to-top**; klik brand **"codex//review"** = reload; konfirmasi `beforeunload` saat scan live/hasil live (teks dialog = bawaan browser, tak bisa dikustom).
9. **Snippet kode di "Temuan utama"**: klik baris → blok diff berkas terkait (Prism, Fira Code), baris `+`/`−` berwarna = sorotan pelanggaran. Sumber = patch seeded berdasarkan kolom Sumber + path (lihat `getSeededDiffs()` di server & `seededDiffs`/`snippetFor` di `report.mjs`).

## 7. Prinsip & batasan WAJIB dijaga
- **Advisory-only**; **precision-first (FP=0)**; **tanpa fine-tuning** (adaptasi via prompt few-shot di `prompts/`).
- **Jangan ubah kontrak CLI** `reviewEngine.mjs`/`run_codex.mjs` (dipakai `.gitlab-ci.yml`). Tambahan harus opsional & backward-compatible.
- **Jangan publikasikan kode WISE** (monorepo tetap privat). Repo publik = salinan bot bersih saja.
- **Jangan tampilkan metrik evaluasi (confusion matrix) di GUI** kecuali diminta eksplisit (pemisahan produk vs riset). Metrik tetap dihitung diam-diam di backend.
- **User yang commit** — asisten siapkan perubahan + verifikasi build, lalu user push & `bash deploy/update.sh`.

## 8. Build / test
```bash
# frontend
cd gui && npm run build          # tsc && vite build → gui/dist (harus hijau)
# backend
node --check server/server.mjs
node --test                      # 32 tes (harus pass 32 / fail 0)
```

## 9. Gotchas & catatan teknis
- **Divergensi repo**: edit di `escm-codex-review`. Monorepo `.codex-review/gui` belum di-mirror.
- **Lockfile drift**: `npm install` di VM bisa mengubah `package-lock.json` → `git pull` gagal. Sudah diatasi: `update.sh` pakai `reset --hard`.
- **Prism**: tipe di-shim via `gui/src/prism.d.ts`. Bahasa+plugin diff-highlight diimpor di `SeededViewer.tsx` & `ReportView.tsx`. Highlight via `Prism.highlightAllUnder(ref)` di `useEffect`.
- **Fira Code** dimuat dari Google Fonts (`gui/index.html`) → butuh internet di browser; fallback monospace.
- **beforeunload**: teks dialog refresh **tidak bisa dikustom** (aturan browser); hanya bisa memunculkan/menyembunyikan.
- **Akurasi nomor baris** dari AI pada input diff kadang meleset → itulah kenapa snippet pakai **blok diff berkas** (terjamin benar), bukan slice baris tunggal.
- **Streaming buffering**: bila bar lompat 2%→100% tanpa tahap, kemungkinan ada proxy buffering (`X-Accel-Buffering:no` sudah diset; di VM langsung tanpa proxy harusnya mulus). Pertimbangkan flush eksplisit bila perlu.
- Memori file-based Claude Code (lintas sesi) ada di `~/.claude/projects/.../memory/` — lihat `MEMORY.md` untuk konteks tersimpan.

## 10. Pending / belum selesai
- [ ] **Mirror** perubahan UI sesi-sesi terakhir ke monorepo `.codex-review/gui` (bila ingin konsisten). Repo publik adalah yang paling baru.
- [ ] **Metodologi pengujian**: confusion matrix vs **UAT blackbox** — sedang dikonsultasikan ke dospem. Menentukan apakah metrik akan ditampilkan/diuji ulang.
- [ ] **Domain + HTTPS**: ditunda. `deploy/Caddyfile` sudah siap (sslip.io/DuckDNS/.com + Caddy reverse proxy). Buka port 80/443 bila dipakai.
- [ ] **Keamanan terpisah**: kunci **Firebase admin** (`escm-...-adminsdk-...json`) ter-commit di monorepo WISE → sebaiknya **di-rotate** & dikeluarkan dari repo.
- [ ] Materi sidang (PPT/naskah/Q&A) dibuat terpisah, bukan bagian repo ini.

## 11. Riwayat keputusan penting (ringkas)
- Host: Render (stuck OAuth) → Koyeb (berbayar) → **Oracle VM** (kapasitas free habis → PAYG + E5.Flex berbayar, stop-when-idle).
- GUI di-pivot jadi laporan gaya GitLab; metrik dikeluarkan dari GUI; bahasa diramahkan untuk penguji; progres dibuat streaming nyata; ditambah snippet kode & navigasi.

---
*Update bagian §2, §5, §10 bila topology repo / deploy / pending berubah.*
