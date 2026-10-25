import Campus from "../models/campus.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import { toPoint } from "../models/schemas/point.schema.js";
import { setAuthCookie } from "../utils/authCookie.js";
import { CAMPUS_PUBLIC_FIELDS } from "../config/constants.js";

export const updateProfile = async (req, res) => {
    const { name, bio, hostel } = req.body;
    const user = req.user;

    if (name !== undefined) user.name = name;
    if (bio !== undefined) user.bio = bio;

    if (hostel !== undefined) {
        const campus = await Campus.findById(user.campus);

        if (hostel === "") {
            user.hostel = "";
            user.location = toPoint(campus.location);
        } else {
            const hostelPlace = campus.hostels.find((h) => h.name === hostel);
            if (!hostelPlace) {
                throw new ApiError(400, "Pick a hostel from the list", { errors: { hostel: "Unknown hostel for this campus" } });
            }
            user.hostel = hostelPlace.name;
            user.location = toPoint(hostelPlace.location);
        }
    }

    await user.save();
    await user.populate("campus", CAMPUS_PUBLIC_FIELDS);

    return res.json({ success: true, message: "Profile updated", user });
};

export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");

    if (!(await user.comparePassword(currentPassword))) {
        throw new ApiError(400, "Current password is incorrect", {
            errors: { currentPassword: "Current password is incorrect" }
        });
    }

    if (await user.comparePassword(newPassword)) {
        throw new ApiError(400, "New password must be different", {
            errors: { newPassword: "Choose a password you haven't used here" }
        });
    }

    user.password = newPassword;
    await user.save();

    // Saving set passwordChangedAt, which signs out every other device. Re-issue this device's cookie.
    setAuthCookie(res, user._id);

    return res.json({ success: true, message: "Password changed. Other devices have been logged out." });
};
