import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUEST_KINDS, type ApprovalState } from '../../src/domain/requests';
import { executeOperation, makeRequestOperation, OPERATION_KINDS, OPERATION_STATUSES, type OperationState } from '../../src/sync';

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

test('request approval operation applies once and records operation result', () => {
  const state = baseState(approvalFixture());
  const operation = makeRequestOperation({
    id: 'op:request:approve:request_1',
    familyId: 'family_1',
    kind: OPERATION_KINDS.REQUEST_APPROVE,
    requestId: 'request_1',
    actorMemberId: 'parent_1',
    createdAt: NOW,
  });

  const result = executeOperation(state, operation, { now: NOW });

  assert.equal(result.ok, true);
  assert.equal(result.duplicate, false);
  assert.equal(result.operation.status, OPERATION_STATUSES.APPLIED);
  assert.equal(result.operation.appliedAt, NOW);
  assert.equal(result.state.membersById?.kid_1.gems, 57);
  assert.equal(result.state.requestsById?.request_1.status, 'approved');
  assert.deepEqual(result.operation.result?.historyIds, ['history:request:request_1:approve']);
});

test('replaying an applied operation does not double-award gems or duplicate history', () => {
  const state = baseState(approvalFixture());
  const operation = makeRequestOperation({
    id: 'op:request:approve:request_1',
    familyId: 'family_1',
    kind: OPERATION_KINDS.REQUEST_APPROVE,
    requestId: 'request_1',
    actorMemberId: 'parent_1',
    createdAt: NOW,
  });

  const first = executeOperation(state, operation, { now: NOW });
  const second = executeOperation(first.state, operation, { now: NOW + 1000 });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(second.state.membersById?.kid_1.gems, 57);
  assert.deepEqual(Object.keys(second.state.historyById || {}), ['history:request:request_1:approve']);
  assert.equal(second.history.length, 0);
  assert.equal(second.events.length, 0);
});

test('failed operation is recorded without resolving the request', () => {
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

  const result = executeOperation(state, operation, { now: NOW });

  assert.equal(result.ok, false);
  assert.equal(result.operation.status, OPERATION_STATUSES.FAILED);
  assert.equal(result.operation.error?.reason, 'insufficient_gems');
  assert.equal(result.state.requestsById?.request_1.status, 'pending');
  assert.equal(result.state.membersById?.kid_1.gems, 10);
  assert.deepEqual(Object.keys(result.state.historyById || {}), []);
});
