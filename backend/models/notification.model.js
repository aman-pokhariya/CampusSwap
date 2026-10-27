import mongoose from "mongoose";
import { NOTIFICATION_TYPES } from "../config/constants.js";

const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

// The bell menu. Created only through utils/notify.js, which also pushes them live.
const notificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        type: {
            type: String,
            enum: NOTIFICATION_TYPES,
            required: true
        },

        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 140
        },

        body: {
            type: String,
            trim: true,
            maxlength: 300,
            default: ""
        },

        // Where clicking it goes, e.g. "/inbox/<conversationId>".
        link: {
            type: String,
            default: ""
        },

        // Who caused it (null for system notifications).
        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null
        },

        image: {
            type: String,
            default: ""
        },

        read: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
// Finds a recent unread notification of the same kind to update instead of stacking a new one.
notificationSchema.index({ user: 1, read: 1, type: 1, link: 1 });
// TTL index: MongoDB deletes notifications after 90 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NINETY_DAYS_SECONDS });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
