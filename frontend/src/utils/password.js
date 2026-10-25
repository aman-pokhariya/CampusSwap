// The first three rules match the server (validators/common.validators.js); the last one is a bonus.
export const getPasswordStrength = (password) => {
  const checks = [
    { label: "8+ characters", ok: password.length >= 8, required: true },
    { label: "A letter", ok: /[A-Za-z]/.test(password), required: true },
    { label: "A number", ok: /\d/.test(password), required: true },
    { label: "A symbol or 12+ characters", ok: /[^A-Za-z0-9]/.test(password) || password.length >= 12, required: false },
  ];

  const score = checks.filter((check) => check.ok).length;
  const meetsRules = checks.every((check) => check.ok || !check.required);

  return {
    checks,
    score,
    meetsRules,
    label: ["Too weak", "Weak", "Fair", "Good", "Strong"][score],
  };
};

export const passwordError = (password) => {
  if (!password) return "Password is required";
  const failed = getPasswordStrength(password).checks.find((check) => check.required && !check.ok);
  return failed ? `Password needs: ${failed.label.toLowerCase()}` : undefined;
};
