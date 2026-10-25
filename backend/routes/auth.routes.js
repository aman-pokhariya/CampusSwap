import express from "express";
import {
    signup,
    verifyEmail,
    resendOtp,
    login,
    logout,
    getMe,
    forgotPassword,
    resetPassword
} from "../controllers/auth.controllers.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";
import { credentialLimiter, emailLimiter } from "../middlewares/rateLimit.middleware.js";
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

// Order on each route: rate limit → validate body → controller
authRoutes.post("/signup", emailLimiter, validate(signupSchema), signup);
authRoutes.post("/verify-email", credentialLimiter, validate(verifyEmailSchema), verifyEmail);
authRoutes.post("/resend-otp", emailLimiter, validate(resendOtpSchema), resendOtp);

authRoutes.post("/login", credentialLimiter, validate(loginSchema), login);
authRoutes.post("/logout", logout);
authRoutes.get("/me", isAuthenticated, getMe);

authRoutes.post("/forgot-password", emailLimiter, validate(forgotPasswordSchema), forgotPassword);
authRoutes.post("/reset-password", credentialLimiter, validate(resetPasswordSchema), resetPassword);

export default authRoutes;
