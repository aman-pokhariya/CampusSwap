// Swap Circles (two or three students swapping items in a loop) arrive in Chunk 5. Listing changes
// already call this hook, so proposed circles holding a listing that stops being available get
// expired here once circles exist. Returns how many circles were expired.
export const expireListingCircles = async (listingId, { keepCircleId, reason } = {}) => 0;

// Called whenever a deal that belongs to a circle is completed. Once circles exist, the circle is
// marked completed (and its members told) when every one of its deals is done.
export const checkSwapCircleCompletion = async (circleId) => {};

// Called when a deal that belongs to a circle is cancelled. Once circles exist, this cancels the
// circle's other open deals, releases their listings and tells the members why (`reason`).
export const cancelSwapCircle = async (circleId, reason) => {};
