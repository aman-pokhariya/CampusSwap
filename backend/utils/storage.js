import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import env from "../config/env.js";
import ApiError from "./ApiError.js";

// Images go to Cloudinary when it's configured. Without keys (development only), they are
// saved in backend/uploads and served at /api/uploads, so the app works before you set it up.
export const LOCAL_UPLOAD_DIR = fileURLToPath(new URL("../uploads", import.meta.url));

if (env.cloudinaryEnabled) {
    cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true
    });
}

const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

// Resizing happens on Cloudinary's side as the file arrives ("incoming transformation").
// Re-encoding also drops the photo's metadata (EXIF, including GPS location).
const TRANSFORMS = {
    listings: [{ width: 1600, height: 1600, crop: "limit" }],
    avatars: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
    chats: [{ width: 1600, height: 1600, crop: "limit" }]
};

const uploadToCloudinary = (buffer, folder) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: `campusswap/${folder}`,
                resource_type: "image",
                transformation: TRANSFORMS[folder]
            },
            (error, result) => {
                if (error) return reject(error);
                resolve({ url: result.secure_url, publicId: result.public_id });
            }
        );
        stream.end(buffer);
    });

const saveLocally = async (file, folder) => {
    const name = `${crypto.randomUUID()}.${EXTENSIONS[file.mimetype]}`;
    await fs.mkdir(path.join(LOCAL_UPLOAD_DIR, folder), { recursive: true });
    await fs.writeFile(path.join(LOCAL_UPLOAD_DIR, folder, name), file.buffer);
    return { url: `/api/uploads/${folder}/${name}`, publicId: `local:${folder}/${name}` };
};

// folder: "listings", "avatars" or "chats". Returns { url, publicId }.
export const uploadImage = async (file, folder) => {
    if (env.cloudinaryEnabled) {
        try {
            return await uploadToCloudinary(file.buffer, folder);
        } catch (err) {
            console.error("❌ Cloudinary upload failed:", err.message);
            throw new ApiError(502, "Couldn't upload your photo. Please try again.");
        }
    }

    if (env.isProduction) {
        throw new ApiError(503, "Photo uploads aren't configured yet. Please try again later.");
    }
    return saveLocally(file, folder);
};

export const deleteImage = async (publicId) => {
    // Demo listings use pictures that ship with the frontend ("static:demo/<name>"): nothing to delete.
    if (!publicId || publicId.startsWith("static:")) return;

    if (publicId.startsWith("local:")) {
        // Only ever delete inside the uploads folder, whatever the id says.
        const target = path.resolve(LOCAL_UPLOAD_DIR, publicId.slice("local:".length));
        if (target.startsWith(LOCAL_UPLOAD_DIR + path.sep)) await fs.unlink(target).catch(() => {});
        return;
    }

    if (env.cloudinaryEnabled) {
        await cloudinary.uploader.destroy(publicId).catch((err) => {
            console.error(`⚠️ Couldn't delete ${publicId} from Cloudinary:`, err.message);
        });
    }
};

// Uploads several files. If any fails, the ones that succeeded are deleted again,
// so a half-finished upload never leaves orphaned images behind.
export const uploadImages = async (files, folder) => {
    const results = await Promise.allSettled(files.map((file) => uploadImage(file, folder)));
    const failed = results.find((result) => result.status === "rejected");

    if (failed) {
        await deleteImages(results.filter((r) => r.status === "fulfilled").map((r) => r.value));
        throw failed.reason;
    }
    return results.map((result) => result.value);
};

export const deleteImages = (images) => Promise.allSettled(images.map((image) => deleteImage(image.publicId)));
