# Architecture

v2 should keep dependencies flowing inward:

UI and features can call app services. App services can call domain, state, sync, and platform adapters. Domain modules should stay pure and must not import UI, Firebase, Capacitor, or browser APIs.

## Proposed Layers

- Domain: pure functions and data normalization.
- State: local app state, action dispatch, optimistic updates, undo coordination.
- Sync: Firestore persistence, transaction boundaries, conflict handling, migrations.
- Platform: Firebase Auth, Cloud Functions, Capacitor, RevenueCat, local notifications, push tokens.
- Features: screens and flows composed from the layers above.
- UI: reusable visual components, tokens, layout helpers.

## First Rewrite Target

Start with domain and sync contracts before rebuilding screens. The current v1 pain is not primarily visual; it is state mutation and persistence mixed into rendering.
