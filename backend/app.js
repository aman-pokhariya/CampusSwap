import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import env, { isAllowedOrigin } from "./config/env.js";
import { apiLimiter } from "./middlewares/rateLimit.middleware.js";
import originGuard from "./middlewares/originGuard.middleware.js";
import { notFound, errorMiddleware } from "./middlewares/error.middleware.js";

import authRoutes from "./routes/auth.routes.js";
import campusRoutes from "./routes/campus.routes.js";
import userRoutes from "./routes/user.routes.js";

const app = express();

// In production Render (and Vercel) sit in front of the app as proxies.
// Trusting one hop makes req.ip the real visitor's IP, which rate limiting depends on.
if (env.isProduction) app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({
    origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin)),
    credentials: true
}));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
    res.json({ success: true, status: "ok", uptime: Math.round(process.uptime()) });
});

app.use("/api", apiLimiter, originGuard);

app.use("/api/auth", authRoutes);
app.use("/api/campuses", campusRoutes);
app.use("/api/users", userRoutes);

app.use(notFound);
app.use(errorMiddleware);

export default app;
