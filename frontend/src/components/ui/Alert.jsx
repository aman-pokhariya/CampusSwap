import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";

const STYLES = {
  error: {
    icon: CircleAlert,
    classes: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200",
  },
  warning: {
    icon: TriangleAlert,
    classes: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  },
  success: {
    icon: CircleCheck,
    classes: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  },
  info: {
    icon: Info,
    classes: "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200",
  },
};

export default function Alert({ type = "info", title, children, className = "" }) {
  const { icon: Icon, classes } = STYLES[type];

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${classes} ${className}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
      </div>
    </div>
  );
}
