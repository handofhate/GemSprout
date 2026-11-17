import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrizeEditorDraft, normalizePrizeCost, renderPrizeEditorModal } from '../../src/features/parent-prizes/view';
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

test('prize editor preserves a zero-gem cost', () => {
  const draft = createPrizeEditorDraft({
    id: 'prize_1',
    title: 'Daily screen time',
    cost: 0,
    requirementType: 'task_count',
    requirementTaskCount: 3,
  });

  assert.equal(draft.cost, 0);
  assert.equal(normalizePrizeCost('0', 100), 0);
  assert.equal(normalizePrizeCost('', 25), 25);
  assert.match(renderPrizeEditorModal(emptyState, draft), /id="prize-cost" min="0" value="0"/);
});
