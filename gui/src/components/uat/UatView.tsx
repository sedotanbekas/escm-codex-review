import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { postUat } from "../../api";
import type { UatStep } from "../../types";
import { UatWelcome } from "./UatWelcome";
import { UatConsent } from "./UatConsent";
import { UatDemographics, type DemoValue } from "./UatDemographics";
import { SusScale } from "./SusScale";
import { UatThankYou } from "./UatThankYou";
import { UatProgress } from "./UatProgress";

const STEPS = ["Persetujuan", "Tentang Anda", "Konfirmasi", "Penilaian"];

export function UatView({ onExit }: { onExit: () => void }) {
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const [step, setStep] = useState<UatStep>("welcome");
    const [agreed, setAgreed] = useState(false);
    const [demo, setDemo] = useState<DemoValue>({ email: "", peran: "", pengalaman: "", freqTools: "" });
    const [confirmed, setConfirmed] = useState(false);
    const [answers, setAnswers] = useState<(number | null)[]>(Array(10).fill(null));
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [duplicateEmail, setDuplicateEmail] = useState<string | null>(null);

    useEffect(() => {
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onExit(); }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onExit]);

    useEffect(() => {
        overlayRef.current?.scrollTo({ top: 0 });
    }, [step]);

    const stepIndex: Record<UatStep, number> = { welcome: -1, consent: 0, about: 1, confirm: 2, rate: 3, done: 3 };
    const allFilled = answers.every((a) => a !== null);

    async function submit() {
        setSending(true); setError(null);
        try {
            const res = await postUat({ consent: true, email: demo.email.trim(), peran: demo.peran,
                pengalaman: demo.pengalaman, freqTools: demo.freqTools, answers: answers as number[], komentar: "" });
            if (res.ok) setStep("done");
            else if (res.duplicate) { setDuplicateEmail(demo.email.trim()); setError("Email ini sudah pernah mengisi."); setStep("about"); }
            else setError(res.error || "Gagal mengirim. Coba lagi.");
        } catch {
            setError("Tidak dapat menghubungi server. Periksa koneksi dan coba lagi.");
        } finally {
            setSending(false);
        }
    }

    return (
        <motion.div ref={overlayRef} className="uat" initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }} transition={{ duration: 0.7, ease: "easeOut" }}>
            <button className="uat__exit" onClick={onExit} aria-label="Kembali">✕ Kembali</button>
            {step !== "welcome" && step !== "done" && <UatProgress steps={STEPS} current={stepIndex[step]} />}
            <div className="uat__stage">
                <AnimatePresence mode="wait">
                    <motion.div key={step} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }} className={`uat__panel uat__panel--${step}`}>
                        {step === "welcome" && <UatWelcome onStart={() => setStep("consent")} />}
                        {step === "consent" && <UatConsent agreed={agreed} onAgreeChange={setAgreed} onNext={() => setStep("about")} />}
                        {step === "about" && (
                            <>
                                {error && <p className="uat__error">{error}</p>}
                                <UatDemographics
                                    value={demo}
                                    onChange={setDemo}
                                    onNext={() => { setError(null); setStep("confirm"); }}
                                    duplicateEmail={duplicateEmail}
                                    onEmailChange={() => { setDuplicateEmail(null); setError(null); }}
                                />
                            </>
                        )}
                        {step === "confirm" && (
                            <div className="uatcard">
                                <h3 className="uatcard__title">Konfirmasi</h3>
                                <p className="uatcard__body">Sebelum menilai, pastikan Anda sudah: memilih contoh kode,
                                    menjalankannya, membuka temuan, dan melihat asal aturan CTDL/WIKA.</p>
                                <label className="uatcard__check">
                                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                                    <span>Sudah saya coba.</span>
                                </label>
                                <button className="uat-btn uat-btn--go" disabled={!confirmed} onClick={() => setStep("rate")}>Lanjut →</button>
                            </div>
                        )}
                        {step === "rate" && (
                            <div className="uatcard">
                                <h3 className="uatcard__title">Penilaian</h3>
                                <SusScale answers={answers} onChange={(i, v) => setAnswers((p) => p.map((x, j) => (j === i ? v : x)))} />
                                {error && <p className="uat__error">{error}</p>}
                                <button className="uat-btn uat-btn--go" disabled={!allFilled || sending} onClick={submit}>
                                    {sending ? "Mengirim…" : "Kirim Penilaian"}
                                </button>
                            </div>
                        )}
                        {step === "done" && <UatThankYou onHome={onExit} />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </motion.div>
    );
}
