const rupeeFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export const formatRupees = (amount) => rupeeFormatter.format(amount);

// What the price line says for each listing type.
export const formatPrice = ({ type, price, rentPeriod }) => {
  switch (type) {
    case "free":
      return "Free";
    case "rent":
      return `${formatRupees(price)}/${rentPeriod}`;
    case "swap":
      return price ? `Swap · or ${formatRupees(price)}` : "Swap";
    case "wanted":
      return price ? `Budget ${formatRupees(price)}` : "Wanted";
    default:
      return formatRupees(price);
  }
};

// What "sold" is called for each type: a rented item isn't sold, a free one is given away.
export const soldLabel = (type, rentedUntil) => {
  switch (type) {
    case "rent":
      return rentedUntil
        ? `Rented until ${new Date(rentedUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
        : "Rented";
    case "free":
      return "Given away";
    case "swap":
      return "Swapped";
    case "wanted":
      return "Found";
    default:
      return "Sold";
  }
};

export const formatDistance = (meters) => {
  if (meters == null) return "";
  if (meters < 60) return "Nearby";
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

// "Alpha Hostel · 320 m", or "Your hostel" when it's where you live.
export const formatLocation = (listing, viewerHostel) => {
  if (viewerHostel && listing.hostel === viewerHostel) return "Your hostel";
  const place = listing.hostel || "On campus";
  const distance = formatDistance(listing.distance);
  return distance ? `${place} · ${distance}` : place;
};

export const timeAgo = (date) => {
  const seconds = (Date.now() - new Date(date).getTime()) / 1000;
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export const formatMonthYear = (date) =>
  new Date(date).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

const meetupFormatter = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

// A meetup's day and time: "Tue, 5 Nov, 5:30 pm".
export const formatMeetupTime = (date) => meetupFormatter.format(new Date(date));

export const formatBytes = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
