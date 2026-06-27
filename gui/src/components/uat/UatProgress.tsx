import { Fragment } from "react";

interface Props {
    steps: string[];
    current: number;
    // Klik langkah yang SUDAH dilewati untuk mundur (opsional).
    onStepClick?: (index: number) => void;
}

export function UatProgress({ steps, current, onStepClick }: Props) {
    return (
        <div className="uatprog" aria-label="Kemajuan pengisian">
            {steps.map((s, i) => {
                const done = i < current;
                const active = i === current;
                const clickable = i < current && !!onStepClick;
                return (
                    <Fragment key={s}>
                        {i > 0 && (
                            <span
                                className={`uatprog__line${i <= current ? " is-done" : ""}`}
                                aria-hidden
                            />
                        )}
                        <button
                            type="button"
                            className={`uatprog__step${done ? " is-done" : ""}${active ? " is-active" : ""}`}
                            onClick={
                                clickable ? () => onStepClick!(i) : undefined
                            }
                            disabled={!clickable}
                            aria-current={active ? "step" : undefined}
                            title={clickable ? `Kembali ke: ${s}` : s}
                        >
                            <span className="uatprog__num">
                                {done ? "✓" : i + 1}
                            </span>
                            <span className="uatprog__label">{s}</span>
                        </button>
                    </Fragment>
                );
            })}
        </div>
    );
}
