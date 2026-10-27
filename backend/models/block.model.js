import mongoose from "mongoose";

// `blocker` blocked `blocked`. Blocks work both ways: neither can message the other, make offers or
// plan meetups, and neither sees the other's listings in lists (utils/blocks.js).
const blockSchema = new mongoose.Schema(
    {
        blocker: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        blocked: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    { timestamps: true }
);

// Makes blocking idempotent (blocking twice can't create two rows) and serves "who did I block?".
blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });
// The other direction: "who blocked me?".
blockSchema.index({ blocked: 1, blocker: 1 });

const Block = mongoose.model("Block", blockSchema);

export default Block;
