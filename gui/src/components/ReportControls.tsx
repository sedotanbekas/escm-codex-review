// ReportControls.tsx — area unggah kode bebas: dropzone (klik / drag-and-drop),
// daftar file dengan pratinjau isi kode, lalu tombol "Periksa dengan AI".
import { useState } from "react";
import type { ChangeEvent, DragEvent, RefObject } from "react";
import type { HealthResponse } from "../types";

const DISPLAYED_CONTROL_COUNT = 30;

interface Props {
  health: HealthResponse | null;
  running: boolean;
  reading?: boolean; // true selama isi file sedang dibaca di browser
  onRescan: () => void; // jalankan scan AI atas file terunggah
  uploadedFiles?: { name: string; content: string }[];
  uploadError?: string | null;
  onPickFiles?: () => void;
  onDropFiles?: (files: File[]) => void;
  onRemoveFile?: (name: string) => void;
  fileInputRef?: RefObject<HTMLInputElement | null>;
  onFilesSelected?: (e: ChangeEvent<HTMLInputElement>) => void;
}

function fileMeta(content: string): string {
  const lines = content ? content.split("\n").length : 0;
  const kb = content.length / 1024;
  const size = kb >= 1 ? `${kb.toFixed(1)} KB` : `${content.length} B`;
  return `${lines} baris · ${size}`;
}

export function ReportControls({
  health,
  running,
  reading = false,
  onRescan,
  uploadedFiles = [],
  uploadError = null,
  onPickFiles,
  onDropFiles,
  onRemoveFile,
  fileInputRef,
  onFilesSelected,
}: Props) {
  const keyOk = health?.apiKeyConfigured ?? false;
  const [dragging, setDragging] = useState(false);
  // Nama file yang pratinjau kodenya sedang terbuka (satu per satu).
  const [openFile, setOpenFile] = useState<string | null>(null);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) onDropFiles?.(files);
  }

  return (
    <div className="controls">
      <div className="controls__left controls__left--stack">
        <div
          className={`uploadzone${dragging ? " uploadzone--drag" : ""}`}
          role="button"
          tabIndex={0}
          onClick={onPickFiles}
          onKeyDown={(e) => {
            // Konvensi role="button": Enter DAN Spasi memicu aksi.
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPickFiles?.();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!dragging) setDragging(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef as RefObject<HTMLInputElement>}
            type="file"
            accept=".php"
            multiple
            className="uploadzone__input"
            onChange={onFilesSelected}
          />
          <div className="uploadzone__icon">{dragging ? "📥" : "📦"}</div>
          <div>
            <div className="uploadzone__title">
              {dragging
                ? "Lepaskan file di sini…"
                : "Seret file ke sini atau klik untuk memilih"}
            </div>
            <div className="uploadzone__hint">
              Maksimal 5 file · ekstensi .php / .blade.php · ≤200 KB per file
            </div>
          </div>
        </div>

        {reading && (
          <span className="uploadreading" role="status" aria-live="polite">
            Membaca file…
          </span>
        )}

        {uploadedFiles.length > 0 && (
          <div className="uploadlist" aria-live="polite">
            {uploadedFiles.map((file) => {
              const isOpen = openFile === file.name;
              return (
                <div
                  key={file.name}
                  className={`uploadfile${isOpen ? " is-open" : ""}`}
                >
                  <div className="uploadfile__head">
                    <button
                      type="button"
                      className="uploadfile__toggle"
                      onClick={() =>
                        setOpenFile(isOpen ? null : file.name)
                      }
                      title="Lihat isi kode"
                      aria-expanded={isOpen}
                    >
                      <span className="uploadfile__chev" aria-hidden>
                        ▸
                      </span>
                      <span className="uploadfile__name">{file.name}</span>
                      <span className="uploadfile__meta">
                        {fileMeta(file.content)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="uploadfile__remove"
                      onClick={() => onRemoveFile?.(file.name)}
                      title={`Hapus ${file.name}`}
                    >
                      ×
                    </button>
                  </div>
                  {isOpen && (
                    <pre className="uploadfile__code">
                      <code>{file.content || "(kosong)"}</code>
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {uploadError && <span className="uploaderror">{uploadError}</span>}

        <button
          className="btn btn--primary"
          onClick={onRescan}
          disabled={running || !keyOk || uploadedFiles.length === 0}
          title={
            uploadedFiles.length === 0
              ? "Unggah minimal 1 file .php dulu"
              : keyOk
                ? "Memanggil AI sungguhan untuk memeriksa file yang diunggah"
                : "Isi OPENAI_API_KEY di .env untuk mengaktifkan"
          }
        >
          {running ? "AI sedang memeriksa…" : "↻ Periksa dengan AI"}
        </button>
      </div>
      <span
        className={`statuspill ${
          health ? (keyOk ? "is-up" : "is-warn") : "is-down"
        }`}
      >
        {health
          ? `${health.model} · ${keyOk ? "key ✓" : "key ✗"} · ${DISPLAYED_CONTROL_COUNT} kontrol`
          : "backend offline"}
      </span>
    </div>
  );
}
