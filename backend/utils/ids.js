import mongoose from "mongoose";

// A ref can be an ObjectId or, after populate(), a whole document. These work with both.
export const idOf = (ref) => (ref?._id ?? ref)?.toString();

export const sameId = (a, b) => a != null && b != null && idOf(a) === idOf(b);

// populate() leaves null when the document is gone. (Checking `ref._id` isn't enough: Mongoose
// gives plain ObjectIds an `_id` too.)
export const isPopulated = (ref) => ref != null && !(ref instanceof mongoose.Types.ObjectId);
