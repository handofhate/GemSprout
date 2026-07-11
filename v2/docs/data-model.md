# Data Model

This document will become the source of truth for v2 persistence.

## Direction

Prefer smaller records and explicit operations over one broad family document.

Potential collections:

- `families/{familyId}` - family identity and low-churn settings.
- `families/{familyId}/members/{memberId}` - parent and kid profiles.
- `families/{familyId}/chores/{choreId}` - task definitions.
- `families/{familyId}/completions/{completionId}` - task completion events.
- `families/{familyId}/prizes/{prizeId}` - prize definitions.
- `families/{familyId}/requests/{requestId}` - chore, prize, and savings approvals.
- `families/{familyId}/history/{historyId}` - activity history.
- `families/{familyId}/operations/{operationId}` - idempotency and conflict tracking.
- `users/{uid}` - auth to family lookup, push tokens, and account metadata.

## Non-Negotiables

- Every user action that can be retried must have a deterministic operation ID.
- Every history entry created by a retried action must have a deterministic history ID.
- Account deletion must prove Firebase Auth deletion or clearly require reauthentication before destructive data deletion.
- Migration must preserve v1 history, balances, requests, prize redemptions, and parent auth links.

## Approval Spine

v2 uses one request model for parent-mediated decisions. Chore, prize, and savings approvals should not each invent their own status lifecycle.

### Request Record

Stored at `families/{familyId}/requests/{requestId}`.

```js
{
  id: 'request_123',
  familyId: 'family_123',
  kind: 'chore_completion', // chore_start, chore_completion, prize_redeem, savings_spend
  status: 'pending', // pending, approved, denied, cancelled
  requesterMemberId: 'kid_1',
  targetMemberId: 'kid_1',
  createdAt: 1760000000000,
  resolvedAt: null,
  resolvedByMemberId: null,
  source: {
    choreId: 'chore_1',
    completionId: 'completion_1',
    prizeId: null,
    amount: null,
    reason: ''
  },
  snapshot: {
    title: 'Clean Room',
    points: 20,
    cost: 0,
    currency: '$'
  }
}
```

### Request Rules

- A failed approval does not resolve the request.
- A retry of the same approval uses the same operation ID: `op:request:approve:{requestId}`.
- A retry of the same denial uses the same operation ID: `op:request:deny:{requestId}`.
- Request-created history IDs are deterministic:
  - `history:request:{requestId}:approve`
  - `history:request:{requestId}:deny`
- Domain approval functions must be pure. They receive state and return next state plus generated events.
- Notifications are emitted as events from domain results and delivered by platform adapters later.

### Initial Request Kinds

- `chore_start` - parent approves the before-photo/start phase; no reward is paid.
- `chore_completion` - parent approves completed work; gems and history are applied.
- `prize_redeem` - parent approves a gated prize redemption; gems are spent and redemption history is applied.
- `savings_spend` - parent approves a savings withdrawal request; savings is reduced and history is applied.

## Operation Records

Stored at `families/{familyId}/operations/{operationId}`.

Operations are the idempotency layer between UI taps and state changes. They are not just logs; they are the durable record that a retryable action has already been applied or failed.

```js
{
  id: 'op:request:approve:request_123',
  familyId: 'family_123',
  kind: 'request.approve',
  status: 'applied', // pending, applied, failed
  actorMemberId: 'parent_1',
  requestId: 'request_123',
  createdAt: 1760000000000,
  appliedAt: 1760000000100,
  failedAt: null,
  payload: {
    requestId: 'request_123'
  },
  result: {
    ok: true,
    historyIds: ['history:request:request_123:approve'],
    eventTypes: ['request.approved']
  },
  error: null
}
```

### Operation Rules

- Applied operations are never applied again.
- Failed operations are recorded, but the underlying request remains pending unless the domain action explicitly resolved it.
- Operation IDs must be deterministic for actions that can be retried.
- History records remain first-class records and include links back to the operation or request that created them.

### Firestore Transaction Shape

Request approval transactions should read:

- `families/{familyId}/operations/{operationId}`
- `families/{familyId}/requests/{requestId}`

Then write only touched records:

- `families/{familyId}/operations/{operationId}`
- `families/{familyId}/requests/{requestId}`
- `families/{familyId}/members/{memberId}` when balances change
- `families/{familyId}/completions/{completionId}` when chore completion status changes
- `families/{familyId}/prizes/{prizeId}` when redemptions change
- `families/{familyId}/history/{historyId}` for generated first-class history records

The transaction must not write a broad family document.
