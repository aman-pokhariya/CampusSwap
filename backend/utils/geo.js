// The radius MongoDB's $geoNear measures with (6378.1 km). Using the same one here means a listing shows
// exactly the same distance on every list and page, whichever of the two worked it out.
const EARTH_RADIUS_METERS = 6378100;
const toRadians = (degrees) => (degrees * Math.PI) / 180;

// Straight-line distance in metres between two GeoJSON points (haversine formula).
// "Nearest" and the distance filter get distances from MongoDB's $geoNear; every other list uses this.
export const distanceMeters = (from, to) => {
    if (!from?.coordinates || !to?.coordinates) return null;

    const [lng1, lat1] = from.coordinates;
    const [lng2, lat2] = to.coordinates;
    const dLat = toRadians(lat2 - lat1);
    const dLng = toRadians(lng2 - lng1);

    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h)));
};
