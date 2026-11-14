import test from 'node:test';
import assert from 'node:assert/strict';
import { createParentDashboardModel } from '../../src/features/parent-dashboard/model';
import { renderParentNav } from '../../src/features/parent-dashboard/view';
import { renderParentQuickLaunch } from '../../src/features/parent-dashboard/quick-actions';
import { renderWeekReviewLaunchCard } from '../../src/features/week-review/view';
import { type AppState } from '../../src/app/app-state';
import { renderParentSnapshotModal } from '../../src/features/parent-dashboard/view';
import { todayKeyForTimezone } from '../../src/app/date-keys';

function state(requestStatuses: string[]): AppState {
  return {
    member: { id: 'parent_1', role: 'parent' },
    members: [{ id: 'parent_1', role: 'parent' }, { id: 'kid_1', role: 'kid', name: 'Maya' }],
    tasks: [],
    prizes: [],
    teamGoals: [],
    settings: {},
    request: null,
    requests: requestStatuses.map((status, index) => ({ id: `request_${index}`, status, kind: 'chore_completion', targetMemberId: 'kid_1' })),
    completions: [],
    completion: null,
    operation: null,
    history: null,
    historyRows: [],
  };
}

test('parent inbox count and navigation badge use only the visible pending requests', () => {
  const current = createParentDashboardModel(state(['pending', 'approved', 'pending']));
  assert.equal(current.pendingCount, current.inboxItems.length);
  assert.equal(current.pendingCount, 2);
  assert.match(renderParentNav('overview', current.pendingCount), /<span class="nav-badge">2<\/span>/);

  const cleared = createParentDashboardModel(state(['approved', 'denied']));
  assert.equal(cleared.pendingCount, 0);
  assert.doesNotMatch(renderParentNav('overview', cleared.pendingCount), /nav-badge/);
});

test('family control center keeps its quick-actions button separate from Week in Review', () => {
  const markup = renderParentQuickLaunch(state([]));
  assert.match(markup, /data-parent-quick-trigger/);
  assert.doesNotMatch(markup, /data-week-review-open/);
});

test('Week in Review has its hand-tap shortcut in the stats card header', () => {
  const markup = renderWeekReviewLaunchCard(state([]));
  assert.match(markup, /week-review-launch-card/);
  assert.match(markup, /class="hero-quick-trigger stats-week-review-open" data-week-review-open/);
  assert.match(markup, /ph-hand-tap/);
  assert.match(markup, /aria-label="Open Week in Review"/);
});

test('parent completion totals use current-day task records, not lifetime activity history', () => {
  const current = state([]);
  const today = todayKeyForTimezone();
  current.tasks = [
    { id: 'task_done', title: 'Make bed', gems: 2, assignedTo: ['kid_1'], schedule: { period: 'day', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] } },
    { id: 'task_open', title: 'Read', gems: 1, assignedTo: ['kid_1'], schedule: { period: 'day', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] } },
  ];
  current.completions = [{ id: 'completion_today', choreId: 'task_done', memberId: 'kid_1', status: 'approved', date: today, entryType: 'after' }];
  current.historyRows = [
    { id: 'old_1', memberId: 'kid_1', type: 'chore', title: 'Old task', createdAt: 1 },
    { id: 'old_2', memberId: 'kid_1', type: 'request.approved', title: 'Another old task', createdAt: 2 },
  ];

  const model = createParentDashboardModel(current);
  assert.equal(model.finishedToday, 1);
  assert.equal(model.snapshots[0].completeCount, 1);
  assert.equal(model.snapshots[0].totalTasks, 2);
});

test('parent kid snapshot includes assigned tasks and direct completion actions', () => {
  const current = state([]);
  current.tasks = [{ id: 'task_open', title: 'Read a book', gems: 3, assignedTo: ['kid_1'], schedule: { period: 'day', daysOfWeek: [0, 1, 2, 3, 4, 5, 6] } }];
  const markup = renderParentSnapshotModal(current, 'kid_1');
  assert.match(markup, /Tasks/);
  assert.match(markup, /Read a book/);
  assert.match(markup, /data-parent-task-complete="task_open"/);
  assert.match(markup, /Recent Activity/);
});
