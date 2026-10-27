import mongoose from "mongoose";
import Notification from "../models/notification.model.js";
import ApiError from "../utils/ApiError.js";
import { findPageBefore } from "../utils/paginate.js";
import { countUnreadNotifications, toNotificationShape } from "../utils/notify.js";
import { PUBLIC_USER_FIELDS } from "../config/constants.js";

export const getNotifications = async (req, res) => {
    const { before, limit } = req.validatedQuery;
    const me = req.user._id;

    const [{ rows, hasMore }, unreadCount] = await Promise.all([
        findPageBefore(Notification, { user: me }, { field: "createdAt", before, limit }),
        countUnreadNotifications(me)
    ]);
    await Notification.populate(rows, { path: "actor", select: PUBLIC_USER_FIELDS });

    return res.json({ success: true, notifications: rows.map(toNotificationShape), unreadCount, hasMore });
};

export const markAllNotificationsRead = async (req, res) => {
    await Notification.updateMany({ user: req.user._id, read: false }, { read: true });
    return res.json({ success: true, unreadCount: 0 });
};

// Only your own notifications: anyone else's id is a 404.
export const markNotificationRead = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) throw new ApiError(404, "Notification not found");

    const notification = await Notification.findOneAndUpdate({ _id: id, user: req.user._id }, { read: true }, { returnDocument: "after" })
        .populate("actor", PUBLIC_USER_FIELDS)
        .lean();
    if (!notification) throw new ApiError(404, "Notification not found");

    return res.json({
        success: true,
        notification: toNotificationShape(notification),
        unreadCount: await countUnreadNotifications(req.user._id)
    });
};
