import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createApprovalSeedStore,
  runPrizeApprovalFailureOnStore,
  runSavingsApprovalOnStore,
  runStaleApprovedRequestOnStore,
  runStaleDeniedRequestOnStore,
  simulatePrizeApprovalFailure,
  simulateSavingsApproval,
  simulateStaleApprovedRequest,
  simulateStaleDeniedRequest,
  simulateTwoDeviceApprovalRace,
} from '../../src/app/approval-lab-scenarios';

test('two-device approval race applies once and marks second operation duplicate', () => {
  const { result } = simulateTwoDeviceApprovalRace(undefined, 1760000000000);

  assert.equal(result.firstApplied, true);
  assert.equal(result.secondDuplicate, true);
  assert.equal(result.gems, 57);
  assert.equal(result.historyRows, 1);
  assert.equal(result.requestStatus, 'approved');
  assert.equal(result.operationStatus, 'applied');
});

test('prize approval failure records failed operation and leaves request pending', () => {
  const { result } = simulatePrizeApprovalFailure(1760000000000);

  assert.equal(result.firstApplied, false);
  assert.equal(result.gems, 10);
  assert.equal(result.historyRows, 0);
  assert.equal(result.requestStatus, 'pending');
  assert.equal(result.operationStatus, 'failed');
  assert.equal(result.reason, 'insufficient_gems');
});

test('stale approval after another device approved does not double award', () => {
  const { result } = simulateStaleApprovedRequest(1760000000000);

  assert.equal(result.firstApplied, true);
  assert.equal(result.secondDuplicate, false);
  assert.equal(result.gems, 57);
  assert.equal(result.historyRows, 1);
  assert.equal(result.requestStatus, 'approved');
  assert.equal(result.operationStatus, 'failed');
  assert.equal(result.reason, 'request_not_pending');
});

test('stale approval after denial stays denied without reward', () => {
  const { result } = simulateStaleDeniedRequest(1760000000000);

  assert.equal(result.firstApplied, true);
  assert.equal(result.secondDuplicate, false);
  assert.equal(result.gems, 50);
  assert.equal(result.historyRows, 1);
  assert.equal(result.requestStatus, 'denied');
  assert.equal(result.operationStatus, 'failed');
  assert.equal(result.reason, 'request_not_pending');
});

test('savings approval deducts savings and writes one history row', () => {
  const { result } = simulateSavingsApproval(1760000000000);

  assert.equal(result.firstApplied, true);
  assert.equal(result.savings, 18.5);
  assert.equal(result.historyRows, 1);
  assert.equal(result.requestStatus, 'approved');
  assert.equal(result.operationStatus, 'applied');
  assert.equal(result.reason, '');
});

test('manual lab scenarios preserve existing gem balance until reset', () => {
  const store = createApprovalSeedStore();
  store.set('families/family_1/members/kid_1', { gems: 64, diamonds: 64 }, { merge: true });

  const prizeFailure = runPrizeApprovalFailureOnStore(store, 1760000000000);
  const savings = runSavingsApprovalOnStore(store, 1760000001000);

  assert.equal(prizeFailure.gems, 64);
  assert.equal(savings.gems, 64);
  assert.equal(savings.savings, 18.5);
});

test('manual stale approval scenarios do not change the running gem balance', () => {
  const store = createApprovalSeedStore();
  store.set('families/family_1/members/kid_1', { gems: 64, diamonds: 64 }, { merge: true });

  const staleApproved = runStaleApprovedRequestOnStore(store, 1760000000000);
  const staleDenied = runStaleDeniedRequestOnStore(store, 1760000001000);

  assert.equal(staleApproved.gems, 64);
  assert.equal(staleApproved.requestStatus, 'approved');
  assert.equal(staleApproved.operationStatus, 'failed');
  assert.equal(staleApproved.reason, 'request_not_pending');
  assert.equal(staleDenied.gems, 64);
  assert.equal(staleDenied.requestStatus, 'denied');
  assert.equal(staleDenied.operationStatus, 'failed');
  assert.equal(staleDenied.reason, 'request_not_pending');
});
