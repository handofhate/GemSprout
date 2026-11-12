import assert from 'node:assert/strict';
import test from 'node:test';
import { requiresAppUpdate } from '../../src/platform/remote-config/build-policy';

test('minimum build of zero leaves app updates unrestricted', () => {
  assert.equal(requiresAppUpdate('1', 0), false);
});

test('builds below the minimum require an update', () => {
  assert.equal(requiresAppUpdate('41', 42), true);
});

test('minimum build itself remains supported', () => {
  assert.equal(requiresAppUpdate('42', 42), false);
});

test('invalid installed build data fails open', () => {
  assert.equal(requiresAppUpdate('unknown', 42), false);
});
