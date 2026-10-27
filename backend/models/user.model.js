import mongoose from "mongoose";
import bcrypt from "bcrypt";
import pointSchema from "./schemas/point.schema.js";
import { ADMIN_SCOPE, DEFAULT_TRUST, ROLES } from "../config/constants.js";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            minlength: 2,
            maxlength: 50
        },

        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },

        // select: false → never loaded unless a query asks for it with .select("+password")
        password: {
            type: String,
            required: true,
            select: false
        },

        campus: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Campus",
            required: true
        },

        hostel: {
            type: String,
            trim: true,
            default: ""
        },

        // Copied from the user's hostel (or the campus centre). Powers "near me" search in Chunk 2.
        location: {
            type: pointSchema
        },

        avatar: {
            url: String,
            publicId: String
        },

        bio: {
            type: String,
            trim: true,
            maxlength: 200,
            default: ""
        },

        role: {
            type: String,
            enum: Object.values(ROLES),
            default: ROLES.USER
        },

        // Only matters for admins: their own campus, or every campus.
        adminScope: {
            type: String,
            enum: Object.values(ADMIN_SCOPE),
            default: ADMIN_SCOPE.CAMPUS
        },

        // Shared demo logins: they can't change the password, email-based resets, name, bio or photo.
        isDemo: {
            type: Boolean,
            default: false
        },

        isVerified: {
            type: Boolean,
            default: false
        },

        isBanned: {
            type: Boolean,
            default: false
        },

        // Recomputed from deals, reviews and reports. Shown as a score, or "New member" with no history yet.
        trust: {
            score: { type: Number, default: DEFAULT_TRUST.score },
            completedDeals: { type: Number, default: DEFAULT_TRUST.completedDeals },
            ratingAvg: { type: Number, default: DEFAULT_TRUST.ratingAvg },
            ratingCount: { type: Number, default: DEFAULT_TRUST.ratingCount },
            cancellations: { type: Number, default: DEFAULT_TRUST.cancellations }
        },

        // How many reports this user filed and how many were dismissed (weights future reports).
        reportStats: {
            filed: { type: Number, default: 0 },
            dismissed: { type: Number, default: 0 }
        },

        // Until the email is verified: SHA-256 of the "signup" cookie given to the browser that set the
        // current password. Only that browser can finish verifying (see verifyEmail).
        signupNonceHash: {
            type: String,
            select: false
        },

        // Tokens issued before this moment stop working (see isAuthenticated).
        passwordChangedAt: Date,

        lastLoginAt: Date,

        // When their last open tab disconnected (socket/index.js). Shown as "Last seen …" in chats.
        lastSeenAt: Date
    },
    {
        timestamps: true,
        toJSON: {
            transform: (doc, ret) => {
                delete ret.password;
                delete ret.signupNonceHash;
                delete ret.passwordChangedAt;
                delete ret.reportStats;
                delete ret.__v;
                return ret;
            }
        }
    }
);

// Hash the password whenever it is set or changed, so controllers never handle hashing.
userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;

    this.password = await bcrypt.hash(this.password, 12);

    if (!this.isNew) {
        // 1s back-dated: a JWT's "iat" is in whole seconds, so the token issued right
        // after this save must not look older than the password change.
        this.passwordChangedAt = new Date(Date.now() - 1000);
    }
});

userSchema.methods.comparePassword = function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.changedPasswordAfter = function (tokenIssuedAtSeconds) {
    return Boolean(this.passwordChangedAt) && this.passwordChangedAt.getTime() > tokenIssuedAtSeconds * 1000;
};

const User = mongoose.model("User", userSchema);

export default User;
