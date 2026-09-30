const KEY = "yars_recent_inventory_items";

/** Item ids used most recently on this device, newest first. Storage may be unavailable. */
export const recentItemIds = () => {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
};

export const rememberItems = (ids) => {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set([...ids, ...recentItemIds()])].slice(0, 8)));
  } catch {
    /* a convenience only */
  }
};
