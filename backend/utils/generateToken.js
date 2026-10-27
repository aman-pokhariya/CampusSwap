import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { SESSION_DAYS, TOKEN_AUDIENCE } from "../config/constants.js";

// The session cookie's token. Its audience keeps it apart from socket tokens (utils/socketToken.js).
const generateToken = (userId) => {
    return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: `${SESSION_DAYS}d`, audience: TOKEN_AUDIENCE.SESSION });
};

// Returns the payload of a valid session token: signed with our secret, not expired, and meant for the
// "session" audience (tokens issued before audiences existed have none). Throws for anything else,
// e.g. a 2-minute socket token copied into the cookie.
export const verifySessionToken = (token) => {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (!decoded.userId || (decoded.aud !== undefined && decoded.aud !== TOKEN_AUDIENCE.SESSION)) {
        throw new jwt.JsonWebTokenError("not a session token");
    }
    return decoded;
};

export default generateToken;
