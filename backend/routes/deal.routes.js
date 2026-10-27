import express from "express";
import {
    getDeals,
    getDeal,
    proposeMeetup,
    confirmMeetup,
    startHandover,
    completeDeal,
    cancelDeal,
    reviewDeal
} from "../controllers/deal.controllers.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";
import { credentialLimiter, dealActionLimiter, reviewLimiter } from "../middlewares/rateLimit.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { cancelSchema, completeSchema, dealsQuerySchema, meetupSchema, reviewSchema } from "../validators/deal.validators.js";

const dealRoutes = express.Router();

dealRoutes.use(isAuthenticated);

// Deals are created by accepting an offer (POST /api/offers/:id/respond).
dealRoutes.get("/", validate(dealsQuerySchema, "query"), getDeals);
dealRoutes.get("/:id", getDeal);

// Order on each route: rate limit → validate body → controller
dealRoutes.post("/:id/meetup", dealActionLimiter, validate(meetupSchema), proposeMeetup);
dealRoutes.post("/:id/meetup/confirm", dealActionLimiter, confirmMeetup);
dealRoutes.post("/:id/handover", dealActionLimiter, startHandover);
// Entering a handover code is a guess at a secret, so wrong tries count like wrong passwords.
dealRoutes.post("/:id/complete", credentialLimiter, validate(completeSchema), completeDeal);
dealRoutes.post("/:id/cancel", dealActionLimiter, validate(cancelSchema), cancelDeal);
dealRoutes.post("/:id/review", reviewLimiter, validate(reviewSchema), reviewDeal);

export default dealRoutes;
