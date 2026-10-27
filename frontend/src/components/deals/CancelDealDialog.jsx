import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CircleX } from "lucide-react";
import ConfirmDialog from "../ui/ConfirmDialog";
import { Select, Textarea } from "../ui/Field";
import { useCancelDealMutation } from "../../api/deals.api";
import { CANCEL_REASONS, MAX_CANCEL_NOTE_LENGTH } from "../../constants/deals";
import { firstName } from "../../utils/deals";

// "Cancel this deal?" with a reason (required) and an optional note for the other person. Between
// blocked people the server drops the note, so the box isn't offered then (`blocked`).
export default function CancelDealDialog({ open, deal, blocked = false, onClose }) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [cancelDeal, { isLoading }] = useCancelDealMutation();
  const other = firstName(deal.otherUser?.name);

  // Every time it opens, it starts empty.
  useEffect(() => {
    if (!open) return;
    setReason("");
    setNote("");
    setError(null);
  }, [open]);

  const confirm = async () => {
    if (!reason) return setError("Pick a reason");
    try {
      await cancelDeal({ dealId: deal._id, reason, note: blocked ? "" : note.trim() }).unwrap();
      onClose();
      toast.success("Deal cancelled");
    } catch (err) {
      if (err.data?.errors) {
        setError(Object.values(err.data.errors)[0]);
      } else {
        // Nothing to fix here (it closed meanwhile, say): close first, because toasts are drawn
        // underneath an open dialog.
        onClose();
        toast.error(err.message);
      }
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title="Cancel this deal?"
      description={`${other} is told, and the listing goes back on CampusSwap. This can't be undone.`}
      confirmLabel="Cancel deal"
      cancelLabel="Keep the deal"
      icon={CircleX}
      loading={isLoading}
      confirmDisabled={!reason}
      onConfirm={confirm}
      onClose={onClose}
    >
      <Select
        label="Why are you cancelling?"
        value={reason}
        onChange={(event) => {
          setReason(event.target.value);
          setError(null);
        }}
        error={error}
        disabled={isLoading}
      >
        <option value="" disabled>
          Pick a reason
        </option>
        {CANCEL_REASONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      {!blocked && (
        <Textarea
          label={`Note for ${other} (optional)`}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={MAX_CANCEL_NOTE_LENGTH}
          rows={2}
          placeholder="e.g. Sorry! I'm going home this weekend, so I can't meet."
          disabled={isLoading}
        />
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Cancelling after a meetup was confirmed lowers your trust score a little, unless the other person didn't show up.
      </p>
    </ConfirmDialog>
  );
}
