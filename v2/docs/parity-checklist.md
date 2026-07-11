# Parity Checklist

Core workflows v2 must preserve before release.

## Visual and Interaction Parity

- Preserve v1 customer-facing styling 100% unless a visual change is explicitly approved.
- Use `v2/src/ui/styles/v1-parity.css` as the source-of-truth stylesheet copied from root `style.css`.
- Keep v1 class names when porting screens so existing icons, animation hooks, responsive rules, swipe reveals, modals, celebrations, and badge effects continue to apply.
- Treat new v2-only styling as temporary test/development UI unless it is part of a faithful v1 port.
- Port swipe gestures, quick action fan behavior, modal open/close animation, pull-to-refresh, celebration effects, badge tilt, and story/week-review animation before considering the related screen complete.

## Current Migration Status

As of 2026-07-10:

- Parent dashboard overview, settings panes, inbox rows, recent activity, snapshot cards, quick actions, task/prize/team-prize creation modals, family stats visuals, account/security settings, notification settings, and Week in Review are largely migrated.
- Parent inbox approve/deny, recent activity undo, auto-approve tasks, savings banking, split-household home/away controls, levels, streaks, Daily Combo, base badges, and task badges are wired for the dev Firestore path.
- Regular kid dashboard is largely migrated across Tasks, Gems, Shop, Team, Stats, kid settings, badge cards, approval/denial/reward pop-up modals, savings requests, prize requests, and little kid TTS hooks.
- Little kid mode is migrated across Tasks, Gems, Shop, Team, and Stats with large simplified visuals and TTS.
- Landing, returning sign-in, kid entry/profile picker, onboarding/setup panes, join different family, edit family, and parent/kid routing are in place for current dev testing.
- v1 loading screen is available in v2 via `renderLoadingScreen()`.
- The next major parity target is the readiness pass: missing native/subscription/storage pieces, real multi-device sync behavior, and on-device verification.

## Parent

- Create and edit kids.
- Create, edit, complete, undo, and delete chores.
- Approve and deny chore submissions. Current v2 parent overview supports optimistic inbox removal, recent activity insertion, totals/snapshot updates, undo, and serialized Firestore writes.
- Create and manage prizes.
- Approve and deny prize requests.
- Approve and deny savings spend requests.
- View family inbox and history.
- Link, switch, and unlink parent sign-in providers.
- Delete account with v1 warning/confirm copy. Still needs release-grade reauthentication handling before App Store submission.

## Kid

- Complete chores, including daily combos and time-slot selection.
- Submit before and after photo flows.
- Redeem prizes.
- Request parent approval for gated prizes.
- Request savings spend approval.
- See approval celebrations and decline outcomes.
- Little kid mode must keep v1 TTS behavior and use the legacy-compatible `tiny` persisted value.

## System

- Sync across devices without duplicate rewards or history.
- Push notifications route to the correct screen.
- Offline or failed writes recover without silent data loss.
- Subscription state does not block account and data controls.
- RevenueCat subscription/paywall/restore/manage behavior matches v1.
- Parent push remains parent-only; kid devices use in-app pop-up modals for approvals, denials, savings, prizes, and badges.
- Camera/photo submissions store durable image URLs, not only in-memory or data URL previews.
- QR and invite flows work on iPhone, with manual code entry kept as the fallback.
