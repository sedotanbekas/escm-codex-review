interface Props { agreed: boolean; onAgreeChange: (v: boolean) => void; onNext: () => void; onBack?: () => void; }
export function UatConsent({ agreed, onAgreeChange, onNext, onBack }: Props) {
    return (
        <div className="uatcard">
            <h3 className="uatcard__title">Persetujuan</h3>
            <p className="uatcard__body">
                Kuesioner ini mengukur kemudahan penggunaan sistem. <strong>Alamat email Anda dicatat
                dan dapat ditampilkan dalam laporan penelitian serta sesi sidang</strong> sebagai bukti
                keaslian responden, dan untuk memastikan satu orang mengisi satu kali. Pengisian bersifat
                sukarela. Tidak ada jawaban benar atau salah.
            </p>
            <label className="uatcard__check">
                <input type="checkbox" checked={agreed} onChange={(e) => onAgreeChange(e.target.checked)} />
                <span>Saya memahami dan bersedia mengisi secara sukarela.</span>
            </label>
            <div className="uatcard__actions">
                {onBack && (
                    <button className="uat-btn uat-btn--back" onClick={onBack}>← Sebelumnya</button>
                )}
                <button className="uat-btn uat-btn--go" disabled={!agreed} onClick={onNext}>Lanjut →</button>
            </div>
        </div>
    );
}
