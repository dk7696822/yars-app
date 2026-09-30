const STALE = Symbol("stale");

/** Wrap promises so only the most recent call's result is used (period switching). */
export const latestOnly = () => {
  let seq = 0;
  return (promise) => {
    const mine = ++seq;
    return promise.then(
      (v) => (mine === seq ? v : STALE),
      (err) => {
        if (mine === seq) throw err;
        return STALE; // an overtaken request's failure must not show an error over newer data
      }
    );
  };
};
latestOnly.STALE = STALE;
