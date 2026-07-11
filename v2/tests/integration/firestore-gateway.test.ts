import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeFirestoreGateway, type FirestoreGateway } from '../../src/platform/firebase';

function exerciseGateway(gateway: FirestoreGateway): void {
  gateway.set('families/family_1/members/kid_1', { id: 'kid_1', gems: 10 });
  assert.equal(gateway.get<{ gems: number }>('families/family_1/members/kid_1')?.gems, 10);

  gateway.applyWrites([
    {
      path: 'families/family_1/members/kid_1',
      op: 'set',
      data: { diamonds: 10 },
      merge: true,
      reason: 'contract test merge',
    },
  ]);
  assert.deepEqual(gateway.get('families/family_1/members/kid_1'), { id: 'kid_1', gems: 10, diamonds: 10 });

  const result = gateway.runTransaction(transaction => {
    const current = transaction.get<{ gems: number }>('families/family_1/members/kid_1');
    transaction.set('families/family_1/members/kid_1', { gems: (current?.gems || 0) + 5 }, { merge: true });
    return 'committed';
  });

  assert.equal(result, 'committed');
  assert.equal(gateway.get<{ gems: number }>('families/family_1/members/kid_1')?.gems, 15);
}

test('fake Firestore gateway satisfies the gateway contract', () => {
  exerciseGateway(new FakeFirestoreGateway());
});
