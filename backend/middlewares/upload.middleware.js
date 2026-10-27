import multer from "multer";
import ApiError from "../utils/ApiError.js";
import { MAX_IMAGE_BYTES, MAX_LISTING_IMAGES } from "../config/constants.js";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Files stay in memory (they're small after the browser compresses them) and go straight to storage.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: MAX_LISTING_IMAGES },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_TYPES.has(file.mimetype)) return cb(null, true);
        cb(new ApiError(400, "Only JPG, PNG or WebP photos are allowed", { errors: { images: "Only JPG, PNG or WebP photos" } }));
    }
});

export const listingImages = upload.array("images", MAX_LISTING_IMAGES);
export const avatarImage = upload.single("avatar");
// Multer skips requests that aren't multipart, so text messages (JSON) pass straight through.
export const chatImage = upload.single("image");

// Runs `middleware` only for multipart requests, on routes that accept both JSON and a file
// (e.g. the photo-message rate limit, which a plain text message shouldn't use up).
export const forMultipart = (middleware) => (req, res, next) =>
    req.is("multipart/form-data") ? middleware(req, res, next) : next();

// The Content-Type of an upload is whatever the client claims. Check the file's first bytes
// ("magic numbers") to make sure it really is a JPEG, PNG or WebP image.
const SIGNATURES = [
    (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
    (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP"
];

export const verifyImages = (req, res, next) => {
    const files = req.files ?? (req.file ? [req.file] : []);

    for (const file of files) {
        if (!SIGNATURES.some((matches) => matches(file.buffer))) {
            throw new ApiError(400, `"${file.originalname}" isn't a valid image`, { errors: { images: "One of the files isn't a valid image" } });
        }
    }
    next();
};

// A multipart form can only carry text fields, so the frontend sends everything except the
// files as one JSON string called "data". Turn it back into req.body for validate().
export const parseJsonField = (req, res, next) => {
    try {
        req.body = JSON.parse(req.body?.data ?? "{}");
    } catch {
        throw new ApiError(400, "Invalid form data");
    }
    next();
};
