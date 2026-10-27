import Notification from "../models/notification.model.js";
import { hasBlocked } from "./blocks.js";
import { sameId } from "./ids.js";
import { toPublicUser } from "./publicUser.js";
import { emitToUser, isOnline } from "../socket/index.js";
import { PUBLIC_USER_FIELDS } from "../config/constants.js";

const COALESCE_MS = 10 * 60 * 1000;

const truncate = (text, max) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// The shape the bell menu receives, over HTTP and over the socket alike.
export const toNotificationShape = (notification) => ({
    _id: notification._id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    image: notification.image,
    read: notification.read,
    actor: toPublicUser(notification.actor),
    createdAt: notification.createdAt
});

export const countUnreadNotifications = (userId) => Notification.countDocuments({ user: userId, read: false });

// Creates an in-app notification and pushes it to the user's open tabs.
// A burst of the same kind about the same thing (three counter-offers in one chat) updates one unread
// notification instead of stacking up. Never throws: a notification must never break the action
// that caused it. Chat messages don't create notifications (the unread badges cover them).
export const notify = async (userId, { type, title, body = "", link = "", actor = null, image = "" }) => {
    try {
        if (actor && (sameId(userId, actor) || (await hasBlocked(userId, actor)))) return null;

        const now = new Date();
        const content = { title: truncate(title, 140), body: truncate(body, 300), actor, image };

        // Moving createdAt forward puts the updated notification back at the top of the list.
        let notification = await Notification.findOneAndUpdate(
            { user: userId, type, link, read: false, createdAt: { $gt: new Date(now.getTime() - COALESCE_MS) } },
            { $set: { ...content, createdAt: now } },
            { returnDocument: "after", overwriteImmutable: true }
        );
        notification ??= await Notification.create({ user: userId, type, link, ...content });

        if (isOnline(userId)) {
            await notification.populate("actor", PUBLIC_USER_FIELDS);
            const unreadCount = await countUnreadNotifications(userId);
            emitToUser(userId, "notification:new", { notification: toNotificationShape(notification), unreadCount });
        }
        return notification;
    } catch (err) {
        console.error(`⚠️ Couldn't create a ${type} notification:`, err.message);
        return null;
    }
};
