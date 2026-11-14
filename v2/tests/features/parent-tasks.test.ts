import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskEditorDraft, renderTaskEditorModal } from '../../src/features/parent-tasks/view';
import { type AppState } from '../../src/app/app-state';

const emptyState: AppState = {
  member: { id: 'parent_1', role: 'parent' },
  members: [{ id: 'kid_1', role: 'kid', name: 'Maya' }],
  tasks: [],
  prizes: [],
  teamGoals: [],
  settings: {},
  request: null,
  requests: [],
  completions: [],
  completion: null,
  operation: null,
  history: null,
  historyRows: [],
};

test('task editor retains legacy per-day windows and makes them editable', () => {
  const draft = createTaskEditorDraft({
    id: 'task_1',
    title: 'Brush teeth',
    assignedTo: ['kid_1'],
    schedule: { period: 'day', targetCount: 2, daysOfWeek: [1, 2], windows: { 1: { start: '07:00', end: '08:00' } } },
  });
  const markup = renderTaskEditorModal(emptyState, draft, 'edit');
  assert.match(markup, /id="task-period"/);
  assert.match(markup, /data-task-window-start="1" value="07:00"/);
  assert.match(markup, /data-task-day="1" checked/);
  assert.match(markup, /data-task-window-end="1" value="08:00"/);
});

test('task editor includes timed-slot controls for tasks with scheduled slots', () => {
  const draft = createTaskEditorDraft({
    id: 'task_2',
    title: 'Feed dog',
    assignedTo: ['kid_1'],
    schedule: { period: 'day', targetCount: 1, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], slots: [{ id: 'morning', label: 'Morning', start: '06:00', end: '08:00' }] },
  });
  const markup = renderTaskEditorModal(emptyState, draft, 'edit');
  assert.match(markup, /Timed slots/);
  assert.match(markup, /data-task-slot-label="0"[^>]*value="Morning"/);
  assert.match(markup, /data-task-slot-start="0"[^>]*value="06:00"/);
});
