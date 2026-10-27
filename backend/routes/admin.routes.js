import express from "express";
import {
    getOverview,
    getReports,
    resolveReport,
    getModerationListings,
    moderateListing,
    getUsers,
    updateUser
} from "../controllers/admin.controllers.js";
import { isAuthenticated, requireRole } from "../middlewares/auth.middleware.js";
import { adminLimiter } from "../middlewares/rateLimit.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
    moderateListingSchema,
    moderationQuerySchema,
    overviewQuerySchema,
    reportsQuerySchema,
    resolveReportSchema,
    updateUserSchema,
    usersQuerySchema
} from "../validators/admin.validators.js";
import { ROLES } from "../config/constants.js";

const adminRoutes = express.Router();

// Admins only. Which campus a request may touch is checked in every handler (canAdminCampus).
adminRoutes.use(isAuthenticated, requireRole(ROLES.ADMIN));

adminRoutes.get("/overview", validate(overviewQuerySchema, "query"), getOverview);

// Order on each decision: rate limit → validate body → controller
adminRoutes.get("/reports", validate(reportsQuerySchema, "query"), getReports);
adminRoutes.patch("/reports/:id", adminLimiter, validate(resolveReportSchema), resolveReport);

adminRoutes.get("/listings", validate(moderationQuerySchema, "query"), getModerationListings);
adminRoutes.patch("/listings/:id", adminLimiter, validate(moderateListingSchema), moderateListing);

adminRoutes.get("/users", validate(usersQuerySchema, "query"), getUsers);
adminRoutes.patch("/users/:id", adminLimiter, validate(updateUserSchema), updateUser);

export default adminRoutes;
