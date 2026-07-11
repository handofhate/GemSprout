import { type DemoAppState, type DemoHistoryRow, type DemoMember } from '../../app/local-demo-state';
import { todayKeyForTimezone } from '../../app/date-keys';

export type ParentInboxItem = {
  id: string;
  kind: string;
  title: string;
  meta: string;
  icon: string;
  tone: string;
  canAct: boolean;
  status: string;
  photoUrl?: string;
  badge?: string;
  slotLabel?: string;
  pointsLabel?: string;
  memberName?: string;
};

export type ParentSnapshotCard = {
  id: string;
  name: string;
  avatar: string;
  color: string;
  gems: number;
  savings: number;
  totalEarned: number;
  completeCount: number;
  totalTasks: number;
  waitingCount: number;
  isHereToday: boolean;
  claimableSavingsInterest: number;
};

export type ParentDashboardModel = {
  state: DemoAppState;
  kidName: string;
  gems: number;
  totalEarned: number;
  savings: number;
  pendingCount: number;
  finishedToday: number;
  historyCount: number;
  requestStatus: string;
  completionStatus: string;
  inboxItems: ParentInboxItem[];
  snapshots: ParentSnapshotCard[];
  historyRows: DemoHistoryRow[];
};

export function createParentDashboardModel(state: DemoAppState): ParentDashboardModel {
  const kidName = state.member?.name || 'Avery';
  const kidMembers = (state.members || []).filter(member => member.role === 'kid' && !member.deleted);
  const kids = kidMembers.length
    ? kidMembers
    : [state.member].filter((member): member is DemoMember => !!member && member.role !== 'parent');
  const snapshots = kids.map((member, index) => snapshotForMember(member, state, index));
  const requestStatus = state.request?.status || 'missing';
  const completionStatus = state.completion?.status || 'missing';
  const inboxItems = state.requests.filter(request => request.status === 'pending').map(request => {
    const status = request.status || 'missing';
    const title = String(request.snapshot?.title || request.source?.reason || 'Request');
    const amount = Number(request.snapshot?.points ?? request.snapshot?.cost ?? request.snapshot?.amount ?? request.source?.amount ?? 0);
    const kindLabel = labelForKind(request.kind || '');
    const memberName = memberNameForRequest(request, kids, kidName);
    const completion = request.source?.completionId
      ? state.completions.find(item => item.id === request.source?.completionId)
      : null;
    const task = request.source?.choreId
      ? state.tasks.find(item => item.id === request.source?.choreId)
      : null;
    const slotLabel = completion?.slotId && task?.schedule?.slots
      ? task.schedule.slots.find(slot => slot.id === completion.slotId)?.label || ''
      : '';
    return {
      id: String(request.id || ''),
      kind: String(request.kind || ''),
      title,
      meta: `${memberName} requested ${kindLabel}${amount ? ` - ${formatRequestAmount(request.kind || '', amount)}` : ''}`,
      icon: iconForKind(request.kind || ''),
      tone: toneForKind(request.kind || ''),
      canAct: true,
      status,
      photoUrl: completion?.photoUrl || '',
      badge: completion?.entryType === 'before' ? 'BEFORE' : completion?.entryType === 'after' ? 'DONE' : '',
      slotLabel: slotLabel ? String(slotLabel) : '',
      pointsLabel: completion?.entryType === 'before' ? 'Approve to start' : amount ? formatRequestAmount(request.kind || '', amount) : '',
      memberName,
    };
  });

  return {
    state,
    kidName,
    gems: snapshots.reduce((sum, item) => sum + item.gems, 0),
    totalEarned: snapshots.reduce((sum, item) => sum + item.totalEarned, 0),
    savings: snapshots.reduce((sum, item) => sum + item.savings, 0),
    pendingCount: inboxItems.length,
    finishedToday: state.historyRows.filter(row => row.type === 'chore' || row.type === 'request.approved').length,
    historyCount: state.historyRows.length,
    requestStatus,
    completionStatus,
    inboxItems,
    snapshots,
    historyRows: state.historyRows,
  };
}

function snapshotForMember(member: DemoMember, state: DemoAppState, index: number): ParentSnapshotCard {
  const id = String(member.id || `kid_${index + 1}`);
  const requests = state.requests;
  const historyRows = state.historyRows;
  const memberHistory = historyRows.filter(row => !('memberId' in row) || (row as DemoHistoryRow & { memberId?: string }).memberId === id);
  const completeCount = memberHistory.filter(row => row.type === 'chore' || row.type === 'request.approved').length;
  const waitingCount = requests.filter(request => request.status === 'pending' && request.targetMemberId === id).length;
  return {
    id,
    name: String(member.name || 'Kid'),
    avatar: String(member.avatar || member.icon || 'plant'),
    color: String(member.color || '#3f6c5f'),
    gems: Number(member.gems ?? member.diamonds ?? 0),
    savings: Number(member.savings || 0),
    totalEarned: Number(member.totalEarned || 0),
    completeCount,
    totalTasks: Math.max(completeCount + waitingCount, completeCount, waitingCount),
    waitingCount,
    isHereToday: isMemberHereOnDate(member, todayKeyForTimezone(state.settings.familyTimezone)),
    claimableSavingsInterest: calculateSavingsInterest(state, member),
  };
}

function isMemberHereOnDate(member: DemoMember, dateKey: string): boolean {
  const split = member.splitHousehold;
  if (split?.overrides && dateKey in split.overrides) return split.overrides[dateKey] !== false;
  if (!split?.enabled) return member.isHereToday !== false;
  const reference = new Date(`${split.referenceMonday || dateKey}T00:00:00`);
  const date = new Date(`${dateKey}T00:00:00`);
  const diff = Math.round((date.getTime() - reference.getTime()) / 86400000);
  const pos = ((diff % 14) + 14) % 14;
  return split.cycle?.[pos] !== false;
}

function calculateSavingsInterest(state: DemoAppState, member: DemoMember): number {
  if (state.settings.savingsEnabled === false || state.settings.savingsInterestEnabled !== true) return 0;
  if (state.settings.savingsInterestMode === 'auto_claim') return 0;
  const todayKey = todayKeyForTimezone(state.settings.familyTimezone);
  if (member.savingsInterestLastDate === todayKey) return 0;
  const parsed = new Date(`${todayKey}T00:00:00`);
  const isInterestDay = String(state.settings.savingsInterestPeriod || 'monthly') === 'weekly'
    ? parsed.getDay() === Number(state.settings.savingsInterestDay ?? 1)
    : parsed.getDate() === Number(state.settings.savingsInterestDayOfMonth || 1);
  if (!isInterestDay) return 0;
  const savings = Number(member.savings || 0);
  if (savings <= 0) return 0;
  const interest = Number((savings * Number(state.settings.savingsInterestRate || 5) / 100).toFixed(2));
  return interest > 0 ? interest : 0;
}

function memberNameForRequest(request: DemoAppState['requests'][number], members: DemoMember[], fallback: string): string {
  const member = members.find(item => item.id && item.id === request.targetMemberId);
  return String(member?.name || fallback);
}

function labelForKind(kind: string): string {
  switch (kind) {
    case 'chore_completion':
      return 'chore approval';
    case 'chore_start':
      return 'chore start';
    case 'prize_redeem':
      return 'prize approval';
    case 'savings_spend':
      return 'savings spend';
    default:
      return 'approval';
  }
}

function formatRequestAmount(kind: string, amount: number): string {
  if (kind === 'prize_redeem') return `${amount} gems`;
  if (kind === 'savings_spend') return `$${amount.toFixed(2)}`;
  return `${amount} gems`;
}

function iconForKind(kind: string): string {
  switch (kind) {
    case 'prize_redeem':
      return 'ph-gift';
    case 'savings_spend':
      return 'ph-piggy-bank';
    case 'chore_start':
      return 'ph-camera';
    case 'chore_completion':
    default:
      return 'ph-broom';
  }
}

function toneForKind(kind: string): string {
  switch (kind) {
    case 'prize_redeem':
      return 'prize';
    case 'savings_spend':
      return 'savings';
    case 'chore_start':
      return 'photo';
    case 'chore_completion':
    default:
      return 'chore';
  }
}
