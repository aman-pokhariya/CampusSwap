import { z } from "zod";
import { hostelField, nameField, passwordField } from "./common.validators.js";

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
