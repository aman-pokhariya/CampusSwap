import express from "express";
import {
    startConversation,
    getConversations,
    getUnreadCount,
    getConversation,
    getMessages,
    sendMessage,
    markRead
} from "../controllers/conversation.controllers.js";
import { createOffer, getOffers } from "../controllers/offer.controllers.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";
import { chatImageLimiter, chatLimiter, conversationLimiter, offerLimiter } from "../middlewares/rateLimit.middleware.js";
import { chatImage, forMultipart, verifyImages } from "../middlewares/upload.middleware.js";
import validate from "../middlewares/validate.middleware.js";
import {
    conversationsQuerySchema,
    messageSchema,
    messagesQuerySchema,
    startConversationSchema
} from "../validators/conversation.validators.js";
import { offerSchema } from "../validators/offer.validators.js";

const conversationRoutes = express.Router();

conversationRoutes.use(isAuthenticated);

conversationRoutes.post("/", conversationLimiter, validate(startConversationSchema), startConversation);
conversationRoutes.get("/", validate(conversationsQuerySchema, "query"), getConversations);

// Fixed paths before "/:id", otherwise Express would treat "unread-count" as an id.
conversationRoutes.get("/unread-count", getUnreadCount);
conversationRoutes.get("/:id", getConversation);

conversationRoutes.get("/:id/messages", validate(messagesQuerySchema, "query"), getMessages);
// Text messages are JSON; photo messages are multipart and also count against the photo limit.
conversationRoutes.post(
    "/:id/messages",
    chatLimiter,
    forMultipart(chatImageLimiter),
    chatImage,
    verifyImages,
    validate(messageSchema),
    sendMessage
);
conversationRoutes.post("/:id/read", markRead);

conversationRoutes.post("/:id/offers", offerLimiter, validate(offerSchema), createOffer);
conversationRoutes.get("/:id/offers", getOffers);

export default conversationRoutes;
