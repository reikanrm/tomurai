import test from 'node:test';
import assert from 'node:assert/strict';
import { isInvitationEntry } from '../apps/mobile/src/domain/entry-link.ts';

test('invitation startup recognizes native host and web path, without granting access', () => {
  assert.equal(isInvitationEntry('tomurai://invite/token'), true);
  assert.equal(isInvitationEntry('https://example.com/invite/token'), true);
  assert.equal(isInvitationEntry('http://localhost:8081/preview/invite/token'), true);
  for (const url of ['broken', '', 'tomurai://home/invited', 'https://example.com/not-invite/token', 'https://example.com/?invite=token', 'javascript:invite/token']) {
    assert.equal(isInvitationEntry(url), false, url);
  }
});
