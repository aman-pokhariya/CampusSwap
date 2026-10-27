import { useState } from "react";
import { toast } from "sonner";
import { Ban, CircleUserRound, Flag, LockOpen } from "lucide-react";
import Menu from "../ui/Menu";
import ReportDialog from "./ReportDialog";
import BlockDialog from "./BlockDialog";
import { useUnblockUserMutation } from "../../api/trust.api";
import { firstName } from "../../utils/deals";

// The ⋮ menu about another student (their profile, a chat's header): Report user, and Block or
// Unblock. `blockedByMe` is my own block only: when they blocked me, I can still block them too.
export default function UserActionsMenu({ user, blockedByMe = false, showProfileLink = false, className = "" }) {
  const [dialog, setDialog] = useState(null); // "report" | "block"
  const [unblockUser] = useUnblockUserMutation();
  const name = firstName(user.name);

  const unblock = async () => {
    try {
      await unblockUser(user._id).unwrap();
      toast.success(`${name} is unblocked`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const items = [
    showProfileLink && { label: "View profile", icon: CircleUserRound, to: `/u/${user._id}` },
    { label: "Report user", icon: Flag, onSelect: () => setDialog("report") },
    blockedByMe
      ? { label: `Unblock ${name}`, icon: LockOpen, onSelect: unblock }
      : { label: `Block ${name}`, icon: Ban, tone: "danger", onSelect: () => setDialog("block") },
  ].filter(Boolean);

  return (
    <>
      <Menu label={`More options for ${user.name}`} items={items} className={className} />
      <ReportDialog open={dialog === "report"} onClose={() => setDialog(null)} target={{ type: "user", id: user._id, name: user.name }} />
      <BlockDialog open={dialog === "block"} user={user} onClose={() => setDialog(null)} />
    </>
  );
}
