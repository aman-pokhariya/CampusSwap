import { useId, useState } from "react";
import { toast } from "sonner";
import { Gift, HandCoins, Minus, Plus, Repeat, Search } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Alert from "../ui/Alert";
import { Input, Textarea } from "../ui/Field";
import { useMakeOfferMutation, useRespondToOfferMutation } from "../../api/chat.api";
import { formatRupees } from "../../utils/format";
import { periodWord } from "../../utils/chat";

const PRICED_TYPES = ["sell", "rent", "kit"];
const MAX_AMOUNT = 1_000_000;
const MAX_PERIODS = 52;

// Errors that mean "this offer can't go ahead any more": show them and close the dialog.
const CLOSING_CODES = ["OFFER_PENDING", "LISTING_UNAVAILABLE", "OFFER_CLOSED", "OFFER_EXPIRED", "OFFER_CHANGED", "NOT_YOUR_TURN", "BLOCKED"];

// The asking price, then 10% and 20% less, in round numbers (cheap items can repeat: shown once).
const roundNice = (value) => Math.max(1, value >= 100 ? Math.round(value / 10) * 10 : Math.round(value));
const priceChips = (price) =>
  [
    { value: price, label: null },
    { value: roundNice(price * 0.9), label: "−10%" },
    { value: roundNice(price * 0.8), label: "−20%" },
  ].filter((chip, index, chips) => chips.findIndex((other) => other.value === chip.value) === index);

// The note's example, from my side of the deal (sell, kit, rent, and the buyer on a wanted post).
const notePlaceholderFor = (type, selling) => {
  if (type === "rent") return selling ? "e.g. Pick it up and drop it back at my hostel" : "e.g. I need it for the weekend, can pick it up on Friday";
  return selling ? "e.g. Lowest I can go. You can pick it up from my hostel" : "e.g. I can pay cash and pick it up today";
};

// Every word of the dialog depends on the listing type, my side of the deal (buyer or seller) and
// whether it's a new offer or a counter: title, labels, the note's example and the footnote.
const copyFor = ({ type, rentPeriod }, myDealRole, isCounter) => {
  const selling = myDealRole === "seller";
  const footnote = isCounter ? "They'll have 48 hours to reply." : "They'll have 48 hours to accept, counter or decline.";

  if (type === "free") {
    if (isCounter) {
      return {
        icon: Gift,
        title: "Reply to the request",
        submit: "Send reply",
        sent: "Reply sent",
        noteLabel: "Your reply (optional)",
        notePlaceholder: selling ? "e.g. Sure! Pick it up from my hostel after 6" : "e.g. Thanks! I can pick it up from your hostel at 6",
        footnote,
      };
    }
    return selling
      ? {
          icon: Gift,
          title: "Offer it to them",
          submit: "Send offer",
          sent: "Offer sent",
          intro: "It's free. Offer it to them, and add a note about when they can pick it up.",
          notePlaceholder: "e.g. You can pick it up from my hostel after 6",
          footnote: "They can accept or decline within 48 hours.",
        }
      : {
          icon: Gift,
          title: "Request this item",
          submit: "Send request",
          sent: "Request sent",
          intro: "It's free. Send a request, and add a note about when you can pick it up.",
          notePlaceholder: "e.g. I can pick it up from your hostel at 6",
          footnote: "They can accept or decline your request within 48 hours.",
        };
  }
  if (type === "swap") {
    // The note always says what the visitor gives in exchange, so the owner reads it from the other side.
    return {
      icon: Repeat,
      title: isCounter ? "Counter the swap" : "Offer a swap",
      submit: "Send swap offer",
      sent: "Swap offer sent",
      noteLabel: selling ? "What they'll give you" : "What are you offering?",
      notePlaceholder: selling ? "e.g. Your OS book by Galvin, good condition" : "e.g. My OS book by Galvin, good condition",
      noteError: selling ? "What will they give you in exchange?" : "What are you offering in exchange?",
      amountLabel: selling ? "Cash on top (optional)" : "Add cash too (optional)",
      footnote,
    };
  }
  // A wanted post's seller is the visitor who has the item.
  if (type === "wanted" && selling) {
    return {
      icon: Search,
      title: isCounter ? "Counter offer" : "I have this",
      submit: isCounter ? "Send counter" : "Send my price",
      sent: isCounter ? "Counter offer sent" : "Price sent",
      amountLabel: "Your price",
      notePlaceholder: "e.g. Barely used, and I can bring it to your hostel",
      footnote,
    };
  }
  return {
    icon: HandCoins,
    title: isCounter ? "Counter offer" : "Make an offer",
    submit: isCounter ? "Send counter" : "Send offer",
    sent: isCounter ? "Counter offer sent" : "Offer sent",
    amountLabel: type === "rent" ? `Rent per ${periodWord(rentPeriod)}` : selling ? "Your price" : "Your offer",
    notePlaceholder: notePlaceholderFor(type, selling),
    footnote,
  };
};

// The ₹ sign as the Input's icon (same idea as the sell form).
function RupeeIcon({ className }) {
  return (
    <span className={`${className} grid place-items-center text-base leading-none font-semibold`} aria-hidden>
      ₹
    </span>
  );
}

const chipClasses = (active) =>
  `rounded-full px-3 py-1.5 text-xs font-semibold transition ${
    active
      ? "bg-brand-600 text-white dark:bg-brand-500"
      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
  }`;

const clampPeriods = (count) => Math.min(MAX_PERIODS, Math.max(1, count));

// − [3] + days. Rent offers are a price per period times this (1–52, like the server allows).
// The box keeps what's typed, so it can be empty for a moment (delete "1", then type "5").
function PeriodsStepper({ value, onChange, period }) {
  const id = useId();
  const [draft, setDraft] = useState(String(value));

  const commit = (count) => {
    setDraft(String(count));
    onChange(count);
  };
  const step = (delta) => commit(clampPeriods(value + delta));
  const stepButton =
    "grid size-11 place-items-center rounded-xl ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-40 dark:ring-slate-700 dark:hover:bg-slate-800";

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
        How many {periodWord(period, 2)}?
      </label>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => step(-1)} disabled={value <= 1} aria-label={`One ${periodWord(period)} less`} className={stepButton}>
          <Minus className="size-4" />
        </button>
        <input
          id={id}
          value={draft}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
            setDraft(digits);
            const typed = Number(digits);
            if (typed >= 1 && typed <= MAX_PERIODS) onChange(typed);
          }}
          // Left empty or out of range: back to the nearest allowed number.
          onBlur={() => commit(clampPeriods(Number(draft) || 1))}
          inputMode="numeric"
          className="h-11 w-14 rounded-xl border border-slate-200 bg-white text-center text-base font-bold shadow-sm outline-hidden focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 pointer-fine:text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <button type="button" onClick={() => step(1)} disabled={value >= MAX_PERIODS} aria-label={`One ${periodWord(period)} more`} className={stepButton}>
          <Plus className="size-4" />
        </button>
        <span className="text-sm text-slate-500 dark:text-slate-400">{periodWord(period, value)}</span>
      </div>
    </div>
  );
}

// Make an offer in a chat, or counter one (`offer` = the offer being countered). What it asks for
// depends on the listing: a price, rent per period × periods, what you'd swap, or just a request.
export default function OfferDialog({ open, onClose, conversation, offer = null }) {
  // The requests live here, so the dialog can't be dismissed (Esc, backdrop) while one is running.
  const [makeOffer, { isLoading: making }] = useMakeOfferMutation();
  const [respond, { isLoading: countering }] = useRespondToOfferMutation();
  const submitting = making || countering;

  return (
    <Modal open={open} onClose={onClose} labelledBy="offer-dialog-title" dismissible={!submitting}>
      <OfferForm
        conversation={conversation}
        offer={offer}
        onClose={onClose}
        makeOffer={makeOffer}
        respond={respond}
        submitting={submitting}
      />
    </Modal>
  );
}

function OfferForm({ conversation, offer, onClose, makeOffer, respond, submitting }) {
  const { listing, myDealRole } = conversation;
  const isCounter = Boolean(offer);
  const copy = copyFor(listing, myDealRole, isCounter);
  const showsAmount = listing.type !== "free";
  const askingPrice = PRICED_TYPES.includes(listing.type) && listing.price > 0 ? listing.price : null;
  const budget = listing.type === "wanted" && listing.price > 0 ? listing.price : null;

  const [amount, setAmount] = useState(() => {
    if (offer) return listing.type === "swap" && !offer.amount ? "" : String(offer.amount);
    return String(askingPrice ?? budget ?? "");
  });
  const [periods, setPeriods] = useState(offer?.periods ?? 1);
  // A swap counter starts from the swap on the table; any other note was the other person's own words.
  const [note, setNote] = useState(() => (offer && listing.type !== "swap" ? "" : (offer?.note ?? "")));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const value = amount === "" ? null : Number(amount);
  const changeAmount = (next) => {
    setAmount(next);
    setErrors((current) => ({ ...current, amount: undefined }));
  };

  // Same rules as the server (backend/utils/offers.js), so mistakes show instantly.
  const validate = () => {
    const found = {};
    if (PRICED_TYPES.includes(listing.type) && !(value >= 1)) found.amount = "Enter an amount";
    if (listing.type === "wanted" && value === null) found.amount = myDealRole === "seller" ? "Enter your price" : "Enter your offer";
    if (value !== null && value > MAX_AMOUNT) found.amount = "That's too much for CampusSwap";
    if (listing.type === "swap" && note.trim().length < 2) found.note = copy.noteError;
    return found;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const found = validate();
    if (Object.keys(found).length > 0) return setErrors(found);
    setFormError(null);

    const terms = {
      // Always the amount on screen: clearing a swap's cash means ₹0, not "keep the old cash".
      ...(showsAmount && { amount: value ?? 0 }),
      ...(listing.type === "rent" && { periods }),
      note: note.trim(),
    };

    try {
      if (isCounter) {
        await respond({ offerId: offer._id, conversationId: conversation._id, action: "counter", ...terms }).unwrap();
      } else {
        await makeOffer({ conversationId: conversation._id, ...terms }).unwrap();
      }
      toast.success(copy.sent);
      onClose();
    } catch (err) {
      if (CLOSING_CODES.includes(err.data?.code)) {
        // Nothing to fix here: close first, because toasts are drawn underneath an open dialog.
        onClose();
        toast.error(err.message);
      } else if (err.data?.errors) {
        setErrors(err.data.errors);
      } else {
        setFormError(err.message); // too many offers, offline, server trouble: shown in the form itself
      }
    }
  };

  const Icon = copy.icon;
  const hint = askingPrice
    ? `Listed at ${formatRupees(askingPrice)}${listing.type === "rent" ? `/${periodWord(listing.rentPeriod)}` : ""}`
    : budget
      ? `${myDealRole === "buyer" ? "Your" : "Their"} budget: up to ${formatRupees(budget)}`
      : null;
  const chips = askingPrice ? priceChips(askingPrice) : budget ? [{ value: budget, label: null }] : [];

  return (
    <form onSubmit={handleSubmit} noValidate className="p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="offer-dialog-title" className="text-lg font-bold">
            {copy.title}
          </h2>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{listing.title}</p>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {copy.intro && (
          <p className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-100">{copy.intro}</p>
        )}

        {listing.type === "swap" && (
          <Textarea
            label={copy.noteLabel}
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              setErrors((current) => ({ ...current, note: undefined }));
            }}
            maxLength={300}
            rows={3}
            placeholder={copy.notePlaceholder}
            error={errors.note}
          />
        )}

        {showsAmount && (
          <div>
            <Input
              label={copy.amountLabel}
              labelAside={hint && <span className="text-xs text-slate-500 dark:text-slate-400">{hint}</span>}
              value={amount}
              onChange={(event) => changeAmount(event.target.value.replace(/\D/g, "").slice(0, 7))}
              inputMode="numeric"
              placeholder={listing.type === "swap" ? "0" : "Amount"}
              icon={RupeeIcon}
              error={errors.amount}
            />
            {chips.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Quick amounts">
                {chips.map((chip) => (
                  <button
                    key={chip.value}
                    type="button"
                    onClick={() => changeAmount(String(chip.value))}
                    aria-pressed={value === chip.value}
                    className={chipClasses(value === chip.value)}
                  >
                    {formatRupees(chip.value)}
                    {chip.label && <span className="opacity-70"> · {chip.label}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {listing.type === "rent" && (
          <div className="space-y-2">
            <PeriodsStepper value={periods} onChange={setPeriods} period={listing.rentPeriod} />
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/70 dark:text-slate-300" aria-live="polite">
              {periods} {periodWord(listing.rentPeriod, periods)} →{" "}
              <strong className="text-slate-900 dark:text-white">{formatRupees((value ?? 0) * periods)} total</strong>
            </p>
          </div>
        )}

        {listing.type !== "swap" && (
          <Textarea
            label={copy.noteLabel ?? "Add a note (optional)"}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            rows={2}
            placeholder={copy.notePlaceholder}
            error={errors.note}
          />
        )}
      </div>

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{copy.footnote}</p>

      {formError && (
        <Alert type="error" className="mt-4">
          {formError}
        </Alert>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="gradient" loading={submitting}>
          {copy.submit}
        </Button>
      </div>
    </form>
  );
}
