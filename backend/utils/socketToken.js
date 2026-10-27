import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { SOCKET_TOKEN_TTL, TOKEN_AUDIENCE } from "../config/constants.js";

// The browser fetches one of these (GET /api/auth/socket-token) right before connecting, because in
// production the socket goes straight to the API's own domain, where the session cookie isn't sent.
// It lives for 2 minutes and its audience means it can never be used as a session cookie.
export const signSocketToken = (userId) =>
    jwt.sign({ userId }, env.JWT_SECRET, { audience: TOKEN_AUDIENCE.SOCKET, expiresIn: SOCKET_TOKEN_TTL });

// Throws for a missing, expired or tampered token, and for any token meant for another audience.
export const verifySocketToken = (token) => jwt.verify(token, env.JWT_SECRET, { audience: TOKEN_AUDIENCE.SOCKET });
