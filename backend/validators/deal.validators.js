import { z } from "zod";
import { beforeField, limitField, otpField } from "./common.validators.js";
import { CANCEL_REASONS, MAX_REVIEW_LENGTH, MEETUP_MAX_DAYS } from "../config/constants.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const dealsQuerySchema = z.object({
    status: z.enum(["active", "completed", "cancelled", "all"], { error: "Status must be active, completed, cancelled or all" }).default("all"),
    // Next page: the updatedAt of the last deal already loaded.
    before: beforeField,
    limit: limitField(50, 100)
});

// Whether the spot belongs to the deal's campus is checked in the controller.
export const meetupSchema = z.object({
    spotId: z.string({ error: "Pick a safe spot" }).regex(/^[a-f\d]{24}$/i, "Pick a safe spot"),
    at: z.coerce
        .date({ error: "Pick a date and time" })
        .refine((at) => at.getTime() > Date.now(), "Pick a time in the future")
        .refine((at) => at.getTime() <= Date.now() + MEETUP_MAX_DAYS * DAY_MS, `Pick a time in the next ${MEETUP_MAX_DAYS} days`)
});

// A QR scan sends the token from "campusswap:handover:<dealId>:<token>"; typing sends the 6-digit code.
export const completeSchema = z
    .object({
        token: z.string().trim().regex(/^[\w-]{32}$/, "That QR code isn't a CampusSwap handover code").optional(),
        code: otpField.optional()
    })
    .refine((data) => Boolean(data.token) !== Boolean(data.code), { error: "Scan the QR code or enter the 6-digit code" });

export const cancelSchema = z.object({
    reason: z.enum(CANCEL_REASONS, { error: "Pick a reason" }),
    note: z.string().trim().max(300, "Keep the note under 300 characters").default("")
});

export const reviewSchema = z.object({
    rating: z
        .number({ error: "Pick a star rating" })
        .int("Pick a star rating")
        .min(1, "Pick 1 to 5 stars")
        .max(5, "Pick 1 to 5 stars"),
    comment: z.string().trim().max(MAX_REVIEW_LENGTH, `Keep it under ${MAX_REVIEW_LENGTH} characters`).default("")
});
