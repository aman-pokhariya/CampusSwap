import { useEffect, useRef } from "react";

// Put the returned ref on an element below a list: onLoadMore runs when it comes within 600px
// of the screen. `pageCount` re-arms the observer after each page, in case the sentinel is
// still visible (big screens), because IntersectionObserver only fires on changes.
export function useInfiniteScroll(onLoadMore, { enabled, pageCount }) {
  const sentinelRef = useRef(null);
  const callbackRef = useRef(onLoadMore);

  useEffect(() => {
    callbackRef.current = onLoadMore;
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !enabled) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) callbackRef.current();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, pageCount]);

  return sentinelRef;
}
