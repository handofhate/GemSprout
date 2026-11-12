import test from 'node:test';
import assert from 'node:assert/strict';
import { createParentDashboardModel } from '../../src/features/parent-dashboard/model';
import { renderParentNav } from '../../src/features/parent-dashboard/view';
import { type AppState } from '../../src/app/app-state';

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
