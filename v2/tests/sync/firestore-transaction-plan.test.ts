import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUEST_KINDS, type ApprovalState } from '../../src/domain/requests';
import { executeOperation, makeRequestOperation, OPERATION_KINDS, planRequestOperationTransaction, type OperationState } from '../../src/sync';

const NOW = 1760000000000;

function baseState(overrides: OperationState = {}): OperationState {
  return {
    membersById: {
      kid_1: { id: 'kid_1', name: 'Avery', role: 'kid', gems: 50, diamonds: 50, totalEarned: 100, savings: 25 },
      parent_1: { id: 'parent_1', name: 'Parent', role: 'parent' },
    },
    completionsById: {},
    prizesById: {},
    requestsById: {},
    historyById: {},
    operationsById: {},
    ...overrides,
  };
}

function approvalFixture(): ApprovalState {
  return {
    completionsById: {
      completion_1: { id: 'completion_1', choreId: 'chore_1', memberId: 'kid_1', status: 'pending', points: 7 },
    },
    requestsById: {
      request_1: {
        id: 'request_1',
        familyId: 'family_1',
        kind: REQUEST_KINDS.CHORE_COMPLETION,
        status: 'pending',
        targetMemberId: 'kid_1',
        source: { choreId: 'chore_1', completionId: 'completion_1', prizeId: null, amount: null, reason: '' },
        snapshot: { title: 'Clean Room', points: 7 },
      },
    },
  };
}

test('request approval transaction plan reads idempotency and writes touched records', () => {
  const operation = makeRequestOperation({
    id: 'op:request:approve:request_1',
    familyId: 'family_1',
    kind: OPERATION_KINDS.REQUEST_APPROVE,
    requestId: 'request_1',
    actorMemberId: 'parent_1',
    createdAt: NOW,
  });
  const execution = executeOperation(baseState(approvalFixture()), operation, { now: NOW });
  const plan = planRequestOperationTransaction(execution);

  assert.deepEqual(plan.reads.map(read => read.path), [
    'families/family_1/operations/op:request:approve:request_1',
    'families/family_1/requests/request_1',
  ]);
  assert.deepEqual(plan.writes.map(write => write.path), [
    'families/family_1/operations/op:request:approve:request_1',
    'families/family_1/requests/request_1',
    'families/family_1/members/kid_1',
    'families/family_1/completions/completion_1',
    'families/family_1/history/history:request:request_1:approve',
  ]);
});

test('failed request approval transaction records operation and keeps request pending', () => {
  const state = baseState({
    membersById: {
      kid_1: { id: 'kid_1', name: 'Avery', role: 'kid', gems: 10, diamonds: 10, totalEarned: 100, savings: 25 },
    },
    prizesById: {
      prize_1: { id: 'prize_1', title: 'Movie Night', cost: 30, redemptions: [] },
    },
    requestsById: {
      request_1: {
        id: 'request_1',
        familyId: 'family_1',
        kind: REQUEST_KINDS.PRIZE_REDEEM,
        status: 'pending',
        targetMemberId: 'kid_1',
        source: { choreId: null, completionId: null, prizeId: 'prize_1', amount: null, reason: '' },
        snapshot: { title: 'Movie Night', cost: 30 },
      },
    },
  });
  const operation = makeRequestOperation({
    id: 'op:request:approve:request_1',
    familyId: 'family_1',
    kind: OPERATION_KINDS.REQUEST_APPROVE,
    requestId: 'request_1',
    actorMemberId: 'parent_1',
    createdAt: NOW,
  });
  const execution = executeOperation(state, operation, { now: NOW });
  const plan = planRequestOperationTransaction(execution);
  const requestWrite = plan.writes.find(write => write.path === 'families/family_1/requests/request_1');

  assert.equal(execution.ok, false);
  assert.equal((requestWrite?.data as { status?: string }).status, 'pending');
  assert.equal(plan.writes.some(write => write.path.includes('/history/')), false);
  assert.equal(plan.writes.some(write => write.path === 'families/family_1/operations/op:request:approve:request_1'), true);
});

test('duplicate operation transaction plan only writes the operation record', () => {
  const operation = makeRequestOperation({
    id: 'op:request:approve:request_1',
    familyId: 'family_1',
    kind: OPERATION_KINDS.REQUEST_APPROVE,
    requestId: 'request_1',
    actorMemberId: 'parent_1',
    createdAt: NOW,
  });
  const first = executeOperation(baseState(approvalFixture()), operation, { now: NOW });
  const duplicate = executeOperation(first.state, operation, { now: NOW + 1000 });
  const plan = planRequestOperationTransaction(duplicate);

  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(plan.writes.map(write => write.path), [
    'families/family_1/operations/op:request:approve:request_1',
  ]);
});
