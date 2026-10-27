import express from "express";
import { createReport } from "../controllers/report.controllers.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";
import { reportLimiter } from "../middlewares/rateLimit.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { reportSchema } from "../validators/report.validators.js";

const reportRoutes = express.Router();

reportRoutes.use(isAuthenticated);

// Reporting a listing, a user or a chat message. Admins work through them in /api/admin/reports.
reportRoutes.post("/", reportLimiter, validate(reportSchema), createReport);

export default reportRoutes;
