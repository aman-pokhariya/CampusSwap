import { z } from "zod";
import { beforeField, limitField } from "./common.validators.js";

export const notificationsQuerySchema = z.object({
    before: beforeField,
    limit: limitField(20, 50)
});
