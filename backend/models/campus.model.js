import mongoose from "mongoose";
import pointSchema from "./schemas/point.schema.js";

// A named place on campus: a hostel, or a safe spot where buyers and sellers meet.
const placeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        default: ""
    },
    location: {
        type: pointSchema,
        required: true
    }
});

const campusSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        shortName: {
            type: String,
            required: true,
            trim: true
        },

        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        city: {
            type: String,
            required: true,
            trim: true
        },

        // Only emails from these domains (or their subdomains) can join this campus.
        emailDomains: [
            {
                type: String,
                lowercase: true,
                trim: true
            }
        ],

        location: {
            type: pointSchema,
            required: true
        },

        hostels: [placeSchema],
        safeSpots: [placeSchema],

        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

campusSchema.index({ emailDomains: 1 });

// "a@cse.iitd.ac.in" checks "cse.iitd.ac.in", then "iitd.ac.in", then "ac.in",
// so department subdomains still match their college.
campusSchema.statics.findByEmail = function (email) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) return null;

    const parts = domain.split(".");
    const candidates = parts.slice(0, -1).map((_, i) => parts.slice(i).join("."));

    return this.findOne({ emailDomains: { $in: candidates }, isActive: true });
};

const Campus = mongoose.model("Campus", campusSchema);

export default Campus;
