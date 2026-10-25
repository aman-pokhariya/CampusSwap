import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { ArrowRight, BadgeCheck, Building, MapPin, Package, ShieldCheck, Sparkles } from "lucide-react";
import { buttonClasses } from "../components/ui/Button";
import { LISTING_TYPES } from "../constants/listingTypes";

const card = "rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900";

const greetingFor = (hour) => (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");

function ProfileRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}

export default function Home() {
  const user = useSelector((state) => state.auth.user);
  const campus = user.campus;
  const firstName = user.name.split(" ")[0];
  const memberSince = new Date(user.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

  return (
    <div className="animate-fade-up space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-600 via-violet-600 to-fuchsia-600 p-6 text-white sm:p-8">
        <div className="absolute -top-16 -right-10 size-64 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-24 left-1/3 size-72 rounded-full bg-fuchsia-300/20 blur-2xl" />

        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white/80">{greetingFor(new Date().getHours())} 👋</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">Welcome, {firstName}</h1>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium ring-1 ring-white/25">
              <BadgeCheck className="size-4" /> Verified student · {campus.name}
            </p>
          </div>
          <button
            type="button"
            disabled
            title="Posting opens in the next update"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 font-semibold text-brand-700 shadow-lg disabled:cursor-not-allowed"
          >
            <Sparkles className="size-4" /> Post a listing
            <span className="rounded-md bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase">Soon</span>
          </button>
        </div>
      </section>

      {!user.hostel && (
        <section className="flex flex-col gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/30 dark:bg-amber-500/10">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
              <Building className="size-5" />
            </span>
            <div>
              <p className="font-semibold text-amber-900 dark:text-amber-100">Add your hostel</p>
              <p className="text-sm text-amber-800/80 dark:text-amber-200/80">Students near you will see your listings first.</p>
            </div>
          </div>
          <Link to="/settings" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Set hostel <ArrowRight className="size-4" />
          </Link>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className={`${card} lg:col-span-2`}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Your campus feed</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <MapPin className="size-3.5 text-brand-500" /> {campus.shortName}
            </span>
          </div>

          <div className="mt-6 flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 px-6 py-12 text-center dark:border-slate-700">
            <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <Package className="size-7" />
            </span>
            <h3 className="mt-4 font-bold">The marketplace opens soon</h3>
            <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Listings, search and “near my hostel” arrive in the next update. Here's what you'll be able to post:
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {LISTING_TYPES.map(({ value, label, icon: Icon }) => (
                <span
                  key={value}
                  className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <Icon className="size-3.5" /> {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <section className={card}>
            <h2 className="flex items-center gap-2 font-bold">
              <ShieldCheck className="size-5 text-emerald-500" /> Safe meetup spots
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Hand over items only at these places.</p>
            <ul className="mt-4 space-y-3">
              {campus.safeSpots.map((spot) => (
                <li key={spot._id} className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <MapPin className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{spot.name}</p>
                    {spot.description && <p className="text-xs text-slate-500 dark:text-slate-400">{spot.description}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className={card}>
            <h2 className="font-bold">Your profile</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <ProfileRow label="Hostel" value={user.hostel || "Not set"} />
              <ProfileRow label="Member since" value={memberSince} />
              <ProfileRow label="Trust score" value="New member" />
            </dl>
            <Link to="/settings" className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-5 w-full" })}>
              Edit profile
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
