import mongoose from "mongoose";

// GeoJSON Point. MongoDB stores coordinates as [longitude, latitude] (longitude first!).
// Used by campuses, hostels, safe spots, users and (from Chunk 2) listings for "near me" queries.
const pointSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["Point"],
            default: "Point"
        },
        coordinates: {
            type: [Number],
            required: true,
            validate: {
                validator: ([lng, lat] = []) =>
                    Number.isFinite(lng) && Number.isFinite(lat) &&
                    lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90,
                message: "Coordinates must be [longitude, latitude]"
            }
        }
    },
    { _id: false }
);

// Copies a point so one document's location can be reused safely in another.
export const toPoint = (point) => ({ type: "Point", coordinates: [...point.coordinates] });

export default pointSchema;
