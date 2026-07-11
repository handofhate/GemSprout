import { REQUEST_KINDS } from '../domain/requests';
import { FakeFirestoreGateway } from '../platform/firebase';
import { chorePath, completionPath, familyPath, memberPath, prizePath, requestPath } from '../sync/firestore-paths';
import { createApprovalSeedStore, LAB_FAMILY_ID } from './approval-lab-scenarios';

export const DEMO_REQUEST_IDS = Object.freeze({
  CHORE: 'request_1',
  PRIZE: 'request_prize_1',
  SAVINGS: 'request_savings_1',
});

export function createDemoFamilySeedStore(): FakeFirestoreGateway {
  const store = createApprovalSeedStore();
  store.set(familyPath(LAB_FAMILY_ID), {
    id: LAB_FAMILY_ID,
    name: 'GemSprout Family',
    settings: {
      autoApprove: false,
      hideUnavailable: false,
      showLockedRecurringPrizes: true,
      tooltipBounceEnabled: true,
      familyTimezone: 'America/Phoenix',
      savingsEnabled: true,
      diamondsPerDollar: 10,
      currency: '$',
      savingsMatchingEnabled: true,
      savingsMatchPercent: 50,
      savingsInterestEnabled: true,
      savingsInterestRate: 5,
      savingsInterestPeriod: 'monthly',
      savingsInterestDayOfMonth: 1,
      savingsInterestMode: 'kid_claim',
      notListeningEnabled: true,
      notListeningSecs: 60,
      notifyChoreApproval: true,
      notifySavingsSpend: true,
      interestDayNotify: true,
      levelingEnabled: true,
      streakEnabled: true,
      comboEnabled: true,
      comboMultiplier: 2,
      streakBonus3: 1,
      streakBonus7: 3,
      streakBonus14: 5,
      streakBonus30: 10,
      baseBadgesEnabled: true,
      choreBadgesEnabled: true,
      customLevels: [
        { level: 1, name: 'Sprout', icon: '<i class="ph-duotone ph-leaf" style="color:#22C55E;font-size:1em"></i>', minXp: 0 },
        { level: 2, name: 'Helper', icon: '<i class="ph-duotone ph-sketch-logo" style="color:#3B82F6;font-size:1em"></i>', minXp: 100 },
        { level: 3, name: 'Shining Star', icon: '<i class="ph-duotone ph-star" style="color:#F59E0B;font-size:1em"></i>', minXp: 250 },
      ],
      comboAssignments: { kid_1: ['chore_1', 'chore_2', 'chore_3'] },
    },
    teamGoals: [
      {
        id: 'goal_1',
        title: 'Arcade Night',
        icon: 'trophy',
        iconColor: '#FFD93D',
        targetPoints: 200,
        contributions: { kid_1: 55 },
      },
    ],
  }, { merge: true });
  store.set(memberPath(LAB_FAMILY_ID, 'parent_1'), {
    id: 'parent_1',
    name: 'Parent',
    role: 'parent',
    color: '#365E4F',
    avatar: 'ph-user-circle',
  }, { merge: true });
  store.set(memberPath(LAB_FAMILY_ID, 'kid_1'), {
    id: 'kid_1',
    name: 'Avery',
    role: 'kid',
    gems: 50,
    diamonds: 50,
    totalEarned: 100,
    savings: 25,
    savingsGifted: 0,
    savingsMatched: 0,
    savingsInterest: 0,
    savingsInterestLastDate: '',
    color: '#6C63FF',
    avatar: 'ph-smiley',
    streak: { current: 3, best: 7 },
    badges: ['level_up'],
    isHereToday: true,
  }, { merge: true });
  store.set(chorePath(LAB_FAMILY_ID, 'chore_1'), {
    id: 'chore_1',
    familyId: LAB_FAMILY_ID,
    title: 'Brush Teeth',
    icon: 'tooth',
    iconColor: '#6BCB77',
    gems: 5,
    diamonds: 5,
    assignedTo: ['kid_1'],
    description: '',
    photoMode: 'none',
    schedule: { period: 'day', targetCount: 2, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], windows: {} },
    badges: [
      { id: 'cb_brush_1', count: 10, name: 'Spark Starter', icon: '<i class="ph-duotone ph-sparkle" style="color:#8B5CF6;font-size:1em"></i>' },
    ],
  });
  store.set(chorePath(LAB_FAMILY_ID, 'chore_2'), {
    id: 'chore_2',
    familyId: LAB_FAMILY_ID,
    title: 'Make Bed',
    icon: 'bed',
    iconColor: '#F59E0B',
    gems: 4,
    diamonds: 4,
    assignedTo: ['kid_1'],
    description: '',
    photoMode: 'after',
    schedule: { period: 'day', targetCount: 1, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], windows: {} },
    badges: [],
  });
  store.set(chorePath(LAB_FAMILY_ID, 'chore_3'), {
    id: 'chore_3',
    familyId: LAB_FAMILY_ID,
    title: 'Feed the Dog',
    icon: 'dog',
    iconColor: '#45B7D1',
    gems: 8,
    diamonds: 8,
    assignedTo: ['kid_1'],
    description: '',
    photoMode: 'none',
    schedule: { period: 'week', targetCount: 5, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], windows: {} },
    badges: [
      { id: 'cb_dog_1', count: 10, name: 'Pet Pal', icon: '<i class="ph-duotone ph-dog" style="color:#14B8A6;font-size:1em"></i>' },
    ],
  });
  store.set(completionPath(LAB_FAMILY_ID, 'completion_2'), {
    id: 'completion_2',
    choreId: 'chore_2',
    memberId: 'kid_1',
    status: 'pending',
    points: 4,
  });
  store.set(prizePath(LAB_FAMILY_ID, 'prize_1'), {
    id: 'prize_1',
    title: 'Movie Night',
    icon: 'popcorn',
    iconColor: '#FF6584',
    type: 'individual',
    cost: 30,
    recurrence: 'weekly',
    requireParentApproval: true,
    requirementType: 'none',
    requirementTaskCount: 1,
    requirementTaskIds: [],
    redemptions: [],
  });
  store.set(prizePath(LAB_FAMILY_ID, 'prize_2'), {
    id: 'prize_2',
    title: 'Stay Up Late',
    icon: 'moon-stars',
    iconColor: '#6C63FF',
    type: 'individual',
    cost: 75,
    recurrence: 'one_time',
    requireParentApproval: true,
    requirementType: 'task_count',
    requirementTaskCount: 3,
    requirementTaskIds: [],
    redemptions: [],
  });
  store.set(requestPath(LAB_FAMILY_ID, DEMO_REQUEST_IDS.PRIZE), {
    id: DEMO_REQUEST_IDS.PRIZE,
    familyId: LAB_FAMILY_ID,
    kind: REQUEST_KINDS.PRIZE_REDEEM,
    status: 'pending',
    requesterMemberId: 'kid_1',
    targetMemberId: 'kid_1',
    createdAt: 1760000001000,
    resolvedAt: null,
    resolvedByMemberId: null,
    source: { choreId: null, completionId: null, prizeId: 'prize_1', amount: null, reason: '' },
    snapshot: { title: 'Movie Night', cost: 30 },
  });
  store.set(requestPath(LAB_FAMILY_ID, DEMO_REQUEST_IDS.SAVINGS), {
    id: DEMO_REQUEST_IDS.SAVINGS,
    familyId: LAB_FAMILY_ID,
    kind: REQUEST_KINDS.SAVINGS_SPEND,
    status: 'pending',
    requesterMemberId: 'kid_1',
    targetMemberId: 'kid_1',
    createdAt: 1760000002000,
    resolvedAt: null,
    resolvedByMemberId: null,
    source: { choreId: null, completionId: null, prizeId: null, amount: 6.5, reason: 'Book fair' },
    snapshot: { title: 'Book fair', amount: 6.5 },
  });
  return store;
}
