import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { clearAuthCookie, readAuthCookie } from "../utils/authCookie.js";
import { verifySessionToken } from "../utils/generateToken.js";

// Express 5 passes errors thrown in async middleware straight to the error middleware,
// so there's no try/catch around the whole function.
export const isAuthenticated = async (req, res, next) => {
    const token = readAuthCookie(req);

    if (!token) {
        throw new ApiError(401, "Please log in to continue");
    }

    // Expired, tampered, or not a session at all (like a 2-minute socket token copied into the cookie).
    let decoded;
    try {
        decoded = verifySessionToken(token);
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

// Demo accounts are shared logins, so nobody may lock the others out or rename them.
// blockDemo() blocks the whole route; blockDemo("name", "bio") only blocks changing those fields.
// Routes without a session (forgot/reset password) find the account by the email in the body.
export const blockDemo = (...fields) => async (req, res, next) => {
    const user = req.user ?? (req.body?.email ? await User.findOne({ email: req.body.email }).select("isDemo").lean() : null);
    const changes = fields.length === 0 || fields.some((field) => req.body?.[field] !== undefined && req.body[field] !== user?.[field]);

    if (user?.isDemo && changes) {
        throw new ApiError(403, "Demo accounts can't change this", { code: "DEMO_ACCOUNT" });
    }
    next();
};
