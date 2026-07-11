import { approveRequest, denyRequest, type ApprovalResult, type ApprovalState, type DomainEvent, type HistoryEntry } from '../domain/requests';
import { OPERATION_KINDS, OPERATION_STATUSES, type OperationRecord, type OperationResultSnapshot } from './operation-model';

export type OperationState = ApprovalState & {
  operationsById?: Record<string, OperationRecord>;
};

export type OperationExecutionResult = {
  ok: boolean;
  duplicate: boolean;
  state: OperationState;
  operation: OperationRecord;
  history: HistoryEntry[];
  events: DomainEvent[];
  error: { reason: string; message: string } | null;
};

function clone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function upsertOperation(state: OperationState, operation: OperationRecord): OperationState {
  return {
    ...state,
    operationsById: {
      ...(state.operationsById || {}),
      [operation.id]: operation,
    },
  };
}

function snapshotResult(result: ApprovalResult): OperationResultSnapshot {
  return {
    ok: result.ok,
    reason: result.reason,
    message: result.message,
    historyIds: result.history.map(entry => entry.id),
    eventTypes: result.events.map(event => event.type),
  };
}

function appliedOperation(operation: OperationRecord, result: ApprovalResult, now: number): OperationRecord {
  return {
    ...operation,
    status: OPERATION_STATUSES.APPLIED,
    appliedAt: now,
    failedAt: null,
    result: snapshotResult(result),
    error: null,
  };
}

function failedOperation(operation: OperationRecord, result: ApprovalResult, now: number): OperationRecord {
  return {
    ...operation,
    status: OPERATION_STATUSES.FAILED,
    appliedAt: null,
    failedAt: now,
    result: snapshotResult(result),
    error: {
      reason: result.reason || 'operation_failed',
      message: result.message || 'Operation failed.',
    },
  };
}

function duplicateResult(state: OperationState, operation: OperationRecord): OperationExecutionResult {
  return {
    ok: operation.status === OPERATION_STATUSES.APPLIED,
    duplicate: true,
    state,
    operation,
    history: [],
    events: [],
    error: operation.error,
  };
}

export function executeOperation(inputState: OperationState, inputOperation: OperationRecord, options: { now?: number } = {}): OperationExecutionResult {
  const state = clone(inputState || {});
  const operation = clone(inputOperation);
  const existing = state.operationsById?.[operation.id];
  if (existing?.status === OPERATION_STATUSES.APPLIED) {
    return duplicateResult(state, existing);
  }

  const now = Number(options.now || Date.now());
  const requestId = operation.requestId || operation.payload.requestId || '';
  let domainResult: ApprovalResult;

  switch (operation.kind) {
    case OPERATION_KINDS.REQUEST_APPROVE:
      domainResult = approveRequest(state, requestId, { actorMemberId: operation.actorMemberId, now });
      break;
    case OPERATION_KINDS.REQUEST_DENY:
      domainResult = denyRequest(state, requestId, { actorMemberId: operation.actorMemberId, now });
      break;
    default:
      domainResult = {
        ok: false,
        reason: 'unsupported_operation_kind',
        message: `Unsupported operation kind: ${operation.kind}`,
        state,
        request: null,
        operationId: operation.id,
        events: [],
        history: [],
        now,
      };
      break;
  }

  const completedOperation = domainResult.ok
    ? appliedOperation(operation, domainResult, now)
    : failedOperation(operation, domainResult, now);
  const nextState = upsertOperation(domainResult.state, completedOperation);

  return {
    ok: domainResult.ok,
    duplicate: false,
    state: nextState,
    operation: completedOperation,
    history: domainResult.history,
    events: domainResult.events,
    error: completedOperation.error,
  };
}
