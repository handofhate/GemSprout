import test from 'node:test';
import assert from 'node:assert/strict';
import { CompatFirestoreGateway, type CompatFirestore } from '../../src/platform/firebase';

test('compat Firestore gateway exposes async transaction boundary', async () => {
  const writes: Array<{ path: string; data: unknown; options: unknown }> = [];
  const firestore: CompatFirestore = {
    doc(path: string) {
      return {
        async get() {
          return { exists: true, data: () => ({ id: path.split('/').at(-1), path }) };
        },
        async set(data: unknown, options?: unknown) {
          writes.push({ path, data, options });
        },
      };
    },
    async runTransaction(callback) {
      return callback({
        async get(ref) {
          return ref.get();
        },
        set(ref, data, options) {
          void ref.set(data, options);
          return this;
        },
      });
    },
  };

  const gateway = new CompatFirestoreGateway(firestore);
  const result = await gateway.runAsyncTransaction(transaction => {
    transaction.set('families/family_1/operations/op_1', { id: 'op_1' }, { merge: true });
    return 'ok';
  });

  assert.equal(result, 'ok');
  assert.deepEqual(writes, [
    {
      path: 'families/family_1/operations/op_1',
      data: { id: 'op_1' },
      options: { merge: true },
    },
  ]);
});
