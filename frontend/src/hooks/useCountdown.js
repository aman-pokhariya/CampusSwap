import { useEffect, useState } from "react";

// const [secondsLeft, restart] = useCountdown(60)
// Counts against a fixed end time, so a slow or backgrounded tab never drifts.
export function useCountdown(initialSeconds = 0) {
  const [endsAt, setEndsAt] = useState(() => Date.now() + initialSeconds * 1000);
  const [now, setNow] = useState(() => Date.now());

  const secondsLeft = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const running = secondsLeft > 0;

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running, endsAt]);

  const restart = (seconds) => {
    const current = Date.now();
    setEndsAt(current + seconds * 1000);
    setNow(current);
  };

  return [secondsLeft, restart];
}

export const formatSeconds = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
