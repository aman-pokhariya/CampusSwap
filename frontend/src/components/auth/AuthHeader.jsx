export default function AuthHeader({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-8">
      {Icon && (
        <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-linear-to-br from-brand-500 to-fuchsia-500 text-white shadow-lg shadow-brand-500/30">
          <Icon className="size-6" />
        </span>
      )}
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      {subtitle && <div className="mt-2 text-slate-600 dark:text-slate-400">{subtitle}</div>}
    </div>
  );
}
