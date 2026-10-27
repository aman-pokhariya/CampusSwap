import { useId, useState } from "react";
import { toast } from "sonner";
import { Keyboard, QrCode, RefreshCw, ScanQrCode, ShieldAlert, Timer } from "lucide-react";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import OtpInput from "../ui/OtpInput";
import QrScannerDialog from "./QrScannerDialog";
import { useCompleteDealMutation, useStartHandoverMutation } from "../../api/deals.api";
import { formatSeconds, useCountdown } from "../../hooks/useCountdown";
import { useNow } from "../../hooks/useNow";
import { HANDOVER_TTL_MINUTES } from "../../constants/deals";
import { firstName } from "../../utils/deals";

const card = "rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900";

// Seconds until the code expires, by the server's clock: never more than its 10 minutes, even when
// this device's clock runs behind.
const secondsUntil = (expiresAt, now = Date.now()) =>
  Math.min(HANDOVER_TTL_MINUTES * 60, Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000)));

// The buyer's error, in words that say what to do next.
const HANDOVER_ERRORS = {
  NO_HANDOVER: "The seller hasn't shown a code yet. Ask them to tap “Show handover QR” on their deal page.",
  CODE_EXPIRED: "This code expired. Ask the seller to tap “New code”, then use that one.",
  TOO_MANY_ATTEMPTS: "Too many wrong tries. Ask the seller to make a new code, then try again.",
  LISTING_UNDER_REVIEW: "The listing is under review, so the handover is paused. You can still cancel the deal.",
  DEAL_CHANGED: "The seller just made a new code. Use the new one.",
};

// A wrong code (or an old QR) uses up one of the 5 tries; the last one sends the buyer to the seller.
const handoverError = (err, { scanned = false } = {}) => {
  const { code, attemptsLeft } = err.data ?? {};
  if (code !== "WRONG_CODE") return HANDOVER_ERRORS[code] ?? err.message;
  const what = scanned ? "That QR code doesn't match the seller's current one" : "That code doesn't match";
  if (!(attemptsLeft > 0)) return `${what}, and that was the last try. Ask the seller to tap “New code”.`;
  return `${what}. ${attemptsLeft} ${attemptsLeft === 1 ? "try" : "tries"} left.`;
};

function HandoverShell({ subtitle, children }) {
  return (
    <section className={card} aria-labelledby="handover-title">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <QrCode className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id="handover-title" className="text-lg font-bold">
            Handover
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

const PAUSED = (
  <Alert type="warning" className="mt-4">
    The handover is paused while the listing is under review. You can still cancel the deal.
  </Alert>
);

// ── Seller ────────────────────────────────────────────────

// The seller shows a QR code (and the same proof as a 6-digit code) when they hand the item over.
// The code lives only in this card's state: it's never cached, and each "New code" replaces it on the
// server, so an old one stops working.
function SellerHandover({ deal }) {
  const [startHandover, { isLoading }] = useStartHandoverMutation();
  const [shown, setShown] = useState(null); // { image, code }
  const [secondsLeft, restart] = useCountdown(0);
  const other = firstName(deal.otherUser?.name);
  const expired = shown && secondsLeft === 0;

  const showCode = async () => {
    try {
      const { qr, code, expiresAt } = await startHandover({ dealId: deal._id }).unwrap();
      // Downloaded the first time a code is shown, not with the page.
      const { default: QRCode } = await import("qrcode");
      const image = await QRCode.toDataURL(qr, {
        width: 576,
        margin: 2,
        errorCorrectionLevel: "M",
        color: { dark: "#0f172a", light: "#ffffff" },
      });
      setShown({ image, code });
      restart(secondsUntil(expiresAt));
    } catch (err) {
      // An API error has a status; anything else is the QR library failing to download.
      toast.error(err.status ? err.message : "Couldn't draw the QR code. Check your connection and try again.");
    }
  };

  if (deal.listing?.hidden) {
    return <HandoverShell subtitle="Show your code when you hand the item over.">{PAUSED}</HandoverShell>;
  }

  if (!shown) {
    return (
      <HandoverShell subtitle={`When you meet and ${other} has checked the item, show them your code. It completes the deal.`}>
        {deal.handover?.active && (
          <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
            A code from earlier is still live. Showing it here makes a new one, and the old one stops working.
          </p>
        )}
        <Button variant="gradient" size="lg" onClick={showCode} loading={isLoading} className="mt-5 w-full sm:w-auto">
          <QrCode className="size-5" /> Show handover QR
        </Button>
        <p className="mt-3 flex items-start gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
          <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          Show this only when you hand over the item: anyone with the code can mark the deal as done.
        </p>
      </HandoverShell>
    );
  }

  return (
    <HandoverShell subtitle={`${other} scans this QR, or types the code under it.`}>
      <div className="mt-5 flex flex-col items-center">
        {/* White in both themes: phone cameras read dark-on-light codes best. */}
        <div className="relative overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:ring-0">
          <img
            src={shown.image}
            alt={`Handover QR code for ${other} to scan`}
            className={`size-60 sm:size-72 [image-rendering:pixelated] ${expired ? "opacity-20 blur-[2px]" : ""}`}
          />
          {expired && (
            <div className="absolute inset-0 grid place-items-center p-4 text-center">
              <p className="rounded-xl bg-white/90 px-3 py-2 text-sm font-bold text-slate-900">This code expired</p>
            </div>
          )}
        </div>

        <p className="mt-4 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">Or they type</p>
        <p
          className={`mt-1 font-mono text-4xl font-extrabold tracking-[0.25em] tabular-nums sm:text-5xl ${expired ? "text-slate-300 line-through dark:text-slate-600" : ""}`}
        >
          <span aria-hidden>
            {shown.code.slice(0, 3)}
            <span className="ml-3">{shown.code.slice(3)}</span>
          </span>
          {/* Read digit by digit, not as "four hundred and twelve thousand…". */}
          <span className="sr-only">{shown.code.split("").join(" ")}</span>
        </p>

        <p
          className={`mt-3 flex items-center gap-1.5 text-sm font-semibold ${expired ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-300"}`}
          role="timer"
          aria-live="off"
        >
          <Timer className="size-4" aria-hidden />
          {expired ? "Expired" : `Expires in ${formatSeconds(secondsLeft)}`}
        </p>

        <Button variant={expired ? "primary" : "secondary"} onClick={showCode} loading={isLoading} className="mt-4">
          <RefreshCw className="size-4" /> New code
        </Button>
      </div>

      <p className="mt-5 flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
        <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
        Show this only when you hand over the item. Never send it in chat or as a screenshot.
      </p>
    </HandoverShell>
  );
}

// ── Buyer ─────────────────────────────────────────────────

const tile = (active) =>
  `flex flex-col items-center gap-2 rounded-2xl border-2 p-4 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:pointer-events-none disabled:opacity-50 ${
    active
      ? "border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/15"
      : "border-brand-200 bg-brand-50/50 hover:border-brand-400 hover:bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/5 dark:hover:border-brand-400"
  }`;

// The buyer confirms they got the item: scan the seller's QR, or type the 6-digit code under it.
// Both are as easy to reach, because the camera isn't always an option (laptops, the http dev site).
function BuyerHandover({ deal }) {
  const [completeDeal, { isLoading }] = useCompleteDealMutation();
  const [typing, setTyping] = useState(false); // the code boxes are open
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0); // bumping it re-mounts the boxes: shake + refocus
  const codeFormId = useId();
  const live = deal.handover?.active;
  const now = useNow(live ? 1000 : null);
  const secondsLeft = live ? secondsUntil(deal.handover.expiresAt, now) : 0;
  const other = firstName(deal.otherUser?.name);

  // Resolves to a message saying what went wrong, or null once the deal is completed (the page then
  // shows the celebration by itself).
  const submit = async (proof) => {
    setError(null);
    try {
      await completeDeal({ dealId: deal._id, ...proof }).unwrap();
      return null;
    } catch (err) {
      const message = handoverError(err, { scanned: Boolean(proof.token) });
      setError(message);
      return message;
    }
  };

  const submitCode = async (value) => {
    if (await submit({ code: value })) {
      setCode("");
      setAttempt((n) => n + 1);
    }
  };

  const handleCodeChange = (value) => {
    setCode(value);
    setError(null);
    // Sent as soon as the last digit is typed or a code is pasted.
    if (/^\d{6}$/.test(value) && !isLoading) submitCode(value);
  };

  const openCodeEntry = () => {
    setScanning(false);
    setTyping(true);
  };

  if (deal.listing?.hidden) {
    return <HandoverShell subtitle="Confirm the handover once you have the item.">{PAUSED}</HandoverShell>;
  }

  return (
    <HandoverShell subtitle="Check the item first. Then confirm with the seller's code: that completes the deal.">
      <p
        className={`mt-4 flex items-center gap-1.5 text-sm font-semibold ${
          live && secondsLeft > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"
        }`}
      >
        <Timer className="size-4 shrink-0" aria-hidden />
        {live && secondsLeft > 0
          ? `${other}'s code is ready · expires in ${formatSeconds(secondsLeft)}`
          : `When you meet, ask ${other} to tap “Show handover QR”.`}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <button type="button" onClick={() => setScanning(true)} disabled={isLoading} className={tile(false)}>
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-white shadow-md shadow-brand-600/25 dark:bg-brand-500">
            <ScanQrCode className="size-6" aria-hidden />
          </span>
          <span className="font-bold">Scan seller's QR</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">With your phone's camera</span>
        </button>
        <button
          type="button"
          onClick={() => setTyping((open) => !open)}
          aria-expanded={typing}
          aria-controls={codeFormId}
          disabled={isLoading && !typing}
          className={tile(typing)}
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-600 text-white shadow-md shadow-brand-600/25 dark:bg-brand-500">
            <Keyboard className="size-6" aria-hidden />
          </span>
          <span className="font-bold">Enter 6-digit code</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">The numbers under their QR</span>
        </button>
      </div>

      {typing && (
        <form
          id={codeFormId}
          onSubmit={(event) => {
            event.preventDefault();
            if (/^\d{6}$/.test(code)) submitCode(code);
          }}
          className="mt-4 space-y-4 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60"
        >
          <div key={attempt} className={attempt > 0 && error ? "animate-shake" : ""}>
            <OtpInput value={code} onChange={handleCodeChange} disabled={isLoading} invalid={Boolean(error)} />
          </div>
          <Button type="submit" variant="gradient" loading={isLoading} disabled={!/^\d{6}$/.test(code)} className="w-full">
            Confirm handover
          </Button>
        </form>
      )}

      {error && (
        <Alert type="error" className="mt-4">
          {error}
        </Alert>
      )}

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">The camera needs the https site — on your laptop, use the code.</p>

      <QrScannerDialog
        open={scanning}
        dealId={deal._id}
        onToken={(token) => submit({ token })}
        onUseCode={openCodeEntry}
        onClose={() => setScanning(false)}
      />
    </HandoverShell>
  );
}

// Step 3 of a deal. The seller shows a code; the buyer scans or types it. Admins only look.
export default function HandoverCard({ deal }) {
  if (deal.role === "seller") return <SellerHandover deal={deal} />;
  if (deal.role === "buyer") return <BuyerHandover deal={deal} />;
  return null;
}
