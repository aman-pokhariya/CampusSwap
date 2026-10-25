import mongoose from "mongoose";
import bcrypt from "bcrypt";
import pointSchema from "./schemas/point.schema.js";
import { ROLES } from "../config/constants.js";

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

        isVerified: {
            type: Boolean,
            default: false
        },

        isBanned: {
            type: Boolean,
            default: false
        },

        // Tokens issued before this moment stop working (see isAuthenticated).
        passwordChangedAt: Date,

        lastLoginAt: Date
    },
    {
        timestamps: true,
        toJSON: {
            transform: (doc, ret) => {
                delete ret.password;
                delete ret.passwordChangedAt;
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
