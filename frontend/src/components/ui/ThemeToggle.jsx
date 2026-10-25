import { useDispatch, useSelector } from "react-redux";
import { Moon, Sun } from "lucide-react";
import { toggleTheme } from "../../redux/themeSlice";

export default function ThemeToggle() {
  const dispatch = useDispatch();
  const dark = useSelector((state) => state.theme.mode) === "dark";

  return (
    <button
      type="button"
      onClick={() => dispatch(toggleTheme())}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="grid size-10 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
    >
      {/* Both icons share one grid cell and cross-fade. */}
      <Sun
        className={`col-start-1 row-start-1 size-5 transition duration-300 ${dark ? "scale-50 -rotate-90 opacity-0" : "opacity-100"}`}
      />
      <Moon
        className={`col-start-1 row-start-1 size-5 transition duration-300 ${dark ? "opacity-100" : "scale-50 rotate-90 opacity-0"}`}
      />
    </button>
  );
}
