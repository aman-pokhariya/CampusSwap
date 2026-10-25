import Logo from "../ui/Logo";

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:px-6 dark:text-slate-400">
        <Logo size="sm" />
        <p className="text-center">Made for students, by a student · © {new Date().getFullYear()} CampusSwap</p>
      </div>
    </footer>
  );
}
