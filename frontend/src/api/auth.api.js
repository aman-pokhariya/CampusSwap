import api, { unwrap } from "./axios";

export const authApi = {
  signup: (body) => unwrap(api.post("/auth/signup", body)),
  verifyEmail: (body) => unwrap(api.post("/auth/verify-email", body)),
  resendOtp: (body) => unwrap(api.post("/auth/resend-otp", body)),
  login: (body) => unwrap(api.post("/auth/login", body)),
  logout: () => unwrap(api.post("/auth/logout")),
  me: () => unwrap(api.get("/auth/me")),
  forgotPassword: (body) => unwrap(api.post("/auth/forgot-password", body)),
  resetPassword: (body) => unwrap(api.post("/auth/reset-password", body)),
};
