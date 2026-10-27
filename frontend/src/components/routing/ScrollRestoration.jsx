import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// Scroll position for each history entry, kept while the tab is open.
const positions = new Map();

// New pages start at the top. Going back (or forward) returns to where you were, so you can
// open a listing and come back to the same spot in the feed. Cached data renders instantly,
// which is what makes restoring the position possible.
export default function ScrollRestoration() {
  const { key } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    window.history.scrollRestoration = "manual";
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, navigationType === "POP" ? (positions.get(key) ?? 0) : 0);
  }, [key, navigationType]);

  useEffect(() => {
    const remember = () => positions.set(key, window.scrollY);
    window.addEventListener("scroll", remember, { passive: true });
    return () => window.removeEventListener("scroll", remember);
  }, [key]);

  return null;
}
