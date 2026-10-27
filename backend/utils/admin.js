import mongoose from "mongoose";
import ApiError from "./ApiError.js";
import { idOf } from "./ids.js";
import { ADMIN_SCOPE, ROLES } from "../config/constants.js";

// Admins act on their own campus only, unless they were made global admins.
export const canAdminCampus = (user, campusId) =>
    user?.role === ROLES.ADMIN && (user.adminScope === ADMIN_SCOPE.GLOBAL || idOf(user.campus) === idOf(campusId));

// The campus part of an admin list's filter, from its ?campus= value: the admin's own campus when it's
// left out, a campus they manage, or every campus ("all", global admins only). An ObjectId, not a
// string, so the same filter also works in aggregate() pipelines.
export const adminCampusFilter = (admin, campus) => {
    if (campus === "all") {
        if (admin.adminScope !== ADMIN_SCOPE.GLOBAL) {
            throw new ApiError(403, "Only global admins can see every campus", { code: "GLOBAL_ADMIN_ONLY" });
        }
        return {};
    }

    const campusId = campus ?? idOf(admin.campus);
    if (!canAdminCampus(admin, campusId)) throw new ApiError(403, "You can only manage your own campus", { code: "OTHER_CAMPUS" });
    return { campus: new mongoose.Types.ObjectId(campusId) };
};

// What a demo admin sees instead of an email: "ri•••@campusswap.dev" tells accounts apart, but nobody
// using the shared demo login can collect real addresses with it.
export const maskEmail = (email = "") => {
    const [name, domain] = email.split("@");
    return `${name.slice(0, Math.min(2, name.length - 1))}•••@${domain}`;
};
