import express from "express";
import { updateProfile, changePassword } from "../controllers/user.controllers.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";
import { credentialLimiter } from "../middlewares/rateLimit.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { updateProfileSchema, changePasswordSchema } from "../validators/user.validators.js";

const userRoutes = express.Router();

userRoutes.patch("/me", isAuthenticated, validate(updateProfileSchema), updateProfile);
userRoutes.patch("/me/password", isAuthenticated, credentialLimiter, validate(changePasswordSchema), changePassword);

export default userRoutes;
