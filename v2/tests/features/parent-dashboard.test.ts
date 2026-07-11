import test from 'node:test';
import assert from 'node:assert/strict';
import { createApprovalSeedStore, createApproveOperation } from '../../src/app/approval-lab-scenarios';
import { createDemoFamilySeedStore } from '../../src/app/demo-family-seed';
import { readDemoAppState } from '../../src/app/local-demo-state';
import { commitRequestOperation } from '../../src/platform/firebase';
import { createParentDashboardModel } from '../../src/features/parent-dashboard/model';

test('parent dashboard model exposes pending approval summary', () => {
  const store = createApprovalSeedStore();
  const model = createParentDashboardModel(readDemoAppState(store));

  assert.equal(model.kidName, 'Avery');
  assert.equal(model.gems, 50);
  assert.equal(model.pendingCount, 1);
  assert.equal(model.historyCount, 0);
  assert.equal(model.inboxItems.length, 1);
  assert.equal(model.inboxItems[0]?.title, 'Clean Room');
  assert.equal(model.inboxItems[0]?.canAct, true);
  assert.equal(model.inboxItems[0]?.meta, 'Avery requested chore approval - 7 gems');
});

test('parent dashboard model keeps resolved approvals out of the family inbox', () => {
  const store = createApprovalSeedStore();
  commitRequestOperation(store, createApproveOperation(1760000000000), { now: 1760000000000 });
  const model = createParentDashboardModel(readDemoAppState(store));

  assert.equal(model.gems, 57);
  assert.equal(model.pendingCount, 0);
  assert.equal(model.historyCount, 1);
  assert.equal(model.requestStatus, 'approved');
  assert.equal(model.completionStatus, 'approved');
  assert.equal(model.inboxItems.length, 0);
});

test('parent dashboard model lists chore prize and savings approvals', () => {
  const store = createDemoFamilySeedStore();
  const model = createParentDashboardModel(readDemoAppState(store));

  assert.equal(model.pendingCount, 3);
  assert.deepEqual(model.inboxItems.map(item => item.id), ['request_1', 'request_prize_1', 'request_savings_1']);
  assert.deepEqual(model.inboxItems.map(item => item.title), ['Clean Room', 'Movie Night', 'Book fair']);
  assert.deepEqual(model.inboxItems.map(item => item.tone), ['chore', 'prize', 'savings']);
  assert.equal(model.inboxItems[1]?.meta, 'Avery requested prize approval - 30 gems');
  assert.equal(model.inboxItems[2]?.meta, 'Avery requested savings spend - $6.50');
});
