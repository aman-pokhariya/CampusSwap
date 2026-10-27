import { useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import AuthHeader from "../../components/auth/AuthHeader";
import Button from "../../components/ui/Button";
import OtpInput from "../../components/ui/OtpInput";
import PasswordInput from "../../components/ui/PasswordInput";
import PasswordStrength from "../../components/ui/PasswordStrength";
import Alert from "../../components/ui/Alert";
import { authApi } from "../../api/auth.api";
import { setCurrentUser } from "../../redux/authSlice";
import { formatSeconds, useCountdown } from "../../hooks/useCountdown";
import { getErrorData, getErrorMessage, getFieldErrors } from "../../utils/errors";
import { passwordError } from "../../utils/password";
import { announceSession } from "../../utils/sessionSync";

export default function ResetPassword() {
  const location = useLocation();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  const email = location.state?.email || searchParams.get("email") || "";
  const from = location.state?.from; // PublicOnlyRoute goes there once the password is reset

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, restartCountdown] = useCountdown(location.state?.resendIn ?? 60);

  if (!email) return <Navigate to="/forgot-password" replace />;

  const handleSubmit = async (event) => {
    event.preventDefault();

    const clientErrors = {};
    if (!/^\d{6}$/.test(code)) clientErrors.otp = "Enter the 6-digit code from your email";
    const pwError = passwordError(password);
    if (pwError) clientErrors.password = pwError;
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    try {
      const { user, message } = await authApi.resetPassword({ email, otp: code, password });
      toast.success(message);
      dispatch(setCurrentUser(user)); // PublicOnlyRoute now sends the user to /home (or where they were going)
      announceSession(user._id);
    } catch (err) {
      const fieldErrors = getFieldErrors(err);
      setErrors(Object.keys(fieldErrors).length > 0 ? fieldErrors : { form: getErrorMessage(err) });
      if (fieldErrors.otp) setCode("");
    } finally {
      setSubmitting(false);
    }
  };

  // Same answer whether or not the email has an account (see ForgotPassword).
  const resend = async () => {
    setResending(true);
    try {
      const { message, resendIn } = await authApi.resendOtp({ email, purpose: "reset-password" });
      toast.success(message || `If ${email} has an account, a new code is on its way.`);
      restartCountdown(resendIn ?? 60);
      setErrors((current) => ({ ...current, otp: undefined, form: undefined }));
      setCode("");
    } catch (err) {
      const { retryAfter } = getErrorData(err);
      if (retryAfter) restartCountdown(retryAfter);
      toast.error(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <AuthHeader
        icon={LockKeyhole}
        title="Set a new password"
        subtitle={
          <>
            If <span className="font-semibold text-slate-900 [overflow-wrap:anywhere] dark:text-white">{email}</span> has an account, we've
            sent it a 6-digit code. Enter it below.
          </>
        }
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {errors.form && <Alert type="error">{errors.form}</Alert>}

        <div>
          <p className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">Reset code</p>
          <OtpInput
            value={code}
            onChange={(value) => {
              setCode(value);
              setErrors((current) => ({ ...current, otp: undefined, form: undefined }));
            }}
            invalid={Boolean(errors.otp)}
          />
          {errors.otp && <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">{errors.otp}</p>}
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {secondsLeft > 0 ? (
              <span className="tabular-nums">You can request a new code in {formatSeconds(secondsLeft)}</span>
            ) : (
              <button
                type="button"
                onClick={resend}
                disabled={resending}
                className="font-semibold text-brand-600 hover:underline disabled:opacity-60 dark:text-brand-400"
              >
                {resending ? "Sending…" : "Send a new code"}
              </button>
            )}
          </p>
        </div>

        <div>
          <PasswordInput
            label="New password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setErrors((current) => ({ ...current, password: undefined, form: undefined }));
            }}
            error={errors.password}
          />
          <PasswordStrength password={password} />
        </div>

        <Button type="submit" variant="gradient" size="lg" loading={submitting} className="w-full">
          {submitting ? "Updating…" : "Update password & log in"}
        </Button>
      </form>

      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
        For your safety, this logs you out on every other device.
      </p>

      <Link
        to="/login"
        state={{ email, from }}
        className="mt-6 flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft className="size-4" /> Back to log in
      </Link>
    </>
  );
}
