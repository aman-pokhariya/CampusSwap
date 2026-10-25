import { CircleCheck, TriangleAlert } from "lucide-react";
import { looksLikeEmail } from "../../utils/campus";

// Shown under the email field on signup: names the campus as soon as the domain matches.
export default function CampusHint({ email, campus, campusesLoaded }) {
  if (campus) {
    return (
      <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
        <CircleCheck className="size-3.5" /> {campus.name} · {campus.city}
      </span>
    );
  }

  if (campusesLoaded && looksLikeEmail(email)) {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-amber-600 dark:text-amber-400">
        <TriangleAlert className="size-3.5" /> We don't recognise this domain. Use the email your college gave you.
      </span>
    );
  }

  return "Use the email your college gave you, e.g. name@college.edu";
}
