export const OPERATION_KINDS = Object.freeze({
  REQUEST_APPROVE: 'request.approve',
  REQUEST_DENY: 'request.deny',
});

export type OperationKind = (typeof OPERATION_KINDS)[keyof typeof OPERATION_KINDS];

export const OPERATION_STATUSES = Object.freeze({
  PENDING: 'pending',
  APPLIED: 'applied',
  FAILED: 'failed',
});

export type OperationStatus = (typeof OPERATION_STATUSES)[keyof typeof OPERATION_STATUSES];

export type OperationPayload = {
  requestId?: string;
};

export type OperationResultSnapshot = {
  ok: boolean;
  reason?: string;
  message?: string;
  historyIds: string[];
  eventTypes: string[];
};

export type OperationRecord = {
  id: string;
  familyId: string;
  kind: OperationKind | string;
  status: OperationStatus | string;
  actorMemberId: string;
  requestId: string | null;
  createdAt: number;
  appliedAt: number | null;
  failedAt: number | null;
  payload: OperationPayload;
  result: OperationResultSnapshot | null;
  error: { reason: string; message: string } | null;
};

export function makeRequestOperation(input: {
  id: string;
  familyId: string;
  kind: typeof OPERATION_KINDS.REQUEST_APPROVE | typeof OPERATION_KINDS.REQUEST_DENY;
  requestId: string;
  actorMemberId: string;
  createdAt: number;
}): OperationRecord {
  return {
    id: input.id,
    familyId: input.familyId,
    kind: input.kind,
    status: OPERATION_STATUSES.PENDING,
    actorMemberId: input.actorMemberId,
    requestId: input.requestId,
    createdAt: input.createdAt,
    appliedAt: null,
    failedAt: null,
    payload: { requestId: input.requestId },
    result: null,
    error: null,
  };
}
