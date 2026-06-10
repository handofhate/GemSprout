const { test, expect } = require('@playwright/test');

async function bootstrapState(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => typeof window.defaultData === 'function' && typeof window.normalizeData === 'function');
  return page.evaluate(() => {
    window.speak = () => {};
    window.launchConfetti = () => {};
    saveData = () => {};

    const data = normalizeData(defaultData());
    data.setup = true;
    data.history = [];
    data.prizes = [];
    data.chores = [];
    data.settings.autoApprove = false;
    data.settings.comboEnabled = true;
    data.settings.comboOverrides = {};

    const parent = normalizeMember({
      id: 'parent_1',
      name: 'Parent',
      role: 'parent',
      authUid: 'test-parent-auth',
      authProviders: [{ providerId: 'google.com', uid: 'test-parent-auth', email: 'parent@example.com' }],
    });
    const kid = normalizeMember({
      id: 'kid_1',
      name: 'Kid',
      role: 'kid',
      gems: 0,
      diamonds: 0,
      totalEarned: 0,
    });

    data.family.members = [parent, kid];
    D = data;
    setParentAuthUid('test-parent-auth');
    setCurrentUserId(parent.id);
    setAppUnlocked(true);
    S.currentUser = parent;
    S.parentTab = 'home';
    showScreen('screen-parent');
    renderParentHeader();
    renderParentNav();
    renderParentTab();

    return { parentId: parent.id, kidId: kid.id };
  });
}

test.describe('State regressions', () => {
  test('editing task gems persists the updated value', async ({ page }) => {
    await bootstrapState(page);
    const result = await page.evaluate(() => {
      const chore = normalizeChore({
        id: 'chore_1',
        title: 'Brush Teeth',
        icon: 'tooth',
        iconColor: '#6BCB77',
        gems: 10,
        assignedTo: ['kid_1'],
        completions: {},
      });
      D.chores.push(chore);

      const existing = D.chores.find(c => c.id === 'chore_1');
      D.chores[0] = normalizeChore({ ...existing, gems: 25 });
      return {
        gems: D.chores[0].gems,
        diamonds: D.chores[0].diamonds,
      };
    });

    expect(result.gems).toBe(25);
    expect(result.diamonds).toBe(25);
  });

  test('concurrent kid submission and parent approval preserve both changes', async ({ page }) => {
    await bootstrapState(page);
    const result = await page.evaluate(() => {
      const base = normalizeData(defaultData());
      base.setup = true;
      base.history = [];
      base.family.members = [normalizeMember({
        id: 'kid_1', name: 'Kid', role: 'kid', gems: 0, diamonds: 0, totalEarned: 0,
      })];
      base.chores = [
        normalizeChore({
          id: 'chore_approve', title: 'Approve Me', gems: 5, assignedTo: ['kid_1'],
          completions: { kid_1: [{ id: 'entry_approve', status: 'pending', date: today(), createdAt: 1 }] },
        }),
        normalizeChore({
          id: 'chore_submit', title: 'Submit Me', gems: 7, assignedTo: ['kid_1'], completions: {},
        }),
      ];

      const kidSave = cloneData(base);
      kidSave.chores[1].completions.kid_1 = [{
        id: 'entry_submit', status: 'pending', date: today(), createdAt: 2,
        slotId: null, photoUrl: null, entryType: null,
      }];
      const parentSave = cloneData(base);
      parentSave.chores[0].completions.kid_1[0].status = 'done';
      parentSave.family.members[0].gems = 5;
      parentSave.family.members[0].diamonds = 5;
      parentSave.family.members[0].totalEarned = 5;
      parentSave.history.unshift({ id: 'history_approve', type: 'chore', memberId: 'kid_1', title: 'Approve Me', gems: 5, date: today(), createdAt: 3 });

      const parentLandsLast = mergeConcurrentData(base, parentSave, kidSave);
      const kidLandsLast = mergeConcurrentData(base, kidSave, parentSave);
      const summarize = data => ({
        approvedStatus: data.chores[0].completions.kid_1[0].status,
        submittedStatus: data.chores[1].completions.kid_1[0].status,
        gems: data.family.members[0].gems,
        historyIds: data.history.map(entry => entry.id),
      });
      return { parentLandsLast: summarize(parentLandsLast), kidLandsLast: summarize(kidLandsLast) };
    });

    for (const merged of [result.parentLandsLast, result.kidLandsLast]) {
      expect(merged.approvedStatus).toBe('done');
      expect(merged.submittedStatus).toBe('pending');
      expect(merged.gems).toBe(5);
      expect(merged.historyIds).toContain('history_approve');
    }
  });

  test('concurrent approvals add rewards and keep both completion updates', async ({ page }) => {
    await bootstrapState(page);
    const result = await page.evaluate(() => {
      const base = normalizeData(defaultData());
      base.setup = true;
      base.history = [];
      base.family.members = [normalizeMember({
        id: 'kid_1', name: 'Kid', role: 'kid', gems: 0, diamonds: 0, totalEarned: 0,
      })];
      base.chores = [
        normalizeChore({
          id: 'chore_1', title: 'One', gems: 5, assignedTo: ['kid_1'],
          completions: { kid_1: [{ id: 'entry_1', status: 'pending', date: today(), createdAt: 1 }] },
        }),
        normalizeChore({
          id: 'chore_2', title: 'Two', gems: 7, assignedTo: ['kid_1'],
          completions: { kid_1: [{ id: 'entry_2', status: 'pending', date: today(), createdAt: 2 }] },
        }),
      ];
      const first = cloneData(base);
      first.chores[0].completions.kid_1[0].status = 'done';
      first.family.members[0].gems = 5;
      first.family.members[0].diamonds = 5;
      first.family.members[0].totalEarned = 5;
      first.history.unshift({ id: 'history_1', type: 'chore', memberId: 'kid_1', title: 'One', gems: 5, date: today(), createdAt: 3 });

      const second = cloneData(base);
      second.chores[1].completions.kid_1[0].status = 'done';
      second.family.members[0].gems = 7;
      second.family.members[0].diamonds = 7;
      second.family.members[0].totalEarned = 7;
      second.history.unshift({ id: 'history_2', type: 'chore', memberId: 'kid_1', title: 'Two', gems: 7, date: today(), createdAt: 4 });

      const merged = mergeConcurrentData(base, second, first);
      return {
        statuses: merged.chores.map(chore => chore.completions.kid_1[0].status),
        gems: merged.family.members[0].gems,
        diamonds: merged.family.members[0].diamonds,
        totalEarned: merged.family.members[0].totalEarned,
        historyIds: merged.history.map(entry => entry.id),
      };
    });

    expect(result.statuses).toEqual(['done', 'done']);
    expect(result.gems).toBe(12);
    expect(result.diamonds).toBe(12);
    expect(result.totalEarned).toBe(12);
    expect(result.historyIds).toEqual(expect.arrayContaining(['history_1', 'history_2']));
  });

  test('parent mark-done clears before/after in-progress phase', async ({ page }) => {
    const { kidId } = await bootstrapState(page);
    const result = await page.evaluate(async ({ kidId }) => {
      const chore = normalizeChore({
        id: 'chore_before_after',
        title: 'Clean Room',
        icon: 'broom',
        iconColor: '#6BCB77',
        gems: 20,
        photoMode: 'before_after',
        frequency: 'day',
        schedule: { period: 'day', targetCount: 1, daysOfWeek: [0,1,2,3,4,5,6], windows: {}, slots: null },
        assignedTo: [kidId],
        completions: {
          [kidId]: [{
            id: 'before_1',
            status: 'approved',
            date: today(),
            createdAt: Date.now() - 1000,
            slotId: null,
            photoUrl: null,
            entryType: 'before',
          }],
        },
      });
      D.chores.push(chore);

      const phaseBefore = getChorePhotoPhase(chore, kidId)?.phase;
      await parentMarkChoreDone(chore.id, kidId);
      const phaseAfter = getChorePhotoPhase(D.chores.find(c => c.id === chore.id), kidId)?.phase;
      const inProgressCount = inProgressChores().length;

      return { phaseBefore, phaseAfter, inProgressCount };
    }, { kidId });

    expect(result.phaseBefore).toBe('needs_after');
    expect(result.phaseAfter).toBe('complete');
    expect(result.inProgressCount).toBe(0);
  });

  test('doRedeemPrize blocks duplicate daily redemptions even under rapid repeat calls', async ({ page }) => {
    const { kidId } = await bootstrapState(page);
    const result = await page.evaluate(({ kidId }) => {
      const kid = getMember(kidId);
      kid.gems = 0;
      kid.diamonds = 0;
      const prize = normalizePrize({
        id: 'daily_zero_req',
        title: 'Daily Screen Time',
        icon: 'television-simple',
        iconColor: '#FF6584',
        type: 'individual',
        recurrence: 'daily',
        requirementType: 'task_count',
        requirementTaskCount: 5,
        requirementTaskIds: [],
        cost: 0,
        redemptions: [],
      });
      D.prizes.push(prize);

      const mkDone = (id, title) => normalizeChore({
        id,
        title,
        icon: 'star',
        iconColor: '#6C63FF',
        gems: 5,
        frequency: 'day',
        assignedTo: [kidId],
        completions: {
          [kidId]: [{
            id: genId(),
            status: 'done',
            date: today(),
            createdAt: Date.now(),
            slotId: null,
            photoUrl: null,
            entryType: null,
          }],
        },
      });
      D.chores = [
        mkDone('c1', 'One'),
        mkDone('c2', 'Two'),
        mkDone('c3', 'Three'),
        mkDone('c4', 'Four'),
        mkDone('c5', 'Five'),
      ];

      const first = doRedeemPrize(prize.id, kidId);
      const second = doRedeemPrize(prize.id, kidId);
      const third = doRedeemPrize(prize.id, kidId);

      return {
        first,
        second,
        third,
        redemptionCount: D.prizes.find(p => p.id === prize.id).redemptions.length,
      };
    }, { kidId });

    expect(result.first.ok).toBe(true);
    expect(result.second.ok).toBe(false);
    expect(result.third.ok).toBe(false);
    expect(result.redemptionCount).toBe(1);
  });

  test('prize parent-approval flow creates pending request and redeems only after parent approval', async ({ page }) => {
    const { kidId, parentId } = await bootstrapState(page);
    const result = await page.evaluate(async ({ kidId, parentId }) => {
      const kid = getMember(kidId);
      const parent = getMember(parentId);
      kid.gems = 100;
      kid.diamonds = 100;
      D.prizes.push(normalizePrize({
        id: 'p_parent_gate',
        title: 'Parent-Gated Prize',
        icon: 'gift',
        iconColor: '#FF6584',
        cost: 40,
        type: 'individual',
        recurrence: 'anytime',
        requireParentApproval: true,
        requirementType: 'none',
        redemptions: [],
      }));

      S.currentUser = kid;
      submitPrizeRequest('p_parent_gate');
      const pendingCountAfterRequest = pendingPrizeRequests().length;
      const kidGemsAfterRequest = kid.gems;
      const req = pendingPrizeRequests()[0];

      S.currentUser = parent;
      await approvePrizeRequest(req.id, null);

      return {
        pendingCountAfterRequest,
        kidGemsAfterRequest,
        kidGemsAfterApproval: getMember(kidId).gems,
        requestStatus: (D.prizeRequests || []).find(r => r.id === req.id)?.status,
        redemptionCount: (D.prizes.find(p => p.id === 'p_parent_gate')?.redemptions || []).length,
      };
    }, { kidId, parentId });

    expect(result.pendingCountAfterRequest).toBe(1);
    expect(result.kidGemsAfterRequest).toBe(100);
    expect(result.kidGemsAfterApproval).toBe(60);
    expect(result.requestStatus).toBe('approved');
    expect(result.redemptionCount).toBe(1);
  });

  test('processed action ledger makes retried task approval idempotent', async ({ page }) => {
    await bootstrapState(page);
    const result = await page.evaluate(() => {
      const base = normalizeData(defaultData());
      base.setup = true;
      base.history = [];
      base.family.members = [normalizeMember({ id: 'kid_1', name: 'Kid', role: 'kid', gems: 0, diamonds: 0, totalEarned: 0 })];
      base.chores = [normalizeChore({
        id: 'chore_1', title: 'One', gems: 5, assignedTo: ['kid_1'],
        completions: { kid_1: [{ id: 'entry_1', status: 'pending', date: today(), createdAt: 1 }] },
      })];

      const actionId = 'chore-approve:entry_1';
      const first = _applyFamilyActionToData(base, actionId, () => doApproveChore('chore_1', 'kid_1', 'entry_1'));
      const second = _applyFamilyActionToData(first.data, actionId, () => doApproveChore('chore_1', 'kid_1', 'entry_1'));
      return {
        duplicate: second.duplicate,
        gems: second.data.family.members[0].gems,
        historyCount: second.data.history.filter(entry => entry.type === 'chore').length,
        status: second.data.chores[0].completions.kid_1[0].status,
      };
    });

    expect(result.duplicate).toBe(true);
    expect(result.gems).toBe(5);
    expect(result.historyCount).toBe(1);
    expect(result.status).toBe('done');
  });

  test('fresh server validation prevents a second approval with another action id', async ({ page }) => {
    await bootstrapState(page);
    const result = await page.evaluate(() => {
      const base = normalizeData(defaultData());
      base.setup = true;
      base.history = [];
      base.family.members = [normalizeMember({ id: 'kid_1', name: 'Kid', role: 'kid', gems: 0, diamonds: 0, totalEarned: 0 })];
      base.chores = [normalizeChore({
        id: 'chore_1', title: 'One', gems: 5, assignedTo: ['kid_1'],
        completions: { kid_1: [{ id: 'entry_1', status: 'pending', date: today(), createdAt: 1 }] },
      })];

      const first = _applyFamilyActionToData(base, 'approval-device-a', () => doApproveChore('chore_1', 'kid_1', 'entry_1'));
      const second = _applyFamilyActionToData(first.data, 'approval-device-b', () => doApproveChore('chore_1', 'kid_1', 'entry_1'));
      return {
        gems: second.data.family.members[0].gems,
        historyCount: second.data.history.filter(entry => entry.type === 'chore').length,
      };
    });

    expect(result.gems).toBe(5);
    expect(result.historyCount).toBe(1);
  });
});
