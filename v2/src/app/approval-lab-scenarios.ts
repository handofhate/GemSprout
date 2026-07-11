import { REQUEST_KINDS } from '../domain/requests';
import { FakeFirestoreGateway, commitRequestOperation } from '../platform/firebase';
import { completionPath, historyPath, memberPath, operationPath, prizePath, requestPath } from '../sync/firestore-paths';
import { makeRequestOperation, OPERATION_KINDS, OPERATION_STATUSES } from '../sync';

export const LAB_FAMILY_ID = 'family_1';
export const LAB_REQUEST_ID = 'request_1';
export const LAB_OPERATION_ID = `op:request:approve:${LAB_REQUEST_ID}`;
export const LAB_HISTORY_ID = `history:request:${LAB_REQUEST_ID}:approve`;

export type LabScenarioResult = {
  name: string;
  firstApplied: boolean;
  secondDuplicate: boolean;
  gems: number;
  savings: number;
  historyRows: number;
  requestStatus: string;
  operationStatus: string;
  reason: string;
};

export function createApprovalSeedStore(): FakeFirestoreGateway {
  return new FakeFirestoreGateway({
    [memberPath(LAB_FAMILY_ID, 'kid_1')]: {
      id: 'kid_1',
      name: 'Avery',
      role: 'kid',
      gems: 50,
      diamonds: 50,
      totalEarned: 100,
      savings: 25,
    },
    [requestPath(LAB_FAMILY_ID, LAB_REQUEST_ID)]: {
      id: LAB_REQUEST_ID,
      familyId: LAB_FAMILY_ID,
      kind: REQUEST_KINDS.CHORE_COMPLETION,
      status: 'pending',
      targetMemberId: 'kid_1',
      source: { choreId: 'chore_1', completionId: 'completion_1', prizeId: null, amount: null, reason: '' },
      snapshot: { title: 'Clean Room', points: 7 },
    },
    [completionPath(LAB_FAMILY_ID, 'completion_1')]: {
      id: 'completion_1',
      choreId: 'chore_1',
      memberId: 'kid_1',
      status: 'pending',
      points: 7,
    },
  });
}

export function createApproveOperation(createdAt = Date.now()) {
  return makeRequestOperation({
    id: LAB_OPERATION_ID,
    familyId: LAB_FAMILY_ID,
    kind: OPERATION_KINDS.REQUEST_APPROVE,
    requestId: LAB_REQUEST_ID,
    actorMemberId: 'parent_1',
    createdAt,
  });
}

export function createDenyOperation(createdAt = Date.now()) {
  return makeRequestOperation({
    id: `op:request:deny:${LAB_REQUEST_ID}`,
    familyId: LAB_FAMILY_ID,
    kind: OPERATION_KINDS.REQUEST_DENY,
    requestId: LAB_REQUEST_ID,
    actorMemberId: 'parent_1',
    createdAt,
  });
}

export function createPrizeFailureSeedStore(): FakeFirestoreGateway {
  const store = createApprovalSeedStore();
  preparePrizeFailureStore(store);
  return store;
}

export function createSavingsSeedStore(): FakeFirestoreGateway {
  const store = createApprovalSeedStore();
  prepareSavingsStore(store);
  return store;
}

export function summarizeStore(store: FakeFirestoreGateway, operationId = LAB_OPERATION_ID): Omit<LabScenarioResult, 'name' | 'firstApplied' | 'secondDuplicate'> {
  const member = store.get<{ gems?: number }>(memberPath(LAB_FAMILY_ID, 'kid_1'));
  const savingsMember = store.get<{ savings?: number }>(memberPath(LAB_FAMILY_ID, 'kid_1'));
  const request = store.get<{ status?: string }>(requestPath(LAB_FAMILY_ID, LAB_REQUEST_ID));
  const operation = store.get<{ status?: string; error?: { reason?: string } }>(operationPath(LAB_FAMILY_ID, operationId));
  const historyRows = Object.keys(store.dump()).filter(path => path.includes('/history/')).length;
  return {
    gems: member?.gems || 0,
    savings: savingsMember?.savings || 0,
    historyRows,
    requestStatus: request?.status || 'missing',
    operationStatus: operation?.status || 'missing',
    reason: operation?.error?.reason || '',
  };
}

export function simulateTwoDeviceApprovalRace(store = createApprovalSeedStore(), now = Date.now()): { store: FakeFirestoreGateway; result: LabScenarioResult } {
  const first = commitRequestOperation(store, createApproveOperation(now), { now });
  const second = commitRequestOperation(store, createApproveOperation(now), { now: now + 1 });
  const summary = summarizeStore(store);
  return {
    store,
    result: {
      name: 'Two-device race',
      ...summary,
      firstApplied: first.ok && !first.duplicate,
      secondDuplicate: second.duplicate,
    },
  };
}

export function simulatePrizeApprovalFailure(now = Date.now()): { store: FakeFirestoreGateway; result: LabScenarioResult } {
  const store = createPrizeFailureSeedStore();
  const member = store.get<{ gems?: number; diamonds?: number }>(memberPath(LAB_FAMILY_ID, 'kid_1')) || {};
  store.set(memberPath(LAB_FAMILY_ID, 'kid_1'), { ...member, gems: 10, diamonds: 10 }, { merge: true });
  store.set(requestPath(LAB_FAMILY_ID, LAB_REQUEST_ID), { snapshot: { title: 'Movie Night', cost: 30 } }, { merge: true });
  const execution = commitRequestOperation(store, createApproveOperation(now), { now });
  return {
    store,
    result: {
      name: 'Prize approval failure',
      ...summarizeStore(store),
      firstApplied: execution.ok && !execution.duplicate,
      secondDuplicate: false,
    },
  };
}

export function simulateStaleApprovedRequest(now = Date.now()): { store: FakeFirestoreGateway; result: LabScenarioResult } {
  const store = createApprovalSeedStore();
  const first = commitRequestOperation(store, createApproveOperation(now), { now });
  const stale = makeRequestOperation({
    id: `op:request:approve-stale:${LAB_REQUEST_ID}`,
    familyId: LAB_FAMILY_ID,
    kind: OPERATION_KINDS.REQUEST_APPROVE,
    requestId: LAB_REQUEST_ID,
    actorMemberId: 'parent_2',
    createdAt: now + 1,
  });
  const second = commitRequestOperation(store, stale, { now: now + 1 });
  return {
    store,
    result: {
      name: 'Stale already-approved request',
      ...summarizeStore(store, stale.id),
      firstApplied: first.ok && !first.duplicate,
      secondDuplicate: second.duplicate,
    },
  };
}

export function simulateStaleDeniedRequest(now = Date.now()): { store: FakeFirestoreGateway; result: LabScenarioResult } {
  const store = createApprovalSeedStore();
  const deny = commitRequestOperation(store, createDenyOperation(now), { now });
  const stale = makeRequestOperation({
    id: `op:request:approve-after-deny:${LAB_REQUEST_ID}`,
    familyId: LAB_FAMILY_ID,
    kind: OPERATION_KINDS.REQUEST_APPROVE,
    requestId: LAB_REQUEST_ID,
    actorMemberId: 'parent_2',
    createdAt: now + 1,
  });
  const approve = commitRequestOperation(store, stale, { now: now + 1 });
  return {
    store,
    result: {
      name: 'Stale denied request',
      ...summarizeStore(store, stale.id),
      firstApplied: deny.ok && !deny.duplicate,
      secondDuplicate: approve.duplicate,
    },
  };
}

export function simulateSavingsApproval(now = Date.now()): { store: FakeFirestoreGateway; result: LabScenarioResult } {
  const store = createSavingsSeedStore();
  const execution = commitRequestOperation(store, createApproveOperation(now), { now });
  return {
    store,
    result: {
      name: 'Savings approval',
      ...summarizeStore(store),
      firstApplied: execution.ok && !execution.duplicate,
      secondDuplicate: false,
    },
  };
}

export function preparePrizeFailureStore(store: FakeFirestoreGateway): void {
  prepareOperationForScenario(store, LAB_OPERATION_ID);
  store.set(prizePath(LAB_FAMILY_ID, 'prize_1'), {
    id: 'prize_1',
    title: 'Movie Night',
    cost: 999,
    redemptions: [],
  }, { merge: true });
  store.set(requestPath(LAB_FAMILY_ID, LAB_REQUEST_ID), {
    id: LAB_REQUEST_ID,
    familyId: LAB_FAMILY_ID,
    kind: REQUEST_KINDS.PRIZE_REDEEM,
    status: 'pending',
    resolvedAt: null,
    resolvedByMemberId: null,
    targetMemberId: 'kid_1',
    source: { choreId: null, completionId: null, prizeId: 'prize_1', amount: null, reason: '' },
    snapshot: { title: 'Movie Night', cost: 999 },
  }, { merge: true });
}

export function prepareSavingsStore(store: FakeFirestoreGateway): void {
  prepareOperationForScenario(store, LAB_OPERATION_ID);
  store.set(requestPath(LAB_FAMILY_ID, LAB_REQUEST_ID), {
    id: LAB_REQUEST_ID,
    familyId: LAB_FAMILY_ID,
    kind: REQUEST_KINDS.SAVINGS_SPEND,
    status: 'pending',
    resolvedAt: null,
    resolvedByMemberId: null,
    targetMemberId: 'kid_1',
    source: { choreId: null, completionId: null, prizeId: null, amount: 6.5, reason: 'Book fair' },
    snapshot: { title: 'Book fair', amount: 6.5 },
  }, { merge: true });
}

export function runPrizeApprovalFailureOnStore(store: FakeFirestoreGateway, now = Date.now()): LabScenarioResult {
  preparePrizeFailureStore(store);
  const execution = commitRequestOperation(store, createApproveOperation(now), { now });
  return {
    name: 'Prize approval failure',
    ...summarizeStore(store),
    firstApplied: execution.ok && !execution.duplicate,
    secondDuplicate: false,
  };
}

export function runStaleApprovedRequestOnStore(store: FakeFirestoreGateway, now = Date.now()): LabScenarioResult {
  prepareResolvedApprovalRequestStore(store, 'approve', now);
  prepareOperationForScenario(store, `op:request:approve-stale:${LAB_REQUEST_ID}`);
  const stale = makeRequestOperation({
    id: `op:request:approve-stale:${LAB_REQUEST_ID}`,
    familyId: LAB_FAMILY_ID,
    kind: OPERATION_KINDS.REQUEST_APPROVE,
    requestId: LAB_REQUEST_ID,
    actorMemberId: 'parent_2',
    createdAt: now + 1,
  });
  const second = commitRequestOperation(store, stale, { now: now + 1 });
  return {
    name: 'Stale already-approved request',
    ...summarizeStore(store, stale.id),
    firstApplied: false,
    secondDuplicate: second.duplicate,
  };
}

export function runStaleDeniedRequestOnStore(store: FakeFirestoreGateway, now = Date.now()): LabScenarioResult {
  prepareResolvedApprovalRequestStore(store, 'deny', now);
  prepareOperationForScenario(store, `op:request:approve-after-deny:${LAB_REQUEST_ID}`);
  const stale = makeRequestOperation({
    id: `op:request:approve-after-deny:${LAB_REQUEST_ID}`,
    familyId: LAB_FAMILY_ID,
    kind: OPERATION_KINDS.REQUEST_APPROVE,
    requestId: LAB_REQUEST_ID,
    actorMemberId: 'parent_2',
    createdAt: now + 1,
  });
  const approve = commitRequestOperation(store, stale, { now: now + 1 });
  return {
    name: 'Stale denied request',
    ...summarizeStore(store, stale.id),
    firstApplied: false,
    secondDuplicate: approve.duplicate,
  };
}

export function runSavingsApprovalOnStore(store: FakeFirestoreGateway, now = Date.now()): LabScenarioResult {
  prepareSavingsStore(store);
  const execution = commitRequestOperation(store, createApproveOperation(now), { now });
  return {
    name: 'Savings approval',
    ...summarizeStore(store),
    firstApplied: execution.ok && !execution.duplicate,
    secondDuplicate: false,
  };
}

export function runTwoDeviceApprovalRaceOnStore(store: FakeFirestoreGateway, now = Date.now()): LabScenarioResult {
  prepareApprovalRequestStore(store);
  const first = commitRequestOperation(store, createApproveOperation(now), { now });
  const second = commitRequestOperation(store, createApproveOperation(now), { now: now + 1 });
  const summary = summarizeStore(store);
  return {
    name: 'Two-device race',
    ...summary,
    firstApplied: first.ok && !first.duplicate,
    secondDuplicate: second.duplicate,
  };
}

export function prepareApprovalRequestStore(store: FakeFirestoreGateway): void {
  prepareOperationForScenario(store, LAB_OPERATION_ID);
  prepareOperationForScenario(store, `op:request:deny:${LAB_REQUEST_ID}`);
  ensureLabMember(store);
  store.set(requestPath(LAB_FAMILY_ID, LAB_REQUEST_ID), {
    id: LAB_REQUEST_ID,
    familyId: LAB_FAMILY_ID,
    kind: REQUEST_KINDS.CHORE_COMPLETION,
    status: 'pending',
    resolvedAt: null,
    resolvedByMemberId: null,
    targetMemberId: 'kid_1',
    source: { choreId: 'chore_1', completionId: 'completion_1', prizeId: null, amount: null, reason: '' },
    snapshot: { title: 'Clean Room', points: 7 },
  }, { merge: true });
  store.set(completionPath(LAB_FAMILY_ID, 'completion_1'), {
    id: 'completion_1',
    choreId: 'chore_1',
    memberId: 'kid_1',
    status: 'pending',
    points: 7,
  }, { merge: true });
}

function prepareResolvedApprovalRequestStore(store: FakeFirestoreGateway, action: 'approve' | 'deny', now: number): void {
  ensureLabMember(store);
  const approved = action === 'approve';
  const operationId = approved ? LAB_OPERATION_ID : `op:request:deny:${LAB_REQUEST_ID}`;
  const historyId = approved ? LAB_HISTORY_ID : `history:request:${LAB_REQUEST_ID}:deny`;

  store.set(requestPath(LAB_FAMILY_ID, LAB_REQUEST_ID), {
    id: LAB_REQUEST_ID,
    familyId: LAB_FAMILY_ID,
    kind: REQUEST_KINDS.CHORE_COMPLETION,
    status: approved ? 'approved' : 'denied',
    resolvedAt: now,
    resolvedByMemberId: 'parent_1',
    targetMemberId: 'kid_1',
    source: { choreId: 'chore_1', completionId: 'completion_1', prizeId: null, amount: null, reason: '' },
    snapshot: { title: 'Clean Room', points: 7 },
  }, { merge: true });
  store.set(completionPath(LAB_FAMILY_ID, 'completion_1'), {
    id: 'completion_1',
    choreId: 'chore_1',
    memberId: 'kid_1',
    status: approved ? 'approved' : 'denied',
    points: 7,
    approvedAt: approved ? now : null,
    approvedByMemberId: approved ? 'parent_1' : null,
  }, { merge: true });
  store.set(operationPath(LAB_FAMILY_ID, operationId), {
    id: operationId,
    familyId: LAB_FAMILY_ID,
    kind: approved ? OPERATION_KINDS.REQUEST_APPROVE : OPERATION_KINDS.REQUEST_DENY,
    status: OPERATION_STATUSES.APPLIED,
    actorMemberId: 'parent_1',
    requestId: LAB_REQUEST_ID,
    createdAt: now,
    appliedAt: now,
    failedAt: null,
    payload: { requestId: LAB_REQUEST_ID },
    result: { ok: true, historyIds: [historyId], eventTypes: [approved ? 'request.approved' : 'request.denied'] },
    error: null,
  }, { merge: false });
  store.set(historyPath(LAB_FAMILY_ID, historyId), {
    id: historyId,
    familyId: LAB_FAMILY_ID,
    memberId: 'kid_1',
    requestId: LAB_REQUEST_ID,
    type: approved ? 'chore' : 'request_denied',
    title: approved ? 'Clean Room' : 'Clean Room',
    gems: approved ? 7 : 0,
    createdAt: now,
    metadata: approved
      ? { choreId: 'chore_1', completionId: 'completion_1', approvedByMemberId: 'parent_1' }
      : { kind: REQUEST_KINDS.CHORE_COMPLETION, deniedByMemberId: 'parent_1' },
  }, { merge: false });
}

function ensureLabMember(store: FakeFirestoreGateway): void {
  const member = store.get<{ id?: string }>(memberPath(LAB_FAMILY_ID, 'kid_1'));
  if (member?.id) return;
  const seed = createApprovalSeedStore();
  store.set(memberPath(LAB_FAMILY_ID, 'kid_1'), seed.get(memberPath(LAB_FAMILY_ID, 'kid_1')), { merge: true });
}

function prepareOperationForScenario(store: FakeFirestoreGateway, operationId: string): void {
  store.set(operationPath(LAB_FAMILY_ID, operationId), {
    id: operationId,
    familyId: LAB_FAMILY_ID,
    kind: operationId.includes(':deny:') ? OPERATION_KINDS.REQUEST_DENY : OPERATION_KINDS.REQUEST_APPROVE,
    status: OPERATION_STATUSES.PENDING,
    actorMemberId: 'parent_1',
    requestId: LAB_REQUEST_ID,
    createdAt: Date.now(),
    appliedAt: null,
    failedAt: null,
    payload: { requestId: LAB_REQUEST_ID },
    result: null,
    error: null,
  }, { merge: false });
}
