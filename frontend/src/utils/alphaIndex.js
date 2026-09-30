/** Must match backend services/lists/customerDirectory.js letterOf. */
export const letterOf = (name) => {
  const ch = String(name || "").trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(ch) ? ch : "#";
};

export const groupByLetter = (rows) => {
  const groups = [];
  for (const row of rows) {
    const letter = letterOf(row.name);
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) last.rows.push(row);
    else groups.push({ letter, rows: [row] });
  }
  return groups;
};

export const initials = (name) => {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  return words.length ? words.slice(0, 2).map((w) => w[0].toUpperCase()).join("") : "?";
};
