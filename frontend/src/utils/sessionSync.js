// Every tab of the app shares one session cookie, but each keeps its own copy of who is logged in.
// When one tab logs in or out it says so here, and tabs that now show the wrong person reload
// (main.jsx). The timestamp makes every announcement a change, so even a repeat reaches the others
// (the browser only fires "storage" events in the other tabs, and only when the value changes).

const KEY = "campusswap:session";

// `userId`: who is logged in now, or null after a logout.
export const announceSession = (userId) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ userId: userId ?? null, at: Date.now() }));
  } catch {
    // Storage is blocked (private mode): other tabs catch up on their next request instead.
  }
};

export const onSessionAnnounced = (handler) =>
  window.addEventListener("storage", (event) => {
    if (event.key !== KEY || !event.newValue) return;
    try {
      handler(JSON.parse(event.newValue).userId ?? null);
    } catch {
      // Not ours, or not JSON: ignore it.
    }
  });
