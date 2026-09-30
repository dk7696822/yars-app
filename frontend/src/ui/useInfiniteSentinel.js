import { useEffect, useRef } from "react";

/** Put the returned ref on an element after the list; the next page loads as it nears the screen. */
export default function useInfiniteSentinel({ hasNextPage, isFetchingNextPage, fetchNextPage }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasNextPage) return undefined;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
    }, { rootMargin: "400px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  return ref;
}
