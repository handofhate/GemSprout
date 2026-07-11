import { requestHistoryId, requestOperationId, type RequestHistoryAction } from '../history/ids';
import { REQUEST_KINDS, REQUEST_STATUSES, normalizeRequest, isPendingRequest, type ApprovalRequest } from './model';

export type Member = {
  id: string;
  name?: string;
  role?: string;
  gems?: number;
  diamonds?: number;
  totalEarned?: number;
  savings?: number;
  savingsGifted?: number;
  savingsMatched?: number;
  savingsInterest?: number;
};

export type Completion = {
  id: string;
  choreId?: string;
  memberId?: string;
  status: string;
  entryType?: string;
  points?: number;
  title?: string;
  approvedAt?: number;
  approvedByMemberId?: string | null;
  photoUrl?: string | null;
};

type Redemption = {
  id: string;
  requestId: string;
  prizeId: string;
  memberId: string;
  cost: number;
  date?: string;
  periodKey?: string;
  redeemedAt: number;
  approvedByMemberId: string | null;
};

export type Prize = {
  id: string;
  title?: string;
  cost?: number;
  recurrence?: string;
  redemptions?: Redemption[];
};

export type HistoryEntry = {
  id: string;
  familyId: string;
  requestId: string;
  memberId: string;
  type: string;
  title: string;
  gems: number;
  amount: number | null;
  createdAt: number;
  occurredAt: number;
  metadata: Record<string, unknown>;
};

export type ApprovalState = {
  membersById?: Record<string, Member>;
  completionsById?: Record<string, Completion>;
  prizesById?: Record<string, Prize>;
  requestsById?: Record<string, Partial<ApprovalRequest>>;
  historyById?: Record<string, HistoryEntry>;
};

export type DomainEvent = {
  type: string;
  requestId: string;
  kind: string;
  memberId: string;
};

export type ApprovalResult = {
  ok: boolean;
  reason?: string;
  message?: string;
  state: ApprovalState;
  request: ApprovalRequest | null;
  operationId: string | null;
  events: DomainEvent[];
  history: HistoryEntry[];
  now: number;
};

function clone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function asNumber(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value: unknown): number {
  return Math.round(asNumber(value) * 100) / 100;
}

function reduceSavingsBuckets(member: Member, amount: number): Member {
  const next = { ...member };
  let remaining = roundMoney(amount);
  (['savingsGifted', 'savingsMatched', 'savingsInterest'] as const).forEach(key => {
    if (remaining <= 0) return;
    const current = roundMoney(next[key]);
    if (current <= 0) return;
    const applied = Math.min(current, remaining);
    next[key] = roundMoney(current - applied);
    remaining = roundMoney(remaining - applied);
  });
  return next;
}

function getMapRecord<T>(map: Record<string, T> | undefined, id: string | null): T | null {
  return id && map ? map[id] || null : null;
}

function upsertMapRecord<T>(map: Record<string, T> | undefined, id: string, record: T): Record<string, T> {
  return { ...(map || {}), [id]: record };
}

function createBaseResult(state: ApprovalState, request: ApprovalRequest, action: RequestHistoryAction, now: number): ApprovalResult {
  return {
    ok: true,
    state,
    request,
    operationId: requestOperationId(request.id, action),
    events: [],
    history: [],
    now,
  };
}

function fail(state: ApprovalState, request: ApprovalRequest | null, action: RequestHistoryAction, reason: string, message: string, now: number): ApprovalResult {
  return {
    ok: false,
    reason,
    message,
    state,
    request,
    operationId: request?.id ? requestOperationId(request.id, action) : null,
    events: [],
    history: [],
    now,
  };
}

function withResolvedRequest(state: ApprovalState, request: ApprovalRequest, status: string, actorMemberId: string | null, now: number): ApprovalState {
  const resolved: ApprovalRequest = {
    ...request,
    status,
    resolvedAt: now,
    resolvedByMemberId: actorMemberId || null,
  };
  return {
    ...state,
    requestsById: upsertMapRecord(state.requestsById, request.id, resolved),
  };
}

function appendHistory(state: ApprovalState, historyEntry: HistoryEntry): ApprovalState {
  return {
    ...state,
    historyById: upsertMapRecord(state.historyById, historyEntry.id, historyEntry),
  };
}

function makeHistory(
  request: ApprovalRequest,
  action: RequestHistoryAction,
  fields: { type: string; title: string; gems?: number; amount?: number | null; metadata?: Record<string, unknown> },
  now: number,
): HistoryEntry {
  return {
    id: requestHistoryId(request.id, action),
    familyId: request.familyId,
    requestId: request.id,
    memberId: request.targetMemberId,
    type: fields.type,
    title: fields.title,
    gems: fields.gems || 0,
    amount: fields.amount || null,
    createdAt: now,
    occurredAt: now,
    metadata: fields.metadata || {},
  };
}

function getPendingRequest(state: ApprovalState, requestId: string, action: RequestHistoryAction, now: number): ApprovalRequest | ApprovalResult {
  const request = normalizeRequest(getMapRecord(state.requestsById, requestId));
  if (!request.id) return fail(state, null, action, 'request_missing', 'Request not found.', now);
  if (!isPendingRequest(request)) {
    return fail(state, request, action, 'request_not_pending', 'Request is no longer pending.', now);
  }
  return request;
}

export function approveRequest(inputState: ApprovalState, requestId: string, options: { actorMemberId?: string; now?: number } = {}): ApprovalResult {
  const state = clone(inputState || {});
  const now = Number(options.now || Date.now());
  const actorMemberId = options.actorMemberId || null;
  const request = getPendingRequest(state, requestId, 'approve', now);
  if ('state' in request) return request;
  switch (request.kind) {
    case REQUEST_KINDS.CHORE_START:
      return approveChoreStart(state, request, actorMemberId, now);
    case REQUEST_KINDS.CHORE_COMPLETION:
      return approveChoreCompletion(state, request, actorMemberId, now);
    case REQUEST_KINDS.PRIZE_REDEEM:
      return approvePrizeRedeem(state, request, actorMemberId, now);
    case REQUEST_KINDS.SAVINGS_SPEND:
      return approveSavingsSpend(state, request, actorMemberId, now);
    default:
      return fail(state, request, 'approve', 'unsupported_request_kind', `Unsupported request kind: ${request.kind}`, now);
  }
}

export function denyRequest(inputState: ApprovalState, requestId: string, options: { actorMemberId?: string; now?: number } = {}): ApprovalResult {
  const state = clone(inputState || {});
  const now = Number(options.now || Date.now());
  const actorMemberId = options.actorMemberId || null;
  const request = getPendingRequest(state, requestId, 'deny', now);
  if ('state' in request) return request;
  const title = String(request.snapshot?.title || request.source?.reason || 'Request denied');
  const history = makeHistory(request, 'deny', {
    type: 'request_denied',
    title,
    metadata: {
      kind: request.kind,
      deniedByMemberId: actorMemberId,
    },
  }, now);
  let nextState = withResolvedRequest(state, request, REQUEST_STATUSES.DENIED, actorMemberId, now);
  const completion = getMapRecord(nextState.completionsById, request.source.completionId);
  if ((request.kind === REQUEST_KINDS.CHORE_START || request.kind === REQUEST_KINDS.CHORE_COMPLETION) && completion?.id) {
    nextState = {
      ...nextState,
      completionsById: upsertMapRecord(nextState.completionsById, completion.id, {
        ...completion,
        status: REQUEST_STATUSES.DENIED,
        approvedAt: undefined,
        approvedByMemberId: undefined,
      }),
    };
  }
  nextState = appendHistory(nextState, history);
  const result = createBaseResult(nextState, nextState.requestsById?.[request.id] as ApprovalRequest, 'deny', now);
  result.events.push({ type: 'request.denied', requestId: request.id, kind: request.kind, memberId: request.targetMemberId });
  result.history.push(history);
  return result;
}

function approveChoreStart(state: ApprovalState, request: ApprovalRequest, actorMemberId: string | null, now: number): ApprovalResult {
  const completion = getMapRecord(state.completionsById, request.source.completionId);
  if (!completion) return fail(state, request, 'approve', 'completion_missing', 'Completion not found.', now);
  if (completion.status !== 'pending') return fail(state, request, 'approve', 'completion_not_pending', 'Completion is no longer pending.', now);

  const approvedCompletion = { ...completion, status: 'approved', approvedAt: now, approvedByMemberId: actorMemberId };
  let nextState: ApprovalState = {
    ...state,
    completionsById: upsertMapRecord(state.completionsById, completion.id, approvedCompletion),
  };
  nextState = withResolvedRequest(nextState, request, REQUEST_STATUSES.APPROVED, actorMemberId, now);
  const result = createBaseResult(nextState, nextState.requestsById?.[request.id] as ApprovalRequest, 'approve', now);
  result.events.push({ type: 'request.approved', requestId: request.id, kind: request.kind, memberId: request.targetMemberId });
  return result;
}

function approveChoreCompletion(state: ApprovalState, request: ApprovalRequest, actorMemberId: string | null, now: number): ApprovalResult {
  const completion = getMapRecord(state.completionsById, request.source.completionId);
  const member = getMapRecord(state.membersById, request.targetMemberId);
  if (!completion) return fail(state, request, 'approve', 'completion_missing', 'Completion not found.', now);
  if (!member) return fail(state, request, 'approve', 'member_missing', 'Member not found.', now);
  if (completion.status !== 'pending') return fail(state, request, 'approve', 'completion_not_pending', 'Completion is no longer pending.', now);

  const points = asNumber(request.snapshot?.points ?? completion.points);
  const approvedCompletion = { ...completion, status: 'approved', approvedAt: now, approvedByMemberId: actorMemberId };
  const updatedMember = {
    ...member,
    gems: asNumber(member.gems) + points,
    totalEarned: asNumber(member.totalEarned) + points,
  };
  updatedMember.diamonds = updatedMember.gems;

  const history = makeHistory(request, 'approve', {
    type: 'chore',
    title: String(request.snapshot?.title || completion.title || 'Chore approved'),
    gems: points,
    metadata: {
      choreId: request.source.choreId,
      completionId: completion.id,
      approvedByMemberId: actorMemberId,
    },
  }, now);

  let nextState: ApprovalState = {
    ...state,
    membersById: upsertMapRecord(state.membersById, member.id, updatedMember),
    completionsById: upsertMapRecord(state.completionsById, completion.id, approvedCompletion),
  };
  nextState = withResolvedRequest(nextState, request, REQUEST_STATUSES.APPROVED, actorMemberId, now);
  nextState = appendHistory(nextState, history);
  const result = createBaseResult(nextState, nextState.requestsById?.[request.id] as ApprovalRequest, 'approve', now);
  result.events.push({ type: 'request.approved', requestId: request.id, kind: request.kind, memberId: request.targetMemberId });
  result.history.push(history);
  return result;
}

function approvePrizeRedeem(state: ApprovalState, request: ApprovalRequest, actorMemberId: string | null, now: number): ApprovalResult {
  const member = getMapRecord(state.membersById, request.targetMemberId);
  const prize = getMapRecord(state.prizesById, request.source.prizeId);
  if (!member) return fail(state, request, 'approve', 'member_missing', 'Member not found.', now);
  if (!prize) return fail(state, request, 'approve', 'prize_missing', 'Prize not found.', now);

  const cost = asNumber(request.snapshot?.cost ?? prize.cost);
  if (asNumber(member.gems) < cost) {
    return fail(state, request, 'approve', 'insufficient_gems', 'Not enough gems to redeem this prize.', now);
  }
  const redemptionDate = dateKey(now);
  const periodKey = prizePeriodKey(prize.recurrence, redemptionDate);
  if (prize.recurrence && prize.recurrence !== 'anytime') {
    const alreadyRedeemed = (prize.redemptions || []).some(redemption => {
      if (redemption.memberId !== member.id) return false;
      const redemptionKey = redemption.periodKey || prizePeriodKey(prize.recurrence, redemption.date || redemptionDate);
      return redemptionKey === periodKey;
    });
    if (alreadyRedeemed) {
      return fail(state, request, 'approve', 'prize_window_locked', 'This prize is not available right now.', now);
    }
  }

  const redemption = {
    id: `redemption:${request.id}`,
    requestId: request.id,
    prizeId: prize.id,
    memberId: member.id,
    cost,
    date: redemptionDate,
    periodKey,
    redeemedAt: now,
    approvedByMemberId: actorMemberId,
  };
  const updatedMember = { ...member, gems: asNumber(member.gems) - cost };
  updatedMember.diamonds = updatedMember.gems;
  const updatedPrize = { ...prize, redemptions: [...(prize.redemptions || []), redemption] };
  const history = makeHistory(request, 'approve', {
    type: 'prize',
    title: String(request.snapshot?.title || prize.title || 'Prize redeemed'),
    gems: -cost,
    metadata: {
      prizeId: prize.id,
      redemptionId: redemption.id,
      approvedByMemberId: actorMemberId,
    },
  }, now);

  let nextState: ApprovalState = {
    ...state,
    membersById: upsertMapRecord(state.membersById, member.id, updatedMember),
    prizesById: upsertMapRecord(state.prizesById, prize.id, updatedPrize),
  };
  nextState = withResolvedRequest(nextState, request, REQUEST_STATUSES.APPROVED, actorMemberId, now);
  nextState = appendHistory(nextState, history);
  const result = createBaseResult(nextState, nextState.requestsById?.[request.id] as ApprovalRequest, 'approve', now);
  result.events.push({ type: 'request.approved', requestId: request.id, kind: request.kind, memberId: request.targetMemberId });
  result.history.push(history);
  return result;
}

function dateKey(now: number): string {
  const date = new Date(now);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function prizePeriodKey(recurrenceValue: unknown, date: string): string {
  const recurrence = String(recurrenceValue || 'anytime');
  if (recurrence === 'one_time') return 'one_time';
  if (recurrence === 'daily') return date;
  if (recurrence === 'weekly') return `w:${startOfWeekKey(date)}`;
  if (recurrence === 'monthly') return `m:${date.slice(0, 7)}`;
  return 'anytime';
}

function startOfWeekKey(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() - parsed.getDay());
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function approveSavingsSpend(state: ApprovalState, request: ApprovalRequest, actorMemberId: string | null, now: number): ApprovalResult {
  const member = getMapRecord(state.membersById, request.targetMemberId);
  if (!member) return fail(state, request, 'approve', 'member_missing', 'Member not found.', now);

  const amount = roundMoney(request.source.amount ?? request.snapshot?.amount);
  if (amount <= 0) return fail(state, request, 'approve', 'invalid_amount', 'Spend amount is invalid.', now);
  if (roundMoney(member.savings) < amount) {
    return fail(state, request, 'approve', 'insufficient_savings', 'Savings balance changed. Please try again.', now);
  }

  const updatedMember = {
    ...reduceSavingsBuckets(member, amount),
    savings: roundMoney(asNumber(member.savings) - amount),
  };
  const history = makeHistory(request, 'approve', {
    type: 'savings_withdraw',
    title: request.source.reason ? `Spent: ${request.source.reason}` : 'Savings withdrawal approved',
    amount,
    metadata: {
      approvedByMemberId: actorMemberId,
      reason: request.source.reason || '',
      savingsBucketsBefore: {
        savingsGifted: roundMoney(member.savingsGifted),
        savingsMatched: roundMoney(member.savingsMatched),
        savingsInterest: roundMoney(member.savingsInterest),
      },
    },
  }, now);

  let nextState: ApprovalState = {
    ...state,
    membersById: upsertMapRecord(state.membersById, member.id, updatedMember),
  };
  nextState = withResolvedRequest(nextState, request, REQUEST_STATUSES.APPROVED, actorMemberId, now);
  nextState = appendHistory(nextState, history);
  const result = createBaseResult(nextState, nextState.requestsById?.[request.id] as ApprovalRequest, 'approve', now);
  result.events.push({ type: 'request.approved', requestId: request.id, kind: request.kind, memberId: request.targetMemberId });
  result.history.push(history);
  return result;
}
