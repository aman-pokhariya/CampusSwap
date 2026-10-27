import { z } from "zod";
import { beforeField, limitField, objectIdField } from "./common.validators.js";
import { MAX_MESSAGE_LENGTH } from "../config/constants.js";

export const startConversationSchema = z.object({
    listingId: objectIdField
});

export const conversationsQuerySchema = z.object({
    before: beforeField,
    limit: limitField(30, 50),
    // The owner's "chats about this listing".
    listing: objectIdField.optional()
});

export const messagesQuerySchema = z.object({
    before: beforeField,
    limit: limitField(30, 100)
});

// Text is optional only when a photo is attached (checked in the controller, which sees the file).
export const messageSchema = z.object({
    text: z
        .string({ error: "Write a message" })
        .trim()
        .max(MAX_MESSAGE_LENGTH, `Messages can be up to ${MAX_MESSAGE_LENGTH} characters`)
        .default(""),
    clientId: z.string().trim().max(64, "Invalid clientId").optional()
});
