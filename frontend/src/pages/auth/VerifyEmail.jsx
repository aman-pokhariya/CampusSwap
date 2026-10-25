import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { MailCheck, Terminal } from "lucide-react";
import AuthHeader from "../../components/auth/AuthHeader";
import Button from "../../components/ui/Button";
import OtpInput from "../../components/ui/OtpInput";
import Alert from "../../components/ui/Alert";
import { authApi } from "../../api/auth.api";
import { setCurrentUser } from "../../redux/authSlice";
import { formatSeconds, useCountdown } from "../../hooks/useCountdown";
import { getErrorData, getErrorMessage } from "../../utils/errors";

const isComplete = (code) => /^\d{6}$/.test(code);

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();

  const email = location.state?.email || searchParams.get("email") || "";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0); // bumping this re-mounts the boxes: shake + refocus
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, restartCountdown] = useCountdown(location.state?.resendIn ?? 60);

  if (!email) return <Navigate to="/signup" replace />;

  const verify = async (otp) => {
    setVerifying(true);
    setError("");
    try {
      const { user, message } = await authApi.verifyEmail({ email, otp });
      toast.success(message);
      dispatch(setCurrentUser(user)); // PublicOnlyRoute now sends the user to /home
    } catch (err) {
      const data = getErrorData(err);
      if (data.code === "ALREADY_VERIFIED") {
        toast.info(data.message);
        navigate("/login", { replace: true, state: { email } });
        return;
      }
      setError(getErrorMessage(err));
      setCode("");
      setAttempt((n) => n + 1);
    } finally {
      setVerifying(false);
    }
  };

  const handleCodeChange = (value) => {
    setCode(value);
    setError("");
    // Verify as soon as the last digit is typed or a code is pasted.
    if (isComplete(value) && !verifying) verify(value);
  };

  const resend = async () => {
    setResending(true);
    try {
      const { message, resendIn } = await authApi.resendOtp({ email, purpose: "verify-email" });
      toast.success(message);
      restartCountdown(resendIn ?? 60);
      setError("");
      setCode("");
      setAttempt((n) => n + 1);
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
        icon={MailCheck}
        title="Check your inbox"
        subtitle={
          <>
            We sent a 6-digit code to <span className="font-semibold text-slate-900 dark:text-white">{email}</span>
          </>
        }
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (isComplete(code)) verify(code);
        }}
        className="space-y-5"
      >
        <div key={attempt} className={attempt > 0 && error ? "animate-shake" : ""}>
          <OtpInput value={code} onChange={handleCodeChange} disabled={verifying} invalid={Boolean(error)} />
        </div>

        {error && <Alert type="error">{error}</Alert>}

        <Button type="submit" variant="gradient" size="lg" loading={verifying} disabled={!isComplete(code)} className="w-full">
          {verifying ? "Verifying…" : "Verify email"}
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-slate-600 dark:text-slate-400">
          Didn't get it?{" "}
          {secondsLeft > 0 ? (
            <span className="font-medium text-slate-500 tabular-nums">Resend in {formatSeconds(secondsLeft)}</span>
          ) : (
            <button
              type="button"
              onClick={resend}
              disabled={resending}
              className="font-semibold text-brand-600 hover:underline disabled:opacity-60 dark:text-brand-400"
            >
              {resending ? "Sending…" : "Resend code"}
            </button>
          )}
        </span>
        <Link to="/signup" className="font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
          Wrong email?
        </Link>
      </div>

      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">Codes expire after 10 minutes. Check your spam folder too.</p>

      {import.meta.env.DEV && (
        <Alert type="info" className="mt-6">
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <Terminal className="size-3.5" /> Dev mode
          </span>{" "}
          — the code is also printed in your backend terminal.
        </Alert>
      )}
    </>
  );
}
