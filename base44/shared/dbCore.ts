/**
 * The portability seam (R-08), server side: one small data interface that every
 * new function uses instead of calling the platform SDK directly.
 *
 *   get, list, readAll, count, create, update, upsertByKey, invoke,
 *   uploadPrivate, signedUrl, currentUser, llm
 *
 * This core takes the platform pieces as arguments and imports nothing from a
 * platform, so it can be tested and its interface re-implemented on supabase-js
 * at the planned move. db.ts wires it to Base44.
 */

import { chooseProvider, makeProvider } from './aiProvider.ts';

const listOf = (res) => (Array.isArray(res) ? res : res?.items || []);

/** Rows per page when following cursors; Base44 accepts up to 5,000. */
export const READ_PAGE = 5000;

export function makeDb({ entities, functions, integrations, auth, readSecret = () => '' }) {
  const entity = (name) => {
    const target = entities?.[name];
    if (!target) throw new Error(`Unknown entity ${name}.`);
    return target;
  };

  const db = {
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
      return (await db.readAll(name, filter, { fields: ['id'] })).items.length;
    },

    create: (name, data) => entity(name).create(data),

    update: (name, id, data) => entity(name).update(id, data),

    /**
     * Create or update the one row identified by `keys` (field names). Portable:
     * on Postgres it becomes insert ... on conflict (keys) do update.
     */
    async upsertByKey(name, keys, data) {
      const filter = Object.fromEntries(keys.map((key) => [key, data[key]]));
      const existing = listOf(await entity(name).filter(filter, { limit: 1 }))[0];
      return existing ? entity(name).update(existing.id, data) : entity(name).create(data);
    },

    async invoke(fn, payload) {
      const res = await functions.invoke(fn, payload);
      return res?.data ?? res;
    },

    async uploadPrivate(file) {
      const res = await integrations.Core.UploadPrivateFile({ file });
      return res?.file_uri || '';
    },

    async signedUrl(fileUri, expiresIn = 300) {
      const res = await integrations.Core.CreateFileSignedUrl({ file_uri: fileUri, expires_in: expiresIn });
      return res?.signed_url || '';
    },

    currentUser: () => auth.me(),

    /** The model provider for these AI settings (see aiProvider.ts), or null. */
    llm(settings = {}) {
      const keys = {
        AI_API_KEY: readSecret('AI_API_KEY'),
        ANTHROPIC_API_KEY: readSecret('ANTHROPIC_API_KEY'),
        OPENAI_API_KEY: readSecret('OPENAI_API_KEY'),
      };
      const invokeLLM = integrations?.Core?.InvokeLLM ? (args) => integrations.Core.InvokeLLM(args) : null;
      return makeProvider(chooseProvider(settings, keys, { invokeAvailable: !!invokeLLM }), { invokeLLM });
    },
  };
  return db;
}
