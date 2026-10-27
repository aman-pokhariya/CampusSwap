import express from "express";
import {
    getFeed,
    getListing,
    createListing,
    updateListing,
    updateListingStatus,
    deleteListing,
    saveListing,
    unsaveListing,
    getSavedListings,
    getMyListings
} from "../controllers/listing.controllers.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";
import { editLimiter, listingLimiter } from "../middlewares/rateLimit.middleware.js";
import { listingImages, parseJsonField, verifyImages } from "../middlewares/upload.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { feedQuerySchema, listingSchema, listingStatusSchema } from "../validators/listing.validators.js";

const listingRoutes = express.Router();

// Everything here needs a logged-in user (and uploads are never parsed for anonymous requests).
listingRoutes.use(isAuthenticated);

listingRoutes.get("/", validate(feedQuerySchema, "query"), getFeed);

// Uploads: rate limit → receive files → check they're real images → read the JSON fields → validate
listingRoutes.post("/", listingLimiter, listingImages, verifyImages, parseJsonField, validate(listingSchema), createListing);

// Fixed paths before "/:id", otherwise Express would treat "mine" as an id.
listingRoutes.get("/mine", getMyListings);
listingRoutes.get("/saved", getSavedListings);

listingRoutes.get("/:id", getListing);
listingRoutes.patch("/:id", editLimiter, listingImages, verifyImages, parseJsonField, validate(listingSchema), updateListing);
listingRoutes.patch("/:id/status", editLimiter, validate(listingStatusSchema), updateListingStatus);
listingRoutes.delete("/:id", deleteListing);

listingRoutes.put("/:id/save", saveListing);
listingRoutes.delete("/:id/save", unsaveListing);

export default listingRoutes;
