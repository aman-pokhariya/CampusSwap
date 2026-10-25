import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "./Field";

export default function PasswordInput({ icon = Lock, ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <Input
      {...props}
      icon={icon}
      type={visible ? "text" : "password"}
      rightSlot={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="grid size-9 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      }
    />
  );
}
