// "Add to calendar" for a confirmed meetup: an .ics file (RFC 5545) that every calendar app imports.

const MEETUP_MINUTES = 30;
const encoder = new TextEncoder();

// 20261105T120000Z: calendar times in UTC, so the event lands at the right hour in any time zone.
const icsTime = (date) => new Date(date).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Text values escape backslashes, commas, semicolons and line breaks.
const escapeText = (text = "") =>
  String(text).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Lines longer than 75 bytes continue on the next line after a space. Cut between characters, never
// inside one (titles can have emoji or Hindi).
const fold = (line) => {
  const parts = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // Continuation lines start with a space, which counts towards their 75.
    if (bytes + size > (parts.length === 0 ? 75 : 74)) {
      parts.push(current);
      current = "";
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
};

export const buildMeetupIcs = ({ dealId, title, spotName, at, otherName, url, now = new Date() }) => {
  const start = new Date(at);
  const end = new Date(start.getTime() + MEETUP_MINUTES * 60 * 1000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CampusSwap//Deals//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    // One id per planned meetup: a changed plan is a new event, never a silent edit of the old one.
    `UID:${dealId}-${icsTime(start)}@campusswap`,
    `DTSTAMP:${icsTime(now)}`,
    `DTSTART:${icsTime(start)}`,
    `DTEND:${icsTime(end)}`,
    `SUMMARY:${escapeText(`CampusSwap meetup: ${title}`)}`,
    `LOCATION:${escapeText(spotName)}`,
    `DESCRIPTION:${escapeText(
      `Meet ${otherName} for “${title}”.\nCheck the item before you pay, then confirm the handover with the code in the app:\n${url}`,
    )}`,
    `URL:${url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT30M",
    `DESCRIPTION:${escapeText(`Meetup with ${otherName} in 30 minutes`)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
};

// Saves the file through a temporary link (phones hand it to their calendar app).
export const downloadIcs = (ics, filename) => {
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
