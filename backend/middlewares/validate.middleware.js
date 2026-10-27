import ApiError from "../utils/ApiError.js";

// Validates the request body (default) or query string against a Zod schema.
// On success the parsed data replaces the input: trimmed, lowercased where needed, numbers
// converted, and stripped of unknown fields (so nobody can sneak in "role": "admin").
const validate = (schema, source = "body") => (req, res, next) => {
    const input = source === "query"
        // ?category= (empty) means "no filter"
        ? Object.fromEntries(Object.entries(req.query).filter(([, value]) => value !== ""))
        : req.body ?? {};

    const result = schema.safeParse(input);

    if (!result.success) {
        const errors = {};
        for (const issue of result.error.issues) {
            const field = issue.path.join(".") || "form";
            errors[field] ??= issue.message;
        }
        throw new ApiError(400, Object.values(errors)[0], { errors });
    }

    // Express 5 makes req.query read-only, so parsed queries live on req.validatedQuery.
    if (source === "query") req.validatedQuery = result.data;
    else req.body = result.data;
    next();
};

export default validate;
