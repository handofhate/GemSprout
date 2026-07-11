import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestoreGateway } from '../../src/platform/firebase';

test('fake store dumps can seed another gateway like a shared backing store', () => {
  const first = new FakeFirestoreGateway({
    'families/family_1/members/kid_1': { id: 'kid_1', gems: 50 },
  });
  first.set('families/family_1/members/kid_1', { gems: 57 }, { merge: true });

  const second = new FakeFirestoreGateway(first.dump());

  assert.deepEqual(second.get('families/family_1/members/kid_1'), { id: 'kid_1', gems: 57 });
});
