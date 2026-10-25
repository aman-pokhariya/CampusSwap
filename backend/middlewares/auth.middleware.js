import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";
import { clearAuthCookie, readAuthCookie } from "../utils/authCookie.js";

// Express 5 passes errors thrown in async middleware straight to the error middleware,
// so there's no try/catch around the whole function.
export const isAuthenticated = async (req, res, next) => {
    const token = readAuthCookie(req);

    if (!token) {
        throw new ApiError(401, "Please log in to continue");
    }

    let decoded;
    try {
        decoded = jwt.verify(token, env.JWT_SECRET);
    } catch {
        clearAuthCookie(res);
        throw new ApiError(401, "Your session has expired. Please log in again.");
    }

    const user = await User.findById(decoded.userId);

    if (!user) {
        clearAuthCookie(res);
        throw new ApiError(401, "Account not found. Please log in again.");
    }

    // Changing or resetting the password logs out every other device.
    if (user.changedPasswordAfter(decoded.iat)) {
        clearAuthCookie(res);
        throw new ApiError(401, "Your password was changed. Please log in again.");
    }

    if (user.isBanned) {
        clearAuthCookie(res);
        throw new ApiError(403, "Your account has been suspended.", { code: "ACCOUNT_BANNED" });
    }

    req.user = user;
    next();
};

// Usage: router.get("/admin/stats", isAuthenticated, requireRole("admin"), handler)
export const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
        throw new ApiError(403, "You don't have permission to do that");
    }
    next();
};
