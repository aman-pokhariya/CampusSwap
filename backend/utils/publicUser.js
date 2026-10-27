import { DEFAULT_TRUST, PUBLIC_USER_FIELDS } from "../config/constants.js";

const PUBLIC_FIELDS = PUBLIC_USER_FIELDS.split(" ");

// The same public fields as a $project stage, for aggregate() pipelines.
export const publicUserProjection = Object.fromEntries(PUBLIC_FIELDS.map((field) => [field, 1]));

// Socket payloads and hand-built shapes carry only these fields of another user.
export const toPublicUser = (user) =>
    user ? Object.fromEntries(["_id", ...PUBLIC_FIELDS].map((field) => [field, user[field]])) : null;

// The trust numbers other students may see. Cancellations stay private (they still lower the score).
// null for accounts that never got a trust record: the frontend shows "New member".
export const toPublicTrust = (trust) =>
    trust
        ? {
            score: trust.score ?? DEFAULT_TRUST.score,
            completedDeals: trust.completedDeals ?? 0,
            ratingAvg: trust.ratingAvg ?? 0,
            ratingCount: trust.ratingCount ?? 0
        }
        : null;
