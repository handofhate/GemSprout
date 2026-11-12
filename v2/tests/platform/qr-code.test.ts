import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFamilyCodeQrPayload } from '../../src/platform/qr-code';

test('family QR payload accepts a six-character code and rejects unrelated QR contents', () => {
  assert.equal(normalizeFamilyCodeQrPayload('collum'), 'COLLUM');
  assert.equal(normalizeFamilyCodeQrPayload('ABC123'), 'ABC123');
  assert.equal(normalizeFamilyCodeQrPayload('https://example.com/COLLUM'), null);
  assert.equal(normalizeFamilyCodeQrPayload('12345'), null);
  assert.equal(normalizeFamilyCodeQrPayload('ABC1234'), null);
});
