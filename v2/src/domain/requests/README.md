# Requests Domain

Unified parent approval model for v2.

This replaces separate ad hoc approval flows for chores, prizes, and savings with one request lifecycle:

- `pending`
- `approved`
- `denied`
- `cancelled`

Current request kinds:

- `chore_start`
- `chore_completion`
- `prize_redeem`
- `savings_spend`

The important v2 rule is that failed approvals do not resolve requests. If a prize cannot be redeemed or a savings balance changed, the request stays pending and the caller receives a recoverable error.

Every approval and denial has deterministic IDs:

- operation: `op:request:approve:{requestId}`
- operation: `op:request:deny:{requestId}`
- history: `history:request:{requestId}:approve`
- history: `history:request:{requestId}:deny`
