import { z } from "zod";
import { beforeField, hostelField, limitField, nameField, passwordField } from "./common.validators.js";

export const updateProfileSchema = z
    .object({
        name: nameField.optional(),
        bio: z.string().trim().max(200, "Bio must be 200 characters or less").optional(),
        hostel: hostelField.optional()
    })
    .refine((data) => Object.keys(data).length > 0, { error: "Nothing to update" });

export const changePasswordSchema = z.object({
    currentPassword: z.string({ error: "Enter your current password" }).min(1, "Enter your current password"),
    newPassword: passwordField
});

export const reviewsQuerySchema = z.object({
    // Next page: the createdAt of the last review already loaded.
    before: beforeField,
    limit: limitField(10, 50)
});

export const blocksQuerySchema = z.object({
    limit: limitField(100, 200)
});
