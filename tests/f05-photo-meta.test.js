import { describe, expect, it } from 'vitest';
import { cleanPhotoMeta } from '../base44/shared/photoMeta.ts';

describe('photo captions and originals', () => {
  const uris = ['a', 'b'];
  it('keeps captions only for photos on the record, trimmed and capped', () => {
    const out = cleanPhotoMeta(uris, { a: '  Crack above the window ', z: 'ghost', b: '   ' }, {});
    expect(out.photo_captions).toEqual({ a: 'Crack above the window' });
    expect(cleanPhotoMeta(uris, { a: 'x'.repeat(500) }).photo_captions.a).toHaveLength(200);
  });
  it('a marked-up photo points at its original, never at itself', () => {
    const out = cleanPhotoMeta(uris, {}, { b: 'a', a: 'a', z: 'q' });
    expect(out.photo_originals).toEqual({ b: 'a' });
  });
  it('nonsense input gives empty maps', () => {
    expect(cleanPhotoMeta(uris, null, 'x')).toEqual({ photo_captions: {}, photo_originals: {} });
  });
});

import { photoMetaOf } from '@/lib/logUpdate';
describe('photoMetaOf (browser side)', () => {
  it('builds the caption and original maps from the photo list', () => {
    const meta = photoMetaOf([
      { file_uri: 'a', caption: ' crack ' },
      { file_uri: 'b', caption: '', original_uri: 'a0' },
      { file_uri: 'c', original_uri: 'c' },
    ]);
    expect(meta).toEqual({ photo_captions: { a: 'crack' }, photo_originals: { b: 'a0' } });
  });
});
