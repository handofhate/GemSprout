import { type HistoryEntry } from '../domain/requests';
import { type OperationExecutionResult, type OperationState } from './operation-executor';
import { completionPath, historyPath, memberPath, operationPath, prizePath, requestPath } from './firestore-paths';

export type FirestoreReadSpec = {
  path: string;
  reason: string;
};

export type FirestoreWriteSpec = {
  path: string;
  op: 'set';
  data: unknown;
  merge: boolean;
  reason: string;
};

export type FirestoreTransactionPlan = {
  familyId: string;
  operationId: string;
  reads: FirestoreReadSpec[];
  writes: FirestoreWriteSpec[];
};

function uniqByPath<T extends { path: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (seen.has(item.path)) continue;
    seen.add(item.path);
    result.push(item);
  }
  return result;
}

function addWrite(writes: FirestoreWriteSpec[], path: string, data: unknown, reason: string): void {
  writes.push({ path, op: 'set', data, merge: true, reason });
}

function historyWrites(familyId: string, history: HistoryEntry[]): FirestoreWriteSpec[] {
  return history.map(entry => ({
    path: historyPath(familyId, entry.id),
    op: 'set',
    data: entry,
    merge: true,
    reason: 'persist generated history record',
  }));
}

export function planRequestOperationReads(familyId: string, operationId: string, requestId: string): FirestoreReadSpec[] {
  return [
    { path: operationPath(familyId, operationId), reason: 'check operation idempotency' },
    { path: requestPath(familyId, requestId), reason: 'load request status and source references' },
  ];
}

export function planOperationWrites(execution: OperationExecutionResult): FirestoreTransactionPlan {
  const familyId = execution.operation.familyId;
  const operationId = execution.operation.id;
  const state = execution.state as OperationState;
  const writes: FirestoreWriteSpec[] = [];

  addWrite(writes, operationPath(familyId, operationId), execution.operation, 'record operation result');

  if (execution.duplicate) {
    return { familyId, operationId, reads: [], writes: uniqByPath(writes) };
  }

  const request = execution.operation.requestId ? state.requestsById?.[execution.operation.requestId] : null;
  if (request?.id) addWrite(writes, requestPath(familyId, request.id), request, 'persist resolved or still-pending request');

  const memberId = request?.targetMemberId;
  const member = memberId ? state.membersById?.[memberId] : null;
  if (member?.id) addWrite(writes, memberPath(familyId, member.id), member, 'persist member balance changes');

  const completionId = request?.source?.completionId;
  const completion = completionId ? state.completionsById?.[completionId] : null;
  if (completion?.id) addWrite(writes, completionPath(familyId, completion.id), completion, 'persist completion status changes');

  const prizeId = request?.source?.prizeId;
  const prize = prizeId ? state.prizesById?.[prizeId] : null;
  if (prize?.id) addWrite(writes, prizePath(familyId, prize.id), prize, 'persist prize redemption changes');

  writes.push(...historyWrites(familyId, execution.history));

  return {
    familyId,
    operationId,
    reads: [],
    writes: uniqByPath(writes),
  };
}

export function planRequestOperationTransaction(execution: OperationExecutionResult): FirestoreTransactionPlan {
  const requestId = execution.operation.requestId || execution.operation.payload.requestId || '';
  const reads = requestId
    ? planRequestOperationReads(execution.operation.familyId, execution.operation.id, requestId)
    : [{ path: operationPath(execution.operation.familyId, execution.operation.id), reason: 'check operation idempotency' }];
  const writePlan = planOperationWrites(execution);
  return {
    ...writePlan,
    reads,
  };
}
