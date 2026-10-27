import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { EllipsisVertical } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";

const PLACEMENTS = {
  bottom: "top-full mt-2",
  top: "bottom-full mb-2",
};

const itemClasses = (tone) =>
  `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-500 ${
    tone === "danger"
      ? "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
      : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
  }`;

// An icon button (⋮ by default) that opens a short list of actions. `items`: [{ label, icon, to }] for
// links, [{ label, icon, onSelect, tone }] for actions. Arrow keys move between items; Escape, Tab or a
// click elsewhere closes it. Choosing an action puts focus back on the button first, so a dialog the
// action opens returns focus there when it closes.
export default function Menu({ label, icon: Icon = EllipsisVertical, items, placement = "bottom", align = "right", className = "", buttonClassName = "" }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const itemRefs = useRef([]);
  const menuId = useId();

  // Escape (or a click elsewhere) while focus is inside: its items are about to disappear, so focus
  // goes back to the button.
  const dismiss = useCallback(() => {
    const hadFocus = rootRef.current?.contains(document.activeElement);
    setOpen(false);
    if (hadFocus) buttonRef.current?.focus();
  }, []);
  useClickOutside(rootRef, dismiss, open);

  useEffect(() => {
    if (open) itemRefs.current[0]?.focus();
  }, [open]);

  const focusItem = (index) => {
    const count = items.length;
    itemRefs.current[(index + count) % count]?.focus();
  };

  const handleKeyDown = (event) => {
    const index = itemRefs.current.indexOf(document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusItem(items.length - 1);
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  const choose = (item) => {
    setOpen(false);
    buttonRef.current?.focus();
    item.onSelect?.();
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        className={`grid size-10 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white ${buttonClassName}`}
      >
        <Icon className="size-5" aria-hidden />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={handleKeyDown}
          className={`absolute z-30 w-60 animate-fade-up rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/40 ${PLACEMENTS[placement]} ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {items.map((item, index) => {
            const ItemIcon = item.icon;
            const content = (
              <>
                {ItemIcon && <ItemIcon className="size-4 shrink-0 opacity-80" aria-hidden />}
                <span className="min-w-0 truncate">{item.label}</span>
              </>
            );
            const ref = (element) => {
              itemRefs.current[index] = element;
            };
            return item.to ? (
              <Link key={item.label} ref={ref} to={item.to} role="menuitem" onClick={() => setOpen(false)} className={itemClasses(item.tone)}>
                {content}
              </Link>
            ) : (
              <button key={item.label} ref={ref} type="button" role="menuitem" onClick={() => choose(item)} className={itemClasses(item.tone)}>
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
