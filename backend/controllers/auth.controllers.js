import bcrypt from "bcrypt";
import User from "../models/user.model.js";
import Campus from "../models/campus.model.js";
import ApiError from "../utils/ApiError.js";
import { toPoint } from "../models/schemas/point.schema.js";
import { clearAuthCookie, setAuthCookie } from "../utils/authCookie.js";
import { consumeOtp, sendOtp, sendOtpIfAllowed } from "../utils/otp.js";
import { CAMPUS_PUBLIC_FIELDS, OTP_PURPOSE } from "../config/constants.js";

// Login compares against this when the email doesn't exist, so a wrong email takes as long
// as a wrong password and response times don't reveal who has an account.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("campusswap-timing-guard", 12);

const firstName = (name) => name.split(" ")[0];

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
    if (!user) user = new User({ email });

    user.name = name;
    user.password = password;
    user.campus = campus._id;
    user.hostel = hostelPlace?.name ?? "";
    user.location = toPoint(hostelPlace?.location ?? campus.location);
    await user.save();

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

    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "No account found for this email. Sign up first.");
    }
    if (user.isVerified) {
        throw new ApiError(400, "This email is already verified. Log in instead.", { code: "ALREADY_VERIFIED" });
    }

    await consumeOtp(email, OTP_PURPOSE.VERIFY_EMAIL, otp);

    user.isVerified = true;
    user.lastLoginAt = new Date();
    await user.save();

    return sendSession(res, user, `Email verified — welcome to CampusSwap, ${firstName(user.name)}!`);
};

export const resendOtp = async (req, res) => {
    const { email, purpose } = req.body;

    const user = await User.findOne({ email });

    if (purpose === OTP_PURPOSE.VERIFY_EMAIL) {
        if (!user) throw new ApiError(404, "No account found for this email. Sign up first.");
        if (user.isVerified) {
            throw new ApiError(400, "This email is already verified. Log in instead.", { code: "ALREADY_VERIFIED" });
        }
        const resendIn = await sendOtp({ email, name: user.name, purpose });
        return res.json({ success: true, message: `New code sent to ${email}`, resendIn });
    }

    // Password reset: answer the same way whether or not the account exists,
    // so this endpoint can't be used to find out who is registered.
    let resendIn;
    if (user?.isVerified && !user.isBanned) {
        resendIn = await sendOtp({ email, name: user.name, purpose });
    }
    return res.json({ success: true, message: `If ${email} has an account, a new code is on its way`, resendIn });
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
        const resendIn = await sendOtpIfAllowed({ email, name: user.name, purpose: OTP_PURPOSE.VERIFY_EMAIL });
        throw new ApiError(403, "Verify your email first — we sent you a code", {
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
    clearAuthCookie(res);
    return res.json({ success: true, message: "Logged out" });
};

export const getMe = async (req, res) => {
    await req.user.populate("campus", CAMPUS_PUBLIC_FIELDS);
    return res.json({ success: true, user: req.user });
};

export const forgotPassword = async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    // Same response whether or not the account exists (see resendOtp).
    let resendIn;
    if (user?.isVerified && !user.isBanned) {
        resendIn = await sendOtpIfAllowed({ email, name: user.name, purpose: OTP_PURPOSE.RESET_PASSWORD });
    }

    return res.json({
        success: true,
        message: `If ${email} has an account, we've sent a reset code`,
        email,
        resendIn
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

    return sendSession(res, user, "Password updated — you're logged in");
};
