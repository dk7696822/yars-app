"use strict";

class QuotaExhaustedError extends Error {
  constructor(retryAfterSeconds) {
    super("All assistant models are quota-exhausted");
    this.name = "QuotaExhaustedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const formatWait = (seconds) => {
  if (seconds < 90) return "a minute";
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} minutes`;
  const hours = Math.ceil(seconds / 3600);
  return hours === 1 ? "an hour" : `${hours} hours`;
};

// Floor on per-entry cooldowns. Providers sometimes report tiny retry delays
// (Google: "retryDelay: 37s") for quotas that are actually exhausted for the
// day — without a floor we would burn a failing request on every message.
const MIN_COOLDOWN_S = 120;

/**
 * Chain of responsibility over (provider, model) entries.
 *
 * Walks the entries in order, skipping any still cooling down from an earlier
 * quota error. A quota error at request time (or on the first chunk) cools
 * that entry down and moves to the next; a mid-stream failure after the first
 * chunk propagates — silently replaying a half-streamed answer on another
 * model would duplicate output. Non-quota errors always propagate.
 *
 * @param {Array<{label: string, provider: object, model: string}>} entries
 * @param {{now?: () => number}} opts - injectable clock for tests
 */
const createChain = (entries, { now = Date.now } = {}) => {
  const cooldownUntil = entries.map(() => 0);

  async function* stream(request) {
    let soonest = Infinity;

    for (let i = 0; i < entries.length; i += 1) {
      const { label, provider, model } = entries[i];
      if (cooldownUntil[i] > now()) {
        soonest = Math.min(soonest, cooldownUntil[i]);
        continue;
      }

      const iterator = provider.stream({ ...request, model })[Symbol.asyncIterator]();
      let first;
      try {
        // Quota errors surface at request time / on the first read.
        first = await iterator.next();
      } catch (err) {
        if (!provider.isQuotaError(err)) throw err;
        const retry = Math.max(provider.parseRetryAfter(err), MIN_COOLDOWN_S);
        cooldownUntil[i] = now() + retry * 1000;
        soonest = Math.min(soonest, cooldownUntil[i]);
        console.warn(`assistant: ${label} quota-exhausted, cooling down ${retry}s`);
        continue;
      }

      if (!first.done) yield first.value;
      while (true) {
        const next = await iterator.next();
        if (next.done) return;
        yield next.value;
      }
      return;
    }

    const retryAfterSeconds =
      soonest === Infinity ? MIN_COOLDOWN_S : Math.max(Math.ceil((soonest - now()) / 1000), 30);
    throw new QuotaExhaustedError(retryAfterSeconds);
  }

  return { stream };
};

module.exports = { createChain, QuotaExhaustedError, formatWait, MIN_COOLDOWN_S };
