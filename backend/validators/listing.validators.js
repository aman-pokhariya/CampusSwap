import { z } from "zod";
import {
    FEED_SORTS,
    LISTING_CATEGORIES,
    LISTING_CONDITIONS,
    LISTING_STATUS,
    LISTING_TYPES,
    MAX_LISTING_IMAGES,
    PRICED_TYPES,
    RENT_PERIODS
} from "../config/constants.js";

const priceField = z
    .number({ error: "Enter a valid amount" })
    .int("Use whole rupees")
    .min(0, "Price can't be negative")
    .max(1_000_000, "That's too expensive for CampusSwap")
    .nullable()
    .optional();

// Used for both creating and editing (the edit form always sends every field).
export const listingSchema = z
    .object({
        type: z.enum(LISTING_TYPES, { error: "Pick what kind of listing this is" }),
        title: z
            .string({ error: "Add a title" })
            .trim()
            .min(3, "Title must be at least 3 characters")
            .max(80, "Title must be 80 characters or less"),
        description: z.string().trim().max(1000, "Description must be 1000 characters or less").default(""),
        category: z.enum(LISTING_CATEGORIES, { error: "Pick a category" }),
        condition: z.enum(LISTING_CONDITIONS, { error: "Pick a condition" }).nullable().optional(),
        price: priceField,
        rentPeriod: z.enum(RENT_PERIODS, { error: "Pick day, week or month" }).nullable().optional(),
        swapFor: z.string().trim().max(120, "Keep it under 120 characters").default(""),
        negotiable: z.boolean().default(true),
        kitItems: z
            .array(z.string().trim().min(1, "Item can't be empty").max(60, "Each item must be 60 characters or less"))
            .max(20, "Up to 20 items")
            .default([]),
        // Editing only: publicIds of current photos to keep.
        keepImages: z.array(z.string().max(200)).max(MAX_LISTING_IMAGES).default([]),
        // Editing only: final photo order, e.g. ["n:0", "k:<publicId>"] = first new upload, then a kept photo.
        imageOrder: z.array(z.string().max(210)).max(MAX_LISTING_IMAGES).default([])
    })
    .superRefine((data, ctx) => {
        const fail = (field, message) => ctx.addIssue({ code: "custom", path: [field], message });

        if (data.type !== "wanted" && !data.condition) fail("condition", "Pick a condition");
        if (PRICED_TYPES.includes(data.type) && !(data.price >= 1)) {
            fail("price", data.type === "rent" ? "Enter the rent amount" : "Enter a price");
        }
        if (data.type === "rent" && !data.rentPeriod) fail("rentPeriod", "Pick day, week or month");
        if (data.type === "swap" && data.swapFor.length < 2) fail("swapFor", "What do you want in exchange?");
        if (data.type === "kit" && data.kitItems.length < 2) fail("kitItems", "List at least 2 items in the kit");
    })
    // Drop fields that don't apply to the chosen type, so switching type in the form can't leave junk behind.
    .transform((data) => ({
        ...data,
        condition: data.condition ?? undefined,
        price: data.type === "free" ? 0 : data.price ?? undefined,
        rentPeriod: data.type === "rent" ? data.rentPeriod : undefined,
        swapFor: data.type === "swap" ? data.swapFor : "",
        kitItems: data.type === "kit" ? data.kitItems : [],
        negotiable: data.type === "free" ? false : data.negotiable
    }));

export const feedQuerySchema = z.object({
    q: z.string().trim().max(80).optional(),
    type: z.enum(LISTING_TYPES).optional(),
    category: z.enum(LISTING_CATEGORIES).optional(),
    condition: z.enum(LISTING_CONDITIONS).optional(),
    minPrice: z.coerce.number().int().min(0).optional(),
    maxPrice: z.coerce.number().int().min(0).optional(),
    // Only show listings within this many metres of you.
    within: z.coerce.number().int().min(100).max(20000).optional(),
    sort: z.enum(FEED_SORTS).default("newest"),
    page: z.coerce.number().int().min(1).max(200).default(1),
    limit: z.coerce.number().int().min(1).max(30).default(12)
});

// Sellers can mark a listing sold or put it back on sale. (Chunk 4 adds QR-confirmed sales.)
export const listingStatusSchema = z.object({
    status: z.enum([LISTING_STATUS.ACTIVE, LISTING_STATUS.SOLD], { error: "Status must be active or sold" })
});
