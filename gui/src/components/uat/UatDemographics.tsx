import { useEffect, useRef, useState } from "react";
import { checkUatEmail } from "../../api";
import { UatSelect } from "./UatSelect";

const PERAN_OPTS = [
    "Backend Developer",
    "Frontend Developer",
    "Fullstack Developer",
    "Lead Developer",
    "QA / Tester",
    "Lainnya",
];
const PENGALAMAN_OPTS = ["< 1 tahun", "1-3 tahun", "3-5 tahun", "> 5 tahun"];
const FREQ_OPTS = ["Tidak pernah", "Kadang", "Sering", "Sangat sering"];

export interface DemoValue {
    email: string;
    peran: string;
    pengalaman: string;
    freqTools: string;
}

interface Props {
    value: DemoValue;
    onChange: (v: DemoValue) => void;
    onNext: () => void;
    onBack?: () => void;
    duplicateEmail?: string | null;
    onEmailChange?: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
const COMMON_DOMAIN_TYPOS = new Map<string, string>([
    ["gmail.comm", "gmail.com"],
    ["gmai.com", "gmail.com"],
    ["gmial.com", "gmail.com"],
    ["yahoo.comm", "yahoo.com"],
    ["outlook.comm", "outlook.com"],
]);

function normalizeEmail(email: string) {
    return email.trim().toLowerCase();
}

function validateEmailInput(email: string): { ok: boolean; message?: string } {
    const normalized = normalizeEmail(email);
    if (!EMAIL_RE.test(normalized)) {
        return { ok: false, message: "Format email belum benar." };
    }
    const [, domain = ""] = normalized.split("@");
    const suggestion = COMMON_DOMAIN_TYPOS.get(domain);
    if (suggestion) {
        return {
            ok: false,
            message: `Domain email tampak salah. Mungkin maksud Anda ${suggestion}.`,
        };
    }
    return { ok: true };
}

export function UatDemographics({
    value,
    onChange,
    onNext,
    onBack,
    duplicateEmail,
    onEmailChange,
}: Props) {
    const [emailState, setEmailState] = useState<
        "idle" | "checking" | "ok" | "dup" | "invalid" | "soft"
    >("idle");
    const [emailMessage, setEmailMessage] = useState("");
    const emailRef = useRef(value.email);

    useEffect(() => {
        emailRef.current = value.email;
    }, [value.email]);

    async function verifyEmail() {
        const email = normalizeEmail(value.email);
        const verdict = validateEmailInput(email);
        if (!verdict.ok) {
            setEmailMessage(verdict.message || "Email tidak valid.");
            setEmailState("invalid");
            return false;
        }

        setEmailState("checking");
        setEmailMessage("");
        const res = await checkUatEmail(email);
        if (normalizeEmail(emailRef.current) !== email) return false;

        if (res.exists) {
            setEmailMessage("Email ini sudah pernah mengisi.");
            setEmailState("dup");
            return false;
        }
        if (res.soft) {
            setEmailMessage(
                "Cek email sedang tidak tersedia; email tetap diverifikasi saat kirim.",
            );
            setEmailState("soft");
            return true;
        }

        setEmailState("ok");
        return true;
    }

    async function onEmailBlur() {
        if (value.email.trim()) await verifyEmail();
    }

    async function handleNext() {
        if (emailState !== "ok" && emailState !== "soft") {
            const ok = await verifyEmail();
            if (!ok) return;
        }
        onNext();
    }

    const externalDup =
        duplicateEmail && normalizeEmail(duplicateEmail) === normalizeEmail(value.email);
    const shownState = externalDup ? "dup" : emailState;
    const shownMessage = externalDup
        ? "Email ini sudah pernah mengisi."
        : emailMessage;
    const baseValid =
        validateEmailInput(value.email).ok &&
        value.peran &&
        value.pengalaman &&
        value.freqTools;
    const canTryNext =
        baseValid && shownState !== "checking" && shownState !== "dup";

    return (
        <div className="uatcard">
            <h3 className="uatcard__title">Tentang Anda</h3>
            <label className="uatfield">
                <span>Email</span>
                <input
                    type="email"
                    className={`uatinput${
                        shownState === "dup" || shownState === "invalid"
                            ? " uatinput--err shake"
                            : ""
                    }${shownState === "ok" ? " uatinput--ok" : ""}`}
                    value={value.email}
                    onChange={(e) => {
                        onChange({ ...value, email: e.target.value });
                        onEmailChange?.();
                        setEmailState("idle");
                        setEmailMessage("");
                    }}
                    onBlur={onEmailBlur}
                    placeholder="nama@wika.co.id"
                />
                {(shownState === "dup" || shownState === "invalid") && (
                    <span className="uatfield__err">{shownMessage}</span>
                )}
                {shownState === "checking" && (
                    <span className="uatfield__hint">Memeriksa email...</span>
                )}
                {shownState === "soft" && (
                    <span className="uatfield__hint">{shownMessage}</span>
                )}
                {shownState === "ok" && <span className="uatfield__ok">✓</span>}
            </label>
            <label className="uatfield">
                <span>Peran / jabatan</span>
                <UatSelect
                    value={value.peran}
                    onChange={(v) => onChange({ ...value, peran: v })}
                    options={PERAN_OPTS}
                />
            </label>
            <label className="uatfield">
                <span>Pengalaman PHP/Laravel</span>
                <UatSelect
                    value={value.pengalaman}
                    onChange={(v) => onChange({ ...value, pengalaman: v })}
                    options={PENGALAMAN_OPTS}
                />
            </label>
            <label className="uatfield">
                <span>Frekuensi memakai tools code review</span>
                <UatSelect
                    value={value.freqTools}
                    onChange={(v) => onChange({ ...value, freqTools: v })}
                    options={FREQ_OPTS}
                />
            </label>
            <div className="uatcard__actions">
                {onBack && (
                    <button
                        className="uat-btn uat-btn--back"
                        onClick={onBack}
                    >
                        ← Sebelumnya
                    </button>
                )}
                <button
                    className="uat-btn uat-btn--go"
                    disabled={!canTryNext}
                    onClick={handleNext}
                >
                    {shownState === "checking" ? "Memeriksa..." : "Lanjut →"}
                </button>
            </div>
        </div>
    );
}
