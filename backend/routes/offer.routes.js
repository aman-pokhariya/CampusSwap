import express from "express";
import { respondToOffer } from "../controllers/offer.controllers.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";
import { offerLimiter } from "../middlewares/rateLimit.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { respondOfferSchema } from "../validators/offer.validators.js";

const offerRoutes = express.Router();

offerRoutes.use(isAuthenticated);

// Offers are made in a chat (POST /api/conversations/:id/offers); this answers one.
offerRoutes.post("/:id/respond", offerLimiter, validate(respondOfferSchema), respondToOffer);

export default offerRoutes;
