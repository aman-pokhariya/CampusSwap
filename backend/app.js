import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import env, { isAllowedOrigin } from "./config/env.js";
import { apiLimiter } from "./middlewares/rateLimit.middleware.js";
import originGuard from "./middlewares/originGuard.middleware.js";
import requestLog from "./middlewares/requestLog.middleware.js";
import { notFound, errorMiddleware } from "./middlewares/error.middleware.js";
import { LOCAL_UPLOAD_DIR } from "./utils/storage.js";

import authRoutes from "./routes/auth.routes.js";
import campusRoutes from "./routes/campus.routes.js";
import userRoutes from "./routes/user.routes.js";
import listingRoutes from "./routes/listing.routes.js";
import conversationRoutes from "./routes/conversation.routes.js";
import offerRoutes from "./routes/offer.routes.js";
import dealRoutes from "./routes/deal.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import reportRoutes from "./routes/report.routes.js";
import adminRoutes from "./routes/admin.routes.js";

const app = express();

// In production Render's load balancer (and Vercel's /api rewrite in front of it) are proxies, so the
// visitor's IP arrives in X-Forwarded-For. Trusting exactly TRUST_PROXY hops makes req.ip that real IP,
// which rate limiting depends on; trusting more would let anyone pick their IP with a made-up header.
// In development requests come straight from this machine, so no proxy is trusted.
if (env.isProduction) app.set("trust proxy", env.TRUST_PROXY);

// One line per request in Render's logs; development stays quiet.
if (env.isProduction) app.use(requestLog);

app.use(helmet());
app.use(cors({
    origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)),
    credentials: true
}));
// Gzips JSON responses: feeds and chats shrink a lot on slow hostel Wi-Fi (photos are already compressed
// and are skipped). Socket.io answers its own requests before Express sees them, so live chat is untouched.
app.use(compression());
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
    res.json({ success: true, status: "ok", uptime: Math.round(process.uptime()) });
});

// Photos saved locally when Cloudinary isn't configured (development only, see utils/storage.js).
// Mounted before the rate limiter so a feed full of images doesn't eat into anyone's limit.
if (!env.cloudinaryEnabled) {
    app.use("/api/uploads", express.static(LOCAL_UPLOAD_DIR, { maxAge: "7d", index: false }));
}

app.use("/api", apiLimiter, originGuard);

app.use("/api/auth", authRoutes);
app.use("/api/campuses", campusRoutes);
app.use("/api/users", userRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/deals", dealRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorMiddleware);

export default app;
