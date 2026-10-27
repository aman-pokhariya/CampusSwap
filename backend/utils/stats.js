// Daily per-listing counters (views, saves, chats, offers) for the seller dashboard are stored from
// Chunk 6. Callers already report their events here. `listing` is a listing document or its id,
// `field` one of "views", "saves", "chats", "offers". It must never throw or slow a request down.
export const bumpStat = async (listing, field) => {};
