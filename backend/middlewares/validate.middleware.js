import ApiError from "../utils/ApiError.js";

// Validates req.body against a Zod schema. On success req.body is replaced by the parsed data:
// trimmed, lowercased where needed, and stripped of unknown fields (so nobody can sneak in "role": "admin").
const validate = (schema) => (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
        const errors = {};
        for (const issue of result.error.issues) {
            const field = issue.path.join(".") || "form";
            errors[field] ??= issue.message;
        }
        throw new ApiError(400, Object.values(errors)[0], { errors });
    }

    req.body = result.data;
    next();
};

export default validate;
