import { z } from "zod";
import { emailField, hostelField, nameField, otpField, passwordField } from "./common.validators.js";
import { OTP_PURPOSE } from "../config/constants.js";

export const signupSchema = z.object({
    name: nameField,
    email: emailField,
    password: passwordField,
    hostel: hostelField.optional()
});

export const verifyEmailSchema = z.object({
    email: emailField,
    otp: otpField
});

export const resendOtpSchema = z.object({
    email: emailField,
    purpose: z.enum(Object.values(OTP_PURPOSE)).default(OTP_PURPOSE.VERIFY_EMAIL)
});

// Login doesn't re-check password strength: older accounts may predate the rules.
export const loginSchema = z.object({
    email: emailField,
    password: z.string({ error: "Password is required" }).min(1, "Password is required")
});

export const forgotPasswordSchema = z.object({
    email: emailField
});

export const resetPasswordSchema = z.object({
    email: emailField,
    otp: otpField,
    password: passwordField
});
