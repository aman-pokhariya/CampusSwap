import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Building, Mail, User, UserPlus } from "lucide-react";
import AuthHeader from "../../components/auth/AuthHeader";
import CampusHint from "../../components/auth/CampusHint";
import Button from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Field";
import PasswordInput from "../../components/ui/PasswordInput";
import PasswordStrength from "../../components/ui/PasswordStrength";
import { authApi } from "../../api/auth.api";
import { campusApi } from "../../api/campus.api";
import { findCampusForEmail, looksLikeEmail } from "../../utils/campus";
import { getErrorMessage, getFieldErrors } from "../../utils/errors";
import { passwordError } from "../../utils/password";

const validateForm = ({ name, email, password }) => {
  const errors = {};
  if (name.trim().length < 2) errors.name = "Name must be at least 2 characters";
  if (!looksLikeEmail(email)) errors.email = "Enter a valid email address";
  const pwError = passwordError(password);
  if (pwError) errors.password = pwError;
  return errors;
};

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", hostel: "" });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [campuses, setCampuses] = useState([]);
  const [campusesLoaded, setCampusesLoaded] = useState(false);

  useEffect(() => {
    campusApi
      .list()
      .then(({ campuses }) => setCampuses(campuses))
      .catch(() => setCampuses([]))
      .finally(() => setCampusesLoaded(true));
  }, []);

  const campus = useMemo(() => findCampusForEmail(campuses, form.email), [campuses, form.email]);
  // If the email changes to another campus, a previously picked hostel no longer applies.
  const hostel = campus?.hostels.some((h) => h.name === form.hostel) ? form.hostel : "";

  const update = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const clientErrors = validateForm(form);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setSubmitting(true);
    try {
      const result = await authApi.signup({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        hostel: hostel || undefined,
      });
      toast.success(result.message);
      navigate("/verify-email", { state: { email: result.email, resendIn: result.resendIn } });
    } catch (error) {
      setErrors(getFieldErrors(error));
      toast.error(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AuthHeader
        icon={UserPlus}
        title="Create your account"
        subtitle="Use your college email — it's how we keep CampusSwap students-only."
      />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <Input
          label="Full name"
          icon={User}
          placeholder="Aman Sharma"
          autoComplete="name"
          value={form.name}
          onChange={update("name")}
          error={errors.name}
        />

        <Input
          label="College email"
          icon={Mail}
          type="email"
          placeholder="you@college.edu"
          autoComplete="email"
          value={form.email}
          onChange={update("email")}
          error={errors.email}
          hint={<CampusHint email={form.email} campus={campus} campusesLoaded={campusesLoaded} />}
        />

        {campus && campus.hostels.length > 0 && (
          <Select
            label="Hostel (optional)"
            icon={Building}
            value={hostel}
            onChange={update("hostel")}
            error={errors.hostel}
            hint="Buyers near you see your listings first. You can change this later."
            className="animate-fade-up"
          >
            <option value="">I'll choose later</option>
            {campus.hostels.map((h) => (
              <option key={h.name} value={h.name}>
                {h.name}
              </option>
            ))}
          </Select>
        )}

        <div>
          <PasswordInput
            label="Password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            value={form.password}
            onChange={update("password")}
            error={errors.password}
          />
          <PasswordStrength password={form.password} />
        </div>

        <Button type="submit" variant="gradient" size="lg" loading={submitting} className="w-full">
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Log in
        </Link>
      </p>
    </>
  );
}
