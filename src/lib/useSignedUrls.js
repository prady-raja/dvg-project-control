import { useEffect, useRef, useState } from 'react';
import { data } from '@/api/data';

const CONCURRENCY = 3;

/**
 * Pre-signed links for private files, signed a few at a time and kept by file
 * uri. Having the link ready before the tap lets a plain <a href> open it, which
 * iPhone browsers allow where window.open after an await is blocked.
 */
export function useSignedUrls(uris, { enabled = true, expiresIn = 3600 } = {}) {
  const [urls, setUrls] = useState({});
  const [failed, setFailed] = useState({});
  const asked = useRef(new Set());
  const key = (uris || []).join('|');

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const queue = (uris || []).filter((uri) => uri && !asked.current.has(uri));
    queue.forEach((uri) => asked.current.add(uri));
    const worker = async () => {
      while (alive && queue.length) {
        const uri = queue.shift();
        try {
          const url = await data.signedUrl(uri, expiresIn);
          if (alive && url) setUrls((prev) => ({ ...prev, [uri]: url }));
          else if (alive) setFailed((prev) => ({ ...prev, [uri]: true }));
        } catch {
          if (alive) setFailed((prev) => ({ ...prev, [uri]: true }));
        }
      }
    };
    Promise.all(Array.from({ length: CONCURRENCY }, worker));
    return () => {
      alive = false;
      // A cancelled run leaves its unsigned files to be asked for again.
      queue.forEach((uri) => asked.current.delete(uri));
    };
  }, [key, enabled, expiresIn]);

  return { urls, failed, signed: Object.keys(urls).length };
}
