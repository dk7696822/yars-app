"use strict";

class QuotaExhaustedError extends Error {
  constructor(retryAfterSeconds) {
    super("All assistant models are resting after their free limits");
    this.name = "QuotaExhaustedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

class NoModelError extends Error {
  constructor() {
    super("No assistant model could answer");
    this.name = "NoModelError";
  }
}

const formatWait = (seconds) => {
  if (seconds < 90) return "a minute";
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} minutes`;
  const hours = Math.ceil(seconds / 3600);
  return hours === 1 ? "an hour" : `${hours} hours`;
};

/**
 * Failover over (provider, model) entries, best first. Before the first chunk,
 * a short per-minute limit is waited out once on the same model; any other
 * failure rests that entry for the provider's cooldown and tries the next.
 * After the first chunk, errors propagate — replaying a half-streamed answer
 * on another model would duplicate it.
 */
const createChain = (entries, { now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), log = console.warn } = {}) => {
  const restUntil = entries.map(() => 0);

  async function* stream(request) {
    let soonest = Infinity;
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      if (restUntil[i] > now()) {
        soonest = Math.min(soonest, restUntil[i]);
        continue;
      }

      let opened = null;
      for (let attempt = 0; attempt < 2 && !opened; attempt += 1) {
        const iterator = entry.provider.stream({ ...request, model: entry.model, options: entry.options })[Symbol.asyncIterator]();
        try {
          opened = { iterator, first: await iterator.next() };
        } catch (err) {
          const { cooldownS, waitable } = entry.provider.classify(err);
          if (waitable && attempt === 0) {
            await sleep(cooldownS * 1000);
            continue;
          }
          if (cooldownS > 0) {
            restUntil[i] = now() + cooldownS * 1000;
            soonest = Math.min(soonest, restUntil[i]);
          }
          log(`assistant: ${entry.label} skipped (${err.status || err.message}); resting ${cooldownS}s`);
          break;
        }
      }
      if (!opened) continue;

      if (!opened.first.done) yield opened.first.value;
      for (;;) {
        const next = await opened.iterator.next();
        if (next.done) return;
        yield next.value;
      }
    }
    if (soonest === Infinity) throw new NoModelError();
    throw new QuotaExhaustedError(Math.max(Math.ceil((soonest - now()) / 1000), 30));
  }

  return { stream };
};

module.exports = { createChain, QuotaExhaustedError, NoModelError, formatWait };
