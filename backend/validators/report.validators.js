import { z } from "zod";
import { objectIdField } from "./common.validators.js";
import { REPORT_REASONS, REPORT_TARGETS } from "../config/constants.js";

// Whether the reporter may see the target at all is checked in the controller.
export const reportSchema = z.object({
    targetType: z.enum(REPORT_TARGETS, { error: "Choose what you're reporting" }),
    targetId: objectIdField,
    reason: z.enum(REPORT_REASONS, { error: "Pick a reason" }),
    details: z.string().trim().max(1000, "Keep it under 1000 characters").default("")
});
