import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { BadgeCheck, Building, KeyRound, Mail, School, User, UserRound } from "lucide-react";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Field";
import PasswordInput from "../components/ui/PasswordInput";
import PasswordStrength from "../components/ui/PasswordStrength";
import { userApi } from "../api/user.api";
import { setCurrentUser } from "../redux/authSlice";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { passwordError } from "../utils/password";

function SettingsCard({ icon: Icon, title, description, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-6 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <Icon className="size-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ProfileForm({ user }) {
  const dispatch = useDispatch();
  const [form, setForm] = useState({ name: user.name, bio: user.bio ?? "", hostel: user.hostel ?? "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Only send fields that actually changed.
  const changes = Object.fromEntries(
    Object.entries(form).filter(([field, value]) => value.trim() !== (user[field] ?? "")),
  );
  const isDirty = Object.keys(changes).length > 0;

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.name.trim().length < 2) {
      setErrors({ name: "Name must be at least 2 characters" });
      return;
    }

    setSaving(true);
    try {
      const { user: updated, message } = await userApi.updateProfile(changes);
      dispatch(setCurrentUser(updated));
      setForm({ name: updated.name, bio: updated.bio ?? "", hostel: updated.hostel ?? "" });
      toast.success(message);
    } catch (error) {
      setErrors(getFieldErrors(error));
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard icon={UserRound} title="Profile" description="This is what other students see on your listings.">
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={form.name || user.name} src={user.avatar?.url} size="xl" />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{form.name || user.name}</p>
          <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <BadgeCheck className="size-4" /> Verified student
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Input label="Full name" icon={User} value={form.name} onChange={update("name")} error={errors.name} />
        <Select label="Hostel" icon={Building} value={form.hostel} onChange={update("hostel")} error={errors.hostel}>
          <option value="">Not set / day scholar</option>
          {user.campus.hostels.map((hostel) => (
            <option key={hostel.name} value={hostel.name}>
              {hostel.name}
            </option>
          ))}
        </Select>
        <Input label="College email" icon={Mail} value={user.email} disabled hint="Your email can't be changed." />
        <Input label="Campus" icon={School} value={user.campus.name} disabled />
        <Textarea
          label="Bio"
          className="sm:col-span-2"
          placeholder="e.g. CSE 2nd year · selling my first-year books"
          maxLength={200}
          value={form.bio}
          onChange={update("bio")}
          error={errors.bio}
        />
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" loading={saving} disabled={!isDirty}>
            Save changes
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

function PasswordForm() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const clientErrors = {};
    if (!form.currentPassword) clientErrors.currentPassword = "Enter your current password";
    const pwError = passwordError(form.newPassword);
    if (pwError) clientErrors.newPassword = pwError;
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSaving(true);
    try {
      const { message } = await userApi.changePassword(form);
      toast.success(message);
      setForm({ currentPassword: "", newPassword: "" });
    } catch (error) {
      setErrors(getFieldErrors(error));
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsCard icon={KeyRound} title="Password" description="Changing it logs you out on every other device.">
      <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <PasswordInput
          label="Current password"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={update("currentPassword")}
          error={errors.currentPassword}
        />
        <div>
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            value={form.newPassword}
            onChange={update("newPassword")}
            error={errors.newPassword}
          />
          <PasswordStrength password={form.newPassword} />
        </div>
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" variant="secondary" loading={saving}>
            Change password
          </Button>
        </div>
      </form>
    </SettingsCard>
  );
}

export default function Settings() {
  const user = useSelector((state) => state.auth.user);

  return (
    <div className="mx-auto max-w-3xl animate-fade-up space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Manage your profile and account security.</p>
      </header>
      <ProfileForm user={user} />
      <PasswordForm />
    </div>
  );
}
