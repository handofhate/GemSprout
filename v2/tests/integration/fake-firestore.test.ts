import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUEST_KINDS } from '../../src/domain/requests';
import { FakeFirestoreGateway, commitRequestOperation, isAppliedOperation } from '../../src/platform/firebase';
import { completionPath, historyPath, memberPath, operationPath, prizePath, requestPath } from '../../src/sync/firestore-paths';
import { makeRequestOperation, OPERATION_KINDS, OPERATION_STATUSES } from '../../src/sync';

const NOW = 1760000000000;
const FAMILY_ID = 'family_1';

function approvalStore(): FakeFirestoreGateway {
  return new FakeFirestoreGateway({
    [memberPath(FAMILY_ID, 'kid_1')]: { id: 'kid_1', name: 'Avery', role: 'kid', gems: 50, diamonds: 50, totalEarned: 100, savings: 25 },
    [requestPath(FAMILY_ID, 'request_1')]: {
      id: 'request_1',
      familyId: FAMILY_ID,
      kind: REQUEST_KINDS.CHORE_COMPLETION,
      status: 'pending',
      targetMemberId: 'kid_1',
      source: { choreId: 'chore_1', completionId: 'completion_1', prizeId: null, amount: null, reason: '' },
      snapshot: { title: 'Clean Room', points: 7 },
    },
    [completionPath(FAMILY_ID, 'completion_1')]: { id: 'completion_1', choreId: 'chore_1', memberId: 'kid_1', status: 'pending', points: 7 },
  });
}

function approveOperation() {
  return makeRequestOperation({
    id: 'op:request:approve:request_1',
    familyId: FAMILY_ID,
    kind: OPERATION_KINDS.REQUEST_APPROVE,
    requestId: 'request_1',
    actorMemberId: 'parent_1',
    createdAt: NOW,
  });
}

test('fake Firestore commits a request approval operation to touched docs', () => {
  const store = approvalStore();
  const result = commitRequestOperation(store, approveOperation(), { now: NOW });

  assert.equal(result.ok, true);
  assert.equal(result.duplicate, false);
  assert.equal(store.get<{ status: string }>(requestPath(FAMILY_ID, 'request_1'))?.status, 'approved');
  assert.equal(store.get<{ gems: number }>(memberPath(FAMILY_ID, 'kid_1'))?.gems, 57);
  assert.equal(store.get<{ status: string }>(completionPath(FAMILY_ID, 'completion_1'))?.status, 'approved');
  assert.equal(store.get<{ type: string }>(historyPath(FAMILY_ID, 'history:request:request_1:approve'))?.type, 'chore');
  assert.equal(isAppliedOperation(store, FAMILY_ID, 'op:request:approve:request_1'), true);
});

test('fake Firestore replay of an applied operation does not rewrite domain docs', () => {
  const store = approvalStore();
  const first = commitRequestOperation(store, approveOperation(), { now: NOW });
  const second = commitRequestOperation(store, approveOperation(), { now: NOW + 1000 });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.deepEqual(second.writes, [operationPath(FAMILY_ID, 'op:request:approve:request_1')]);
  assert.equal(store.get<{ gems: number }>(memberPath(FAMILY_ID, 'kid_1'))?.gems, 57);
  assert.equal(Object.keys(store.dump()).filter(path => path.includes('/history/')).length, 1);
});

test('fake Firestore records failed operation and leaves prize request pending', () => {
  const store = new FakeFirestoreGateway({
    [memberPath(FAMILY_ID, 'kid_1')]: { id: 'kid_1', name: 'Avery', role: 'kid', gems: 10, diamonds: 10, totalEarned: 100, savings: 25 },
    [prizePath(FAMILY_ID, 'prize_1')]: { id: 'prize_1', title: 'Movie Night', cost: 30, redemptions: [] },
    [requestPath(FAMILY_ID, 'request_1')]: {
      id: 'request_1',
      familyId: FAMILY_ID,
      kind: REQUEST_KINDS.PRIZE_REDEEM,
      status: 'pending',
      targetMemberId: 'kid_1',
      source: { choreId: null, completionId: null, prizeId: 'prize_1', amount: null, reason: '' },
      snapshot: { title: 'Movie Night', cost: 30 },
    },
  });
  const result = commitRequestOperation(store, approveOperation(), { now: NOW });
  const operation = store.get<{ status: string; error: { reason: string } }>(operationPath(FAMILY_ID, 'op:request:approve:request_1'));

  assert.equal(result.ok, false);
  assert.equal(operation?.status, OPERATION_STATUSES.FAILED);
  assert.equal(operation?.error.reason, 'insufficient_gems');
  assert.equal(store.get<{ status: string }>(requestPath(FAMILY_ID, 'request_1'))?.status, 'pending');
  assert.equal(Object.keys(store.dump()).some(path => path.includes('/history/')), false);
});
