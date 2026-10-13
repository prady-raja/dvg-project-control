/**
 * Photo captions and markup (F-05). A photo is a private storage reference; what a
 * person said about it, and where a marked-up copy came from, is kept beside the
 * list as two small maps keyed by that reference.
 */
const clean = (value, max) => String(value === null || value === undefined ? '' : value).trim().slice(0, max);

/** Only references that are on the record keep a caption or an original; everything is trimmed. */
export function cleanPhotoMeta(uris = [], captions = {}, originals = {}) {
  const keep = new Set(uris);
  const outCaptions = {};
  const outOriginals = {};
  Object.entries(captions && typeof captions === 'object' ? captions : {}).forEach(([uri, caption]) => {
    const text = clean(caption, 200);
    if (keep.has(uri) && text) outCaptions[uri] = text;
  });
  Object.entries(originals && typeof originals === 'object' ? originals : {}).forEach(([uri, original]) => {
    const ref = clean(original, 500);
    if (keep.has(uri) && ref && ref !== uri) outOriginals[uri] = ref;
  });
  return { photo_captions: outCaptions, photo_originals: outOriginals };
}
