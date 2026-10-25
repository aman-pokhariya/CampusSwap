import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import AuthHeader from "../../components/auth/AuthHeader";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { authApi } from "../../api/auth.api";
import { looksLikeEmail } from "../../utils/campus";
import { getErrorMessage, getFieldErrors } from "../../utils/errors";

export default function ForgotPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState(location.state?.email ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!looksLikeEmail(email)) {
      setError("Enter a valid email address");
      return;
    }

    setSubmitting(true);
    try {
      const result = await authApi.forgotPassword({ email: email.trim() });
      toast.success(result.message);
      navigate("/reset-password", { state: { email: result.email, resendIn: result.resendIn } });
    } catch (err) {
      const fieldError = getFieldErrors(err).email;
      if (fieldError) setError(fieldError);
      else toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AuthHeader
        icon={KeyRound}
        title="Forgot your password?"
        subtitle="Enter your college email and we'll send you a code to reset it."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Input
          label="College email"
          icon={Mail}
          type="email"
          placeholder="you@college.edu"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError("");
          }}
          error={error}
        />
        <Button type="submit" variant="gradient" size="lg" loading={submitting} className="w-full">
          {submitting ? "Sending code…" : "Send reset code"}
        </Button>
      </form>

      <Link
        to="/login"
        className="mt-8 flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft className="size-4" /> Back to log in
      </Link>
    </>
  );
}
