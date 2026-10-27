import { z } from "zod";

// What each listing type allows (₹0 for free, a note for swaps, …) is checked in utils/offers.js,
// which knows the listing. These only check the shape.

const amountField = z
    .number({ error: "Enter an amount" })
    .int("Use whole rupees")
    .min(0, "The amount can't be negative")
    .max(1_000_000, "That's too much for CampusSwap");

const periodsField = z
    .number({ error: "Enter how many periods" })
    .int("Use a whole number")
    .min(1, "At least 1")
    .max(52, "Up to 52");

const noteField = z.string().trim().max(300, "Keep the note under 300 characters");

export const offerSchema = z.object({
    amount: amountField.optional(),
    periods: periodsField.optional(),
    note: noteField.default("")
});

export const respondOfferSchema = z.object({
    action: z.enum(["accept", "counter", "decline", "withdraw"], { error: "Choose accept, counter, decline or withdraw" }),
    // Counter only (anything else is ignored).
    amount: amountField.optional(),
    periods: periodsField.optional(),
    note: noteField.optional()
});
