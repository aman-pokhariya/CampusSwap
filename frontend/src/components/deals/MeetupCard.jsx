import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, CalendarDays, CalendarPlus, CircleCheck, Clock, MapPin, ShieldCheck } from "lucide-react";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import { Input } from "../ui/Field";
import { useConfirmMeetupMutation, useProposeMeetupMutation } from "../../api/deals.api";
import { useNow } from "../../hooks/useNow";
import { buildMeetupIcs, downloadIcs } from "../../utils/calendar";
import { firstName, meetupWindow, quickMeetupTimes, toDateTimeLocal, validateMeetup } from "../../utils/deals";
import { formatMeetupTime } from "../../utils/format";

const card = "rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-slate-800 dark:bg-slate-900";

const chipClasses = (active) =>
  `rounded-full px-3 py-1.5 text-xs font-semibold transition ${
    active
      ? "bg-brand-600 text-white dark:bg-brand-500"
      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
  }`;

// Pick one of the campus's safe spots and a time. Used for the first proposal, "Suggest another" and
// "Change"; the other person confirms it.
function MeetupForm({ deal, safeSpots, current, onDone, onBack }) {
  const [spotId, setSpotId] = useState(current?.spotId ?? "");
  const [at, setAt] = useState(() => (current && new Date(current.at).getTime() > Date.now() ? toDateTimeLocal(current.at) : ""));
  const [errors, setErrors] = useState({});
  const [proposeMeetup, { isLoading }] = useProposeMeetupMutation();
  // Worked out once, when the form opens: the picker's range and the one-tap times.
  const [range] = useState(() => meetupWindow());
  const quickTimes = useMemo(() => quickMeetupTimes(), []);
  const spotName = useId();
  const other = firstName(deal.otherUser?.name);

  const pickSpot = (id) => {
    setSpotId(id);
    setErrors((found) => ({ ...found, spotId: undefined }));
  };
  const pickTime = (value) => {
    setAt(value);
    setErrors((found) => ({ ...found, at: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const found = validateMeetup({ spotId, at });
    if (Object.keys(found).length > 0) return setErrors(found);

    try {
      await proposeMeetup({ dealId: deal._id, spotId, at: new Date(at).toISOString() }).unwrap();
      toast.success(`Meetup suggested — ${other} can confirm it now`);
      onDone();
    } catch (err) {
      // A wrong spot or time is shown next to it; anything else (blocked, closed, under review) as a toast.
      if (err.data?.errors) setErrors(err.data.errors);
      else toast.error(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
      <fieldset>
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">Where?</legend>
        {safeSpots.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Your campus has no safe spots set up yet. Agree on a busy public place in chat.</p>
        ) : (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {safeSpots.map((spot) => {
              const checked = spotId === spot._id;
              return (
                <label
                  key={spot._id}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 ${
                    checked
                      ? "border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <input type="radio" name={spotName} value={spot._id} checked={checked} onChange={() => pickSpot(spot._id)} className="sr-only" />
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-xl ${
                      checked ? "bg-brand-600 text-white dark:bg-brand-500" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                    }`}
                  >
                    {checked ? <CircleCheck className="size-[18px]" aria-hidden /> : <ShieldCheck className="size-[18px]" aria-hidden />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{spot.name}</span>
                    {spot.description && <span className="block text-xs text-slate-500 dark:text-slate-400">{spot.description}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        {errors.spotId && <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">{errors.spotId}</p>}
      </fieldset>

      <div>
        <Input
          type="datetime-local"
          label="When?"
          icon={CalendarClock}
          value={at}
          min={range.min}
          max={range.max}
          onChange={(event) => pickTime(event.target.value)}
          error={errors.at}
          hint="Any time in the next 30 days. Daylight is best."
        />
        {quickTimes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Quick times">
            {quickTimes.map(({ label, date }) => {
              const value = toDateTimeLocal(date);
              return (
                <button key={label} type="button" onClick={() => pickTime(value)} aria-pressed={at === value} className={chipClasses(at === value)}>
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {onBack && (
          <Button variant="secondary" onClick={onBack} disabled={isLoading}>
            Keep the current plan
          </Button>
        )}
        <Button type="submit" variant="gradient" loading={isLoading}>
          <MapPin className="size-4" /> Suggest this meetup
        </Button>
      </div>
    </form>
  );
}

// Where and when the two of them meet. Whoever proposes, the other confirms (or suggests another);
// a confirmed plan can go in a calendar, and either of them can still change it. `blocked`: they
// can't plan meetups any more (a block), `readOnly`: an admin looking at the deal.
export default function MeetupCard({ deal, myId, safeSpots = [], blocked = false, readOnly = false }) {
  const { meetup } = deal;
  const [editing, setEditing] = useState(false);
  const [confirmMeetup, { isLoading: confirming }] = useConfirmMeetupMutation();
  const other = firstName(deal.otherUser?.name);
  const paused = deal.listing?.hidden;
  const canPlan = !readOnly && !blocked && !paused;
  const showForm = canPlan && (editing || !meetup);

  const now = useNow(meetup ? 30000 : null); // the plan turns into "that time has passed" on its own
  const spot = meetup && safeSpots.find((place) => place._id === meetup.spotId);
  const mine = meetup?.proposedBy === myId;
  const passed = Boolean(meetup) && new Date(meetup.at).getTime() <= now;

  const confirm = async () => {
    try {
      await confirmMeetup({ dealId: deal._id }).unwrap();
      toast.success("Meetup confirmed ✅ See you there!");
    } catch (err) {
      toast.error(err.message);
      if (err.data?.code === "MEETUP_PASSED") setEditing(true);
    }
  };

  const addToCalendar = () => {
    const ics = buildMeetupIcs({
      dealId: deal._id,
      title: deal.title,
      spotName: meetup.spotName,
      at: meetup.at,
      otherName: deal.otherUser?.name ?? "the other student",
      url: `${window.location.origin}/deals/${deal._id}`,
    });
    downloadIcs(ics, `campusswap-meetup-${deal._id.slice(-6)}.ics`);
  };

  // An unconfirmed time that has passed can't be confirmed any more (the server says MEETUP_PASSED).
  let status = null;
  if (meetup?.confirmed) {
    status = passed
      ? { icon: Clock, text: "That time has passed. Already met? The handover below finishes the deal.", tone: "text-slate-600 dark:text-slate-300" }
      : { icon: CircleCheck, text: "Confirmed by both of you", tone: "text-emerald-700 dark:text-emerald-300" };
  } else if (meetup && passed) {
    status = { icon: Clock, text: `${mine ? "Your" : `${other}'s`} suggested time has passed. Suggest a new one.`, tone: "text-amber-700 dark:text-amber-300" };
  } else if (meetup && mine) {
    status = { icon: Clock, text: `Waiting for ${other} to confirm`, tone: "text-slate-600 dark:text-slate-300" };
  } else if (meetup) {
    status = { icon: CalendarClock, text: `${other} suggested this. Does it work for you?`, tone: "text-brand-700 dark:text-brand-300" };
  }
  const StatusIcon = status?.icon;
  const canConfirm = canPlan && meetup && !meetup.confirmed && !mine && !passed;
  const changeLabel = meetup && !meetup.confirmed && passed ? "Suggest a new time" : canConfirm ? "Suggest another" : "Change";

  return (
    <section className={card} aria-labelledby="meetup-title">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <MapPin className="size-5" aria-hidden />
        </span>
        <div>
          <h2 id="meetup-title" className="text-lg font-bold">
            Safe meetup
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {meetup ? "Meet at a busy campus spot, and check the item before you pay." : `Pick a safe spot and a time. ${other} gets to confirm it.`}
          </p>
        </div>
      </div>

      {blocked && !readOnly && (
        <Alert type="warning" className="mt-4">
          You can't plan meetups with {other} any more. You can still finish the handover in person, or cancel the deal.
        </Alert>
      )}
      {paused && !readOnly && (
        <Alert type="warning" className="mt-4">
          Planning is paused while the listing is under review.
        </Alert>
      )}

      {meetup && !showForm && (
        <>
          <div className="mt-5 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
            <p className="flex items-start gap-2 font-bold">
              <MapPin className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <span>
                {meetup.spotName}
                {spot?.description && <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">{spot.description}</span>}
              </span>
            </p>
            <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
              <CalendarDays className="size-4 shrink-0 text-slate-400" aria-hidden />
              <time dateTime={meetup.at}>{formatMeetupTime(meetup.at)}</time>
            </p>
            {status && (
              <p className={`mt-3 flex items-start gap-1.5 text-xs font-semibold ${status.tone}`}>
                <StatusIcon className="mt-px size-3.5 shrink-0" aria-hidden /> {status.text}
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {canConfirm && (
              <Button onClick={confirm} loading={confirming}>
                <CircleCheck className="size-4" /> Confirm
              </Button>
            )}
            {meetup.confirmed && !passed && !readOnly && (
              <Button variant="secondary" onClick={addToCalendar}>
                <CalendarPlus className="size-4" /> Add to calendar
              </Button>
            )}
            {canPlan && (
              <Button variant={canConfirm || passed ? "secondary" : "ghost"} onClick={() => setEditing(true)} disabled={confirming}>
                {changeLabel}
              </Button>
            )}
          </div>
        </>
      )}

      {!meetup && !canPlan && (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">No meetup planned yet.</p>
      )}

      {showForm && (
        <MeetupForm
          deal={deal}
          safeSpots={safeSpots}
          current={editing ? meetup : null}
          onDone={() => setEditing(false)}
          onBack={meetup ? () => setEditing(false) : null}
        />
      )}
    </section>
  );
}
