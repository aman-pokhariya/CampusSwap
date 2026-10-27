export default function EmptyState({ icon: Icon, title, description, action, className = "" }) {
  return (
    <div
      className={`flex flex-col items-center rounded-3xl border-2 border-dashed border-slate-200 px-6 py-14 text-center dark:border-slate-800 ${className}`}
    >
      {Icon && (
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <Icon className="size-7" />
        </span>
      )}
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
