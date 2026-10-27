import { useEffect, useState } from "react";

// The current time, refreshed every `intervalMs`, for labels like "Last seen 5m ago" or "3h left".
// Pass null when nothing on screen depends on the time (no timer runs then).
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!intervalMs) return undefined;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
