import test from 'node:test';
import assert from 'node:assert/strict';
import { approveRequest, denyRequest, REQUEST_KINDS, type ApprovalState } from '../../src/domain/requests';
import { requestHistoryId, requestOperationId } from '../../src/domain/history/ids';

const NOW = 1760000000000;

function baseState(overrides: ApprovalState = {}): ApprovalState {
  return {
    membersById: {
      kid_1: { id: 'kid_1', name: 'Avery', role: 'kid', gems: 50, diamonds: 50, totalEarned: 100, savings: 25 },
      parent_1: { id: 'parent_1', name: 'Parent', role: 'parent' },
    },
    completionsById: {},
    prizesById: {},
    requestsById: {},
    historyById: {},
    ...overrides,
  };
}

test('request IDs are deterministic for retries', () => {
  assert.equal(requestOperationId('request_1', 'approve'), 'op:request:approve:request_1');
  assert.equal(requestHistoryId('request_1', 'approve'), 'history:request:request_1:approve');
  assert.equal(requestHistoryId('request_1', 'deny'), 'history:request:request_1:deny');
});

test('approving a chore completion awards gems and writes stable history', () => {
  const state = baseState({
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
  });

  const result = approveRequest(state, 'request_1', { actorMemberId: 'parent_1', now: NOW });

  assert.equal(result.ok, true);
  assert.equal(result.operationId, 'op:request:approve:request_1');
  assert.equal(result.state.requestsById?.request_1.status, 'approved');
  assert.equal(result.state.completionsById?.completion_1.status, 'approved');
  assert.equal(result.state.membersById?.kid_1.gems, 57);
  assert.equal(result.state.membersById?.kid_1.totalEarned, 107);
  assert.deepEqual(Object.keys(result.state.historyById || {}), ['history:request:request_1:approve']);
  assert.equal(result.history[0].type, 'chore');
});

test('approving a before-photo chore start resolves without paying gems', () => {
  const state = baseState({
    completionsById: {
      before_1: { id: 'before_1', choreId: 'chore_1', memberId: 'kid_1', status: 'pending', entryType: 'before', points: 7 },
    },
    requestsById: {
      request_1: {
        id: 'request_1',
        familyId: 'family_1',
        kind: REQUEST_KINDS.CHORE_START,
        status: 'pending',
        targetMemberId: 'kid_1',
        source: { choreId: 'chore_1', completionId: 'before_1', prizeId: null, amount: null, reason: '' },
      },
    },
  });

  const result = approveRequest(state, 'request_1', { actorMemberId: 'parent_1', now: NOW });

  assert.equal(result.ok, true);
  assert.equal(result.state.requestsById?.request_1.status, 'approved');
  assert.equal(result.state.completionsById?.before_1.status, 'approved');
  assert.equal(result.state.membersById?.kid_1.gems, 50);
  assert.deepEqual(result.history, []);
});

test('failed prize approval leaves the request pending', () => {
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

  const result = approveRequest(state, 'request_1', { actorMemberId: 'parent_1', now: NOW });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'insufficient_gems');
  assert.equal(result.state.requestsById?.request_1.status, 'pending');
  assert.equal(result.state.membersById?.kid_1.gems, 10);
  assert.deepEqual(result.history, []);
});

test('approving a savings spend deducts savings with stable history', () => {
  const state = baseState({
    requestsById: {
      request_1: {
        id: 'request_1',
        familyId: 'family_1',
        kind: REQUEST_KINDS.SAVINGS_SPEND,
        status: 'pending',
        targetMemberId: 'kid_1',
        source: { choreId: null, completionId: null, prizeId: null, amount: 6.5, reason: 'Book fair' },
      },
    },
  });

  const result = approveRequest(state, 'request_1', { actorMemberId: 'parent_1', now: NOW });

  assert.equal(result.ok, true);
  assert.equal(result.state.membersById?.kid_1.savings, 18.5);
  assert.equal(result.state.requestsById?.request_1.status, 'approved');
  assert.equal(result.history[0].id, 'history:request:request_1:approve');
  assert.equal(result.history[0].type, 'savings_withdraw');
});

test('denying any pending request resolves it and writes stable decline history', () => {
  const state = baseState({
    requestsById: {
      request_1: {
        id: 'request_1',
        familyId: 'family_1',
        kind: REQUEST_KINDS.PRIZE_REDEEM,
        status: 'pending',
        targetMemberId: 'kid_1',
        source: { choreId: null, completionId: null, prizeId: 'prize_1', amount: null, reason: '' },
        snapshot: { title: 'Movie Night' },
      },
    },
  });

  const result = denyRequest(state, 'request_1', { actorMemberId: 'parent_1', now: NOW });

  assert.equal(result.ok, true);
  assert.equal(result.operationId, 'op:request:deny:request_1');
  assert.equal(result.state.requestsById?.request_1.status, 'denied');
  assert.equal(result.history[0].id, 'history:request:request_1:deny');
  assert.equal(result.history[0].type, 'request_denied');
});
