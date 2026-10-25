import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  GraduationCap,
  Handshake,
  Leaf,
  MailCheck,
  MapPin,
  MessagesSquare,
  QrCode,
  Repeat,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { buttonClasses } from "../components/ui/Button";
import Avatar from "../components/ui/Avatar";
import HeroPreview from "../components/landing/HeroPreview";
import SwapCircleDiagram from "../components/landing/SwapCircleDiagram";
import { campusApi } from "../api/campus.api";
import { LISTING_TYPES } from "../constants/listingTypes";

const FEATURES = [
  { icon: QrCode, title: "QR safe handover", text: "Meet at a campus safe spot. The buyer scans the seller's QR code to confirm the deal." },
  { icon: Sparkles, title: "AI-written listings", text: "Upload a photo and AI fills in the title, category, condition and a fair price." },
  { icon: MessagesSquare, title: "Real-time chat & offers", text: "Negotiate with offer cards: counter, accept, done. With typing indicators and read receipts." },
  { icon: ShieldCheck, title: "Trust score", text: "Built from verified deals, ratings and response time. Reviews unlock only after a real handover." },
  { icon: Leaf, title: "Eco impact", text: "See how much waste you kept out of landfill, and which hostel reuses the most." },
];

const STEPS = [
  { icon: MailCheck, title: "Verify your college email", text: "A 6-digit code proves you're a real student. No outsiders, ever." },
  { icon: Camera, title: "Post in seconds", text: "Snap a photo and let AI write the listing. Sell, rent, swap or give it away." },
  { icon: Handshake, title: "Chat & agree a deal", text: "Make offers, counter, then pick a safe meetup spot and time." },
  { icon: ScanLine, title: "Scan to complete", text: "Scan the seller's QR at the handover. The deal is confirmed and reviews unlock." },
];

const SAFETY_POINTS = [
  "Every account is tied to a verified college email",
  "Meet only at busy, CCTV-covered spots on campus",
  "A QR handover proves the deal really happened",
  "Report or block anyone in one tap",
  "Passwords hashed with bcrypt, sessions in HttpOnly cookies",
];

const card = "rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900";

function SectionHeading({ eyebrow, title, subtitle }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-bold tracking-wider text-brand-600 uppercase dark:text-brand-400">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">{subtitle}</p>}
    </div>
  );
}

function FeatureIcon({ icon: Icon }) {
  return (
    <span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25 dark:bg-brand-500">
      <Icon className="size-6" />
    </span>
  );
}

function Hero({ campuses }) {
  return (
    <section className="relative">
      <div className="bg-dots absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
      <div className="absolute top-0 left-1/2 -z-10 h-[28rem] w-[56rem] -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl dark:bg-brand-500/15" />

      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-16 px-4 pt-10 pb-24 sm:px-6 lg:grid-cols-2 lg:pt-20">
        <div className="animate-fade-up text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
            <GraduationCap className="size-4" /> Students only · College email verified
          </span>

          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Buy, sell & swap with students on{" "}
            <span className="bg-linear-to-r from-brand-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-brand-400 dark:via-violet-400 dark:to-fuchsia-400">
              your campus
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg text-slate-600 lg:mx-0 dark:text-slate-400">
            The marketplace for verified students only. Post in seconds with AI, negotiate in real time, and finish
            every deal at a safe spot with a QR handover.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
            <Link to="/signup" className={buttonClasses({ variant: "gradient", size: "lg" })}>
              Join with your college email <ArrowRight className="size-4" />
            </Link>
            <Link to="/login" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              I already have an account
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-slate-500 lg:justify-start dark:text-slate-400">
            {["No strangers", "Safe meetup spots", "Free for students"].map((point) => (
              <li key={point} className="flex items-center gap-1.5">
                <BadgeCheck className="size-4 text-emerald-500" /> {point}
              </li>
            ))}
          </ul>

          {campuses.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Live at</span>
              {campuses.map((campus) => (
                <span
                  key={campus._id}
                  title={campus.name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  <MapPin className="size-3 text-brand-500" /> {campus.shortName}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="animate-fade-up px-4 [animation-delay:150ms] sm:px-0">
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}

function ListingTypes() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="More than buy & sell"
        title="Six ways to trade, built for hostel life"
        subtitle="From exam-week rentals to graduating seniors giving everything away."
      />
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {LISTING_TYPES.map(({ icon: Icon, label, example, gradient }) => (
          <div
            key={label}
            className={`${card} p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/5 dark:hover:shadow-black/30`}
          >
            <span className={`grid size-12 place-items-center rounded-2xl bg-linear-to-br text-white shadow-lg ${gradient}`}>
              <Icon className="size-6" />
            </span>
            <h3 className="mt-5 text-lg font-bold">{label}</h3>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{example}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Features() {
  return (
    <section
      id="features"
      className="scroll-mt-16 border-y border-slate-200 bg-white py-20 dark:border-slate-800 dark:bg-slate-900/40"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          eyebrow="Features"
          title="Not just another buy-and-sell group"
          subtitle="Everything a campus marketplace needs to be safe, fast and actually fun to use."
        />

        <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <article className="relative overflow-hidden rounded-3xl border border-slate-200 bg-linear-to-br from-brand-50 via-white to-fuchsia-50 p-6 sm:p-8 lg:col-span-2 lg:row-span-2 dark:border-slate-800 dark:from-brand-500/10 dark:via-slate-900 dark:to-fuchsia-500/10">
            <FeatureIcon icon={Repeat} />
            <h3 className="mt-5 text-2xl font-bold">Swap Circles</h3>
            <p className="mt-2 max-w-lg text-slate-600 dark:text-slate-400">
              Barter is hard when the person who wants your book has nothing you need. CampusSwap finds loops of two or
              three students where everyone gets what they want, with no cash involved.
            </p>
            <SwapCircleDiagram className="mx-auto mt-6 w-full max-w-md" />
          </article>

          {FEATURES.map(({ icon, title, text }) => (
            <article key={title} className={`${card} p-6`}>
              <FeatureIcon icon={icon} />
              <h3 className="mt-5 text-lg font-bold">{title}</h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:px-6">
      <SectionHeading eyebrow="How it works" title="From post to handover in four steps" />
      <ol className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, text }, index) => (
          <li key={title} className={`${card} relative overflow-hidden p-6`}>
            <span className="absolute top-3 right-5 text-6xl font-extrabold text-slate-100 select-none dark:text-slate-800">
              {index + 1}
            </span>
            <span className="relative grid size-11 place-items-center rounded-xl bg-linear-to-br from-brand-500 to-fuchsia-500 text-white">
              <Icon className="size-5" />
            </span>
            <h3 className="relative mt-5 font-bold">{title}</h3>
            <p className="relative mt-1.5 text-sm text-slate-600 dark:text-slate-400">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function TrustRing({ score }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative grid size-16 shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-slate-100 dark:stroke-slate-800" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
          className="stroke-emerald-500"
        />
      </svg>
      <span className="text-lg font-extrabold">{score}</span>
    </div>
  );
}

function Safety() {
  return (
    <section id="safety" className="scroll-mt-16 border-t border-slate-200 bg-white py-20 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <div>
          <p className="text-sm font-bold tracking-wider text-brand-600 uppercase dark:text-brand-400">Safety first</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Built so you can trust every trade</h2>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
            Random buy-and-sell groups are full of strangers and no-shows. On CampusSwap, everyone is a verified student
            on your own campus.
          </p>
          <ul className="mt-8 space-y-3">
            {SAFETY_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" />
                <span className="text-slate-700 dark:text-slate-300">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-md" aria-hidden>
          <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-linear-to-br from-emerald-400/20 to-brand-500/20 blur-3xl" />
          <div className={`${card} p-6 shadow-xl shadow-slate-900/5 dark:shadow-black/30`}>
            <div className="flex items-center gap-4">
              <Avatar name="Riya Kapoor" size="lg" />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-bold">
                  Riya Kapoor <BadgeCheck className="size-4 text-brand-500" />
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">CSE · Hostel Block A</p>
              </div>
              <div className="ml-auto text-center">
                <TrustRing score={94} />
                <p className="mt-1 text-[11px] font-semibold text-slate-500">Trust score</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                ["23", "deals"],
                ["4.9★", "rating"],
                ["~5 min", "replies"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-2xl bg-slate-50 py-3 dark:bg-slate-800/70">
                  <p className="font-extrabold">{value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-brand-100 px-3 py-1 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">🎓 Verified student</span>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">⭐ Trusted seller</span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">🌱 Eco warrior</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="relative overflow-hidden rounded-[2rem] bg-linear-to-br from-brand-600 via-violet-600 to-fuchsia-600 px-6 py-14 text-center text-white sm:px-12">
        <div className="absolute -top-20 -left-20 size-72 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -right-16 -bottom-24 size-80 rounded-full bg-fuchsia-300/20 blur-2xl" />
        <h2 className="relative text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
          Your hostel's next great deal is one post away
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-white/80">Join with your college email in under a minute.</p>
        <Link
          to="/signup"
          className="relative mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 font-semibold text-brand-700 shadow-lg transition hover:bg-brand-50 active:scale-[0.98]"
        >
          Create your free account <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

export default function Landing() {
  const [campuses, setCampuses] = useState([]);

  useEffect(() => {
    campusApi
      .list()
      // The demo campus is for testing and demo accounts, so it isn't advertised.
      .then(({ campuses }) => setCampuses(campuses.filter((campus) => campus.slug !== "demo")))
      .catch(() => setCampuses([]));
  }, []);

  return (
    <>
      <Hero campuses={campuses} />
      <ListingTypes />
      <Features />
      <HowItWorks />
      <Safety />
      <FinalCta />
    </>
  );
}
