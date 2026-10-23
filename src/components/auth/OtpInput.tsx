import React, { useRef } from 'react';

interface OtpInputProps {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  label?: string;
}

/** Six boxes with paste support and SMS autofill (one-time-code). */
export function OtpInput({ value, onChange, invalid, disabled, label = 'Verification code' }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  const set = (i: number, d: string) => {
    const next = digits.map((x, j) => j === i ? d : x).join('').replace(/\s/g, '');
    onChange(next.slice(0, 6));
  };

  return (
    <fieldset disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      <div className="flex justify-between gap-2">
        {digits.map((d, i) =>
        <input
          key={i}
          ref={(el) => refs.current[i] = el}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={6}
          value={d.trim()}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (v.length > 1) {
              onChange(v.slice(0, 6));
              refs.current[Math.min(v.length, 5)]?.focus();
              return;
            }
            set(i, v);
            if (v && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d.trim() && i > 0) refs.current[i - 1]?.focus();
          }}
          className={`h-14 w-full min-w-0 rounded-2xl bg-surface text-center text-xl font-semibold text-ink outline-none ring-1 focus:ring-2 disabled:opacity-60 ${invalid ? 'ring-danger focus:ring-danger' : 'ring-line focus:ring-brand'}`} />

        )}
      </div>
    </fieldset>);

}