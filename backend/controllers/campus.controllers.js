import Campus from "../models/campus.model.js";
import ApiError from "../utils/ApiError.js";

// Public list used by the signup page to detect the campus from an email as you type.
export const listCampuses = async (req, res) => {
    const campuses = await Campus.find({ isActive: true })
        .select("name shortName slug city emailDomains hostels.name")
        .sort("name")
        .lean();

    res.set("Cache-Control", "public, max-age=300");
    return res.json({ success: true, campuses });
};

export const getCampus = async (req, res) => {
    const campus = await Campus.findOne({ slug: req.params.slug, isActive: true }).lean();

    if (!campus) {
        throw new ApiError(404, "Campus not found");
    }

    return res.json({ success: true, campus });
};
