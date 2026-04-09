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

  test('parent mark-done clears before/after in-progress phase', async ({ page }) => {
    const { kidId } = await bootstrapState(page);
    const result = await page.evaluate(({ kidId }) => {
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
      parentMarkChoreDone(chore.id, kidId);
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
    const result = await page.evaluate(({ kidId, parentId }) => {
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
      approvePrizeRequest(req.id, null);

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
});
