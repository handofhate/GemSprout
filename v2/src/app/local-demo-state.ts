import { type FakeFirestoreGateway } from '../platform/firebase';
import { chorePath, completionPath, familyPath, historyPath, memberPath, operationPath, requestPath } from '../sync/firestore-paths';
import { LAB_FAMILY_ID, LAB_HISTORY_ID, LAB_OPERATION_ID, LAB_REQUEST_ID } from './approval-lab-scenarios';

export type DemoMember = {
  id?: string;
  name?: string;
  role?: string;
  displayMode?: string;
  mode?: string;
  deleted?: boolean;
  gems?: number;
  diamonds?: number;
  totalEarned?: number;
  xp?: number;
  savings?: number;
  savingsGifted?: number;
  savingsMatched?: number;
  savingsInterest?: number;
  savingsInterestLastDate?: string | null;
  color?: string;
  avatarColor?: string;
  avatar?: string;
  icon?: string;
  authUid?: string;
  authUids?: string[];
  authProviders?: Array<{ providerId?: string; uid?: string; email?: string; linkedAt?: number; devBypass?: boolean }>;
  streak?: { current?: number; best?: number; lastDate?: string | null };
  comboStreak?: { current?: number; best?: number; lastDate?: string | null };
  comboBonusDate?: string | null;
  nlPendingSecs?: number;
  nlTodaySecs?: number;
  nlDate?: string;
  badges?: string[];
  isHereToday?: boolean;
  splitHousehold?: {
    enabled?: boolean;
    cycle?: boolean[];
    referenceMonday?: string;
    overrides?: Record<string, boolean>;
  };
};

export type DemoRequest = {
  id?: string;
  status?: string;
  kind?: string;
  targetMemberId?: string;
  createdAt?: number;
  resolvedAt?: number | null;
  resolvedByMemberId?: string | null;
  snapshot?: { title?: string; points?: number; cost?: number; amount?: number };
  source?: { choreId?: string | null; completionId?: string | null; prizeId?: string | null; reason?: string; amount?: number | null };
};

export type DemoCompletion = {
  id?: string;
  familyId?: string;
  choreId?: string;
  memberId?: string;
  status?: string;
  points?: number;
  createdAt?: number;
  approvedAt?: number | null;
  approvedByMemberId?: string | null;
  entryType?: string;
  slotId?: string | null;
  photoUrl?: string | null;
  date?: string;
};

export type DemoTaskSchedule = {
  period?: string;
  targetCount?: number;
  daysOfWeek?: number[];
  windows?: Record<string, { start?: string; end?: string }>;
  slots?: Array<{ id?: string; label?: string; start?: string; end?: string }>;
};

export type DemoTask = {
  id?: string;
  familyId?: string;
  title?: string;
  icon?: string;
  iconColor?: string;
  gems?: number;
  diamonds?: number;
  assignedTo?: string[];
  description?: string;
  photoMode?: string;
  schedule?: DemoTaskSchedule;
  badges?: Array<{ id?: string; count?: number; name?: string; icon?: string; secret?: boolean }>;
};

export type DemoPrize = {
  id?: string;
  familyId?: string;
  title?: string;
  icon?: string;
  iconColor?: string;
  type?: string;
  cost?: number;
  recurrence?: string;
  requireParentApproval?: boolean;
  requirementType?: string;
  requirementTaskCount?: number;
  requirementTaskIds?: string[];
  redemptions?: Array<{ id?: string; memberId?: string; date?: string; periodKey?: string; cost?: number; requestId?: string }>;
};

export type DemoTeamGoal = {
  id?: string;
  title?: string;
  icon?: string;
  iconColor?: string;
  targetPoints?: number;
  contributions?: Record<string, number>;
};

export type DemoFamilySettings = {
  autoApprove?: boolean;
  hideUnavailable?: boolean;
  showLockedRecurringPrizes?: boolean;
  tooltipBounceEnabled?: boolean;
  familyTimezone?: string;
  savingsEnabled?: boolean;
  diamondsPerDollar?: number;
  currency?: string;
  savingsMatchingEnabled?: boolean;
  savingsMatchPercent?: number;
  savingsInterestEnabled?: boolean;
  savingsInterestRate?: number;
  savingsInterestPeriod?: string;
  savingsInterestDay?: number;
  savingsInterestDayOfMonth?: number;
  savingsInterestMode?: string;
  notListeningEnabled?: boolean;
  notListeningSecs?: number;
  notifyChoreApproval?: boolean;
  notifySavingsSpend?: boolean;
  interestDayNotify?: boolean;
  lastSync?: number;
  parentPin?: string;
  lockOnBackground?: boolean;
  levelingEnabled?: boolean;
  streakEnabled?: boolean;
  comboEnabled?: boolean;
  comboMultiplier?: number;
  streakBonus3?: number;
  streakBonus7?: number;
  streakBonus14?: number;
  streakBonus30?: number;
  baseBadgesEnabled?: boolean;
  choreBadgesEnabled?: boolean;
  customLevels?: Array<{ level?: number; name?: string; icon?: string; minXp?: number }>;
  customBadgeDefs?: Record<string, { icon?: string; name?: string; desc?: string }>;
  comboAssignments?: Record<string, string[]>;
  comboOverrides?: Record<string, { date?: string; ids?: string[] }>;
};

export type DemoHistoryRow = {
  id?: string;
  familyId?: string;
  requestId?: string;
  memberId?: string;
  type?: string;
  title?: string;
  gems?: number;
  amount?: number | null;
  createdAt?: number;
  metadata?: Record<string, unknown>;
};

export type DemoAppState = {
  familyId?: string;
  familyCode?: string;
  familyName?: string;
  member: DemoMember | null;
  members: DemoMember[];
  tasks: DemoTask[];
  prizes: DemoPrize[];
  teamGoals: DemoTeamGoal[];
  settings: DemoFamilySettings;
  request: DemoRequest | null;
  requests: DemoRequest[];
  completions: DemoCompletion[];
  completion: { id?: string; status?: string; points?: number; approvedAt?: number | null; approvedByMemberId?: string | null } | null;
  operation: { status?: string; error?: { reason?: string } | null } | null;
  history: DemoHistoryRow | null;
  historyRows: DemoHistoryRow[];
};

function getDoc<T>(store: FakeFirestoreGateway, path: string): T | null {
  return store.get<T>(path);
}

export function readDemoAppState(store: FakeFirestoreGateway): DemoAppState {
  const dump = store.dump();
  const members = Object.entries(dump)
    .filter(([path]) => path.includes('/members/'))
    .map(([, value]) => value as DemoMember | null)
    .filter((value): value is DemoMember => !!value?.id)
    .sort((left, right) => String(left.name || '').localeCompare(String(right.name || '')));
  const requests = Object.entries(dump)
    .filter(([path]) => path.includes('/requests/'))
    .map(([, value]) => value as DemoRequest | null)
    .filter((value): value is DemoRequest => !!value?.id)
    .sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
  const tasks = Object.entries(dump)
    .filter(([path]) => path.includes('/chores/'))
    .map(([, value]) => value as DemoTask | null)
    .filter((value): value is DemoTask => !!value?.id)
    .sort((left, right) => {
      const byGems = Number(left.gems ?? left.diamonds ?? 0) - Number(right.gems ?? right.diamonds ?? 0);
      if (byGems !== 0) return byGems;
      return String(left.title || '').localeCompare(String(right.title || ''));
    });
  const prizes = Object.entries(dump)
    .filter(([path]) => path.includes('/prizes/'))
    .map(([, value]) => value as DemoPrize | null)
    .filter((value): value is DemoPrize => !!value?.id)
    .sort((left, right) => {
      const byCost = Number(left.cost || 0) - Number(right.cost || 0);
      if (byCost !== 0) return byCost;
      return String(left.title || '').localeCompare(String(right.title || ''));
    });
  const familyDoc = getDoc<{ id?: string; name?: string; familyCode?: string; teamGoals?: DemoTeamGoal[]; settings?: DemoFamilySettings }>(store, familyPath(LAB_FAMILY_ID)) || {};
  const teamGoals = Array.isArray(familyDoc.teamGoals)
    ? [...familyDoc.teamGoals].sort((left, right) => {
      const byTarget = Number(left.targetPoints || 0) - Number(right.targetPoints || 0);
      if (byTarget !== 0) return byTarget;
      return String(left.title || '').localeCompare(String(right.title || ''));
    })
    : [];
  const completions = Object.entries(dump)
    .filter(([path]) => path.includes('/completions/'))
    .map(([, value]) => value as DemoCompletion | null)
    .filter((value): value is DemoCompletion => !!value?.id)
    .sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
  const historyRows = Object.entries(dump)
    .filter(([path]) => path.includes('/history/'))
    .map(([, value]) => value as DemoHistoryRow | null)
    .filter((value): value is DemoHistoryRow => !!value)
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));

  return {
    familyId: familyDoc.id || LAB_FAMILY_ID,
    familyCode: familyDoc.familyCode || '',
    familyName: familyDoc.name || '',
    member: members.find(member => member.role === 'kid') || members.find(member => member.role !== 'parent') || members[0] || null,
    members,
    tasks,
    prizes,
    teamGoals,
    settings: familyDoc.settings || {},
    request: getDoc(store, requestPath(LAB_FAMILY_ID, LAB_REQUEST_ID)),
    requests,
    completions,
    completion: getDoc(store, completionPath(LAB_FAMILY_ID, 'completion_1')),
    operation: getDoc(store, operationPath(LAB_FAMILY_ID, LAB_OPERATION_ID)),
    history: getDoc(store, historyPath(LAB_FAMILY_ID, LAB_HISTORY_ID)),
    historyRows,
  };
}
