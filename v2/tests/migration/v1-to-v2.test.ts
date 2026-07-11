import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateV1FamilySnapshot } from '../../src/migration';

test('v1 migration splits a broad family snapshot into v2 documents', () => {
  const result = migrateV1FamilySnapshot({
    setup: true,
    v: 3,
    settings: { savingsEnabled: true },
    family: {
      name: 'Test Family',
      members: [
        { id: 'parent_1', role: 'parent', name: 'Parent', authUid: 'uid_1', authProviders: [{ uid: 'uid_1', email: 'parent@example.com' }] },
        { id: 'kid_1', role: 'kid', name: 'Kid', gems: 12, savings: 4.5 },
      ],
    },
    chores: [
      {
        id: 'chore_1',
        title: 'Clean Room',
        points: 7,
        completions: {
          kid_1: [{ id: 'completion_1', status: 'pending', createdAt: 1000, date: '2026-07-08' }],
        },
      },
    ],
    prizes: [{ id: 'prize_1', title: 'Movie', cost: 10 }],
    prizeRequests: [{ id: 'prize_req_1', prizeId: 'prize_1', memberId: 'kid_1', status: 'pending', createdAt: 2000 }],
    savingsRequests: [{ id: 'sav_req_1', memberId: 'kid_1', status: 'pending', amount: 3.25, reason: 'Book fair', createdAt: 3000 }],
    history: [{ id: 'hist_1', type: 'chore', title: 'Clean Room', memberId: 'kid_1' }],
  }, { familyId: 'family_1', migratedAt: 4000 });

  assert.equal(result.summary.families, 1);
  assert.equal(result.summary.members, 2);
  assert.equal(result.summary.users, 1);
  assert.equal(result.summary.chores, 1);
  assert.equal(result.summary.completions, 1);
  assert.equal(result.summary.prizes, 1);
  assert.equal(result.summary.requests, 3);
  assert.equal(result.summary.history, 1);
  assert.ok(result.writes.some(write => write.path === 'families/family_1/requests/request:chore:completion_1'));
  assert.ok(result.writes.some(write => write.path === 'families/family_1/requests/prize_req_1'));
  assert.ok(result.writes.some(write => write.path === 'families/family_1/requests/sav_req_1'));
});
