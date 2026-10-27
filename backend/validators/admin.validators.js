import { z } from "zod";
import { beforeField, limitField } from "./common.validators.js";
import { ADMIN_LISTING_ACTIONS, ADMIN_REPORT_ACTIONS, MODERATION_STATE, REPORT_STATUS } from "../config/constants.js";

// ?campus=<id> for one campus, ?campus=all for every campus (global admins only). Left out: the admin's
// own campus. Whether the admin may see it is checked in the controller (adminCampusFilter).
const campusField = z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^(all|[a-f\d]{24})$/, "Pick a campus")
    .optional();

export const overviewQuerySchema = z.object({
    campus: campusField
});

export const reportsQuerySchema = z.object({
    campus: campusField,
    status: z.enum(Object.values(REPORT_STATUS), { error: "Status must be open, resolved or dismissed" }).default(REPORT_STATUS.OPEN),
    // Next page: the createdAt of the last report already loaded.
    before: beforeField,
    limit: limitField(20, 50)
});

export const resolveReportSchema = z.object({
    action: z.enum(ADMIN_REPORT_ACTIONS, { error: "Pick what to do about this report" }),
    // Kept with the decision for other admins; the people involved never see it.
    note: z.string().trim().max(500, "Keep the note under 500 characters").default("")
});

export const moderationQuerySchema = z.object({
    campus: campusField,
    moderation: z
        .enum([MODERATION_STATE.FLAGGED, MODERATION_STATE.REMOVED], { error: "Moderation must be flagged or removed" })
        .default(MODERATION_STATE.FLAGGED),
    // Next page: the createdAt of the last listing already loaded.
    before: beforeField,
    limit: limitField(20, 50)
});

export const moderateListingSchema = z.object({
    action: z.enum(ADMIN_LISTING_ACTIONS, { error: "Pick approve or remove" })
});

export const usersQuerySchema = z.object({
    campus: campusField,
    q: z.string().trim().max(80, "Keep the search under 80 characters").optional(),
    banned: z
        .enum(["true", "false"], { error: "banned must be true or false" })
        .transform((value) => value === "true")
        .optional(),
    // Next page: the createdAt of the last user already loaded.
    before: beforeField,
    limit: limitField(20, 50)
});

export const updateUserSchema = z.object({
    banned: z.boolean({ error: "Say whether the account is suspended (true or false)" })
});
