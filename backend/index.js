import http from "http";
import app from "./app.js";
import env from "./config/env.js";
import connectDB from "./config/db.js";

await connectDB();

// A plain HTTP server wraps the Express app so Socket.io can attach to it in Chunk 3.
const server = http.createServer(app);

server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${env.PORT} is already in use. Stop the other server or change PORT in backend/.env.`);
        process.exit(1);
    }
    throw err;
});

server.listen(env.PORT, () => {
    console.log(`🚀 CampusSwap API running on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    if (!env.emailEnabled) {
        console.log("📧 Email not configured: OTP codes will be printed in this terminal.");
    }
});
