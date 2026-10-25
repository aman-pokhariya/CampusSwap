import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { z } from "zod";

// Always load backend/.env, whichever folder the server is started from.
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

// Validate every environment variable once, at startup. A missing or wrong value stops
// the server immediately with a clear message, instead of crashing later in some request.
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(8084),
    CLIENT_URL: z.string().default("http://localhost:5173"),

    MONGO_URI: z
        .string({ error: "is required (your MongoDB Atlas connection string)" })
        .regex(/^mongodb(\+srv)?:\/\//, "must start with mongodb:// or mongodb+srv://"),

    JWT_SECRET: z
        .string({ error: "is required (any long random string)" })
        .min(32, "must be at least 32 characters long"),

    EMAIL_USER: z.string().optional(),
    EMAIL_PASS: z.string().optional(),
    EMAIL_FROM: z.string().optional()
});

// `KEY=` in a .env file gives an empty string; treat that the same as "not set".
const rawEnv = Object.fromEntries(
    Object.entries(process.env).map(([key, value]) => [key, value === "" ? undefined : value])
);

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
    console.error("\n❌ Invalid environment variables:");
    for (const issue of parsed.error.issues) {
        console.error(`   • ${issue.path.join(".")} ${issue.message}`);
    }
    console.error("\n   Copy backend/.env.example to backend/.env and fill in the values.\n");
    process.exit(1);
}

const env = {
    ...parsed.data,
    isProduction: parsed.data.NODE_ENV === "production",
    clientUrls: parsed.data.CLIENT_URL.split(",").map((url) => url.trim()).filter(Boolean),
    emailEnabled: Boolean(parsed.data.EMAIL_USER && parsed.data.EMAIL_PASS)
};

// Local network addresses (localhost, 127.0.0.1, 192.168.x.x, 10.x.x.x) are only trusted in development,
// so you can also open the app from your phone on the same Wi-Fi.
const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/;

export const isAllowedOrigin = (origin) =>
    env.clientUrls.includes(origin) || (!env.isProduction && DEV_ORIGIN.test(origin));

export default env;
