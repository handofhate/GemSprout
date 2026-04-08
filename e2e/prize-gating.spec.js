const { test, expect } = require('@playwright/test');

async function bootstrapPrizeTestState(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => typeof window.defaultData === 'function' && typeof window.normalizeData === 'function');
  return page.evaluate(() => {
    saveData = () => {};
    const data = normalizeData(defaultData());
    data.history = [];
    data.prizes = [];
    data.chores = [];

    const kid = normalizeMember({
      id: 'kid_1',
      name: 'Test Kid',
      role: 'kid',
      gems: 0,
      diamonds: 0,
      totalEarned: 0,
      savings: 0,
      color: '#6C63FF',
      avatarColor: '#6C63FF',
    });
    kid.gems = 0;
    kid.diamonds = 0;
    data.family.members = [kid];

    const mkChore = (id, title) => normalizeChore({
      id,
      title,
      icon: 'star',
      iconColor: '#6C63FF',
      gems: 5,
      frequency: 'day',
      assignedTo: [kid.id],
      completions: {},
    });

    const chores = [
      mkChore('c1', 'Task One'),
      mkChore('c2', 'Task Two'),
      mkChore('c3', 'Task Three'),
      mkChore('c4', 'Task Four'),
    ];
    data.chores = chores;
    data.settings.comboEnabled = true;
    data.settings.comboOverrides = {
      [kid.id]: { date: today(), ids: ['c1', 'c2', 'c3'] },
    };
    window.__prizeState = data;

    return { kidId: kid.id, choreIds: chores.map(c => c.id) };
  });
}

test.describe('Prize gating and recurrence', () => {
  test('supports zero-gem prize redemption', async ({ page }) => {
    const { kidId } = await bootstrapPrizeTestState(page);
    const result = await page.evaluate(({ kidId }) => {
      const data = window.__prizeState;
      D = data;
      const kid = getMember(kidId);
      const startingGems = kid.gems;
      data.prizes.push(normalizePrize({
        id: 'p0',
        title: 'Free Reward',
        icon: 'gift',
        iconColor: '#FF6584',
        cost: 0,
        type: 'individual',
        recurrence: 'anytime',
        requirementType: 'none',
        redemptions: [],
      }));
      const redeem = doRedeemPrize('p0', kidId);
      return {
        redeem,
        startingGems,
        endingGems: getMember(kidId).gems,
        redemptions: data.prizes.find(p => p.id === 'p0').redemptions.length,
      };
    }, { kidId });

    expect(result.redeem.ok).toBe(true);
    expect(result.startingGems).toBe(0);
    expect(result.endingGems).toBe(0);
    expect(result.redemptions).toBe(1);
  });

  test('requires task count AND gems before redeeming', async ({ page }) => {
    const { kidId } = await bootstrapPrizeTestState(page);
    const result = await page.evaluate(({ kidId }) => {
      const data = window.__prizeState;
      D = data;
      const kid = getMember(kidId);
      kid.gems = 10;
      data.prizes.push(normalizePrize({
        id: 'p_task_count',
        title: 'Task Count Prize',
        icon: 'gift',
        iconColor: '#FF6584',
        cost: 10,
        type: 'individual',
        recurrence: 'anytime',
        requirementType: 'task_count',
        requirementTaskCount: 2,
        redemptions: [],
      }));

      const markDone = (choreId) => {
        const chore = data.chores.find(c => c.id === choreId);
        chore.completions[kidId] = chore.completions[kidId] || [];
        chore.completions[kidId].push({
          id: genId(),
          status: 'done',
          date: today(),
          createdAt: Date.now(),
          slotId: null,
          photoUrl: null,
          entryType: null,
        });
      };

      const statusBefore = getPrizeRedeemStatus(data.prizes.find(p => p.id === 'p_task_count'), kidId);
      markDone('c1');
      const statusAfterOne = getPrizeRedeemStatus(data.prizes.find(p => p.id === 'p_task_count'), kidId);
      markDone('c2');
      const statusAfterTwo = getPrizeRedeemStatus(data.prizes.find(p => p.id === 'p_task_count'), kidId);
      const redeem = doRedeemPrize('p_task_count', kidId);

      return {
        statusBefore,
        statusAfterOne,
        statusAfterTwo,
        redeem,
        endingGems: getMember(kidId).gems,
      };
    }, { kidId });

    expect(result.statusBefore.ok).toBe(false);
    expect(result.statusBefore.reason).toBe('task_count');
    expect(result.statusAfterOne.ok).toBe(false);
    expect(result.statusAfterTwo.ok).toBe(true);
    expect(result.redeem.ok).toBe(true);
    expect(result.endingGems).toBe(0);
  });

  test('requires combo completion before redemption', async ({ page }) => {
    const { kidId } = await bootstrapPrizeTestState(page);
    const result = await page.evaluate(({ kidId }) => {
      const data = window.__prizeState;
      D = data;
      data.prizes.push(normalizePrize({
        id: 'p_combo',
        title: 'Combo Prize',
        icon: 'gift',
        iconColor: '#FF6584',
        cost: 0,
        type: 'individual',
        recurrence: 'anytime',
        requirementType: 'combo',
        redemptions: [],
      }));

      const markDone = (choreId) => {
        const chore = data.chores.find(c => c.id === choreId);
        chore.completions[kidId] = chore.completions[kidId] || [];
        chore.completions[kidId].push({
          id: genId(),
          status: 'done',
          date: today(),
          createdAt: Date.now(),
          slotId: null,
          photoUrl: null,
          entryType: null,
        });
      };

      const statusBefore = getPrizeRedeemStatus(data.prizes.find(p => p.id === 'p_combo'), kidId);
      markDone('c1');
      markDone('c2');
      const statusPartial = getPrizeRedeemStatus(data.prizes.find(p => p.id === 'p_combo'), kidId);
      markDone('c3');
      const statusDone = getPrizeRedeemStatus(data.prizes.find(p => p.id === 'p_combo'), kidId);
      const redeem = doRedeemPrize('p_combo', kidId);

      return { statusBefore, statusPartial, statusDone, redeem };
    }, { kidId });

    expect(result.statusBefore.ok).toBe(false);
    expect(result.statusBefore.reason).toBe('combo');
    expect(result.statusPartial.ok).toBe(false);
    expect(result.statusDone.ok).toBe(true);
    expect(result.redeem.ok).toBe(true);
  });

  test('enforces recurrence caps for daily weekly and monthly', async ({ page }) => {
    const { kidId } = await bootstrapPrizeTestState(page);
    const result = await page.evaluate(({ kidId }) => {
      const data = window.__prizeState;
      D = data;
      const mkPrize = (id, recurrence) => normalizePrize({
        id,
        title: `${recurrence} prize`,
        icon: 'gift',
        iconColor: '#FF6584',
        cost: 0,
        type: 'individual',
        recurrence,
        requirementType: 'none',
        redemptions: [],
      });
      data.prizes.push(mkPrize('p_daily', 'daily'));
      data.prizes.push(mkPrize('p_weekly', 'weekly'));
      data.prizes.push(mkPrize('p_monthly', 'monthly'));

      const dailyFirst = doRedeemPrize('p_daily', kidId);
      const dailySecond = doRedeemPrize('p_daily', kidId);
      const weeklyFirst = doRedeemPrize('p_weekly', kidId);
      const weeklySecond = doRedeemPrize('p_weekly', kidId);
      const monthlyFirst = doRedeemPrize('p_monthly', kidId);
      const monthlySecond = doRedeemPrize('p_monthly', kidId);

      return {
        dailyFirst,
        dailySecond,
        weeklyFirst,
        weeklySecond,
        monthlyFirst,
        monthlySecond,
      };
    }, { kidId });

    expect(result.dailyFirst.ok).toBe(true);
    expect(result.dailySecond.ok).toBe(false);
    expect(result.dailySecond.reason).toBe('window_locked');
    expect(result.weeklyFirst.ok).toBe(true);
    expect(result.weeklySecond.ok).toBe(false);
    expect(result.weeklySecond.reason).toBe('window_locked');
    expect(result.monthlyFirst.ok).toBe(true);
    expect(result.monthlySecond.ok).toBe(false);
    expect(result.monthlySecond.reason).toBe('window_locked');
  });

  test('enforces one-time redemption as permanently locked until reset', async ({ page }) => {
    const { kidId } = await bootstrapPrizeTestState(page);
    const result = await page.evaluate(({ kidId }) => {
      const data = window.__prizeState;
      D = data;
      data.prizes.push(normalizePrize({
        id: 'p_one_time',
        title: 'One Time Prize',
        icon: 'gift',
        iconColor: '#FF6584',
        cost: 0,
        type: 'individual',
        recurrence: 'one_time',
        requirementType: 'none',
        redemptions: [],
      }));
      const first = doRedeemPrize('p_one_time', kidId);
      const second = doRedeemPrize('p_one_time', kidId);
      return { first, second };
    }, { kidId });

    expect(result.first.ok).toBe(true);
    expect(result.second.ok).toBe(false);
    expect(result.second.reason).toBe('one_time_locked');
  });

  test('task count requirement counts first completion of multi-step tasks', async ({ page }) => {
    const { kidId } = await bootstrapPrizeTestState(page);
    const result = await page.evaluate(({ kidId }) => {
      const data = window.__prizeState;
      D = data;
      const c1 = data.chores.find(c => c.id === 'c1');
      c1.schedule.targetCount = 2;
      c1.repeatCount = 2;

      data.prizes.push(normalizePrize({
        id: 'p_multi_task_count',
        title: 'Multi Task Count',
        icon: 'gift',
        iconColor: '#FF6584',
        cost: 0,
        type: 'individual',
        recurrence: 'anytime',
        requirementType: 'task_count',
        requirementTaskCount: 2,
        redemptions: [],
      }));

      const markDone = (choreId) => {
        const chore = data.chores.find(c => c.id === choreId);
        chore.completions[kidId] = chore.completions[kidId] || [];
        chore.completions[kidId].push({
          id: genId(),
          status: 'done',
          date: today(),
          createdAt: Date.now(),
          slotId: null,
          photoUrl: null,
          entryType: null,
        });
      };

      markDone('c1'); // 1/2: should count for requirements
      markDone('c2'); // full 1/1
      const statusPartial = getPrizeRedeemStatus(data.prizes.find(p => p.id === 'p_multi_task_count'), kidId);
      markDone('c1'); // now c1 is 2/2
      const statusFull = getPrizeRedeemStatus(data.prizes.find(p => p.id === 'p_multi_task_count'), kidId);

      return { statusPartial, statusFull };
    }, { kidId });

    expect(result.statusPartial.ok).toBe(true);
    expect(result.statusFull.ok).toBe(true);
  });

  test('combo requirement counts first completion for multi-step combo tasks', async ({ page }) => {
    const { kidId } = await bootstrapPrizeTestState(page);
    const result = await page.evaluate(({ kidId }) => {
      const data = window.__prizeState;
      D = data;
      const c1 = data.chores.find(c => c.id === 'c1');
      c1.schedule.targetCount = 2;
      c1.repeatCount = 2;

      data.prizes.push(normalizePrize({
        id: 'p_multi_combo',
        title: 'Multi Combo Prize',
        icon: 'gift',
        iconColor: '#FF6584',
        cost: 0,
        type: 'individual',
        recurrence: 'anytime',
        requirementType: 'combo',
        redemptions: [],
      }));

      const markDone = (choreId) => {
        const chore = data.chores.find(c => c.id === choreId);
        chore.completions[kidId] = chore.completions[kidId] || [];
        chore.completions[kidId].push({
          id: genId(),
          status: 'done',
          date: today(),
          createdAt: Date.now(),
          slotId: null,
          photoUrl: null,
          entryType: null,
        });
      };

      markDone('c1'); // 1/2 should count toward combo requirement
      markDone('c2');
      markDone('c3');
      const statusPartial = getPrizeRedeemStatus(data.prizes.find(p => p.id === 'p_multi_combo'), kidId);
      markDone('c1'); // 2/2
      const statusFull = getPrizeRedeemStatus(data.prizes.find(p => p.id === 'p_multi_combo'), kidId);

      return { statusPartial, statusFull };
    }, { kidId });

    expect(result.statusPartial.ok).toBe(true);
    expect(result.statusFull.ok).toBe(true);
  });
});
