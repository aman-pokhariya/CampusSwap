import ApiError from "../utils/ApiError.js";
import { isAllowedOrigin } from "../config/env.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// CSRF defence in depth (on top of SameSite cookies): browsers attach an Origin header to
// requests that change data. Refuse those unless they come from our own frontend.
// Requests with no Origin at all come from tools like Postman or curl, not from a web page.
const originGuard = (req, res, next) => {
    const origin = req.get("origin");

    if (SAFE_METHODS.has(req.method) || !origin || isAllowedOrigin(origin)) {
        return next();
    }

    throw new ApiError(403, "Request blocked: untrusted origin");
};

export default originGuard;
