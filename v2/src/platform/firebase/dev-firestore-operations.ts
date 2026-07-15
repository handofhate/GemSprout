import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, runTransaction, where, writeBatch, type Firestore } from 'firebase/firestore';
import { approveRequest, denyRequest, REQUEST_KINDS, REQUEST_STATUSES, type ApprovalRequest, type Completion, type Member, type Prize } from '../../domain/requests';
import { makeRequestOperation, OPERATION_KINDS, type OperationExecutionResult, type OperationRecord, type OperationState, planRequestOperationTransaction } from '../../sync';
import { chorePath, completionPath, familyPath, historyPath, memberPath, operationPath, prizePath, requestPath } from '../../sync/firestore-paths';
import { DEV_FIRESTORE_FAMILY_ID } from './dev-firestore-config';
import { getDevFirestore } from './dev-firestore-loader';
import { todayKeyForTimezone } from '../../app/date-keys';
import { getBaseBadgeDef, getLevels } from '../../features/parent-levels/view';

type DevOnboardingSetupDraft = {
  familyName: string;
  familyCode: string;
  parentPin: string;
  authUser: { uid?: string; email?: string; displayName?: string; providerId?: string } | null;
  settings: {
    autoApprove: boolean;
    hideUnavailable: boolean;
    showLockedRecurringPrizes: boolean;
    familyTimezone: string;
    notifyChoreApproval: boolean;
        notifySavingsSpend: boolean;
  };
  parents: Array<Record<string, unknown> & { id?: string; name?: string; role?: string; displayMode?: string; avatar?: string; avatarColor?: string; color?: string; birthday?: string; ttsVoice?: string }>;
  kids: Array<Record<string, unknown> & { id?: string; name?: string; role?: string; displayMode?: string; avatar?: string; avatarColor?: string; color?: string; birthday?: string; ttsVoice?: string }>;
  chores: Array<{ title: string; icon: string; iconColor: string; gems: number; frequency: string }>;
  prizes: Array<{ title: string; icon: string; iconColor: string; cost: number; type: string }>;
};

type CompletionWithPhoto = Completion & { photoUrl?: string | null; status?: string };

export class AuthAlreadyLinkedError extends Error {
  familyCode: string;

  constructor(familyCode: string) {
    super('This account is already linked to a family.');
    this.name = 'AuthAlreadyLinkedError';
    this.familyCode = familyCode;
  }
}

export async function assertDevOnboardingAuthIsAvailable(input: {
  authUser: DevOnboardingSetupDraft['authUser'];
}): Promise<void> {
  await assertOnboardingAuthIsAvailable(getDevFirestore(), input.authUser);
}

export async function lookupDevAuthFamily(input: {
  uid?: string;
  email?: string;
}): Promise<{ familyId: string; familyCode: string; memberId: string } | null> {
  const db = getDevFirestore();
  const email = String(input.email || '').toLowerCase();
  const candidates: Array<Record<string, unknown>> = [];
  if (input.uid) {
    const uidSnap = await getDoc(doc(db, `users/${input.uid}`));
    if (uidSnap.exists()) candidates.push(uidSnap.data());
  }
  if (email) {
    const exactEmailSnap = await getDocs(query(collection(db, 'users'), where('email', '==', email), limit(10)));
    exactEmailSnap.docs.forEach(userDoc => candidates.push(userDoc.data()));
    const allUsersSnap = await getDocs(collection(db, 'users'));
    allUsersSnap.docs.forEach(userDoc => {
      const data = userDoc.data();
      if (String(data.email || '').toLowerCase() === email) candidates.push(data);
    });
  }
  for (const data of candidates) {
    const familyId = String(data.familyId || data.familyCode || '');
    if (!familyId) continue;
    return {
      familyId,
      familyCode: String(data.familyCode || ''),
      memberId: String(data.memberId || ''),
    };
  }
  return null;
}

function setById<T extends { id?: string }>(target: Record<string, T>, value: T | null | undefined): void {
  if (!value?.id) return;
  target[value.id] = value;
}

function omitUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => omitUndefined(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, omitUndefined(entryValue)]),
  );
}

async function transactionGet<T>(transaction: Parameters<Parameters<typeof runTransaction>[1]>[0], db: Firestore, path: string): Promise<T | null> {
  const snapshot = await transaction.get(doc(db, path));
  return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null;
}

async function loadOperationState(transaction: Parameters<Parameters<typeof runTransaction>[1]>[0], db: Firestore, operation: OperationRecord): Promise<OperationState> {
  const familyId = operation.familyId;
  const requestId = operation.requestId || operation.payload.requestId || '';
  const state: OperationState = {
    membersById: {},
    completionsById: {},
    prizesById: {},
    requestsById: {},
    historyById: {},
    operationsById: {},
  };

  const existingOperation = await transactionGet<OperationRecord>(transaction, db, operationPath(familyId, operation.id));
  setById(state.operationsById || {}, existingOperation);

  const request = requestId ? await transactionGet<ApprovalRequest>(transaction, db, requestPath(familyId, requestId)) : null;
  setById(state.requestsById || {}, request);
  if (!request?.id) return state;

  if (request.targetMemberId) {
    setById(state.membersById || {}, await transactionGet<Member>(transaction, db, memberPath(familyId, request.targetMemberId)));
  }
  if (request.source?.completionId) {
    setById(state.completionsById || {}, await transactionGet<Completion>(transaction, db, completionPath(familyId, request.source.completionId)));
  }
  if (request.source?.prizeId) {
    setById(state.prizesById || {}, await transactionGet<Prize>(transaction, db, prizePath(familyId, request.source.prizeId)));
  }

  return state;
}

function executeRequestOperation(state: OperationState, operation: OperationRecord, now: number): OperationExecutionResult {
  const requestId = operation.requestId || operation.payload.requestId || '';
  const existing = state.operationsById?.[operation.id];
  if (existing?.status === 'applied') {
    return {
      ok: true,
      duplicate: true,
      state,
      operation: existing,
      history: [],
      events: [],
      error: existing.error,
    };
  }

  const domainResult = operation.kind === OPERATION_KINDS.REQUEST_DENY
    ? denyRequest(state, requestId, { actorMemberId: operation.actorMemberId, now })
    : approveRequest(state, requestId, { actorMemberId: operation.actorMemberId, now });
  const completedOperation: OperationRecord = {
    ...operation,
    status: domainResult.ok ? 'applied' : 'failed',
    appliedAt: domainResult.ok ? now : null,
    failedAt: domainResult.ok ? null : now,
    result: {
      ok: domainResult.ok,
      reason: domainResult.reason,
      message: domainResult.message,
      historyIds: domainResult.history.map(entry => entry.id),
      eventTypes: domainResult.events.map(event => event.type),
    },
    error: domainResult.ok ? null : {
      reason: domainResult.reason || 'operation_failed',
      message: domainResult.message || 'Operation failed.',
    },
  };
  return {
    ok: domainResult.ok,
    duplicate: false,
    state: {
      ...(domainResult.state as OperationState),
      operationsById: {
        ...((domainResult.state as OperationState).operationsById || {}),
        [completedOperation.id]: completedOperation,
      },
    },
    operation: completedOperation,
    history: domainResult.history,
    events: domainResult.events,
    error: completedOperation.error,
  };
}

export async function commitDevRequestAction(input: { action: 'approve' | 'deny'; requestId: string; actorMemberId?: string; familyId?: string; now?: number }): Promise<OperationExecutionResult> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  const now = input.now || Date.now();
  const operation = makeRequestOperation({
    id: `op:request:${input.action}:${input.requestId}`,
    familyId,
    kind: input.action === 'approve' ? OPERATION_KINDS.REQUEST_APPROVE : OPERATION_KINDS.REQUEST_DENY,
    requestId: input.requestId,
    actorMemberId: input.actorMemberId || 'parent_1',
    createdAt: now,
  });

  const execution = await runTransaction(db, async transaction => {
    const state = await loadOperationState(transaction, db, operation);
    const execution = executeRequestOperation(state, operation, now);
    const plan = planRequestOperationTransaction(execution);
    for (const write of plan.writes) {
      transaction.set(doc(db, write.path), omitUndefined(write.data) as Record<string, unknown>, { merge: write.merge });
    }
    return execution;
  });
  if (input.action === 'approve' && execution.ok && !execution.duplicate) {
    await applyDevApprovalProgression(db, familyId, execution, now);
    await applyDevDailyComboBonus(db, familyId, execution, now);
  }
  return execution;
}

async function applyDevApprovalProgression(db: Firestore, familyId: string, execution: OperationExecutionResult, now: number): Promise<void> {
  const requestId = execution.operation.requestId || execution.operation.payload.requestId || '';
  const request = requestId ? execution.state.requestsById?.[requestId] : null;
  if (request?.kind !== REQUEST_KINDS.CHORE_COMPLETION || request.status !== REQUEST_STATUSES.APPROVED) return;
  const memberId = String(request.targetMemberId || '');
  const choreId = String(request.source?.choreId || '');
  const points = Number(request.snapshot?.points || 0);
  if (!memberId || !choreId) return;

  const [familySnap, taskSnap, completionsSnap] = await Promise.all([
    getDoc(doc(db, familyPath(familyId))),
    getDoc(doc(db, chorePath(familyId, choreId))),
    getDocs(query(
      collection(db, `${familyPath(familyId)}/completions`),
      where('memberId', '==', memberId),
      where('choreId', '==', choreId),
      where('status', '==', 'approved'),
    )),
  ]);
  const settings = (familySnap.exists() ? (familySnap.data() as { settings?: Record<string, unknown> }).settings : {}) || {};
  const task = taskSnap.exists() ? ({ id: taskSnap.id, ...taskSnap.data() } as Record<string, unknown>) : null;
  const approvedCount = completionsSnap.docs
    .map(snapshot => snapshot.data() as { entryType?: string })
    .filter(completion => completion.entryType !== 'before')
    .length;
  const today = dateKeyFromTime(now, String(settings.familyTimezone || ''));

  await runTransaction(db, async transaction => {
    const memberRef = doc(db, memberPath(familyId, memberId));
    const memberSnap = await transaction.get(memberRef);
    if (!memberSnap.exists()) return;
    const member = { id: memberSnap.id, ...memberSnap.data() } as Record<string, unknown>;
    const previousLevel = currentLevelNumber(settings, member);
    if (settings.levelingEnabled !== false) member.xp = Number(member.xp || 0) + points;
    const historyWrites: Array<Record<string, unknown>> = [];
    const streakBonus = settings.streakEnabled !== false ? updateMemberStreak(member, settings, today) : 0;
    if (streakBonus > 0) {
      const nextGems = Number(member.gems || member.diamonds || 0) + streakBonus;
      member.gems = nextGems;
      member.diamonds = nextGems;
      member.totalEarned = Number(member.totalEarned || 0) + streakBonus;
      if (settings.levelingEnabled !== false) member.xp = Number(member.xp || 0) + streakBonus;
      historyWrites.push(makeProgressionHistory(familyId, `history:streak:${memberId}:${today}`, memberId, 'chore', `Streak bonus (${(member.streak as { current?: number } | undefined)?.current || 0} days)`, streakBonus, now + 1, { streak: (member.streak as { current?: number } | undefined)?.current || 0 }));
    }
    if (settings.streakEnabled !== false) awardStreakBadges(historyWrites, familyId, member, settings, now + 2);
    awardBaseBadge(historyWrites, familyId, member, settings, 'first_chore', now + 2);
    awardGemBadges(historyWrites, familyId, member, settings, now + 3);
    if (settings.choreBadgesEnabled !== false && task) awardTaskBadges(historyWrites, familyId, member, task, approvedCount, now + 4);
    if (settings.levelingEnabled !== false) awardLevelBadges(historyWrites, familyId, member, settings, previousLevel, now + 5);
    transaction.set(memberRef, omitUndefined(member) as Record<string, unknown>, { merge: false });
    historyWrites.forEach(row => transaction.set(doc(db, historyPath(familyId, String(row.id || ''))), omitUndefined(row) as Record<string, unknown>, { merge: false }));
  });
}

async function applyDevDailyComboBonus(db: Firestore, familyId: string, execution: OperationExecutionResult, now: number): Promise<void> {
  const requestId = execution.operation.requestId || execution.operation.payload.requestId || '';
  const request = requestId ? execution.state.requestsById?.[requestId] : null;
  if (request?.kind !== REQUEST_KINDS.CHORE_COMPLETION || request.status !== REQUEST_STATUSES.APPROVED) return;
  const memberId = String(request.targetMemberId || '');
  const completedChoreId = String(request.source?.choreId || '');
  if (!memberId || !completedChoreId) return;

  const familySnap = await getDoc(doc(db, familyPath(familyId)));
  const family = familySnap.exists() ? familySnap.data() as { settings?: Record<string, unknown> } : undefined;
  const settings = family?.settings || {};
  if (settings.comboEnabled === false) return;

  const today = dateKeyFromTime(now, String(settings.familyTimezone || ''));
  const membersSnap = await getDocs(collection(db, `${familyPath(familyId)}/members`));
  const members = membersSnap.docs.map(snapshot => ({ id: snapshot.id, ...snapshot.data() } as Record<string, unknown>));
  const tasksSnap = await getDocs(collection(db, `${familyPath(familyId)}/chores`));
  const tasks = tasksSnap.docs
    .map(snapshot => ({ id: snapshot.id, ...snapshot.data() } as Record<string, unknown>))
    .filter(task => Array.isArray(task.assignedTo));
  const comboIds = getDailyComboIdsForMember({ memberId, members, tasks, settings, today });
  if (comboIds.length < 3 || !comboIds.includes(completedChoreId)) return;
  await awardDevDailyComboBonusForCombo(db, familyId, memberId, comboIds, settings, today, now, tasks);
}

async function awardDevDailyComboBonusForCombo(db: Firestore, familyId: string, memberId: string, comboIds: string[], settings: Record<string, unknown>, today: string, now: number, knownTasks?: Array<Record<string, unknown>>): Promise<void> {
  if (settings.comboEnabled === false) return;
  const tasks = knownTasks || (await getDocs(collection(db, `${familyPath(familyId)}/chores`))).docs
    .map(snapshot => ({ id: snapshot.id, ...snapshot.data() } as Record<string, unknown>))
    .filter(task => Array.isArray(task.assignedTo));
  const doneChecks = await Promise.all(comboIds.map(async choreId => {
    const completions = await getDocs(query(
      collection(db, `${familyPath(familyId)}/completions`),
      where('memberId', '==', memberId),
      where('choreId', '==', choreId),
      where('date', '==', today),
      where('status', '==', 'approved'),
    ));
    return !completions.empty;
  }));
  if (!doneChecks.every(Boolean)) return;

  const taskById = new Map(tasks.map(task => [String(task.id || ''), task]));
  const baseSum = comboIds.reduce((sum, choreId) => {
    const task = taskById.get(choreId);
    return sum + Number(task?.gems ?? task?.diamonds ?? 0);
  }, 0);
  const bonusGems = Math.max(1, Number(settings.comboMultiplier || 2) - 1) * baseSum;
  const historyId = `history:combo:${memberId}:${today}`;

  await runTransaction(db, async transaction => {
    const memberRef = doc(db, memberPath(familyId, memberId));
    const memberSnap = await transaction.get(memberRef);
    if (!memberSnap.exists()) return;
    const member = { id: memberSnap.id, ...memberSnap.data() } as Record<string, unknown>;
    if (member.comboBonusDate === today) return;
    const currentGems = Number(member.gems || member.diamonds || 0);
    const comboStreak = nextComboStreak(member.comboStreak as { current?: number; best?: number; lastDate?: string | null } | undefined, today);
    transaction.set(memberRef, omitUndefined({
      ...member,
      gems: currentGems + bonusGems,
      diamonds: currentGems + bonusGems,
      totalEarned: Number(member.totalEarned || 0) + bonusGems,
      xp: settings.levelingEnabled === false ? member.xp : Number(member.xp || 0) + bonusGems,
      comboBonusDate: today,
      comboStreak,
    }) as Record<string, unknown>, { merge: false });
    transaction.set(doc(db, historyPath(familyId, historyId)), omitUndefined({
      id: historyId,
      familyId,
      memberId,
      type: 'bonus',
      title: 'Daily Combo Bonus!',
      gems: bonusGems,
      amount: null,
      createdAt: now,
      occurredAt: now,
      metadata: { comboTaskIds: comboIds, comboMultiplier: Number(settings.comboMultiplier || 2) },
    }) as Record<string, unknown>, { merge: false });
  });
}

export async function commitDevDailyComboOverrideAward(input: {
  memberId: string;
  comboIds: string[];
  familyId?: string;
  now?: number;
}): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  const now = input.now || Date.now();
  const familySnap = await getDoc(doc(db, familyPath(familyId)));
  const settings = (familySnap.exists() ? (familySnap.data() as { settings?: Record<string, unknown> }).settings : {}) || {};
  const today = dateKeyFromTime(now, String(settings.familyTimezone || ''));
  await awardDevDailyComboBonusForCombo(db, familyId, input.memberId, input.comboIds, settings, today, now);
}

function getDailyComboIdsForMember(input: { memberId: string; members: Array<Record<string, unknown>>; tasks: Array<Record<string, unknown>>; settings: Record<string, unknown>; today: string }): string[] {
  const overrides = input.settings.comboOverrides as Record<string, { date?: string; ids?: string[] }> | undefined;
  const override = overrides?.[input.memberId];
  if (override?.date === input.today && Array.isArray(override.ids)) return override.ids.slice(0, 3).filter(Boolean);
  const assignments = input.settings.comboAssignments as Record<string, string[]> | undefined;
  const assigned = assignments?.[input.memberId];
  if (Array.isArray(assigned) && assigned.length) return assigned.slice(0, 3).filter(Boolean);
  return getAllDailyComboIds(input.members, input.tasks, input.today)[input.memberId] || [];
}

function getAllDailyComboIds(members: Array<Record<string, unknown>>, tasks: Array<Record<string, unknown>>, today: string): Record<string, string[]> {
  const kids = members.filter(member => member.role === 'kid' && !member.deleted).sort((left, right) => String(left.id || '').localeCompare(String(right.id || '')));
  const used = new Set<string>();
  const combos: Record<string, string[]> = {};
  for (const kid of kids) {
    const kidId = String(kid.id || '');
    const eligible = tasks.filter(task =>
      Array.isArray(task.assignedTo)
      && (task.assignedTo as unknown[]).includes(kidId)
      && (task.schedule as { period?: string } | undefined)?.period !== 'once'
      && !used.has(String(task.id || ''))
    );
    const ids = eligible.length <= 3
      ? eligible.map(task => String(task.id || ''))
      : seededShuffle(eligible, dailyComboSeed(`${today}|${kidId}`)).slice(0, 3).map(task => String(task.id || ''));
    combos[kidId] = ids.filter(Boolean);
    ids.forEach(id => used.add(id));
  }
  return combos;
}

function dailyComboSeed(value: string): number {
  let seed = 0;
  for (let index = 0; index < value.length; index += 1) {
    seed = Math.imul(seed ^ value.charCodeAt(index), 0x9E3779B9);
  }
  return seed >>> 0;
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  let state = seed >>> 0;
  const random = () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function dateKeyFromTime(time: number, timezone?: string): string {
  return todayKeyForTimezone(timezone, time);
}

function currentLevelNumber(settings: Record<string, unknown>, member: Record<string, unknown>): number {
  const xp = Number(member.xp ?? member.totalEarned ?? 0);
  return getLevels(settings as never)
    .slice()
    .sort((left, right) => Number(left.minXp || 0) - Number(right.minXp || 0))
    .reduce((level, candidate) => xp >= Number(candidate.minXp || 0) ? Number(candidate.level || level) : level, 1);
}

function makeProgressionHistory(familyId: string, id: string, memberId: string, type: string, title: string, gems: number, now: number, metadata: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, familyId, memberId, type, title, gems, amount: null, createdAt: now, occurredAt: now, metadata };
}

function awardBaseBadge(rows: Array<Record<string, unknown>>, familyId: string, member: Record<string, unknown>, settings: Record<string, unknown>, badgeId: string, now: number): void {
  if (settings.baseBadgesEnabled === false) return;
  const def = getBaseBadgeDef(settings as never, badgeId);
  if (!def) return;
  const badges = Array.isArray(member.badges) ? member.badges as string[] : [];
  member.badges = badges;
  if (badges.includes(badgeId)) return;
  badges.push(badgeId);
  rows.push(makeProgressionHistory(familyId, `history:badge:${member.id}:${badgeId}`, String(member.id || ''), 'badge', def.name, 0, now, { badgeId, badgeIcon: def.icon }));
}

function awardGemBadges(rows: Array<Record<string, unknown>>, familyId: string, member: Record<string, unknown>, settings: Record<string, unknown>, now: number): void {
  const xp = Number(member.xp ?? member.totalEarned ?? 0);
  if (xp >= 50) awardBaseBadge(rows, familyId, member, settings, 'dmds_50', now);
  if (xp >= 200) awardBaseBadge(rows, familyId, member, settings, 'dmds_200', now);
  if (xp >= 500) awardBaseBadge(rows, familyId, member, settings, 'dmds_500', now);
  if (xp >= 1000) awardBaseBadge(rows, familyId, member, settings, 'dmds_1000', now);
}

function awardLevelBadges(rows: Array<Record<string, unknown>>, familyId: string, member: Record<string, unknown>, settings: Record<string, unknown>, previousLevel: number, now: number): void {
  const currentLevel = currentLevelNumber(settings, member);
  if (currentLevel <= previousLevel) return;
  awardBaseBadge(rows, familyId, member, settings, 'level_up', now);
  const levels = getLevels(settings as never);
  const maxLevel = levels.reduce((max, level) => Math.max(max, Number(level.level || 0)), 0);
  if (currentLevel >= maxLevel) awardBaseBadge(rows, familyId, member, settings, 'level_master', now + 1);
  const current = levels.find(level => Number(level.level || 0) === currentLevel);
  rows.push(makeProgressionHistory(familyId, `history:level:${member.id}:${currentLevel}`, String(member.id || ''), 'level', `Level Up - ${current?.name || `Level ${currentLevel}`}!`, 0, now + 2, { level: currentLevel }));
}

function awardStreakBadges(rows: Array<Record<string, unknown>>, familyId: string, member: Record<string, unknown>, settings: Record<string, unknown>, now: number): void {
  const current = Number((member.streak as { current?: number } | undefined)?.current || 0);
  if (current >= 3) awardBaseBadge(rows, familyId, member, settings, 'streak_3', now);
  if (current >= 7) awardBaseBadge(rows, familyId, member, settings, 'streak_7', now + 1);
  if (current >= 14) awardBaseBadge(rows, familyId, member, settings, 'streak_14', now + 2);
  if (current >= 30) awardBaseBadge(rows, familyId, member, settings, 'streak_30', now + 3);
}

function awardTaskBadges(rows: Array<Record<string, unknown>>, familyId: string, member: Record<string, unknown>, task: Record<string, unknown>, doneCount: number, now: number): void {
  const badges = Array.isArray(task.badges) ? task.badges as Array<Record<string, unknown>> : [];
  if (!badges.length) return;
  const memberBadges = Array.isArray(member.badges) ? member.badges as string[] : [];
  member.badges = memberBadges;
  badges.forEach(badge => {
    if (!badge.id || !badge.count) return;
    const key = `cb_${badge.id}`;
    if (doneCount < Number(badge.count) || memberBadges.includes(key)) return;
    memberBadges.push(key);
    rows.push(makeProgressionHistory(familyId, `history:badge:${member.id}:${key}`, String(member.id || ''), 'badge', String(badge.name || 'Badge'), 0, now, { badgeId: key, badgeIcon: badge.icon || '<i class="ph-duotone ph-medal" style="color:#7C3AED"></i>', choreTitle: task.title || '' }));
  });
}

function updateMemberStreak(member: Record<string, unknown>, settings: Record<string, unknown>, today: string): number {
  const streak = (member.streak && typeof member.streak === 'object' ? member.streak : { current: 0, best: 0, lastDate: null }) as { current?: number; best?: number; lastDate?: string | null };
  if (streak.lastDate === today) {
    member.streak = streak;
    return 0;
  }
  if (streak.lastDate && !streakHasGap(member, streak.lastDate, today)) streak.current = Number(streak.current || 0) + 1;
  else streak.current = 1;
  streak.best = Math.max(Number(streak.best || 0), Number(streak.current || 0));
  streak.lastDate = today;
  member.streak = streak;
  return getStreakBonus(settings, Number(streak.current || 0));
}

function streakHasGap(member: Record<string, unknown>, fromDate: string, toDate: string): boolean {
  const from = new Date(`${fromDate}T00:00:00`);
  const to = new Date(`${toDate}T00:00:00`);
  const diff = Math.round((to.getTime() - from.getTime()) / 86400000);
  if (diff <= 1) return false;
  for (let day = 1; day < diff; day += 1) {
    const date = new Date(from.getTime() + day * 86400000);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (isMemberHereOnDate(member, dateKey)) return true;
  }
  return false;
}

function isMemberHereOnDate(member: Record<string, unknown>, dateKey: string): boolean {
  const split = member.splitHousehold as { enabled?: boolean; cycle?: boolean[]; referenceMonday?: string; overrides?: Record<string, boolean> } | undefined;
  if (split?.overrides && dateKey in split.overrides) return split.overrides[dateKey] !== false;
  if (!split?.enabled) return true;
  const reference = new Date(`${split.referenceMonday || dateKey}T00:00:00`);
  const date = new Date(`${dateKey}T00:00:00`);
  const diff = Math.round((date.getTime() - reference.getTime()) / 86400000);
  const pos = ((diff % 14) + 14) % 14;
  return split.cycle?.[pos] !== false;
}

function getStreakBonus(settings: Record<string, unknown>, streakCount: number): number {
  if (streakCount >= 30) return Number(settings.streakBonus30 || 10);
  if (streakCount >= 14) return Number(settings.streakBonus14 || 5);
  if (streakCount >= 7) return Number(settings.streakBonus7 || 3);
  if (streakCount >= 3) return Number(settings.streakBonus3 || 1);
  return 0;
}

function nextComboStreak(current: { current?: number; best?: number; lastDate?: string | null } | undefined, today: string): { current: number; best: number; lastDate: string } {
  const yesterday = new Date(`${today}T00:00:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  const previous = current || {};
  const nextCurrent = previous.lastDate === yesterdayKey
    ? Number(previous.current || 0) + 1
    : previous.lastDate === today
      ? Number(previous.current || 1)
      : 1;
  return {
    current: nextCurrent,
    best: Math.max(Number(previous.best || 0), nextCurrent),
    lastDate: today,
  };
}

export async function undoDevHistoryAction(input: { historyId: string; familyId?: string }): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  await runTransaction(db, async transaction => {
    const historyRef = doc(db, historyPath(familyId, input.historyId));
    const historySnap = await transaction.get(historyRef);
    if (!historySnap.exists()) throw new Error('History entry not found.');
    const history = { id: historySnap.id, ...historySnap.data() } as {
      requestId?: string;
      memberId?: string;
      type?: string;
      amount?: number | null;
      gems?: number;
      metadata?: Record<string, unknown>;
    };
    const requestId = getHistoryRequestId(input.historyId, history.requestId);
    if (!requestId) throw new Error('History entry is missing requestId.');
    const requestRef = doc(db, requestPath(familyId, requestId));
    const requestSnap = await transaction.get(requestRef);
    if (!requestSnap.exists()) throw new Error('Request not found.');
    const request = { id: requestSnap.id, ...requestSnap.data() } as Record<string, unknown>;
    const memberId = String(request.targetMemberId || history.memberId || '');
    const requestKind = String(request.kind || '');
    const memberRef = memberId ? doc(db, memberPath(familyId, memberId)) : null;
    const memberSnap = memberRef ? await transaction.get(memberRef) : null;
    const member = memberSnap?.exists() ? memberSnap.data() as Record<string, unknown> : {};
    const completionId = String((request.source as { completionId?: string } | undefined)?.completionId || request.completionId || history.metadata?.completionId || '');
    const completionRef = completionId ? doc(db, completionPath(familyId, completionId)) : null;
    const completionSnap = completionRef ? await transaction.get(completionRef) : null;
    const prizeId = String((request.source as { prizeId?: string } | undefined)?.prizeId || history.metadata?.prizeId || '');
    const prizeRef = prizeId ? doc(db, prizePath(familyId, prizeId)) : null;
    const prizeSnap = prizeRef ? await transaction.get(prizeRef) : null;
    const prize = prizeSnap?.exists() ? prizeSnap.data() as Record<string, unknown> : null;

    transaction.set(requestRef, {
      ...request,
      status: 'pending',
      resolvedAt: null,
      resolvedByMemberId: null,
    }, { merge: false });

    if (String(input.historyId).endsWith(':approve')) {
      if (requestKind === 'chore_completion' || requestKind === 'chore_start') {
        const currentGems = Number(member.gems || member.diamonds || 0);
        const points = Number((request.snapshot as { points?: number } | undefined)?.points || history.gems || 0);
        if (requestKind === 'chore_completion' && memberRef) transaction.set(memberRef, {
          ...member,
          gems: currentGems - points,
          diamonds: currentGems - points,
          totalEarned: Number(member.totalEarned || 0) - points,
        }, { merge: false });
        if (completionRef && completionSnap?.exists()) {
          transaction.set(completionRef, {
              ...completionSnap.data(),
              status: 'pending',
              approvedAt: null,
              approvedByMemberId: null,
          }, { merge: false });
        }
      } else if (requestKind === 'prize_redeem') {
        const currentGems = Number(member.gems || member.diamonds || 0);
        const cost = Math.abs(Number(history.gems || 0));
        if (memberRef) transaction.set(memberRef, {
          ...member,
          gems: currentGems + cost,
          diamonds: currentGems + cost,
        }, { merge: false });
        if (prizeRef && prize) {
          const redemptions = Array.isArray(prize.redemptions) ? prize.redemptions.filter((entry: unknown) => {
            const value = entry as { requestId?: string; id?: string };
            return value.requestId !== requestId && value.id !== history.metadata?.redemptionId;
          }) : [];
          transaction.set(prizeRef, { ...prize, redemptions }, { merge: false });
        }
      } else if (requestKind === 'savings_spend') {
        const amount = Number(history.amount || 0);
        const bucketsBefore = history.metadata?.savingsBucketsBefore as { savingsGifted?: number; savingsMatched?: number; savingsInterest?: number } | undefined;
        if (memberRef) transaction.set(memberRef, {
          ...member,
          savings: Number(member.savings || 0) + amount,
          savingsGifted: bucketsBefore ? bucketsBefore.savingsGifted : Number(member.savingsGifted || 0) + amount,
          savingsMatched: bucketsBefore ? bucketsBefore.savingsMatched : member.savingsMatched,
          savingsInterest: bucketsBefore ? bucketsBefore.savingsInterest : member.savingsInterest,
        }, { merge: false });
      }
    }

    transaction.delete(historyRef);
    transaction.delete(doc(db, operationPath(familyId, `op:request:${String(input.historyId).endsWith(':deny') ? 'deny' : 'approve'}:${requestId}`)));
  });
}

export async function cleanupDevSettledCompletionPhotos(input: { familyId?: string; undoableHistoryLimit?: number } = {}): Promise<number> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  const undoableHistoryLimit = input.undoableHistoryLimit ?? 5;
  const [historySnap, requestsSnap, completionsSnap] = await Promise.all([
    getDocs(query(collection(db, `${familyPath(familyId)}/history`), orderBy('createdAt', 'desc'), limit(100))),
    getDocs(collection(db, `${familyPath(familyId)}/requests`)),
    getDocs(collection(db, `${familyPath(familyId)}/completions`)),
  ]);
  const undoableRequestIds = new Set<string>();
  historySnap.docs.slice(0, undoableHistoryLimit).forEach(snapshot => {
    const row = { id: snapshot.id, ...snapshot.data() } as { id?: string; requestId?: string };
    const requestId = getHistoryRequestId(String(row.id || ''), row.requestId);
    if (requestId) undoableRequestIds.add(requestId);
  });
  const requestByCompletionId = new Map<string, { id: string; status?: string }>();
  requestsSnap.docs.forEach(snapshot => {
    const request = { id: snapshot.id, ...snapshot.data() } as { id: string; status?: string; source?: { completionId?: string | null }; completionId?: string };
    const completionId = String(request.source?.completionId || request.completionId || '');
    if (completionId) requestByCompletionId.set(completionId, request);
  });

  const batch = writeBatch(db);
  let cleared = 0;
  completionsSnap.docs.forEach(snapshot => {
    const completion = { id: snapshot.id, ...snapshot.data() } as CompletionWithPhoto;
    if (!completion.photoUrl) return;
    if (completion.status === REQUEST_STATUSES.PENDING) return;
    const request = requestByCompletionId.get(String(completion.id || ''));
    if (request && undoableRequestIds.has(request.id)) return;
    batch.set(snapshot.ref, { ...completion, photoUrl: null }, { merge: false });
    cleared += 1;
  });
  if (cleared > 0) await batch.commit();
  return cleared;
}

export async function commitDevManualQuickAction(input: {
  familyId?: string;
  memberWrites: Array<{ memberId: string; data: Record<string, unknown> | null }>;
  historyWrites: Array<Record<string, unknown> & { id?: string }>;
}): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  await runTransaction(db, async transaction => {
    input.memberWrites.forEach(write => {
      if (!write.memberId || !write.data) return;
      transaction.set(doc(db, memberPath(familyId, write.memberId)), omitUndefined(write.data) as Record<string, unknown>, { merge: false });
    });
    input.historyWrites.forEach(write => {
      if (!write.id) return;
      transaction.set(doc(db, historyPath(familyId, String(write.id))), omitUndefined(write) as Record<string, unknown>, { merge: false });
    });
  });
}

export async function commitDevTaskWrite(input: {
  familyId?: string;
  taskId: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  await runTransaction(db, async transaction => {
    transaction.set(doc(db, chorePath(familyId, input.taskId)), omitUndefined(input.data) as Record<string, unknown>, { merge: false });
  });
}

export async function commitDevTaskDelete(input: {
  familyId?: string;
  taskId: string;
}): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  await runTransaction(db, async transaction => {
    transaction.delete(doc(db, chorePath(familyId, input.taskId)));
  });
}

export async function commitDevPrizeWrite(input: {
  familyId?: string;
  prizeId: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  await runTransaction(db, async transaction => {
    transaction.set(doc(db, prizePath(familyId, input.prizeId)), omitUndefined(input.data) as Record<string, unknown>, { merge: false });
  });
}

export async function commitDevPrizeDelete(input: {
  familyId?: string;
  prizeId: string;
}): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  await runTransaction(db, async transaction => {
    transaction.delete(doc(db, prizePath(familyId, input.prizeId)));
  });
}

export async function commitDevTeamGoalsWrite(input: {
  familyId?: string;
  teamGoals: unknown[];
}): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  await runTransaction(db, async transaction => {
    const familyRef = doc(db, familyPath(familyId));
    const familySnap = await transaction.get(familyRef);
    const existing = familySnap.exists() ? familySnap.data() as Record<string, unknown> : {};
    transaction.set(familyRef, omitUndefined({ ...existing, teamGoals: input.teamGoals }) as Record<string, unknown>, { merge: false });
  });
}

export async function commitDevKidTeamContribution(input: {
  familyId?: string;
  memberId: string;
  member: Record<string, unknown>;
  teamGoals: unknown[];
  history: Record<string, unknown> & { id?: string };
}): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  await runTransaction(db, async transaction => {
    const familyRef = doc(db, familyPath(familyId));
    const familySnap = await transaction.get(familyRef);
    const existing = familySnap.exists() ? familySnap.data() as Record<string, unknown> : {};
    transaction.set(doc(db, memberPath(familyId, input.memberId)), omitUndefined(input.member) as Record<string, unknown>, { merge: false });
    transaction.set(familyRef, omitUndefined({ ...existing, teamGoals: input.teamGoals }) as Record<string, unknown>, { merge: false });
    if (input.history.id) {
      transaction.set(doc(db, historyPath(familyId, String(input.history.id))), omitUndefined({
        ...input.history,
        familyId,
      }) as Record<string, unknown>, { merge: false });
    }
  });
}

export async function commitDevMemberWrite(input: {
  familyId?: string;
  memberId: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  await runTransaction(db, async transaction => {
    transaction.set(doc(db, memberPath(familyId, input.memberId)), omitUndefined(input.data) as Record<string, unknown>, { merge: false });
  });
}

export async function commitDevFamilyWrite(input: {
  familyId?: string;
  data: Record<string, unknown>;
}): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  await runTransaction(db, async transaction => {
    const familyRef = doc(db, familyPath(familyId));
    const familySnap = await transaction.get(familyRef);
    const existing = familySnap.exists() ? familySnap.data() as Record<string, unknown> : {};
    transaction.set(familyRef, omitUndefined({ ...existing, ...input.data }) as Record<string, unknown>, { merge: false });
  });
}

export async function deleteDevFamilyData(input: { familyId?: string } = {}): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  await clearDevSetupCollections(db, familyId);
  await deleteDoc(doc(db, familyPath(familyId)));
}

export async function deleteDevUserDoc(input: { uid: string }): Promise<void> {
  if (!input.uid) return;
  await deleteDoc(doc(getDevFirestore(), `users/${input.uid}`));
}

export async function commitDevParentInvite(input: {
  email: string;
  familyCode: string;
  createdByMemberId?: string;
  now?: number;
}): Promise<void> {
  const db = getDevFirestore();
  await addDoc(collection(db, 'invites'), omitUndefined({
    email: input.email,
    familyCode: input.familyCode,
    createdAt: input.now || Date.now(),
    createdByMemberId: input.createdByMemberId || '',
    used: false,
  }) as Record<string, unknown>);
}

export async function commitDevOnboardingSetup(input: {
  familyId?: string;
  draft: DevOnboardingSetupDraft;
  now?: number;
}): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || makeNewFamilyDocumentId();
  const now = input.now || Date.now();
  await assertOnboardingAuthIsAvailable(db, input.draft.authUser);
  await clearDevSetupCollections(db, familyId);
  await runTransaction(db, async transaction => {
    transaction.set(doc(db, familyPath(familyId)), omitUndefined({
      id: familyId,
      name: input.draft.familyName,
      familyCode: input.draft.familyCode,
      setup: true,
      parentAuthUid: input.draft.authUser?.uid || '',
      createdAt: now,
      updatedAt: now,
      settings: {
        ...input.draft.settings,
        parentPin: input.draft.parentPin,
        savingsEnabled: true,
        diamondsPerDollar: 10,
        currency: '$',
        savingsMatchingEnabled: false,
        savingsMatchPercent: 0,
        savingsInterestEnabled: false,
        savingsInterestRate: 0,
        savingsInterestPeriod: 'monthly',
        savingsInterestDay: 1,
        savingsInterestDayOfMonth: 1,
        savingsInterestMode: 'kid_claim',
        notListeningEnabled: true,
        notListeningSecs: 60,
        levelingEnabled: true,
        streakEnabled: true,
        comboEnabled: true,
        comboMultiplier: 2,
        baseBadgesEnabled: true,
        choreBadgesEnabled: true,
      },
      teamGoals: [],
    }) as Record<string, unknown>, { merge: false });

    const parents = input.draft.parents.length ? input.draft.parents : [];
    const kids = input.draft.kids.length ? input.draft.kids : [];
    [...parents, ...kids].forEach((member, index) => {
      const memberId = member.id || `${member.role}_${index + 1}`;
      const isPrimaryParent = member.role === 'parent' && index === 0;
      transaction.set(doc(db, memberPath(familyId, memberId)), omitUndefined({
        id: memberId,
        familyId,
        name: member.name || (member.role === 'parent' ? 'Parent' : 'Kid'),
        role: member.role,
        displayMode: member.displayMode || (member.role === 'kid' ? 'regular' : undefined),
        mode: member.displayMode || undefined,
        avatar: member.avatar,
        avatarColor: member.avatarColor || member.color,
        color: member.color,
        birthday: member.birthday || '',
        ttsVoice: member.ttsVoice || '',
        authUid: isPrimaryParent ? input.draft.authUser?.uid || '' : '',
        authProviders: isPrimaryParent && input.draft.authUser ? [{
          providerId: input.draft.authUser.providerId || 'unknown',
          uid: input.draft.authUser.uid || '',
          email: input.draft.authUser.email || '',
          linkedAt: now,
        }] : [],
        gems: 0,
        diamonds: 0,
        totalEarned: 0,
        savings: 0,
        savingsGifted: 0,
        savingsMatched: 0,
        savingsInterest: 0,
        savingsInterestLastDate: '',
        deleted: false,
      }) as Record<string, unknown>, { merge: false });
    });

    const kidIds = kids.map((kid, index) => kid.id || `kid_${index + 1}`);
    input.draft.chores.forEach((task, index) => {
      const taskId = `setup_chore_${index + 1}`;
      transaction.set(doc(db, chorePath(familyId, taskId)), omitUndefined({
        id: taskId,
        familyId,
        title: task.title,
        icon: task.icon,
        iconColor: task.iconColor,
        gems: task.gems,
        diamonds: task.gems,
        assignedTo: kidIds,
        description: '',
        photoMode: 'none',
        schedule: {
          period: task.frequency === 'weekly' ? 'week' : 'day',
          targetCount: 1,
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
          windows: {},
        },
        badges: [],
      }) as Record<string, unknown>, { merge: false });
    });

    input.draft.prizes.forEach((prize, index) => {
      const prizeId = `setup_prize_${index + 1}`;
      transaction.set(doc(db, prizePath(familyId, prizeId)), omitUndefined({
        id: prizeId,
        familyId,
        title: prize.title,
        icon: prize.icon,
        iconColor: prize.iconColor,
        type: prize.type,
        cost: prize.cost,
        recurrence: 'anytime',
        requireParentApproval: true,
        requirementType: 'none',
        requirementTaskCount: 1,
        requirementTaskIds: [],
        redemptions: [],
      }) as Record<string, unknown>, { merge: false });
    });

    const primaryParentId = parents.find(parent => parent.role === 'parent')?.id || parents[0]?.id || '';
    if (input.draft.authUser?.uid) {
      transaction.set(doc(db, `users/${input.draft.authUser.uid}`), omitUndefined({
        familyCode: input.draft.familyCode,
        familyId,
        memberId: primaryParentId,
        uid: input.draft.authUser.uid,
        email: String(input.draft.authUser.email || '').toLowerCase(),
      }) as Record<string, unknown>, { merge: true });
    }
  });
}

async function assertOnboardingAuthIsAvailable(
  db: Firestore,
  authUser: DevOnboardingSetupDraft['authUser'],
): Promise<void> {
  if (!authUser?.uid) return;
  const uidSnap = await getDoc(doc(db, `users/${authUser.uid}`));
  if (uidSnap.exists()) {
    const linkedFamily = linkedFamilyForUserDoc(uidSnap.data());
    if (linkedFamily) throw new AuthAlreadyLinkedError(linkedFamily);
  }

  const email = String(authUser.email || '').toLowerCase();
  if (!email) return;
  const exactEmailSnap = await getDocs(query(collection(db, 'users'), where('email', '==', email), limit(10)));
  for (const userDoc of exactEmailSnap.docs) {
    const linkedFamily = linkedFamilyForUserDoc(userDoc.data());
    if (linkedFamily) throw new AuthAlreadyLinkedError(linkedFamily);
  }

  const allUsersSnap = await getDocs(collection(db, 'users'));
  for (const userDoc of allUsersSnap.docs) {
    const data = userDoc.data();
    if (String(data.email || '').toLowerCase() !== email) continue;
    const linkedFamily = linkedFamilyForUserDoc(data);
    if (linkedFamily) throw new AuthAlreadyLinkedError(linkedFamily);
  }
}

function linkedFamilyForUserDoc(data: Record<string, unknown>): string {
  return String(data.familyCode || data.familyId || data.memberId || '');
}

function makeNewFamilyDocumentId(): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `family_${Date.now().toString(36)}_${random}`;
}

async function clearDevSetupCollections(db: Firestore, familyId: string): Promise<void> {
  const collectionNames = ['members', 'chores', 'prizes', 'requests', 'completions', 'history', 'operations'];
  for (const collectionName of collectionNames) {
    const snapshot = await getDocs(collection(db, `${familyPath(familyId)}/${collectionName}`));
    await Promise.all(snapshot.docs.map(snapshotDoc => deleteDoc(snapshotDoc.ref)));
  }
}

export async function commitDevKidCompletionRequest(input: {
  familyId?: string;
  completionId: string;
  requestId: string;
  memberId: string;
  choreId: string;
  title: string;
  points: number;
  entryType?: 'before' | 'after';
  slotId?: string | null;
  photoUrl?: string | null;
  now?: number;
}): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  const now = input.now || Date.now();
  const familySnap = await getDoc(doc(db, familyPath(familyId)));
  const family = familySnap.exists() ? familySnap.data() as { settings?: Record<string, unknown> } : {};
  const dateKey = dateKeyFromTime(now, String(family.settings?.familyTimezone || ''));
  await runTransaction(db, async transaction => {
    const memberRef = doc(db, memberPath(familyId, input.memberId));
    const memberSnap = await transaction.get(memberRef);
    const member = memberSnap.exists() ? memberSnap.data() as Record<string, unknown> : null;
    if (member && !isMemberHereOnDate(member, dateKey)) {
      const split = member.splitHousehold as { enabled?: boolean; cycle?: boolean[]; referenceMonday?: string; overrides?: Record<string, boolean> } | undefined;
      if (split?.enabled) {
        transaction.set(memberRef, omitUndefined({
          ...member,
          isHereToday: true,
          splitHousehold: {
            ...split,
            overrides: { ...(split.overrides || {}), [dateKey]: true },
          },
        }) as Record<string, unknown>, { merge: false });
      }
    }
    transaction.set(doc(db, completionPath(familyId, input.completionId)), omitUndefined({
      id: input.completionId,
      familyId,
      choreId: input.choreId,
      memberId: input.memberId,
      status: 'pending',
      points: input.points,
      createdAt: now,
      approvedAt: null,
      approvedByMemberId: null,
      entryType: input.entryType || 'after',
      slotId: input.slotId || null,
      photoUrl: input.photoUrl || null,
      date: dateKey,
    }) as Record<string, unknown>, { merge: false });
    transaction.set(doc(db, requestPath(familyId, input.requestId)), omitUndefined({
      id: input.requestId,
      familyId,
      kind: input.entryType === 'before' ? REQUEST_KINDS.CHORE_START : REQUEST_KINDS.CHORE_COMPLETION,
      status: REQUEST_STATUSES.PENDING,
      requesterMemberId: input.memberId,
      targetMemberId: input.memberId,
      createdAt: now,
      resolvedAt: null,
      resolvedByMemberId: null,
      source: { choreId: input.choreId, completionId: input.completionId, prizeId: null, amount: null, reason: '' },
      snapshot: { title: input.title, points: input.points },
    }) as Record<string, unknown>, { merge: false });
  });
}

export async function commitDevKidSavingsSpendRequest(input: {
  familyId?: string;
  requestId: string;
  memberId: string;
  amount: number;
  reason?: string;
  now?: number;
}): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  const now = input.now || Date.now();
  await runTransaction(db, async transaction => {
    transaction.set(doc(db, requestPath(familyId, input.requestId)), omitUndefined({
      id: input.requestId,
      familyId,
      kind: REQUEST_KINDS.SAVINGS_SPEND,
      status: REQUEST_STATUSES.PENDING,
      requesterMemberId: input.memberId,
      targetMemberId: input.memberId,
      createdAt: now,
      resolvedAt: null,
      resolvedByMemberId: null,
      source: { choreId: null, completionId: null, prizeId: null, amount: input.amount, reason: input.reason || '' },
      snapshot: { title: input.reason || 'Savings spend request', amount: input.amount },
    }) as Record<string, unknown>, { merge: false });
  });
}

export async function commitDevKidPrizeRequest(input: {
  familyId?: string;
  requestId: string;
  memberId: string;
  prizeId: string;
  title: string;
  cost: number;
  now?: number;
}): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  const now = input.now || Date.now();
  await runTransaction(db, async transaction => {
    transaction.set(doc(db, requestPath(familyId, input.requestId)), omitUndefined({
      id: input.requestId,
      familyId,
      kind: REQUEST_KINDS.PRIZE_REDEEM,
      status: REQUEST_STATUSES.PENDING,
      requesterMemberId: input.memberId,
      targetMemberId: input.memberId,
      createdAt: now,
      resolvedAt: null,
      resolvedByMemberId: null,
      source: { choreId: null, completionId: null, prizeId: input.prizeId, amount: null, reason: '' },
      snapshot: { title: input.title, cost: input.cost },
    }) as Record<string, unknown>, { merge: false });
  });
}

export async function commitDevKidPrizeRedeem(input: {
  familyId?: string;
  memberId: string;
  prizeId: string;
  cost: number;
  redemption: Record<string, unknown>;
  history: Record<string, unknown> & { id?: string };
  now?: number;
}): Promise<void> {
  const db = getDevFirestore();
  const familyId = input.familyId || DEV_FIRESTORE_FAMILY_ID;
  await runTransaction(db, async transaction => {
    const memberRef = doc(db, memberPath(familyId, input.memberId));
    const prizeRef = doc(db, prizePath(familyId, input.prizeId));
    const [memberSnap, prizeSnap] = await Promise.all([transaction.get(memberRef), transaction.get(prizeRef)]);
    if (!memberSnap.exists()) throw new Error('Member not found.');
    if (!prizeSnap.exists()) throw new Error('Prize not found.');
    const member = memberSnap.data() as Record<string, unknown>;
    const prize = prizeSnap.data() as Record<string, unknown>;
    const currentBalance = Number(member.gems || member.diamonds || 0);
    if (currentBalance < input.cost) throw new Error('Not enough gems to redeem this prize.');
    const recurrence = String(prize.recurrence || 'anytime');
    const periodKey = String(input.redemption.periodKey || '');
    if (recurrence !== 'anytime' && periodKey) {
      const alreadyRedeemed = Array.isArray(prize.redemptions) && prize.redemptions.some((entry: unknown) => {
        const redemption = entry as { memberId?: string; periodKey?: string };
        return redemption.memberId === input.memberId && redemption.periodKey === periodKey;
      });
      if (alreadyRedeemed) throw new Error('This prize is not available right now.');
    }
    const nextBalance = Math.max(0, currentBalance - input.cost);
    transaction.set(memberRef, omitUndefined({
      ...member,
      gems: nextBalance,
      diamonds: nextBalance,
    }) as Record<string, unknown>, { merge: false });
    transaction.set(prizeRef, omitUndefined({
      ...prize,
      redemptions: [...(Array.isArray(prize.redemptions) ? prize.redemptions : []), input.redemption],
    }) as Record<string, unknown>, { merge: false });
    if (input.history.id) {
      transaction.set(doc(db, historyPath(familyId, String(input.history.id))), omitUndefined({
        ...input.history,
        familyId,
      }) as Record<string, unknown>, { merge: false });
    }
  });
}

function getHistoryRequestId(historyId: string, requestId?: string): string {
  if (requestId) return String(requestId);
  const match = String(historyId).match(/^history:request:(.+):(approve|deny)$/);
  return match?.[1] || '';
}
