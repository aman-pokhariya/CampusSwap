import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { z } from "zod";

// Always load backend/.env, whichever folder the server is started from.
dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

const EMAIL_ADDRESS = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

// EMAIL_FROM "CampusSwap <hello@example.com>" → { name: "CampusSwap", email: "hello@example.com" }
// (Brevo wants the two apart). A bare address works too.
const parseSender = (from = "") => {
    const [, name = "", email = from] = /^\s*"?(.*?)"?\s*<([^<>]*)>\s*$/.exec(from) ?? [];
    return { name: name.trim() || "CampusSwap", email: email.trim() };
};

// Validate every environment variable once, at startup. A missing or wrong value stops
// the server immediately with a clear message, instead of crashing later in some request.
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(8084),
    CLIENT_URL: z.string().default("http://localhost:5173"),

    // How many proxies sit in front of the API in production. Express trusts exactly that many hops of
    // X-Forwarded-For to find the visitor's real IP, which the rate limits use. 1 = Render's load balancer.
    // With the frontend on Vercel forwarding /api to Render (vercel.json) there are two: set TRUST_PROXY=2.
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(1),

    MONGO_URI: z
        .string({ error: "is required (your MongoDB Atlas connection string)" })
        .regex(/^mongodb(\+srv)?:\/\//, "must start with mongodb:// or mongodb+srv://"),

    JWT_SECRET: z
        .string({ error: "is required (any long random string)" })
        .min(32, "must be at least 32 characters long"),

    // Sign-up and reset codes go out through Brevo's HTTPS API when BREVO_API_KEY is set, otherwise through
    // Gmail over SMTP when EMAIL_USER and EMAIL_PASS (an app password) are. Render's free plan blocks SMTP,
    // so production uses Brevo. With neither, development prints the codes in the terminal.
    EMAIL_USER: z.string().optional(),
    EMAIL_PASS: z.string().optional(),
    BREVO_API_KEY: z.string().optional(),
    // Leave it unset: only tests change it, to point the server at a local stand-in for Brevo.
    BREVO_API_URL: z.url({ protocol: /^https?$/, error: "must be an http(s) URL" }).default("https://api.brevo.com/v3/smtp/email"),
    // "Name <address>". With Brevo, the address must be a sender verified in your Brevo account.
    EMAIL_FROM: z.string().optional(),
    // The most codes the whole server sends in a day, a little under Gmail's quota (about 500), so a flood
    // of fake sign-ups can't get the sending account blocked. Lower it for providers with smaller quotas
    // (Brevo's free plan sends 300 a day).
    EMAIL_DAILY_CAP: z.coerce.number().int().min(1).default(400),

    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),

    // Reports from accounts younger than this don't count towards hiding a listing automatically,
    // so a handful of brand-new accounts can't take down someone's listing. Default below.
    REPORT_MIN_ACCOUNT_AGE_HOURS: z.coerce.number().int().min(0).optional()
}).superRefine((data, ctx) => {
    if (!data.BREVO_API_KEY) return;
    // Brevo only sends from a sender verified in the account, and there's no login address to fall back on.
    if (!EMAIL_ADDRESS.test(parseSender(data.EMAIL_FROM).email)) {
        ctx.addIssue({
            code: "custom",
            path: ["EMAIL_FROM"],
            message: 'must be a sender verified in Brevo when BREVO_API_KEY is set, like "CampusSwap <you@example.com>"'
        });
    }
    // The API key travels in a request header, so in production it only ever goes over HTTPS.
    if (data.NODE_ENV === "production" && !data.BREVO_API_URL.startsWith("https://")) {
        ctx.addIssue({ code: "custom", path: ["BREVO_API_URL"], message: "must start with https:// in production" });
    }
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

const { BREVO_API_KEY, EMAIL_USER, EMAIL_PASS, EMAIL_FROM } = parsed.data;
// Brevo wins when both are set up: it works on every host, SMTP doesn't on Render's free plan.
const emailProvider = BREVO_API_KEY ? "brevo" : EMAIL_USER && EMAIL_PASS ? "smtp" : null;

const env = {
    ...parsed.data,
    isProduction: parsed.data.NODE_ENV === "production",
    // 3 days in production; 0 elsewhere, so freshly created test accounts count straight away.
    REPORT_MIN_ACCOUNT_AGE_HOURS: parsed.data.REPORT_MIN_ACCOUNT_AGE_HOURS ?? (parsed.data.NODE_ENV === "production" ? 72 : 0),
    clientUrls: parsed.data.CLIENT_URL.split(",").map((url) => url.trim()).filter(Boolean),
    // "brevo", "smtp" or null (no email: development prints the codes in the terminal instead).
    emailProvider,
    emailEnabled: emailProvider !== null,
    // Who Brevo sends from: EMAIL_FROM split into name and address.
    emailSender: parseSender(EMAIL_FROM),
    cloudinaryEnabled: Boolean(
        parsed.data.CLOUDINARY_CLOUD_NAME && parsed.data.CLOUDINARY_API_KEY && parsed.data.CLOUDINARY_API_SECRET
    )
};

// Local network addresses (localhost, 127.0.0.1, 192.168.x.x, 10.x.x.x) are only trusted in development,
// so you can also open the app from your phone on the same Wi-Fi.
const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/;

export const isAllowedOrigin = (origin) =>
    env.clientUrls.includes(origin) || (!env.isProduction && DEV_ORIGIN.test(origin));

export default env;
