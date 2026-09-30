/** A name as it should be saved: trimmed, single spaces. */
export const cleanName = (text) => String(text ?? "").trim().replace(/\s+/g, " ");
