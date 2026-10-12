import { base44 } from '@/api/base44Client';

/**
 * The portability seam (R-08), browser side. New code reads and writes through
 * this interface rather than the Base44 SDK, so the planned Supabase move swaps
 * this one file. Existing call sites move here when they are next touched.
 *
 *   get, list, readAll, count, create, update, upsertByKey, invoke,
 *   uploadPrivate, signedUrl, currentUser
 *
 * Model calls are server-side only (base44/shared/db.ts llm).
 */

const listOf = (res) => (Array.isArray(res) ? res : res?.items || []);

export const READ_PAGE = 5000;

/** Server functions report refusals as { error }; surface that text. */
const errorMessage = (error, fallback) =>
  error?.response?.data?.error ||
  error?.data?.error ||
  (typeof error?.message === 'string' && !error.message.includes('SDK Error') ? error.message : '') ||
  fallback;

export function makeData(client) {
  const entity = (name) => {
    const target = client.entities?.[name];
    if (!target) throw new Error(`Unknown entity ${name}.`);
    return target;
  };

  const data = {
    async get(name, id) {
      if (!id) return null;
      return listOf(await entity(name).filter({ id }, { limit: 1 }))[0] || null;
    },

    async list(name, filter = {}, { sort, fields, limit = 200 } = {}) {
      return listOf(await entity(name).filter(filter, { sort, fields, limit }));
    },

    /** Every matching row up to `max`, following cursors; says when it stopped short. */
    async readAll(name, filter = {}, { sort, fields, max = 20000, page = READ_PAGE } = {}) {
      const items = [];
      let cursor;
      while (items.length < max) {
        const res = await entity(name).filter(filter, { sort, fields, limit: Math.min(page, max - items.length), cursor });
        items.push(...listOf(res));
        cursor = res?.next_cursor;
        if (!res?.has_more || !cursor) return { items, truncated: false };
      }
      return { items, truncated: true };
    },

    async count(name, filter = {}) {
      const target = entity(name);
      if (typeof target.count === 'function') return target.count(filter);
      return (await data.readAll(name, filter, { fields: ['id'] })).items.length;
    },

    create: (name, values) => entity(name).create(values),

    update: (name, id, values) => entity(name).update(id, values),

    async upsertByKey(name, keys, values) {
      const filter = Object.fromEntries(keys.map((key) => [key, values[key]]));
      const existing = listOf(await entity(name).filter(filter, { limit: 1 }))[0];
      return existing ? entity(name).update(existing.id, values) : entity(name).create(values);
    },

    /** Calls a server function; throws an Error carrying the server's own message. */
    async invoke(fn, payload) {
      try {
        const res = await client.functions.invoke(fn, payload);
        return res?.data ?? {};
      } catch (error) {
        throw new Error(errorMessage(error, 'The action was refused.'));
      }
    },

    async uploadPrivate(file) {
      const res = await client.integrations.Core.UploadPrivateFile({ file });
      return res?.file_uri || '';
    },

    async signedUrl(fileUri, expiresIn = 300) {
      const res = await client.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: expiresIn });
      return res?.signed_url || '';
    },

    currentUser: () => client.auth.me(),
  };
  return data;
}

export const data = makeData(base44);
