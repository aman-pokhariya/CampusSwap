import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { toast } from "sonner";
import { LogIn, Mail } from "lucide-react";
import AuthHeader from "../../components/auth/AuthHeader";
import Button from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import PasswordInput from "../../components/ui/PasswordInput";
import Alert from "../../components/ui/Alert";
import { authApi } from "../../api/auth.api";
import { setCurrentUser } from "../../redux/authSlice";
import { looksLikeEmail } from "../../utils/campus";
import { getErrorData, getErrorMessage, getFieldErrors } from "../../utils/errors";
import { announceSession } from "../../utils/sessionSync";

export default function Login() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  // The page a logged-out visitor was heading to (ProtectedRoute). It travels along to sign-up,
  // verification and password reset too, so every way in ends up there.
  const from = location.state?.from;

  const [form, setForm] = useState({ email: location.state?.email ?? "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFormError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const clientErrors = {};
    if (!looksLikeEmail(form.email)) clientErrors.email = "Enter a valid email address";
    if (!form.password) clientErrors.password = "Password is required";
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    try {
      const { user, message } = await authApi.login({ email: form.email.trim(), password: form.password });
      toast.success(message);
      dispatch(setCurrentUser(user)); // PublicOnlyRoute sends the user on to /home (or where they were going)
      announceSession(user._id);
    } catch (error) {
      const data = getErrorData(error);
      if (data.code === "EMAIL_NOT_VERIFIED") {
        toast.info(data.message);
        navigate("/verify-email", { state: { email: data.email, resendIn: data.resendIn, from } });
        return;
      }
      setErrors(getFieldErrors(error));
      setFormError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AuthHeader icon={LogIn} title="Welcome back" subtitle="Log in to see what's new on your campus." />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && <Alert type="error">{formError}</Alert>}

        <Input
          label="College email"
          icon={Mail}
          type="email"
          placeholder="you@college.edu"
          autoComplete="email"
          value={form.email}
          onChange={update("email")}
          error={errors.email}
        />

        <PasswordInput
          label="Password"
          labelAside={
            <Link
              to="/forgot-password"
              state={{ email: form.email, from }}
              className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Forgot password?
            </Link>
          }
          placeholder="Your password"
          autoComplete="current-password"
          value={form.password}
          onChange={update("password")}
          error={errors.password}
        />

        <Button type="submit" variant="gradient" size="lg" loading={submitting} className="w-full">
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
        New to CampusSwap?{" "}
        <Link to="/signup" state={{ from }} className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Create an account
        </Link>
      </p>
    </>
  );
}
