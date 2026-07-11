import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeMigrationTarget } from '../../src/migration';

test('migration target guard rejects implicit targets', () => {
  assert.throws(() => assertSafeMigrationTarget({ projectId: '', databaseId: 'v2-dev' }), /projectId/);
  assert.throws(() => assertSafeMigrationTarget({ projectId: 'gemsprout-v2-dev' }), /databaseId or emulatorHost/);
});

test('migration target guard rejects production by default', () => {
  assert.throws(
    () => assertSafeMigrationTarget({ projectId: 'gemsprout1', databaseId: '(default)' }),
    /production project/,
  );
});

test('migration target guard allows explicit dev targets', () => {
  assert.doesNotThrow(() => assertSafeMigrationTarget({ projectId: 'gemsprout-v2-dev', databaseId: '(default)' }));
  assert.doesNotThrow(() => assertSafeMigrationTarget({ projectId: 'gemsprout1-v2-copy', emulatorHost: '127.0.0.1:8080' }));
});
