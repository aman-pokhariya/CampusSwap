// Throw this from any controller or middleware; error.middleware.js turns it into a JSON response.
// `details` are extra fields for the client, e.g. { errors: { email: "Already registered" } }.
class ApiError extends Error {
    constructor(statusCode, message, details = {}) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
    }
}

export default ApiError;
