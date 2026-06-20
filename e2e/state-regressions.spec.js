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

  test('completed approval keeps a newer optimistic approval visible', async ({ page }) => {
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

      const first = _applyFamilyActionToData(base, 'approve-1', () => doApproveChore('chore_1', 'kid_1', 'entry_1'));
      const second = _applyFamilyActionToData(first.data, 'approve-2', () => doApproveChore('chore_2', 'kid_1', 'entry_2'));
      D = normalizeData(second.data);
      _applyCommittedFamilyData(first.data, first.data);

      return {
        statuses: D.chores.map(chore => chore.completions.kid_1[0].status),
        gems: getMember('kid_1').gems,
        historyCount: D.history.filter(entry => entry.type === 'chore').length,
      };
    });

    expect(result.statuses).toEqual(['done', 'done']);
    expect(result.gems).toBe(12);
    expect(result.historyCount).toBe(2);
  });

  test('live listener snapshots are stale while an approval is in flight', async ({ page }) => {
    await bootstrapState(page);
    const result = await page.evaluate(() => {
      S.lastLocalSave = 0;
      const pending = new Promise(() => {});
      _familyActionsInFlight.add(pending);
      const staleDuringAction = _isFirestoreSnapshotStale(false, false);
      _familyActionsInFlight.delete(pending);
      const staleAfterAction = _isFirestoreSnapshotStale(false, false);
      return { staleDuringAction, staleAfterAction };
    });

    expect(result.staleDuringAction).toBe(true);
    expect(result.staleAfterAction).toBe(false);
  });

  test('large family history is compacted below the Firestore document limit', async ({ page }) => {
    await bootstrapState(page);
    const result = await page.evaluate(() => {
      const data = normalizeData(defaultData());
      data.setup = true;
      const now = Date.now();
      data.history = Array.from({ length: 600 }, (_, index) => ({
        id: `history_${index}`,
        type: 'chore',
        memberId: 'kid_1',
        title: `History ${index}`,
        gems: 5,
        date: today(),
        createdAt: now - (index * 60 * 60 * 1000),
        undoAction: 'approve_completion',
        memberBefore: { badges: Array.from({ length: 50 }, (__, badge) => `badge_${badge}`) },
        completionsBefore: Array.from({ length: 25 }, (__, completion) => ({
          id: `completion_${index}_${completion}`,
          status: 'done',
          photoUrl: `https://example.com/${'x'.repeat(200)}`,
        })),
      }));

      const originalCount = data.history.length;
      const payload = _familyDataForFirestore(data);
      const oldEntry = payload.history.find(entry => entry.id === 'history_48');
      const recentEntry = payload.history.find(entry => entry.id === 'history_1');
      return {
        originalCount,
        sourceCountAfter: data.history.length,
        inlineCount: payload.history.length,
        bytes: _utf8ByteLength(payload),
        storageVersion: payload.syncMeta.historyStorageVersion,
        oldUndoRemoved: oldEntry ? !oldEntry.memberBefore && !oldEntry.completionsBefore : true,
        recentUndoRetained: !!recentEntry?.memberBefore && !!recentEntry?.completionsBefore,
      };
    });

    expect(result.originalCount).toBe(600);
    expect(result.sourceCountAfter).toBe(600);
    expect(result.inlineCount).toBeLessThanOrEqual(100);
    expect(result.bytes).toBeLessThan(700 * 1024);
    expect(result.storageVersion).toBe(1);
    expect(result.oldUndoRemoved).toBe(true);
    expect(result.recentUndoRetained).toBe(true);
  });

  test('archived history hydrates without duplicating inline entries', async ({ page }) => {
    await bootstrapState(page);
    const result = await page.evaluate(() => {
      _historyCache = [
        { id: 'older', title: 'Older', createdAt: 1 },
        { id: 'shared', title: 'Archived copy', createdAt: 2 },
      ];
      const hydrated = _hydrateFamilyDataWithHistory({
        history: [
          { id: 'newer', title: 'Newer', createdAt: 3 },
          { id: 'shared', title: 'Inline copy', createdAt: 2 },
        ],
      });
      return hydrated.history.map(entry => ({ id: entry.id, title: entry.title }));
    });

    expect(result.map(entry => entry.id)).toEqual(['newer', 'shared', 'older']);
    expect(result.filter(entry => entry.id === 'shared')).toHaveLength(1);
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
    const result = await page.evaluate(async ({ kidId }) => {
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
      const notificationPayloads = [];
      window.firebase = {
        functions: () => ({
          httpsCallable: () => payload => {
            notificationPayloads.push(payload);
            return Promise.resolve({ data: { ok: true } });
          },
        }),
      };
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
      await submitPrizeRequest('p_parent_gate');
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
        notificationPayload: notificationPayloads[0] || null,
        historyIds: D.history.map(entry => entry.id),
        requestId: req.id,
      };
    }, { kidId, parentId });

    expect(result.pendingCountAfterRequest).toBe(1);
    expect(result.kidGemsAfterRequest).toBe(100);
    expect(result.kidGemsAfterApproval).toBe(60);
    expect(result.requestStatus).toBe('approved');
    expect(result.redemptionCount).toBe(1);
    expect(result.notificationPayload).toEqual(expect.objectContaining({
      kidName: 'Kid',
      choreTitle: 'Parent-Gated Prize',
      prizeTitle: 'Parent-Gated Prize',
      requestType: 'prize',
      type: 'prize_request',
    }));
    expect(result.historyIds).toEqual([`history:prize-approve:${result.requestId}`]);
  });

  test('parent push registration retries until token registration succeeds', async ({ page }) => {
    await bootstrapState(page);
    const result = await page.evaluate(async () => {
      const originalInitPushNotifications = initPushNotifications;
      const originalCurrentUser = Object.getOwnPropertyDescriptor(auth, 'currentUser');
      let attempts = 0;
      try {
        Object.defineProperty(auth, 'currentUser', {
          configurable: true,
          value: { uid: 'test-parent-auth', email: 'parent@example.com' },
        });
        initPushNotifications = async () => {
          attempts += 1;
          return attempts >= 2;
        };

        const first = await _ensureParentPushRegistration();
        const second = await _ensureParentPushRegistration();
        const third = await _ensureParentPushRegistration();
        return { first, second, third, attempts };
      } finally {
        initPushNotifications = originalInitPushNotifications;
        if (originalCurrentUser) Object.defineProperty(auth, 'currentUser', originalCurrentUser);
      }
    });

    expect(result.first).toBe(false);
    expect(result.second).toBe(true);
    expect(result.third).toBe(true);
    expect(result.attempts).toBe(2);
  });

  test('parent session is invalid when Firebase auth UID differs from trusted parent UID', async ({ page }) => {
    await bootstrapState(page);
    const result = await page.evaluate(() => {
      const originalCurrentUser = Object.getOwnPropertyDescriptor(auth, 'currentUser');
      try {
        setParentAuthUid('trusted-parent-auth');
        Object.defineProperty(auth, 'currentUser', {
          configurable: true,
          value: { uid: 'different-firebase-auth', email: '' },
        });
        const signedIn = isParentSignedIn();
        return {
          signedIn,
          storedParentUid: getParentAuthUid(),
        };
      } finally {
        if (originalCurrentUser) Object.defineProperty(auth, 'currentUser', originalCurrentUser);
      }
    });

    expect(result.signedIn).toBe(false);
    expect(result.storedParentUid).toBe(null);
  });

  test('prize approval history id is stable across optimistic and committed runs', async ({ page }) => {
    await bootstrapState(page);
    const result = await page.evaluate(() => {
      const base = normalizeData(defaultData());
      base.setup = true;
      base.history = [];
      base.family.members = [normalizeMember({ id: 'kid_1', name: 'Kid', role: 'kid', gems: 100, diamonds: 100, totalEarned: 0 })];
      base.prizes = [normalizePrize({
        id: 'prize_1',
        title: 'Stable Prize',
        icon: 'gift',
        iconColor: '#FF6584',
        cost: 40,
        type: 'individual',
        recurrence: 'anytime',
        requireParentApproval: true,
        redemptions: [],
      })];
      base.prizeRequests = [{ id: 'request_1', prizeId: 'prize_1', memberId: 'kid_1', cost: 40, status: 'pending', date: today(), createdAt: 1 }];

      const approve = () => {
        const freshReq = (D.prizeRequests || []).find(r => r.id === 'request_1');
        const requestBefore = _cloneForUndo({ status: freshReq.status, resolvedAt: freshReq.resolvedAt || null });
        const redeem = doRedeemPrize(freshReq.prizeId, freshReq.memberId, {
          requestId: freshReq.id,
          requestBefore,
          historyId: `history:prize-approve:${freshReq.id}`,
        });
        freshReq.status = redeem?.ok ? 'approved' : 'denied';
        freshReq.resolvedAt = Date.now();
        saveData();
        return redeem;
      };

      const optimistic = _applyFamilyActionToData(base, 'prize-approve:request_1', approve);
      const committed = _applyFamilyActionToData(base, 'prize-approve:request_1', approve);
      const merged = mergeConcurrentData(optimistic.data, optimistic.data, committed.data);
      return {
        optimisticHistoryIds: optimistic.data.history.map(entry => entry.id),
        committedHistoryIds: committed.data.history.map(entry => entry.id),
        mergedPrizeHistoryCount: merged.history.filter(entry => entry.type === 'prize').length,
      };
    });

    expect(result.optimisticHistoryIds).toEqual(['history:prize-approve:request_1']);
    expect(result.committedHistoryIds).toEqual(['history:prize-approve:request_1']);
    expect(result.mergedPrizeHistoryCount).toBe(1);
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

  test('family inbox exposes a manual refresh control', async ({ page }) => {
    await bootstrapState(page);
    const result = await page.evaluate(() => {
      D.chores.push(normalizeChore({
        id: 'refresh_chore',
        title: 'Refresh Me',
        gems: 5,
        assignedTo: ['kid_1'],
        completions: {
          kid_1: [{ id: 'refresh_entry', status: 'pending', date: today(), createdAt: 1 }],
        },
      }));
      renderParentHome();
      const button = document.querySelector('#family-inbox-section .inbox-refresh-btn');
      return {
        hasButton: !!button,
        label: button?.getAttribute('aria-label'),
      };
    });

    expect(result.hasButton).toBe(true);
    expect(result.label).toBe('Refresh family inbox');
  });

  test('pull to refresh covers the header before it can trigger', async ({ page }) => {
    await bootstrapState(page);
    const metrics = await page.evaluate(() => {
      const headerHeight = Math.ceil(document.querySelector('.screen.active .app-header')?.getBoundingClientRect().height || 0);
      return { headerHeight, ..._getPullRefreshMetrics() };
    });

    expect(metrics.coverHeight).toBeGreaterThanOrEqual(metrics.headerHeight);
    expect(metrics.coverHeight).toBeGreaterThanOrEqual(96);
    expect(metrics.triggerDistance).toBeGreaterThan(metrics.coverHeight);
    expect(metrics.triggerDistance).toBeGreaterThanOrEqual(160);
  });

  test('pull to refresh label sits at the bottom of the panel', async ({ page }) => {
    await bootstrapState(page);
    const styles = await page.evaluate(() => {
      const indicator = document.getElementById('ptr-indicator');
      indicator.innerHTML = '<span>Pull to refresh</span>';
      const computed = getComputedStyle(indicator);
      const label = indicator.querySelector('span');
      return {
        alignItems: computed.alignItems,
        paddingBottom: computed.paddingBottom,
        labelMarginBottom: getComputedStyle(label).marginBottom,
        collapsedHeight: indicator.getBoundingClientRect().height,
      };
    });

    expect(styles.alignItems).toBe('flex-end');
    expect(styles.paddingBottom).toBe('0px');
    expect(styles.labelMarginBottom).toBe('12px');
    expect(styles.collapsedHeight).toBe(0);
  });

  test('notification refresh retries sequentially through the final server result', async ({ page }) => {
    await bootstrapState(page);
    const result = await page.evaluate(async () => {
      let refreshCount = 0;
      const completed = await _scheduleNotificationRefresh(
        { parentTab: 'home' },
        {
          delays: [0, 0, 0],
          refresh: async () => {
            refreshCount += 1;
            await new Promise(resolve => setTimeout(resolve, refreshCount === 1 ? 20 : 1));
            D.settings.notificationRefreshMarker = refreshCount;
          },
        },
      );
      return { completed, refreshCount, marker: D.settings.notificationRefreshMarker, parentTab: S.parentTab };
    });

    expect(result.completed).toBe(true);
    expect(result.refreshCount).toBe(3);
    expect(result.marker).toBe(3);
    expect(result.parentTab).toBe('home');
  });

  test('approving the final item removes the empty family inbox section', async ({ page }) => {
    await bootstrapState(page);
    const result = await page.evaluate(async () => {
      D.chores.push(normalizeChore({
        id: 'last_inbox_chore',
        title: 'Last Inbox Item',
        gems: 5,
        assignedTo: ['kid_1'],
        completions: {
          kid_1: [{ id: 'last_inbox_entry', status: 'pending', date: today(), createdAt: 1 }],
        },
      }));
      renderParentHome();
      const existedBefore = !!document.getElementById('family-inbox-section');
      await approveChore('last_inbox_chore', 'kid_1', 'last_inbox_entry', null);
      return {
        existedBefore,
        existsAfter: !!document.getElementById('family-inbox-section'),
        inboxCount: familyInboxCount(),
      };
    });

    expect(result.existedBefore).toBe(true);
    expect(result.existsAfter).toBe(false);
    expect(result.inboxCount).toBe(0);
  });

  test('foreground server refresh shows kid approval celebration', async ({ page }) => {
    const { kidId } = await bootstrapState(page);
    const result = await page.evaluate(async ({ kidId }) => {
      const pendingData = cloneData(D);
      pendingData.chores.push(normalizeChore({
        id: 'foreground_approval_chore',
        title: 'Foreground Approval',
        icon: 'star',
        iconColor: '#6C63FF',
        gems: 7,
        assignedTo: [kidId],
        completions: {
          [kidId]: [{ id: 'foreground_entry', status: 'pending', date: today(), createdAt: 1 }],
        },
      }));
      D = normalizeData(pendingData);
      S.currentUser = getMember(kidId);
      S.kidTab = 'chores';
      renderKidView();

      const prevPending = getPendingEntryKeys(D, kidId);
      const serverData = cloneData(D);
      serverData.chores[0].completions[kidId][0].status = 'done';
      serverData.family.members.find(member => member.id === kidId).gems = 7;
      serverData.family.members.find(member => member.id === kidId).diamonds = 7;

      _applyServerRefreshData(serverData, kidId, prevPending);
      await new Promise(resolve => setTimeout(resolve, 20));

      return {
        count: document.querySelectorAll('#celebration-root .celebration-overlay').length,
        title: document.querySelector('#celebration-root .cel-title')?.textContent || '',
        gems: document.querySelector('#celebration-root .cel-gems')?.textContent || '',
        pendingAfter: getPendingEntryKeys(D, kidId).size,
      };
    }, { kidId });

    expect(result.count).toBe(1);
    expect(result.title).toContain('Task Approved');
    expect(result.gems).toContain('+7 gems');
    expect(result.pendingAfter).toBe(0);
  });

  test('normalizing a remote snapshot does not replace live state early', async ({ page }) => {
    await bootstrapState(page);
    const result = await page.evaluate(() => {
      D.chores.push(normalizeChore({
        id: 'live_pending_chore',
        title: 'Live Pending',
        assignedTo: ['kid_1'],
        completions: {
          kid_1: [{ id: 'live_pending_entry', status: 'pending', date: today(), createdAt: 1 }],
        },
      }));
      const remote = cloneData(D);
      remote.chores[0].completions.kid_1[0].status = 'done';

      const normalizedRemote = _normalizeDataCopy(remote);
      return {
        liveStatus: D.chores[0].completions.kid_1[0].status,
        remoteStatus: normalizedRemote.chores[0].completions.kid_1[0].status,
        pendingKeys: [...getPendingEntryKeys(D, 'kid_1')],
      };
    });

    expect(result.liveStatus).toBe('pending');
    expect(result.remoteStatus).toBe('done');
    expect(result.pendingKeys).toContain('live_pending_chore:live_pending_entry');
  });
});
