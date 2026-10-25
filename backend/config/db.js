import mongoose from "mongoose";
import env from "./env.js";

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
        console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    } catch (err) {
        console.error("❌ MongoDB connection failed:", err.message);
        console.error("   Check MONGO_URI in backend/.env, and that Atlas → Network Access allows your IP.");
        process.exit(1);
    }
};

export default connectDB;
