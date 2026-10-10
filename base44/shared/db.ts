/**
 * The Base44 implementation of the data adapter (R-08). This file and the
 * function entry points are the only server code that touches the platform;
 * shared business rules import neither the SDK nor the runtime.
 */

import { secrets } from 'base44:runtime';
import { makeDb } from './dbCore.ts';

export const readSecret = (name) => {
  try {
    return secrets.get(name) || '';
  } catch {
    return '';
  }
};

/**
 * `base44` is the request client from createClientFromRequest. Reads and writes
 * go through the service role, as the guarded functions do today; `invoke`
 * keeps the user's own client so the called function checks their permission.
 */
export function createDb(base44, { asUser = false } = {}) {
  const scoped = asUser ? base44 : base44.asServiceRole;
  return makeDb({
    entities: scoped.entities,
    functions: base44.functions,
    integrations: base44.asServiceRole?.integrations || base44.integrations,
    auth: base44.auth,
    readSecret,
  });
}
