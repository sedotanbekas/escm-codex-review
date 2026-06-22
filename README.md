# Codex Review GUI — WISE/ESCM

> GUI demonstrasi untuk **bot AI code review** WISE/ESCM (skripsi D4 Teknik Informatika, PNJ).
> Aplikasi web ini **independen**, namun memakai **mesin review yang sama** dengan pipeline GitLab CI/CD (`reviewEngine.mjs`) — jadi yang ditampilkan di GUI identik dengan yang berjalan di CI.

Bersifat **advisory-only** & **precision-first**: bot memberi saran di Merge Request, tidak memperbaiki/memblokir kode.

---

## Mode demo

| Tombol | Apa yang terjadi | Token OpenAI? | Passcode? |
| ------ | ---------------- | ------------- | --------- |
| **Jalankan** | Menampilkan laporan **rekaman** (statis, anti-gagal) | Tidak | Tidak |
| **Scan ulang (live)** | Memanggil AI sungguhan (gpt-4o-mini), simpan ke riwayat | Ya (~14k token) | Ya, bila `ACCESS_CODE` di-set |

Pengunjung tanpa passcode tetap bisa melihat laporan rekaman + rulebook (mode demo aman). Hanya **scan live** yang digerbang passcode + rate-limit, agar anggaran token tidak disalahgunakan.

---

## Jalankan lokal

Butuh **Node.js 20+**.

```bash
# 1) install dependency backend + frontend
npm install
cd gui && npm install && npm run build && cd ..

# 2) siapkan environment
cp .env.example .env        # lalu isi OPENAI_API_KEY
#   (Windows PowerShell: Copy-Item .env.example .env)

# 3) jalankan server (menyajikan GUI hasil build dari gui/dist)
npm run server
# buka http://localhost:8787
```

> Tanpa `ACCESS_CODE` di `.env`, scan live terbuka tanpa passcode (mode lokal/dev).
> Untuk membekukan laporan rekaman default setelah scan live: `npm run pin-report`.

---

## Deploy ke Render (gratis)

Repo ini sudah berisi [`render.yaml`](render.yaml) (Blueprint).

1. Push repo ini ke GitHub (public).
2. Di [Render](https://render.com) → **New** → **Blueprint** → pilih repo ini.
   (Atau **New → Web Service** manual: Build = `npm install && cd gui && npm install && npm run build`, Start = `node server/server.mjs`.)
3. Di tab **Environment**, isi rahasia (tidak ada di repo):
   - `OPENAI_API_KEY` — kunci OpenAI-mu
   - `ACCESS_CODE` — passcode "by invitation" untuk scan live
4. Deploy → dapat URL permanen, mis. `https://codex-review-gui.onrender.com`.

> **Free tier:** server "tidur" setelah ~15 menit idle; akses pertama setelah tidur butuh ~30–50 detik (cold start). Filesystem ephemeral — riwayat scan live tidak persisten antar-restart.

---

## Environment variables

| Variable | Wajib | Default | Keterangan |
| -------- | ----- | ------- | ---------- |
| `OPENAI_API_KEY` | **Ya** (untuk scan live) | — | Kunci OpenAI |
| `ACCESS_CODE` | Disarankan di hosting publik | _(kosong)_ | Passcode scan live. Kosong = tanpa gerbang |
| `MAX_LIVE_PER_HOUR` | Tidak | `20` | Batas scan live per jam |
| `OPENAI_MODEL` | Tidak | `gpt-4o-mini` | Model LLM |
| `PORT` | Tidak | `8787` | Port server (Render meng-inject otomatis) |
| `CODEX_PRICE_PROMPT_PER_1M` | Tidak | — | Harga input /1M token (untuk estimasi biaya) |
| `CODEX_PRICE_COMPLETION_PER_1M` | Tidak | — | Harga output /1M token |

Lihat [`.env.example`](.env.example) untuk daftar lengkap.

---

## Rulebook (30 aturan inti)

### Domain Citadel — CTDL-01 … CTDL-15 (teknis/universal)

| ID | Judul | Risk |
| -- | ----- | ---- |
| CTDL-01 | Wajib Eloquent ORM, dilarang raw query | High |
| CTDL-02 | Mass assignment protection via `$guarded` | High |
| CTDL-03 | Blade escaping, dilarang `{!! !!}` tanpa sanitasi | High |
| CTDL-04 | Middleware auth pada protected routes | High |
| CTDL-05 | Inline validation wajib di controller | Medium |
| CTDL-06 | Citadel Page lifecycle pattern | Medium |
| CTDL-07 | HasCreator trait wajib | High |
| CTDL-08 | ActivityLogged trait wajib | Medium |
| CTDL-09 | Enum status dengan `label()` dan `color()` | Medium |
| CTDL-10 | Table name dengan prefix `escm_` | Low |
| CTDL-11 | Permission check via `checkAccessPermission()` | High |
| CTDL-12 | Aksi non-CRUD sebagai method tersendiri | Medium |
| CTDL-13 | Schema component implement Backbone | High |
| CTDL-14 | Makeable pattern `::make()` | Low |
| CTDL-15 | HasNumbering trait untuk auto-numbering | Medium |

### Domain WIKA/ESCM — WIKA-Q01 … WIKA-Q15 (khas organisasi/tacit)

| ID | Judul | Risk |
| -- | ----- | ---- |
| WIKA-Q01 | Tidak ada Observer class | Low |
| WIKA-Q02 | Tidak ada Form Request class | Medium |
| WIKA-Q03 | `$guarded` bukan `$fillable` | Medium |
| WIKA-Q04 | Response pattern `apiRes()` | Low |
| WIKA-Q05 | Sync mechanism untuk data eksternal | High |
| WIKA-Q06 | Sync service extend Base | Medium |
| WIKA-Q07 | Scope-based data access | High |
| WIKA-Q08 | Password/PIN masking di log | High |
| WIKA-Q09 | SoftDeletes terbatas | Low |
| WIKA-Q10 | Business key relationships | Medium |
| WIKA-Q11 | Approval workflow morphMany | High |
| WIKA-Q12 | ProcurementModule interface | Medium |
| WIKA-Q13 | Explicit route definition | Low |
| WIKA-Q14 | Multi-layer authentication | High |
| WIKA-Q15 | CSRF protection tanpa exception | High |

Daftar kontrol lengkap (baseline OWASP + Citadel, 51 kontrol): [`controls/controls.csv`](controls/controls.csv).

---

## Struktur folder

```
.
├── server/                 # backend Express (server.mjs) + data
│   ├── server.mjs          # HTTP server: API + sajikan gui/dist
│   ├── report.mjs          # bangun laporan "Codex Review Summary"
│   ├── history.mjs         # riwayat run live
│   ├── pin_report.mjs      # bekukan laporan rekaman default
│   └── data/               # ground_truth, rulebook lead-dev, recorded_report
├── gui/                    # frontend React + Vite + TypeScript
│   └── src/                # App, komponen, styles
├── scripts/                # mesin review (reviewEngine.mjs) + CLI (run_codex.mjs)
├── prompts/                # system prompt berlapis (diff / full / security)
├── controls/               # controls.csv + owasp_controls.json
├── tests/                  # patch seeded violation (ground truth)
├── test/                   # unit test (node --test)
├── render.yaml             # Render Blueprint
└── .env.example            # template environment
```

---

## Konteks skripsi

GUI ini bagian dari penelitian formalisasi *tacit knowledge* developer senior (framework internal **Citadel**) menjadi *rulebook* yang ditegakkan otomatis oleh LLM di pipeline CI/CD. Mesin review **tidak** di-*fine-tune*; adaptasi domain dilakukan lewat *context-aware prompting* (few-shot in-context).
