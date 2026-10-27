import { toast } from "sonner";
import { Ban } from "lucide-react";
import ConfirmDialog from "../ui/ConfirmDialog";
import { useBlockUserMutation } from "../../api/trust.api";
import { firstName } from "../../utils/deals";

// "Block Riya?", saying exactly what a block does (backend controllers/block.controllers.js), so
// nothing about it is a surprise afterwards.
export default function BlockDialog({ open, user, onClose }) {
  const [blockUser, { isLoading }] = useBlockUserMutation();
  const name = firstName(user.name);

  const confirm = async () => {
    try {
      const { message } = await blockUser(user._id).unwrap();
      toast.success(message);
    } catch (err) {
      toast.error(err.message);
    } finally {
      onClose(); // either way: toasts are drawn underneath an open dialog
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title={`Block ${name}?`}
      description={`You won't be able to message each other, make offers or plan meetups, and you won't see each other's listings. Pending offers between you are cancelled. An open deal can still be cancelled, or finished in person with the handover code. ${name} won't be told, and you can unblock them in Settings.`}
      confirmLabel="Block"
      icon={Ban}
      loading={isLoading}
      onConfirm={confirm}
      onClose={onClose}
    />
  );
}
