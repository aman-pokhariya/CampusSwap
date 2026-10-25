import { useId } from "react";
import { ChevronDown } from "lucide-react";

const fieldClasses = (error, extra) =>
  `w-full rounded-xl border bg-white text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:ring-4 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:disabled:bg-slate-800/70 dark:disabled:text-slate-400 ${
    error
      ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15 dark:border-rose-500/70"
      : "border-slate-200 focus:border-brand-500 focus:ring-brand-500/15 dark:border-slate-700 dark:focus:border-brand-400"
  } ${extra}`;

const describedBy = (id, error, hint) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

function FieldShell({ id, label, labelAside, error, hint, className = "", children }) {
  return (
    <div className={className}>
      {label && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {label}
          </label>
          {labelAside}
        </div>
      )}
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

const iconClasses = "pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-slate-400";

export function Input({ label, labelAside, error, hint, icon: Icon, rightSlot, className, id: idProp, ...props }) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <FieldShell id={id} label={label} labelAside={labelAside} error={error} hint={hint} className={className}>
      <div className="relative">
        {Icon && <Icon aria-hidden className={iconClasses} />}
        <input
          id={id}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={fieldClasses(error, `h-11 ${Icon ? "pl-10" : "pl-3.5"} ${rightSlot ? "pr-12" : "pr-3.5"}`)}
          {...props}
        />
        {rightSlot && <div className="absolute inset-y-0 right-1.5 flex items-center">{rightSlot}</div>}
      </div>
    </FieldShell>
  );
}

export function Select({ label, error, hint, icon: Icon, className, id: idProp, children, ...props }) {
  const autoId = useId();
  const id = idProp ?? autoId;

  return (
    <FieldShell id={id} label={label} error={error} hint={hint} className={className}>
      <div className="relative">
        {Icon && <Icon aria-hidden className={iconClasses} />}
        <select
          id={id}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={fieldClasses(error, `h-11 appearance-none pr-10 ${Icon ? "pl-10" : "pl-3.5"}`)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-slate-400" />
      </div>
    </FieldShell>
  );
}

export function Textarea({ label, error, hint, className, id: idProp, value = "", maxLength, ...props }) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const counter = maxLength ? `${value.length}/${maxLength}` : null;

  return (
    <FieldShell
      id={id}
      label={label}
      labelAside={counter && <span className="text-xs text-slate-400 tabular-nums">{counter}</span>}
      error={error}
      hint={hint}
      className={className}
    >
      <textarea
        id={id}
        value={value}
        maxLength={maxLength}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={fieldClasses(error, "min-h-24 resize-y px-3.5 py-2.5")}
        {...props}
      />
    </FieldShell>
  );
}
