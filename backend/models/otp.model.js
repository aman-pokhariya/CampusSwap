import mongoose from "mongoose";
import { OTP_PURPOSE } from "../config/constants.js";

// One active code per (email, purpose). Only a bcrypt hash of the code is stored,
// so a database leak doesn't leak working codes.
const otpSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true
        },

        purpose: {
            type: String,
            enum: Object.values(OTP_PURPOSE),
            required: true
        },

        codeHash: {
            type: String,
            required: true
        },

        attempts: {
            type: Number,
            default: 0
        },

        sentAt: {
            type: Date,
            required: true
        },

        expiresAt: {
            type: Date,
            required: true
        }
    },
    { timestamps: true }
);

otpSchema.index({ email: 1, purpose: 1 }, { unique: true });

// TTL index: MongoDB deletes each code by itself once expiresAt has passed.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Otp = mongoose.model("Otp", otpSchema);

export default Otp;
