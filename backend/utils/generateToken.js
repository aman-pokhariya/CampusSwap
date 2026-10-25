import jwt from "jsonwebtoken";
import env from "../config/env.js";
import { SESSION_DAYS } from "../config/constants.js";

const generateToken = (userId) => {
    return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
};

export default generateToken;
