# Domain

Pure business logic for GemSprout.

Rules in this folder should be deterministic and easy to test without a browser, Firebase, Capacitor, or localStorage.

First implemented slice:

- `requests/` - unified parent approval model for chores, prizes, and savings.
- `history/ids.ts` - deterministic operation and history IDs for retried request actions.
