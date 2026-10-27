import mongoose from "mongoose";
import multer from "multer";
import ApiError from "../utils/ApiError.js";
import env from "../config/env.js";
import { MAX_LISTING_IMAGES } from "../config/constants.js";

const UPLOAD_ERRORS = {
    LIMIT_FILE_SIZE: "Each photo must be 5 MB or smaller",
    LIMIT_FILE_COUNT: `You can add up to ${MAX_LISTING_IMAGES} photos`,
    LIMIT_UNEXPECTED_FILE: `You can add up to ${MAX_LISTING_IMAGES} photos`
};

export const notFound = (req, res, next) => {
    next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

// Every error ends up here, so all error responses have the same shape:
// { success: false, message, ...details }
// Express recognises an error handler by its 4 parameters, so `next` must stay even though it's unused.
export const errorMiddleware = (err, req, res, next) => {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({ success: false, message: err.message, ...err.details });
    }

    if (err instanceof multer.MulterError) {
        const message = UPLOAD_ERRORS[err.code] ?? err.message;
        return res.status(400).json({ success: false, message, errors: { images: message } });
    }

    if (err instanceof mongoose.Error.ValidationError) {
        const errors = Object.fromEntries(
            Object.entries(err.errors).map(([field, error]) => [field, error.message])
        );
        return res.status(400).json({ success: false, message: Object.values(errors)[0], errors });
    }

    if (err instanceof mongoose.Error.CastError) {
        return res.status(400).json({ success: false, message: `Invalid ${err.path}` });
    }

    // Duplicate key, e.g. two accounts racing for the same email.
    if (err?.code === 11000) {
        const field = Object.keys(err.keyValue ?? {})[0] ?? "value";
        return res.status(409).json({
            success: false,
            message: `This ${field} is already in use`,
            errors: { [field]: `This ${field} is already in use` }
        });
    }

    // Body parser errors (bad JSON, body too large) carry their own 4xx status.
    if (err?.type === "entity.parse.failed") {
        return res.status(400).json({ success: false, message: "Request body is not valid JSON" });
    }
    if (err?.expose && err.status < 500) {
        return res.status(err.status).json({ success: false, message: err.message });
    }

    console.error("💥 Unexpected error:", err);

    return res.status(500).json({
        success: false,
        message: env.isProduction ? "Something went wrong. Please try again." : err.message
    });
};
