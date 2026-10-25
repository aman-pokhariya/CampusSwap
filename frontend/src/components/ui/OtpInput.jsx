import { useRef } from "react";

// The value is a string where an empty box is a space, so every digit keeps its position
// ("12 4" = third box empty). A complete code matches /^\d{6}$/.
const toDigits = (value, length) =>
  Array.from({ length }, (_, i) => (/\d/.test(value[i] ?? "") ? value[i] : ""));
const fromDigits = (digits) => digits.map((d) => d || " ").join("").trimEnd();

export default function OtpInput({ value, onChange, length = 6, disabled = false, invalid = false, autoFocus = true }) {
  const boxes = useRef([]);
  const digits = toDigits(value, length);

  const focusBox = (index) => boxes.current[Math.max(0, Math.min(index, length - 1))]?.focus();

  // Writes digits starting at `index`: one typed digit, or a whole pasted/autofilled code.
  const fillFrom = (index, text) => {
    const incoming = text.replace(/\D/g, "");
    if (!incoming) return;

    const start = incoming.length >= length ? 0 : index;
    const next = [...digits];
    [...incoming.slice(0, length - start)].forEach((digit, k) => {
      next[start + k] = digit;
    });

    onChange(fromDigits(next));
    focusBox(start + incoming.length);
  };

  const handleChange = (index, event) => {
    let typed = event.target.value;
    // If the cursor was after an existing digit, the box now holds "old+new": keep only the new one.
    if (digits[index] && typed.length === 2) typed = typed.replace(digits[index], "");
    fillFrom(index, typed);
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = "";
      } else if (index > 0) {
        next[index - 1] = "";
        focusBox(index - 1);
      }
      onChange(fromDigits(next));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusBox(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusBox(index + 1);
    }
  };

  return (
    <div className="flex justify-between gap-2 sm:gap-3" role="group" aria-label="6-digit code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            boxes.current[index] = el;
          }}
          value={digit}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => {
            event.preventDefault();
            fillFrom(index, event.clipboardData.getData("text"));
          }}
          onFocus={(event) => event.target.select()}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoFocus={autoFocus && index === 0}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
          aria-invalid={invalid || undefined}
          className={`h-14 w-full min-w-0 rounded-xl border-2 bg-white text-center text-2xl font-bold text-slate-900 caret-brand-500 shadow-sm outline-none transition focus:ring-4 disabled:opacity-60 dark:bg-slate-900 dark:text-white ${
            invalid
              ? "border-rose-400 focus:ring-rose-500/15 dark:border-rose-500/70"
              : digit
                ? "border-brand-400 focus:border-brand-500 focus:ring-brand-500/15 dark:border-brand-500/70"
                : "border-slate-200 focus:border-brand-500 focus:ring-brand-500/15 dark:border-slate-700"
          }`}
        />
      ))}
    </div>
  );
}
