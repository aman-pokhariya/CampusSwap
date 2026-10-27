import express from "express";
import {
    updateProfile,
    changePassword,
    updateAvatar,
    removeAvatar,
    getProfile,
    getUserReviews
} from "../controllers/user.controllers.js";
import { getMyBlocks, blockUser, unblockUser } from "../controllers/block.controllers.js";
import { blockDemo, isAuthenticated } from "../middlewares/auth.middleware.js";
import { avatarLimiter, blockLimiter, credentialLimiter } from "../middlewares/rateLimit.middleware.js";
import { avatarImage, verifyImages } from "../middlewares/upload.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import { blocksQuerySchema, changePasswordSchema, reviewsQuerySchema, updateProfileSchema } from "../validators/user.validators.js";

const userRoutes = express.Router();

// Demo accounts may change their hostel, but not their name, bio, photo or password.
userRoutes.patch("/me", isAuthenticated, validate(updateProfileSchema), blockDemo("name", "bio"), updateProfile);
userRoutes.patch("/me/password", isAuthenticated, blockDemo(), credentialLimiter, validate(changePasswordSchema), changePassword);
// The limiter comes before the upload middleware, so a request over the limit is refused before its file is read.
userRoutes.patch("/me/avatar", isAuthenticated, blockDemo(), avatarLimiter, avatarImage, verifyImages, updateAvatar);
userRoutes.delete("/me/avatar", isAuthenticated, blockDemo(), avatarLimiter, removeAvatar);

// Fixed paths before "/:id", otherwise Express would treat "me" as an id.
userRoutes.get("/me/blocks", isAuthenticated, validate(blocksQuerySchema, "query"), getMyBlocks);

userRoutes.get("/:id", isAuthenticated, getProfile);
userRoutes.get("/:id/reviews", isAuthenticated, validate(reviewsQuerySchema, "query"), getUserReviews);
userRoutes.post("/:id/block", isAuthenticated, blockLimiter, blockUser);
userRoutes.delete("/:id/block", isAuthenticated, blockLimiter, unblockUser);

export default userRoutes;
