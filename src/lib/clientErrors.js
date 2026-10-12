import { data } from '@/api/data';

/**
 * Browser errors are written to the ClientError table (X-05) instead of going
 * to an outside vendor. Reporting must never itself throw or loop, so it is
 * rate-limited, de-duplicated and silent on failure.
 */
const MAX_PER_SESSION = 20;
const seen = new Set();
let sent = 0;
let context = { userId: '', userEmail: '', projectId: '' };

export const setErrorContext = (next) => {
  context = { ...context, ...next };
};

const clip = (value, max) => String(value || '').slice(0, max);

export async function reportClientError(error, { source = 'window', note = '' } = {}) {
  try {
    const message = clip(error?.message || error, 500);
    const key = `${source}|${message}`;
    if (!message || (seen.has(key) && !note) || sent >= MAX_PER_SESSION) return false;
    seen.add(key);
    sent += 1;
    await data.create('ClientError', {
      message,
      stack: clip(error?.stack, 4000),
      url: clip(typeof window !== 'undefined' ? window.location.href : '', 500),
      source,
      project_id: context.projectId,
      user_id: context.userId,
      user_email: context.userEmail,
      user_agent: clip(typeof navigator !== 'undefined' ? navigator.userAgent : '', 300),
      occurred_at: new Date().toISOString(),
      user_note: clip(note, 1000),
    });
    return true;
  } catch {
    return false;
  }
}

let installed = false;

/** Catch what the React boundary cannot: event handlers, timers and rejected promises. */
export function installGlobalErrorHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (event) => {
    if (event?.error || event?.message) reportClientError(event.error || event.message, { source: 'window' });
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportClientError(event?.reason || 'Unhandled promise rejection', { source: 'promise' });
  });
}

export const errorMessageOf = (error, fallback = 'Something went wrong.') =>
  error?.response?.data?.error || error?.data?.error || error?.message || fallback;
