const { test, expect } = require('@playwright/test');

async function seedUiFlowState(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => typeof window.defaultData === 'function' && typeof window.normalizeData === 'function');
  return page.evaluate(() => {
    window.speak = () => {};
    window.launchConfetti = () => {};
    saveData = () => {};

    const data = normalizeData(defaultData());
    D = data;
    data.setup = true;
    data.history = [];
    data.prizes = [];
    data.chores = [];
    data.settings.comboEnabled = true;
    data.settings.comboOverrides = {};

    const parent = normalizeMember({
      id: 'parent_1',
      name: 'Parent User',
      role: 'parent',
      color: '#6C63FF',
      avatarColor: '#6C63FF',
      gems: 0,
      authUid: 'test-parent-auth',
      authProviders: [{ providerId: 'google.com', uid: 'test-parent-auth', email: 'parent@example.com' }],
    });
    const kid = normalizeMember({
      id: 'kid_1',
      name: 'Kid User',
      role: 'kid',
      color: '#F59E0B',
      avatarColor: '#F59E0B',
      gems: 0,
    });

    const mkChore = (id, title) => normalizeChore({
      id,
      title,
      icon: 'star',
      iconColor: '#6C63FF',
      gems: 10,
      frequency: 'day',
      assignedTo: [kid.id],
      completions: {},
    });

    data.family.name = 'UI Test Family';
    data.family.members = [parent, kid];
    data.chores = [mkChore('c1', 'Task One'), mkChore('c2', 'Task Two'), mkChore('c3', 'Task Three')];
    window.__uiSeedData = JSON.stringify(data);

    setParentAuthUid('test-parent-auth');
    setCurrentUserId(parent.id);
    setAppUnlocked(true);

    S.currentUser = parent;
    S.parentTab = 'prizes';
    S.kidTab = 'shop';
    showScreen('screen-parent');
    renderParentHeader();
    renderParentNav();
    renderParentTab();

    window.__uiFlow = { parentId: parent.id, kidId: kid.id };
    return window.__uiFlow;
  });
}

test.describe('@ui UI prize flow with clicks', () => {
  test('parent creates gated recurring prize via modal clicks', async ({ page }) => {
    await seedUiFlowState(page);

    await page.locator('#parent-nav button', { hasText: 'Prizes' }).click();
    await page.locator('#parent-content .section-row').first().getByRole('button', { name: '+ Add' }).click();

    await page.fill('#pm-title', 'UI Click Prize');
    await page.fill('#pm-cost', '0');
    await page.selectOption('#pm-recurrence', 'daily');
    await page.locator('label:has-text("Additional requirements") .toggle-track').click();
    await page.selectOption('#pm-requirement-type', 'specific_tasks');
    await page.locator('label:has-text("Task One") .toggle-track').click();
    await page.locator('label:has-text("Task Two") .toggle-track').click();
    await page.getByRole('button', { name: /^Save/ }).click();

    await expect(page.locator('#parent-content')).toContainText('UI Click Prize');
    await expect(page.locator('#parent-content')).toContainText('Once per day');
    const parentContentText = await page.locator('#parent-content').innerText();
    expect(parentContentText).toMatch(/Requires specific tasks today|Requires: Task One \+ Task Two/);
  });

  test('kid redemption click flow enforces requirements then redeems', async ({ page }) => {
    const { kidId } = await seedUiFlowState(page);

    const ensureKidShopScreen = async () => {
      await page.evaluate(() => {
        let kid = getMember(window.__uiFlow.kidId);
        if (!kid && window.__uiSeedData) {
          D = normalizeData(JSON.parse(window.__uiSeedData));
          setParentAuthUid('test-parent-auth');
          kid = getMember(window.__uiFlow.kidId);
        }
        if (!kid) return;
        if (!document.getElementById('screen-kid')?.classList.contains('active')) {
          S.currentUser = kid;
          setCurrentUserId(kid.id);
          showScreen('screen-kid');
          renderKidView();
        }
        if (S.kidTab !== 'shop') switchKidTab('shop');
      });
    };

    await page.evaluate(() => {
      D.prizes.push(normalizePrize({
        id: 'ui_prize_1',
        title: 'Screen Time Unlock',
        icon: 'television',
        iconColor: '#45B7D1',
        cost: 0,
        type: 'individual',
        recurrence: 'daily',
        requirementType: 'specific_tasks',
        requirementTaskIds: ['c1', 'c2'],
        redemptions: [],
      }));
      window.__uiSeedData = JSON.stringify(D);
      const kid = getMember(window.__uiFlow.kidId);
      S.currentUser = kid;
      setCurrentUserId(kid.id);
      showScreen('screen-kid');
      renderKidView();
      switchKidTab('shop');
    });

    await ensureKidShopScreen();
    await page.locator('.kid-shop-prize-card', { hasText: 'Screen Time Unlock' }).click();
    await expect(page.locator('.toast').last()).toContainText('Finish 2 required tasks today');

    await page.evaluate(({ kidId }) => {
      const chore = D.chores.find(c => c.id === 'c1');
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
      renderKidTab();
    }, { kidId });

    await ensureKidShopScreen();
    await page.locator('.kid-shop-prize-card', { hasText: 'Screen Time Unlock' }).click();
    await expect(page.locator('.toast').last()).toContainText('Finish "Task Two" today');

    await page.evaluate(({ kidId }) => {
      const chore = D.chores.find(c => c.id === 'c2');
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
      renderKidTab();
    }, { kidId });

    await ensureKidShopScreen();
    await page.locator('.kid-shop-prize-card', { hasText: 'Screen Time Unlock' }).click();
    await expect(page.locator('#modal-root')).toContainText('Redeem Prize?');
    await page.getByRole('button', { name: /Yes, redeem!/ }).click();

    await expect(page.locator('.cel-title')).toHaveText('Prize Unlocked!');
    await page.getByRole('button', { name: /Yay!/ }).click();
  });
});
