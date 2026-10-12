/**
 * One JSON line per server call: { fn, ms, status, error } (X-05). It goes to the
 * Base44 app logs today and to Supabase function logs after the move, so a
 * failing call can be found without an outside tool.
 */
export const logLine = (entry) => {
  try {
    console.log(JSON.stringify(entry));
  } catch {
    // Logging must never break a call.
  }
};

export function withLog(fn, handler, { log = logLine, now = () => Date.now() } = {}) {
  return async function logged(req) {
    const started = now();
    try {
      const res = await handler(req);
      const status = res?.status || 200;
      let error = '';
      if (status >= 400 && typeof res?.clone === 'function') {
        error = String((await res.clone().json().catch(() => ({})))?.error || '').slice(0, 300);
      }
      log({ fn, ms: now() - started, status, ...(error ? { error } : {}) });
      return res;
    } catch (e) {
      log({ fn, ms: now() - started, status: e?.status || 500, error: String(e?.message || e).slice(0, 300) });
      throw e;
    }
  };
}
