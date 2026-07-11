export const REQUEST_KINDS = Object.freeze({
  CHORE_START: 'chore_start',
  CHORE_COMPLETION: 'chore_completion',
  PRIZE_REDEEM: 'prize_redeem',
  SAVINGS_SPEND: 'savings_spend',
});

export type RequestKind = (typeof REQUEST_KINDS)[keyof typeof REQUEST_KINDS];

export const REQUEST_STATUSES = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
  CANCELLED: 'cancelled',
});

export type RequestStatus = (typeof REQUEST_STATUSES)[keyof typeof REQUEST_STATUSES];

export type RequestSource = {
  choreId: string | null;
  completionId: string | null;
  prizeId: string | null;
  amount: number | null;
  reason: string;
};

export type ApprovalRequest = {
  id: string;
  familyId: string;
  kind: RequestKind | string;
  status: RequestStatus | string;
  requesterMemberId: string;
  targetMemberId: string;
  createdAt: number;
  resolvedAt: number | null;
  resolvedByMemberId: string | null;
  source: RequestSource;
  snapshot: Record<string, unknown>;
};

type LegacyRequestInput = Partial<ApprovalRequest> & {
  memberId?: string;
  choreId?: string;
  completionId?: string;
  prizeId?: string;
  amount?: number;
  reason?: string;
};

export function normalizeRequest(input: LegacyRequestInput | null | undefined): ApprovalRequest {
  const request = input || {};
  return {
    id: String(request.id || ''),
    familyId: String(request.familyId || ''),
    kind: String(request.kind || ''),
    status: String(request.status || REQUEST_STATUSES.PENDING),
    requesterMemberId: String(request.requesterMemberId || request.memberId || ''),
    targetMemberId: String(request.targetMemberId || request.memberId || ''),
    createdAt: Number(request.createdAt || 0),
    resolvedAt: request.resolvedAt == null ? null : Number(request.resolvedAt),
    resolvedByMemberId: request.resolvedByMemberId || null,
    source: {
      choreId: request.source?.choreId || request.choreId || null,
      completionId: request.source?.completionId || request.completionId || null,
      prizeId: request.source?.prizeId || request.prizeId || null,
      amount: request.source?.amount == null ? null : Number(request.source.amount),
      reason: request.source?.reason || request.reason || '',
    },
    snapshot: { ...(request.snapshot || {}) },
  };
}

export function isPendingRequest(request: ApprovalRequest | null | undefined): boolean {
  return request?.status === REQUEST_STATUSES.PENDING;
}
