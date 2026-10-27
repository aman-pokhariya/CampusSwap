import crypto from "crypto";
import bcrypt from "bcrypt";
import User from "../models/user.model.js";
import Campus from "../models/campus.model.js";
import ApiError from "../utils/ApiError.js";
import { toPoint } from "../models/schemas/point.schema.js";
import {
    clearAuthCookie,
    clearSignupCookie,
    readSessionUserId,
    readSignupCookie,
    setAuthCookie,
    setSignupCookie
} from "../utils/authCookie.js";
import { consumeOtp, sendOtpIfAllowed } from "../utils/otp.js";
import { signSocketToken } from "../utils/socketToken.js";
import { takeMailAllowance } from "../middlewares/rateLimit.middleware.js";
import { disconnectUser } from "../socket/index.js";
import { CAMPUS_PUBLIC_FIELDS, OTP_PURPOSE, OTP_RESEND_COOLDOWN_SECONDS } from "../config/constants.js";

// Login compares against this when the email doesn't exist, so a wrong email takes as long
// as a wrong password and response times don't reveal who has an account.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("campusswap-timing-guard", 12);

const firstName = (name) => name.split(" ")[0];

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

// Whoever sets an unverified account's password gets a random nonce in the "signup" cookie, and the
// account keeps only its hash. Signing up again for the same email (from anyone) replaces both, so a code
// that is already in the inbox can't verify an account whose password someone else chose: only the
// browser that set the current password can finish verifying.
const newSignupNonce = () => {
    const nonce = crypto.randomBytes(16).toString("hex");
    return { nonce, hash: sha256(nonce) };
};

const signupRestartedError = () =>
    new ApiError(400, "This sign-up was restarted — please sign up again", { code: "SIGNUP_RESTARTED" });

const alreadyVerifiedError = () =>
    new ApiError(400, "This email is already verified. Log in instead.", { code: "ALREADY_VERIFIED" });

// Logs the user in and sends back their profile with campus details.
const sendSession = async (res, user, message, status = 200) => {
    setAuthCookie(res, user._id);
    await user.populate("campus", CAMPUS_PUBLIC_FIELDS);
    return res.status(status).json({ success: true, message, user });
};

export const signup = async (req, res) => {
    const { name, email, password, hostel } = req.body;

    const campus = await Campus.findByEmail(email);
    if (!campus) {
        throw new ApiError(400, "Use your college email — this domain isn't on CampusSwap yet", {
            code: "CAMPUS_NOT_FOUND",
            errors: { email: "This email domain isn't a registered campus" }
        });
    }

    const hostelPlace = hostel ? campus.hostels.find((h) => h.name === hostel) : null;
    if (hostel && !hostelPlace) {
        throw new ApiError(400, "Pick a hostel from the list", { errors: { hostel: "Unknown hostel for this campus" } });
    }

    let user = await User.findOne({ email });

    if (user?.isVerified) {
        throw new ApiError(409, "An account with this email already exists. Log in instead.", {
            errors: { email: "Already registered — log in instead" }
        });
    }

    // An unverified account (e.g. the code never arrived) can sign up again: update it instead of failing.
    // The new password and the new nonce are saved together, in one write.
    if (!user) user = new User({ email });

    const { nonce, hash } = newSignupNonce();
    user.name = name;
    user.password = password;
    user.signupNonceHash = hash;
    user.campus = campus._id;
    user.hostel = hostelPlace?.name ?? "";
    user.location = toPoint(hostelPlace?.location ?? campus.location);
    await user.save();
    setSignupCookie(res, nonce);

    const resendIn = await sendOtpIfAllowed({ email, name, purpose: OTP_PURPOSE.VERIFY_EMAIL });

    return res.status(201).json({
        success: true,
        message: `We sent a 6-digit code to ${email}`,
        email,
        campus: campus.name,
        resendIn
    });
};

export const verifyEmail = async (req, res) => {
    const { email, otp } = req.body;

    const user = await User.findOne({ email }).select("+signupNonceHash");

    if (!user) {
        throw new ApiError(404, "No account found for this email. Sign up first.");
    }
    if (user.isVerified) throw alreadyVerifiedError();

    // Only the browser that set the current password may verify (see newSignupNonce). Checked before the
    // code, so nobody else can use up its attempts.
    const nonce = readSignupCookie(req);
    if (typeof nonce !== "string" || sha256(nonce) !== user.signupNonceHash) throw signupRestartedError();

    await consumeOtp(email, OTP_PURPOSE.VERIFY_EMAIL, otp);

    // One conditional update: a sign-up that lands while the code is being checked replaces the hash
    // (and the password), so then nothing matches.
    const verified = await User.findOneAndUpdate(
        { _id: user._id, isVerified: false, signupNonceHash: user.signupNonceHash },
        { $set: { isVerified: true, lastLoginAt: new Date() }, $unset: { signupNonceHash: 1 } },
        { returnDocument: "after" }
    );
    if (!verified) {
        throw (await User.exists({ _id: user._id, isVerified: true })) ? alreadyVerifiedError() : signupRestartedError();
    }

    clearSignupCookie(res);
    return sendSession(res, verified, `Email verified — welcome to CampusSwap, ${firstName(verified.name)}!`);
};

// Same answer whether or not an account is waiting for this code, like forgotPassword: one body with a
// fixed resendIn, and the email itself goes out in the background. Demo accounts can't be reset.
export const resendOtp = async (req, res) => {
    const { email, purpose } = req.body;

    const user = await User.findOne({ email });
    const verifying = purpose === OTP_PURPOSE.VERIFY_EMAIL;
    const waiting = verifying ? user && !user.isVerified : user?.isVerified && !user.isBanned && !user.isDemo;

    if (waiting) await sendOtpIfAllowed({ email, name: user.name, purpose, background: true });

    return res.json({
        success: true,
        message: verifying
            ? `If ${email} is waiting to be verified, a new code is on its way`
            : `If ${email} has an account, a new code is on its way`,
        resendIn: OTP_RESEND_COOLDOWN_SECONDS
    });
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    const isPasswordCorrect = await bcrypt.compare(password, user?.password ?? DUMMY_PASSWORD_HASH);

    if (!user || !isPasswordCorrect) {
        throw new ApiError(401, "Incorrect email or password");
    }

    if (user.isBanned) {
        throw new ApiError(403, "Your account has been suspended.", { code: "ACCOUNT_BANNED" });
    }

    if (!user.isVerified) {
        // The password was just proven, so this browser may finish verifying: it gets a new sign-up nonce.
        // The update only matches while the password is still the one checked above (a sign-up landing
        // in between replaces it, and then this browser gets no nonce).
        const { nonce, hash } = newSignupNonce();
        const { matchedCount } = await User.updateOne({ _id: user._id, password: user.password }, { $set: { signupNonceHash: hash } });
        if (matchedCount > 0) setSignupCookie(res, nonce);

        // A fresh code takes from this network's daily email allowance, like a resend would.
        const allowed = await takeMailAllowance(req);
        const resendIn = allowed ? await sendOtpIfAllowed({ email, name: user.name, purpose: OTP_PURPOSE.VERIFY_EMAIL }) : 0;
        // The sign-up cookie set above survives this error: the error middleware doesn't reset headers.
        throw new ApiError(403, allowed ? "Verify your email first — we sent you a code" : "Verify your email first", {
            code: "EMAIL_NOT_VERIFIED",
            email,
            resendIn
        });
    }

    user.lastLoginAt = new Date();
    await user.save();

    return sendSession(res, user, `Welcome back, ${firstName(user.name)}!`);
};

export const logout = (req, res) => {
    // Other tabs of this browser would keep their live connection, and keep receiving chats, after the
    // cookie is gone. Once this response is out, the user's sockets are closed: those tabs reconnect, can't
    // get a socket token without the cookie and are logged out by the HTTP interceptor. Other devices
    // simply reconnect with their own session cookie.
    const userId = readSessionUserId(req);
    if (userId) res.once("finish", () => disconnectUser(userId));

    clearAuthCookie(res);
    return res.json({ success: true, message: "Logged out" });
};

export const getMe = async (req, res) => {
    await req.user.populate("campus", CAMPUS_PUBLIC_FIELDS);
    return res.json({ success: true, user: req.user });
};

// A 2-minute token for opening the real-time connection (see utils/socketToken.js).
export const getSocketToken = (req, res) => {
    res.set("Cache-Control", "no-store");
    return res.json({ success: true, token: signSocketToken(req.user._id) });
};

export const forgotPassword = async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    // Same answer whether or not the account exists: one body with a fixed resendIn (the seconds left of
    // a cooldown would only exist for real accounts), and the email goes out in the background, so a slow
    // send or an email error can't give it away either. (Signing up still says when an email is taken:
    // a deliberate trade-off for a clear sign-up form.)
    if (user?.isVerified && !user.isBanned) {
        await sendOtpIfAllowed({ email, name: user.name, purpose: OTP_PURPOSE.RESET_PASSWORD, background: true });
    }

    return res.json({
        success: true,
        message: `If ${email} has an account, we've sent a reset code`,
        email,
        resendIn: OTP_RESEND_COOLDOWN_SECONDS
    });
};

export const resetPassword = async (req, res) => {
    const { email, otp, password } = req.body;

    const user = await User.findOne({ email });

    if (!user?.isVerified || user.isBanned) {
        throw new ApiError(400, "This code is no longer valid. Request a new one.", {
            code: "OTP_EXPIRED",
            errors: { otp: "Code no longer valid — request a new one" }
        });
    }

    await consumeOtp(email, OTP_PURPOSE.RESET_PASSWORD, otp);

    // The pre-save hook hashes it and records passwordChangedAt, which logs out other devices.
    user.password = password;
    user.lastLoginAt = new Date();
    await user.save();

    // Open tabs elsewhere drop their live connection; they can't get a new socket token with the old session.
    res.once("finish", () => disconnectUser(user._id));
    return sendSession(res, user, "Password updated — you're logged in");
};
