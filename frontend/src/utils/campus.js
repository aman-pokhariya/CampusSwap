// Same rule as Campus.findByEmail on the server, so the signup form can name your campus
// while you type. The server still makes the final decision.
export const findCampusForEmail = (campuses, email) => {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain || !domain.includes(".")) return null;

  const parts = domain.split(".");
  const candidates = parts.slice(0, -1).map((_, i) => parts.slice(i).join("."));

  return campuses.find((campus) => campus.emailDomains.some((d) => candidates.includes(d))) ?? null;
};

export const looksLikeEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
