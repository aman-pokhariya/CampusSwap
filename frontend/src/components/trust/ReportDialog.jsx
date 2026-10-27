import { useId, useState } from "react";
import { CircleCheck, Flag, Info } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Alert from "../ui/Alert";
import { Textarea } from "../ui/Field";
import { useCreateReportMutation } from "../../api/trust.api";
import { MAX_REPORT_DETAILS, REPORT_REASONS } from "../../constants/trust";
import { firstName } from "../../utils/deals";

// The words for each kind of report. `target.name` is the listing title or the person's name.
const copyFor = ({ type, name }) => {
  if (type === "listing") {
    return { title: "Report this listing", subtitle: name, placeholder: "e.g. The photos are from the internet, and they asked me to pay online first" };
  }
  if (type === "message") {
    return { title: "Report this message", subtitle: name ? `From ${name}` : null, placeholder: "e.g. They keep messaging me after I said no" };
  }
  return { title: `Report ${name ?? "this student"}`, subtitle: null, placeholder: "e.g. They asked for my UPI PIN to “send” money" };
};

// Report a listing, a person or a chat message to the campus moderators.
// `target`: { type: "listing" | "user" | "message", id, name?, preview? } (preview: the message's text).
export default function ReportDialog({ open, onClose, target }) {
  // The request lives here, so the dialog can't be dismissed (Esc, backdrop) while it runs.
  const [createReport, { isLoading }] = useCreateReportMutation();

  return (
    <Modal open={open} onClose={onClose} labelledBy="report-dialog-title" dismissible={!isLoading}>
      {target && <ReportForm target={target} onClose={onClose} createReport={createReport} submitting={isLoading} />}
    </Modal>
  );
}

function ReportForm({ target, onClose, createReport, submitting }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [done, setDone] = useState(null); // "sent" | "already"
  const reasonName = useId();
  const copy = copyFor(target);
  const person = target.type === "listing" ? null : firstName(target.name);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!reason) return setErrors({ reason: "Pick a reason" });
    setFormError(null);

    try {
      await createReport({ targetType: target.type, targetId: target.id, reason, details: details.trim() }).unwrap();
      setDone("sent");
    } catch (err) {
      if (err.data?.code === "ALREADY_REPORTED") setDone("already");
      else if (err.data?.errors) setErrors(err.data.errors);
      else setFormError(err.message);
    }
  };

  if (done) {
    const sent = done === "sent";
    const Icon = sent ? CircleCheck : Info;
    return (
      <div className="p-6 text-center" role="status">
        <span
          className={`mx-auto grid size-14 place-items-center rounded-2xl ${
            sent ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
          }`}
        >
          <Icon className="size-7" aria-hidden />
        </span>
        <h2 id="report-dialog-title" className="mt-4 text-lg font-bold">
          {sent ? "Thanks — we'll take a look." : "You already reported this"}
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm text-slate-600 dark:text-slate-400">
          {sent
            ? `A moderator on your campus will check it. Reports are anonymous${person ? `: ${person} won't know it was you` : ""}.`
            : "We'll take a look. There's no need to report it again."}
        </p>
        {person && (
          <p className="mx-auto mt-3 max-w-xs text-xs text-slate-500 dark:text-slate-400">
            If {person} makes you uncomfortable, you can also block them from the ⋮ menu.
          </p>
        )}
        <Button onClick={onClose} className="mt-6 w-full sm:w-auto">
          Done
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
          <Flag className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="report-dialog-title" className="text-lg font-bold">
            {copy.title}
          </h2>
          {copy.subtitle && <p className="truncate text-sm text-slate-500 dark:text-slate-400">{copy.subtitle}</p>}
        </div>
      </div>

      {target.preview && (
        <p className="mt-4 line-clamp-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 [overflow-wrap:anywhere] dark:bg-slate-800/70 dark:text-slate-200">
          “{target.preview}”
        </p>
      )}

      <fieldset className="mt-5">
        <legend className="text-sm font-medium text-slate-700 dark:text-slate-300">What's wrong?</legend>
        <div className="mt-2 space-y-2">
          {REPORT_REASONS.map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 ${
                reason === option.value
                  ? "border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10"
                  : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
              }`}
            >
              <input
                type="radio"
                name={reasonName}
                value={option.value}
                checked={reason === option.value}
                onChange={() => {
                  setReason(option.value);
                  setErrors((current) => ({ ...current, reason: undefined }));
                }}
                className="mt-0.5 size-4 shrink-0 accent-brand-600"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{option.label}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.reason && <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">{errors.reason}</p>}
      </fieldset>

      <Textarea
        label="Details (optional)"
        className="mt-5"
        value={details}
        onChange={(event) => setDetails(event.target.value)}
        maxLength={MAX_REPORT_DETAILS}
        rows={3}
        placeholder={copy.placeholder}
        error={errors.details}
      />

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Reports are anonymous. In an emergency, go to campus security first.</p>

      {formError && (
        <Alert type="error" className="mt-4">
          {formError}
        </Alert>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          Send report
        </Button>
      </div>
    </form>
  );
}
