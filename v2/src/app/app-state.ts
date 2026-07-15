export type AppMember = {
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
  authProviders?: Array<{ providerId?: string; uid?: string; email?: string; linkedAt?: number }>;
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

export type AppRequest = {
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

export type AppCompletion = {
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

export type AppTaskSchedule = {
  period?: string;
  targetCount?: number;
  daysOfWeek?: number[];
  windows?: Record<string, { start?: string; end?: string }>;
  slots?: Array<{ id?: string; label?: string; start?: string; end?: string }>;
};

export type AppTask = {
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
  schedule?: AppTaskSchedule;
  badges?: Array<{ id?: string; count?: number; name?: string; icon?: string; secret?: boolean }>;
};

export type AppPrize = {
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

export type AppTeamGoal = {
  id?: string;
  title?: string;
  icon?: string;
  iconColor?: string;
  targetPoints?: number;
  contributions?: Record<string, number>;
};

export type AppFamilySettings = {
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

export type AppHistoryRow = {
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

export type AppState = {
  familyId?: string;
  familyCode?: string;
  familyName?: string;
  member: AppMember | null;
  members: AppMember[];
  tasks: AppTask[];
  prizes: AppPrize[];
  teamGoals: AppTeamGoal[];
  settings: AppFamilySettings;
  request: AppRequest | null;
  requests: AppRequest[];
  completions: AppCompletion[];
  completion: { id?: string; status?: string; points?: number; approvedAt?: number | null; approvedByMemberId?: string | null } | null;
  operation: { status?: string; error?: { reason?: string } | null } | null;
  history: AppHistoryRow | null;
  historyRows: AppHistoryRow[];
};
