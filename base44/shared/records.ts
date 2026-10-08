/** Small record helpers shared by the write functions. */

export const actorName = (user) => user?.full_name || user?.email || 'Unknown user';

export const emptyToNull = (value) => (value === '' || value === undefined ? null : value);

export const getOne = async (entity, id) => {
  if (!id) return null;
  const res = await entity.filter({ id }, { limit: 1 });
  return (res?.items || res || [])[0] || null;
};

export const listAll = (res) => (Array.isArray(res) ? res : res?.items || []);

/** Copy only the fields the operation owns — never user-supplied system fields. */
export function pick(source, fields) {
  const out = {};
  fields.forEach((field) => {
    if (source && Object.prototype.hasOwnProperty.call(source, field)) out[field] = emptyToNull(source[field]);
  });
  return out;
}

/** Thrown errors carry the HTTP status the caller should see. */
export function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}