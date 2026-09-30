import { useEffect, useState } from "react";

/** The value, once it has stopped changing for `ms` — for search boxes. */
export default function useDebounced(value, ms = 250) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
