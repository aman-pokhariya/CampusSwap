import { Check } from "lucide-react";
import { getPasswordStrength } from "../../utils/password";

const BAR_COLORS = ["bg-rose-500", "bg-rose-500", "bg-amber-500", "bg-lime-500", "bg-emerald-500"];

export default function PasswordStrength({ password }) {
  if (!password) return null;

  const { checks, score, label } = getPasswordStrength(password);

  return (
    <div className="mt-2.5 space-y-2" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5">
          {[1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                step <= score ? BAR_COLORS[score] : "bg-slate-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
        <span className="w-16 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {checks.map((check) => (
          <li
            key={check.label}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              check.ok ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {check.ok ? (
              <Check className="size-3.5 shrink-0" strokeWidth={3} />
            ) : (
              <span className="mx-[5px] size-1 shrink-0 rounded-full bg-current" />
            )}
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
