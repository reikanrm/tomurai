import assert from 'node:assert/strict';
import test from 'node:test';
import { googleMapsSearchUrl } from '../apps/mobile/src/domain/maps.ts';

test('Maps preserves category searches without case or location parameters', () => {
  for (const category of ['弁護士 司法書士 相続', '税理士 相続', 'グリーフケア カウンセリング', '遺品整理']) {
    const url = new URL(googleMapsSearchUrl(category));
    assert.equal(url.origin, 'https://www.google.com');
    assert.equal(url.pathname, '/maps/search/');
    assert.deepEqual([...url.searchParams], [['api', '1'], ['query', category]]);
  }
});

test('search text cannot introduce additional URL parameters', () => {
  const category = 'test &query=another#section';
  const url = new URL(googleMapsSearchUrl(category));
  assert.equal(url.searchParams.get('query'), category);
  assert.equal(url.searchParams.size, 2);
  assert.equal(url.hash, '');
});
