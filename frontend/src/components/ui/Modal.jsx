import { useEffect, useRef } from "react";

const VARIANTS = {
  // A card, like ConfirmDialog.
  panel:
    "w-[min(28rem,calc(100%-2rem))] overflow-y-auto overscroll-contain rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-900 dark:text-white",
  // No frame at all, e.g. a photo shown full size.
  bare: "max-w-[calc(100%-2rem)] overflow-visible bg-transparent",
};

// A native <dialog>: focus trap, Esc and the dimmed backdrop come for free. The content only mounts
// while open, so a form inside starts fresh every time. `dismissible={false}` ignores Esc and
// backdrop clicks (e.g. while a request is running).
export default function Modal({ open, onClose, labelledBy, label, dismissible = true, variant = "panel", children }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={labelledBy}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current && dismissible) onClose(); // click on the dimmed backdrop
      }}
      className={`m-auto max-h-[calc(100dvh-2rem)] p-0 backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm ${VARIANTS[variant]}`}
    >
      {open && children}
    </dialog>
  );
}
