import { useEffect, useId, useRef } from "react";
import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import Button from "./Button";

// The icon, its colours and the confirm button for each tone: a warning only for destructive actions.
const TONES = {
  danger: {
    icon: TriangleAlert,
    badge: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
    button: "danger",
  },
  brand: {
    icon: Info,
    badge: "bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
    button: "primary",
  },
  success: {
    icon: CircleCheck,
    badge: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    button: "primary",
  },
};

// Built on the native <dialog> element: it traps focus, closes on Esc and dims the page for free.
// `icon` replaces the tone's icon (e.g. a handshake for accepting an offer). `children` go between the
// text and the buttons (say, a reason to pick); `confirmDisabled` holds the button until it's filled in.
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  icon,
  loading = false,
  confirmDisabled = false,
  onConfirm,
  onClose,
  children,
}) {
  const dialogRef = useRef(null);
  const id = useId();
  const style = TONES[tone] ?? TONES.danger;
  const Icon = icon ?? style.icon;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(event) => {
        event.preventDefault(); // Esc: let the parent decide (it may be mid-request)
        if (!loading) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current && !loading) onClose(); // click on the dimmed backdrop
      }}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900 dark:text-white"
    >
      <div className="p-6">
        <span className={`grid size-11 place-items-center rounded-2xl ${style.badge}`}>
          <Icon className="size-5" aria-hidden />
        </span>
        <h2 id={`${id}-title`} className="mt-4 text-lg font-bold">
          {title}
        </h2>
        {description && (
          <p id={`${id}-description`} className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            {description}
          </p>
        )}
        {children && <div className="mt-5 space-y-4">{children}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={style.button} onClick={onConfirm} loading={loading} disabled={confirmDisabled}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
