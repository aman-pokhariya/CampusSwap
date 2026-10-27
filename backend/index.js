import http from "http";
import mongoose from "mongoose";
import app from "./app.js";
import env from "./config/env.js";
import connectDB from "./config/db.js";
import { initSocket } from "./socket/index.js";
import { emailModeNotice } from "./utils/email.js";

// How long a shutdown may wait for open requests and connections before the process exits anyway.
const SHUTDOWN_TIMEOUT_MS = 10 * 1000;

await connectDB();

// A plain HTTP server wraps the Express app so Socket.io (real-time chat) can share its port.
// app.js stays socket-free, so tests can load it on its own.
const server = http.createServer(app);
const io = initSocket(server);

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${env.PORT} is already in use. Stop the other server or change PORT in backend/.env.`);
        process.exit(1);
    }
    throw err;
});

server.listen(env.PORT, () => {
    console.log(`🚀 CampusSwap API running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    if (!env.cloudinaryEnabled) {
        console.log("🖼️  Cloudinary not configured: photos are saved in backend/uploads (development only).");
    }
    console.log(emailModeNotice());
});

// Render sends SIGTERM before it stops or replaces the server; Ctrl+C sends SIGINT. Closing in order lets
// requests that are still running finish: first every socket and the HTTP server, then the database.
let shuttingDown = false;

const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`👋 ${signal} received: shutting down`);

    // unref(): the timer itself must not keep the process alive once everything has closed.
    setTimeout(() => {
        console.error(`❌ Still not closed after ${SHUTDOWN_TIMEOUT_MS / 1000} s: exiting anyway.`);
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    try {
        // Disconnects every socket, then closes the HTTP server it's attached to: no new requests are
        // accepted, and the callback runs once the ones in flight have finished.
        await new Promise((resolve) => io.close(resolve));
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error("❌ Shutdown failed:", err.message);
        process.exit(1);
    }
};

// once: pressing Ctrl+C a second time skips the wait and quits straight away.
process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
