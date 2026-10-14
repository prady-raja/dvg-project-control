/**
 * Retry with backoff for the import's writes.
 *
 * Base44 answers a burst of writes with 429 / "rate limit" / "too many requests".
 * A rate limit is waited out (1.5s, 3s, 6s, 12s) and the write is tried again; any
 * other error is raised at once. A bulk create is never repeated blindly: before
 * each retry the rows already stored are looked up, so a request that was partly
 * accepted cannot write the same row twice.
 */

export const RETRY_LIMIT = 4;
export const RETRY_BASE_MS = 1500;

export const isRateLimit = (error) =>
  /\b429\b|rate.?limit|too many requests/i.test(`${error?.status || ''} ${error?.statusCode || ''} ${error?.message || ''}`);

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** Run `fn`, retrying only on a rate limit. `sleep` is replaceable in tests. */
export async function withBackoff(fn, { retries = RETRY_LIMIT, baseMs = RETRY_BASE_MS, sleep = wait } = {}) {
  for (let tries = 0; ; tries += 1) {
    try {
      return await fn(tries);
    } catch (error) {
      if (!isRateLimit(error) || tries >= retries) throw error;
      await sleep(baseMs * 2 ** tries);
    }
  }
}

/**
 * Create `payloads` in one call, retrying a rate limit. `findStored(payloads)` returns
 * the records of this request that already exist (matched by `keyOf`); only the rest
 * are sent again. Returns every record: the stored ones and the newly created ones.
 */
export async function bulkCreateOnce({ create, findStored, payloads, keyOf, retryOptions }) {
  const stored = new Map();
  const created = await withBackoff(async (tries) => {
    if (tries > 0) {
      (await findStored(payloads)).forEach((record) => stored.set(keyOf(record), record));
    }
    const remaining = payloads.filter((payload) => !stored.has(keyOf(payload)));
    return remaining.length ? create(remaining) : [];
  }, retryOptions);
  const list = Array.isArray(created) ? created : (created?.items || created?.data || []);
  return [...stored.values(), ...list];
}
