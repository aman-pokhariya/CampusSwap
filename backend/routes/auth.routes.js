import express from "express";
import {
    signup,
    verifyEmail,
    resendOtp,
    login,
    logout,
    getMe,
    getSocketToken,
    forgotPassword,
    resetPassword
} from "../controllers/auth.controllers.js";
import { blockDemo, isAuthenticated } from "../middlewares/auth.middleware.js";
import {
    credentialLimiter,
    emailLimiter,
    loginEmailLimiter,
    mailIpLimiter,
    socketTokenLimiter
} from "../middlewares/rateLimit.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
    signupSchema,
    verifyEmailSchema,
    resendOtpSchema,
    loginSchema,
    forgotPasswordSchema,
    resetPasswordSchema
} from "../validators/auth.validators.js";

const authRoutes = express.Router();

// Order on each route: rate limit → validate body → controller. The three routes that send email share
// mailIpLimiter (one daily allowance per network) on top of emailLimiter (per address).
authRoutes.post("/signup", mailIpLimiter, emailLimiter, validate(signupSchema), signup);
authRoutes.post("/verify-email", credentialLimiter, loginEmailLimiter, validate(verifyEmailSchema), verifyEmail);
authRoutes.post("/resend-otp", mailIpLimiter, emailLimiter, validate(resendOtpSchema), resendOtp);

authRoutes.post("/login", credentialLimiter, loginEmailLimiter, validate(loginSchema), login);
authRoutes.post("/logout", logout);
authRoutes.get("/me", isAuthenticated, getMe);
authRoutes.get("/socket-token", isAuthenticated, socketTokenLimiter, getSocketToken);

authRoutes.post("/forgot-password", mailIpLimiter, emailLimiter, validate(forgotPasswordSchema), blockDemo(), forgotPassword);
authRoutes.post("/reset-password", credentialLimiter, loginEmailLimiter, validate(resetPasswordSchema), blockDemo(), resetPassword);

export default authRoutes;
