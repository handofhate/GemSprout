const { deleteApp, initializeApp } = require('firebase/app');
const { collection, deleteDoc, doc: firestoreDoc, getDocs, getFirestore, writeBatch } = require('firebase/firestore');

const COLLECTIONS = ['members', 'chores', 'prizes', 'requests', 'completions', 'history', 'operations'];
const DEFAULT_PROJECT = 'gemsprout-v2-dev';
const DEFAULT_FAMILY_ID = 'migration-preview';
const DEFAULT_TIMEZONE = 'America/Phoenix';
const DEV_FIRESTORE_CONFIG = {
  projectId: 'gemsprout-v2-dev',
  appId: '1:578603238289:web:cf9d90b51580e437379030',
  storageBucket: 'gemsprout-v2-dev.firebasestorage.app',
  apiKey: 'AIzaSyBMVJlIRL1avzDjaZ3RB1ANCy5u2pAJlQE',
  authDomain: 'gemsprout-v2-dev.firebaseapp.com',
  messagingSenderId: '578603238289',
};

function readArgs(argv) {
  const args = {
    projectId: DEFAULT_PROJECT,
    familyId: DEFAULT_FAMILY_ID,
    databaseId: '(default)',
    write: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--project') args.projectId = next, index += 1;
    else if (arg === '--family-id') args.familyId = next, index += 1;
    else if (arg === '--database') args.databaseId = next, index += 1;
    else if (arg === '--write') args.write = true;
    else if (arg === '--help') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Usage:
  node v2/scripts/seed-v2-test-data.cjs
  node v2/scripts/seed-v2-test-data.cjs --write

Defaults:
  --project ${DEFAULT_PROJECT}
  --family-id ${DEFAULT_FAMILY_ID}
  --database "(default)"

Dry-runs by default. Add --write to replace the target dev family test data.
Uses the dev Firebase client config and requires the dev Firestore rules to allow local seeding.
`);
}

function assertSafeTarget(args) {
  if (!args.projectId) throw new Error('Missing --project.');
  if (!args.familyId) throw new Error('Missing --family-id.');
  if (args.projectId !== DEFAULT_PROJECT) {
    throw new Error(`Refusing project "${args.projectId}". This client seed script only writes ${DEFAULT_PROJECT}.`);
  }
  if (args.databaseId !== '(default)') {
    throw new Error('The client seed script only supports the default Firestore database.');
  }
}

function dateKeyInTimezone(offsetDays = 0, timezone = DEFAULT_TIMEZONE, now = new Date()) {
  const base = new Date(now.getTime() + offsetDays * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(base);
  const year = parts.find(part => part.type === 'year')?.value || '1970';
  const month = parts.find(part => part.type === 'month')?.value || '01';
  const day = parts.find(part => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

function addDays(dateKey, days) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function timestampForDate(dateKey, hour = 12) {
  return new Date(`${dateKey}T${String(hour).padStart(2, '0')}:00:00-07:00`).getTime();
}

function previousCompletedWeek(today) {
  const [year, month, day] = today.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = date.getDay();
  const end = new Date(date);
  end.setDate(date.getDate() - weekday);
  if (weekday === 0) end.setDate(end.getDate() - 7);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  const fmt = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return { start: fmt(start), end: fmt(end) };
}

function doc(pathValue, data) {
  return { path: pathValue, data };
}

function familyPath(familyId) {
  return `families/${familyId}`;
}

function subPath(familyId, collectionName, id) {
  return `${familyPath(familyId)}/${collectionName}/${id}`;
}

function icon(name, color) {
  return `<i class="ph-duotone ph-${name}" style="color:${color};font-size:1em"></i>`;
}

function photoDataUrl(label, bg = '#E7F5EE') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="240" viewBox="0 0 360 240"><rect width="360" height="240" rx="26" fill="${bg}"/><circle cx="70" cy="72" r="30" fill="#6C63FF" opacity=".26"/><path d="M34 195l78-78 52 52 38-38 124 124H34z" fill="#365E4F" opacity=".24"/><text x="180" y="122" text-anchor="middle" font-family="Arial" font-size="22" font-weight="700" fill="#24463D">${label}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function buildSeed(familyId) {
  const timezone = DEFAULT_TIMEZONE;
  const today = dateKeyInTimezone(0, timezone);
  const yesterday = addDays(today, -1);
  const week = previousCompletedWeek(today);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(week.start, index));
  const parentPin = '1234';
  const writes = [];

  writes.push(doc(familyPath(familyId), {
    id: familyId,
    name: 'Testflight',
    familyCode: 'V2LAB7',
    setup: true,
    parentAuthUid: 'dev-bypass-parent',
    createdAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
    settings: {
      parentPin,
      autoApprove: false,
      hideUnavailable: false,
      showLockedRecurringPrizes: false,
      tooltipBounceEnabled: true,
      familyTimezone: timezone,
      currency: '$',
      savingsEnabled: true,
      diamondsPerDollar: 10,
      savingsMatchingEnabled: true,
      savingsMatchPercent: 50,
      savingsInterestEnabled: true,
      savingsInterestRate: 5,
      savingsInterestPeriod: 'monthly',
      savingsInterestDay: 1,
      savingsInterestDayOfMonth: 1,
      savingsInterestMode: 'kid_claim',
      notListeningEnabled: true,
      notListeningSecs: 60,
      notifyChoreApproval: true,
      notifySavingsSpend: true,
      interestDayNotify: true,
      lockOnBackground: false,
      levelingEnabled: true,
      streakEnabled: true,
      comboEnabled: true,
      comboMultiplier: 2,
      streakBonus3: 2,
      streakBonus7: 5,
      streakBonus14: 8,
      streakBonus30: 15,
      baseBadgesEnabled: true,
      choreBadgesEnabled: true,
      splitHousehold: { enabled: true, homeLabel: 'Home', awayLabel: 'Away' },
      customLevels: [
        { level: 1, name: 'Sprout', icon: icon('leaf', '#22C55E'), minXp: 0 },
        { level: 2, name: 'Helper', icon: icon('sketch-logo', '#3B82F6'), minXp: 50 },
        { level: 3, name: 'Gem', icon: icon('star', '#F59E0B'), minXp: 150 },
        { level: 4, name: 'Champion', icon: icon('trophy', '#D97706'), minXp: 300 },
        { level: 5, name: 'Legend', icon: icon('crown', '#7C3AED'), minXp: 500 },
      ],
      customBadgeDefs: {
        first_chore: { name: 'First Sprout', desc: 'Complete your first task', icon: icon('plant', '#22C55E') },
        level_up: { name: 'Level Up!', desc: 'Reach a new level', icon: icon('rocket-launch', '#3B82F6') },
        streak_3: { name: 'Three-Day Flame', desc: 'Keep a 3 day streak', icon: icon('fire', '#EF4444') },
        dmds_200: { name: 'Gem Collector', desc: 'Earn 200 gems', icon: icon('sketch-logo', '#7C3AED') },
      },
      comboAssignments: {
        kid_avery: ['task_brush', 'task_bed', 'task_table'],
        kid_milo: ['task_toys', 'task_books', 'task_laundry'],
      },
    },
    teamGoals: [
      {
        id: 'goal_arcade',
        title: 'Arcade Night',
        icon: 'game-controller',
        iconColor: '#6C63FF',
        targetPoints: 250,
        contributions: { kid_avery: 90, kid_milo: 35 },
      },
      {
        id: 'goal_zoo',
        title: 'Zoo Trip',
        icon: 'binoculars',
        iconColor: '#14B8A6',
        targetPoints: 600,
        contributions: { kid_avery: 120, kid_milo: 70 },
      },
    ],
  }));

  const members = [
    {
      id: 'parent_1',
      familyId,
      name: 'Ty',
      role: 'parent',
      color: '#365E4F',
      avatar: 'ph-user-circle',
      avatarColor: '#365E4F',
      authUid: 'dev-bypass-parent',
      authProviders: [{ providerId: 'dev-bypass', uid: 'dev-bypass-parent', email: 'parent@gemsprout.test', linkedAt: Date.now(), devBypass: true }],
      deleted: false,
    },
    {
      id: 'parent_2',
      familyId,
      name: 'Jamie',
      role: 'parent',
      color: '#7C3AED',
      avatar: 'ph-user',
      avatarColor: '#7C3AED',
      authProviders: [],
      deleted: false,
    },
    {
      id: 'kid_avery',
      familyId,
      name: 'Avery',
      role: 'kid',
      displayMode: 'regular',
      mode: 'regular',
      color: '#6C63FF',
      avatar: 'ph-smiley',
      avatarColor: '#6C63FF',
      gems: 245,
      diamonds: 245,
      totalEarned: 430,
      xp: 430,
      savings: 34.5,
      savingsGifted: 10,
      savingsMatched: 8,
      savingsInterest: 1.25,
      savingsInterestLastDate: addDays(today, -31),
      streak: { current: 7, best: 14, lastDate: yesterday },
      comboStreak: { current: 2, best: 5, lastDate: yesterday },
      comboBonusDate: yesterday,
      nlPendingSecs: 0,
      nlTodaySecs: 95,
      nlDate: today,
      badges: ['first_chore', 'streak_3', 'streak_7', 'dmds_50', 'dmds_200', 'level_up', 'cb_brush_10', 'cb_table_5'],
      isHereToday: true,
      splitHousehold: { enabled: true, cycle: [true, true, true, false, false, true, true], referenceMonday: week.start, overrides: { [today]: true } },
      deleted: false,
    },
    {
      id: 'kid_milo',
      familyId,
      name: 'Milo',
      role: 'kid',
      displayMode: 'tiny',
      mode: 'tiny',
      color: '#F59E0B',
      avatar: 'ph-star',
      avatarColor: '#F59E0B',
      gems: 62,
      diamonds: 62,
      totalEarned: 115,
      xp: 115,
      savings: 8,
      savingsGifted: 2,
      savingsMatched: 1,
      savingsInterest: 0.25,
      savingsInterestLastDate: addDays(today, -31),
      streak: { current: 3, best: 4, lastDate: yesterday },
      comboStreak: { current: 1, best: 2, lastDate: yesterday },
      badges: ['first_chore', 'streak_3', 'dmds_50'],
      isHereToday: false,
      splitHousehold: { enabled: true, cycle: [true, false, false, true, true, false, true], referenceMonday: week.start, overrides: { [today]: false } },
      deleted: false,
    },
  ];
  members.forEach(member => writes.push(doc(subPath(familyId, 'members', member.id), member)));

  const tasks = [
    task(familyId, 'task_brush', 'Brush Teeth', 'tooth', '#6BCB77', 5, ['kid_avery'], 'none', 'day', 2, {
      badges: [{ id: 'brush_10', count: 10, name: 'Spark Starter', icon: icon('sparkle', '#8B5CF6') }],
    }),
    task(familyId, 'task_bed', 'Make Bed', 'bed', '#F59E0B', 6, ['kid_avery'], 'after'),
    task(familyId, 'task_table', 'Clear the Table', 'fork-knife', '#14B8A6', 4, ['kid_avery'], 'none', 'day', 1, {
      badges: [{ id: 'table_5', count: 5, name: 'Table Captain', icon: icon('chef-hat', '#D97706') }],
    }),
    task(familyId, 'task_dog', 'Feed the Dog', 'paw-print', '#45B7D1', 8, ['kid_avery'], 'before_after', 'week', 5),
    task(familyId, 'task_slots', 'Read 20 Minutes', 'book-open', '#3B82F6', 7, ['kid_avery'], 'none', 'day', 1, {
      slots: [
        { id: 'morning', label: 'Morning', start: '07:00', end: '10:00' },
        { id: 'evening', label: 'Evening', start: '18:00', end: '21:00' },
      ],
    }),
    task(familyId, 'task_weekly', 'Take Trash Out', 'trash', '#EF4444', 10, ['kid_avery'], 'none', 'week', 1),
    task(familyId, 'task_toys', 'Pick Up Toys', 'puzzle-piece', '#F59E0B', 3, ['kid_milo'], 'none'),
    task(familyId, 'task_books', 'Put Books Away', 'books', '#7C3AED', 3, ['kid_milo'], 'none'),
    task(familyId, 'task_laundry', 'Laundry Basket', 'basket', '#0EA5E9', 4, ['kid_milo'], 'none'),
  ];
  tasks.forEach(item => writes.push(doc(subPath(familyId, 'chores', item.id), item)));

  const completionRows = [
    completion(familyId, 'comp_today_brush_1', 'task_brush', 'kid_avery', 'approved', 5, today, timestampForDate(today, 8), { approvedAt: timestampForDate(today, 8) + 60000 }),
    completion(familyId, 'comp_today_table_pending', 'task_table', 'kid_avery', 'pending', 4, today, timestampForDate(today, 17)),
    completion(familyId, 'comp_today_bed_pending_photo', 'task_bed', 'kid_avery', 'pending', 6, today, timestampForDate(today, 9), { entryType: 'after', photoUrl: photoDataUrl('Done Photo', '#FEF3C7') }),
    completion(familyId, 'comp_today_dog_before', 'task_dog', 'kid_avery', 'approved', 0, today, timestampForDate(today, 7), { entryType: 'before', approvedAt: timestampForDate(today, 7) + 60000, photoUrl: photoDataUrl('Before Photo', '#E0F2FE') }),
    completion(familyId, 'comp_today_slot_morning', 'task_slots', 'kid_avery', 'approved', 7, today, timestampForDate(today, 9), { slotId: 'morning', approvedAt: timestampForDate(today, 9) + 60000 }),
    completion(familyId, 'comp_milo_toys', 'task_toys', 'kid_milo', 'approved', 3, today, timestampForDate(today, 10), { approvedAt: timestampForDate(today, 10) + 60000 }),
  ];
  weekDays.forEach((date, index) => {
    completionRows.push(completion(familyId, `comp_week_avery_${index}`, index % 2 ? 'task_table' : 'task_brush', 'kid_avery', 'approved', index % 2 ? 4 : 5, date, timestampForDate(date, 10), { approvedAt: timestampForDate(date, 10) + 60000 }));
    if (index < 4) completionRows.push(completion(familyId, `comp_week_milo_${index}`, index % 2 ? 'task_books' : 'task_toys', 'kid_milo', 'approved', 3, date, timestampForDate(date, 11), { approvedAt: timestampForDate(date, 11) + 60000 }));
  });
  completionRows.forEach(item => writes.push(doc(subPath(familyId, 'completions', item.id), item)));

  const requests = [
    request(familyId, 'req_table_pending', 'chore_completion', 'pending', 'kid_avery', timestampForDate(today, 17), { choreId: 'task_table', completionId: 'comp_today_table_pending' }, { title: 'Clear the Table', points: 4 }),
    request(familyId, 'req_bed_photo_pending', 'chore_completion', 'pending', 'kid_avery', timestampForDate(today, 9), { choreId: 'task_bed', completionId: 'comp_today_bed_pending_photo' }, { title: 'Make Bed', points: 6 }),
    request(familyId, 'req_prize_pending', 'prize_redeem', 'pending', 'kid_avery', timestampForDate(today, 14), { prizeId: 'prize_movie' }, { title: 'Movie Night', cost: 30 }),
    request(familyId, 'req_savings_pending', 'savings_spend', 'pending', 'kid_avery', timestampForDate(today, 15), { amount: 6.5, reason: 'Book fair' }, { title: 'Book fair', amount: 6.5 }),
  ];
  requests.forEach(item => writes.push(doc(subPath(familyId, 'requests', item.id), item)));

  const prizes = [
    prize(familyId, 'prize_stickers', 'Sticker Pack', 'sticker', '#22C55E', 12, 'individual', 'anytime', false),
    prize(familyId, 'prize_movie', 'Movie Night', 'popcorn', '#FF6584', 30, 'individual', 'weekly', true),
    prize(familyId, 'prize_late', 'Stay Up Late', 'moon-stars', '#6C63FF', 75, 'individual', 'one_time', true, { requirementType: 'task_count', requirementTaskCount: 3 }),
    prize(familyId, 'prize_redeemed_weekly', 'Ice Cream Trip', 'ice-cream', '#38BDF8', 40, 'individual', 'weekly', false, {
      redemptions: [{ id: 'redemption_ice_1', memberId: 'kid_avery', date: today, periodKey: `w:${startOfWeek(today)}`, cost: 40 }],
    }),
    prize(familyId, 'prize_combo', 'Choose Dinner', 'fork-knife', '#D97706', 55, 'individual', 'daily', true, { requirementType: 'combo' }),
    prize(familyId, 'prize_family_game', 'Family Game Night', 'dice-five', '#14B8A6', 150, 'family', 'anytime', true),
  ];
  prizes.forEach(item => writes.push(doc(subPath(familyId, 'prizes', item.id), item)));

  const history = [];
  weekDays.forEach((date, index) => {
    history.push(historyRow(familyId, `hist_week_avery_task_${index}`, 'kid_avery', 'chore', index % 2 ? 'Clear the Table' : 'Brush Teeth', index % 2 ? 4 : 5, timestampForDate(date, 10), { choreId: index % 2 ? 'task_table' : 'task_brush' }));
    if (index < 4) history.push(historyRow(familyId, `hist_week_milo_task_${index}`, 'kid_milo', 'chore', index % 2 ? 'Put Books Away' : 'Pick Up Toys', 3, timestampForDate(date, 11), { choreId: index % 2 ? 'task_books' : 'task_toys' }));
  });
  history.push(
    historyRow(familyId, 'hist_badge_avery_first', 'kid_avery', 'badge', 'First Sprout', 0, timestampForDate(weekDays[0], 13), { badgeId: 'first_chore', badgeIcon: icon('plant', '#22C55E') }),
    historyRow(familyId, 'hist_badge_avery_streak', 'kid_avery', 'badge', 'Three-Day Flame', 0, timestampForDate(weekDays[2], 13), { badgeId: 'streak_3', badgeIcon: icon('fire', '#EF4444') }),
    historyRow(familyId, 'hist_badge_avery_task', 'kid_avery', 'badge', 'Spark Starter', 0, timestampForDate(weekDays[4], 13), { badgeId: 'cb_brush_10', badgeIcon: icon('sparkle', '#8B5CF6'), choreTitle: 'Brush Teeth' }),
    historyRow(familyId, 'hist_badge_milo_first', 'kid_milo', 'badge', 'First Sprout', 0, timestampForDate(weekDays[1], 13), { badgeId: 'first_chore', badgeIcon: icon('plant', '#22C55E') }),
    historyRow(familyId, 'hist_savings_avery', 'kid_avery', 'savings_deposit', 'Savings deposit', 0, timestampForDate(weekDays[3], 16), { dollars: 8.5 }),
    historyRow(familyId, 'hist_bonus_avery', 'kid_avery', 'bonus', 'Bonus gems', 12, timestampForDate(weekDays[5], 17), { reason: 'Great attitude' }),
    historyRow(familyId, 'hist_penalty_avery', 'kid_avery', 'penalty', 'Gems adjusted', -3, timestampForDate(weekDays[6], 18), { reason: 'Correction' }),
    historyRow(familyId, 'hist_prize_avery', 'kid_avery', 'prize', 'Redeemed Sticker Pack', -12, timestampForDate(yesterday, 16), { prizeId: 'prize_stickers' }),
    historyRow(familyId, 'hist_today_brush', 'kid_avery', 'chore', 'Brush Teeth', 5, timestampForDate(today, 8), { choreId: 'task_brush' }),
    historyRow(familyId, 'hist_today_slot', 'kid_avery', 'chore', 'Read 20 Minutes', 7, timestampForDate(today, 9), { choreId: 'task_slots', slotId: 'morning' }),
    historyRow(familyId, 'hist_today_milo', 'kid_milo', 'chore', 'Pick Up Toys', 3, timestampForDate(today, 10), { choreId: 'task_toys' }),
  );
  history.forEach(item => writes.push(doc(subPath(familyId, 'history', item.id), item)));

  return { writes, summary: { familyId, familyCode: 'V2LAB7', parentPin, today, week, members: members.length, tasks: tasks.length, prizes: prizes.length, requests: requests.length, completions: completionRows.length, history: history.length } };
}

function task(familyId, id, title, iconName, iconColor, gems, assignedTo, photoMode = 'none', period = 'day', targetCount = 1, extra = {}) {
  return {
    id,
    familyId,
    title,
    icon: iconName,
    iconColor,
    gems,
    diamonds: gems,
    assignedTo,
    description: '',
    photoMode,
    schedule: {
      period,
      targetCount,
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      windows: {},
      ...(extra.slots ? { slots: extra.slots } : {}),
    },
    badges: extra.badges || [],
  };
}

function completion(familyId, id, choreId, memberId, status, points, date, createdAt, extra = {}) {
  return {
    id,
    familyId,
    choreId,
    memberId,
    status,
    points,
    date,
    createdAt,
    approvedAt: extra.approvedAt || null,
    approvedByMemberId: extra.approvedAt ? 'parent_1' : null,
    entryType: extra.entryType || null,
    slotId: extra.slotId || null,
    photoUrl: extra.photoUrl || null,
  };
}

function request(familyId, id, kind, status, memberId, createdAt, source, snapshot) {
  return {
    id,
    familyId,
    kind,
    status,
    requesterMemberId: memberId,
    targetMemberId: memberId,
    createdAt,
    resolvedAt: null,
    resolvedByMemberId: null,
    source: {
      choreId: source.choreId || null,
      completionId: source.completionId || null,
      prizeId: source.prizeId || null,
      amount: source.amount ?? null,
      reason: source.reason || '',
    },
    snapshot,
  };
}

function prize(familyId, id, title, iconName, iconColor, cost, type, recurrence, requireParentApproval, extra = {}) {
  return {
    id,
    familyId,
    title,
    icon: iconName,
    iconColor,
    type,
    cost,
    recurrence,
    requireParentApproval,
    requirementType: extra.requirementType || 'none',
    requirementTaskCount: extra.requirementTaskCount || 1,
    requirementTaskIds: extra.requirementTaskIds || [],
    redemptions: extra.redemptions || [],
  };
}

function historyRow(familyId, id, memberId, type, title, gems, createdAt, metadata = {}) {
  return {
    id,
    familyId,
    memberId,
    type,
    title,
    gems,
    amount: metadata.dollars || null,
    dollars: metadata.dollars || null,
    createdAt,
    occurredAt: createdAt,
    metadata,
  };
}

function startOfWeek(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - date.getDay());
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function deleteCollection(db, collectionPath) {
  const snapshot = await getDocs(collection(db, collectionPath));
  let committed = 0;
  for (let offset = 0; offset < snapshot.docs.length; offset += 450) {
    const batch = writeBatch(db);
    snapshot.docs.slice(offset, offset + 450).forEach(snapshotDoc => batch.delete(snapshotDoc.ref));
    await batch.commit();
    committed += Math.min(450, snapshot.docs.length - offset);
  }
  return committed;
}

async function commitSeed(db, familyId, writes) {
  for (const collectionName of COLLECTIONS) {
    const deleted = await deleteCollection(db, `${familyPath(familyId)}/${collectionName}`);
    if (deleted) console.log(`Deleted ${deleted} ${collectionName} docs`);
  }
  await deleteDoc(firestoreDoc(db, familyPath(familyId))).catch(() => {});
  for (let offset = 0; offset < writes.length; offset += 450) {
    const batch = writeBatch(db);
    writes.slice(offset, offset + 450).forEach(write => batch.set(firestoreDoc(db, write.path), write.data));
    await batch.commit();
    console.log(`Committed ${Math.min(offset + 450, writes.length)}/${writes.length} docs`);
  }
}

async function main() {
  const args = readArgs(process.argv);
  assertSafeTarget(args);
  const seed = buildSeed(args.familyId);
  console.log(JSON.stringify({
    projectId: args.projectId,
    databaseId: args.databaseId,
    familyId: args.familyId,
    write: args.write,
    summary: seed.summary,
    samplePaths: seed.writes.slice(0, 12).map(write => write.path),
  }, null, 2));
  if (!args.write) {
    console.log('Dry run only. Add --write to replace the dev family data.');
    return;
  }
  const app = initializeApp(DEV_FIRESTORE_CONFIG, `v2-seed-${Date.now()}`);
  const db = getFirestore(app);
  try {
    await commitSeed(db, args.familyId, seed.writes);
  } finally {
    await deleteApp(app).catch(() => {});
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
