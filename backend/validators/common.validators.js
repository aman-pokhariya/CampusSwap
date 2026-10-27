import { z } from "zod";

// Field rules shared by several forms. The frontend shows these exact messages under each field.

export const nameField = z
    .string({ error: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be 50 characters or less")
    .regex(/^\P{Cc}*$/u, "Name can't contain line breaks");

export const emailField = z
    .string({ error: "Email is required" })
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address"));

// bcrypt only reads the first 72 bytes of a password, hence the max.
export const passwordField = z
    .string({ error: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be 72 characters or less")
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/\d/, "Password must include a number");

export const otpField = z
    .string({ error: "Enter the 6-digit code" })
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code");

export const hostelField = z.string().trim().max(80, "Hostel name is too long");

export const objectIdField = z.string({ error: "Invalid id" }).regex(/^[a-f\d]{24}$/i, "Invalid id");

// Cursor for newest-first lists: ?before=<ISO date of the oldest item already loaded>.
export const beforeField = z.coerce.date({ error: "Invalid date" }).optional();

export const limitField = (fallback, max) => z.coerce.number().int().min(1).max(max).default(fallback);
