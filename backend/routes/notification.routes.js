import express from "express";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../controllers/notification.controllers.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { notificationsQuerySchema } from "../validators/notification.validators.js";

const notificationRoutes = express.Router();

notificationRoutes.use(isAuthenticated);

notificationRoutes.get("/", validate(notificationsQuerySchema, "query"), getNotifications);
notificationRoutes.post("/read-all", markAllNotificationsRead);
notificationRoutes.patch("/:id/read", markNotificationRead);

export default notificationRoutes;
