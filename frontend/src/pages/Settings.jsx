import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import { BadgeCheck, Ban, Building, Camera, FlaskConical, KeyRound, LoaderCircle, Mail, RefreshCw, School, ShieldCheck, User, UserRound } from "lucide-react";
import Alert from "../components/ui/Alert";
import Avatar from "../components/ui/Avatar";
import Button from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Field";
import PasswordInput from "../components/ui/PasswordInput";
import PasswordStrength from "../components/ui/PasswordStrength";
import Skeleton from "../components/ui/Skeleton";
import { userApi } from "../api/user.api";
import { baseApi } from "../api/baseApi";
import { useGetBlocksQuery, useUnblockUserMutation } from "../api/trust.api";
import { setCurrentUser } from "../redux/authSlice";
import { compressImage } from "../utils/image";
import { getErrorMessage, getFieldErrors } from "../utils/errors";
import { timeAgo } from "../utils/format";
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

function AvatarUploader({ user, name }) {
  const dispatch = useDispatch();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const hasPhoto = Boolean(user.avatar?.url);

  // Seller photos also appear on listing cards and pages, so those caches are refreshed too.
  const applyUser = (updated, message) => {
    dispatch(setCurrentUser(updated));
    dispatch(baseApi.util.invalidateTags(["Profile", "Feed", "Listing"]));
    toast.success(message);
  };

  const showError = (error) =>
    toast.error(error.response || error.request ? getErrorMessage(error) : error.message);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const compressed = await compressImage(file, { maxSize: 600, quality: 0.85 });
      const formData = new FormData();
      formData.append("avatar", compressed, compressed.name);
      const { user: updated, message } = await userApi.updateAvatar(formData);
      applyUser(updated, message);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const { user: updated, message } = await userApi.removeAvatar();
      applyUser(updated, message);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        aria-label="Change profile photo"
        className="group relative shrink-0 rounded-full"
      >
        <Avatar name={name} src={user.avatar?.url} size="xl" />
        <span
          className={`absolute inset-0 grid place-items-center rounded-full bg-slate-950/50 text-white transition ${
            busy ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {busy ? <LoaderCircle className="size-6 animate-spin" /> : <Camera className="size-6" />}
        </span>
      </button>
      <div className="min-w-0">
        <p className="truncate text-lg font-bold">{name}</p>
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
          <BadgeCheck className="size-4" /> Verified student
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Camera className="size-4" /> {hasPhoto ? "Change photo" : "Add photo"}
          </Button>
          {hasPhoto && (
            <Button size="sm" variant="ghost" onClick={remove} disabled={busy}>
              Remove
            </Button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          upload(event.target.files[0]);
          event.target.value = "";
        }}
      />
    </div>
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
      // A new hostel changes every distance in the feed; a new name shows on listings and profiles.
      dispatch(baseApi.util.invalidateTags(["Feed", "Listing", "Saved", "Profile"]));
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
      <AvatarUploader user={user} name={form.name || user.name} />

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

// One blocked person, with the way to undo it.
function BlockedUserRow({ block }) {
  const [unblockUser, { isLoading }] = useUnblockUserMutation();
  const { user } = block;
  const firstName = user.name.split(" ")[0];

  const unblock = async () => {
    try {
      await unblockUser(user._id).unwrap();
      toast.success(`${firstName} is unblocked`);
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <Link
        to={`/u/${user._id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        <Avatar name={user.name} src={user.avatar?.url} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{user.name}</span>
          <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
            {user.hostel || "On campus"} · blocked {timeAgo(block.blockedAt)}
          </span>
        </span>
      </Link>
      <Button size="sm" variant="secondary" onClick={unblock} loading={isLoading} aria-label={`Unblock ${user.name}`}>
        Unblock
      </Button>
    </li>
  );
}

// People I blocked: they can't message me or make offers, and neither of us sees the other's listings.
// Unblocking doesn't bring back offers that the block cancelled.
function BlockedUsers() {
  const { data, isLoading, isError, refetch, isFetching } = useGetBlocksQuery();
  const blocks = data?.blocks ?? [];

  let content;
  if (isLoading) {
    content = (
      <div className="space-y-3" aria-hidden>
        {[1, 2].map((n) => (
          <div key={n} className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    );
  } else if (isError && !data) {
    content = (
      <p className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
        Couldn't load the list ·
        <button
          type="button"
          onClick={refetch}
          disabled={isFetching}
          className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline disabled:opacity-60 dark:text-brand-400"
        >
          <RefreshCw className="size-3.5" aria-hidden /> Try again
        </button>
      </p>
    );
  } else if (blocks.length === 0) {
    content = (
      <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/60">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <div>
          <p className="text-sm font-semibold">You haven't blocked anyone</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">If someone bothers you, block them from the ⋮ menu on their profile or in your chat.</p>
        </div>
      </div>
    );
  } else {
    content = (
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {blocks.map((block) => (
          <BlockedUserRow key={block.user._id} block={block} />
        ))}
      </ul>
    );
  }

  return (
    <SettingsCard icon={Ban} title="Blocked users" description="They can't message you or make offers, and you don't see each other's listings.">
      {content}
    </SettingsCard>
  );
}

export default function Settings() {
  const user = useSelector((state) => state.auth.user);

  return (
    <div className="mx-auto max-w-3xl animate-fade-up space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">Manage your profile, account security and who can reach you.</p>
      </header>
      {/* Shared demo logins (backend blockDemo): say so before anyone tries, not only in an error toast. */}
      {user.isDemo && (
        <Alert type="info" title="You're using a shared demo account">
          <span className="inline-flex items-center gap-1.5">
            <FlaskConical className="size-3.5 shrink-0" aria-hidden /> Look around freely: the name, bio, photo and password stay as they are for the next visitor.
          </span>
        </Alert>
      )}
      <ProfileForm user={user} />
      <PasswordForm />
      <BlockedUsers />
    </div>
  );
}
