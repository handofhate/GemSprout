import { FakeFirestoreGateway, commitRequestOperation } from '../platform/firebase';
import { DEV_FIRESTORE_CONFIG, DEV_FIRESTORE_FAMILY_ID } from '../platform/firebase/dev-firestore-config';
import { loadDevFirestoreState, subscribeDevFirestoreState } from '../platform/firebase/dev-firestore-loader';
import { createParentDashboardModel } from '../features/parent-dashboard/model';
import { renderFullHistoryModal, renderHero, renderHistory, renderParentDashboard, renderParentHeader, renderParentNav, renderParentSnapshotModal, renderSnapshots, type ParentTabId } from '../features/parent-dashboard/view';
import {
  formatPrizeRedeemStatusMessage,
  getKidPrizeRedeemStatus,
  getPrizePeriodKey,
  getPrizeRequirementSummary,
  isLittleKidMode,
  renderKidPhotoCapture,
  renderKidScreen,
  renderKidTimePicker,
  type KidTabId,
} from '../features/kid-dashboard/view';
import { renderHomeScreen, renderKidEntryScreen, renderKidMemberSelectScreen, renderKidQrScannerScreen, renderLandingScreen, renderReturningSignInScreen, renderSignInNotFoundScreen } from '../features/home/view';
import {
  clearOnboardingAuthUser,
  clearOnboardingValidationMessage,
  getOnboardingSteps,
  getOnboardingSetupDraft,
  handleOnboardingPreviewAction,
  isOnboardingEditMode,
  renderOnboardingStep,
  setOnboardingAuthError,
  setOnboardingAuthUser,
  setOnboardingValidationMessage,
  startNewOnboardingDraft,
  startOnboardingEditDraft,
  type OnboardingStepId,
  type OnboardingTransitionDirection,
} from '../features/onboarding/view';
import { registerParentPushNotifications } from '../platform/notifications/push-registration';
import { signInParentWithProvider, createDevBypassParentAuth as createAuthDevBypass, signOutParentAuth, deleteCurrentParentAuth, getCurrentParentAuthInfo, getCurrentParentAuthUid } from '../platform/auth/provider-sign-in';
import {
  initRevenueCat,
  loadOfferings,
  openManageSubscriptions,
  openPrivacyPolicy,
  openTermsOfUse,
  purchaseSelectedPlan,
  refreshEntitlement,
  restorePurchases,
  selectSubscriptionPlan,
  subscriptionState,
  type SubscriptionPlanId,
} from '../platform/subscriptions/revenuecat';
import { LEVEL_ICON_OPTIONS, getBaseBadgeDef, getLevels, renderParentLevels } from '../features/parent-levels/view';
import { renderParentSettings, type ParentSettingsPage } from '../features/parent-settings/view';
import { renderParentStats, renderStatsDetailModal } from '../features/parent-stats/view';
import { bindWeekReviewLaunch, showWeekReviewIfNeeded } from '../features/week-review/view';
import { reconcileKidNotificationModals } from '../features/kid-notifications/view';
import { createTaskEditorDraft, renderParentTasks, renderTaskDeleteModal, renderTaskEditorModal, type ParentTaskEditorDraft } from '../features/parent-tasks/view';
import { createGoalEditorDraft, createPrizeEditorDraft, renderGoalEditorModal, renderParentPrizes, renderPrizeDeleteModal, renderPrizeEditorModal, type ParentGoalEditorDraft, type ParentPrizeEditorDraft } from '../features/parent-prizes/view';
import {
  createInitialQuickActionState,
  renderParentQuickActionModal,
  type GemsQuickActionState,
  type ListeningQuickActionState,
  type ParentQuickActionId,
  type ParentQuickActionState,
  type SavingsQuickActionState,
} from '../features/parent-dashboard/quick-actions';
import { OPERATION_KINDS, makeRequestOperation } from '../sync';
import { REQUEST_KINDS, REQUEST_STATUSES } from '../domain/requests';
import { chorePath, completionPath, familyPath, historyPath, memberPath, operationPath, prizePath, requestPath } from '../sync/firestore-paths';
import { loadSharedLabStore, resetSharedLabStore, saveSharedLabStore, subscribeSharedLabStore } from './shared-lab-store';
import {
  LAB_FAMILY_ID,
  runPrizeApprovalFailureOnStore,
  runSavingsApprovalOnStore,
  runStaleApprovedRequestOnStore,
  runStaleDeniedRequestOnStore,
  runTwoDeviceApprovalRaceOnStore,
  type LabScenarioResult,
} from './approval-lab-scenarios';
import { createDemoFamilySeedStore } from './demo-family-seed';
import { renderDevLab, type LabLog } from './dev-lab-view';
import { readDemoAppState, type DemoAppState, type DemoCompletion, type DemoHistoryRow, type DemoMember, type DemoPrize, type DemoRequest, type DemoTask, type DemoTeamGoal } from './local-demo-state';
import { todayKeyForTimezone } from './date-keys';
import '../ui/styles/index.css';

declare const GEMSPROUT_V2_DATA_SOURCE: string | undefined;

let store = loadSharedLabStore(createDemoFamilySeedStore);
let logs: LabLog[] = [];
let lastScenario: LabScenarioResult | null = null;
let firestoreState: DemoAppState | null = null;
let firestoreError = '';
let firestoreBusy = false;
let devFirestoreUnsubscribe: (() => void) | null = null;
let devFirestoreRefreshTimer = 0;
let devFirestoreRefreshInFlight = false;
let devFirestoreRefreshQueued = false;
let parentPushRegistrationKey = '';
let subscriptionAppUserId = '';
let paywallOpen = false;
const DEV_PAYWALL_BYPASS_KEY = 'gemsprout.v2.devPaywallBypass';
let devPhotoCleanupInFlight = false;
let devPhotoCleanupLastRun = 0;
let autoSavingsInterestRunKey = '';
type FirestoreOverviewWrite =
  | { kind: 'request'; action: 'approve' | 'deny'; requestId: string; resolve: (applied: boolean) => void }
  | { kind: 'undo'; historyId: string; resolve: (applied: boolean) => void };
const firestoreOverviewWriteQueue: FirestoreOverviewWrite[] = [];
const queuedFirestoreOverviewWriteKeys = new Set<string>();
let parentQuickCloseTimer: number | null = null;
let parentQuickCoachTimer: number | null = null;
let snapshotSwipeSession: {
  shell: Element;
  card: HTMLElement | null;
  startX: number;
  startY: number;
  revealedAtStart: boolean;
  dragging: boolean;
  dx: number;
} | null = null;
let snapshotSummarySwipeSession: {
  shell: Element;
  card: HTMLElement | null;
  side: 'left' | 'right';
  startX: number;
  startY: number;
  revealedAtStart: boolean;
  dragging: boolean;
  dx: number;
} | null = null;
let snapshotSwipeSuppressTapUntil = 0;
let overviewSwipeDismissBound = false;
const OVERVIEW_LAYOUT_ANIMATION_MS = 260;
let activeParentTab: ParentTabId = 'overview';
let activeQuickActionId: ParentQuickActionId | null = null;
let activeQuickActionState: ParentQuickActionState | null = null;
let activeQuickActionOrigin: { x: number; y: number } | null = null;
let listeningHoldStartedAt = 0;
let listeningRafId = 0;
let activeTaskEditorDraft: ParentTaskEditorDraft | null = null;
let activeTaskEditorMode: 'create' | 'edit' | null = null;
let activeTaskId: string | null = null;
let activePrizeEditorDraft: ParentPrizeEditorDraft | null = null;
let activePrizeId: string | null = null;
let activeGoalEditorDraft: ParentGoalEditorDraft | null = null;
let activeGoalId: string | null = null;
let activePrizeDeleteKind: 'prize' | 'goal' | null = null;
let activeIconPicker: { kind: 'level' | 'baseBadge' | 'taskBadge'; a: number | string; b?: number } | null = null;
let activeSettingsPage: ParentSettingsPage = 'main';
let devSettingsUnlocked = false;
let devSettingsUnlockTapCount = 0;
let devSettingsUnlockWindowStart = 0;
let devPushDiagnosticsClipboard = '';
let pendingComboOverrides: Record<string, Record<number, string>> = {};
let activeViewerMemberId: string | null = null;
let activeKidTab: KidTabId = 'chores';
let activeKidTimeTaskId: string | null = null;
let activeKidTimeOpenedAt = 0;
let littleKidTimeConfirm: { taskId: string; slotId: string; expiresAt: number } | null = null;
let kidPhotoCaptureOpenedAt = 0;
let pendingKidScrollTop: number | null = null;
let badgeCardGyroCleanup: (() => void) | null = null;
let statsGemCleanup: (() => void) | null = null;
const activeKidPrizeActionIds = new Set<string>();
const activeKidTaskActionIds = new Set<string>();
const rapidTapState: Record<string, { taps: number; timer: number | null }> = {};
const PROFILE_COLORS = ['#6C63FF', '#FF6584', '#43D9AD', '#FFD93D', '#6BCB77', '#FF9A3C', '#4ECDC4', '#45B7D1', '#E91E63', '#9C27B0'];
const KID_AVATARS = [
  '<i class="ph-duotone ph-smiley" style="color:#F59E0B"></i>',
  '<i class="ph-duotone ph-cat" style="color:#EC4899"></i>',
  '<i class="ph-duotone ph-dog" style="color:#8B5CF6"></i>',
  '<i class="ph-duotone ph-rabbit" style="color:#10B981"></i>',
  '<i class="ph-duotone ph-bird" style="color:#3B82F6"></i>',
  '<i class="ph-duotone ph-star" style="color:#F59E0B"></i>',
  '<i class="ph-duotone ph-rocket-launch" style="color:#6C63FF"></i>',
  '<i class="ph-duotone ph-heart" style="color:#EF4444"></i>',
  '<i class="ph-duotone ph-crown" style="color:#F59E0B"></i>',
  '<i class="ph-duotone ph-flower" style="color:#EC4899"></i>',
  '<i class="ph-duotone ph-football" style="color:#F97316"></i>',
  '<i class="ph-duotone ph-basketball" style="color:#FB923C"></i>',
  '<i class="ph-duotone ph-soccer-ball" style="color:#22C55E"></i>',
  '<i class="ph-duotone ph-baseball" style="color:#0EA5E9"></i>',
  '<i class="ph-duotone ph-game-controller" style="color:#8B5CF6"></i>',
  '<i class="ph-duotone ph-pizza" style="color:#F97316"></i>',
  '<i class="ph-duotone ph-ice-cream" style="color:#EC4899"></i>',
  '<i class="ph-duotone ph-cookie" style="color:#92400E"></i>',
  '<i class="ph-duotone ph-moon-stars" style="color:#6366F1"></i>',
  '<i class="ph-duotone ph-sun" style="color:#FACC15"></i>',
  '<i class="ph-duotone ph-rainbow" style="color:#14B8A6"></i>',
  '<i class="ph-duotone ph-planet" style="color:#3B82F6"></i>',
  '<i class="ph-duotone ph-acorn" style="color:#A16207"></i>',
  '<i class="ph-duotone ph-tree" style="color:#16A34A"></i>',
];
let kidProfileDraft: { memberId: string; avatar: string; avatarColor: string; color: string } | null = null;
let activeOnboardingStep: OnboardingStepId | null = null;
let onboardingTransitionDirection: OnboardingTransitionDirection = 'none';
let onboardingTransitionTimer = 0;
let onboardingFinishBusy = false;
let landingMode: 'landing' | 'signin' | 'signin-not-found' | 'kid-entry' | 'kid-select' | 'kid-qr' = 'landing';
let signInMessage = '';
let kidEntryMessage = '';
let kidEntryMembers: DemoMember[] = [];
let joinDifferentFamilyConfirmOpen = false;
let leaveDevicePinBuffer = '';
let leaveDevicePreviousMemberId: string | null = null;
let appLockPinBuffer = '';
let appLockRequired = false;
let appLockOpen = false;
const uiHintBounceKeys = new Set<string>();
let uiHintBounceScope = '';

function useDevFirestore(): boolean {
  return new URLSearchParams(window.location.search).get('source') === 'firestore'
    || (typeof GEMSPROUT_V2_DATA_SOURCE !== 'undefined' && GEMSPROUT_V2_DATA_SOURCE === 'firestore');
}

function showLab(): boolean {
  return new URLSearchParams(window.location.search).get('lab') === '1';
}

function showLandingPreview(): boolean {
  return new URLSearchParams(window.location.search).get('landing') === '1';
}

function pendingCount(state: DemoAppState | null): number {
  return state?.requests.filter(request => request.status === 'pending').length || 0;
}

function hasPendingFirestoreOverviewWrites(): boolean {
  return firestoreOverviewWriteQueue.length > 0 || queuedFirestoreOverviewWriteKeys.size > 0;
}

function cloneDemoState<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function roundMoney(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function reduceSavingsBuckets(member: DemoMember, amount: number): DemoMember {
  const next = { ...member };
  let remaining = roundMoney(amount);
  (['savingsGifted', 'savingsMatched', 'savingsInterest'] as const).forEach(key => {
    if (remaining <= 0) return;
    const current = roundMoney(next[key]);
    if (current <= 0) return;
    const applied = Math.min(current, remaining);
    next[key] = roundMoney(current - applied);
    remaining = roundMoney(remaining - applied);
  });
  return next;
}

function currentDemoState(): DemoAppState {
  return useDevFirestore() ? (firestoreState as DemoAppState) : readDemoAppState(store);
}

function getActiveViewer(state: DemoAppState): DemoMember | null {
  const members = state.members || [];
  if (activeViewerMemberId) {
    const selected = members.find(member => member.id === activeViewerMemberId) || null;
    if (selected) return selected;
  }
  const parent = members.find(member => member.role === 'parent') || null;
  const fallback = parent || members[0] || null;
  if (fallback?.id) activeViewerMemberId = String(fallback.id);
  return fallback;
}

function pickPrimaryDemoRequest(requests: DemoAppState['requests']): DemoAppState['request'] {
  return requests.find(request => request.status === 'pending') || requests[0] || null;
}

function applyExecutionToFirestoreState(current: DemoAppState | null, execution: {
  operation: { status?: string; error?: { reason?: string } | null } | null;
  state: {
    membersById?: Record<string, DemoMember>;
    prizesById?: Record<string, Record<string, unknown>>;
    requestsById?: Record<string, DemoRequest>;
    completionsById?: Record<string, DemoCompletion>;
  };
  history: DemoHistoryRow[];
}): DemoAppState | null {
  if (!current) return current;
  const nextMembers = [...current.members];
  for (const member of Object.values(execution.state.membersById || {})) {
    if (!member?.id) continue;
    const index = nextMembers.findIndex(item => item.id === member.id);
    if (index >= 0) nextMembers[index] = { ...nextMembers[index], ...member };
    else nextMembers.push(member);
  }

  const nextRequests = [...current.requests];
  for (const request of Object.values(execution.state.requestsById || {})) {
    if (!request?.id) continue;
    const index = nextRequests.findIndex(item => item.id === request.id);
    if (index >= 0) nextRequests[index] = { ...nextRequests[index], ...request };
    else nextRequests.push(request);
  }
  nextRequests.sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
  const nextPrizes = [...current.prizes];
  for (const prize of Object.values(execution.state.prizesById || {})) {
    if (!prize?.id) continue;
    const index = nextPrizes.findIndex(item => item.id === prize.id);
    if (index >= 0) nextPrizes[index] = { ...nextPrizes[index], ...prize };
    else nextPrizes.push(prize as DemoAppState['prizes'][number]);
  }
  nextPrizes.sort((left, right) => Number(left.cost || 0) - Number(right.cost || 0) || String(left.title || '').localeCompare(String(right.title || '')));

  const nextCompletions = [...current.completions];
  for (const completion of Object.values(execution.state.completionsById || {})) {
    if (!completion?.id) continue;
    const index = nextCompletions.findIndex(item => item.id === completion.id);
    if (index >= 0) nextCompletions[index] = { ...nextCompletions[index], ...completion };
    else nextCompletions.push(completion);
  }

  const nextHistoryRows = [...current.historyRows];
  for (const row of execution.history || []) {
    if (!row?.id) continue;
    const index = nextHistoryRows.findIndex(item => item.id === row.id);
    if (index >= 0) nextHistoryRows[index] = { ...nextHistoryRows[index], ...row };
    else nextHistoryRows.unshift(row);
  }
  nextHistoryRows.sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));

  const primaryRequest = pickPrimaryDemoRequest(nextRequests);
  const primaryMember = primaryRequest?.targetMemberId
    ? nextMembers.find(member => member.id === primaryRequest.targetMemberId) || current.member
    : nextMembers.find(member => member.id === current.member?.id) || current.member;
  const completionId = primaryRequest?.source?.completionId || '';
  const updatedCompletion = completionId ? execution.state.completionsById?.[completionId] || null : null;

  return {
    ...current,
    member: primaryMember || null,
    members: nextMembers,
    prizes: nextPrizes,
    request: primaryRequest,
    requests: nextRequests,
    completions: nextCompletions,
    completion: updatedCompletion || current.completion,
    operation: execution.operation || current.operation,
    history: nextHistoryRows[0] || null,
    historyRows: nextHistoryRows,
  };
}

function applyUndoToFirestoreState(current: DemoAppState | null, historyId: string): DemoAppState | null {
  if (!current) return current;
  const history = current.historyRows.find(row => row.id === historyId);
  if (!history) return current;
  const requestId = getUndoRequestId(historyId, history.requestId);
  if (!requestId) return current;
  const nextRequests = current.requests.map(request => {
    if (request.id !== requestId) return request;
    return {
      ...request,
      status: 'pending',
      resolvedAt: null,
      resolvedByMemberId: null,
    };
  });
  const request = nextRequests.find(item => item.id === requestId);
  if (!request) return current;

  const nextMembers = current.members.map(member => {
    if (member.id !== request.targetMemberId) return member;
    if (request.kind === 'chore_completion') {
      const points = Number(request.snapshot?.points || history.gems || 0);
      const gems = Number(member.gems || member.diamonds || 0) - points;
      return { ...member, gems, diamonds: gems, totalEarned: Number(member.totalEarned || 0) - points };
    }
    if (request.kind === 'prize_redeem') {
      const gems = Number(member.gems || member.diamonds || 0) + Math.abs(Number(history.gems || 0));
      return { ...member, gems, diamonds: gems };
    }
    if (request.kind === 'savings_spend') {
      const amount = Number(history.amount || 0);
      const bucketsBefore = history.metadata?.savingsBucketsBefore as { savingsGifted?: number; savingsMatched?: number; savingsInterest?: number } | undefined;
      return {
        ...member,
        savings: Number(member.savings || 0) + amount,
        savingsGifted: bucketsBefore ? bucketsBefore.savingsGifted : Number(member.savingsGifted || 0) + amount,
        savingsMatched: bucketsBefore ? bucketsBefore.savingsMatched : member.savingsMatched,
        savingsInterest: bucketsBefore ? bucketsBefore.savingsInterest : member.savingsInterest,
      };
    }
    return member;
  });
  const nextPrizes = current.prizes.map(prize => {
    if (request.kind !== 'prize_redeem') return prize;
    if (prize.id !== request.source?.prizeId) return prize;
    return {
      ...prize,
      redemptions: Array.isArray(prize.redemptions)
        ? prize.redemptions.filter(entry => entry.requestId !== requestId && entry.id !== history.metadata?.redemptionId)
        : [],
    };
  });

  const completionId = request.source?.completionId || (request as DemoRequest & { completionId?: string }).completionId || String(history.metadata?.completionId || '');
  const resetsCompletion = request.kind === REQUEST_KINDS.CHORE_START || request.kind === REQUEST_KINDS.CHORE_COMPLETION;
  const nextCompletions = current.completions.map(completion => {
    if (!resetsCompletion || !completionId || completion.id !== completionId) return completion;
    return { ...completion, status: 'pending', approvedAt: null, approvedByMemberId: null };
  });
  const completion = completionId && current.completion && primaryCompletionMatches(current.completion, completionId)
    ? { ...current.completion, status: 'pending', approvedAt: null, approvedByMemberId: null }
    : current.completion;
  const nextHistoryRows = current.historyRows.filter(row => row.id !== historyId);
  const primaryRequest = pickPrimaryDemoRequest(nextRequests);
  const primaryMember = primaryRequest?.targetMemberId
    ? nextMembers.find(member => member.id === primaryRequest.targetMemberId) || current.member
    : nextMembers.find(member => member.id === current.member?.id) || current.member;

  return {
    ...current,
    member: primaryMember || null,
    members: nextMembers,
    prizes: nextPrizes,
    request: primaryRequest,
    requests: nextRequests,
    completions: nextCompletions,
    completion,
    history: nextHistoryRows[0] || null,
    historyRows: nextHistoryRows,
  };
}

function primaryCompletionMatches(completion: DemoAppState['completion'], completionId: string): boolean {
  return !!completionId && !!completion && (completion as { id?: string }).id === completionId;
}

function buildOptimisticHistoryRow(request: DemoRequest, action: 'approve' | 'deny', now: number): DemoHistoryRow {
  if (action === 'deny') {
    return {
      id: `history:request:${request.id}:deny`,
      requestId: request.id,
      memberId: request.targetMemberId,
      type: 'request_denied',
      title: String(request.snapshot?.title || request.source?.reason || 'Request denied'),
      gems: 0,
      amount: null as unknown as number,
      createdAt: now,
      metadata: { kind: request.kind, deniedByMemberId: 'parent_1' },
    };
  }
  if (request.kind === 'chore_completion') {
    return {
      id: `history:request:${request.id}:approve`,
      requestId: request.id,
      memberId: request.targetMemberId,
      type: 'chore',
      title: String(request.snapshot?.title || 'Chore approved'),
      gems: Number(request.snapshot?.points || 0),
      amount: null as unknown as number,
      createdAt: now,
      metadata: {
        choreId: request.source?.choreId || null,
        completionId: request.source?.completionId || null,
        approvedByMemberId: 'parent_1',
      },
    };
  }
  if (request.kind === 'prize_redeem') {
    return {
      id: `history:request:${request.id}:approve`,
      requestId: request.id,
      memberId: request.targetMemberId,
      type: 'prize',
      title: String(request.snapshot?.title || 'Prize redeemed'),
      gems: -Math.abs(Number(request.snapshot?.cost || 0)),
      amount: null as unknown as number,
      createdAt: now,
      metadata: {
        prizeId: request.source?.prizeId || null,
        redemptionId: `redemption:${request.id}`,
        approvedByMemberId: 'parent_1',
      },
    };
  }
  return {
    id: `history:request:${request.id}:approve`,
    requestId: request.id,
    memberId: request.targetMemberId,
    type: 'savings_withdraw',
    title: request.source?.reason ? `Spent: ${request.source.reason}` : 'Savings withdrawal approved',
    gems: 0,
    amount: Number(request.source?.amount ?? request.snapshot?.amount ?? 0),
    createdAt: now,
    metadata: {
      reason: request.source?.reason || '',
      approvedByMemberId: 'parent_1',
    },
  };
}

function applyOptimisticRequestAction(current: DemoAppState | null, action: 'approve' | 'deny', requestId: string): DemoAppState | null {
  if (!current) return current;
  const now = Date.now();
  const targetRequest = current.requests.find(request => request.id === requestId);
  if (!targetRequest) return current;

  const next = cloneDemoState(current);
  const request = next.requests.find(item => item.id === requestId);
  if (!request) return current;
  request.status = action === 'approve' ? 'approved' : 'denied';
  request.resolvedAt = now;
  request.resolvedByMemberId = 'parent_1';

  const member = next.members.find(item => item.id === request.targetMemberId);
  if (action === 'approve' && member) {
    if (request.kind === 'chore_completion') {
      const points = Number(request.snapshot?.points || 0);
      const gems = Number(member.gems || member.diamonds || 0) + points;
      member.gems = gems;
      member.diamonds = gems;
      member.totalEarned = Number(member.totalEarned || 0) + points;
      if (next.completion && primaryCompletionMatches(next.completion, String(request.source?.completionId || ''))) {
        next.completion = { ...next.completion, status: 'approved', approvedAt: now, approvedByMemberId: 'parent_1' };
      }
    } else if (request.kind === 'prize_redeem') {
      const gems = Number(member.gems || member.diamonds || 0) - Math.abs(Number(request.snapshot?.cost || 0));
      member.gems = gems;
      member.diamonds = gems;
    } else if (request.kind === 'savings_spend') {
      const amount = Number(request.source?.amount ?? request.snapshot?.amount ?? 0);
      Object.assign(member, reduceSavingsBuckets(member, amount));
      member.savings = roundMoney(Number(member.savings || 0) - amount);
    }
  }

  const historyRow = buildOptimisticHistoryRow(request, action, now);
  next.historyRows = [historyRow, ...next.historyRows.filter(row => row.id !== historyRow.id)].sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
  next.history = next.historyRows[0] || null;
  next.request = pickPrimaryDemoRequest(next.requests);
  next.member = next.request?.targetMemberId
    ? next.members.find(item => item.id === next.request?.targetMemberId) || next.member
    : next.members.find(item => item.id === current.member?.id) || next.member;
  next.operation = { status: action === 'approve' ? 'applied' : 'applied', error: undefined };
  return next;
}

function addLog(text: string): void {
  logs = [{ at: new Date().toLocaleTimeString(), text }, ...logs].slice(0, 8);
}

function captureOverviewLayoutPositions(): Map<string, DOMRect> {
  const root = document.getElementById('parent-content');
  const positions = new Map<string, DOMRect>();
  root?.querySelectorAll<HTMLElement>('[data-motion-key]').forEach(node => {
    const key = node.dataset.motionKey;
    if (!key) return;
    positions.set(key, node.getBoundingClientRect());
  });
  return positions;
}

function animateOverviewLayoutShift(previous: Map<string, DOMRect>): void {
  const root = document.getElementById('parent-content');
  if (!root || previous.size === 0) return;
  requestAnimationFrame(() => {
    root.querySelectorAll<HTMLElement>('[data-motion-key]').forEach(node => {
      const key = node.dataset.motionKey;
      if (!key) return;
      const before = previous.get(key);
      if (!before) return;
      const after = node.getBoundingClientRect();
      const deltaY = before.top - after.top;
      if (Math.abs(deltaY) < 1) return;
      node.animate([
        { transform: `translateY(${deltaY}px)` },
        { transform: 'translateY(0px)' },
      ], {
        duration: OVERVIEW_LAYOUT_ANIMATION_MS,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      });
    });
  });
}

function animateHandledInboxRow(button: HTMLElement, onDone: () => void): void {
  const row = button.closest('.admin-card') as HTMLElement | null;
  if (!row || row.classList.contains('is-handling')) {
    onDone();
    return;
  }
  row.classList.add('is-handling');
  const height = row.offsetHeight;
  row.style.height = `${height}px`;
  row.style.overflow = 'hidden';
  row.style.transition = 'opacity 180ms ease, transform 180ms ease, height 180ms ease, margin 180ms ease, padding 180ms ease';
  window.requestAnimationFrame(() => {
    row.style.opacity = '0';
    row.style.transform = 'translateX(18px) scale(0.98)';
    row.style.height = '0px';
    row.style.marginTop = '0px';
    row.style.marginBottom = '0px';
    row.style.paddingTop = '0px';
    row.style.paddingBottom = '0px';
  });
  window.setTimeout(() => {
    row.remove();
    decrementInboxCounts();
    onDone();
  }, 190);
}

function animateInboxRowElement(row: HTMLElement): void {
  const height = row.offsetHeight;
  row.style.height = `${height}px`;
  row.style.overflow = 'hidden';
  row.style.transition = 'opacity 180ms ease, transform 180ms ease, height 180ms ease, margin 180ms ease, padding 180ms ease';
  window.requestAnimationFrame(() => {
    row.style.opacity = '0';
    row.style.transform = 'translateX(18px) scale(0.98)';
    row.style.height = '0px';
    row.style.marginTop = '0px';
    row.style.marginBottom = '0px';
    row.style.paddingTop = '0px';
    row.style.paddingBottom = '0px';
  });
  window.setTimeout(() => {
    row.remove();
    decrementInboxCounts();
  }, 190);
}

function refreshParentRecentActivity(): void {
  if (!firestoreState || activeParentTab !== 'overview') return;
  const current = document.getElementById('overview-history-section');
  if (!current) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderHistory(firestoreState.historyRows);
  const next = wrapper.firstElementChild;
  if (!next) return;
  current.replaceWith(next);
  bindRecentActivityActions(next as HTMLElement);
}

function refreshParentOverviewSections(): void {
  if (!firestoreState || activeParentTab !== 'overview') return;
  const model = createParentDashboardModel(firestoreState);
  const hero = document.getElementById('overview-hero-section');
  if (hero) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderHero(model);
    const nextHero = wrapper.firstElementChild;
    if (nextHero) {
      hero.replaceWith(nextHero);
      bindParentQuickActions(firestoreState);
    }
  }
  const snapshots = document.getElementById('overview-snapshots-section');
  if (snapshots) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderSnapshots(model);
    const nextSnapshots = wrapper.firstElementChild;
    if (nextSnapshots) {
      snapshots.replaceWith(nextSnapshots);
      bindSnapshotSummaryActions(nextSnapshots as HTMLElement);
    }
  }
  refreshParentRecentActivity();
}

function decrementInboxCounts(): void {
  document.querySelectorAll<HTMLElement>('.inbox-count').forEach(node => {
    const current = Number((node.textContent || '').match(/\d+/)?.[0] || 0);
    const next = Math.max(0, current - 1);
    node.textContent = `${next} Item${next === 1 ? '' : 's'}`;
  });
  document.querySelectorAll<HTMLElement>('.nav-badge').forEach(node => {
    const current = Number((node.textContent || '').match(/\d+/)?.[0] || 0);
    const next = Math.max(0, current - 1);
    if (next === 0) node.remove();
    else node.textContent = String(next);
  });
}

function showScreen(id: string): void {
  document.querySelectorAll<HTMLElement>('.screen').forEach(screen => {
    screen.classList.remove('active');
    if (screen.id === 'screen-auth' && id !== 'screen-auth') {
      screen.classList.remove('loading');
      screen.removeAttribute('style');
    }
  });
  document.getElementById(id)?.classList.add('active');
}

function createRequestAction(action: 'approve' | 'deny', requestId: string, familyId = LAB_FAMILY_ID, now = Date.now()) {
  return makeRequestOperation({
    id: `op:request:${action}:${requestId}`,
    familyId,
    kind: action === 'approve' ? OPERATION_KINDS.REQUEST_APPROVE : OPERATION_KINDS.REQUEST_DENY,
    requestId,
    actorMemberId: 'parent_1',
    createdAt: now,
  });
}

function runApproval(requestId = 'request_1'): void {
  store = loadSharedLabStore(createDemoFamilySeedStore);
  const now = Date.now();
  const result = commitRequestOperation(store, createRequestAction('approve', requestId, LAB_FAMILY_ID, now), { now });
  if (result.ok && !result.duplicate) {
    applyApprovalProgressionToStore(store, LAB_FAMILY_ID, requestId, now);
    applyDailyComboBonusToStore(store, LAB_FAMILY_ID, requestId, now);
  }
  saveSharedLabStore(store);
  addLog(result.duplicate ? 'Replay ignored: operation was already applied.' : result.ok ? 'Approval applied.' : `Approval failed: ${result.error?.reason || 'unknown'}`);
  render();
}

function runDenial(requestId = 'request_1'): void {
  store = loadSharedLabStore(createDemoFamilySeedStore);
  const result = commitRequestOperation(store, createRequestAction('deny', requestId), { now: Date.now() });
  saveSharedLabStore(store);
  addLog(result.duplicate ? 'Replay ignored: denial was already applied.' : result.ok ? 'Request denied.' : `Denial failed: ${result.error?.reason || 'unknown'}`);
  render();
}

function runRace(): void {
  store = loadSharedLabStore(createDemoFamilySeedStore);
  lastScenario = runTwoDeviceApprovalRaceOnStore(store, Date.now());
  saveSharedLabStore(store);
  addLog(`Race: first applied=${lastScenario.firstApplied}, second duplicate=${lastScenario.secondDuplicate}.`);
  render();
}

function runScenario(name: string, runOnStore: (store: FakeFirestoreGateway, now?: number) => LabScenarioResult): void {
  store = loadSharedLabStore(createDemoFamilySeedStore);
  lastScenario = runOnStore(store, Date.now());
  saveSharedLabStore(store);
  addLog(`${name}: request=${lastScenario.requestStatus}, operation=${lastScenario.operationStatus}${lastScenario.reason ? `, reason=${lastScenario.reason}` : ''}.`);
  render();
}

function resetLocalState(): void {
  store = resetSharedLabStore(createDemoFamilySeedStore);
  logs = [];
  lastScenario = null;
  addLog('Local v2 state reset.');
  render();
}

function bindActions(): void {
  document.getElementById('reset-state-btn')?.addEventListener('click', openSettingsPane);
  document.getElementById('reset-hero-btn')?.addEventListener('click', resetLocalState);
  document.querySelectorAll<HTMLButtonElement>('[data-approve-request-id]').forEach(button => {
    button.addEventListener('click', () => animateHandledInboxRow(button, () => runApproval(button.dataset.approveRequestId || 'request_1')));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-deny-request-id]').forEach(button => {
    button.addEventListener('click', () => animateHandledInboxRow(button, () => runDenial(button.dataset.denyRequestId || 'request_1')));
  });
  document.getElementById('lab-approve-btn')?.addEventListener('click', () => runApproval());
  document.getElementById('lab-replay-btn')?.addEventListener('click', () => runApproval());
  document.getElementById('race-btn')?.addEventListener('click', runRace);
  document.getElementById('prize-fail-btn')?.addEventListener('click', () => runScenario('Prize failure', runPrizeApprovalFailureOnStore));
  document.getElementById('stale-approved-btn')?.addEventListener('click', () => runScenario('Stale approved', runStaleApprovedRequestOnStore));
  document.getElementById('stale-denied-btn')?.addEventListener('click', () => runScenario('Stale denied', runStaleDeniedRequestOnStore));
  document.getElementById('savings-btn')?.addEventListener('click', () => runScenario('Savings', runSavingsApprovalOnStore));
  bindParentQuickActions(readDemoAppState(store));
  bindHomeScreenActions(readDemoAppState(store));
  bindKidPlaceholderActions();
  bindPhotoPreviewActions();
}

async function runFirestoreAction(action: 'approve' | 'deny', requestId: string, options: { suppressRender?: boolean } = {}): Promise<boolean> {
  if (firestoreBusy) return false;
  firestoreBusy = true;
  firestoreError = '';
  const previousState = cloneDemoState(firestoreState);
  firestoreState = applyOptimisticRequestAction(firestoreState, action, requestId) || firestoreState;
  if (!options.suppressRender) void renderDevFirestore();
  let applied = false;
  try {
    const { commitDevRequestAction } = await import('../platform/firebase/dev-firestore-operations.js');
    const execution = await commitDevRequestAction({ action, requestId });
    applied = execution.ok || execution.duplicate;
    if (!options.suppressRender && action === 'approve' && execution.ok && !execution.duplicate) {
      firestoreState = null;
    } else {
      firestoreState = applyExecutionToFirestoreState(firestoreState, execution) || firestoreState;
    }
    if (!applied) {
      firestoreError = execution.error?.message || execution.error?.reason || 'Request action failed.';
      if (options.suppressRender) void renderDevFirestore();
    }
  } catch (error) {
    firestoreState = previousState;
    firestoreError = error instanceof Error ? error.message : String(error);
    if (options.suppressRender) void renderDevFirestore();
  } finally {
    firestoreBusy = false;
    if (!options.suppressRender) void renderDevFirestore();
  }
  return applied;
}

function enqueueFirestoreInboxWrite(action: 'approve' | 'deny', requestId: string): Promise<boolean> {
  const key = `request:${requestId}`;
  if (!requestId || queuedFirestoreOverviewWriteKeys.has(key)) return Promise.resolve(false);
  queuedFirestoreOverviewWriteKeys.add(key);
  return new Promise(resolve => {
    firestoreOverviewWriteQueue.push({ kind: 'request', action, requestId, resolve });
    void processFirestoreOverviewWriteQueue();
  });
}

function enqueueFirestoreUndoWrite(historyId: string): Promise<boolean> {
  const key = `undo:${historyId}`;
  if (!historyId || queuedFirestoreOverviewWriteKeys.has(key)) return Promise.resolve(false);
  queuedFirestoreOverviewWriteKeys.add(key);
  return new Promise(resolve => {
    firestoreOverviewWriteQueue.push({ kind: 'undo', historyId, resolve });
    void processFirestoreOverviewWriteQueue();
  });
}

async function processFirestoreOverviewWriteQueue(): Promise<void> {
  if (firestoreBusy) {
    window.setTimeout(() => void processFirestoreOverviewWriteQueue(), 60);
    return;
  }
  const item = firestoreOverviewWriteQueue.shift();
  if (!item) return;
  const key = item.kind === 'request' ? `request:${item.requestId}` : `undo:${item.historyId}`;
  firestoreBusy = true;
  firestoreError = '';
  let applied = false;
  try {
    if (item.kind === 'request') {
      const { commitDevRequestAction } = await import('../platform/firebase/dev-firestore-operations.js');
      const execution = await commitDevRequestAction({ action: item.action, requestId: item.requestId });
      applied = execution.ok || execution.duplicate;
      firestoreState = item.action === 'approve' && execution.ok && !execution.duplicate
        ? null
        : applyExecutionToFirestoreState(firestoreState, execution) || firestoreState;
      if (!applied) firestoreError = execution.error?.message || execution.error?.reason || 'Request action failed.';
    } else {
      const { undoDevHistoryAction } = await import('../platform/firebase/dev-firestore-operations.js');
      await undoDevHistoryAction({ historyId: item.historyId });
      applied = true;
    }
  } catch (error) {
    firestoreError = error instanceof Error ? error.message : String(error);
  } finally {
    firestoreBusy = false;
    queuedFirestoreOverviewWriteKeys.delete(key);
    item.resolve(applied);
    if (firestoreOverviewWriteQueue.length > 0) void processFirestoreOverviewWriteQueue();
    else if (devFirestoreRefreshQueued) {
      devFirestoreRefreshQueued = false;
      scheduleDevFirestoreRefresh(40);
    }
  }
}

function applyDailyComboBonusToStore(gateway: FakeFirestoreGateway, familyId: string, requestId: string, now: number): void {
  const request = gateway.get<DemoRequest & { familyId?: string }>(requestPath(familyId, requestId));
  if (request?.kind !== REQUEST_KINDS.CHORE_COMPLETION || request.status !== REQUEST_STATUSES.APPROVED) return;
  const memberId = String(request.targetMemberId || '');
  const completedChoreId = String(request.source?.choreId || '');
  if (!memberId || !completedChoreId) return;

  const family = gateway.get<{ settings?: DemoAppState['settings'] }>(familyPath(familyId)) || {};
  const settings = family.settings || {};
  if (settings.comboEnabled === false) return;
  const today = dateKeyFromTime(now, settings.familyTimezone);
  const member = gateway.get<DemoMember>(memberPath(familyId, memberId));
  if (!member || member.comboBonusDate === today) return;

  const dump = gateway.dump();
  const members = Object.entries(dump)
    .filter(([path]) => path.startsWith(`${familyPath(familyId)}/members/`))
    .map(([, value]) => value as DemoMember)
    .filter(item => !!item?.id);
  const tasks = Object.entries(dump)
    .filter(([path]) => path.startsWith(`${familyPath(familyId)}/chores/`))
    .map(([, value]) => value as DemoTask)
    .filter(task => !!task?.id);
  const comboIds = getDailyComboIdsForMember({ members, tasks, settings }, memberId, today);
  if (comboIds.length < 3 || !comboIds.includes(completedChoreId)) return;
  applyDailyComboBonusToStoreForCombo(gateway, familyId, memberId, comboIds, today, now);
}

function applyDailyComboBonusToStoreForCombo(gateway: FakeFirestoreGateway, familyId: string, memberId: string, comboIds: string[], today: string, now: number): void {
  const family = gateway.get<{ settings?: DemoAppState['settings'] }>(familyPath(familyId)) || {};
  const settings = family.settings || {};
  if (settings.comboEnabled === false) return;
  const member = gateway.get<DemoMember>(memberPath(familyId, memberId));
  if (!member || member.comboBonusDate === today) return;
  const allDone = comboIds.every(choreId => isComboTaskApprovedToday(gateway, familyId, memberId, choreId, today));
  if (!allDone) return;
  const dump = gateway.dump();
  const tasks = Object.entries(dump)
    .filter(([path]) => path.startsWith(`${familyPath(familyId)}/chores/`))
    .map(([, value]) => value as DemoTask)
    .filter(task => !!task?.id);
  const taskById = new Map(tasks.map(task => [String(task.id || ''), task]));
  const baseSum = comboIds.reduce((sum, choreId) => {
    const task = taskById.get(choreId);
    return sum + Number(task?.gems ?? task?.diamonds ?? 0);
  }, 0);
  const bonusGems = Math.max(1, Number(settings.comboMultiplier || 2) - 1) * baseSum;
  const currentGems = Number(member.gems || member.diamonds || 0);
  const comboStreak = nextComboStreak(member.comboStreak, today);
  const nextMember: DemoMember = {
    ...member,
    gems: currentGems + bonusGems,
    diamonds: currentGems + bonusGems,
    totalEarned: Number(member.totalEarned || 0) + bonusGems,
    xp: settings.levelingEnabled === false ? member.xp : Number(member.xp || 0) + bonusGems,
    comboBonusDate: today,
    comboStreak,
  };
  const historyId = `history:combo:${memberId}:${today}`;
  gateway.set(memberPath(familyId, memberId), nextMember);
  gateway.set(historyPath(familyId, historyId), {
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
  });
}

function applyApprovalProgressionToStore(gateway: FakeFirestoreGateway, familyId: string, requestId: string, now: number): void {
  const request = gateway.get<DemoRequest & { familyId?: string }>(requestPath(familyId, requestId));
  if (request?.kind !== REQUEST_KINDS.CHORE_COMPLETION || request.status !== REQUEST_STATUSES.APPROVED) return;
  const memberId = String(request.targetMemberId || '');
  const choreId = String(request.source?.choreId || '');
  const points = Number(request.snapshot?.points || 0);
  if (!memberId || !choreId) return;

  const family = gateway.get<{ settings?: DemoAppState['settings'] }>(familyPath(familyId)) || {};
  const settings = family.settings || {};
  const member = gateway.get<DemoMember>(memberPath(familyId, memberId));
  const task = gateway.get<DemoTask>(chorePath(familyId, choreId));
  if (!member) return;

  const today = dateKeyFromTime(now, settings.familyTimezone);
  const previousLevel = currentLevelNumber(settings, member);
  const nextMember = cloneDemoState(member) as DemoMember;
  if (settings.levelingEnabled !== false) nextMember.xp = Number(nextMember.xp || 0) + points;

  const streakBonus = settings.streakEnabled !== false ? updateMemberStreak(nextMember, settings, today) : 0;
  if (streakBonus > 0) {
    const nextGems = Number(nextMember.gems || nextMember.diamonds || 0) + streakBonus;
    nextMember.gems = nextGems;
    nextMember.diamonds = nextGems;
    nextMember.totalEarned = Number(nextMember.totalEarned || 0) + streakBonus;
    if (settings.levelingEnabled !== false) nextMember.xp = Number(nextMember.xp || 0) + streakBonus;
    gateway.set(historyPath(familyId, `history:streak:${memberId}:${today}`), {
      id: `history:streak:${memberId}:${today}`,
      familyId,
      memberId,
      type: 'chore',
      title: `Streak bonus (${nextMember.streak?.current || 0} days)`,
      gems: streakBonus,
      amount: null,
      createdAt: now + 1,
      occurredAt: now + 1,
      metadata: { streak: nextMember.streak?.current || 0 },
    });
  }
  if (settings.streakEnabled !== false) awardStreakBadges(gateway, familyId, nextMember, settings, now + 2);

  awardBaseBadge(gateway, familyId, nextMember, settings, 'first_chore', now + 2);
  awardGemBadges(gateway, familyId, nextMember, settings, now + 3);
  if (settings.choreBadgesEnabled !== false && task) awardTaskBadges(gateway, familyId, nextMember, task, countApprovedTaskCompletions(gateway, familyId, memberId, choreId), now + 4);
  if (settings.levelingEnabled !== false) awardLevelBadges(gateway, familyId, nextMember, settings, previousLevel, now + 5);
  gateway.set(memberPath(familyId, memberId), nextMember);
}

function isComboTaskApprovedToday(gateway: FakeFirestoreGateway, familyId: string, memberId: string, choreId: string, today: string): boolean {
  return Object.entries(gateway.dump()).some(([path, value]) => {
    if (!path.startsWith(`${familyPath(familyId)}/completions/`)) return false;
    const completion = value as DemoCompletion;
    return completion.memberId === memberId
      && completion.choreId === choreId
      && completion.date === today
      && completion.status === 'approved';
  });
}

function getDailyComboIdsForMember(input: { members: DemoMember[]; tasks: DemoTask[]; settings: DemoAppState['settings'] }, memberId: string, today: string): string[] {
  const override = input.settings.comboOverrides?.[memberId];
  if (override?.date === today && Array.isArray(override.ids)) return override.ids.slice(0, 3).filter(Boolean);
  const assigned = input.settings.comboAssignments?.[memberId];
  if (Array.isArray(assigned) && assigned.length) return assigned.slice(0, 3).filter(Boolean);
  return getAllDailyComboIds(input.members, input.tasks, today)[memberId] || [];
}

function getAllDailyComboIds(members: DemoMember[], tasks: DemoTask[], today: string): Record<string, string[]> {
  const kids = members.filter(member => member.role === 'kid' && !member.deleted).sort((left, right) => String(left.id || '').localeCompare(String(right.id || '')));
  const used = new Set<string>();
  const combos: Record<string, string[]> = {};
  for (const kid of kids) {
    const kidId = String(kid.id || '');
    const eligible = tasks.filter(task =>
      Array.isArray(task.assignedTo)
      && task.assignedTo.includes(kidId)
      && task.schedule?.period !== 'once'
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

function currentLevelNumber(settings: DemoAppState['settings'], member: DemoMember): number {
  const xp = Number(member.xp ?? member.totalEarned ?? 0);
  return getLevels(settings)
    .slice()
    .sort((left, right) => Number(left.minXp || 0) - Number(right.minXp || 0))
    .reduce((level, candidate) => xp >= Number(candidate.minXp || 0) ? Number(candidate.level || level) : level, 1);
}

function awardBaseBadge(gateway: FakeFirestoreGateway, familyId: string, member: DemoMember, settings: DemoAppState['settings'], badgeId: string, now: number): void {
  if (settings.baseBadgesEnabled === false) return;
  const def = getBaseBadgeDef(settings, badgeId);
  if (!def) return;
  if (!Array.isArray(member.badges)) member.badges = [];
  if (member.badges.includes(badgeId)) return;
  member.badges.push(badgeId);
  gateway.set(historyPath(familyId, `history:badge:${member.id}:${badgeId}`), {
    id: `history:badge:${member.id}:${badgeId}`,
    familyId,
    memberId: member.id,
    type: 'badge',
    title: def.name,
    gems: 0,
    amount: null,
    createdAt: now,
    occurredAt: now,
    metadata: { badgeId, badgeIcon: def.icon },
  });
}

function awardGemBadges(gateway: FakeFirestoreGateway, familyId: string, member: DemoMember, settings: DemoAppState['settings'], now: number): void {
  const xp = Number(member.xp ?? member.totalEarned ?? 0);
  if (xp >= 50) awardBaseBadge(gateway, familyId, member, settings, 'dmds_50', now);
  if (xp >= 200) awardBaseBadge(gateway, familyId, member, settings, 'dmds_200', now);
  if (xp >= 500) awardBaseBadge(gateway, familyId, member, settings, 'dmds_500', now);
  if (xp >= 1000) awardBaseBadge(gateway, familyId, member, settings, 'dmds_1000', now);
}

function awardLevelBadges(gateway: FakeFirestoreGateway, familyId: string, member: DemoMember, settings: DemoAppState['settings'], previousLevel: number, now: number): void {
  const currentLevel = currentLevelNumber(settings, member);
  if (currentLevel <= previousLevel) return;
  awardBaseBadge(gateway, familyId, member, settings, 'level_up', now);
  const maxLevel = getLevels(settings).reduce((max, level) => Math.max(max, Number(level.level || 0)), 0);
  if (currentLevel >= maxLevel) awardBaseBadge(gateway, familyId, member, settings, 'level_master', now + 1);
  const current = getLevels(settings).find(level => Number(level.level || 0) === currentLevel);
  gateway.set(historyPath(familyId, `history:level:${member.id}:${currentLevel}`), {
    id: `history:level:${member.id}:${currentLevel}`,
    familyId,
    memberId: member.id,
    type: 'level',
    title: `Level Up - ${current?.name || `Level ${currentLevel}`}!`,
    gems: 0,
    amount: null,
    createdAt: now + 2,
    occurredAt: now + 2,
    metadata: { level: currentLevel },
  });
}

function awardStreakBadges(gateway: FakeFirestoreGateway, familyId: string, member: DemoMember, settings: DemoAppState['settings'], now: number): void {
  const current = Number(member.streak?.current || 0);
  if (current >= 3) awardBaseBadge(gateway, familyId, member, settings, 'streak_3', now);
  if (current >= 7) awardBaseBadge(gateway, familyId, member, settings, 'streak_7', now + 1);
  if (current >= 14) awardBaseBadge(gateway, familyId, member, settings, 'streak_14', now + 2);
  if (current >= 30) awardBaseBadge(gateway, familyId, member, settings, 'streak_30', now + 3);
}

function awardTaskBadges(gateway: FakeFirestoreGateway, familyId: string, member: DemoMember, task: DemoTask, doneCount: number, now: number): void {
  if (!Array.isArray(task.badges) || !task.badges.length) return;
  if (!Array.isArray(member.badges)) member.badges = [];
  for (const badge of task.badges) {
    if (!badge.id || !badge.count) continue;
    const key = `cb_${badge.id}`;
    if (doneCount < Number(badge.count) || member.badges.includes(key)) continue;
    member.badges.push(key);
    gateway.set(historyPath(familyId, `history:badge:${member.id}:${key}`), {
      id: `history:badge:${member.id}:${key}`,
      familyId,
      memberId: member.id,
      type: 'badge',
      title: badge.name || 'Badge',
      gems: 0,
      amount: null,
      createdAt: now,
      occurredAt: now,
      metadata: { badgeId: key, badgeIcon: badge.icon || '<i class="ph-duotone ph-medal" style="color:#7C3AED"></i>', choreTitle: task.title || '' },
    });
  }
}

function countApprovedTaskCompletions(gateway: FakeFirestoreGateway, familyId: string, memberId: string, choreId: string): number {
  return Object.entries(gateway.dump()).filter(([path, value]) => {
    if (!path.startsWith(`${familyPath(familyId)}/completions/`)) return false;
    const completion = value as DemoCompletion;
    return completion.memberId === memberId
      && completion.choreId === choreId
      && completion.status === 'approved'
      && completion.entryType !== 'before';
  }).length;
}

function updateMemberStreak(member: DemoMember, settings: DemoAppState['settings'], today: string): number {
  const streak = member.streak || { current: 0, best: 0, lastDate: null };
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

function streakHasGap(member: DemoMember, fromDate: string, toDate: string): boolean {
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

function isMemberHereOnDate(member: DemoMember, dateKey: string): boolean {
  const split = member.splitHousehold;
  if (split?.overrides && dateKey in split.overrides) return split.overrides[dateKey] !== false;
  if (!split?.enabled) return true;
  const reference = new Date(`${split.referenceMonday || dateKey}T00:00:00`);
  const date = new Date(`${dateKey}T00:00:00`);
  const diff = Math.round((date.getTime() - reference.getTime()) / 86400000);
  const pos = ((diff % 14) + 14) % 14;
  return split.cycle?.[pos] !== false;
}

function getStreakBonus(settings: DemoAppState['settings'], streakCount: number): number {
  if (streakCount >= 30) return Number(settings.streakBonus30 || 10);
  if (streakCount >= 14) return Number(settings.streakBonus14 || 5);
  if (streakCount >= 7) return Number(settings.streakBonus7 || 3);
  if (streakCount >= 3) return Number(settings.streakBonus3 || 1);
  return 0;
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

function nextComboStreak(current: DemoMember['comboStreak'] | undefined, today: string): NonNullable<DemoMember['comboStreak']> {
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

function bindFirestoreActions(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-approve-request-id]').forEach(button => {
    button.addEventListener('click', () => void handleFirestoreInboxAction(button, 'approve', button.dataset.approveRequestId || ''));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-deny-request-id]').forEach(button => {
    button.addEventListener('click', () => void handleFirestoreInboxAction(button, 'deny', button.dataset.denyRequestId || ''));
  });
  document.getElementById('reset-state-btn')?.addEventListener('click', openSettingsPane);
  if (firestoreState) bindParentQuickActions(firestoreState);
  if (firestoreState) bindHomeScreenActions(firestoreState);
  bindKidPlaceholderActions();
  bindPhotoPreviewActions();
}

async function handleFirestoreInboxAction(button: HTMLButtonElement, action: 'approve' | 'deny', requestId: string): Promise<void> {
  const row = button.closest('.admin-card') as HTMLElement | null;
  if (!row || row.dataset.firestoreHandling === 'true' || !requestId) return;
  row.dataset.firestoreHandling = 'true';
  row.querySelectorAll<HTMLButtonElement>('button').forEach(item => {
    item.disabled = true;
  });
  animateInboxRowElement(row);
  firestoreState = applyOptimisticRequestAction(firestoreState, action, requestId) || firestoreState;
  refreshParentOverviewSections();
  const pendingAction = enqueueFirestoreInboxWrite(action, requestId);
  const applied = await pendingAction;
  if (applied) {
    return;
  }
  const message = firestoreError || 'Could not save that inbox action.';
  toast(message);
  firestoreError = '';
  firestoreState = null;
  void renderDevFirestore();
}

function bindPhotoPreviewActions(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-view-photo]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const url = button.dataset.viewPhoto || '';
      if (url) openPhotoPreview(url);
    });
  });
}

function bindKidBadgeCards(): void {
  document.querySelectorAll<HTMLElement>('[data-kid-badge-card]').forEach(badge => {
    badge.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openBadgeCardFromDataset(badge.dataset);
    });
  });
}

function bindStatsGemEasterEgg(): void {
  statsGemCleanup?.();
  statsGemCleanup = null;
  const content = document.getElementById('kid-content');
  const nav = document.getElementById('kid-nav');
  const gem = document.querySelector<HTMLElement>('[data-stats-egg-gem]');
  content?.classList.toggle('stats-page-content', !!gem);
  if (!content || !nav || !gem) return;

  let rafId = 0;
  let resizeObserver: ResizeObserver | null = null;
  const viewport = window.visualViewport || null;

  const applyMetrics = () => {
    const navStyles = getComputedStyle(nav);
    const navHeight = nav.offsetHeight || 0;
    const navPaddingBottom = parseFloat(navStyles.paddingBottom) || 0;
    const safeBottom = navPaddingBottom > 0 ? Math.max(0, navPaddingBottom - 6) : 12;
    const gemBottomOffset = safeBottom + navHeight + 12;
    const reservedBottom = Math.ceil(gemBottomOffset + 45 + 16);
    content.style.setProperty('--nav-h', `${navHeight}px`);
    content.style.setProperty('--safe-b', `${safeBottom}px`);
    content.style.setProperty('--content-bottom-space', `${reservedBottom}px`);
  };

  const updateVisibility = () => {
    rafId = 0;
    applyMetrics();
    const overflowPx = Math.max(0, content.scrollHeight - content.clientHeight);
    const scrollable = overflowPx > 24;
    const atBottom = !scrollable || content.scrollTop + content.clientHeight >= content.scrollHeight - 6;
    gem.classList.toggle('is-visible', atBottom);
    if (!atBottom) gem.style.removeProperty('opacity');
  };

  const scheduleUpdate = () => {
    if (rafId) return;
    rafId = window.requestAnimationFrame(updateVisibility);
  };

  const handleTap = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    handleStatsGemEasterEggTap();
  };

  gem.addEventListener('click', handleTap);
  content.addEventListener('scroll', scheduleUpdate, { passive: true });
  content.addEventListener('touchmove', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  viewport?.addEventListener('resize', scheduleUpdate);
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(content);
    resizeObserver.observe(nav);
  }

  window.requestAnimationFrame(() => window.requestAnimationFrame(scheduleUpdate));
  window.setTimeout(scheduleUpdate, 120);
  window.setTimeout(scheduleUpdate, 420);

  statsGemCleanup = () => {
    gem.removeEventListener('click', handleTap);
    content.removeEventListener('scroll', scheduleUpdate);
    content.removeEventListener('touchmove', scheduleUpdate);
    window.removeEventListener('resize', scheduleUpdate);
    viewport?.removeEventListener('resize', scheduleUpdate);
    resizeObserver?.disconnect();
    if (rafId) window.cancelAnimationFrame(rafId);
    content.classList.remove('stats-page-content');
    content.style.removeProperty('--nav-h');
    content.style.removeProperty('--safe-b');
    content.style.removeProperty('--content-bottom-space');
  };
}

function triggerKidAvatarEasterEgg(): void {
  const state = currentDemoState();
  const member = getActiveViewer(state);
  if (!member || member.role !== 'kid') return;
  const avatar = String(member.avatar || '<i class="ph-duotone ph-smiley" style="color:#9CA3AF"></i>');
  const color = String(member.avatarColor || member.color || '#6C63FF');
  handleRapidTap('kid-header-avatar', {
    pulseEl: document.querySelector<HTMLElement>('#kid-header .header-avatar'),
    required: 5,
    pulseClass: 'rapid-tap-wiggle',
    onTrigger: () => launchAvatarRain(avatar, 84, null, color),
  });
}

function renderAvatarPreviewHtml(avatar: string, color: string, fallback = '<i class="ph-duotone ph-smiley" style="color:#9CA3AF"></i>'): string {
  const value = avatar || fallback;
  if (/\.(png|jpe?g|gif|webp)$/i.test(value)) return `<img src="${escapeHtmlAttr(value)}" class="avatar-img">`;
  if (value.includes('<')) return applyAvatarColor(value, color);
  const icon = value.replace(/^ph-duotone\s+/, '').replace(/^ph-/, '') || 'smiley';
  return `<i class="ph-duotone ph-${escapeHtmlAttr(icon)}" style="color:${escapeHtmlAttr(color)}"></i>`;
}

function openKidSettings(triggerEl?: Element | null): void {
  kidProfileDraft = null;
  const state = currentDemoState();
  const member = getActiveViewer(state);
  if (!member || member.role !== 'kid') return;
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="${modalOriginStyle(triggerEl?.getBoundingClientRect())}">
      <div class="modal quick-action-modal modal-origin-sheet" role="dialog" aria-modal="true">
        <button class="modal-close-x" data-modal-close type="button" aria-label="Close"><i class="ph-duotone ph-x"></i></button>
        <div class="modal-title"><i class="ph-duotone ph-gear-six" style="color:#6C63FF;font-size:1.2rem;vertical-align:middle"></i> Settings</div>
        <p style="color:var(--muted);font-size:0.95rem;margin-bottom:16px">Signed in as <strong>${escapeHtmlAttr(member.name || 'User')}</strong>.</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" style="min-height:56px;display:flex;align-items:center;justify-content:center;gap:6px;line-height:1.15;text-align:center" data-kid-edit-profile type="button"><i class="ph-duotone ph-user-circle-gear" style="vertical-align:middle"></i><span>Edit<br>Profile</span></button>
          <button class="btn btn-primary" style="min-height:56px;display:flex;align-items:center;justify-content:center;gap:6px;line-height:1.15;text-align:center" data-kid-settings-switch-user type="button"><i class="ph-duotone ph-users" style="vertical-align:middle"></i><span>Switch<br>User</span></button>
        </div>
        <button style="width:100%;background:none;border:none;padding:10px 0 0;color:#7A8580;font-size:0.92rem;font-weight:700;cursor:pointer;margin-top:40px" data-kid-leave-device type="button">
          <i class="ph-duotone ph-sign-out" style="vertical-align:middle;margin-right:6px"></i> Leave this Device
        </button>
      </div>
    </div>`;
  bindKidSettingsModalActions();
}

function bindKidSettingsModalActions(): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.querySelectorAll<HTMLElement>('[data-modal-close]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelector<HTMLElement>('[data-kid-edit-profile]')?.addEventListener('click', () => openKidProfileLookModal(true));
  root.querySelector<HTMLElement>('[data-kid-settings-switch-user]')?.addEventListener('click', () => {
    closeModal();
    openSwitchUserScreen();
  });
  root.querySelector<HTMLElement>('[data-kid-leave-device]')?.addEventListener('click', () => {
    closeModal();
    showLeaveDevicePin();
  });
}

function showLeaveDevicePin(): void {
  const state = currentDemoState();
  const member = getActiveViewer(state);
  if (!member || member.role !== 'kid') return;
  leaveDevicePinBuffer = '';
  leaveDevicePreviousMemberId = String(member.id || '');
  showScreen('screen-pin');
  const content = document.getElementById('pin-content');
  if (!content) return;
  content.innerHTML = `
    <div class="pin-avatar"><i class="ph-duotone ph-sign-out" style="color:#6C63FF;font-size:2.5rem"></i></div>
    <div class="pin-title">Leave this Device</div>
    <div class="pin-sub">Enter the parent PIN to confirm</div>
    <div class="pin-dots" id="pin-dots">
      <div class="pin-dot" id="pd0"></div>
      <div class="pin-dot" id="pd1"></div>
      <div class="pin-dot" id="pd2"></div>
      <div class="pin-dot" id="pd3"></div>
    </div>
    <div class="pin-grid">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'Del'].map(key => `
        <button class="pin-key${key === '' ? ' hidden' : ''}" data-leave-device-pin-key="${key}" type="button">${key}</button>
      `).join('')}
    </div>
    <div id="pin-error" class="pin-error hidden"></div>
    <button class="btn btn-secondary mt-16" style="width:min(360px,calc(100vw - 48px))" data-leave-device-cancel type="button">Cancel</button>`;
  bindLeaveDevicePinActions();
}

function bindLeaveDevicePinActions(): void {
  document.querySelectorAll<HTMLElement>('[data-leave-device-pin-key]').forEach(button => {
    button.addEventListener('click', () => handleLeaveDevicePinKey(button.dataset.leaveDevicePinKey || ''));
  });
  document.querySelector<HTMLElement>('[data-leave-device-cancel]')?.addEventListener('click', cancelLeaveDevicePin);
}

function handleLeaveDevicePinKey(key: string): void {
  if (key === 'Del') leaveDevicePinBuffer = leaveDevicePinBuffer.slice(0, -1);
  else if (leaveDevicePinBuffer.length < 4 && /^\d$/.test(key)) leaveDevicePinBuffer += key;
  for (let index = 0; index < 4; index += 1) {
    document.getElementById(`pd${index}`)?.classList.toggle('filled', index < leaveDevicePinBuffer.length);
  }
  if (leaveDevicePinBuffer.length !== 4) return;
  window.setTimeout(() => {
    if (leaveDevicePinBuffer === String(currentSettings().parentPin || '')) {
      void leaveDevice();
      return;
    }
    const error = document.getElementById('pin-error');
    if (error) {
      error.textContent = 'Incorrect PIN, try again';
      error.classList.remove('hidden');
    }
    window.setTimeout(() => {
      leaveDevicePinBuffer = '';
      for (let index = 0; index < 4; index += 1) document.getElementById(`pd${index}`)?.classList.remove('filled');
    }, 500);
  }, 200);
}

function cancelLeaveDevicePin(): void {
  activeViewerMemberId = leaveDevicePreviousMemberId;
  leaveDevicePinBuffer = '';
  leaveDevicePreviousMemberId = null;
  render();
}

async function leaveDevice(): Promise<void> {
  leaveDevicePinBuffer = '';
  leaveDevicePreviousMemberId = null;
  try {
    await signOutParentAuth();
  } catch (error) {
    console.warn('Parent sign-out failed before leaving device:', error);
  }
  activeViewerMemberId = null;
  activeParentTab = 'overview';
  activeKidTab = 'chores';
  activeKidTimeTaskId = null;
  activeSettingsPage = 'main';
  activeOnboardingStep = null;
  landingMode = 'landing';
  signInMessage = '';
  kidEntryMessage = '';
  kidEntryMembers = [];
  firestoreState = null;
  firestoreError = '';
  const url = new URL(window.location.href);
  if (useDevFirestore()) url.searchParams.set('source', 'firestore');
  url.searchParams.set('landing', '1');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  render();
}

function shouldUseAppLock(): boolean {
  const settings = currentSettings();
  if (!settings.lockOnBackground) return false;
  if (!settings.parentPin && !getStoredBiometricCredentialId()) return false;
  return !!getActiveViewer(currentDemoState());
}

function registerAppSecurityListeners(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      if (shouldUseAppLock()) appLockRequired = true;
      return;
    }
    if (document.visibilityState === 'visible') {
      if (useDevFirestore()) scheduleDevFirestoreRefresh(40);
      if (appLockRequired) openAppLockModal();
    }
  });
  window.addEventListener('focus', () => {
    if (useDevFirestore()) scheduleDevFirestoreRefresh(40);
    if (appLockRequired) openAppLockModal();
  });
}

function openAppLockModal(): void {
  if (appLockOpen || !shouldUseAppLock()) return;
  const root = document.getElementById('modal-root');
  if (!root) return;
  appLockOpen = true;
  appLockPinBuffer = '';
  const viewer = getActiveViewer(currentDemoState());
  const pinEnabled = !!currentSettings().parentPin;
  const biometricId = getStoredBiometricCredentialId();
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay" data-app-lock-overlay style="z-index:9999">
      <div class="modal quick-action-modal" role="dialog" aria-modal="true">
        <div style="text-align:center">
          <div class="pin-avatar" style="margin:0 auto 10px"><i class="ph-duotone ph-lock-key" style="color:#6C63FF;font-size:2.5rem"></i></div>
          <div class="pin-title">Welcome back${viewer?.name ? `, ${escapeHtmlAttr(viewer.name)}` : ''}!</div>
          <div class="pin-sub">${pinEnabled ? 'Enter your PIN' : `Use ${escapeHtmlAttr(getBiometricLabel())} to unlock`}</div>
        </div>
        ${pinEnabled ? `
          <div class="pin-dots" id="app-lock-dots">
            <div class="pin-dot" id="ald0"></div>
            <div class="pin-dot" id="ald1"></div>
            <div class="pin-dot" id="ald2"></div>
            <div class="pin-dot" id="ald3"></div>
          </div>
          <div class="pin-grid">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'Del'].map(key => `
              <button class="pin-key${key === '' ? ' hidden' : ''}" data-app-lock-pin-key="${key}" type="button">${key}</button>
            `).join('')}
          </div>
          <div id="app-lock-error" class="pin-error hidden"></div>
        ` : '<div id="app-lock-error" class="pin-error hidden"></div>'}
        ${biometricId ? `<button class="btn btn-secondary mt-16" style="width:100%" data-app-lock-biometric type="button"><i class="ph-duotone ph-fingerprint" style="font-size:1rem;vertical-align:middle"></i> Use ${escapeHtmlAttr(getBiometricLabel())}</button>` : ''}
      </div>
    </div>`;
  root.querySelectorAll<HTMLElement>('[data-app-lock-pin-key]').forEach(button => {
    button.addEventListener('click', () => handleAppLockPinKey(button.dataset.appLockPinKey || ''));
  });
  root.querySelector<HTMLElement>('[data-app-lock-biometric]')?.addEventListener('click', () => {
    void authenticateBiometricUnlock(unlockAppLock);
  });
  if (biometricId) window.setTimeout(() => void authenticateBiometricUnlock(unlockAppLock), 400);
}

function handleAppLockPinKey(key: string): void {
  if (key === 'Del') appLockPinBuffer = appLockPinBuffer.slice(0, -1);
  else if (appLockPinBuffer.length < 4 && /^\d$/.test(key)) appLockPinBuffer += key;
  for (let index = 0; index < 4; index += 1) {
    document.getElementById(`ald${index}`)?.classList.toggle('filled', index < appLockPinBuffer.length);
  }
  if (appLockPinBuffer.length !== 4) return;
  window.setTimeout(() => {
    if (appLockPinBuffer === String(currentSettings().parentPin || '')) {
      unlockAppLock();
      return;
    }
    const error = document.getElementById('app-lock-error');
    if (error) {
      error.textContent = 'Incorrect PIN, try again';
      error.classList.remove('hidden');
    }
    window.setTimeout(() => {
      appLockPinBuffer = '';
      for (let index = 0; index < 4; index += 1) document.getElementById(`ald${index}`)?.classList.remove('filled');
    }, 500);
  }, 200);
}

async function authenticateBiometricUnlock(onSuccess: () => void): Promise<void> {
  if (!getStoredBiometricCredentialId()) return;
  const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { NativeBiometric?: { verifyIdentity?: (input: unknown) => Promise<void> } } } }).Capacitor;
  try {
    if (capacitor?.isNativePlatform?.() && capacitor.Plugins?.NativeBiometric?.verifyIdentity) {
      await capacitor.Plugins.NativeBiometric.verifyIdentity({ reason: 'Unlock GemSprout', title: 'GemSprout' });
    }
    onSuccess();
  } catch (error) {
    console.warn('Biometric unlock failed:', error);
  }
}

function unlockAppLock(): void {
  appLockPinBuffer = '';
  appLockRequired = false;
  appLockOpen = false;
  closeModal();
}

function getStoredBiometricCredentialId(): string {
  try {
    return window.localStorage.getItem('gemsprout.v2.biometricCredentialId') || '';
  } catch {
    return '';
  }
}

function kidProfileAvatarOptionsHtml(draft: NonNullable<typeof kidProfileDraft>): string {
  const leaf = '<i class="ph-duotone ph-leaf" style="color:#16A34A"></i>';
  return [leaf, ...KID_AVATARS.slice(0, 23)].map(avatar => `
    <button class="avatar-opt${avatar === draft.avatar ? ' sel' : ''}" data-kid-profile-avatar="${escapeHtmlAttr(encodeURIComponent(avatar))}" type="button">${avatar}</button>
  `).join('');
}

function kidProfileColorSwatches(field: 'avatarColor' | 'color', selected: string): string {
  return PROFILE_COLORS.map(color => `
    <button class="color-swatch${color === selected ? ' sel' : ''}" data-kid-profile-color-field="${field}" data-kid-profile-color="${escapeHtmlAttr(color)}" style="background:${escapeHtmlAttr(color)}" type="button" aria-label="${field} ${escapeHtmlAttr(color)}"></button>
  `).join('');
}

function openKidProfileLookModal(replace = false): void {
  const state = currentDemoState();
  const member = getActiveViewer(state);
  if (!member || member.role !== 'kid' || !member.id) return;
  kidProfileDraft = {
    memberId: String(member.id),
    avatar: String(member.avatar || KID_AVATARS[0]),
    avatarColor: String(member.avatarColor || member.color || PROFILE_COLORS[0]),
    color: String(member.color || PROFILE_COLORS[0]),
  };
  renderKidProfileLookModal(member, replace);
}

function renderKidProfileLookModal(member: DemoMember, replace = false): void {
  if (!kidProfileDraft) return;
  const root = document.getElementById('modal-root');
  if (!root) return;
  const overlayStyle = replace ? (root.querySelector<HTMLElement>('[data-modal-overlay]')?.getAttribute('style') || modalOriginStyle()) : modalOriginStyle();
  const draft = kidProfileDraft;
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay${replace ? '' : ' modal-overlay-origin'}" data-modal-overlay style="${overlayStyle}">
      <div class="modal quick-action-modal quick-action-modal-wide${replace ? '' : ' modal-origin-sheet'}" role="dialog" aria-modal="true">
        <button class="modal-close-x" data-modal-close type="button" aria-label="Close"><i class="ph-duotone ph-x"></i></button>
        <div class="modal-title"><i class="ph-duotone ph-user-circle-gear" style="color:#6C63FF;font-size:1.2rem;vertical-align:middle"></i> Edit Profile</div>
        <div id="kid-profile-look-preview" style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:18px;border:1px solid ${escapeHtmlAttr(draft.color)}55;margin-bottom:18px;background:linear-gradient(160deg, ${escapeHtmlAttr(draft.color)}22 0%, ${escapeHtmlAttr(draft.color)}12 100%)">
          <div id="kid-profile-look-preview-avatar" style="width:54px;height:54px;border-radius:16px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:1.9rem;box-shadow:0 8px 20px rgba(17,28,24,0.08)">${renderAvatarPreviewHtml(draft.avatar, draft.avatarColor)}</div>
          <div>
            <div style="font-weight:800;color:#24352E">${escapeHtmlAttr(member.name || 'Kid')}</div>
            <div style="font-size:0.88rem;color:var(--muted)">Pick an avatar and your favorite colors.</div>
          </div>
        </div>
        <div class="form-group mt-8">
          <label class="form-label">Avatar</label>
          <div class="avatar-grid">${kidProfileAvatarOptionsHtml(draft)}</div>
        </div>
        <div class="form-group" style="position:relative;padding-bottom:18px">
          <label class="form-label">Avatar Color</label>
          <div class="color-row">${kidProfileColorSwatches('avatarColor', draft.avatarColor)}</div>
        </div>
        <div class="form-group" style="position:relative;padding-bottom:18px">
          <label class="form-label">Profile Color</label>
          <div class="color-row">${kidProfileColorSwatches('color', draft.color)}</div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-kid-profile-cancel type="button">Cancel</button>
          <button class="btn btn-primary" data-kid-profile-save type="button">Save <i class="ph-duotone ph-check-circle" style="font-size:0.95rem;vertical-align:middle"></i></button>
        </div>
      </div>
    </div>`;
  bindKidProfileLookActions();
}

function bindKidProfileLookActions(): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.querySelectorAll<HTMLElement>('[data-modal-close]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelectorAll<HTMLButtonElement>('[data-kid-profile-avatar]').forEach(button => {
    button.addEventListener('click', () => {
      if (!kidProfileDraft) return;
      kidProfileDraft.avatar = decodeURIComponent(button.dataset.kidProfileAvatar || '');
      const member = currentDemoState().members.find(item => item.id === kidProfileDraft?.memberId);
      if (member) renderKidProfileLookModal(member, true);
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-kid-profile-color]').forEach(button => {
    button.addEventListener('click', () => {
      if (!kidProfileDraft) return;
      const field = button.dataset.kidProfileColorField === 'avatarColor' ? 'avatarColor' : 'color';
      kidProfileDraft[field] = button.dataset.kidProfileColor || PROFILE_COLORS[0];
      const member = currentDemoState().members.find(item => item.id === kidProfileDraft?.memberId);
      if (member) renderKidProfileLookModal(member, true);
    });
  });
  root.querySelector<HTMLElement>('[data-kid-profile-cancel]')?.addEventListener('click', () => openKidSettings());
  root.querySelector<HTMLElement>('[data-kid-profile-save]')?.addEventListener('click', () => void saveKidProfileLook());
}

async function saveKidProfileLook(): Promise<void> {
  if (!kidProfileDraft) return;
  const draft = kidProfileDraft;
  const state = currentDemoState();
  const member = state.members.find(item => item.id === draft.memberId);
  if (!member) return;
  const updatedMember = {
    ...member,
    avatar: draft.avatar || member.avatar || KID_AVATARS[0],
    avatarColor: draft.avatarColor || member.avatarColor || member.color || PROFILE_COLORS[0],
    color: draft.color || member.color || PROFILE_COLORS[0],
  };
  kidProfileDraft = null;
  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    if (firestoreState) {
      firestoreState = {
        ...firestoreState,
        members: firestoreState.members.map(item => item.id === updatedMember.id ? updatedMember : item),
        member: firestoreState.member?.id === updatedMember.id ? updatedMember : firestoreState.member,
      };
    }
    closeModal();
    render();
    try {
      const { commitDevMemberWrite } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevMemberWrite({ memberId: String(updatedMember.id || ''), data: updatedMember });
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
      render();
      return;
    }
  } else {
    store.set(memberPath(LAB_FAMILY_ID, String(updatedMember.id || '')), updatedMember);
    saveSharedLabStore(store);
    closeModal();
    render();
  }
  toast('Profile updated');
}

function openBadgeCardFromDataset(dataset: DOMStringMap): void {
  const state = currentDemoState();
  const badgeId = String(dataset.badgeId || '');
  const type = dataset.badgeType === 'chore' ? 'chore' : 'base';
  const memberId = String(dataset.badgeMember || activeViewerMemberId || '');
  const member = state.members.find(item => item.id === memberId) || getActiveViewer(state);
  if (!badgeId || !member) return;

  const choreTitle = String(dataset.badgeChoreTitle || '');
  const choreCount = Number(dataset.badgeChoreCount || 0);
  const badge = resolveBadgeCardDefinition(state, badgeId, type, choreTitle, choreCount);
  const accentMatch = badge.icon.match(/color:(#[0-9a-fA-F]{3,6})/);
  const accent = accentMatch ? accentMatch[1] : '#7C3AED';
  const earnedDate = findBadgeEarnedDate(state, badge.name, member, type, choreTitle);
  const root = ensureBadgeCardRoot();
  const cardId = 'badge-trading-card';
  closeBadgeCard(false);
  root.innerHTML = `
    <div class="badge-card-backdrop" id="badge-card-backdrop"></div>
    <div class="badge-card-scene">
      <div class="badge-card" id="${cardId}" style="--card-accent:${escapeHtmlAttr(accent)}">
        <div class="badge-card-shine"></div>
        <div class="badge-card-glare"></div>
        <div class="badge-card-content">
          <div class="badge-card-stars">
            <i class="ph-duotone ph-star" style="color:#FDE68A;opacity:0.6"></i>
            <i class="ph-duotone ph-star" style="color:#FDE68A;opacity:0.9"></i>
            <i class="ph-duotone ph-star" style="color:#FDE68A;opacity:0.6"></i>
          </div>
          <div class="badge-card-header">
            <div class="badge-card-name">${escapeHtmlAttr(badge.name)}</div>
            <div class="badge-card-earn">${escapeHtmlAttr(badge.earnDesc)}</div>
          </div>
          <div class="badge-card-icon-wrap">
            <div class="badge-card-icon">${badge.icon}</div>
          </div>
          <div class="badge-card-earned-by">
            ${earnedDate
              ? `Earned by ${escapeHtmlAttr(member.name || 'Kid')} on ${escapeHtmlAttr(earnedDate)}`
              : `Earned by ${escapeHtmlAttr(member.name || 'Kid')}`}
          </div>
          <div class="badge-card-footer">GemSprout</div>
        </div>
      </div>
    </div>
    <div class="badge-card-close-hint">Tap anywhere outside to close</div>`;
  root.style.display = 'flex';
  document.getElementById('badge-card-backdrop')?.addEventListener('click', () => closeBadgeCard());
  requestAnimationFrame(() => {
    initBadgeCardTilt(cardId);
    injectBadgeIconTile(cardId, accent);
  });
}

function resolveBadgeCardDefinition(
  state: DemoAppState,
  badgeId: string,
  type: 'base' | 'chore',
  choreTitle: string,
  choreCount: number,
): { icon: string; name: string; earnDesc: string } {
  if (type === 'chore') {
    const found = state.tasks.flatMap(task => task.badges || []).find(badge => badge.id === badgeId);
    const count = choreCount || Number(found?.count || 0);
    return {
      icon: found?.icon || '<i class="ph-duotone ph-medal" style="color:#F59E0B"></i>',
      name: String(found?.name || 'Badge'),
      earnDesc: choreTitle && count ? `${choreTitle} ${count} time${count !== 1 ? 's' : ''}` : choreTitle || 'Chore milestone',
    };
  }
  const base = getBaseBadgeDef(state.settings, badgeId);
  return {
    icon: base.icon || '<i class="ph-duotone ph-medal" style="color:#7C3AED"></i>',
    name: base.name || 'Badge',
    earnDesc: base.desc || 'Special achievement',
  };
}

function findBadgeEarnedDate(state: DemoAppState, badgeName: string, member: DemoMember, type: 'base' | 'chore', choreTitle: string): string | null {
  const row = state.historyRows.find(item => {
    if (item.type !== 'badge' || item.memberId !== member.id) return false;
    if (String(item.title || '') !== badgeName) return false;
    if (type !== 'chore') return true;
    const rowChoreTitle = String((item.metadata?.choreTitle as string | undefined) || (item as DemoHistoryRow & { choreTitle?: string }).choreTitle || '');
    return !rowChoreTitle || rowChoreTitle === choreTitle;
  });
  return formatBadgeEarnedDate(Number(row?.createdAt || 0));
}

function formatBadgeEarnedDate(createdAt: number): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  const day = date.getDate();
  const suffix = day === 1 || day === 21 || day === 31 ? 'st'
    : day === 2 || day === 22 ? 'nd'
      : day === 3 || day === 23 ? 'rd'
        : 'th';
  return `${date.toLocaleString(undefined, { month: 'short' })} ${day}${suffix}, ${date.getFullYear()}`;
}

function ensureBadgeCardRoot(): HTMLElement {
  let root = document.getElementById('badge-card-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'badge-card-root';
    document.body.appendChild(root);
  }
  return root;
}

function closeBadgeCard(clearMarkup = true): void {
  if (badgeCardGyroCleanup) {
    badgeCardGyroCleanup();
    badgeCardGyroCleanup = null;
  }
  const root = document.getElementById('badge-card-root');
  if (!root) return;
  root.style.display = 'none';
  if (clearMarkup) root.innerHTML = '';
}

function injectBadgeIconTile(cardId: string, accent: string): void {
  (document.fonts?.ready || Promise.resolve()).then(() => doInjectBadgeIconTile(cardId, accent));
}

function doInjectBadgeIconTile(cardId: string, accent: string): void {
  const card = document.getElementById(cardId);
  const shine = card?.querySelector('.badge-card-shine');
  const icon = card?.querySelector<HTMLElement>('.badge-card-icon i');
  if (!card || !shine || !icon) return;
  const beforeStyle = getComputedStyle(icon, '::before');
  const afterStyle = getComputedStyle(icon, '::after');
  const glyphBefore = beforeStyle.content.replace(/["']/g, '');
  const glyphAfter = afterStyle.content.replace(/["']/g, '');
  if (!glyphBefore && !glyphAfter) return;
  const accentRgb = hexToRgb(accent);
  const color = `rgb(${mixTowardWhite(accentRgb.r)},${mixTowardWhite(accentRgb.g)},${mixTowardWhite(accentRgb.b)})`;
  const tileSize = 42;
  const glyphSize = Math.round(tileSize * 0.54);
  const canvas = document.createElement('canvas');
  canvas.width = tileSize * 2;
  canvas.height = tileSize * 2;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.font = `${glyphSize}px "Phosphor-Duotone"`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  [{ x: tileSize * 0.5, y: tileSize * 0.5 }, { x: tileSize * 1.5, y: tileSize * 1.5 }].forEach(({ x, y }) => {
    context.globalAlpha = 0.2;
    context.fillStyle = color;
    context.fillText(glyphBefore, x, y);
    context.globalAlpha = 1;
    context.fillStyle = color;
    context.fillText(glyphAfter, x, y);
  });
  const tile = document.createElement('div');
  tile.className = 'badge-card-icon-tile';
  tile.style.backgroundImage = `url("${canvas.toDataURL('image/png')}")`;
  tile.style.backgroundSize = `${tileSize * 2}px ${tileSize * 2}px`;
  card.insertBefore(tile, shine);
}

function initBadgeCardTilt(cardId: string): void {
  const card = document.getElementById(cardId);
  if (!card) return;
  const root = document.getElementById('badge-card-root');
  if (badgeCardGyroCleanup) {
    badgeCardGyroCleanup();
    badgeCardGyroCleanup = null;
  }
  const maxTilt = 25;
  const shine = card.querySelector<HTMLElement>('.badge-card-shine');
  const glare = card.querySelector<HTMLElement>('.badge-card-glare');
  const tile = card.querySelector<HTMLElement>('.badge-card-icon-tile');
  let baseGamma: number | null = null;
  let baseBeta: number | null = null;
  let currentRx = 0;
  let currentRy = 0;
  let targetRx = 0;
  let targetRy = 0;
  let gyroIdleTimer = 0;
  let gyroRafId = 0;
  let driftRafId = 0;
  let touchActive = false;
  let touchStartX: number | null = null;
  let touchStartY: number | null = null;

  const applyTilt = (rx: number, ry: number, isResting = false) => {
    const scale = isResting ? 1 : 1.03;
    card.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${scale})`;
    const sx = (-ry * 1.2).toFixed(1);
    const sy = (rx * 1.2 + 28).toFixed(1);
    card.style.boxShadow = [
      '0 0 0 1px color-mix(in srgb, var(--card-accent, #7C3AED) 35%, transparent)',
      `${sx}px ${sy}px 60px rgba(0,0,0,0.6)`,
      '0 6px 24px color-mix(in srgb, var(--card-accent, #7C3AED) 30%, transparent)',
    ].join(', ');
    const px = 50 - (ry / maxTilt) * 40;
    const py = 50 + (rx / maxTilt) * 40;
    const bx = 50 - (ry / maxTilt) * 50;
    const by = 50 + (rx / maxTilt) * 50;
    const dist = Math.min(1, Math.sqrt((ry / maxTilt) ** 2 + (rx / maxTilt) ** 2));
    const holo = shine || card;
    holo.style.setProperty('--pointer-x', `${px.toFixed(1)}%`);
    holo.style.setProperty('--pointer-y', `${py.toFixed(1)}%`);
    holo.style.setProperty('--background-x', `${bx.toFixed(1)}%`);
    holo.style.setProperty('--background-y', `${by.toFixed(1)}%`);
    holo.style.setProperty('--pointer-from-center', dist.toFixed(3));
    glare?.style.setProperty('--pointer-x', `${px.toFixed(1)}%`);
    glare?.style.setProperty('--pointer-y', `${py.toFixed(1)}%`);
    glare?.style.setProperty('--pointer-from-center', dist.toFixed(3));
    tile?.style.setProperty('--background-x', `${bx.toFixed(1)}%`);
    tile?.style.setProperty('--background-y', `${by.toFixed(1)}%`);
  };

  const gyroLerpLoop = () => {
    currentRx += (targetRx - currentRx) * 0.12;
    currentRy += (targetRy - currentRy) * 0.12;
    applyTilt(currentRx, currentRy);
    gyroRafId = Math.abs(targetRx - currentRx) > 0.05 || Math.abs(targetRy - currentRy) > 0.05
      ? requestAnimationFrame(gyroLerpLoop)
      : 0;
  };
  const startGyroDrift = () => {
    if (driftRafId) return;
    const drift = () => {
      targetRx *= 0.88;
      targetRy *= 0.88;
      currentRx *= 0.88;
      currentRy *= 0.88;
      applyTilt(currentRx, currentRy, Math.abs(currentRx) < 0.3 && Math.abs(currentRy) < 0.3);
      if (Math.abs(currentRx) > 0.1 || Math.abs(currentRy) > 0.1) driftRafId = requestAnimationFrame(drift);
      else {
        targetRx = 0;
        targetRy = 0;
        currentRx = 0;
        currentRy = 0;
        driftRafId = 0;
      }
    };
    driftRafId = requestAnimationFrame(drift);
  };
  const onDeviceOrientation = (event: DeviceOrientationEvent) => {
    if (event.gamma == null || touchActive) return;
    if (baseGamma === null) {
      baseGamma = event.gamma;
      baseBeta = event.beta;
    }
    if (driftRafId) {
      cancelAnimationFrame(driftRafId);
      driftRafId = 0;
    }
    targetRy = Math.max(-maxTilt, Math.min(maxTilt, (event.gamma - baseGamma) * 1.5));
    targetRx = -Math.max(-maxTilt, Math.min(maxTilt, (Number(event.beta || 0) - Number(baseBeta || 0)) * 1.5));
    if (!gyroRafId) gyroRafId = requestAnimationFrame(gyroLerpLoop);
    window.clearTimeout(gyroIdleTimer);
    gyroIdleTimer = window.setTimeout(startGyroDrift, 800);
  };
  type DeviceOrientationWithPermission = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<string> };
  const orientation = typeof DeviceOrientationEvent !== 'undefined'
    ? DeviceOrientationEvent as DeviceOrientationWithPermission
    : undefined;
  if (orientation?.requestPermission) {
    orientation.requestPermission().then(result => {
      if (result === 'granted') window.addEventListener('deviceorientation', onDeviceOrientation);
    }).catch(() => undefined);
  } else if (typeof DeviceOrientationEvent !== 'undefined') {
    window.addEventListener('deviceorientation', onDeviceOrientation);
  }

  const onTouchStart = (event: TouchEvent) => {
    touchActive = true;
    window.clearTimeout(gyroIdleTimer);
    if (driftRafId) {
      cancelAnimationFrame(driftRafId);
      driftRafId = 0;
    }
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    card.style.transition = 'none';
  };
  const onTouchMove = (event: TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;
    event.preventDefault();
    const touch = event.touches[0];
    const ry = Math.max(-maxTilt, Math.min(maxTilt, (touch.clientX - touchStartX) * 0.25));
    const rx = -Math.max(-maxTilt, Math.min(maxTilt, (touch.clientY - touchStartY) * 0.25));
    applyTilt(rx, ry);
  };
  const onTouchEnd = () => {
    touchActive = false;
    touchStartX = null;
    touchStartY = null;
    card.style.transition = 'transform 0.6s cubic-bezier(.2,.8,.2,1)';
    applyTilt(0, 0, true);
    baseGamma = null;
    baseBeta = null;
    targetRx = 0;
    targetRy = 0;
    currentRx = 0;
    currentRy = 0;
    if (gyroRafId) {
      cancelAnimationFrame(gyroRafId);
      gyroRafId = 0;
    }
  };
  const onMouseMove = (event: MouseEvent) => {
    const rect = card.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    card.style.transition = 'none';
    applyTilt(-ny * maxTilt, nx * maxTilt);
  };
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    const rect = card.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    card.style.transition = 'none';
    applyTilt(-ny * maxTilt, nx * maxTilt);
  };
  const onMouseLeave = () => {
    card.style.transition = 'transform 0.6s cubic-bezier(.2,.8,.2,1)';
    applyTilt(0, 0, true);
  };

  card.addEventListener('touchstart', onTouchStart, { passive: true });
  card.addEventListener('touchmove', onTouchMove, { passive: false });
  card.addEventListener('touchend', onTouchEnd);
  card.addEventListener('touchcancel', onTouchEnd);
  card.addEventListener('pointermove', onPointerMove);
  card.addEventListener('mousemove', onMouseMove);
  card.addEventListener('mouseleave', onMouseLeave);
  root?.addEventListener('mousemove', onMouseMove);
  root?.addEventListener('mouseleave', onMouseLeave);
  badgeCardGyroCleanup = () => {
    window.removeEventListener('deviceorientation', onDeviceOrientation);
    window.clearTimeout(gyroIdleTimer);
    if (gyroRafId) cancelAnimationFrame(gyroRafId);
    if (driftRafId) cancelAnimationFrame(driftRafId);
    card.removeEventListener('touchstart', onTouchStart);
    card.removeEventListener('touchmove', onTouchMove);
    card.removeEventListener('touchend', onTouchEnd);
    card.removeEventListener('touchcancel', onTouchEnd);
    card.removeEventListener('pointermove', onPointerMove);
    card.removeEventListener('mousemove', onMouseMove);
    card.removeEventListener('mouseleave', onMouseLeave);
    root?.removeEventListener('mousemove', onMouseMove);
    root?.removeEventListener('mouseleave', onMouseLeave);
  };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || '#7C3AED').replace('#', '');
  const expanded = clean.length === 3 ? clean.split('').map(char => char + char).join('') : clean.padEnd(6, '0').slice(0, 6);
  return {
    r: Number.parseInt(expanded.slice(0, 2), 16) || 124,
    g: Number.parseInt(expanded.slice(2, 4), 16) || 58,
    b: Number.parseInt(expanded.slice(4, 6), 16) || 237,
  };
}

function mixTowardWhite(channel: number): number {
  return Math.round(channel + (255 - channel) * 0.4);
}

function openPhotoPreview(url: string): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="photo-capture-overlay" data-photo-preview-overlay>
      <div class="photo-capture-sheet" role="dialog" aria-modal="true" aria-label="Photo preview">
        <button class="modal-close-x" type="button" aria-label="Close" data-photo-preview-close>
          <span aria-hidden="true">&times;</span>
        </button>
        <img src="${escapeHtmlAttr(url)}" alt="Photo" style="width:100%;border-radius:12px;display:block">
      </div>
    </div>`;
  root.querySelector('[data-photo-preview-close]')?.addEventListener('click', closePhotoPreview);
  root.querySelector('[data-photo-preview-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closePhotoPreview();
  });
}

function closePhotoPreview(): void {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}

function openKidSavingsModal(memberId: string, triggerEl?: HTMLElement): void {
  const state = currentDemoState();
  const member = state.members.find(item => item.id === memberId);
  const root = document.getElementById('modal-root');
  if (!member || !root) return;
  const rect = triggerEl?.getBoundingClientRect();
  const rate = Number(state.settings.diamondsPerDollar || 10);
  const currency = String(state.settings.currency || '$');
  const gems = Number(member.gems || member.diamonds || 0);
  const matchOn = state.settings.savingsMatchingEnabled === true && state.settings.savingsEnabled !== false;
  const matchPct = Number(state.settings.savingsMatchPercent || 50);
  const interestOn = state.settings.savingsInterestEnabled === true && state.settings.savingsEnabled !== false;
  const interestRate = Number(state.settings.savingsInterestRate || 5);
  const interestPeriod = String(state.settings.savingsInterestPeriod || 'monthly');
  const interestWhen = interestPeriod === 'weekly'
    ? `every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(state.settings.savingsInterestDay ?? 1)] || 'Monday'}`
    : `on the ${ordinalDay(Number(state.settings.savingsInterestDayOfMonth || 1))} of each month`;
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="${modalOriginStyle(rect)}">
      <div class="quick-action-modal quick-action-modal-wide kid-savings-modal kid-savings-convert-modal modal-origin-sheet">
        <button class="modal-close-x" type="button" aria-label="Close" data-modal-close><span aria-hidden="true">&times;</span></button>
        <div class="modal-title kid-savings-modal-title"><i class="ph-duotone ph-piggy-bank" style="color:#16A34A;font-size:1.2rem;vertical-align:middle"></i> Savings Jar</div>
        <p class="kid-savings-modal-copy" style="margin-bottom:${matchOn || interestOn ? '10' : '16'}px">
          Convert gems to savings (${rate} gems = ${currency}1.00).
        </p>
        ${matchOn ? `<div class="kid-savings-modal-note kid-savings-modal-note-green">
          <strong>Parent match is on!</strong> For every ${currency}1.00 you save, your parents add ${currency}${(matchPct / 100).toFixed(2)} extra (${matchPct}% match).
        </div>` : ''}
        ${interestOn ? `<div class="kid-savings-modal-note kid-savings-modal-note-blue">
          <strong>Interest is on!</strong> Your savings grow by ${interestRate}% - claimable ${interestWhen}.
        </div>` : ''}
        <div class="form-group">
          <label class="form-label">Gems to convert <span class="form-label-hint">(you have ${gems})</span></label>
          <input type="number" data-kid-savings-input min="0" max="${gems}" step="1" placeholder="1">
        </div>
        <div data-kid-savings-preview class="kid-savings-preview"></div>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-modal-close type="button">Cancel</button>
          <button class="btn btn-teal" data-kid-savings-submit="${escapeHtmlAttr(memberId)}" type="button">Convert</button>
        </div>
      </div>
    </div>`;
  bindKidSavingsModalActions();
}

function bindKidSavingsModalActions(): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.querySelectorAll<HTMLElement>('[data-modal-close]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  const input = root.querySelector<HTMLInputElement>('[data-kid-savings-input]');
  const preview = root.querySelector<HTMLElement>('[data-kid-savings-preview]');
  input?.addEventListener('input', () => {
    if (preview) preview.innerHTML = kidSavingsPreview(Number.parseInt(input.value || '0', 10) || 0);
  });
  root.querySelector<HTMLButtonElement>('[data-kid-savings-submit]')?.addEventListener('click', event => {
    const memberId = (event.currentTarget as HTMLButtonElement).dataset.kidSavingsSubmit || '';
    void submitKidSavingsConversion(memberId, Number.parseInt(input?.value || '0', 10) || 0);
  });
}

function kidSavingsPreview(gems: number): string {
  if (gems <= 0) return '';
  const state = currentDemoState();
  const rate = Number(state.settings.diamondsPerDollar || 10);
  const currency = String(state.settings.currency || '$');
  const matchOn = state.settings.savingsMatchingEnabled === true && state.settings.savingsEnabled !== false;
  const matchPct = Number(state.settings.savingsMatchPercent || 50);
  const dollars = Number((gems / rate).toFixed(2));
  const matchDollars = matchOn ? Number((dollars * matchPct / 100).toFixed(2)) : 0;
  return matchOn && matchDollars > 0
    ? `${currency}${dollars.toFixed(2)} yours + ${currency}${matchDollars.toFixed(2)} parent match = <strong>${currency}${(dollars + matchDollars).toFixed(2)} total</strong>`
    : `You'll save ${currency}${dollars.toFixed(2)}`;
}

async function submitKidSavingsConversion(memberId: string, gemsToConvert: number): Promise<void> {
  const state = currentDemoState();
  const member = state.members.find(item => item.id === memberId);
  const currentGems = Number(member?.gems || member?.diamonds || 0);
  if (!member || gemsToConvert <= 0 || gemsToConvert > currentGems) return;
  const rate = Number(state.settings.diamondsPerDollar || 10);
  const currency = String(state.settings.currency || '$');
  const matchOn = state.settings.savingsMatchingEnabled === true && state.settings.savingsEnabled !== false;
  const matchPct = Number(state.settings.savingsMatchPercent || 50);
  const dollars = Number((gemsToConvert / rate).toFixed(2));
  const matchDollars = matchOn ? Number((dollars * matchPct / 100).toFixed(2)) : 0;
  const now = Date.now();
  const updatedMember: DemoMember = {
    ...member,
    gems: currentGems - gemsToConvert,
    diamonds: currentGems - gemsToConvert,
    savings: Number((Number(member.savings || 0) + dollars + matchDollars).toFixed(2)),
    savingsMatched: matchDollars > 0 ? Number((Number(member.savingsMatched || 0) + matchDollars).toFixed(2)) : member.savingsMatched,
  };
  const historyRows: DemoHistoryRow[] = [
    {
      id: makeHistoryId('savings', memberId),
      familyId: useDevFirestore() ? 'migration-preview' : LAB_FAMILY_ID,
      memberId,
      type: 'savings',
      title: `Converted ${gemsToConvert} gems to savings`,
      gems: -gemsToConvert,
      amount: dollars,
      createdAt: now,
    },
    ...(matchDollars > 0 ? [{
      id: makeHistoryId('savings-match', memberId),
      familyId: useDevFirestore() ? 'migration-preview' : LAB_FAMILY_ID,
      memberId,
      type: 'savings',
      title: `Parent match (${matchPct}%) +${currency}${matchDollars.toFixed(2)}`,
      gems: 0,
      amount: matchDollars,
      createdAt: now + 1,
    } as DemoHistoryRow] : []),
  ];
  const previous = cloneDemoState(firestoreState);
  if (useDevFirestore()) {
    if (!firestoreState) return;
    firestoreState = applyManualMemberUpdates(firestoreState, [{
      memberId,
      history: historyRows[0],
      apply: () => updatedMember,
    }, ...historyRows.slice(1).map(history => ({ memberId, history, apply: () => updatedMember }))]);
    closeModal();
    render();
    try {
      const { commitDevManualQuickAction } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevManualQuickAction({ memberWrites: [{ memberId, data: updatedMember }], historyWrites: historyRows });
    } catch {
      firestoreState = previous;
      render();
    }
    return;
  }
  store = loadSharedLabStore(createDemoFamilySeedStore);
  applyManualUpdatesToStore(historyRows.map(history => ({ memberId, history, apply: () => updatedMember })));
  saveSharedLabStore(store);
  closeModal();
  void renderLocalLab();
}

function isSavingsInterestDay(state: DemoAppState, todayKey = todayKeyForApp()): boolean {
  if (state.settings.savingsEnabled === false || state.settings.savingsInterestEnabled !== true) return false;
  const parsed = new Date(`${todayKey}T00:00:00`);
  if (String(state.settings.savingsInterestPeriod || 'monthly') === 'weekly') {
    return parsed.getDay() === Number(state.settings.savingsInterestDay ?? 1);
  }
  return parsed.getDate() === Number(state.settings.savingsInterestDayOfMonth || 1);
}

function getSavingsInterestMode(state: DemoAppState): 'kid_claim' | 'auto_claim' {
  return state.settings.savingsInterestMode === 'auto_claim' ? 'auto_claim' : 'kid_claim';
}

function calculateClaimableSavingsInterest(state: DemoAppState, member: DemoMember, todayKey = todayKeyForApp()): number {
  if (!isSavingsInterestDay(state, todayKey)) return 0;
  if (member.savingsInterestLastDate === todayKey) return 0;
  const savings = Number(member.savings || 0);
  if (savings <= 0) return 0;
  const interest = Number((savings * Number(state.settings.savingsInterestRate || 5) / 100).toFixed(2));
  return interest > 0 ? interest : 0;
}

async function claimSavingsInterest(memberId: string, source: 'kid' | 'parent' | 'auto' = 'kid'): Promise<boolean> {
  const state = currentDemoState();
  const mode = getSavingsInterestMode(state);
  if (source === 'kid' && mode === 'auto_claim') return false;
  if (source === 'parent' && mode !== 'kid_claim') return false;
  const member = state.members.find(item => item.id === memberId);
  if (!member || member.role !== 'kid') return false;
  const todayKey = todayKeyForApp();
  const amount = calculateClaimableSavingsInterest(state, member, todayKey);
  if (amount <= 0) return false;
  const currency = String(state.settings.currency || '$');
  const rate = Number(state.settings.savingsInterestRate || 5);
  const period = String(state.settings.savingsInterestPeriod || 'monthly');
  const titlePrefix = source === 'parent' ? 'Parent claimed interest' : source === 'auto' ? 'Auto-claimed interest' : 'Claimed interest';
  const now = Date.now();
  const history: DemoHistoryRow = {
    id: makeHistoryId('savings-interest', memberId),
    familyId: useDevFirestore() ? 'migration-preview' : LAB_FAMILY_ID,
    memberId,
    type: 'savings',
    title: `${titlePrefix} (${rate}% ${period}) +${currency}${amount.toFixed(2)}`,
    gems: 0,
    amount,
    createdAt: now,
    metadata: { source, interestDate: todayKey },
  };
  const update = {
    memberId,
    history,
    apply(current: DemoMember) {
      return {
        ...current,
        savings: roundMoney(Number(current.savings || 0) + amount),
        savingsInterest: roundMoney(Number(current.savingsInterest || 0) + amount),
        savingsInterestLastDate: todayKey,
      };
    },
  };

  if (useDevFirestore()) {
    if (!firestoreState) return false;
    const previous = cloneDemoState(firestoreState);
    firestoreState = applyManualMemberUpdates(firestoreState, [update]);
    render();
    try {
      const { commitDevManualQuickAction } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevManualQuickAction({ memberWrites: [{ memberId, data: findMemberById(firestoreState, memberId) }], historyWrites: [history] });
      return true;
    } catch {
      firestoreState = previous;
      render();
      return false;
    }
  }

  store = loadSharedLabStore(createDemoFamilySeedStore);
  applyManualUpdatesToStore([update]);
  saveSharedLabStore(store);
  void renderLocalLab();
  return true;
}

async function applyAutoSavingsInterest(): Promise<void> {
  const state = currentDemoState();
  if (getSavingsInterestMode(state) !== 'auto_claim' || !isSavingsInterestDay(state)) return;
  for (const member of state.members.filter(item => item.role === 'kid' && !item.deleted)) {
    await claimSavingsInterest(String(member.id || ''), 'auto');
  }
}

function maybeApplyAutoSavingsInterest(state: DemoAppState): void {
  const todayKey = todayKeyForTimezone(state.settings.familyTimezone);
  const key = `${state.familyId || LAB_FAMILY_ID}:${todayKey}`;
  if (autoSavingsInterestRunKey === key) return;
  if (getSavingsInterestMode(state) !== 'auto_claim' || !isSavingsInterestDay(state, todayKey)) return;
  autoSavingsInterestRunKey = key;
  void applyAutoSavingsInterest();
}

function openKidSavingsHistory(memberId: string, triggerEl?: HTMLElement): void {
  const state = currentDemoState();
  const member = state.members.find(item => item.id === memberId);
  const root = document.getElementById('modal-root');
  if (!member || !root) return;
  const rect = triggerEl?.getBoundingClientRect();
  const rows = savingsHistoryRows(state, memberId);
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="${modalOriginStyle(rect)}">
      <div class="quick-action-modal quick-action-modal-wide kid-savings-modal kid-savings-history-modal modal-origin-sheet">
        <button class="modal-close-x" type="button" aria-label="Close" data-modal-close><span aria-hidden="true">&times;</span></button>
        <div class="kid-savings-history-list">${rows}</div>
        <div class="modal-actions">
          <button class="btn btn-secondary btn-full" data-modal-close type="button">Close</button>
        </div>
      </div>
    </div>`;
  root.querySelectorAll<HTMLElement>('[data-modal-close]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
}

function openKidSavingsSpendModal(memberId: string, triggerEl?: HTMLElement): void {
  const state = currentDemoState();
  const member = state.members.find(item => item.id === memberId);
  const root = document.getElementById('modal-root');
  if (!member || !root) return;
  const savings = Number(member.savings || 0);
  const hasPending = state.requests.some(request =>
    request.status === REQUEST_STATUSES.PENDING
    && request.kind === REQUEST_KINDS.SAVINGS_SPEND
    && request.targetMemberId === memberId
  );
  if (hasPending || savings <= 0) return;
  const currency = String(state.settings.currency || '$');
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="${modalOriginStyle(triggerEl?.getBoundingClientRect())}">
      <div class="quick-action-modal quick-action-modal-wide kid-savings-modal kid-savings-spend-modal modal-origin-sheet">
        <button class="modal-close-x" type="button" aria-label="Close" data-modal-close><span aria-hidden="true">&times;</span></button>
        <div class="modal-title kid-savings-modal-title"><i class="ph-duotone ph-shopping-cart" style="color:#6C63FF;font-size:1.2rem;vertical-align:middle"></i> Spend Savings</div>
        <p class="kid-savings-modal-copy">Balance: <strong>${currency}${savings.toFixed(2)}</strong> and your parent will approve this.</p>
        <div class="form-group">
          <label class="form-label">Amount (${currency})</label>
          <input type="number" data-kid-spend-amount min="0.01" max="${savings.toFixed(2)}" step="0.01" placeholder="e.g. 10.00">
        </div>
        <div class="form-group">
          <label class="form-label">What for? <span class="form-label-hint">optional</span></label>
          <input type="text" data-kid-spend-reason placeholder="Lego set, book, game...">
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-modal-close type="button">Cancel</button>
          <button class="btn btn-primary" data-kid-spend-submit="${escapeHtmlAttr(memberId)}" type="button">Send Request</button>
        </div>
      </div>
    </div>`;
  root.querySelectorAll<HTMLElement>('[data-modal-close]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelector<HTMLButtonElement>('[data-kid-spend-submit]')?.addEventListener('click', event => {
    const button = event.currentTarget as HTMLButtonElement;
    const amount = Number.parseFloat(root.querySelector<HTMLInputElement>('[data-kid-spend-amount]')?.value || '0') || 0;
    const reason = root.querySelector<HTMLInputElement>('[data-kid-spend-reason]')?.value.trim() || '';
    void submitKidSavingsSpendRequest(button.dataset.kidSpendSubmit || '', amount, reason);
  });
}

async function submitKidSavingsSpendRequest(memberId: string, amount: number, reason: string): Promise<void> {
  const state = currentDemoState();
  const member = state.members.find(item => item.id === memberId);
  if (!member || amount <= 0 || amount > Number(member.savings || 0)) return;
  const hasPending = state.requests.some(request =>
    request.status === REQUEST_STATUSES.PENDING
    && request.kind === REQUEST_KINDS.SAVINGS_SPEND
    && request.targetMemberId === memberId
  );
  if (hasPending) return;
  const now = Date.now();
  const requestId = `request:savings:${memberId}:${now}:${Math.random().toString(36).slice(2, 7)}`;
  const requestDoc: DemoRequest = {
    id: requestId,
    status: REQUEST_STATUSES.PENDING,
    kind: REQUEST_KINDS.SAVINGS_SPEND,
    targetMemberId: memberId,
    createdAt: now,
    resolvedAt: null,
    resolvedByMemberId: null,
    snapshot: { title: reason || 'Savings spend request', amount },
    source: { choreId: null, completionId: null, prizeId: null, reason, amount },
  };
  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    if (!firestoreState) return;
    firestoreState = {
      ...firestoreState,
      requests: [...firestoreState.requests, requestDoc],
      request: requestDoc,
    };
    closeModal();
    render();
    try {
      const { commitDevKidSavingsSpendRequest } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevKidSavingsSpendRequest({ requestId, memberId, amount, reason, now });
      void sendSavingsSpendPush({ memberId, amount, reason });
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
      render();
    }
    return;
  }
  store.set(requestPath(LAB_FAMILY_ID, requestId), {
    ...requestDoc,
    familyId: LAB_FAMILY_ID,
    requesterMemberId: memberId,
  });
  saveSharedLabStore(store);
  void sendSavingsSpendPush({ memberId, amount, reason });
  closeModal();
  render();
}

function savingsHistoryRows(state: DemoAppState, memberId: string): string {
  const savingsTypes = new Set(['savings', 'savings_deposit', 'savings_withdraw']);
  const entries = state.historyRows.filter(row => row.memberId === memberId && savingsTypes.has(String(row.type || '')));
  if (!entries.length) return '<div class="empty-state" style="padding:10px 0 4px"><div class="empty-text">No savings activity yet</div></div>';
  const currency = String(state.settings.currency || '$');
  return entries.map(row => {
    const type = String(row.type || '');
    const isWithdraw = type === 'savings_withdraw';
    const amount = Number(row.amount || 0);
    const gems = Number(row.gems || 0);
    const delta = amount > 0
      ? `${isWithdraw ? '-' : '+'}${currency}${amount.toFixed(2)}`
      : gems !== 0
        ? `${gems > 0 ? '+' : ''}${gems}`
        : '';
    const deltaClass = delta.startsWith('-') ? 'negative' : delta ? 'positive' : 'neutral';
    return `<div class="activity-row">
      <span class="activity-badge" style="background:${isWithdraw ? '#ede9fe' : '#e8f5ee'};color:${isWithdraw ? '#6C63FF' : '#1f7a55'}">${savingsHistoryIcon(row)}</span>
      <div class="activity-body">
        <div class="activity-title">${escapeHtmlAttr(row.title || 'Savings update')}</div>
        <div class="activity-meta">${formatShortDate(Number(row.createdAt || 0))}</div>
      </div>
      ${delta ? `<div class="activity-delta ${deltaClass}">
        <span class="activity-delta-value">${delta}</span>
        ${amount > 0 ? '' : '<span class="activity-delta-unit">gems</span>'}
      </div>` : ''}
    </div>`;
  }).join('');
}

function savingsHistoryIcon(row: DemoHistoryRow): string {
  const type = String(row.type || '');
  const title = String(row.title || '').toLowerCase();
  if (type === 'savings_deposit') return '<i class="ph-duotone ph-arrow-circle-down" style="color:#2563EB"></i>';
  if (type === 'savings_withdraw') return '<i class="ph-duotone ph-shopping-bag" style="color:#6C63FF"></i>';
  if (title.includes('interest')) return '<i class="ph-duotone ph-trend-up" style="color:#16A34A"></i>';
  if (title.includes('match')) return '<i class="ph-duotone ph-handshake" style="color:#0E7490"></i>';
  if (title.includes('converted')) return '<i class="ph-duotone ph-arrows-left-right" style="color:#7C3AED"></i>';
  return '<i class="ph-duotone ph-piggy-bank" style="color:#16A34A"></i>';
}

function openKidFullActivityPane(): void {
  const state = currentDemoState();
  const viewer = getActiveViewer(state);
  if (!viewer?.id) return;
  const root = document.getElementById('settings-root');
  if (!root) return;
  const rows = state.historyRows
    .filter(row => row.memberId === viewer.id)
    .map(row => renderKidActivityPaneRow(row, state.settings.currency || '$'))
    .join('');
  root.innerHTML = `
    <div class="settings-subpane settings-subpane-enter">
      <div class="settings-header">
        <button class="btn-back" data-close-kid-activity type="button">&larr;</button>
        <span class="settings-header-title"><i class="ph-duotone ph-clipboard-text" style="color:#9CA3AF;font-size:1.1rem;vertical-align:middle"></i> ${escapeHtmlAttr(viewer.name || 'Kid')}'s Activity</span>
      </div>
      <div class="settings-body">
        <div class="card activity-card">
          ${rows || '<div class="empty-state"><div class="empty-text">No activity yet</div></div>'}
        </div>
      </div>
    </div>`;
  root.classList.add('open');
  root.querySelectorAll<HTMLElement>('[data-close-kid-activity]').forEach(button => button.addEventListener('click', closeSettingsPane));
}

function renderKidActivityPaneRow(row: DemoHistoryRow, currency: string): string {
  const value = Number(row.amount || 0) > 0
    ? `${currency}${Number(row.amount || 0).toFixed(2)}`
    : `${Number(row.gems || 0) > 0 ? '+' : ''}${Number(row.gems || 0)}`;
  const tone = value.startsWith('-') ? 'negative' : value === '0' ? 'neutral' : 'positive';
  return `<div class="activity-row">
    <span class="activity-badge" style="background:${activityPaneBadge(row).bg};color:${activityPaneBadge(row).color}">${activityPaneBadge(row).icon}</span>
    <div class="activity-body">
      <div class="activity-title">${escapeHtmlAttr(row.title || row.type || 'Activity')}</div>
      <div class="activity-meta">${formatShortDate(Number(row.createdAt || 0))}</div>
    </div>
    <div class="activity-delta ${tone}">
      <span class="activity-delta-value">${value}</span>
      <span class="activity-delta-unit">${Number(row.amount || 0) > 0 ? 'cash' : 'gems'}</span>
    </div>
  </div>`;
}

function activityPaneBadge(row: DemoHistoryRow): { icon: string; bg: string; color: string } {
  const type = String(row.type || '');
  if (type.includes('savings')) return { icon: '<i class="ph-duotone ph-piggy-bank"></i>', bg: '#DCFCE7', color: '#166534' };
  if (type.includes('badge')) return { icon: '<i class="ph-duotone ph-medal"></i>', bg: '#F3E8FF', color: '#7C3AED' };
  if (type.includes('bonus')) return { icon: '<i class="ph-duotone ph-sparkle"></i>', bg: '#FEF3C7', color: '#B45309' };
  if (type.includes('penalty')) return { icon: '<i class="ph-duotone ph-minus-circle"></i>', bg: '#FEE2E2', color: '#B91C1C' };
  return { icon: '<i class="ph-duotone ph-check-circle"></i>', bg: '#DCFCE7', color: '#15803D' };
}

function modalOriginStyle(rect?: DOMRect): string {
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
  const y = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
  return `--modal-origin-x:${x}px;--modal-origin-y:${y}px`;
}

function todayKeyForApp(now = Date.now()): string {
  return todayKeyForTimezone(currentSettings().familyTimezone, now);
}

function ordinalDay(value: number): string {
  const day = Math.min(31, Math.max(1, Math.round(value || 1)));
  const suffix = day === 1 || day === 21 || day === 31 ? 'st'
    : day === 2 || day === 22 ? 'nd'
      : day === 3 || day === 23 ? 'rd'
        : 'th';
  return `${day}${suffix}`;
}

function formatShortDate(createdAt: number): string {
  if (!createdAt) return 'Recently';
  return new Date(createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function escapeHtmlAttr(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] || char);
}

function toast(message: string, duration = 2900): void {
  const element = document.createElement('div');
  element.className = 'toast';
  element.innerHTML = message;
  document.body.appendChild(element);
  window.setTimeout(() => element.remove(), duration);
}

function speak(text: string): void {
  const clean = String(text || '').trim();
  if (!clean || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 0.94;
  utterance.pitch = 1.08;
  const voices = window.speechSynthesis.getVoices?.() || [];
  utterance.voice = voices.find(voice => voice.lang.startsWith('en') && /Samantha|Ava|Jenny|Google US English/i.test(voice.name)) || voices.find(voice => voice.lang.startsWith('en')) || null;
  window.speechSynthesis.speak(utterance);
}

function startRain(pieces: HTMLElement[], rootElement: HTMLElement | null = null): void {
  const root = rootElement || document.getElementById('confetti-root');
  if (!root) return;
  const batchId = `${Date.now()}-${Math.random()}`;
  pieces.forEach(piece => {
    piece.dataset.batch = batchId;
    root.appendChild(piece);
  });
  window.setTimeout(() => {
    root.querySelectorAll(`[data-batch="${batchId}"]`).forEach(piece => piece.remove());
  }, 5000);
}

function launchRain(
  factory: (input: { index: number; size: number; drift: number; rotateStart: number; rotateEnd: number }) => HTMLElement | null,
  count = 55,
  options: {
    rootElement?: HTMLElement | null;
    minSize?: number;
    maxSize?: number;
    minDuration?: number;
    durationRange?: number;
    maxDelay?: number;
    minOpacity?: number;
    opacityRange?: number;
    minDrift?: number;
    driftRange?: number;
    minRotateStart?: number;
    rotateStartRange?: number;
    minRotateTravel?: number;
    rotateTravelRange?: number;
  } = {},
): void {
  const pieces: HTMLElement[] = [];
  const minSize = options.minSize ?? 28;
  const maxSize = options.maxSize ?? 62;
  const minDuration = options.minDuration ?? 1.8;
  const durationRange = options.durationRange ?? 3.72;
  const maxDelay = options.maxDelay ?? 1.4;
  const minOpacity = options.minOpacity ?? 0.72;
  const opacityRange = options.opacityRange ?? 0.28;
  const minDrift = options.minDrift ?? -18;
  const driftRange = options.driftRange ?? 36;
  const minRotateStart = options.minRotateStart ?? -35;
  const rotateStartRange = options.rotateStartRange ?? 70;
  const minRotateTravel = options.minRotateTravel ?? 80;
  const rotateTravelRange = options.rotateTravelRange ?? 180;

  for (let index = 0; index < count; index += 1) {
    const size = minSize + Math.random() * Math.max(0, maxSize - minSize);
    const drift = minDrift + Math.random() * driftRange;
    const rotateStart = minRotateStart + Math.random() * rotateStartRange;
    const rotateEnd = rotateStart + (Math.random() > 0.5 ? 1 : -1) * (minRotateTravel + Math.random() * rotateTravelRange);
    const piece = factory({ index, size, drift, rotateStart, rotateEnd });
    if (!piece) continue;
    piece.classList.add('gem-rain-piece');
    piece.style.cssText = `
      ${piece.style.cssText || ''};
      left:${Math.random() * 110 - 5}%;
      animation-duration:${minDuration + Math.random() * durationRange}s;
      animation-delay:${Math.random() * maxDelay}s;
      opacity:${minOpacity + Math.random() * opacityRange};
      --rain-drift:${drift}px;
      --rain-rotate-start:${rotateStart}deg;
      --rain-rotate-end:${rotateEnd}deg;
    `;
    pieces.push(piece);
  }

  startRain(pieces, options.rootElement || null);
}

function applyAvatarColor(html: string, color: string): string {
  if (!html || !color || /\.(png|jpe?g|gif|webp)$/i.test(html)) return html;
  if (html.includes('style=')) return html.replace(/color\s*:\s*[^;"']+/i, `color:${color}`);
  return html.replace('<i ', `<i style="color:${color}" `);
}

function launchAvatarRain(avatar: string, count = 80, rootElement: HTMLElement | null = null, avatarColor = ''): void {
  const isImage = /\.(png|jpe?g|gif|webp)$/i.test(avatar);
  const isHtml = avatar.includes('<');
  launchRain(({ size }) => {
    const piece = isImage ? document.createElement('img') : document.createElement('div');
    if (isImage) {
      (piece as HTMLImageElement).src = avatar;
      (piece as HTMLImageElement).alt = '';
      piece.style.cssText = `width:${size}px;height:${size}px;`;
    } else if (isHtml) {
      piece.innerHTML = applyAvatarColor(avatar, avatarColor);
      piece.style.cssText = `font-size:${Math.max(1.2, size / 24).toFixed(2)}rem;`;
    } else {
      piece.textContent = avatar;
      piece.style.cssText = `font-size:${Math.max(1.2, size / 24).toFixed(2)}rem;`;
    }
    return piece;
  }, count, { rootElement, minSize: 28, maxSize: 70, minDuration: 2.2, durationRange: 2.8, maxDelay: 1.3 });
}

function launchBadgeRain(iconHtml: string, count = 110, rootElement: HTMLElement | null = null): void {
  const isHtml = iconHtml.includes('<');
  launchRain(({ size }) => {
    const piece = document.createElement('div');
    if (isHtml) piece.innerHTML = iconHtml;
    else piece.textContent = iconHtml;
    piece.style.cssText = `font-size:${Math.max(1, size / 20).toFixed(2)}rem;`;
    return piece;
  }, count, { rootElement, minSize: 20, maxSize: 48, minDuration: 1.5, durationRange: 2, maxDelay: 1.6 });
}

function launchGemsproutRain(count = 80): void {
  launchAvatarRain('/gemsprout.png', count);
}

function setRapidTapPulse(element: HTMLElement | null, scale = 1, opacity: number | null = null): void {
  if (!element) return;
  const isEggGem = element.id === 'egg-gem';
  if (isEggGem) {
    element.style.removeProperty('transform');
    element.style.setProperty('--egg-scale', String(scale));
  } else {
    element.style.transform = `scale(${scale})`;
  }
  if (opacity == null) return;
  if (isEggGem) {
    if (element.classList.contains('is-visible')) element.style.opacity = String(opacity);
    else element.style.removeProperty('opacity');
    return;
  }
  element.style.opacity = String(opacity);
}

function handleRapidTap(
  key: string,
  options: {
    required?: number;
    windowMs?: number;
    pulseEl?: HTMLElement | null;
    idleOpacity?: number | null;
    opacityStep?: number;
    minOpacity?: number | null;
    maxOpacity?: number | null;
    pulseClass?: string;
    onTrigger?: () => void;
  } = {},
): void {
  const required = options.required || 5;
  const windowMs = options.windowMs || 2500;
  const pulseEl = options.pulseEl || null;
  const idleOpacity = options.idleOpacity ?? null;
  const opacityStep = Number(options.opacityStep ?? 0.15);
  const minOpacity = options.minOpacity == null ? null : Number(options.minOpacity);
  const maxOpacity = options.maxOpacity == null ? null : Number(options.maxOpacity);
  const state = rapidTapState[key] || { taps: 0, timer: null };
  state.taps += 1;

  if (pulseEl) {
    let tapOpacity: number | null = null;
    if (idleOpacity != null) {
      tapOpacity = idleOpacity + (state.taps * opacityStep);
      if (minOpacity != null) tapOpacity = Math.max(minOpacity, tapOpacity);
      if (maxOpacity != null) tapOpacity = Math.min(maxOpacity, tapOpacity);
    }
    if (options.pulseClass) {
      pulseEl.classList.remove(options.pulseClass);
      void pulseEl.offsetWidth;
      pulseEl.classList.add(options.pulseClass);
      window.setTimeout(() => pulseEl.classList.remove(options.pulseClass || ''), 260);
    } else {
      setRapidTapPulse(pulseEl, 1.4, tapOpacity);
      window.setTimeout(() => setRapidTapPulse(pulseEl, 1), 120);
    }
  }

  if (state.timer) window.clearTimeout(state.timer);
  if (state.taps >= required) {
    state.taps = 0;
    if (pulseEl && idleOpacity != null) setRapidTapPulse(pulseEl, 1, idleOpacity);
    rapidTapState[key] = state;
    options.onTrigger?.();
    return;
  }

  state.timer = window.setTimeout(() => {
    state.taps = 0;
    if (pulseEl && idleOpacity != null) setRapidTapPulse(pulseEl, 1, idleOpacity);
  }, windowMs);
  rapidTapState[key] = state;
}

function handleStatsGemEasterEggTap(): void {
  handleRapidTap('egg-gem', {
    pulseEl: document.getElementById('egg-gem'),
    idleOpacity: 0.25,
    opacityStep: 0.12,
    minOpacity: 0.25,
    maxOpacity: 1,
    required: 5,
    windowMs: 2400,
    onTrigger: () => launchGemsproutRain(80),
  });
}

function bindHomeScreenActions(state: DemoAppState): void {
  document.querySelectorAll<HTMLElement>('[data-select-viewer]').forEach(button => {
    button.addEventListener('click', () => {
      const memberId = button.dataset.selectViewer || '';
      if (!memberId) return;
      activeViewerMemberId = memberId;
      activeKidTab = 'chores';
      closeSettingsPane();
      render();
    });
  });
  document.querySelector('[data-home-edit-family]')?.addEventListener('click', () => {
    startOnboardingEditDraft(state);
    activeOnboardingStep = 'welcome';
    onboardingTransitionDirection = 'forward';
    closeSettingsPane();
    render();
  });
}

function bindKidPlaceholderActions(): void {
  document.querySelectorAll<HTMLElement>('[data-speak]').forEach(element => {
    element.addEventListener('click', event => {
      const interactive = (event.target as Element | null)?.closest('button, [role="button"], input, select, textarea');
      if (interactive && interactive !== element) return;
      event.stopPropagation();
      speak(element.dataset.speak || '');
    });
  });
  document.querySelectorAll<HTMLElement>('[data-kid-switch-user]').forEach(button => {
    button.addEventListener('click', openSwitchUserScreen);
  });
  document.querySelectorAll<HTMLElement>('[data-kid-header-avatar]').forEach(avatar => {
    avatar.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      triggerKidAvatarEasterEgg();
    });
  });
  document.querySelectorAll<HTMLElement>('[data-kid-settings]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openKidSettings(button);
    });
  });
  bindKidBadgeCards();
  bindStatsGemEasterEgg();
  bindKidSavingsActions();
  bindKidPrizeActions();
  bindKidTeamActions();
  document.querySelectorAll<HTMLElement>('[data-kid-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const nextTab = button.dataset.kidTab as KidTabId | undefined;
      if (!nextTab || nextTab === activeKidTab) return;
      activeKidTab = nextTab;
      activeKidTimeTaskId = null;
      render();
    });
  });
  document.querySelectorAll<HTMLElement>('.task-swipe-card').forEach(card => {
    card.addEventListener('pointerdown', event => startSnapshotSwipe(event));
    card.addEventListener('pointermove', event => moveSnapshotSwipe(event));
    card.addEventListener('pointerup', event => endSnapshotSwipe(event));
    card.addEventListener('pointercancel', cancelSnapshotSwipe);
    card.addEventListener('click', event => handleSnapshotSwipeTap(event));
  });
  document.querySelectorAll<HTMLElement>('[data-kid-task-swipe-hint]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const shell = button.closest('.snapshot-routine-shell');
      if (!shell) return;
      const willReveal = !shell.classList.contains('revealed');
      closeAllSnapshotSwipes(willReveal ? shell : null);
      shell.classList.toggle('revealed', willReveal);
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-kid-task-complete]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      snapshotSwipeSuppressTapUntil = Date.now() + 600;
      const taskId = button.dataset.kidTaskComplete || '';
      const slotId = button.dataset.kidTaskSlot || '';
      const entryType = button.dataset.kidTaskEntryType || '';
      if (!taskId) return;
      if (button.dataset.speak) speak(button.dataset.speak);
      button.closest('.snapshot-routine-shell')?.classList.remove('revealed');
      void submitKidTaskCompletion(taskId, slotId || null, null, entryType === 'before' || entryType === 'after' ? entryType : null);
    });
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-kid-task-times]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      const taskId = button.dataset.kidTaskTimes || '';
      if (button.dataset.speak) speak(button.dataset.speak);
      activeKidTimeTaskId = activeKidTimeTaskId === taskId ? null : taskId;
      activeKidTimeOpenedAt = activeKidTimeTaskId ? Date.now() : 0;
      littleKidTimeConfirm = null;
      closeAllSnapshotSwipes();
      renderKidTimePickerOverlay();
    });
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
    });
  });
  bindKidTimePickerActions();
  bindPhotoCaptureActions();
}

function bindKidSavingsActions(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-kid-savings-add]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openKidSavingsModal(button.dataset.kidSavingsAdd || '', button);
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-kid-savings-history]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openKidSavingsHistory(button.dataset.kidSavingsHistory || '', button);
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-kid-savings-spend]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openKidSavingsSpendModal(button.dataset.kidSavingsSpend || '', button);
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-kid-savings-claim]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      void claimSavingsInterest(button.dataset.kidSavingsClaim || '', 'kid');
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-kid-full-activity]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openKidFullActivityPane();
    });
  });
}

function bindKidPrizeActions(): void {
  document.querySelectorAll<HTMLElement>('[data-kid-prize-card]').forEach(card => {
    card.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openKidPrizeModal(card.dataset.kidPrizeCard || '', card);
    });
    card.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openKidPrizeModal(card.dataset.kidPrizeCard || '', card);
    });
  });
}

function bindKidTeamActions(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-kid-team-contribute]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const [memberId, goalId] = String(button.dataset.kidTeamContribute || '').split(':');
      openKidTeamContributionModal(memberId, goalId, button);
    });
  });
}

function openKidTeamContributionModal(memberId: string, goalId: string, triggerEl?: HTMLElement): void {
  const state = currentDemoState();
  const member = state.members.find(item => item.id === memberId);
  const goal = state.teamGoals.find(item => item.id === goalId);
  const root = document.getElementById('modal-root');
  if (!member || !goal || !root) return;
  const total = teamGoalTotal(goal);
  const remaining = Math.max(0, Number(goal.targetPoints || 0) - total);
  const maxAllowed = Math.max(0, Math.min(Number(member.gems ?? member.diamonds ?? 0), remaining));
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="${modalOriginStyle(triggerEl?.getBoundingClientRect())}">
      <div class="modal quick-action-modal quick-action-modal-wide modal-origin-sheet" role="dialog" aria-modal="true">
        <button class="modal-close-x" type="button" aria-label="Close" data-modal-close><span aria-hidden="true">&times;</span></button>
        <div class="modal-title"><i class="ph-duotone ph-trophy" style="color:#D97706;font-size:1.2rem;vertical-align:middle"></i> ${escapeHtmlAttr(goal.title || 'Team prize')}</div>
        <p style="color:var(--muted);font-size:0.9rem;margin-bottom:16px">
          You have <strong>${Number(member.gems ?? member.diamonds ?? 0)} gems</strong>. How many do you want to contribute?
        </p>
        <div class="form-group">
          <label class="form-label">Gems to contribute</label>
          <div style="display:flex;gap:10px;align-items:center">
            <input type="number" data-team-contrib-gems min="1" placeholder="e.g. 50" style="flex:1 1 auto">
            <button class="btn btn-secondary btn-sm" type="button" data-team-contrib-max>Max</button>
          </div>
          <div style="margin-top:8px;font-size:0.8rem;color:var(--muted)">Up to ${maxAllowed} gems will go toward this prize right now.</div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-modal-close type="button">Cancel</button>
          <button class="btn btn-primary" data-team-contrib-submit="${escapeHtmlAttr(memberId)}:${escapeHtmlAttr(goalId)}" type="button">Add Gems!</button>
        </div>
      </div>
    </div>`;
  root.querySelectorAll<HTMLElement>('[data-modal-close]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelector<HTMLButtonElement>('[data-team-contrib-max]')?.addEventListener('click', () => {
    const input = root.querySelector<HTMLInputElement>('[data-team-contrib-gems]');
    if (!input) return;
    input.value = String(maxAllowed);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  root.querySelector<HTMLButtonElement>('[data-team-contrib-submit]')?.addEventListener('click', event => {
    const button = event.currentTarget as HTMLButtonElement;
    const [submitMemberId, submitGoalId] = String(button.dataset.teamContribSubmit || '').split(':');
    const gems = Number.parseInt(root.querySelector<HTMLInputElement>('[data-team-contrib-gems]')?.value || '0', 10) || 0;
    void submitKidTeamContribution(submitMemberId, submitGoalId, gems);
  });
}

async function submitKidTeamContribution(memberId: string, goalId: string, requestedGems: number): Promise<void> {
  if (requestedGems <= 0) {
    toast('Enter gems to contribute');
    const viewer = currentDemoState().members.find(item => item.id === memberId);
    if (isLittleKidMode(viewer)) speak('Enter gems to contribute.');
    return;
  }
  const state = currentDemoState();
  const member = state.members.find(item => item.id === memberId);
  const goal = state.teamGoals.find(item => item.id === goalId);
  if (!member || !goal) return;
  const owned = Number(member.gems ?? member.diamonds ?? 0);
  const target = Number(goal.targetPoints || 0);
  const total = teamGoalTotal(goal);
  const remaining = Math.max(0, target - total);
  const applied = Math.min(Math.max(0, requestedGems), owned, remaining);
  if (applied <= 0) {
    const message = remaining <= 0 ? 'This prize is already fully funded!' : 'No gems available to add right now.';
    toast(message);
    if (isLittleKidMode(member)) speak(message);
    return;
  }
  const refund = Math.max(0, requestedGems - applied);
  const nextBalance = Math.max(0, owned - applied);
  const nextGoal: DemoTeamGoal = {
    ...goal,
    contributions: {
      ...(goal.contributions || {}),
      [memberId]: Number(goal.contributions?.[memberId] || 0) + applied,
    },
  };
  const nextGoals = state.teamGoals.map(item => item.id === goalId ? nextGoal : item);
  const now = Date.now();
  const history: DemoHistoryRow = {
    id: `history:goal:${memberId}:${goalId}:${now}`,
    familyId: useDevFirestore() ? DEV_FIRESTORE_FAMILY_ID : LAB_FAMILY_ID,
    requestId: '',
    memberId,
    type: 'goal',
    title: String(goal.title || 'Team prize'),
    gems: -applied,
    amount: null,
    createdAt: now,
    metadata: { goalId, contribution: applied },
  };
  closeModal();
  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    if (!firestoreState) return;
    firestoreState = {
      ...firestoreState,
      members: firestoreState.members.map(item => item.id === memberId ? { ...item, gems: nextBalance, diamonds: nextBalance } : item),
      teamGoals: nextGoals,
      historyRows: [history, ...firestoreState.historyRows],
    };
    render();
    try {
      const { commitDevKidTeamContribution } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevKidTeamContribution({ memberId, member: { ...member, gems: nextBalance, diamonds: nextBalance }, teamGoals: nextGoals, history });
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
      render();
    }
  } else {
    const family = store.get<{ settings?: DemoAppState['settings']; teamGoals?: DemoTeamGoal[] }>(familyPath(LAB_FAMILY_ID)) || {};
    store.set(memberPath(LAB_FAMILY_ID, memberId), { ...member, gems: nextBalance, diamonds: nextBalance });
    store.set(familyPath(LAB_FAMILY_ID), { ...family, teamGoals: nextGoals });
    store.set(historyPath(LAB_FAMILY_ID, String(history.id || '')), history);
    saveSharedLabStore(store);
    render();
  }
  toast(`${applied} gem${applied === 1 ? '' : 's'} contributed to "${goal.title}"! <i class="ph-duotone ph-trophy" style="color:#D97706;font-size:0.9rem;vertical-align:middle"></i>`);
  if (isLittleKidMode(member)) speak(`You gave ${applied} gem${applied === 1 ? '' : 's'} to the team! Amazing!`);
  if (refund > 0) openKidTeamContributionAdjustmentModal(member, goal, { refund, remaining, owned });
}

function openKidTeamContributionAdjustmentModal(_member: DemoMember, _goal: DemoTeamGoal, details: { refund: number; remaining: number; owned: number }): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  const reasonText = details.remaining < details.owned
    ? `This prize only needed ${details.remaining} more gems, so you're getting ${details.refund} gems back!`
    : `You only had ${details.owned} gems ready to add, so you're getting ${details.refund} gems back!`;
  if (isLittleKidMode(_member)) speak(reasonText);
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="${modalOriginStyle()}">
      <div class="modal quick-action-modal quick-action-modal-wide kid-savings-modal modal-origin-sheet" role="dialog" aria-modal="true">
        <button class="modal-close-x" type="button" aria-label="Close" data-modal-close><span aria-hidden="true">&times;</span></button>
        <div class="modal-title"><i class="ph-duotone ph-arrow-u-down-left" style="color:#0F766E;font-size:1.2rem;vertical-align:middle"></i> Just Right</div>
        <p class="kid-savings-modal-copy" style="margin-bottom:16px">${escapeHtmlAttr(reasonText)}</p>
        <div class="modal-actions">
          <button class="btn btn-primary btn-full" data-modal-close type="button">Okay</button>
        </div>
      </div>
    </div>`;
  root.querySelectorAll<HTMLElement>('[data-modal-close]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
}

function teamGoalTotal(goal: DemoTeamGoal): number {
  return Object.values(goal.contributions || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function openKidPrizeModal(prizeId: string, triggerEl?: HTMLElement): void {
  const state = currentDemoState();
  const viewer = getActiveViewer(state);
  const prize = state.prizes.find(item => String(item.id || '') === prizeId);
  const root = document.getElementById('modal-root');
  if (!viewer || viewer.role === 'parent' || !prize || !root) return;
  const status = getKidPrizeRedeemStatus(state, prize, viewer);
  if (!status.ok) {
    toast(formatPrizeRedeemStatusMessage(status));
    return;
  }
  const cost = Math.max(0, Number(prize.cost || 0));
  const balance = Number(viewer.gems ?? viewer.diamonds ?? 0);
  const needsApproval = prize.requireParentApproval === true;
  const requirementSummary = getPrizeRequirementSummary(state, prize);
  const recurrenceSummary = formatPrizeRecurrenceForModal(prize.recurrence);
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="${modalOriginStyle(triggerEl?.getBoundingClientRect())}">
      <div class="modal quick-action-modal modal-origin-sheet" role="dialog" aria-modal="true">
        <button class="modal-close-x" type="button" aria-label="Close" data-modal-close><span aria-hidden="true">&times;</span></button>
        <div class="modal-title">${renderPrizeIconHtml(prize, 'font-size:1.2rem;vertical-align:middle')} ${needsApproval ? 'Request Prize?' : 'Redeem Prize?'}</div>
        <p style="margin-bottom:20px;line-height:1.6">${needsApproval
          ? `Send a request to your parent for <strong>${escapeHtmlAttr(prize.title || 'this prize')}</strong> (${cost} gems)?`
          : `Redeem <strong>${escapeHtmlAttr(prize.title || 'this prize')}</strong> for ${cost} of your ${balance} gems?`}</p>
        <p style="margin-top:-10px;margin-bottom:20px;font-size:0.82rem;color:var(--muted)">${escapeHtmlAttr(recurrenceSummary)}${requirementSummary ? ` &middot; ${escapeHtmlAttr(requirementSummary)}` : ''}${needsApproval ? ' &middot; Parent approval required' : ''}</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-modal-close type="button">Not yet</button>
          <button class="btn btn-primary" data-kid-prize-confirm="${escapeHtmlAttr(prizeId)}" type="button">${needsApproval ? 'Send request' : 'Yes, redeem!'} <i class="ph-duotone ${needsApproval ? 'ph-paper-plane-tilt' : 'ph-confetti'}" style="font-size:1rem;vertical-align:middle"></i></button>
        </div>
      </div>
    </div>`;
  root.querySelectorAll<HTMLElement>('[data-modal-close]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelector<HTMLButtonElement>('[data-kid-prize-confirm]')?.addEventListener('click', event => {
    const button = event.currentTarget as HTMLButtonElement;
    if (needsApproval) void submitKidPrizeRequest(button.dataset.kidPrizeConfirm || '');
    else void confirmKidPrizeRedeem(button.dataset.kidPrizeConfirm || '');
  });
}

async function submitKidPrizeRequest(prizeId: string): Promise<void> {
  const state = currentDemoState();
  const viewer = getActiveViewer(state);
  const prize = state.prizes.find(item => String(item.id || '') === prizeId);
  if (!viewer?.id || viewer.role === 'parent' || !prize) return;
  const status = getKidPrizeRedeemStatus(state, prize, viewer);
  closeModal();
  if (!status.ok) {
    toast(formatPrizeRedeemStatusMessage(status));
    if (isLittleKidMode(viewer)) speak(formatPrizeRedeemStatusMessage(status));
    return;
  }
  const hasPending = state.requests.some(request =>
    request.status === REQUEST_STATUSES.PENDING
    && request.kind === REQUEST_KINDS.PRIZE_REDEEM
    && request.targetMemberId === viewer.id
    && request.source?.prizeId === prizeId
  );
  if (hasPending) {
    toast('Request already pending for this prize');
    if (isLittleKidMode(viewer)) speak('Request already pending for this prize.');
    return;
  }
  const now = Date.now();
  const requestId = `request:prize:${viewer.id}:${prizeId}:${now}:${Math.random().toString(36).slice(2, 7)}`;
  const requestDoc: DemoRequest = {
    id: requestId,
    status: REQUEST_STATUSES.PENDING,
    kind: REQUEST_KINDS.PRIZE_REDEEM,
    targetMemberId: viewer.id,
    createdAt: now,
    resolvedAt: null,
    resolvedByMemberId: null,
    snapshot: { title: String(prize.title || 'Prize'), cost: Math.max(0, Number(prize.cost || 0)) },
    source: { choreId: null, completionId: null, prizeId, reason: '', amount: null },
  };
  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    if (!firestoreState) return;
    firestoreState = { ...firestoreState, requests: [...firestoreState.requests, requestDoc], request: requestDoc };
    render();
    try {
      const { commitDevKidPrizeRequest } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevKidPrizeRequest({ requestId, memberId: String(viewer.id), prizeId, title: String(prize.title || 'Prize'), cost: Math.max(0, Number(prize.cost || 0)), now });
      void sendParentApprovalPush({ memberId: String(viewer.id), title: String(prize.title || 'Prize'), kind: 'prize_request' });
      toast('<i class="ph-duotone ph-hourglass" style="font-size:1rem;vertical-align:middle"></i> Request sent for parent approval');
      if (isLittleKidMode(viewer)) speak(`Request sent for ${String(prize.title || 'prize')}. Waiting for your grown-up.`);
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
      render();
    }
    return;
  }
  store.set(requestPath(LAB_FAMILY_ID, requestId), { ...requestDoc, familyId: LAB_FAMILY_ID, requesterMemberId: viewer.id });
  saveSharedLabStore(store);
  void sendParentApprovalPush({ memberId: String(viewer.id), title: String(prize.title || 'Prize'), kind: 'prize_request' });
  toast('<i class="ph-duotone ph-hourglass" style="font-size:1rem;vertical-align:middle"></i> Request sent for parent approval');
  if (isLittleKidMode(viewer)) speak(`Request sent for ${String(prize.title || 'prize')}. Waiting for your grown-up.`);
  render();
}

async function confirmKidPrizeRedeem(prizeId: string): Promise<void> {
  const state = currentDemoState();
  const viewer = getActiveViewer(state);
  const prize = state.prizes.find(item => String(item.id || '') === prizeId);
  if (!viewer?.id || viewer.role === 'parent' || !prize) return;
  const actionKey = `${viewer.id}:${prizeId}`;
  if (activeKidPrizeActionIds.has(actionKey)) return;
  activeKidPrizeActionIds.add(actionKey);
  closeModal();
  try {
    const result = await redeemKidPrize(viewer, prize);
    if (!result.ok) {
      toast(result.message || 'This prize is not ready yet');
      if (isLittleKidMode(viewer)) speak(result.message || 'This prize is not ready yet.');
      return;
    }
    if (isLittleKidMode(viewer)) speak(`You got it! ${String(prize.title || 'Prize')}! Go show your grown-up!`);
    showKidPrizeCelebration(prize);
  } finally {
    activeKidPrizeActionIds.delete(actionKey);
  }
}

async function redeemKidPrize(member: DemoMember, prize: DemoPrize): Promise<{ ok: boolean; message?: string }> {
  const state = currentDemoState();
  const status = getKidPrizeRedeemStatus(state, prize, member);
  if (!status.ok) return { ok: false, message: formatPrizeRedeemStatusMessage(status) };
  const now = Date.now();
  const cost = Math.max(0, Number(prize.cost || 0));
  const dateKey = todayKeyForApp(now);
  const periodKey = getPrizePeriodKey(prize.recurrence, dateKey);
  const redemptionId = `redemption:${member.id}:${prize.id}:${now}`;
  const historyId = `history:prize-redeem:${member.id}:${prize.id}:${periodKey}:${now}`;
  const nextBalance = Math.max(0, Number(member.gems ?? member.diamonds ?? 0) - cost);
  const redemption = {
    id: redemptionId,
    memberId: String(member.id || ''),
    date: dateKey,
    cost,
    periodKey,
    prizeId: String(prize.id || ''),
    requirementSnapshot: {
      type: prize.requirementType || 'none',
      taskCount: prize.requirementTaskCount || 1,
      taskIds: [...(prize.requirementTaskIds || [])],
      recurrence: prize.recurrence || 'anytime',
    },
  };
  const history: DemoHistoryRow = {
    id: historyId,
    familyId: useDevFirestore() ? DEV_FIRESTORE_FAMILY_ID : LAB_FAMILY_ID,
    requestId: '',
    memberId: String(member.id || ''),
    type: 'prize',
    title: String(prize.title || 'Prize'),
    gems: -cost,
    amount: null,
    createdAt: now,
    metadata: { prizeId: prize.id, redemptionId },
  };
  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    if (!firestoreState) return { ok: false, message: 'Prize no longer available' };
    firestoreState = {
      ...firestoreState,
      members: firestoreState.members.map(item => item.id === member.id ? { ...item, gems: nextBalance, diamonds: nextBalance } : item),
      prizes: firestoreState.prizes.map(item => item.id === prize.id ? { ...item, redemptions: [...(item.redemptions || []), redemption] } : item),
      historyRows: [history, ...firestoreState.historyRows],
    };
    render();
    try {
      const { commitDevKidPrizeRedeem } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevKidPrizeRedeem({ memberId: String(member.id || ''), prizeId: String(prize.id || ''), cost, redemption, history, now });
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
      render();
      return { ok: false, message: 'Prize no longer available' };
    }
    return { ok: true };
  }
  store.set(memberPath(LAB_FAMILY_ID, String(member.id || '')), { ...member, gems: nextBalance, diamonds: nextBalance });
  store.set(prizePath(LAB_FAMILY_ID, String(prize.id || '')), { ...prize, redemptions: [...(prize.redemptions || []), redemption] });
  store.set(historyPath(LAB_FAMILY_ID, historyId), history);
  saveSharedLabStore(store);
  render();
  return { ok: true };
}

function showKidPrizeCelebration(prize: DemoPrize): void {
  const root = document.getElementById('celebration-root');
  if (!root) return;
  root.innerHTML = `
    <div class="celebration-overlay">
      <div class="celebration-rain-layer"></div>
      <div class="celebration-box">
        <div class="cel-icon">${renderPrizeIconHtml(prize, 'font-size:3.5rem')}</div>
        <div class="cel-title">Prize Unlocked!</div>
        <div class="cel-sub">${escapeHtmlAttr(prize.title || 'Prize')}</div>
        <button class="btn btn-primary btn-full" data-close-celebration type="button">Yay! <i class="ph-duotone ph-confetti" style="font-size:1rem;vertical-align:middle"></i></button>
      </div>
    </div>`;
  root.querySelector<HTMLButtonElement>('[data-close-celebration]')?.addEventListener('click', () => {
    root.innerHTML = '';
    render();
  });
}

function renderPrizeIconHtml(prize: DemoPrize, style = ''): string {
  const icon = String(prize.icon || 'gift').replace(/^ph-/, '');
  const color = String(prize.iconColor || '#FF6584');
  return `<i class="ph-duotone ph-${escapeHtmlAttr(icon)}" style="color:${escapeHtmlAttr(color)};${style}"></i>`;
}

function formatPrizeRecurrenceForModal(value: unknown): string {
  const recurrence = String(value || 'anytime');
  if (recurrence === 'one_time') return 'Once';
  if (recurrence === 'daily') return 'Once per day';
  if (recurrence === 'weekly') return 'Once per week';
  if (recurrence === 'monthly') return 'Once per month';
  return 'Unlimited';
}

function renderKidTimePickerOverlay(): void {
  document.querySelector('[data-kid-time-picker-shell]')?.remove();
  if (!activeKidTimeTaskId) return;
  const state = currentDemoState();
  const viewer = getActiveViewer(state);
  if (!viewer || viewer.role === 'parent') return;
  document.getElementById('screen-kid')?.insertAdjacentHTML('beforeend', renderKidTimePicker(state, viewer, activeKidTimeTaskId));
  bindKidTimePickerActions();
}

function bindKidTimePickerActions(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-kid-time-slot]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      captureKidScrollPosition();
      const [taskId, slotId] = String(button.dataset.kidTimeSlot || '').split(':');
      const entryType = button.dataset.kidTimeEntryType || '';
      const status = button.dataset.kidTimeSlotStatus || '';
      const label = button.dataset.kidTimeSlotLabel || 'Time';
      const viewer = getActiveViewer(currentDemoState());
      if (viewer && isLittleKidMode(viewer)) {
        if (status === 'done') {
          speak(`${label}. Already done.`);
          return;
        }
        if (status === 'pending') {
          speak(`${label}. Waiting for your grown-up.`);
          return;
        }
        if (status === 'later') {
          speak(`${label}. Not available right now.`);
          return;
        }
        const now = Date.now();
        const confirmed = littleKidTimeConfirm
          && littleKidTimeConfirm.taskId === taskId
          && littleKidTimeConfirm.slotId === slotId
          && littleKidTimeConfirm.expiresAt > now;
        if (!confirmed) {
          littleKidTimeConfirm = { taskId, slotId, expiresAt: now + 6000 };
          speak(`${label}. Tap again to mark it done.`);
          return;
        }
        littleKidTimeConfirm = null;
      }
      activeKidTimeTaskId = null;
      document.querySelector('[data-kid-time-picker-shell]')?.remove();
      if (taskId && slotId) void submitKidTaskCompletion(taskId, slotId || null, null, entryType === 'before' || entryType === 'after' ? entryType : null);
    });
  });
  document.querySelector<HTMLElement>('[data-kid-time-picker-shell]')?.addEventListener('click', event => {
    if (event.target !== event.currentTarget) return;
    if (Date.now() - activeKidTimeOpenedAt < 300) return;
    activeKidTimeTaskId = null;
    littleKidTimeConfirm = null;
    document.querySelector('[data-kid-time-picker-shell]')?.remove();
  });
}

function bindPhotoCaptureActions(): void {
  const root = document.getElementById('modal-root');
  if (!root?.innerHTML) return;
  root.querySelectorAll<HTMLElement>('[data-photo-cancel]').forEach(button => {
    button.addEventListener('click', closeKidPhotoCapture);
  });
  root.querySelector<HTMLElement>('[data-photo-capture-overlay]')?.addEventListener('click', event => {
    if (Date.now() - kidPhotoCaptureOpenedAt < 350) return;
    if (event.target === event.currentTarget) closeKidPhotoCapture();
  });
  const input = root.querySelector<HTMLInputElement>('[data-photo-file-input]');
  root.querySelector<HTMLElement>('[data-photo-pick]')?.addEventListener('click', () => input?.click());
  input?.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const img = root.querySelector<HTMLImageElement>('[data-photo-preview-img]');
      const hint = root.querySelector<HTMLElement>('[data-photo-drop-hint]');
      const submit = root.querySelector<HTMLButtonElement>('[data-photo-submit]');
      if (img) {
        img.src = String(reader.result || '');
        img.style.display = 'block';
      }
      if (hint) hint.style.display = 'none';
      if (submit) {
        submit.style.opacity = '1';
        submit.style.pointerEvents = 'auto';
      }
    });
    reader.readAsDataURL(file);
  });
  root.querySelector<HTMLButtonElement>('[data-photo-submit]')?.addEventListener('click', async event => {
    const button = event.currentTarget as HTMLButtonElement;
    const file = input?.files?.[0];
    if (!file) return;
    button.style.opacity = '0.5';
    button.style.pointerEvents = 'none';
    button.textContent = 'Submitting...';
    try {
      const photoUrl = await uploadChorePhotoInline(file);
      const taskId = button.dataset.photoTask || '';
      const slotId = button.dataset.photoSlot || '';
      const entryType = button.dataset.photoEntryType === 'before' ? 'before' : 'after';
      closeKidPhotoCapture();
      if (taskId) void submitKidTaskCompletion(taskId, slotId || null, photoUrl, entryType);
    } catch {
      toast('Photo was too large. Try taking it again.');
      button.style.opacity = '1';
      button.style.pointerEvents = 'auto';
      button.textContent = button.dataset.photoEntryType === 'before' ? 'Submit' : 'Submit Completion';
    }
  });
}

async function uploadChorePhotoInline(file: File): Promise<string> {
  const dataUrl = await compressPhotoToDataUrl(file, 400, 0.5);
  if (dataUrl.length > 240000) throw new Error('Compressed photo is too large.');
  return dataUrl;
}

function compressPhotoToDataUrl(file: File, maxSide: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const raw = String(reader.result || '');
      const image = new Image();
      image.addEventListener('load', () => {
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          resolve(raw);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      });
      image.addEventListener('error', () => resolve(raw));
      image.src = raw;
    });
    reader.addEventListener('error', () => reject(reader.error || new Error('Photo read failed.')));
    reader.readAsDataURL(file);
  });
}

function openKidPhotoCapture(taskId: string, slotId: string | null, entryType: 'before' | 'after'): void {
  const state = currentDemoState();
  const task = state.tasks.find(item => String(item.id || '') === taskId);
  const root = document.getElementById('modal-root');
  if (!task || !root) return;
  kidPhotoCaptureOpenedAt = Date.now();
  root.innerHTML = renderKidPhotoCapture(task, entryType, slotId || '');
  bindPhotoCaptureActions();
}

function closeKidPhotoCapture(): void {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}

function bindParentQuickActions(state: DemoAppState): void {
  const trigger = document.querySelector<HTMLButtonElement>('[data-parent-quick-trigger]');
  const host = document.getElementById('parent-quick-launch');
  trigger?.addEventListener('click', () => {
    if (!host) return;
    if (host.classList.contains('open')) closeParentQuickFan();
    else openParentQuickFan();
  });
  document.querySelector<HTMLElement>('[data-parent-quick-fan]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeParentQuickFan();
  });
  document.querySelectorAll<HTMLButtonElement>('[data-parent-quick-action]').forEach(button => {
    button.addEventListener('click', () => {
      const actionId = button.dataset.parentQuickAction as ParentQuickActionId | undefined;
      if (!actionId) return;
      openQuickActionModal(actionId, state, button);
    });
  });
}

function bindParentTabNav(): void {
  document.querySelectorAll<HTMLButtonElement>('[data-parent-tab]').forEach(button => {
    button.addEventListener('click', () => {
      const nextTab = button.dataset.parentTab as ParentTabId | undefined;
      if (!nextTab || nextTab === activeParentTab) return;
      if (!['overview', 'tasks', 'prizes', 'levels', 'stats'].includes(nextTab)) return;
      activeParentTab = nextTab;
      closeModal();
      render();
    });
  });
}

function bindOverviewSwipeActions(): void {
  bindSnapshotSummaryActions(document);
  bindRecentActivityActions(document);
  bindOverviewSwipeDismiss();
}

function bindSnapshotSummaryActions(root: Document | HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.snapshot-summary-card').forEach(card => {
    card.addEventListener('pointerdown', event => startSnapshotSummarySwipe(event));
    card.addEventListener('pointermove', event => moveSnapshotSummarySwipe(event));
    card.addEventListener('pointerup', event => endSnapshotSummarySwipe(event));
    card.addEventListener('pointercancel', cancelSnapshotSummarySwipe);
    card.addEventListener('click', event => handleSnapshotSummaryTap(event));
  });
  root.querySelectorAll<HTMLButtonElement>('[data-summary-home]').forEach(button => {
    swallowSnapshotSummaryButtonTap(button);
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      const memberId = button.dataset.summaryHome || '';
      const shell = button.closest('.snapshot-summary-shell');
      if (!shell) return;
      shell.querySelector('.snapshot-summary-reveal')?.classList.add('here');
      shell.querySelector('.snapshot-summary-reveal')?.classList.remove('away');
      shell.querySelector('.snapshot-summary-toggle-btn.home')?.classList.add('active');
      shell.querySelector('.snapshot-summary-toggle-btn.away')?.classList.remove('active');
      shell.classList.remove('revealed');
      if (memberId) void setMemberTodayPresence(memberId, true);
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-summary-away]').forEach(button => {
    swallowSnapshotSummaryButtonTap(button);
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      const memberId = button.dataset.summaryAway || '';
      const shell = button.closest('.snapshot-summary-shell');
      if (!shell) return;
      shell.querySelector('.snapshot-summary-reveal')?.classList.add('away');
      shell.querySelector('.snapshot-summary-reveal')?.classList.remove('here');
      shell.querySelector('.snapshot-summary-toggle-btn.away')?.classList.add('active');
      shell.querySelector('.snapshot-summary-toggle-btn.home')?.classList.remove('active');
      shell.classList.remove('revealed');
      if (memberId) void setMemberTodayPresence(memberId, false);
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-summary-claim-interest]').forEach(button => {
    swallowSnapshotSummaryButtonTap(button);
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      const memberId = button.dataset.summaryClaimInterest || '';
      if (!memberId) return;
      void claimSavingsInterest(memberId, 'parent');
      button.closest('.snapshot-summary-shell')?.classList.remove('revealed');
    });
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
    });
  });
}

function swallowSnapshotSummaryButtonTap(button: HTMLButtonElement): void {
  ['pointerup', 'click'].forEach(eventName => {
    button.addEventListener(eventName, event => {
      event.preventDefault();
      event.stopPropagation();
    });
  });
}

function bindRecentActivityActions(root: Document | HTMLElement): void {
  root.querySelectorAll<HTMLElement>('.activity-row-card').forEach(card => {
    card.addEventListener('pointerdown', event => startSnapshotSwipe(event));
    card.addEventListener('pointermove', event => moveSnapshotSwipe(event));
    card.addEventListener('pointerup', event => endSnapshotSwipe(event));
    card.addEventListener('pointercancel', cancelSnapshotSwipe);
    card.addEventListener('click', event => handleSnapshotSwipeTap(event));
  });
  root.querySelectorAll<HTMLElement>('.activity-swipe-hint').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      const shell = button.closest('.snapshot-routine-shell');
      if (!shell) return;
      const willReveal = !shell.classList.contains('revealed');
      closeAllSnapshotSwipes(willReveal ? shell : null);
      shell.classList.toggle('revealed', willReveal);
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-history-undo]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      snapshotSwipeSuppressTapUntil = Date.now() + 600;
      const historyId = button.dataset.historyUndo || '';
      if (!historyId) return;
      if (useDevFirestore()) {
        void handleFirestoreUndoAction(historyId);
        return;
      }
      undoLocalHistory(historyId);
    });
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-open-full-history]').forEach(button => {
    button.addEventListener('click', () => {
      const state = useDevFirestore() ? firestoreState : readDemoAppState(store);
      if (!state) return;
      openFullHistoryModal(state);
    });
  });
}

function bindTaskTabActions(state: DemoAppState): void {
  document.querySelectorAll<HTMLElement>('.task-swipe-card').forEach(card => {
    card.addEventListener('pointerdown', event => startSnapshotSwipe(event));
    card.addEventListener('pointermove', event => moveSnapshotSwipe(event));
    card.addEventListener('pointerup', event => endSnapshotSwipe(event));
    card.addEventListener('pointercancel', cancelSnapshotSwipe);
    card.addEventListener('click', event => handleSnapshotSwipeTap(event));
  });
  document.querySelectorAll<HTMLElement>('[data-task-swipe-hint]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const shell = button.closest('.snapshot-routine-shell');
      if (!shell) return;
      const willReveal = !shell.classList.contains('revealed');
      closeAllSnapshotSwipes(willReveal ? shell : null);
      shell.classList.toggle('revealed', willReveal);
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-task-create]').forEach(button => {
    button.addEventListener('click', () => {
      activeTaskEditorMode = 'create';
      activeTaskId = null;
      activeTaskEditorDraft = createTaskEditorDraft(null);
      openTaskModal(button);
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-task-edit]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      const taskId = button.dataset.taskEdit || '';
      const task = state.tasks.find(item => item.id === taskId) || null;
      if (!task) return;
      button.closest('.snapshot-routine-shell')?.classList.remove('revealed');
      activeTaskEditorMode = 'edit';
      activeTaskId = taskId;
      activeTaskEditorDraft = createTaskEditorDraft(task);
      openTaskModal(button);
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-task-delete]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      const taskId = button.dataset.taskDelete || '';
      const task = state.tasks.find(item => item.id === taskId) || null;
      if (!task) return;
      activeTaskId = taskId;
      button.closest('.snapshot-routine-shell')?.classList.remove('revealed');
      openDeleteTaskModal(task, button);
    });
  });
}

function bindPrizeTabActions(state: DemoAppState): void {
  document.querySelectorAll<HTMLElement>('.prize-swipe-card').forEach(card => {
    card.addEventListener('pointerdown', event => startSnapshotSwipe(event));
    card.addEventListener('pointermove', event => moveSnapshotSwipe(event));
    card.addEventListener('pointerup', event => endSnapshotSwipe(event));
    card.addEventListener('pointercancel', cancelSnapshotSwipe);
    card.addEventListener('click', event => handleSnapshotSwipeTap(event));
  });
  document.querySelectorAll<HTMLElement>('[data-prize-swipe-hint]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const shell = button.closest('.snapshot-routine-shell');
      if (!shell) return;
      const willReveal = !shell.classList.contains('revealed');
      closeAllSnapshotSwipes(willReveal ? shell : null);
      shell.classList.toggle('revealed', willReveal);
    });
  });
  document.querySelector<HTMLButtonElement>('[data-prize-create]')?.addEventListener('click', event => {
    const button = event.currentTarget as HTMLElement;
    activePrizeId = null;
    activePrizeEditorDraft = createPrizeEditorDraft(null);
    openPrizeEditorModal(button);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-prize-edit]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      const prizeId = button.dataset.prizeEdit || '';
      const prize = state.prizes.find(item => item.id === prizeId) || null;
      if (!prize) return;
      activePrizeId = prizeId;
      activePrizeEditorDraft = createPrizeEditorDraft(prize);
      button.closest('.snapshot-routine-shell')?.classList.remove('revealed');
      openPrizeEditorModal(button);
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-prize-delete]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      const prizeId = button.dataset.prizeDelete || '';
      const prize = state.prizes.find(item => item.id === prizeId) || null;
      if (!prize) return;
      activePrizeDeleteKind = 'prize';
      activePrizeId = prizeId;
      button.closest('.snapshot-routine-shell')?.classList.remove('revealed');
      openPrizeDeleteModal('prize', String(prize.title || 'This prize'), button);
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-prize-reset]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      const prizeId = button.dataset.prizeReset || '';
      if (!prizeId) return;
      void resetPrizeRedemptions(prizeId);
    });
  });
  document.querySelector<HTMLButtonElement>('[data-goal-create]')?.addEventListener('click', event => {
    const button = event.currentTarget as HTMLElement;
    activeGoalId = null;
    activeGoalEditorDraft = createGoalEditorDraft(null);
    openGoalEditorModal(button);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-goal-edit]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      const goalId = button.dataset.goalEdit || '';
      const goal = state.teamGoals.find(item => item.id === goalId) || null;
      if (!goal) return;
      activeGoalId = goalId;
      activeGoalEditorDraft = createGoalEditorDraft(goal);
      button.closest('.snapshot-routine-shell')?.classList.remove('revealed');
      openGoalEditorModal(button);
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-goal-delete]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      const goalId = button.dataset.goalDelete || '';
      const goal = state.teamGoals.find(item => item.id === goalId) || null;
      if (!goal) return;
      activePrizeDeleteKind = 'goal';
      activeGoalId = goalId;
      button.closest('.snapshot-routine-shell')?.classList.remove('revealed');
      openPrizeDeleteModal('goal', String(goal.title || 'This team prize'), button);
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-goal-reset]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      event.stopPropagation();
      const goalId = button.dataset.goalReset || '';
      if (!goalId) return;
      void resetGoalContributions(goalId);
    });
  });
}

function bindStatsTabActions(state: DemoAppState): void {
  bindWeekReviewLaunch(document, state);
  document.querySelectorAll<HTMLElement>('[data-open-stats]').forEach(button => {
    button.addEventListener('click', () => {
      const kind = button.dataset.openStats === 'family' ? 'family' : 'kid';
      const memberId = button.dataset.statsMemberId || '';
      const side = button.dataset.statsSide === 'right' ? 'right' : 'left';
      openStatsModal(state, kind, memberId, side);
    });
  });
}

function bindLevelsTabActions(state: DemoAppState): void {
  document.querySelectorAll<HTMLInputElement>('[data-setting-toggle]').forEach(input => {
    input.addEventListener('change', () => void saveFamilySettingsPatch({ [input.dataset.settingToggle || '']: input.checked }));
  });
  document.querySelectorAll<HTMLInputElement>('[data-setting-number]').forEach(input => {
    input.addEventListener('change', () => {
      const key = input.dataset.settingNumber || '';
      const value = Math.max(0, Number(input.value) || 0);
      const normalized = key === 'comboMultiplier' ? Math.max(2, Math.min(10, value || 2)) : value;
      input.value = String(normalized);
      void saveFamilySettingsPatch({ [key]: normalized });
    });
  });
  document.querySelectorAll<HTMLInputElement>('[data-level-name]').forEach(input => {
    input.addEventListener('change', () => void saveLevelsFromDom());
  });
  document.querySelectorAll<HTMLInputElement>('[data-level-xp]').forEach(input => {
    input.addEventListener('change', () => void saveLevelsFromDom());
  });
  document.querySelectorAll<HTMLButtonElement>('[data-level-add]').forEach(button => button.addEventListener('click', () => void addLevel()));
  document.querySelectorAll<HTMLButtonElement>('[data-level-delete]').forEach(button => button.addEventListener('click', () => void deleteLevel(Number(button.dataset.levelDelete || 0))));
  document.querySelectorAll<HTMLButtonElement>('[data-level-reset]').forEach(button => button.addEventListener('click', () => void resetLevels()));
  document.querySelectorAll<HTMLButtonElement>('[data-level-icon]').forEach(button => {
    button.addEventListener('click', () => openIconPicker({ kind: 'level', a: Number(button.dataset.levelIcon || 0) }, button));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-base-badge-icon]').forEach(button => {
    button.addEventListener('click', () => openIconPicker({ kind: 'baseBadge', a: button.dataset.baseBadgeIcon || '' }, button));
  });
  document.querySelectorAll<HTMLSelectElement>('[data-combo-select]').forEach(select => {
    select.addEventListener('change', () => {
      const [kidId, slotIndex] = String(select.dataset.comboSelect || '').split(':');
      if (!kidId) return;
      if (!pendingComboOverrides[kidId]) pendingComboOverrides[kidId] = {};
      pendingComboOverrides[kidId][Number(slotIndex || 0)] = select.value;
      render();
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-combo-save]').forEach(button => {
    button.addEventListener('click', () => void saveComboOverride(String(button.dataset.comboSave || '')));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-task-badge-add]').forEach(button => {
    button.addEventListener('click', () => void addTaskBadge(Number(button.dataset.taskBadgeAdd || 0)));
  });
  document.querySelectorAll<HTMLButtonElement>('[data-task-badge-delete]').forEach(button => {
    button.addEventListener('click', () => {
      const [taskIndex, badgeIndex] = String(button.dataset.taskBadgeDelete || '0:0').split(':').map(Number);
      void deleteTaskBadge(taskIndex, badgeIndex);
    });
  });
  document.querySelectorAll<HTMLInputElement>('[data-task-badge-name],[data-task-badge-count]').forEach(input => {
    input.addEventListener('change', () => void saveTaskBadgesFromDom());
  });
  document.querySelectorAll<HTMLButtonElement>('[data-task-badge-secret]').forEach(button => {
    button.addEventListener('click', () => {
      const [taskIndex, badgeIndex] = String(button.dataset.taskBadgeSecret || '0:0').split(':').map(Number);
      void toggleTaskBadgeSecret(taskIndex, badgeIndex);
    });
  });
  document.querySelectorAll<HTMLButtonElement>('[data-task-badge-icon]').forEach(button => {
    button.addEventListener('click', () => {
      const [taskIndex, badgeIndex] = String(button.dataset.taskBadgeIcon || '0:0').split(':').map(Number);
      openIconPicker({ kind: 'taskBadge', a: taskIndex, b: badgeIndex }, button);
    });
  });
}

function bindOverviewSwipeDismiss(): void {
  if (overviewSwipeDismissBound) return;
  document.addEventListener('pointerdown', event => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('.snapshot-routine-shell')) closeAllSnapshotSwipes();
    if (!event.target.closest('.snapshot-summary-shell')) closeAllSnapshotSummaryReveals();
  }, true);
  overviewSwipeDismissBound = true;
}

function closeAllSnapshotSwipes(except: Element | null = null): void {
  document.querySelectorAll('.snapshot-routine-shell.revealed').forEach(node => {
    if (except && node === except) return;
    node.classList.remove('revealed');
  });
}

function closeAllSnapshotSummaryReveals(except: Element | null = null): void {
  document.querySelectorAll('.snapshot-summary-shell.revealed').forEach(node => {
    if (except && node === except) return;
    node.classList.remove('revealed');
  });
}

function handleSnapshotSwipeTap(event: MouseEvent): void {
  if (Date.now() < snapshotSwipeSuppressTapUntil) return;
  if ((event.target as Element | null)?.closest('.snapshot-routine-reveal')) return;
  const shell = (event.currentTarget as HTMLElement | null)?.closest('.snapshot-routine-shell');
  if (!shell) return;
  const willReveal = !shell.classList.contains('revealed');
  closeAllSnapshotSwipes(willReveal ? shell : null);
  shell.classList.toggle('revealed', willReveal);
}

function startSnapshotSwipe(event: PointerEvent): void {
  const shell = (event.currentTarget as HTMLElement | null)?.closest('.snapshot-routine-shell');
  if (!shell) return;
  const current = event.currentTarget as HTMLElement | null;
  current?.setPointerCapture?.(event.pointerId);
  snapshotSwipeSession = {
    shell,
    card: shell.querySelector<HTMLElement>('.snapshot-routine-card'),
    startX: event.clientX,
    startY: event.clientY,
    revealedAtStart: shell.classList.contains('revealed'),
    dragging: false,
    dx: 0,
  };
  closeAllSnapshotSwipes(shell);
}

function moveSnapshotSwipe(event: PointerEvent): void {
  if (!snapshotSwipeSession) return;
  const dx = event.clientX - snapshotSwipeSession.startX;
  const dy = event.clientY - snapshotSwipeSession.startY;
  if (!snapshotSwipeSession.dragging) {
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 0.18) return;
    snapshotSwipeSession.dragging = true;
  }
  const shell = snapshotSwipeSession.shell;
  const card = snapshotSwipeSession.card;
  const shift = parseFloat(getComputedStyle(shell as Element).getPropertyValue('--snapshot-reveal-shift')) || 100;
  const base = snapshotSwipeSession.revealedAtStart ? -shift : 0;
  const clampedDx = snapshotSwipeSession.revealedAtStart
    ? Math.max(shift * -0.2, Math.min(dx, shift))
    : Math.max(-shift, Math.min(dx, shift * 0.24));
  snapshotSwipeSession.dx = clampedDx;
  if (card) {
    card.style.transition = 'none';
    card.style.transform = `translateX(${base + clampedDx}px)`;
  }
  event.preventDefault();
}

function endSnapshotSwipe(event: PointerEvent): void {
  if (!snapshotSwipeSession) return;
  const dx = snapshotSwipeSession.dragging ? snapshotSwipeSession.dx : event.clientX - snapshotSwipeSession.startX;
  const shell = snapshotSwipeSession.shell;
  const card = snapshotSwipeSession.card;
  if (snapshotSwipeSession.dragging) {
    snapshotSwipeSuppressTapUntil = Date.now() + 320;
    if (dx < 0) {
      closeAllSnapshotSwipes(shell);
      shell.classList.add('revealed');
    } else if (dx > 0) {
      shell.classList.remove('revealed');
    } else {
      shell.classList.toggle('revealed', snapshotSwipeSession.revealedAtStart);
    }
  }
  requestAnimationFrame(() => {
    card?.style.removeProperty('transition');
    card?.style.removeProperty('transform');
  });
  snapshotSwipeSession = null;
}

function cancelSnapshotSwipe(): void {
  snapshotSwipeSession?.card?.style.removeProperty('transition');
  snapshotSwipeSession?.card?.style.removeProperty('transform');
  snapshotSwipeSession = null;
}

function handleSnapshotSummaryTap(event: MouseEvent): void {
  if (Date.now() < snapshotSwipeSuppressTapUntil) return;
  if ((event.target as Element | null)?.closest('.snapshot-summary-reveal')) return;
  const card = event.currentTarget as HTMLElement | null;
  const snapshotId = card?.dataset.summaryCard || '';
  const side = card?.dataset.summarySide === 'right' ? 'right' : 'left';
  if (!snapshotId) return;
  const state = useDevFirestore() ? firestoreState : readDemoAppState(store);
  if (!state) return;
  closeAllSnapshotSummaryReveals();
  openSnapshotModal(state, snapshotId, side);
}

function startSnapshotSummarySwipe(event: PointerEvent): void {
  const shell = (event.currentTarget as HTMLElement | null)?.closest('.snapshot-summary-shell');
  if (!shell) return;
  const current = event.currentTarget as HTMLElement | null;
  current?.setPointerCapture?.(event.pointerId);
  snapshotSummarySwipeSession = {
    shell,
    card: shell.querySelector<HTMLElement>('.snapshot-summary-card'),
    side: shell.getAttribute('data-side') === 'right' ? 'right' : 'left',
    startX: event.clientX,
    startY: event.clientY,
    revealedAtStart: shell.classList.contains('revealed'),
    dragging: false,
    dx: 0,
  };
  closeAllSnapshotSummaryReveals(shell);
}

function moveSnapshotSummarySwipe(event: PointerEvent): void {
  if (!snapshotSummarySwipeSession) return;
  const dx = event.clientX - snapshotSummarySwipeSession.startX;
  const dy = event.clientY - snapshotSummarySwipeSession.startY;
  if (!snapshotSummarySwipeSession.dragging) {
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
    snapshotSummarySwipeSession.dragging = true;
  }
  const side = snapshotSummarySwipeSession.side;
  const card = snapshotSummarySwipeSession.card;
  const shell = snapshotSummarySwipeSession.shell;
  const shift = parseFloat(getComputedStyle(shell as Element).getPropertyValue('--snapshot-summary-reveal-shift')) || 92;
  let base = 0;
  let clampedDx = 0;
  if (side === 'left') {
    base = snapshotSummarySwipeSession.revealedAtStart ? -shift : 0;
    clampedDx = snapshotSummarySwipeSession.revealedAtStart ? Math.max(shift * -0.2, Math.min(dx, shift)) : Math.max(-shift, Math.min(dx, shift * 0.24));
  } else {
    base = snapshotSummarySwipeSession.revealedAtStart ? shift : 0;
    clampedDx = snapshotSummarySwipeSession.revealedAtStart ? Math.min(shift * 0.2, Math.max(dx, -shift)) : Math.min(shift, Math.max(dx, shift * -0.24));
  }
  snapshotSummarySwipeSession.dx = clampedDx;
  if (card) {
    card.style.transition = 'none';
    card.style.transform = `translateX(${base + clampedDx}px)`;
  }
  event.preventDefault();
}

function endSnapshotSummarySwipe(event: PointerEvent): void {
  if (!snapshotSummarySwipeSession) return;
  const dx = snapshotSummarySwipeSession.dragging ? snapshotSummarySwipeSession.dx : event.clientX - snapshotSummarySwipeSession.startX;
  const side = snapshotSummarySwipeSession.side;
  const shell = snapshotSummarySwipeSession.shell;
  const card = snapshotSummarySwipeSession.card;
  if (snapshotSummarySwipeSession.dragging) {
    snapshotSwipeSuppressTapUntil = Date.now() + 320;
    const opening = side === 'left' ? dx < 0 : dx > 0;
    const closing = side === 'left' ? dx > 0 : dx < 0;
    if (opening) {
      closeAllSnapshotSummaryReveals(shell);
      shell.classList.add('revealed');
    } else if (closing) {
      shell.classList.remove('revealed');
    } else {
      shell.classList.toggle('revealed', snapshotSummarySwipeSession.revealedAtStart);
    }
  }
  requestAnimationFrame(() => {
    card?.style.removeProperty('transition');
    card?.style.removeProperty('transform');
  });
  snapshotSummarySwipeSession = null;
}

function cancelSnapshotSummarySwipe(): void {
  snapshotSummarySwipeSession?.card?.style.removeProperty('transition');
  snapshotSummarySwipeSession?.card?.style.removeProperty('transform');
  snapshotSummarySwipeSession = null;
}

function openSnapshotModal(state: DemoAppState, snapshotId: string, side: 'left' | 'right'): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = renderParentSnapshotModal(state, snapshotId, side);
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
}

function openStatsModal(state: DemoAppState, kind: 'family' | 'kid', memberId = '', side: 'left' | 'right' = 'left'): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  const panel = renderStatsDetailModal(state, kind, memberId, side);
  if (!panel) return;
  root.innerHTML = `
    <div class="modal-overlay snapshot-modal-overlay" data-modal-overlay>
      <div class="snapshot-panel snapshot-panel-${side} stats-detail-panel" role="dialog" aria-modal="true">
        ${panel}
      </div>
    </div>
  `;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
}

function openTaskModal(sourceButton: HTMLElement): void {
  if (!activeTaskEditorDraft || !activeTaskEditorMode) return;
  const root = document.getElementById('modal-root');
  if (!root) return;
  const rect = sourceButton.getBoundingClientRect();
  const state = currentDemoState();
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="--modal-origin-x:${rect.left + rect.width / 2}px;--modal-origin-y:${rect.top + rect.height / 2}px">
      <div class="modal quick-action-modal quick-action-modal-wide chore-editor-modal modal-origin-sheet" role="dialog" aria-modal="true">
        ${renderTaskEditorModal(state, activeTaskEditorDraft, activeTaskEditorMode)}
      </div>
    </div>
  `;
  bindTaskEditorModal();
}

function openDeleteTaskModal(task: DemoAppState['tasks'][number], sourceButton: HTMLElement): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  const rect = sourceButton.getBoundingClientRect();
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="--modal-origin-x:${rect.left + rect.width / 2}px;--modal-origin-y:${rect.top + rect.height / 2}px">
      <div class="modal quick-action-modal modal-origin-sheet" role="dialog" aria-modal="true">
        ${renderTaskDeleteModal(task)}
      </div>
    </div>
  `;
  bindTaskDeleteModal();
}

function openPrizeEditorModal(sourceButton: HTMLElement): void {
  if (!activePrizeEditorDraft) return;
  const root = document.getElementById('modal-root');
  if (!root) return;
  const rect = sourceButton.getBoundingClientRect();
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="--modal-origin-x:${rect.left + rect.width / 2}px;--modal-origin-y:${rect.top + rect.height / 2}px">
      <div class="modal quick-action-modal quick-action-modal-wide prize-editor-modal modal-origin-sheet" role="dialog" aria-modal="true">
        ${renderPrizeEditorModal(currentDemoState(), activePrizeEditorDraft)}
      </div>
    </div>
  `;
  bindPrizeEditorModal();
}

function openGoalEditorModal(sourceButton: HTMLElement): void {
  if (!activeGoalEditorDraft) return;
  const root = document.getElementById('modal-root');
  if (!root) return;
  const rect = sourceButton.getBoundingClientRect();
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="--modal-origin-x:${rect.left + rect.width / 2}px;--modal-origin-y:${rect.top + rect.height / 2}px">
      <div class="modal quick-action-modal quick-action-modal-wide prize-editor-modal modal-origin-sheet" role="dialog" aria-modal="true">
        ${renderGoalEditorModal(activeGoalEditorDraft)}
      </div>
    </div>
  `;
  bindGoalEditorModal();
}

function openPrizeDeleteModal(kind: 'prize' | 'goal', title: string, sourceButton: HTMLElement): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  const rect = sourceButton.getBoundingClientRect();
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="--modal-origin-x:${rect.left + rect.width / 2}px;--modal-origin-y:${rect.top + rect.height / 2}px">
      <div class="modal quick-action-modal modal-origin-sheet" role="dialog" aria-modal="true">
        ${renderPrizeDeleteModal(kind, title)}
      </div>
    </div>
  `;
  bindPrizeDeleteModal();
}

function openIconPicker(target: { kind: 'level' | 'baseBadge' | 'taskBadge'; a: number | string; b?: number }, sourceButton: HTMLElement): void {
  activeIconPicker = target;
  const root = document.getElementById('modal-root');
  if (!root) return;
  const rect = sourceButton.getBoundingClientRect();
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="--modal-origin-x:${rect.left + rect.width / 2}px;--modal-origin-y:${rect.top + rect.height / 2}px">
      <div class="modal quick-action-modal modal-origin-sheet" role="dialog" aria-modal="true">
        <button class="modal-close-x" data-close-modal type="button" aria-label="Close"><i class="ph-duotone ph-x"></i></button>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:8px">
          ${LEVEL_ICON_OPTIONS.map((opt, index) => `<button data-icon-pick="${index}" title="${opt.label}" type="button" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;padding:6px;cursor:pointer;display:flex;align-items:center;justify-content:center;width:44px;height:44px">${opt.html}</button>`).join('')}
        </div>
      </div>
    </div>
  `;
  bindIconPickerModal();
}

function bindTaskEditorModal(): void {
  const root = document.getElementById('modal-root');
  if (!root || !activeTaskEditorDraft || !activeTaskEditorMode) return;
  const editorMode = activeTaskEditorMode;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelectorAll<HTMLButtonElement>('[data-task-color]').forEach(button => {
    button.addEventListener('click', () => {
      activeTaskEditorDraft = readTaskEditorDraftFromDom() || activeTaskEditorDraft;
      if (!activeTaskEditorDraft) return;
      activeTaskEditorDraft.iconColor = button.dataset.taskColor || activeTaskEditorDraft.iconColor;
      rerenderTaskEditorModal(editorMode);
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-task-icon]').forEach(button => {
    button.addEventListener('click', () => {
      activeTaskEditorDraft = readTaskEditorDraftFromDom() || activeTaskEditorDraft;
      if (!activeTaskEditorDraft) return;
      activeTaskEditorDraft.icon = button.dataset.taskIcon || activeTaskEditorDraft.icon;
      rerenderTaskEditorModal(editorMode);
    });
  });
  root.querySelector<HTMLButtonElement>('[data-task-save]')?.addEventListener('click', () => void saveTaskDraft());
}

function rerenderTaskEditorModal(editorMode: 'create' | 'edit'): void {
  const root = document.getElementById('modal-root');
  const overlayStyle = root?.querySelector<HTMLElement>('[data-modal-overlay]')?.getAttribute('style') || '';
  if (!root || !activeTaskEditorDraft) return;
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay" data-modal-overlay style="${overlayStyle}">
      <div class="modal quick-action-modal quick-action-modal-wide chore-editor-modal" role="dialog" aria-modal="true">
        ${renderTaskEditorModal(currentDemoState(), activeTaskEditorDraft, editorMode)}
      </div>
    </div>
  `;
  bindTaskEditorModal();
}

function bindTaskDeleteModal(): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelector<HTMLButtonElement>('[data-task-confirm-delete]')?.addEventListener('click', () => void deleteActiveTask());
}

function bindPrizeEditorModal(): void {
  const root = document.getElementById('modal-root');
  if (!root || !activePrizeEditorDraft) return;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelectorAll<HTMLButtonElement>('[data-prize-color]').forEach(button => {
    button.addEventListener('click', () => {
      activePrizeEditorDraft = readPrizeEditorDraftFromDom() || activePrizeEditorDraft;
      if (!activePrizeEditorDraft) return;
      activePrizeEditorDraft.iconColor = button.dataset.prizeColor || activePrizeEditorDraft.iconColor;
      rerenderPrizeEditorModal();
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-prize-icon]').forEach(button => {
    button.addEventListener('click', () => {
      activePrizeEditorDraft = readPrizeEditorDraftFromDom() || activePrizeEditorDraft;
      if (!activePrizeEditorDraft) return;
      activePrizeEditorDraft.icon = button.dataset.prizeIcon || activePrizeEditorDraft.icon;
      rerenderPrizeEditorModal();
    });
  });
  root.querySelector<HTMLInputElement>('#prize-requirement-enabled')?.addEventListener('change', () => {
    activePrizeEditorDraft = readPrizeEditorDraftFromDom() || activePrizeEditorDraft;
    syncPrizeRequirementUi();
  });
  root.querySelector<HTMLSelectElement>('#prize-requirement-type')?.addEventListener('change', () => {
    activePrizeEditorDraft = readPrizeEditorDraftFromDom() || activePrizeEditorDraft;
    syncPrizeRequirementUi();
  });
  syncPrizeRequirementUi();
  root.querySelector<HTMLButtonElement>('[data-prize-save]')?.addEventListener('click', () => void savePrizeDraft());
}

function syncPrizeRequirementUi(): void {
  const enabled = !!(document.getElementById('prize-requirement-enabled') as HTMLInputElement | null)?.checked;
  const type = (document.getElementById('prize-requirement-type') as HTMLSelectElement | null)?.value || 'task_count';
  const fields = document.getElementById('prize-requirement-fields');
  const countWrap = document.getElementById('prize-task-count-wrap');
  const specificWrap = document.getElementById('prize-specific-tasks-wrap');
  if (fields) fields.style.display = enabled ? 'block' : 'none';
  if (countWrap) countWrap.style.display = enabled && type === 'task_count' ? 'block' : 'none';
  if (specificWrap) specificWrap.style.display = enabled && type === 'specific_tasks' ? 'block' : 'none';
}

function bindGoalEditorModal(): void {
  const root = document.getElementById('modal-root');
  if (!root || !activeGoalEditorDraft) return;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelectorAll<HTMLButtonElement>('[data-goal-color]').forEach(button => {
    button.addEventListener('click', () => {
      activeGoalEditorDraft = readGoalEditorDraftFromDom() || activeGoalEditorDraft;
      if (!activeGoalEditorDraft) return;
      activeGoalEditorDraft.iconColor = button.dataset.goalColor || activeGoalEditorDraft.iconColor;
      rerenderGoalEditorModal();
    });
  });
  root.querySelectorAll<HTMLButtonElement>('[data-goal-icon]').forEach(button => {
    button.addEventListener('click', () => {
      activeGoalEditorDraft = readGoalEditorDraftFromDom() || activeGoalEditorDraft;
      if (!activeGoalEditorDraft) return;
      activeGoalEditorDraft.icon = button.dataset.goalIcon || activeGoalEditorDraft.icon;
      rerenderGoalEditorModal();
    });
  });
  root.querySelector<HTMLButtonElement>('[data-goal-save]')?.addEventListener('click', () => void saveGoalDraft());
}

function bindPrizeDeleteModal(): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelector<HTMLButtonElement>('[data-prize-delete-confirm]')?.addEventListener('click', () => {
    if (activePrizeDeleteKind === 'goal') void deleteActiveGoal();
    else void deleteActivePrize();
  });
}

function bindIconPickerModal(): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelectorAll<HTMLButtonElement>('[data-icon-pick]').forEach(button => {
    button.addEventListener('click', () => void applyPickedIcon(Number(button.dataset.iconPick || 0)));
  });
}

function rerenderPrizeEditorModal(): void {
  const root = document.getElementById('modal-root');
  const overlayStyle = root?.querySelector<HTMLElement>('[data-modal-overlay]')?.getAttribute('style') || '';
  if (!root || !activePrizeEditorDraft) return;
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay" data-modal-overlay style="${overlayStyle}">
      <div class="modal quick-action-modal quick-action-modal-wide prize-editor-modal" role="dialog" aria-modal="true">
        ${renderPrizeEditorModal(currentDemoState(), activePrizeEditorDraft)}
      </div>
    </div>
  `;
  bindPrizeEditorModal();
}

function rerenderGoalEditorModal(): void {
  const root = document.getElementById('modal-root');
  const overlayStyle = root?.querySelector<HTMLElement>('[data-modal-overlay]')?.getAttribute('style') || '';
  if (!root || !activeGoalEditorDraft) return;
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay" data-modal-overlay style="${overlayStyle}">
      <div class="modal quick-action-modal quick-action-modal-wide prize-editor-modal" role="dialog" aria-modal="true">
        ${renderGoalEditorModal(activeGoalEditorDraft)}
      </div>
    </div>
  `;
  bindGoalEditorModal();
}

function readTaskEditorDraftFromDom(): ParentTaskEditorDraft | null {
  if (!activeTaskEditorDraft) return null;
  const title = (document.getElementById('task-title') as HTMLInputElement | null)?.value.trim() || '';
  const gems = Math.max(1, Number((document.getElementById('task-gems') as HTMLInputElement | null)?.value || activeTaskEditorDraft.gems) || activeTaskEditorDraft.gems);
  const photoMode = (document.getElementById('task-photo-mode') as HTMLSelectElement | null)?.value || activeTaskEditorDraft.photoMode;
  const description = (document.getElementById('task-description') as HTMLTextAreaElement | null)?.value || '';
  const assignedTo = [...document.querySelectorAll<HTMLInputElement>('[data-task-assign]:checked')].map(input => input.value);
  return {
    ...activeTaskEditorDraft,
    title,
    gems,
    photoMode,
    description,
    assignedTo,
  };
}

function readPrizeEditorDraftFromDom(): ParentPrizeEditorDraft | null {
  if (!activePrizeEditorDraft) return null;
  const requirementEnabled = !!(document.getElementById('prize-requirement-enabled') as HTMLInputElement | null)?.checked;
  const requirementType = (document.getElementById('prize-requirement-type') as HTMLSelectElement | null)?.value || activePrizeEditorDraft.requirementType;
  return {
    ...activePrizeEditorDraft,
    title: (document.getElementById('prize-title') as HTMLInputElement | null)?.value.trim() || '',
    cost: Math.max(0, Number((document.getElementById('prize-cost') as HTMLInputElement | null)?.value || activePrizeEditorDraft.cost) || activePrizeEditorDraft.cost),
    recurrence: (document.getElementById('prize-recurrence') as HTMLSelectElement | null)?.value || activePrizeEditorDraft.recurrence,
    requireParentApproval: !!(document.getElementById('prize-parent-approval') as HTMLInputElement | null)?.checked,
    requirementEnabled,
    requirementType,
    requirementTaskCount: Math.max(1, Number((document.getElementById('prize-task-count') as HTMLInputElement | null)?.value || activePrizeEditorDraft.requirementTaskCount) || activePrizeEditorDraft.requirementTaskCount),
    requirementTaskIds: [...document.querySelectorAll<HTMLInputElement>('.prize-task-check:checked')].map(input => input.value),
  };
}

function readGoalEditorDraftFromDom(): ParentGoalEditorDraft | null {
  if (!activeGoalEditorDraft) return null;
  return {
    ...activeGoalEditorDraft,
    title: (document.getElementById('goal-title') as HTMLInputElement | null)?.value.trim() || '',
    targetPoints: Math.max(1, Number((document.getElementById('goal-target') as HTMLInputElement | null)?.value || activeGoalEditorDraft.targetPoints) || activeGoalEditorDraft.targetPoints),
  };
}

function currentSettings(): DemoAppState['settings'] {
  return currentDemoState().settings || {};
}

function shouldRerenderSettingsPaneForPatch(settingsPatch: Record<string, unknown>): boolean {
  const rerenderKeys = new Set([
    'savingsEnabled',
    'savingsMatchingEnabled',
    'savingsInterestEnabled',
    'savingsInterestPeriod',
    'notListeningEnabled',
    'parentPin',
    'lockOnBackground',
  ]);
  return Object.keys(settingsPatch).some(key => rerenderKeys.has(key));
}

async function saveFamilySettingsPatch(settingsPatch: Record<string, unknown>): Promise<void> {
  const nextSettings = { ...currentSettings(), ...settingsPatch };
  const shouldRerenderSettings = shouldRerenderSettingsPaneForPatch(settingsPatch);
  const settingsScrollTop = document.querySelector<HTMLElement>('#settings-root .settings-subpane')?.scrollTop || 0;
  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    let saved = false;
    firestoreState = { ...(firestoreState as DemoAppState), settings: nextSettings };
    void renderDevFirestore();
    try {
      const { commitDevFamilyWrite } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevFamilyWrite({ data: { settings: nextSettings } });
      saved = true;
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
    } finally {
      void renderDevFirestore();
      if (shouldRerenderSettings) rerenderSettingsPane(settingsScrollTop);
    }
    if (saved) applyNotificationSettingsEffects(settingsPatch, nextSettings);
    return;
  }
  const family = store.get<Record<string, unknown>>(familyPath(LAB_FAMILY_ID)) || {};
  store.set(familyPath(LAB_FAMILY_ID), { ...family, settings: nextSettings });
  saveSharedLabStore(store);
  render();
  if (shouldRerenderSettings) rerenderSettingsPane(settingsScrollTop);
  applyNotificationSettingsEffects(settingsPatch, nextSettings);
}

function applyNotificationSettingsEffects(settingsPatch: Record<string, unknown>, settings: DemoAppState['settings']): void {
  const changed = new Set(Object.keys(settingsPatch));
  if (changed.has('notifyChoreApproval') || changed.has('notifySavingsSpend')) {
    if (settings.notifyChoreApproval !== false || settings.notifySavingsSpend !== false) {
      void ensureParentPushRegistration(settings);
    }
  }
  if (
    changed.has('interestDayNotify')
    || changed.has('savingsInterestEnabled')
    || changed.has('savingsEnabled')
    || changed.has('savingsInterestPeriod')
    || changed.has('savingsInterestDay')
    || changed.has('savingsInterestDayOfMonth')
  ) {
    void scheduleInterestDayNotification(settings);
  }
}

async function ensureParentPushRegistration(settings = currentSettings()): Promise<void> {
  const state = currentDemoState();
  const parent = getActiveViewer(state)?.role === 'parent'
    ? getActiveViewer(state)
    : state.members.find(member => member.role === 'parent') || null;
  await registerParentPushNotifications({
    userId: String(parent?.id || ''),
    familyId: String(state.familyId || (useDevFirestore() ? DEV_FIRESTORE_FAMILY_ID : LAB_FAMILY_ID)),
    memberId: String(parent?.id || ''),
    notifyChoreApproval: settings.notifyChoreApproval !== false,
    notifySavingsSpend: settings.notifySavingsSpend !== false,
    saveToken: async (token, metadata) => {
      window.localStorage.setItem('gemsprout.v2.devPushToken', JSON.stringify({ token, metadata }));
      await savePushTokenForSignedInUser(token, metadata as Record<string, unknown>);
    },
    onForegroundNotification: event => {
      void handleParentNotificationEvent(event, { openInbox: false });
    },
    onNotificationAction: event => {
      void handleParentNotificationEvent(event, { openInbox: true });
    },
  });
}

function maybeEnsureParentPushRegistration(state: DemoAppState, parent: DemoMember): void {
  const settings = state.settings || {};
  if (settings.notifyChoreApproval === false && settings.notifySavingsSpend === false) return;
  const key = `${state.familyId || DEV_FIRESTORE_FAMILY_ID}:${parent.id || ''}:${settings.notifyChoreApproval !== false}:${settings.notifySavingsSpend !== false}`;
  if (parentPushRegistrationKey === key) return;
  parentPushRegistrationKey = key;
  void ensureParentPushRegistration(settings);
}

async function handleParentNotificationEvent(event: unknown, options: { openInbox: boolean }): Promise<void> {
  if (!useDevFirestore()) return;
  if (options.openInbox) {
    const state = currentDemoState();
    const parent = state.members.find(member => member.role === 'parent') || null;
    if (parent?.id) activeViewerMemberId = String(parent.id);
    activeParentTab = 'overview';
  }
  await refreshDevFirestoreState({ rerender: true });
  if (options.openInbox) {
    requestAnimationFrame(() => {
      document.getElementById('family-inbox-section')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }
}

async function scheduleInterestDayNotification(settings = currentSettings()): Promise<void> {
  const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { LocalNotifications?: { cancel?: (input: unknown) => Promise<void>; schedule?: (input: unknown) => Promise<void> } } } }).Capacitor;
  if (!capacitor?.isNativePlatform?.()) return;
  const localNotifications = capacitor.Plugins?.LocalNotifications;
  if (!localNotifications?.schedule) return;
  await localNotifications.cancel?.({ notifications: [{ id: 1001 }] }).catch(() => undefined);
  if (settings.interestDayNotify === false || settings.savingsInterestEnabled !== true || settings.savingsEnabled === false) return;
  const hasSavings = currentDemoState().members.some(member => member.role === 'kid' && !member.deleted && Number(member.savings || 0) > 0);
  if (!hasSavings) return;
  const at = getNextInterestDayDate(settings);
  if (at <= new Date()) return;
  await localNotifications.schedule({
    notifications: [{
      id: 1001,
      title: 'Interest Day! Time to claim savings',
      body: 'Have your kids open GemSprout to claim their savings interest',
      schedule: { at },
      badge: 0,
    }],
  }).catch(() => undefined);
}

function getNextInterestDayDate(settings: DemoAppState['settings']): Date {
  const now = new Date();
  const date = new Date(now);
  date.setHours(9, 0, 0, 0);
  if (String(settings.savingsInterestPeriod || 'monthly') === 'weekly') {
    const target = Number(settings.savingsInterestDay ?? 1);
    let daysUntil = (target - date.getDay() + 7) % 7;
    if (daysUntil === 0 && now >= date) daysUntil = 7;
    date.setDate(date.getDate() + daysUntil);
    return date;
  }
  const dayOfMonth = Math.min(28, Math.max(1, Number(settings.savingsInterestDayOfMonth || 1)));
  date.setDate(dayOfMonth);
  if (date <= now) {
    date.setMonth(date.getMonth() + 1);
    date.setDate(dayOfMonth);
  }
  return date;
}

async function sendParentApprovalPush(input: { memberId: string; title: string; kind: 'chore_request' | 'prize_request' }): Promise<void> {
  const state = currentDemoState();
  if (state.settings.notifyChoreApproval === false) return;
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const member = state.members.find(item => item.id === input.memberId);
    const sendApprovalNotification = httpsCallable(getFunctions(), 'sendApprovalNotification');
    await sendApprovalNotification({
      familyCode: String(state.familyCode || ''),
      familyId: String(state.familyId || (useDevFirestore() ? DEV_FIRESTORE_FAMILY_ID : LAB_FAMILY_ID)),
      kidName: String(member?.name || 'A kid'),
      choreName: input.title,
      prizeName: input.title,
      pendingCount: pendingCount(state),
      notificationType: input.kind,
    });
  } catch {
    // Native push is best-effort here; browser/dev runs should stay quiet.
  }
}

async function sendSavingsSpendPush(input: { memberId: string; amount: number; reason: string }): Promise<void> {
  const state = currentDemoState();
  if (state.settings.notifySavingsSpend === false) return;
  try {
    const { getFunctions, httpsCallable } = await import('firebase/functions');
    const member = state.members.find(item => item.id === input.memberId);
    const sendSpendNotification = httpsCallable(getFunctions(), 'sendSpendNotification');
    await sendSpendNotification({
      familyCode: String(state.familyCode || ''),
      familyId: String(state.familyId || (useDevFirestore() ? DEV_FIRESTORE_FAMILY_ID : LAB_FAMILY_ID)),
      kidName: String(member?.name || 'A kid'),
      amount: input.amount,
      reason: input.reason || '',
      pendingCount: pendingCount(state),
    });
  } catch {
    // Native push is best-effort here; browser/dev runs should stay quiet.
  }
}

async function saveMemberPatch(memberId: string, patch: Record<string, unknown>, options: { rerenderSettings?: boolean; rerenderApp?: boolean } = {}): Promise<void> {
  if (!memberId) return;
  const shouldRerenderSettings = options.rerenderSettings ?? true;
  const shouldRerenderApp = options.rerenderApp ?? true;
  const settingsScrollTop = document.querySelector<HTMLElement>('#settings-root .settings-subpane')?.scrollTop || 0;
  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    firestoreState = {
      ...(firestoreState as DemoAppState),
      members: (firestoreState as DemoAppState).members.map(member => member.id === memberId ? { ...member, ...patch } : member),
    };
    if ((firestoreState as DemoAppState).member?.id === memberId) {
      firestoreState = {
        ...(firestoreState as DemoAppState),
        member: { ...((firestoreState as DemoAppState).member as DemoMember), ...patch },
      };
    }
    if (shouldRerenderApp) void renderDevFirestore();
    try {
      const { commitDevMemberWrite } = await import('../platform/firebase/dev-firestore-operations.js');
      const existing = previous?.members.find(member => member.id === memberId) || {};
      await commitDevMemberWrite({ memberId, data: { ...existing, ...patch } });
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
      void renderDevFirestore();
    } finally {
      if (shouldRerenderApp) void renderDevFirestore();
      if (shouldRerenderSettings) rerenderSettingsPane(settingsScrollTop);
    }
    return;
  }
  const existing = store.get<Record<string, unknown>>(memberPath(LAB_FAMILY_ID, memberId)) || {};
  store.set(memberPath(LAB_FAMILY_ID, memberId), { ...existing, ...patch });
  saveSharedLabStore(store);
  if (shouldRerenderApp) render();
  if (shouldRerenderSettings) rerenderSettingsPane(settingsScrollTop);
}

function taskDocFromDraft(state: DemoAppState, draft: ParentTaskEditorDraft, taskId: string): Record<string, unknown> {
  const existing = state.tasks.find(task => task.id === taskId);
  return {
    ...(existing || {}),
    id: taskId,
    familyId: useDevFirestore() ? DEV_FIRESTORE_FAMILY_ID : LAB_FAMILY_ID,
    title: draft.title || 'Untitled task',
    icon: draft.icon,
    iconColor: draft.iconColor,
    gems: draft.gems,
    diamonds: draft.gems,
    assignedTo: draft.assignedTo,
    description: draft.description,
    photoMode: draft.photoMode,
    schedule: existing?.schedule || { period: 'day', targetCount: 1, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], windows: {} },
  };
}

async function saveTaskDraft(): Promise<void> {
  const draft = readTaskEditorDraftFromDom();
  if (!draft) return;
  const state = currentDemoState();
  const taskId = activeTaskId || `task_${Date.now()}`;
  const docData = taskDocFromDraft(state, draft, taskId);
  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    firestoreState = {
      ...(firestoreState as DemoAppState),
      tasks: upsertTaskList((firestoreState as DemoAppState).tasks, docData),
    };
    closeModal();
    void renderDevFirestore();
    try {
      const { commitDevTaskWrite } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevTaskWrite({ taskId, data: docData });
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
    } finally {
      void renderDevFirestore();
    }
    return;
  }
  store.set(chorePath(LAB_FAMILY_ID, taskId), docData);
  saveSharedLabStore(store);
  activeTaskEditorDraft = null;
  activeTaskEditorMode = null;
  activeTaskId = null;
  closeModal();
  render();
}

function upsertTaskList(tasks: DemoAppState['tasks'], docData: Record<string, unknown>): DemoAppState['tasks'] {
  const next = tasks.filter(task => task.id !== String(docData.id || ''));
  next.push(docData as DemoAppState['tasks'][number]);
  return next.sort((left, right) => {
    const byGems = Number(left.gems ?? left.diamonds ?? 0) - Number(right.gems ?? right.diamonds ?? 0);
    if (byGems !== 0) return byGems;
    return String(left.title || '').localeCompare(String(right.title || ''));
  });
}

async function deleteActiveTask(): Promise<void> {
  const taskId = activeTaskId || '';
  if (!taskId) return;
  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    firestoreState = {
      ...(firestoreState as DemoAppState),
      tasks: (firestoreState as DemoAppState).tasks.filter(task => task.id !== taskId),
    };
    closeModal();
    void renderDevFirestore();
    try {
      const { commitDevTaskDelete } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevTaskDelete({ taskId });
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
    } finally {
      void renderDevFirestore();
    }
    return;
  }
  store.set(chorePath(LAB_FAMILY_ID, taskId), null);
  saveSharedLabStore(store);
  activeTaskId = null;
  closeModal();
  render();
}

function upsertPrizeList(prizes: DemoAppState['prizes'], docData: Record<string, unknown>): DemoAppState['prizes'] {
  const next = prizes.filter(prize => prize.id !== String(docData.id || ''));
  next.push(docData as DemoAppState['prizes'][number]);
  return next.sort((left, right) => {
    const byCost = Number(left.cost || 0) - Number(right.cost || 0);
    if (byCost !== 0) return byCost;
    return String(left.title || '').localeCompare(String(right.title || ''));
  });
}

function upsertGoalList(goals: DemoAppState['teamGoals'], goalData: Record<string, unknown>): DemoAppState['teamGoals'] {
  const next = goals.filter(goal => goal.id !== String(goalData.id || ''));
  next.push(goalData as DemoAppState['teamGoals'][number]);
  return next.sort((left, right) => {
    const byTarget = Number(left.targetPoints || 0) - Number(right.targetPoints || 0);
    if (byTarget !== 0) return byTarget;
    return String(left.title || '').localeCompare(String(right.title || ''));
  });
}

async function savePrizeDraft(): Promise<void> {
  const draft = readPrizeEditorDraftFromDom();
  if (!draft) return;
  const state = currentDemoState();
  const prizeId = activePrizeId || `prize_${Date.now()}`;
  const existing = state.prizes.find(prize => prize.id === prizeId);
  const docData: Record<string, unknown> = {
    ...(existing || {}),
    id: prizeId,
    familyId: useDevFirestore() ? DEV_FIRESTORE_FAMILY_ID : LAB_FAMILY_ID,
    title: draft.title || 'Untitled prize',
    icon: draft.icon,
    iconColor: draft.iconColor,
    type: 'individual',
    cost: draft.cost,
    recurrence: draft.recurrence,
    requireParentApproval: draft.requireParentApproval,
    requirementType: draft.requirementEnabled ? draft.requirementType : 'none',
    requirementTaskCount: draft.requirementTaskCount,
    requirementTaskIds: draft.requirementEnabled ? draft.requirementTaskIds : [],
    redemptions: existing?.redemptions || [],
  };
  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    firestoreState = { ...(firestoreState as DemoAppState), prizes: upsertPrizeList((firestoreState as DemoAppState).prizes, docData) };
    closeModal();
    void renderDevFirestore();
    try {
      const { commitDevPrizeWrite } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevPrizeWrite({ prizeId, data: docData });
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
    } finally {
      void renderDevFirestore();
    }
    return;
  }
  store.set(prizePath(LAB_FAMILY_ID, prizeId), docData);
  saveSharedLabStore(store);
  closeModal();
  render();
}

async function saveGoalDraft(): Promise<void> {
  const draft = readGoalEditorDraftFromDom();
  if (!draft) return;
  const state = currentDemoState();
  const goalId = activeGoalId || `goal_${Date.now()}`;
  const existing = state.teamGoals.find(goal => goal.id === goalId);
  const goalData: Record<string, unknown> = {
    ...(existing || {}),
    id: goalId,
    title: draft.title || 'Untitled team prize',
    icon: draft.icon,
    iconColor: draft.iconColor,
    targetPoints: draft.targetPoints,
    contributions: existing?.contributions || {},
  };
  const nextGoals = upsertGoalList(state.teamGoals, goalData);
  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    firestoreState = { ...(firestoreState as DemoAppState), teamGoals: nextGoals };
    closeModal();
    void renderDevFirestore();
    try {
      const { commitDevTeamGoalsWrite } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevTeamGoalsWrite({ teamGoals: nextGoals });
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
    } finally {
      void renderDevFirestore();
    }
    return;
  }
  const family = store.get<Record<string, unknown>>(familyPath(LAB_FAMILY_ID)) || {};
  store.set(familyPath(LAB_FAMILY_ID), { ...family, teamGoals: nextGoals });
  saveSharedLabStore(store);
  closeModal();
  render();
}

async function deleteActivePrize(): Promise<void> {
  const prizeId = activePrizeId || '';
  if (!prizeId) return;
  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    firestoreState = { ...(firestoreState as DemoAppState), prizes: (firestoreState as DemoAppState).prizes.filter(prize => prize.id !== prizeId) };
    closeModal();
    void renderDevFirestore();
    try {
      const { commitDevPrizeDelete } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevPrizeDelete({ prizeId });
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
    } finally {
      void renderDevFirestore();
    }
    return;
  }
  store.set(prizePath(LAB_FAMILY_ID, prizeId), null);
  saveSharedLabStore(store);
  closeModal();
  render();
}

async function deleteActiveGoal(): Promise<void> {
  const goalId = activeGoalId || '';
  if (!goalId) return;
  const state = currentDemoState();
  const nextGoals = state.teamGoals.filter(goal => goal.id !== goalId);
  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    firestoreState = { ...(firestoreState as DemoAppState), teamGoals: nextGoals };
    closeModal();
    void renderDevFirestore();
    try {
      const { commitDevTeamGoalsWrite } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevTeamGoalsWrite({ teamGoals: nextGoals });
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
    } finally {
      void renderDevFirestore();
    }
    return;
  }
  const family = store.get<Record<string, unknown>>(familyPath(LAB_FAMILY_ID)) || {};
  store.set(familyPath(LAB_FAMILY_ID), { ...family, teamGoals: nextGoals });
  saveSharedLabStore(store);
  closeModal();
  render();
}

async function resetPrizeRedemptions(prizeId: string): Promise<void> {
  const state = currentDemoState();
  const prize = state.prizes.find(item => item.id === prizeId);
  if (!prize) return;
  const docData = { ...prize, redemptions: [] };
  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    firestoreState = { ...(firestoreState as DemoAppState), prizes: upsertPrizeList((firestoreState as DemoAppState).prizes, docData) };
    void renderDevFirestore();
    try {
      const { commitDevPrizeWrite } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevPrizeWrite({ prizeId, data: docData });
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
    } finally {
      void renderDevFirestore();
    }
    return;
  }
  store.set(prizePath(LAB_FAMILY_ID, prizeId), docData);
  saveSharedLabStore(store);
  render();
}

async function resetGoalContributions(goalId: string): Promise<void> {
  const state = currentDemoState();
  const goal = state.teamGoals.find(item => item.id === goalId);
  if (!goal) return;
  const nextGoals = upsertGoalList(state.teamGoals, { ...goal, contributions: {} });
  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    firestoreState = { ...(firestoreState as DemoAppState), teamGoals: nextGoals };
    void renderDevFirestore();
    try {
      const { commitDevTeamGoalsWrite } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevTeamGoalsWrite({ teamGoals: nextGoals });
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
    } finally {
      void renderDevFirestore();
    }
    return;
  }
  const family = store.get<Record<string, unknown>>(familyPath(LAB_FAMILY_ID)) || {};
  store.set(familyPath(LAB_FAMILY_ID), { ...family, teamGoals: nextGoals });
  saveSharedLabStore(store);
  render();
}

async function saveLevelsFromDom(): Promise<void> {
  const levels = getLevels(currentSettings()).map((level, index) => ({
    ...level,
    level: index + 1,
    name: (document.querySelector<HTMLInputElement>(`[data-level-name="${index}"]`)?.value || level.name || '').trim() || `Level ${index + 1}`,
    minXp: index === 0 ? 0 : Math.max(1, Number(document.querySelector<HTMLInputElement>(`[data-level-xp="${index}"]`)?.value || level.minXp || 0)),
  }));
  for (let i = 1; i < levels.length; i += 1) {
    if (Number(levels[i].minXp || 0) <= Number(levels[i - 1].minXp || 0)) levels[i].minXp = Number(levels[i - 1].minXp || 0) + 1;
  }
  await saveFamilySettingsPatch({ customLevels: levels });
}

async function addLevel(): Promise<void> {
  const levels = getLevels(currentSettings()).map(level => ({ ...level }));
  const last = levels[levels.length - 1];
  levels.push({ level: levels.length + 1, name: 'New Level', icon: '<i class="ph-duotone ph-star" style="color:#F59E0B;font-size:1em"></i>', minXp: Number(last.minXp || 0) + 200 });
  await saveFamilySettingsPatch({ customLevels: levels });
}

async function deleteLevel(index: number): Promise<void> {
  const levels = getLevels(currentSettings()).map(level => ({ ...level }));
  if (levels.length <= 2) return;
  levels.splice(index, 1);
  levels.forEach((level, idx) => { level.level = idx + 1; });
  await saveFamilySettingsPatch({ customLevels: levels });
}

async function resetLevels(): Promise<void> {
  await saveFamilySettingsPatch({ customLevels: null });
}

async function saveComboOverride(kidId: string, force = false): Promise<void> {
  if (!kidId) return;
  const state = currentDemoState();
  const today = todayKeyForApp();
  const pending = pendingComboOverrides[kidId] || {};
  const currentCombo = getDailyComboIdsForMember({ members: state.members, tasks: state.tasks, settings: state.settings }, kidId, today);
  const finalIds = [0, 1, 2].map(index => pending[index] || currentCombo[index]).filter(Boolean);
  const member = state.members.find(item => item.id === kidId);
  if (!member || finalIds.length < 3) return;
  if (!force && member.comboBonusDate !== today && areComboTasksComplete(state, kidId, finalIds, today)) {
    openComboWillCompleteModal(member, finalIds);
    return;
  }
  pendingComboOverrides = { ...pendingComboOverrides };
  delete pendingComboOverrides[kidId];
  const comboOverrides = {
    ...(currentSettings().comboOverrides || {}),
    [kidId]: { date: today, ids: finalIds },
  };
  await saveFamilySettingsPatch({ comboOverrides });
  await awardSavedComboIfComplete(kidId, finalIds, today);
}

function openComboWillCompleteModal(member: DemoMember, finalIds: string[]): void {
  const state = currentDemoState();
  const baseSum = finalIds.reduce((sum, taskId) => {
    const task = state.tasks.find(item => item.id === taskId);
    return sum + Number(task?.gems ?? task?.diamonds ?? 0);
  }, 0);
  const bonusGems = Math.max(1, Number(state.settings.comboMultiplier || 2) - 1) * baseSum;
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay" data-modal-overlay>
      <div class="modal quick-action-modal" role="dialog" aria-modal="true">
        <div class="modal-title"><i class="ph-duotone ph-lightning" style="color:#F59E0B;vertical-align:middle"></i> Combo Will Complete!</div>
        <p style="font-size:0.9rem;color:var(--muted);margin:0 0 16px">
          Saving this combo for <b>${escapeHtmlAttr(member.name || 'Kid')}</b> will immediately award the Daily Combo bonus of <b>+${bonusGems} gems</b> since all 3 tasks are already complete.
        </p>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" data-combo-cancel type="button" style="flex:1">Cancel</button>
          <button class="btn btn-primary" data-combo-confirm="${escapeHtmlAttr(String(member.id || ''))}" type="button" style="flex:1">Save &amp; Award Gems</button>
        </div>
      </div>
    </div>`;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelector<HTMLElement>('[data-combo-cancel]')?.addEventListener('click', closeModal);
  root.querySelector<HTMLElement>('[data-combo-confirm]')?.addEventListener('click', event => {
    const id = (event.currentTarget as HTMLElement).dataset.comboConfirm || '';
    closeModal();
    void saveComboOverride(id, true);
  });
}

function areComboTasksComplete(state: DemoAppState, memberId: string, taskIds: string[], today: string): boolean {
  return taskIds.every(taskId => state.completions.some(completion =>
    completion.memberId === memberId
    && completion.choreId === taskId
    && completion.status === 'approved'
    && completion.entryType !== 'before'
    && completion.date === today
  ));
}

async function awardSavedComboIfComplete(kidId: string, finalIds: string[], today: string): Promise<void> {
  const state = currentDemoState();
  if (!areComboTasksComplete(state, kidId, finalIds, today)) {
    render();
    return;
  }
  if (useDevFirestore()) {
    try {
      const { commitDevDailyComboOverrideAward } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevDailyComboOverrideAward({ memberId: kidId, comboIds: finalIds, now: Date.now() });
      const { loadDevFirestoreState } = await import('../platform/firebase/dev-firestore-loader.js');
      firestoreState = await loadDevFirestoreState();
    } catch (error) {
      firestoreError = error instanceof Error ? error.message : String(error);
    } finally {
      void renderDevFirestore();
    }
    return;
  }
  applyDailyComboBonusToStoreForCombo(store, LAB_FAMILY_ID, kidId, finalIds, today, Date.now());
  saveSharedLabStore(store);
  render();
}

async function saveTaskBadgesFromDom(): Promise<void> {
  const state = currentDemoState();
  const nextTasks = state.tasks.map(task => ({ ...task, badges: Array.isArray(task.badges) ? task.badges.map(badge => ({ ...badge })) : [] }));
  nextTasks.forEach((task, taskIndex) => {
    (task.badges || []).forEach((badge, badgeIndex) => {
      badge.name = document.querySelector<HTMLInputElement>(`[data-task-badge-name="${taskIndex}:${badgeIndex}"]`)?.value || badge.name;
      badge.count = Math.max(1, Number(document.querySelector<HTMLInputElement>(`[data-task-badge-count="${taskIndex}:${badgeIndex}"]`)?.value || badge.count || 1));
    });
  });
  await persistTasks(nextTasks);
}

async function addTaskBadge(taskIndex: number): Promise<void> {
  const state = currentDemoState();
  const nextTasks = state.tasks.map(task => ({ ...task, badges: Array.isArray(task.badges) ? task.badges.map(badge => ({ ...badge })) : [] }));
  const task = nextTasks[taskIndex];
  if (!task) return;
  task.badges = task.badges || [];
  if (task.badges.length >= 5) return;
  const lastCount = Number(task.badges.at(-1)?.count || 0);
  task.badges.push({ id: `badge_${Date.now()}`, count: Math.max(10, lastCount + 10), name: '', icon: '<i class="ph-duotone ph-medal" style="color:#F59E0B;font-size:1em"></i>' });
  await persistTasks(nextTasks);
}

async function deleteTaskBadge(taskIndex: number, badgeIndex: number): Promise<void> {
  const state = currentDemoState();
  const nextTasks = state.tasks.map(task => ({ ...task, badges: Array.isArray(task.badges) ? task.badges.map(badge => ({ ...badge })) : [] }));
  nextTasks[taskIndex]?.badges?.splice(badgeIndex, 1);
  await persistTasks(nextTasks);
}

async function toggleTaskBadgeSecret(taskIndex: number, badgeIndex: number): Promise<void> {
  const state = currentDemoState();
  const nextTasks = state.tasks.map(task => ({ ...task, badges: Array.isArray(task.badges) ? task.badges.map(badge => ({ ...badge })) : [] }));
  const badge = nextTasks[taskIndex]?.badges?.[badgeIndex];
  if (!badge) return;
  badge.secret = !badge.secret;
  await persistTasks(nextTasks);
}

async function applyPickedIcon(optionIndex: number): Promise<void> {
  const opt = LEVEL_ICON_OPTIONS[optionIndex];
  if (!opt || !activeIconPicker) return;
  const icon = opt.html.replace('font-size:1.4rem', 'font-size:1em');
  if (activeIconPicker.kind === 'level') {
    const levels = getLevels(currentSettings()).map(level => ({ ...level }));
    levels[Number(activeIconPicker.a)] = { ...levels[Number(activeIconPicker.a)], icon };
    await saveFamilySettingsPatch({ customLevels: levels });
    closeModal();
    return;
  }
  if (activeIconPicker.kind === 'baseBadge') {
    const badgeId = String(activeIconPicker.a);
    const current = { ...(currentSettings().customBadgeDefs || {}) };
    current[badgeId] = { ...(current[badgeId] || {}), icon };
    await saveFamilySettingsPatch({ customBadgeDefs: current });
    closeModal();
    return;
  }
  const state = currentDemoState();
  const nextTasks = state.tasks.map(task => ({ ...task, badges: Array.isArray(task.badges) ? task.badges.map(badge => ({ ...badge })) : [] }));
  const badge = nextTasks[Number(activeIconPicker.a)]?.badges?.[Number(activeIconPicker.b || 0)];
  if (!badge) return;
  badge.icon = icon;
  await persistTasks(nextTasks);
  closeModal();
}

async function persistTasks(nextTasks: DemoAppState['tasks']): Promise<void> {
  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    firestoreState = { ...(firestoreState as DemoAppState), tasks: nextTasks };
    void renderDevFirestore();
    try {
      const { commitDevTaskWrite } = await import('../platform/firebase/dev-firestore-operations.js');
      for (const task of nextTasks) {
        if (!task.id) continue;
        await commitDevTaskWrite({ taskId: String(task.id), data: task as unknown as Record<string, unknown> });
      }
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
    } finally {
      void renderDevFirestore();
    }
    return;
  }
  nextTasks.forEach(task => {
    if (!task.id) return;
    store.set(chorePath(LAB_FAMILY_ID, String(task.id)), task);
  });
  saveSharedLabStore(store);
  render();
}

function undoLocalHistory(historyId: string): void {
  store = loadSharedLabStore(createDemoFamilySeedStore);
  const history = store.get<{ id?: string; requestId?: string; memberId?: string; type?: string; amount?: number | null; gems?: number; metadata?: Record<string, unknown> }>(historyPath(LAB_FAMILY_ID, historyId));
  const requestId = getUndoRequestId(historyId, history?.requestId);
  if (!requestId) return;
  const request = store.get<Record<string, unknown>>(requestPath(LAB_FAMILY_ID, requestId));
  if (!request) return;
  revertRequestFromHistory(store, LAB_FAMILY_ID, historyId, { ...history, requestId }, request);
  saveSharedLabStore(store);
  render();
}

async function handleFirestoreUndoAction(historyId: string): Promise<void> {
  const previousState = cloneDemoState(firestoreState);
  firestoreState = applyUndoToFirestoreState(firestoreState, historyId) || firestoreState;
  void renderDevFirestore();
  const applied = await enqueueFirestoreUndoWrite(historyId);
  if (!applied) {
    firestoreState = previousState;
    toast(firestoreError || 'Could not undo that history item.');
    void renderDevFirestore();
  }
}

function revertRequestFromHistory(
  gateway: Pick<FakeFirestoreGateway, 'get' | 'set'>,
  familyId: string,
  historyId: string,
  history: { requestId?: string; memberId?: string; type?: string; amount?: number | null; gems?: number; metadata?: Record<string, unknown> },
  request: Record<string, unknown>,
): void {
  const requestId = String(history.requestId || '');
  const requestKind = String(request.kind || '');
  const memberId = String(request.targetMemberId || history.memberId || '');
  const requestSource = (request.source || {}) as { completionId?: string; prizeId?: string };
  const requestSnapshot = (request.snapshot || {}) as { points?: number };
  const requestDoc = {
    ...request,
    status: 'pending',
    resolvedAt: null,
    resolvedByMemberId: null,
  };
  gateway.set(requestPath(familyId, requestId), requestDoc);

  if (String(historyId).endsWith(':approve')) {
    if (requestKind === 'chore_completion') {
      const member = gateway.get<Record<string, unknown>>(memberPath(familyId, memberId)) || {};
      const completionId = String(requestSource.completionId || (history.metadata?.completionId as string) || '');
      const points = Number(requestSnapshot.points || history.gems || 0);
      gateway.set(memberPath(familyId, memberId), {
        ...member,
        gems: Number(member.gems || member.diamonds || 0) - points,
        diamonds: Number(member.gems || member.diamonds || 0) - points,
        totalEarned: Number(member.totalEarned || 0) - points,
      });
      if (completionId) {
        const completion = gateway.get<Record<string, unknown>>(completionPath(familyId, completionId)) || {};
        gateway.set(completionPath(familyId, completionId), {
          ...completion,
          status: 'pending',
          approvedAt: null,
          approvedByMemberId: null,
        });
      }
    } else if (requestKind === 'prize_redeem') {
      const member = gateway.get<Record<string, unknown>>(memberPath(familyId, memberId)) || {};
      const prizeId = String(requestSource.prizeId || history.metadata?.prizeId || '');
      const cost = Math.abs(Number(history.gems || 0));
      gateway.set(memberPath(familyId, memberId), {
        ...member,
        gems: Number(member.gems || member.diamonds || 0) + cost,
        diamonds: Number(member.gems || member.diamonds || 0) + cost,
      });
      if (prizeId) {
        const prize = gateway.get<Record<string, unknown>>(prizePath(familyId, prizeId)) || {};
        const redemptions = Array.isArray(prize.redemptions) ? prize.redemptions.filter((entry: unknown) => {
          const value = entry as { requestId?: string; id?: string };
          return value.requestId !== requestId && value.id !== history.metadata?.redemptionId;
        }) : [];
        gateway.set(prizePath(familyId, prizeId), { ...prize, redemptions });
      }
    } else if (requestKind === 'savings_spend') {
      const member = gateway.get<Record<string, unknown>>(memberPath(familyId, memberId)) || {};
      const amount = Number(history.amount || 0);
      const bucketsBefore = history.metadata?.savingsBucketsBefore as { savingsGifted?: number; savingsMatched?: number; savingsInterest?: number } | undefined;
      gateway.set(memberPath(familyId, memberId), {
        ...member,
        savings: Number(member.savings || 0) + amount,
        savingsGifted: bucketsBefore ? bucketsBefore.savingsGifted : Number(member.savingsGifted || 0) + amount,
        savingsMatched: bucketsBefore ? bucketsBefore.savingsMatched : member.savingsMatched,
        savingsInterest: bucketsBefore ? bucketsBefore.savingsInterest : member.savingsInterest,
      });
    }
  }

  gateway.set(historyPath(familyId, historyId), null);
  gateway.set(operationPath(familyId, `op:request:${String(historyId).endsWith(':deny') ? 'deny' : 'approve'}:${requestId}`), null);
}

function getUndoRequestId(historyId: string, requestId?: string): string {
  if (requestId) return String(requestId);
  const match = String(historyId).match(/^history:request:(.+):(approve|deny)$/);
  return match?.[1] || '';
}

function openFullHistoryModal(state: DemoAppState): void {
  const root = document.getElementById('settings-root');
  if (!root) return;
  root.innerHTML = renderFullHistoryModal(state.historyRows);
  root.classList.add('open');
  root.querySelectorAll<HTMLElement>('[data-close-history-pane]').forEach(button => button.addEventListener('click', closeFullHistoryModal));
}

function closeFullHistoryModal(): void {
  const root = document.getElementById('settings-root');
  if (!root) return;
  root.classList.remove('open');
  root.innerHTML = '';
}

function openSettingsPane(): void {
  activeSettingsPage = 'main';
  rerenderSettingsPane();
}

function openSwitchUserScreen(): void {
  closeSettingsPane();
  showScreen('screen-home');
  const state = currentDemoState();
  const home = document.getElementById('screen-home');
  if (!home) return;
  home.innerHTML = renderHomeScreen(state);
  bindHomeScreenActions(state);
}

function closeSettingsPane(): void {
  const root = document.getElementById('settings-root');
  if (!root) return;
  root.classList.remove('open');
  root.innerHTML = '';
}

function rerenderSettingsPane(scrollTop?: number): void {
  const root = document.getElementById('settings-root');
  if (!root) return;
  const state = currentDemoState();
  root.innerHTML = renderParentSettings(state, {
    page: activeSettingsPage,
    showDevTools: devSettingsUnlocked,
    canReset: !useDevFirestore(),
    subscription: subscriptionState,
  });
  root.classList.add('open');
  bindSettingsPane();
  if (typeof scrollTop === 'number') {
    const pane = root.querySelector<HTMLElement>('.settings-subpane');
    if (pane) pane.scrollTop = scrollTop;
  }
}

function bindSettingsPane(): void {
  const root = document.getElementById('settings-root');
  if (!root) return;
  root.querySelectorAll<HTMLElement>('[data-settings-close]').forEach(button => {
    button.addEventListener('click', closeSettingsPane);
  });
  root.querySelectorAll<HTMLElement>('[data-settings-back]').forEach(button => {
    button.addEventListener('click', () => {
      activeSettingsPage = 'main';
      rerenderSettingsPane();
    });
  });
  root.querySelectorAll<HTMLElement>('[data-settings-page]').forEach(button => {
    button.addEventListener('click', () => {
      const page = button.dataset.settingsPage as ParentSettingsPage | undefined;
      if (!page) return;
      activeSettingsPage = page;
      rerenderSettingsPane();
    });
  });
  root.querySelectorAll<HTMLInputElement>('[data-settings-toggle]').forEach(input => {
    input.addEventListener('change', () => {
      const key = input.dataset.settingsToggle || '';
      if (!key) return;
      const invert = input.dataset.settingsInvert === '1';
      void saveFamilySettingsPatch({ [key]: invert ? !input.checked : input.checked });
    });
  });
  root.querySelectorAll<HTMLInputElement>('[data-settings-number]').forEach(input => {
    input.addEventListener('change', () => {
      const key = input.dataset.settingsNumber || '';
      if (!key) return;
      let value = Number(input.value || 0);
      if (key === 'savingsInterestDayOfMonth') value = Math.min(28, Math.max(1, value || 1));
      else if (key === 'savingsMatchPercent') value = Math.min(200, Math.max(1, value || 1));
      else value = Math.max(0, value || 0);
      input.value = String(value);
      void saveFamilySettingsPatch({ [key]: value });
    });
  });
  root.querySelectorAll<HTMLInputElement>('[data-settings-decimal]').forEach(input => {
    input.addEventListener('change', () => {
      const key = input.dataset.settingsDecimal || '';
      if (!key) return;
      const value = Math.max(0, Number(input.value || 0));
      input.value = String(value);
      void saveFamilySettingsPatch({ [key]: value });
    });
  });
  root.querySelectorAll<HTMLSelectElement>('[data-settings-select]').forEach(select => {
    select.addEventListener('change', () => {
      const key = select.dataset.settingsSelect || '';
      if (!key) return;
      const rawValue = select.value;
      const value = ['savingsInterestDay'].includes(key) ? Number(rawValue) : rawValue;
      void saveFamilySettingsPatch({ [key]: value });
    });
  });
  root.querySelector('[data-settings-pin]')?.addEventListener('click', () => {
    openParentPinModal();
  });
  root.querySelectorAll<HTMLElement>('[data-settings-provider-link],[data-settings-provider-switch]').forEach(button => {
    button.addEventListener('click', () => {
      const provider = (button.dataset.settingsProviderLink || button.dataset.settingsProviderSwitch) as 'google' | 'apple' | undefined;
      if (!provider) return;
      void linkAccountProvider(provider);
    });
  });
  root.querySelectorAll<HTMLElement>('[data-settings-provider-unlink]').forEach(button => {
    button.addEventListener('click', () => {
      const provider = button.dataset.settingsProviderUnlink as 'google' | 'apple' | undefined;
      if (!provider) return;
      void unlinkAccountProvider(provider);
    });
  });
  root.querySelector<HTMLElement>('[data-settings-biometric]')?.addEventListener('click', () => {
    void setupBiometricUnlock();
  });
  root.querySelector<HTMLElement>('[data-settings-biometric-remove]')?.addEventListener('click', () => {
    removeBiometricUnlock();
  });
  root.querySelector<HTMLElement>('[data-settings-subscribe]')?.addEventListener('click', () => {
    closeSettingsPane();
    void showPaywall();
  });
  root.querySelector<HTMLElement>('[data-settings-manage-subscription]')?.addEventListener('click', openManageSubscriptions);
  root.querySelector<HTMLElement>('[data-settings-restore-purchases]')?.addEventListener('click', () => {
    void restoreSubscriptionFromSettings();
  });
  root.querySelector<HTMLElement>('[data-settings-reset]')?.addEventListener('click', event => {
    openResetAllDataConfirm(event.currentTarget as Element | null);
  });
  root.querySelector<HTMLElement>('[data-settings-join-different]')?.addEventListener('click', event => {
    openJoinDifferentFamilyConfirm(event.currentTarget as Element | null);
  });
  root.querySelector<HTMLElement>('[data-settings-delete-account]')?.addEventListener('click', event => {
    openDeleteAccountConfirm(event.currentTarget as Element | null);
  });
  root.querySelector<HTMLElement>('[data-settings-add-user]')?.addEventListener('click', event => {
    openSettingsAddUserModal(event.currentTarget as Element | null);
  });
  root.querySelector<HTMLElement>('[data-settings-edit-family]')?.addEventListener('click', () => {
    const state = currentDemoState();
    closeSettingsPane();
    startOnboardingEditDraft(state);
    activeOnboardingStep = 'welcome';
    onboardingTransitionDirection = 'forward';
    render();
  });
  root.querySelector<HTMLElement>('[data-settings-whats-new]')?.addEventListener('click', event => {
    openSettingsChangelogModal(event.currentTarget as Element | null);
  });
  root.querySelector<HTMLElement>('[data-settings-dev-unlock]')?.addEventListener('click', tapSettingsVersionForDevUnlock);
  root.querySelector<HTMLElement>('[data-settings-dev-push-permission]')?.addEventListener('click', () => {
    void devTestPushPermission();
  });
  root.querySelector<HTMLElement>('[data-settings-dev-push-token]')?.addEventListener('click', () => {
    void devShowPushToken();
  });
  root.querySelector<HTMLElement>('[data-settings-dev-push-diagnostics]')?.addEventListener('click', () => {
    void devShowPushDiagnostics();
  });
  root.querySelector<HTMLInputElement>('[data-settings-split-household]')?.addEventListener('change', event => {
    void setFamilySplitHousehold((event.currentTarget as HTMLInputElement).checked);
  });
  root.querySelector<HTMLElement>('[data-settings-configure-split]')?.addEventListener('click', event => {
    openSplitHouseholdModal(event.currentTarget as Element | null);
  });
  root.querySelectorAll<HTMLElement>('[data-settings-scroll]').forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.settingsScroll;
      const pane = root.querySelector<HTMLElement>('.settings-subpane');
      if (!pane) return;
      if (target === 'top') {
        pane.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (target === 'family') {
        root.querySelector<HTMLElement>('#settings-family-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
  root.querySelector('[data-settings-switch-user]')?.addEventListener('click', openSwitchUserScreen);
  root.querySelectorAll<HTMLElement>('[data-member-presence]').forEach(button => {
    button.addEventListener('click', () => {
      const [memberId, mode] = String(button.dataset.memberPresence || '').split(':');
      if (!memberId) return;
      void setMemberTodayPresence(memberId, mode !== 'away');
    });
  });
}

function tapSettingsVersionForDevUnlock(): void {
  if (devSettingsUnlocked) return;
  const now = Date.now();
  if (!devSettingsUnlockWindowStart || now - devSettingsUnlockWindowStart > 3000) {
    devSettingsUnlockWindowStart = now;
    devSettingsUnlockTapCount = 0;
  }
  devSettingsUnlockTapCount += 1;
  const remaining = 7 - devSettingsUnlockTapCount;
  if (remaining <= 0) {
    const scrollTop = document.querySelector<HTMLElement>('#settings-root .settings-subpane')?.scrollTop || 0;
    devSettingsUnlocked = true;
    devSettingsUnlockTapCount = 0;
    devSettingsUnlockWindowStart = 0;
    toast('Developer options unlocked');
    rerenderSettingsPane(scrollTop);
    requestAnimationFrame(() => {
      const pane = document.querySelector<HTMLElement>('#settings-root .settings-subpane');
      if (pane) pane.scrollTo({ top: pane.scrollHeight, behavior: 'smooth' });
    });
    return;
  }
  if (devSettingsUnlockTapCount >= 3) toast(`${remaining} more taps to unlock developer options`);
}

async function savePushTokenForSignedInUser(token: string, metadata: Record<string, unknown> = {}): Promise<boolean> {
  const uid = getCurrentParentAuthUid();
  if (!uid || !token) return false;
  const { saveDevFcmTokenForUser } = await import('../platform/firebase/dev-firestore-operations.js');
  await saveDevFcmTokenForUser({ uid, token, metadata });
  return true;
}

function isNativePlatform(): boolean {
  const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return capacitor?.isNativePlatform?.() === true;
}

function getFirebaseMessagingPlugin(): {
  requestPermissions?: () => Promise<{ receive?: string }>;
  checkPermissions?: () => Promise<{ receive?: string }>;
  getToken?: () => Promise<{ token?: string }>;
} | null {
  const capacitor = (window as Window & {
    Capacitor?: {
      Plugins?: {
        FirebaseMessaging?: {
          requestPermissions?: () => Promise<{ receive?: string }>;
          checkPermissions?: () => Promise<{ receive?: string }>;
          getToken?: () => Promise<{ token?: string }>;
        };
      };
    };
  }).Capacitor;
  return capacitor?.Plugins?.FirebaseMessaging || null;
}

async function devTestPushPermission(): Promise<void> {
  if (!isNativePlatform()) {
    toast('Push notifications only work on device');
    return;
  }
  const messaging = getFirebaseMessagingPlugin();
  if (!messaging?.requestPermissions) {
    toast('FirebaseMessaging plugin not found');
    return;
  }
  try {
    const result = await messaging.requestPermissions();
    toast(`Permission: ${result.receive || 'unknown'}`);
  } catch (error) {
    toast(`Permission check failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

async function devShowPushToken(): Promise<void> {
  if (!isNativePlatform()) {
    toast('Push notifications only work on device');
    return;
  }
  const messaging = getFirebaseMessagingPlugin();
  if (!messaging?.requestPermissions || !messaging.getToken) {
    toast('FirebaseMessaging plugin not found');
    return;
  }
  let token = '';
  let permission = '';
  let tokenSaved = false;
  let saveError = '';
  try {
    const perm = await messaging.requestPermissions();
    permission = perm.receive || 'unknown';
    if (permission !== 'granted') {
      toast(`Permission not granted: ${permission}`);
      return;
    }
    token = (await messaging.getToken())?.token || '';
    if (!token) {
      toast('No token returned from FirebaseMessaging');
      return;
    }
  } catch (error) {
    toast(`Token fetch failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    return;
  }
  try {
    const state = currentDemoState();
    tokenSaved = await savePushTokenForSignedInUser(token, {
      source: 'dev-diagnostics',
      familyId: state.familyId || DEV_FIRESTORE_FAMILY_ID,
      memberId: getActiveViewer(state)?.id || '',
      permission,
      platform: 'native',
    });
  } catch (error) {
    saveError = error instanceof Error ? error.message : String(error);
  }
  openDevPushTokenModal(token, tokenSaved, saveError);
}

function openDevPushTokenModal(token: string, tokenSaved: boolean, saveError = ''): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay" data-modal-overlay>
      <div class="modal quick-action-modal quick-action-modal-wide" role="dialog" aria-modal="true">
        <button class="modal-close-x" data-modal-close type="button" aria-label="Close"><i class="ph-duotone ph-x"></i></button>
        <div class="modal-title"><i class="ph-duotone ph-bell" style="color:#6C63FF;font-size:1.2rem;vertical-align:middle"></i> FCM Token</div>
        <div style="font-size:0.72rem;font-family:monospace;word-break:break-all;background:#F3F4F6;padding:10px;border-radius:8px;line-height:1.6">${escapeHtmlAttr(token)}</div>
        <div style="font-size:0.78rem;color:var(--muted);margin-top:8px">${tokenSaved ? 'Token saved to Firestore.' : `Token fetched, but Firestore save ${saveError ? `failed: ${escapeHtmlAttr(saveError)}` : 'was skipped because no Firebase auth user is signed in.'}`}</div>
        <button class="btn btn-secondary btn-full" style="margin-top:12px" data-copy-dev-token type="button">Copy Token</button>
      </div>
    </div>`;
  bindBasicModalClose(root);
  root.querySelector<HTMLElement>('[data-copy-dev-token]')?.addEventListener('click', () => copyTextToClipboard(token, 'Token copied'));
}

async function devShowPushDiagnostics(): Promise<void> {
  const state = currentDemoState();
  const viewer = getActiveViewer(state);
  const authInfo = getCurrentParentAuthInfo();
  const parent = state.members.find(member => member.role === 'parent') || null;
  const parentAuthUid = String((parent as DemoMember & { authUid?: string } | null)?.authUid || '');
  const messaging = getFirebaseMessagingPlugin();
  const info: Record<string, unknown> = {
    firebaseProjectId: DEV_FIRESTORE_CONFIG.projectId,
    dataSource: useDevFirestore() ? 'dev-firestore' : 'local-demo',
    nativePlatform: isNativePlatform(),
    familyId: state.familyId || DEV_FIRESTORE_FAMILY_ID,
    familyCode: state.familyCode || '',
    activeViewerId: viewer?.id || '',
    activeViewerRole: viewer?.role || '',
    activeViewerName: viewer?.name || '',
    authUid: authInfo?.uid || '',
    authEmail: authInfo?.email || '',
    authProvider: authInfo?.providerId || '',
    parentAuthUid,
    notifyChoreApproval: state.settings.notifyChoreApproval !== false,
    notifySavingsSpend: state.settings.notifySavingsSpend !== false,
    lockOnBackground: state.settings.lockOnBackground === true,
    parentPinSet: !!state.settings.parentPin,
    biometricCredentialSet: !!window.localStorage.getItem('gemsprout.v2.biometricCredentialId'),
    localTokenCached: !!window.localStorage.getItem('gemsprout.v2.devPushToken'),
    pushPermission: isNativePlatform() ? (messaging ? 'checking' : 'plugin-missing') : 'web-only',
    deviceToken: '',
    authUserTokenCount: '(unknown)',
    parentAuthTokenCount: '(unknown)',
  };
  if (isNativePlatform() && messaging) {
    try {
      const permission = messaging.checkPermissions
        ? await messaging.checkPermissions().catch(() => null)
        : await messaging.requestPermissions?.().catch(() => null);
      info.pushPermission = permission?.receive || '(unknown)';
      if (info.pushPermission === 'granted' && messaging.getToken) {
        info.deviceToken = (await messaging.getToken().catch(() => null))?.token || '';
      }
    } catch (error) {
      info.pushPermission = `error: ${error instanceof Error ? error.message : 'unknown'}`;
    }
  }
  const { getDevFcmTokenCountForUser } = await import('../platform/firebase/dev-firestore-operations.js');
  info.authUserTokenCount = authInfo?.uid
    ? await getDevFcmTokenCountForUser({ uid: authInfo.uid }).catch(error => `error: ${error instanceof Error ? error.message : 'unknown'}`)
    : '(n/a)';
  info.parentAuthTokenCount = parentAuthUid
    ? await getDevFcmTokenCountForUser({ uid: parentAuthUid }).catch(error => `error: ${error instanceof Error ? error.message : 'unknown'}`)
    : '(n/a)';
  devPushDiagnosticsClipboard = JSON.stringify(info, null, 2);
  openDevPushDiagnosticsModal(info);
}

function openDevPushDiagnosticsModal(info: Record<string, unknown>): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  const token = String(info.deviceToken || '');
  const lines = [
    `Project: ${info.firebaseProjectId}`,
    `Source: ${info.dataSource}`,
    `Native: ${info.nativePlatform}`,
    `Family: ${info.familyCode || '(none)'} / ${info.familyId}`,
    `Viewer: ${info.activeViewerRole || '(none)'} ${info.activeViewerName || ''} (${info.activeViewerId || 'none'})`,
    `Auth UID: ${info.authUid || '(none)'}`,
    `Auth email: ${info.authEmail || '(none)'}`,
    `Parent auth UID: ${info.parentAuthUid || '(none)'}`,
    `Push permission: ${info.pushPermission}`,
    `Device token: ${token ? `${token.slice(0, 24)}...` : '(none)'}`,
    `users/<authUid> token count: ${info.authUserTokenCount}`,
    `users/<parentAuthUid> token count: ${info.parentAuthTokenCount}`,
    `Notify chore approval: ${info.notifyChoreApproval ? 'on' : 'off'}`,
    `Notify savings spend: ${info.notifySavingsSpend ? 'on' : 'off'}`,
    `Lock on background: ${info.lockOnBackground ? 'on' : 'off'}`,
  ];
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay" data-modal-overlay>
      <div class="modal quick-action-modal quick-action-modal-wide" role="dialog" aria-modal="true">
        <button class="modal-close-x" data-modal-close type="button" aria-label="Close"><i class="ph-duotone ph-x"></i></button>
        <div class="modal-title"><i class="ph-duotone ph-bug" style="color:#6C63FF;font-size:1.2rem;vertical-align:middle"></i> Push Diagnostics</div>
        <div style="font-size:0.8rem;color:var(--muted);line-height:1.45;margin-bottom:10px">${lines.map(line => escapeHtmlAttr(line)).join('<br>')}</div>
        <div style="font-size:0.72rem;font-family:monospace;white-space:pre-wrap;word-break:break-word;background:#F3F4F6;padding:10px;border-radius:8px;line-height:1.5;max-height:220px;overflow:auto">${escapeHtmlAttr(devPushDiagnosticsClipboard)}</div>
        <button class="btn btn-secondary btn-full" style="margin-top:12px" data-copy-dev-diagnostics type="button">Copy Diagnostics JSON</button>
      </div>
    </div>`;
  bindBasicModalClose(root);
  root.querySelector<HTMLElement>('[data-copy-dev-diagnostics]')?.addEventListener('click', () => copyTextToClipboard(devPushDiagnosticsClipboard, 'Diagnostics copied'));
}

function bindBasicModalClose(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-modal-close]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
}

function copyTextToClipboard(text: string, successMessage: string): void {
  if (!text) {
    toast('Nothing to copy');
    return;
  }
  navigator.clipboard?.writeText(text)
    .then(() => toast(successMessage))
    .catch(() => toast('Copy failed'));
}

function getActiveParentMember(): DemoMember | null {
  const state = currentDemoState();
  const viewer = getActiveViewer(state);
  if (viewer?.role === 'parent') return viewer;
  return state.members.find(member => member.role === 'parent') || null;
}

async function linkAccountProvider(provider: 'google' | 'apple'): Promise<void> {
  const parent = getActiveParentMember();
  if (!parent?.id) return;
  const authUser = await signInParentWithProvider(provider);
  if (!authUser) {
    toast('Sign-in did not complete.');
    return;
  }
  const providerId = provider === 'google' ? 'google.com' : 'apple.com';
  const currentProviders = Array.isArray(parent.authProviders) ? parent.authProviders : [];
  const nextProvider = {
    providerId,
    uid: authUser.uid,
    email: authUser.email,
    linkedAt: Date.now(),
    devBypass: !!authUser.isDevBypass,
  };
  const nextProviders = [
    ...currentProviders.filter(item => item.providerId !== providerId && item.providerId !== 'dev-bypass'),
    nextProvider,
  ];
  await saveMemberPatch(String(parent.id), {
    authUid: nextProviders[0]?.uid || authUser.uid,
    authUids: nextProviders.map(item => item.uid).filter(Boolean),
    authProviders: nextProviders,
  });
  if (useDevFirestore()) {
    try {
      const { commitDevFamilyWrite } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevFamilyWrite({ data: { parentAuthUid: authUser.uid } });
    } catch (error) {
      console.warn('Unable to update parent auth mapping:', error);
    }
  }
  await saveFamilySettingsPatch({ lastSync: Date.now() });
  toast(`${provider === 'google' ? 'Google' : 'Apple'} account linked`);
}

async function unlinkAccountProvider(provider: 'google' | 'apple'): Promise<void> {
  const parent = getActiveParentMember();
  if (!parent?.id) return;
  const providerId = provider === 'google' ? 'google.com' : 'apple.com';
  const currentProviders = Array.isArray(parent.authProviders) ? parent.authProviders : [];
  const nextProviders = currentProviders.filter(item => item.providerId !== providerId);
  if (nextProviders.length === currentProviders.length) {
    toast('That sign-in method is not linked');
    return;
  }
  if (!nextProviders.length) {
    toast('Keep at least one sign-in method linked. Use Switch Account instead.');
    return;
  }
  await saveMemberPatch(String(parent.id), {
    authUid: nextProviders[0]?.uid || '',
    authUids: nextProviders.map(item => item.uid).filter(Boolean),
    authProviders: nextProviders,
  });
  if (useDevFirestore()) {
    try {
      const { commitDevFamilyWrite } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevFamilyWrite({ data: { parentAuthUid: nextProviders[0]?.uid || '' } });
    } catch (error) {
      console.warn('Unable to update parent auth mapping:', error);
    }
  }
  await saveFamilySettingsPatch({ lastSync: Date.now() });
  toast(`${provider === 'google' ? 'Google' : 'Apple'} unlinked`);
}

function openParentPinModal(triggerEl?: Element | null): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  const hasPin = !!currentSettings().parentPin;
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="${modalOriginStyle(triggerEl?.getBoundingClientRect())}">
      <div class="modal quick-action-modal modal-origin-sheet" role="dialog" aria-modal="true">
        <button class="modal-close-x" type="button" aria-label="Close" data-close-modal><span aria-hidden="true">&times;</span></button>
        <div class="modal-title"><i class="ph-duotone ph-lock-key" style="color:#6C63FF;font-size:1.2rem;vertical-align:middle"></i> ${hasPin ? 'Reset Parent PIN' : 'Set Parent PIN'}</div>
        <p style="font-size:0.88rem;color:var(--muted);line-height:1.45;margin:6px 0 14px">Enter a 4-digit PIN used for parent-only actions and device lock.</p>
        <input data-parent-pin-input type="password" maxlength="4" inputmode="numeric" pattern="[0-9]*" placeholder="4 digits" style="width:100%;box-sizing:border-box;padding:12px 14px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:1.2rem;text-align:center;letter-spacing:0.24em;outline:none">
        <div data-parent-pin-error style="min-height:18px;margin-top:8px;font-size:0.8rem;color:#DC2626;text-align:center"></div>
        <div class="modal-actions" style="margin-top:10px">
          ${hasPin ? '<button class="btn btn-secondary" data-parent-pin-remove type="button">Remove PIN</button>' : '<button class="btn btn-secondary" data-close-modal type="button">Cancel</button>'}
          <button class="btn btn-primary" data-parent-pin-save type="button">Save</button>
        </div>
      </div>
    </div>`;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
  const input = root.querySelector<HTMLInputElement>('[data-parent-pin-input]');
  input?.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 4);
  });
  root.querySelector<HTMLElement>('[data-parent-pin-save]')?.addEventListener('click', () => {
    const pin = input?.value || '';
    if (!/^\d{4}$/.test(pin)) {
      const error = root.querySelector<HTMLElement>('[data-parent-pin-error]');
      if (error) error.textContent = 'Enter a 4-digit PIN';
      return;
    }
    void saveFamilySettingsPatch({ parentPin: pin }).then(() => {
      closeModal();
      rerenderSettingsPane();
    });
  });
  root.querySelector<HTMLElement>('[data-parent-pin-remove]')?.addEventListener('click', () => {
    void saveFamilySettingsPatch({ parentPin: '', lockOnBackground: false }).then(() => {
      closeModal();
      rerenderSettingsPane();
    });
  });
  window.setTimeout(() => input?.focus(), 100);
}

async function setupBiometricUnlock(): Promise<void> {
  const label = getBiometricLabel();
  const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { NativeBiometric?: { verifyIdentity?: (input: unknown) => Promise<void> } } } }).Capacitor;
  const nativeBiometric = capacitor?.Plugins?.NativeBiometric;
  if (capacitor?.isNativePlatform?.() && nativeBiometric?.verifyIdentity) {
    try {
      await nativeBiometric.verifyIdentity({ reason: `Set up ${label} for GemSprout`, title: `Set Up ${label}` });
    } catch {
      return;
    }
  }
  try {
    window.localStorage.setItem('gemsprout.v2.biometricCredentialId', `parent:${getActiveParentMember()?.id || 'parent'}`);
  } catch {}
  toast(`${label} enabled`);
  rerenderSettingsPane();
}

function removeBiometricUnlock(): void {
  try {
    window.localStorage.removeItem('gemsprout.v2.biometricCredentialId');
  } catch {}
  toast(`${getBiometricLabel()} removed`);
  rerenderSettingsPane();
}

function getBiometricLabel(): string {
  return /iPad|iPhone|Mac/i.test(navigator.userAgent) ? 'Face ID / Touch ID' : 'Biometric';
}

async function ensureSubscriptionForState(state: DemoAppState): Promise<void> {
  const appUserId = String(state.familyCode || state.familyId || DEV_FIRESTORE_FAMILY_ID);
  if (subscriptionAppUserId === appUserId && subscriptionState.initialized) return;
  subscriptionAppUserId = appUserId;
  await initRevenueCat(appUserId);
}

function shouldShowSubscriptionPaywall(viewer: DemoMember): boolean {
  if (isDevPaywallBypassed()) return false;
  return viewer.role === 'parent' && subscriptionState.isNative && subscriptionState.initialized && !subscriptionState.isPro;
}

async function showPaywall(forcePreview = false): Promise<void> {
  paywallOpen = true;
  showScreen('screen-auth');
  renderPaywall();
  await loadOfferings();
  if (!forcePreview) await refreshEntitlement();
  if (!forcePreview && subscriptionState.isPro) {
    paywallOpen = false;
    render();
    return;
  }
  renderPaywall();
}

function renderPaywall(): void {
  const el = document.getElementById('screen-auth');
  if (!el) return;
  el.className = 'screen active';
  el.removeAttribute('style');
  el.innerHTML = paywallHtml();
  bindPaywallActions(el);
}

function paywallHtml(): string {
  const monthlySelected = subscriptionState.selectedPlan === 'monthly';
  const yearlySelected = subscriptionState.selectedPlan === 'yearly';
  const cardBase = 'border-radius:16px;padding:14px 16px;cursor:pointer;transition:border 0.15s,transform 0.15s,background 0.15s;box-shadow:0 10px 24px rgba(39,66,57,0.12);';
  const monthlyCard = `${cardBase}border:2px solid ${monthlySelected ? '#2a7560' : 'rgba(39,66,57,0.16)'};background:${monthlySelected ? 'rgba(231,245,238,0.95)' : 'rgba(255,251,244,0.88)'};`;
  const yearlyCard = `${cardBase}border:2px solid ${yearlySelected ? '#2a7560' : 'rgba(39,66,57,0.16)'};background:${yearlySelected ? 'rgba(231,245,238,0.95)' : 'rgba(255,251,244,0.88)'};`;
  const trialDays = subscriptionState.trialDays || 7;
  return `
  <div class="paywall-shell">
    <div class="paywall-top">
      <div class="paywall-top-inner">
        <div style="position:relative;text-align:center;padding:26px 0 20px">
          <button data-paywall-close type="button" style="position:absolute;top:8px;left:-8px;background:none;border:none;color:rgba(244,252,248,0.82);font-size:1.5rem;cursor:pointer;padding:4px;line-height:1" aria-label="Close"><i class="ph-duotone ph-x"></i></button>
          <img src="/gemsprout.png" style="width:82px;height:82px;border-radius:20px;box-shadow:0 12px 28px rgba(31,54,46,0.28)" alt="GemSprout">
          <div style="color:#f7fbf8;font-size:1.78rem;font-weight:900;margin-top:14px;letter-spacing:-0.02em">GemSprout Pro</div>
          <div style="color:rgba(245,252,247,0.78);font-size:0.95rem;margin-top:6px">An easy to use family system for rewards, savings, and shared goals</div>
        </div>
        <div style="padding:0 0 18px;display:flex;flex-direction:column;gap:10px">
          ${[
            ['ph-check-circle', 'Configurable daily tasks with parent approvals and optional photo verification'],
            ['ph-bell-ringing', 'Instant alerts when kids complete tasks or request actions'],
            ['ph-piggy-bank', 'Rewards and savings with optional parent-matching and interest'],
          ].map(([icon, text]) => `
            <div style="display:flex;align-items:center;gap:12px;background:rgba(249,253,251,0.74);border:1px solid rgba(39,66,57,0.12);border-radius:14px;padding:10px 12px">
              <i class="ph-duotone ${icon}" style="color:#2a7560;font-size:1.2rem;flex-shrink:0"></i>
              <div style="color:#29423a;font-size:0.9rem;line-height:1.4">${escapeHtmlAttr(text)}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>
    <div class="paywall-bottom">
      <div class="paywall-bottom-inner">
        <div class="paywall-bottom-scroll">
          <div style="padding:20px 24px 0;display:flex;gap:12px">
            <button id="rc-card-monthly" data-paywall-plan="monthly" type="button" style="${monthlyCard};flex:1;text-align:left">
              <div style="color:#567167;font-size:0.75rem;font-weight:800;text-transform:uppercase;letter-spacing:0.05em">Monthly</div>
              <div style="color:#1f3932;font-size:1.3rem;font-weight:900;margin-top:4px">${escapeHtmlAttr(subscriptionState.monthlyPrice)}</div>
              <div style="color:#637d72;font-size:0.75rem;margin-top:2px">per month</div>
            </button>
            <button id="rc-card-yearly" data-paywall-plan="yearly" type="button" style="${yearlyCard};flex:1;position:relative;text-align:left">
              <div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:#d97706;color:#fff;font-size:0.68rem;font-weight:800;padding:2px 10px;border-radius:999px;white-space:nowrap;text-transform:uppercase;letter-spacing:0.04em">Best Value</div>
              <div style="color:#567167;font-size:0.75rem;font-weight:800;text-transform:uppercase;letter-spacing:0.05em">Yearly</div>
              <div style="color:#1f3932;font-size:1.3rem;font-weight:900;margin-top:4px">${escapeHtmlAttr(subscriptionState.yearlyPrice)}</div>
              <div style="color:#637d72;font-size:0.75rem;margin-top:2px">per year</div>
            </button>
          </div>
          <div style="padding:20px 24px 0">
            <button data-paywall-start type="button" style="width:100%;padding:16px;border-radius:14px;border:none;background:linear-gradient(180deg,#2a7560,#1f5f4f);color:#f8fbf9;font-size:1rem;font-weight:800;cursor:pointer;box-shadow:0 10px 22px rgba(31,54,46,0.24)">
              Start ${trialDays}-Day Free Trial
            </button>
            ${useDevFirestore() ? `
              <button data-paywall-dev-bypass type="button" style="width:100%;margin-top:10px;padding:13px;border-radius:14px;border:2px solid rgba(39,66,57,0.18);background:rgba(255,251,244,0.92);color:#29423a;font-size:0.9rem;font-weight:800;cursor:pointer">
                Continue v2 TestFlight Testing
              </button>` : ''}
            ${subscriptionState.offeringsStatus === 'error' ? `
              <div style="margin-top:8px;color:#9A3412;background:#FFF7ED;border:1px solid #FDBA74;border-radius:10px;padding:8px 10px;font-size:0.78rem;line-height:1.4">
                Could not load subscription products. Tap Retry or Restore Purchases.
              </div>` : ''}
            <div style="color:#5b7168;font-size:0.75rem;text-align:center;margin-top:8px;line-height:1.5">
              Free for ${trialDays} days, then auto-renews. Cancel any time in your iPhone settings.
            </div>
          </div>
        </div>
        <div class="paywall-footer">
          <button data-paywall-retry type="button" style="background:none;border:none;color:#35554a;font-size:0.82rem;cursor:pointer;padding:4px;font-weight:700">Retry</button>
          <button data-paywall-restore type="button" style="background:none;border:none;color:#35554a;font-size:0.82rem;cursor:pointer;padding:4px;font-weight:700">Restore Purchases</button>
          <button data-paywall-account type="button" style="background:none;border:none;color:#35554a;font-size:0.82rem;cursor:pointer;padding:4px;font-weight:700">Account &amp; Data</button>
          <button data-paywall-privacy type="button" style="background:none;border:none;color:#35554a;font-size:0.82rem;cursor:pointer;padding:4px;font-weight:700">Privacy</button>
          <button data-paywall-terms type="button" style="background:none;border:none;color:#35554a;font-size:0.82rem;cursor:pointer;padding:4px;font-weight:700">Terms</button>
          <button data-paywall-sign-out type="button" style="background:none;border:none;color:#35554a;font-size:0.82rem;cursor:pointer;padding:4px;font-weight:700">Sign Out</button>
        </div>
      </div>
    </div>
  </div>`;
}

function bindPaywallActions(root: HTMLElement): void {
  root.querySelector<HTMLElement>('[data-paywall-close]')?.addEventListener('click', () => {
    paywallOpen = false;
    render();
  });
  root.querySelectorAll<HTMLElement>('[data-paywall-plan]').forEach(button => {
    button.addEventListener('click', () => {
      selectSubscriptionPlan((button.dataset.paywallPlan || 'yearly') as SubscriptionPlanId);
      renderPaywall();
    });
  });
  root.querySelector<HTMLElement>('[data-paywall-start]')?.addEventListener('click', () => {
    void startSubscriptionPurchase();
  });
  root.querySelector<HTMLElement>('[data-paywall-dev-bypass]')?.addEventListener('click', () => {
    setDevPaywallBypassed();
    paywallOpen = false;
    toast('v2 TestFlight bypass enabled');
    render();
  });
  root.querySelector<HTMLElement>('[data-paywall-retry]')?.addEventListener('click', () => void showPaywall());
  root.querySelector<HTMLElement>('[data-paywall-restore]')?.addEventListener('click', () => void restoreSubscriptionFromPaywall());
  root.querySelector<HTMLElement>('[data-paywall-account]')?.addEventListener('click', openPaywallAccountOptions);
  root.querySelector<HTMLElement>('[data-paywall-privacy]')?.addEventListener('click', openPrivacyPolicy);
  root.querySelector<HTMLElement>('[data-paywall-terms]')?.addEventListener('click', openTermsOfUse);
  root.querySelector<HTMLElement>('[data-paywall-sign-out]')?.addEventListener('click', () => {
    void sendDeviceToLandingAfterAccountChange();
  });
}

async function startSubscriptionPurchase(): Promise<void> {
  setPaywallPrimaryBusy(true);
  const result = await purchaseSelectedPlan();
  setPaywallPrimaryBusy(false);
  if (result.ok) {
    paywallOpen = false;
    toast('Subscription active!');
    render();
    return;
  }
  if (result.message) toast(result.message);
}

function setPaywallPrimaryBusy(isBusy: boolean): void {
  const button = document.querySelector<HTMLButtonElement>('[data-paywall-start]');
  if (!button) return;
  button.disabled = isBusy;
  button.style.opacity = isBusy ? '0.76' : '1';
  button.textContent = isBusy ? 'Checking subscription...' : `Start ${subscriptionState.trialDays || 7}-Day Free Trial`;
}

function isDevPaywallBypassed(): boolean {
  if (!useDevFirestore()) return false;
  try {
    return window.localStorage.getItem(DEV_PAYWALL_BYPASS_KEY) === '1';
  } catch {
    return false;
  }
}

function setDevPaywallBypassed(): void {
  subscriptionState.isPro = true;
  try {
    window.localStorage.setItem(DEV_PAYWALL_BYPASS_KEY, '1');
  } catch {}
}

async function restoreSubscriptionFromPaywall(): Promise<void> {
  renderLoadingScreen('Restoring');
  const restored = await restorePurchases();
  if (restored) {
    paywallOpen = false;
    toast('Subscription restored!');
    render();
  } else {
    await showPaywall();
    toast('No active subscription found');
  }
}

async function restoreSubscriptionFromSettings(): Promise<void> {
  const restored = await restorePurchases();
  toast(restored ? 'Subscription restored!' : 'No active subscription found');
  rerenderSettingsPane();
}

function openPaywallAccountOptions(): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay" data-modal-overlay style="z-index:10000">
      <div class="modal quick-action-modal quick-action-modal-wide" role="dialog" aria-modal="true">
        <div class="modal-title"><i class="ph-duotone ph-user-circle" style="color:#6C63FF;font-size:1.2rem;vertical-align:middle"></i> Account &amp; Data</div>
        <p style="font-size:0.9rem;color:var(--muted);line-height:1.5;margin:6px 0 14px">Subscription status never blocks account and data controls.</p>
        <button class="btn btn-secondary btn-full" data-paywall-manage-subscription type="button">Manage Subscription</button>
        <button class="btn btn-secondary btn-full" style="margin-top:8px" data-paywall-restore-account type="button">Restore Purchases</button>
        <button class="btn btn-secondary btn-full" style="margin-top:8px" data-paywall-leave-device type="button">Sign Out</button>
        <button class="btn btn-danger btn-full" style="margin-top:8px" data-paywall-delete-account type="button">Delete Account</button>
      </div>
    </div>`;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelector<HTMLElement>('[data-paywall-manage-subscription]')?.addEventListener('click', openManageSubscriptions);
  root.querySelector<HTMLElement>('[data-paywall-restore-account]')?.addEventListener('click', () => void restoreSubscriptionFromPaywall());
  root.querySelector<HTMLElement>('[data-paywall-leave-device]')?.addEventListener('click', () => void sendDeviceToLandingAfterAccountChange());
  root.querySelector<HTMLElement>('[data-paywall-delete-account]')?.addEventListener('click', () => openDeleteAccountConfirm(null));
}

function openResetAllDataConfirm(triggerEl?: Element | null): void {
  openDestructiveSettingsConfirm({
    triggerEl,
    icon: 'ph-warning-circle',
    title: 'Reset All Data?',
    message: 'This will permanently erase all family data, including tasks, prizes, history, member profiles, and settings. This cannot be undone.',
    doubleTitle: 'Final Reset Confirmation',
    doubleMessage: 'Type reset to permanently erase this family.',
    confirmText: 'reset',
    confirmLabel: 'Reset',
    onConfirm: resetAllFamilyData,
  });
}

function openDeleteAccountConfirm(triggerEl?: Element | null): void {
  openDestructiveSettingsConfirm({
    triggerEl,
    icon: 'ph-user-minus',
    title: 'Delete Account?',
    message: 'This will permanently delete your account and all associated family data. Your sign-in credentials will be removed and you will be signed out.',
    subscriptionWarning: "Deleting your account does not cancel your subscription. Cancel it first in your iPhone's subscription settings to avoid future charges.",
    doubleTitle: 'Final Confirmation',
    doubleMessage: 'Your account and all family data will be permanently deleted. This cannot be undone.',
    confirmText: 'delete',
    confirmLabel: 'Continue',
    onConfirm: deleteAccountAndReturnHome,
  });
}

function openDestructiveSettingsConfirm(options: {
  triggerEl?: Element | null;
  icon: string;
  title: string;
  message: string;
  doubleTitle: string;
  doubleMessage: string;
  confirmText: string;
  confirmLabel: string;
  subscriptionWarning?: string;
  onConfirm: () => Promise<void> | void;
}): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  const warning = options.subscriptionWarning || 'This does not cancel your subscription. Manage billing separately in your iPhone\'s subscription settings.';
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="${modalOriginStyle(options.triggerEl?.getBoundingClientRect())}">
      <div class="modal quick-action-modal quick-action-modal-wide modal-origin-sheet" role="dialog" aria-modal="true">
        <div class="modal-title"><i class="ph-duotone ${escapeHtmlAttr(options.icon)}" style="color:#DC2626;font-size:1.2rem;vertical-align:middle"></i> ${escapeHtmlAttr(options.title)}</div>
        <p style="font-size:0.9rem;color:var(--muted);line-height:1.5;margin:6px 0 14px">${escapeHtmlAttr(options.message)}</p>
        <div style="background:#FEF9C3;border:1.5px solid #F59E0B;border-radius:10px;padding:10px 12px;font-size:0.82rem;color:#78350F;line-height:1.5;margin-bottom:14px"><strong>Active subscription?</strong> ${escapeHtmlAttr(warning)}</div>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-close-modal type="button">Cancel</button>
          <button class="btn btn-danger" data-danger-next type="button">Continue</button>
        </div>
      </div>
    </div>`;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelector<HTMLElement>('[data-danger-next]')?.addEventListener('click', () => {
    root.innerHTML = `
      <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="${modalOriginStyle(options.triggerEl?.getBoundingClientRect())}">
        <div class="modal quick-action-modal quick-action-modal-wide modal-origin-sheet" role="dialog" aria-modal="true">
          <div class="modal-title"><i class="ph-duotone ${escapeHtmlAttr(options.icon)}" style="color:#DC2626;font-size:1.2rem;vertical-align:middle"></i> ${escapeHtmlAttr(options.doubleTitle)}</div>
          <p style="font-size:0.9rem;color:var(--muted);line-height:1.5;margin:6px 0 12px">${escapeHtmlAttr(options.doubleMessage)}</p>
          <input data-danger-confirm-input type="text" autocomplete="off" autocorrect="off" spellcheck="false" autocapitalize="none" placeholder="${escapeHtmlAttr(options.confirmText)}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:1rem;outline:none">
          <div data-danger-confirm-error style="min-height:18px;margin-top:8px;font-size:0.8rem;color:#DC2626;text-align:center"></div>
          <div class="modal-actions" style="margin-top:10px">
            <button class="btn btn-secondary" data-close-modal type="button">Cancel</button>
            <button class="btn btn-danger" data-danger-confirm type="button" disabled>${escapeHtmlAttr(options.confirmLabel)}</button>
          </div>
        </div>
      </div>`;
    root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
      if (event.target === event.currentTarget) closeModal();
    });
    root.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
    const input = root.querySelector<HTMLInputElement>('[data-danger-confirm-input]');
    const confirm = root.querySelector<HTMLButtonElement>('[data-danger-confirm]');
    input?.addEventListener('input', () => {
      if (confirm) confirm.disabled = input.value.trim().toLowerCase() !== options.confirmText;
    });
    root.querySelector<HTMLElement>('[data-danger-confirm]')?.addEventListener('click', () => {
      if ((input?.value || '').trim().toLowerCase() !== options.confirmText) {
        const error = root.querySelector<HTMLElement>('[data-danger-confirm-error]');
        if (error) error.textContent = `Type ${options.confirmText} to continue`;
        return;
      }
      void Promise.resolve(options.onConfirm()).catch(error => {
        console.warn(`${options.confirmLabel} failed:`, error);
        toast(`${options.confirmLabel} did not complete`);
      });
    });
    window.setTimeout(() => input?.focus(), 100);
  });
}

async function resetAllFamilyData(): Promise<void> {
  closeModal();
  closeSettingsPane();
  clearLocalAccountSecurityState();
  if (useDevFirestore()) {
    try {
      const { deleteDevFamilyData } = await import('../platform/firebase/dev-firestore-operations.js');
      await deleteDevFamilyData();
    } catch (error) {
      console.warn('Dev family reset failed:', error);
    }
  } else {
    resetLocalState();
  }
  await sendDeviceToLandingAfterAccountChange();
}

async function deleteAccountAndReturnHome(): Promise<void> {
  closeModal();
  closeSettingsPane();
  clearLocalAccountSecurityState();
  const authUid = getCurrentParentAuthUid();
  if (useDevFirestore()) {
    try {
      const { deleteDevFamilyData, deleteDevUserDoc } = await import('../platform/firebase/dev-firestore-operations.js');
      await deleteDevFamilyData();
      await deleteDevUserDoc({ uid: authUid });
    } catch (error) {
      console.warn('Dev family delete failed:', error);
    }
  } else {
    resetLocalState();
  }
  try {
    await deleteCurrentParentAuth();
  } catch (error) {
    console.warn('Firebase account delete failed:', error);
  }
  await sendDeviceToLandingAfterAccountChange();
}

function clearLocalAccountSecurityState(): void {
  try {
    window.localStorage.removeItem('gemsprout.v2.biometricCredentialId');
  } catch {}
  appLockPinBuffer = '';
  appLockRequired = false;
  appLockOpen = false;
}

async function sendDeviceToLandingAfterAccountChange(): Promise<void> {
  try {
    await signOutParentAuth();
  } catch (error) {
    console.warn('Parent sign-out failed after account change:', error);
  }
  activeViewerMemberId = null;
  activeParentTab = 'overview';
  activeKidTab = 'chores';
  activeSettingsPage = 'main';
  activeOnboardingStep = null;
  landingMode = 'landing';
  signInMessage = '';
  kidEntryMessage = '';
  kidEntryMembers = [];
  firestoreState = null;
  firestoreError = '';
  const url = new URL(window.location.href);
  if (useDevFirestore()) url.searchParams.set('source', 'firestore');
  url.searchParams.set('landing', '1');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  render();
}

function openSettingsAddUserModal(triggerEl?: Element | null): void {
  const state = currentDemoState();
  const code = String(state.familyCode || '------').toUpperCase();
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="${modalOriginStyle(triggerEl?.getBoundingClientRect())}">
      <div class="modal quick-action-modal quick-action-modal-wide modal-origin-sheet" role="dialog" aria-modal="true">
        <div style="text-align:center;padding:4px 0 8px">
          <i class="ph-duotone ph-users" style="font-size:2.5rem;color:#6C63FF"></i>
          <div class="modal-title" style="margin-top:8px">Add user</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin:8px 0 6px">
          <div style="font-size:2rem;font-weight:900;letter-spacing:0.18em;color:#6C63FF;font-family:'Jost','Avenir Next','Segoe UI',system-ui,sans-serif">${escapeHtmlAttr(code)}</div>
          <button data-copy-family-code style="background:none;border:none;cursor:pointer;padding:4px;line-height:1" type="button" aria-label="Copy family code">
            <i class="ph-duotone ph-copy" style="font-size:1.5rem;color:#6C63FF;vertical-align:middle"></i>
          </button>
        </div>
        <div style="font-size:0.8rem;color:var(--muted);text-align:center;margin-bottom:18px">Use this code to add a kid's device to your family, or use the QR code below</div>
        <div style="display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
          <button class="btn btn-secondary btn-sm" data-settings-kid-qr type="button">
            <i class="ph-duotone ph-qr-code" style="font-size:0.9rem;vertical-align:middle"></i> Add with QR code
          </button>
          <button class="btn btn-secondary btn-sm" data-settings-invite-parent type="button">
            <i class="ph-duotone ph-user-plus" style="font-size:0.9rem;vertical-align:middle"></i> Invite a parent
          </button>
        </div>
        <div class="modal-actions" style="margin-top:12px">
          <button class="btn btn-secondary" data-close-modal type="button">Done</button>
        </div>
      </div>
    </div>`;
  bindSettingsAddUserModalActions();
}

function bindSettingsAddUserModalActions(): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelector<HTMLElement>('[data-copy-family-code]')?.addEventListener('click', () => {
    const code = String(currentDemoState().familyCode || '').toUpperCase();
    void navigator.clipboard?.writeText(code);
  });
  root.querySelector<HTMLElement>('[data-settings-kid-qr]')?.addEventListener('click', openSettingsKidQrModal);
  root.querySelector<HTMLElement>('[data-settings-invite-parent]')?.addEventListener('click', openSettingsInviteParentModal);
}

function openSettingsKidQrModal(): void {
  const code = String(currentDemoState().familyCode || '------').toUpperCase();
  const root = document.getElementById('modal-root');
  if (!root) return;
  const overlayStyle = root.querySelector<HTMLElement>('[data-modal-overlay]')?.getAttribute('style') || modalOriginStyle();
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay" data-modal-overlay style="${overlayStyle}">
      <div class="modal quick-action-modal quick-action-modal-wide" role="dialog" aria-modal="true">
        <div style="text-align:center;padding:4px 0 8px">
          <i class="ph-duotone ph-device-mobile" style="font-size:2.5rem;color:#6C63FF"></i>
          <div class="modal-title" style="margin-top:8px">Add a kid device</div>
          <p style="font-size:0.88rem;color:var(--muted);margin:8px 0 16px;line-height:1.5">On the kid's device, open GemSprout, tap <strong>I'm a Kid</strong>, then scan this QR code or type the code below.</p>
        </div>
        <div style="display:flex;justify-content:center;margin-bottom:14px">
          <div style="width:200px;height:200px;display:grid;grid-template-columns:repeat(7,1fr);gap:5px;background:#fff;border:1px solid rgba(76,29,149,0.08);border-radius:18px;box-shadow:inset 0 1px 0 rgba(255,255,255,0.8);padding:18px;box-sizing:border-box">
            ${Array.from({ length: 49 }, (_, index) => `<span style="background:${index % 3 === 0 || index % 7 === 0 || [2, 10, 16, 28, 36, 40].includes(index) ? '#4C1D95' : '#fff'};border-radius:2px"></span>`).join('')}
          </div>
        </div>
        <div style="text-align:center;font-size:1.8rem;font-weight:900;letter-spacing:0.2em;color:#4C1D95;font-family:'Jost','Avenir Next','Segoe UI',system-ui,sans-serif;margin-bottom:16px">${escapeHtmlAttr(code)}</div>
        <button class="btn btn-secondary" style="width:100%" data-settings-add-user-back type="button">Done</button>
      </div>
    </div>`;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelector<HTMLElement>('[data-settings-add-user-back]')?.addEventListener('click', () => openSettingsAddUserModal());
}

function openSettingsInviteParentModal(): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  const overlayStyle = root.querySelector<HTMLElement>('[data-modal-overlay]')?.getAttribute('style') || modalOriginStyle();
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay" data-modal-overlay style="${overlayStyle}">
      <div class="modal quick-action-modal quick-action-modal-wide" role="dialog" aria-modal="true">
        <div style="text-align:center;padding:4px 0 8px">
          <i class="ph-duotone ph-user-plus" style="font-size:2.5rem;color:#6C63FF"></i>
          <div class="modal-title" style="margin-top:8px">Add a parent</div>
          <p style="font-size:0.88rem;color:var(--muted);margin:8px 0 16px;line-height:1.5">Enter the email they'll use to sign in with Google or Apple. No email will be sent; just have them open GemSprout and sign in with this account.</p>
        </div>
        <div id="invite-modal-body" style="min-height:210px;display:flex;flex-direction:column">
          <input data-invite-email type="email" placeholder="partner@email.com" autocomplete="email" style="width:100%;box-sizing:border-box;padding:12px 14px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:1rem;margin-bottom:16px;outline:none">
          <div style="margin-top:auto">
            <button class="btn btn-primary" style="width:100%" data-submit-parent-invite type="button">
              <i class="ph-duotone ph-user-plus" style="vertical-align:middle;margin-right:6px"></i> Add parent
            </button>
            <button class="btn btn-secondary" style="width:100%;margin-top:8px" data-settings-add-user-back type="button">Cancel</button>
          </div>
        </div>
      </div>
    </div>`;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelector<HTMLElement>('[data-settings-add-user-back]')?.addEventListener('click', () => openSettingsAddUserModal());
  root.querySelector<HTMLElement>('[data-submit-parent-invite]')?.addEventListener('click', () => {
    void submitSettingsParentInvite();
  });
  window.setTimeout(() => root.querySelector<HTMLInputElement>('[data-invite-email]')?.focus(), 100);
}

async function submitSettingsParentInvite(): Promise<void> {
  const root = document.getElementById('modal-root');
  const email = root?.querySelector<HTMLInputElement>('[data-invite-email]')?.value.trim().toLowerCase() || '';
  if (!email || !email.includes('@')) return;
  const body = root?.querySelector<HTMLElement>('#invite-modal-body');
  if (!body) return;
  if (useDevFirestore()) {
    const button = root?.querySelector<HTMLButtonElement>('[data-submit-parent-invite]');
    if (button) {
      button.disabled = true;
      button.textContent = 'Saving...';
    }
    try {
      const { commitDevParentInvite } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevParentInvite({
        email,
        familyCode: String(currentDemoState().familyCode || ''),
        createdByMemberId: activeViewerMemberId || '',
      });
    } catch {
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="ph-duotone ph-user-plus" style="vertical-align:middle;margin-right:6px"></i> Add parent';
      }
      return;
    }
  }
  body.innerHTML = `
    <div style="text-align:center;padding:8px 0">
      <i class="ph-duotone ph-check-circle" style="font-size:2rem;color:var(--green)"></i>
      <div style="font-weight:700;margin:8px 0 4px">All set!</div>
      <div style="font-size:0.85rem;color:var(--muted);margin-bottom:16px"><strong>${escapeHtmlAttr(email)}</strong> is ready. Have them open GemSprout and sign in with this account to join your family automatically.</div>
      <button class="btn btn-secondary" style="width:100%" data-close-modal type="button">Done</button>
    </div>`;
  body.querySelector<HTMLElement>('[data-close-modal]')?.addEventListener('click', closeModal);
}

function openSettingsChangelogModal(triggerEl?: Element | null): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="${modalOriginStyle(triggerEl?.getBoundingClientRect())}">
      <div class="modal quick-action-modal modal-origin-sheet" role="dialog" aria-modal="true">
        <div style="text-align:center;margin-bottom:16px">
          <i class="ph-duotone ph-leaf" style="color:#16A34A;font-size:2.2rem"></i>
          <div class="modal-title" style="margin-top:6px">Welcome To GemSprout</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${[
            ['ph-users-three', '#6C63FF', 'Team prizes can be reset by parents so family goals can repeat without starting over'],
            ['ph-device-mobile', '#16A34A', 'Layout and responsiveness improvements across a wide range of screen sizes'],
            ['ph-sparkle', '#F97316', 'A cleaner v2 foundation for setup, dashboards, and settings parity'],
          ].map(item => `
            <div style="display:flex;align-items:flex-start;gap:8px">
              <i class="ph-duotone ${item[0]}" style="color:${item[1]};font-size:1rem;flex-shrink:0;margin-top:1px"></i>
              <div style="font-size:0.88rem;color:var(--text);line-height:1.4">${item[2]}</div>
            </div>
          `).join('')}
        </div>
        <div class="modal-actions" style="margin-top:16px">
          <button class="btn btn-primary" style="width:100%" data-close-modal type="button">Awesome!</button>
        </div>
      </div>
    </div>`;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
}

async function setFamilySplitHousehold(enabled: boolean): Promise<void> {
  const state = currentDemoState();
  const kids = state.members.filter(member => member.role !== 'parent' && !member.deleted && member.id);
  const patches = kids.map(member => {
    const existing = member.splitHousehold || {};
    return {
      memberId: String(member.id),
      patch: {
        splitHousehold: {
          enabled,
          cycle: Array.isArray(existing.cycle) ? existing.cycle : Array(14).fill(true),
          referenceMonday: existing.referenceMonday || getMostRecentMonday(),
          overrides: existing.overrides || {},
        },
      },
    };
  });
  await Promise.all(patches.map(item => saveMemberPatch(item.memberId, item.patch)));
}

async function setMemberTodayPresence(memberId: string, isHere: boolean): Promise<void> {
  const state = currentDemoState();
  const member = state.members.find(item => item.id === memberId);
  if (!member) return;
  const todayKey = todayKeyForApp();
  const splitHousehold = member.splitHousehold?.enabled
    ? {
        ...member.splitHousehold,
        cycle: Array.isArray(member.splitHousehold.cycle) ? member.splitHousehold.cycle : Array(14).fill(true),
        referenceMonday: member.splitHousehold.referenceMonday || getMostRecentMonday(),
        overrides: { ...(member.splitHousehold.overrides || {}), [todayKey]: isHere },
      }
    : member.splitHousehold;
  const settingsOpen = document.getElementById('settings-root')?.classList.contains('open') === true;
  await saveMemberPatch(memberId, {
    isHereToday: isHere,
    ...(splitHousehold ? { splitHousehold } : {}),
  }, { rerenderSettings: settingsOpen, rerenderApp: settingsOpen });
}

function openSplitHouseholdModal(triggerEl?: Element | null): void {
  const state = currentDemoState();
  const kids = state.members.filter(member => member.role !== 'parent' && !member.deleted);
  const source = kids.find(member => member.splitHousehold?.enabled) || kids[0];
  if (!source) return;
  const split = source.splitHousehold || {};
  const cycle = Array.isArray(split.cycle) && split.cycle.length === 14 ? split.cycle : Array(14).fill(true);
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekGrid = (weekIndex: number) => dayLabels.map((label, dayIndex) => {
    const pos = weekIndex * 7 + dayIndex;
    const here = cycle[pos] !== false;
    return `<button class="sh-day-btn ${here ? 'here' : 'away'}" data-split-day="${pos}" type="button">${label}</button>`;
  }).join('');
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="${modalOriginStyle(triggerEl?.getBoundingClientRect())}">
      <div class="modal quick-action-modal quick-action-modal-wide modal-origin-sheet" role="dialog" aria-modal="true">
        <button class="modal-close-x" type="button" aria-label="Close" data-close-modal><span aria-hidden="true">&times;</span></button>
        <div class="modal-title"><i class="ph-duotone ph-house" style="color:#6C63FF;font-size:1.2rem;vertical-align:middle"></i> Split household schedule</div>
        <div class="form-group">
          <label class="form-label">Week 1 starts on <span class="form-label-hint">any Monday</span></label>
          <input type="date" data-split-reference-monday value="${escapeHtmlAttr(String(split.referenceMonday || getMostRecentMonday()))}">
        </div>
        <div class="form-group" style="margin-bottom:4px">
          <label class="form-label">Schedule <span class="form-label-hint">tap a day to toggle home / away</span></label>
          <div class="sh-section">
            <div class="sh-week-block">
              <div class="sh-week-label">Week 1</div>
              <div class="sh-days-row">${weekGrid(0)}</div>
            </div>
            <div class="sh-week-block">
              <div class="sh-week-label">Week 2</div>
              <div class="sh-days-row">${weekGrid(1)}</div>
            </div>
          </div>
        </div>
        <div style="display:flex;gap:6px;font-size:0.78rem;color:var(--muted);margin-top:8px">
          <i class="ph-duotone ph-lightbulb" style="color:#F59E0B;flex-shrink:0;margin-top:2px"></i>
          <span>Completing a task on an away day automatically toggles the kid to home. Use the Home / Away toggles in Settings to make one-off changes.</span>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-close-modal type="button">Cancel</button>
          <button class="btn btn-primary" data-save-split-household type="button">Save</button>
        </div>
      </div>
    </div>`;
  bindSplitHouseholdModalActions();
}

function bindSplitHouseholdModalActions(): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelectorAll<HTMLButtonElement>('[data-split-day]').forEach(button => {
    button.addEventListener('click', () => {
      const isHere = button.classList.contains('here');
      button.classList.toggle('here', !isHere);
      button.classList.toggle('away', isHere);
    });
  });
  root.querySelector<HTMLElement>('[data-save-split-household]')?.addEventListener('click', () => {
    void saveSplitHouseholdSchedule();
  });
}

async function saveSplitHouseholdSchedule(): Promise<void> {
  const root = document.getElementById('modal-root');
  if (!root) return;
  const referenceMonday = root.querySelector<HTMLInputElement>('[data-split-reference-monday]')?.value || getMostRecentMonday();
  const cycle = Array(14).fill(true);
  root.querySelectorAll<HTMLButtonElement>('[data-split-day]').forEach(button => {
    const pos = Number(button.dataset.splitDay || 0);
    cycle[pos] = button.classList.contains('here');
  });
  const state = currentDemoState();
  const kids = state.members.filter(member => member.role !== 'parent' && !member.deleted && member.id);
  await Promise.all(kids.map(member => saveMemberPatch(String(member.id), {
    splitHousehold: {
      ...(member.splitHousehold || {}),
      enabled: true,
      referenceMonday,
      cycle,
      overrides: member.splitHousehold?.overrides || {},
    },
  })));
  closeModal();
  rerenderSettingsPane(document.querySelector<HTMLElement>('#settings-root .settings-subpane')?.scrollTop || 0);
}

function getMostRecentMonday(): string {
  const date = new Date();
  const day = date.getDay();
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  return date.toISOString().slice(0, 10);
}

function openJoinDifferentFamilyConfirm(triggerEl?: Element | null): void {
  const root = document.getElementById('modal-root');
  if (!root) return;
  joinDifferentFamilyConfirmOpen = true;
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="${modalOriginStyle(triggerEl?.getBoundingClientRect())}">
      <div class="modal quick-action-modal quick-action-modal-wide modal-origin-sheet" role="dialog" aria-modal="true">
        <div class="modal-title"><i class="ph-duotone ph-link-break" style="color:#EF4444;font-size:1.2rem;vertical-align:middle"></i> Join Different Family?</div>
        <p style="margin:0 0 20px;color:var(--muted);font-size:0.95rem;line-height:1.5">This will disconnect this device from your current family. Your family's data stays safe in the cloud; you'll just need to log in to rejoin.</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-join-family-cancel type="button">Cancel</button>
          <button class="btn btn-danger" data-join-family-continue type="button">Continue</button>
        </div>
      </div>
    </div>`;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeJoinDifferentFamilyConfirm();
  });
  root.querySelector<HTMLElement>('[data-join-family-cancel]')?.addEventListener('click', closeJoinDifferentFamilyConfirm);
  root.querySelector<HTMLElement>('[data-join-family-continue]')?.addEventListener('click', () => {
    void confirmJoinDifferentFamily();
  });
}

function closeJoinDifferentFamilyConfirm(): void {
  joinDifferentFamilyConfirmOpen = false;
  closeModal();
}

async function confirmJoinDifferentFamily(): Promise<void> {
  joinDifferentFamilyConfirmOpen = false;
  closeModal();
  try {
    await signOutParentAuth();
  } catch (error) {
    console.warn('Parent sign-out failed before family switch:', error);
  }
  activeViewerMemberId = null;
  activeParentTab = 'overview';
  activeKidTab = 'chores';
  activeSettingsPage = 'main';
  landingMode = 'landing';
  signInMessage = '';
  kidEntryMessage = '';
  kidEntryMembers = [];
  firestoreState = null;
  firestoreError = '';
  closeSettingsPane();
  const url = new URL(window.location.href);
  url.searchParams.set('source', 'firestore');
  url.searchParams.set('landing', '1');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  render();
}

function openParentQuickFan(): void {
  const host = document.getElementById('parent-quick-launch');
  const trigger = host?.querySelector<HTMLElement>('.hero-quick-trigger');
  if (!host || !trigger) return;
  if (parentQuickCloseTimer) {
    window.clearTimeout(parentQuickCloseTimer);
    parentQuickCloseTimer = null;
  }
  host.classList.remove('closing');
  host.classList.add('open');
  host.setAttribute('aria-expanded', 'true');
  const rect = trigger.getBoundingClientRect();
  const positions = [
    { dx: -6, dy: 106 },
    { dx: -103, dy: 84 },
    { dx: -174, dy: 26 },
  ];
  host.querySelectorAll<HTMLElement>('.hero-quick-action').forEach((node, index) => {
    const pos = positions[index] || positions[positions.length - 1];
    const width = node.offsetWidth || 104;
    const maxLeft = Math.max(12, window.innerWidth - width - 12);
    const left = Math.min(maxLeft, Math.max(12, rect.right - width + pos.dx));
    const top = Math.min(window.innerHeight - 60, Math.max(12, rect.top + pos.dy));
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
  });
}

function closeParentQuickFan(): void {
  const host = document.getElementById('parent-quick-launch');
  if (!host) return;
  host.classList.remove('open');
  host.classList.add('closing');
  host.setAttribute('aria-expanded', 'false');
  if (parentQuickCloseTimer) window.clearTimeout(parentQuickCloseTimer);
  parentQuickCloseTimer = window.setTimeout(() => {
    host.classList.remove('closing');
    parentQuickCloseTimer = null;
  }, 180);
}

function uiHintsEnabled(): boolean {
  return currentSettings().tooltipBounceEnabled !== false;
}

function clearUiHintAnimations(): void {
  document.querySelectorAll('.hint-bounce').forEach(node => node.classList.remove('hint-bounce'));
  document.getElementById('parent-quick-launch')?.classList.remove('coach-mark');
  if (parentQuickCoachTimer) {
    window.clearTimeout(parentQuickCoachTimer);
    parentQuickCoachTimer = null;
  }
}

function bounceFirstHint(selector: string, scope: Document | HTMLElement = document): void {
  if (!uiHintsEnabled()) {
    clearUiHintAnimations();
    return;
  }
  const state = currentDemoState();
  const viewer = getActiveViewer(state);
  const nextScope = viewer?.role === 'parent'
    ? `parent:${activeParentTab}`
    : viewer?.role === 'kid'
      ? `kid:${viewer.id || 'kid'}:${activeKidTab}`
      : 'home';
  if (uiHintBounceScope !== nextScope) {
    uiHintBounceScope = nextScope;
    uiHintBounceKeys.clear();
  }
  const hintKey = `${nextScope}:${selector}`;
  if (uiHintBounceKeys.has(hintKey)) return;
  uiHintBounceKeys.add(hintKey);
  window.setTimeout(() => {
    if (!uiHintsEnabled()) return;
    const first = scope.querySelector<HTMLElement>(selector);
    if (!first) return;
    first.classList.remove('hint-bounce');
    void first.offsetWidth;
    first.classList.add('hint-bounce');
    window.setTimeout(() => first.classList.remove('hint-bounce'), 2200);
  }, 180);
}

function showParentQuickCoachMark(): void {
  if (!uiHintsEnabled()) {
    clearUiHintAnimations();
    return;
  }
  window.setTimeout(() => {
    if (!uiHintsEnabled()) return;
    const host = document.getElementById('parent-quick-launch');
    const trigger = host?.querySelector<HTMLElement>('.hero-quick-trigger');
    if (!host) return;
    host.classList.remove('coach-mark');
    void host.offsetWidth;
    host.classList.add('coach-mark');
    if (parentQuickCoachTimer) window.clearTimeout(parentQuickCoachTimer);
    if (trigger) {
      const handleEnd = () => {
        host.classList.remove('coach-mark');
        trigger.removeEventListener('animationend', handleEnd);
        if (parentQuickCoachTimer) {
          window.clearTimeout(parentQuickCoachTimer);
          parentQuickCoachTimer = null;
        }
      };
      trigger.addEventListener('animationend', handleEnd);
    }
    parentQuickCoachTimer = window.setTimeout(() => {
      host.classList.remove('coach-mark');
      parentQuickCoachTimer = null;
    }, 2800);
  }, 180);
}

function rerenderActiveQuickActionModal(): void {
  if (!activeQuickActionId || !activeQuickActionState) return;
  const state = currentDemoState();
  const root = document.getElementById('modal-root');
  if (!root) return;
  const originX = activeQuickActionOrigin?.x || window.innerWidth / 2;
  const originY = activeQuickActionOrigin?.y || window.innerHeight / 2;
  const existingOverlay = root.querySelector<HTMLElement>('[data-modal-overlay]');
  const existingModal = root.querySelector<HTMLElement>('.quick-action-modal');
  if (existingOverlay && existingModal) {
    existingOverlay.style.setProperty('--modal-origin-x', `${originX}px`);
    existingOverlay.style.setProperty('--modal-origin-y', `${originY}px`);
    existingModal.innerHTML = renderParentQuickActionModal(activeQuickActionId, state, activeQuickActionState);
  } else {
    root.innerHTML = `
      <div class="modal-overlay quick-modal-overlay modal-overlay-origin" data-modal-overlay style="--modal-origin-x:${originX}px;--modal-origin-y:${originY}px">
        <div class="modal quick-action-modal quick-action-modal-wide modal-origin-sheet" role="dialog" aria-modal="true">
          ${renderParentQuickActionModal(activeQuickActionId, state, activeQuickActionState)}
        </div>
      </div>
    `;
  }
  bindQuickActionModal();
}

function bindQuickActionModal(): void {
  const root = document.getElementById('modal-root');
  if (!root || !activeQuickActionId || !activeQuickActionState) return;
  root.querySelector<HTMLElement>('[data-modal-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeModal();
  });
  root.querySelectorAll<HTMLElement>('[data-close-modal]').forEach(button => button.addEventListener('click', closeModal));

  if (activeQuickActionId === 'listening') bindListeningQuickActionModal();
  if (activeQuickActionId === 'savings') bindSavingsQuickActionModal();
  if (activeQuickActionId === 'gems') bindGemsQuickActionModal();
}

function bindListeningQuickActionModal(): void {
  rootKidSelectionToggle('listening');
  const holdButton = document.querySelector<HTMLElement>('[data-nl-hold]');
  const start = (event?: Event) => {
    event?.preventDefault();
    const state = activeQuickActionState?.listening;
    if (!state || state.isHolding) return;
    state.isHolding = true;
    listeningHoldStartedAt = Date.now();
    holdButton?.classList.add('holding');
    holdButton?.querySelector('.nl-hold-btn-text')?.replaceChildren(document.createTextNode('RUNNING'));
    holdButton?.querySelector('.nl-hold-hint')?.replaceChildren(document.createTextNode('Release to pause'));
    tickListeningQuickAction();
  };
  const stop = (event?: Event) => {
    event?.preventDefault();
    const state = activeQuickActionState?.listening;
    if (!state || !state.isHolding) return;
    state.accumulatedMs += Date.now() - listeningHoldStartedAt;
    state.isHolding = false;
    state.diamondsLost = Math.floor(state.accumulatedMs / (Math.max(1, Number(currentSettings().notListeningSecs || 60)) * 1000));
    listeningHoldStartedAt = 0;
    if (listeningRafId) {
      cancelAnimationFrame(listeningRafId);
      listeningRafId = 0;
    }
    rerenderActiveQuickActionModal();
  };
  holdButton?.addEventListener('pointerdown', start);
  holdButton?.addEventListener('pointerup', stop);
  holdButton?.addEventListener('pointercancel', stop);
  holdButton?.addEventListener('pointerleave', stop);
  document.querySelector<HTMLElement>('[data-quick-submit]')?.addEventListener('click', () => void submitListeningQuickAction());
}

function tickListeningQuickAction(): void {
  const state = activeQuickActionState?.listening;
  if (!state?.isHolding) return;
  const elapsedMs = state.accumulatedMs + (Date.now() - listeningHoldStartedAt);
  state.diamondsLost = Math.floor(elapsedMs / (Math.max(1, Number(currentSettings().notListeningSecs || 60)) * 1000));
  const timerEl = document.getElementById('nl-timer');
  const dmdsEl = document.getElementById('nl-dmds');
  const totalSecs = Math.floor(elapsedMs / 1000);
  const mins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
  const secs = String(totalSecs % 60).padStart(2, '0');
  if (timerEl) timerEl.textContent = `${mins}:${secs}`;
  if (dmdsEl) dmdsEl.textContent = state.diamondsLost > 0 ? `-${state.diamondsLost} gems so far` : 'Hold the button to deduct gems';
  listeningRafId = requestAnimationFrame(tickListeningQuickAction);
}

function bindSavingsQuickActionModal(): void {
  rootKidSelectionToggle('savings');
  document.querySelectorAll<HTMLElement>('[data-quick-sign]').forEach(button => {
    button.addEventListener('click', () => {
      const state = activeQuickActionState?.savings;
      if (!state) return;
      state.sign = button.getAttribute('data-quick-sign') === '-1' ? -1 : 1;
      rerenderActiveQuickActionModal();
    });
  });
  document.querySelector<HTMLInputElement>('[data-quick-amount]')?.addEventListener('input', event => {
    const state = activeQuickActionState?.savings;
    if (!state) return;
    state.amount = (event.currentTarget as HTMLInputElement).value;
  });
  document.querySelector<HTMLInputElement>('[data-quick-reason]')?.addEventListener('input', event => {
    const state = activeQuickActionState?.savings;
    if (!state) return;
    state.reason = (event.currentTarget as HTMLInputElement).value;
  });
  document.querySelector<HTMLElement>('[data-quick-submit]')?.addEventListener('click', () => void submitSavingsQuickAction());
}

function bindGemsQuickActionModal(): void {
  rootKidSelectionToggle('gems');
  document.querySelectorAll<HTMLElement>('[data-quick-sign]').forEach(button => {
    button.addEventListener('click', () => {
      const state = activeQuickActionState?.gems;
      if (!state) return;
      state.sign = button.getAttribute('data-quick-sign') === '-1' ? -1 : 1;
      rerenderActiveQuickActionModal();
    });
  });
  document.querySelector<HTMLInputElement>('[data-quick-amount]')?.addEventListener('input', event => {
    const state = activeQuickActionState?.gems;
    if (!state) return;
    state.amount = (event.currentTarget as HTMLInputElement).value;
  });
  document.querySelector<HTMLInputElement>('[data-quick-reason]')?.addEventListener('input', event => {
    const state = activeQuickActionState?.gems;
    if (!state) return;
    state.reason = (event.currentTarget as HTMLInputElement).value;
  });
  document.querySelector<HTMLElement>('[data-quick-submit]')?.addEventListener('click', () => void submitGemsQuickAction());
}

function rootKidSelectionToggle(actionId: ParentQuickActionId): void {
  document.querySelectorAll<HTMLElement>('[data-quick-kid]').forEach(button => {
    button.addEventListener('click', () => {
      const kidId = button.getAttribute('data-quick-kid') || '';
      if (!kidId || !activeQuickActionState) return;
      const state = actionId === 'listening'
        ? activeQuickActionState.listening
        : actionId === 'savings'
          ? activeQuickActionState.savings
          : activeQuickActionState.gems;
      if (!state) return;
      const set = new Set(state.selectedKidIds);
      if (set.has(kidId)) set.delete(kidId);
      else set.add(kidId);
      state.selectedKidIds = [...set];
      rerenderActiveQuickActionModal();
    });
  });
}

function makeHistoryId(prefix: string, memberId: string): string {
  return `history:manual:${prefix}:${memberId}:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
}

async function submitGemsQuickAction(): Promise<void> {
  const quick = activeQuickActionState?.gems;
  if (!quick) return;
  const amount = Number.parseInt(quick.amount, 10) || 0;
  if (!quick.selectedKidIds.length || amount <= 0) return;
  const delta = quick.sign * amount;
  const reason = quick.reason.trim() || (delta > 0 ? 'A special bonus from your parent!' : 'Gem adjustment');
  const prevState = cloneDemoState(firestoreState);
  const now = Date.now();
  if (useDevFirestore()) {
    if (!firestoreState) return;
    const updates = quick.selectedKidIds.map(memberId => ({
      memberId,
      history: {
        id: makeHistoryId('gems', memberId),
        familyId: 'migration-preview',
        memberId,
        type: 'bonus',
        title: reason,
        gems: delta,
        amount: null,
        createdAt: now,
      } as DemoHistoryRow,
      apply(member: DemoMember) {
        const gems = Math.max(0, Number(member.gems || member.diamonds || 0) + delta);
        return {
          ...member,
          gems,
          diamonds: gems,
          totalEarned: delta > 0 ? Number(member.totalEarned || 0) + delta : Number(member.totalEarned || 0),
        };
      },
    }));
    firestoreState = applyManualMemberUpdates(firestoreState, updates);
    render();
    try {
      const { commitDevManualQuickAction } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevManualQuickAction({ memberWrites: updates.map(item => ({ memberId: item.memberId, data: findMemberById(firestoreState, item.memberId) })), historyWrites: updates.map(item => item.history) });
      closeModal();
    } catch {
      firestoreState = prevState;
      render();
    }
    return;
  }

  store = loadSharedLabStore(createDemoFamilySeedStore);
  const updates = quick.selectedKidIds.map(memberId => ({
    memberId,
    history: {
      id: makeHistoryId('gems', memberId),
      familyId: LAB_FAMILY_ID,
      memberId,
      type: 'bonus',
      title: reason,
      gems: delta,
      amount: null,
      createdAt: now,
    } as DemoHistoryRow,
    apply(member: DemoMember) {
      const gems = Math.max(0, Number(member.gems || member.diamonds || 0) + delta);
      return {
        ...member,
        gems,
        diamonds: gems,
        totalEarned: delta > 0 ? Number(member.totalEarned || 0) + delta : Number(member.totalEarned || 0),
      };
    },
  }));
  applyManualUpdatesToStore(updates);
  saveSharedLabStore(store);
  closeModal();
  void renderLocalLab();
}

async function submitSavingsQuickAction(): Promise<void> {
  const quick = activeQuickActionState?.savings;
  if (!quick) return;
  const amount = Number.parseFloat(quick.amount) || 0;
  if (!quick.selectedKidIds.length || amount <= 0) return;
  const delta = Number((quick.sign * amount).toFixed(2));
  const reason = quick.reason.trim();
  const now = Date.now();
  const prevState = cloneDemoState(firestoreState);
  const historyType = delta > 0 ? 'savings_deposit' : 'savings_withdraw';
  const title = delta > 0 ? (reason || 'A savings deposit from your parent!') : (reason ? `Withdrawal: ${reason}` : 'Savings withdrawal');
  const updates = quick.selectedKidIds.map(memberId => ({
    memberId,
    history: {
      id: makeHistoryId('savings', memberId),
      familyId: useDevFirestore() ? 'migration-preview' : LAB_FAMILY_ID,
      memberId,
      type: historyType,
      title,
      gems: 0,
      amount: Math.abs(delta),
      createdAt: now,
    } as DemoHistoryRow,
    apply(member: DemoMember) {
      const next = delta < 0 ? reduceSavingsBuckets(member, Math.abs(delta)) : { ...member };
      return {
        ...next,
        savings: Math.max(0, Number((Number(member.savings || 0) + delta).toFixed(2))),
        savingsGifted: delta > 0 ? Number((Number(member.savingsGifted || 0) + delta).toFixed(2)) : next.savingsGifted,
      };
    },
  }));

  if (useDevFirestore()) {
    if (!firestoreState) return;
    firestoreState = applyManualMemberUpdates(firestoreState, updates);
    render();
    try {
      const { commitDevManualQuickAction } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevManualQuickAction({ memberWrites: updates.map(item => ({ memberId: item.memberId, data: findMemberById(firestoreState, item.memberId) })), historyWrites: updates.map(item => item.history) });
      closeModal();
    } catch {
      firestoreState = prevState;
      render();
    }
    return;
  }

  store = loadSharedLabStore(createDemoFamilySeedStore);
  applyManualUpdatesToStore(updates);
  saveSharedLabStore(store);
  closeModal();
  void renderLocalLab();
}

async function submitListeningQuickAction(): Promise<void> {
  const quick = activeQuickActionState?.listening;
  if (!quick) return;
  if (quick.isHolding) {
    quick.accumulatedMs += Date.now() - listeningHoldStartedAt;
    quick.isHolding = false;
  }
  const sessionSecs = Math.floor(quick.accumulatedMs / 1000);
  if (!quick.selectedKidIds.length || sessionSecs <= 0) return;
  const now = Date.now();
  const todayKey = todayKeyForApp(now);
  const secsPerGem = Math.max(1, Number(currentSettings().notListeningSecs || 60));
  const prevState = cloneDemoState(firestoreState);
  const state = currentDemoState();
  const updates = quick.selectedKidIds.map(memberId => {
    const member = state.members.find(item => item.id === memberId);
    const existingToday = member?.nlDate === todayKey ? Number(member.nlTodaySecs || 0) : 0;
    const existingPending = Number(member?.nlPendingSecs || 0);
    const totalPending = existingPending + sessionSecs;
    const appliedPenalty = Math.floor(totalPending / secsPerGem);
    const remainder = totalPending % secsPerGem;
    return {
      memberId,
      history: {
        id: makeHistoryId('penalty', memberId),
        familyId: useDevFirestore() ? 'migration-preview' : LAB_FAMILY_ID,
        memberId,
        type: 'penalty',
        title: 'Not listening penalty',
        gems: -appliedPenalty,
        amount: null,
        createdAt: now,
        metadata: { sessionSecs, secsPerGem },
      } as DemoHistoryRow,
      apply(current: DemoMember) {
        const existingLifetime = Number((current as DemoMember & { nlLifetimeSecs?: number }).nlLifetimeSecs || 0);
        const gems = Math.max(0, Number(current.gems || current.diamonds || 0) - appliedPenalty);
        return {
          ...current,
          nlDate: todayKey,
          nlTodaySecs: existingToday + sessionSecs,
          nlLifetimeSecs: existingLifetime + sessionSecs,
          nlPendingSecs: remainder,
          gems,
          diamonds: gems,
        } as DemoMember;
      },
    };
  });

  if (useDevFirestore()) {
    if (!firestoreState) return;
    firestoreState = applyManualMemberUpdates(firestoreState, updates);
    render();
    try {
      const { commitDevManualQuickAction } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevManualQuickAction({ memberWrites: updates.map(item => ({ memberId: item.memberId, data: findMemberById(firestoreState, item.memberId) })), historyWrites: updates.map(item => item.history) });
      closeModal();
    } catch {
      firestoreState = prevState;
      render();
    }
    return;
  }

  store = loadSharedLabStore(createDemoFamilySeedStore);
  applyManualUpdatesToStore(updates);
  saveSharedLabStore(store);
  closeModal();
  void renderLocalLab();
}

function findMemberById(state: DemoAppState | null, memberId: string): DemoMember | null {
  return state?.members.find(member => member.id === memberId) || null;
}

function applyManualMemberUpdates(
  current: DemoAppState | null,
  updates: Array<{ memberId: string; history: DemoHistoryRow; apply(member: DemoMember): DemoMember }>,
): DemoAppState | null {
  if (!current) return current;
  const next = cloneDemoState(current);
  next.members = next.members.map(member => {
    const update = updates.find(item => item.memberId === member.id);
    return update ? update.apply(member) : member;
  });
  if (next.member?.id) {
    const currentMember = next.members.find(member => member.id === next.member?.id);
    if (currentMember) next.member = currentMember;
  }
  next.historyRows = [...updates.map(item => item.history), ...next.historyRows].sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
  next.history = next.historyRows[0] || null;
  return next;
}

function applyManualUpdatesToStore(
  updates: Array<{ memberId: string; history: DemoHistoryRow; apply(member: DemoMember): DemoMember }>,
): void {
  updates.forEach(update => {
    const member = store.get<DemoMember>(memberPath(LAB_FAMILY_ID, update.memberId));
    if (!member) return;
    store.set(memberPath(LAB_FAMILY_ID, update.memberId), update.apply(member));
    store.set(historyPath(LAB_FAMILY_ID, update.history.id || ''), update.history);
  });
}

function openQuickActionModal(actionId: ParentQuickActionId, state: DemoAppState, sourceButton: HTMLElement): void {
  closeParentQuickFan();
  const rect = sourceButton.getBoundingClientRect();
  activeQuickActionId = actionId;
  activeQuickActionState = createInitialQuickActionState(actionId, state);
  activeQuickActionOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  rerenderActiveQuickActionModal();
}

function closeModal(): void {
  closeBadgeCard();
  if (listeningRafId) {
    cancelAnimationFrame(listeningRafId);
    listeningRafId = 0;
  }
  listeningHoldStartedAt = 0;
  activeQuickActionId = null;
  activeQuickActionState = null;
  activeQuickActionOrigin = null;
  activeTaskEditorDraft = null;
  activeTaskEditorMode = null;
  activeTaskId = null;
  activePrizeEditorDraft = null;
  activePrizeId = null;
  activeGoalEditorDraft = null;
  activeGoalId = null;
  activePrizeDeleteKind = null;
  activeIconPicker = null;
  kidProfileDraft = null;
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}

function renderLoading(): void {
  renderLoadingScreen();
}

function renderLoadingScreen(message = 'Loading'): void {
  showScreen('screen-auth');
  const auth = document.getElementById('screen-auth');
  if (!auth) return;
  auth.className = 'screen active loading';
  auth.style.cssText = 'height:100dvh;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;padding-top:calc(env(safe-area-inset-top,0px) + 20px);padding-right:20px;padding-bottom:calc(env(safe-area-inset-bottom,0px) + 20px);padding-left:20px;background:linear-gradient(180deg,#365e4f 0%,#365e4f 45%,#f4efe4 45%,#f4efe4 100%);align-items:center;justify-content:center;gap:16px;text-align:center;';
  auth.innerHTML = `
    <style>
      @keyframes _ldot { 0%,80%,100%{opacity:0;transform:translateY(0)} 40%{opacity:1;transform:translateY(-3px)} }
    </style>
    <div style="width:min(calc(100% - 40px),780px);transform:translateY(-5dvh);background:#fffdf8;border:1px solid rgba(39,66,57,0.14);border-radius:28px;padding:22px 18px 20px;box-shadow:0 20px 42px rgba(31,54,46,0.24)">
      <img src="/gemsprout.png" class="loading-img" style="width:108px;height:108px;display:block;margin:0 auto 10px" alt="GemSprout">
      <div style="color:#24453c;font-size:1.8rem;font-weight:900;letter-spacing:-0.02em">GemSprout</div>
      <div class="loading-text" style="margin-top:6px;color:#355b4e;font-size:0.98rem;font-weight:700;display:flex;align-items:center;justify-content:center;gap:2px">
        ${escapeHtmlAttr(message)}<span style="animation:_ldot 1.2s infinite 0s">.</span><span style="animation:_ldot 1.2s infinite 0.2s">.</span><span style="animation:_ldot 1.2s infinite 0.4s">.</span>
      </div>
    </div>
  `;
}

function renderError(message: string): void {
  showScreen('screen-parent');
  const content = document.getElementById('parent-content');
  if (content) content.innerHTML = `<section class="card"><div class="card-title">Could not load dev Firestore</div><div class="text-muted">${message}</div></section>`;
}

function ensureDevFirestoreSubscription(): void {
  if (!useDevFirestore() || devFirestoreUnsubscribe) return;
  devFirestoreUnsubscribe = subscribeDevFirestoreState(() => {
    scheduleDevFirestoreRefresh();
  });
}

function scheduleDevFirestoreRefresh(delayMs = 120): void {
  if (!useDevFirestore()) return;
  window.clearTimeout(devFirestoreRefreshTimer);
  devFirestoreRefreshTimer = window.setTimeout(() => {
    void refreshDevFirestoreState();
  }, delayMs);
}

async function refreshDevFirestoreState(options: { rerender?: boolean } = {}): Promise<void> {
  if (!useDevFirestore()) return;
  if (hasPendingFirestoreOverviewWrites()) {
    devFirestoreRefreshQueued = true;
    return;
  }
  if (devFirestoreRefreshInFlight) {
    devFirestoreRefreshQueued = true;
    return;
  }
  devFirestoreRefreshInFlight = true;
  try {
    firestoreState = await loadDevFirestoreState();
    firestoreError = '';
    void cleanupSettledCompletionPhotos();
    await syncNativeAppBadge();
    if (options.rerender !== false) void renderDevFirestore();
  } catch (error) {
    firestoreError = error instanceof Error ? error.message : String(error);
  } finally {
    devFirestoreRefreshInFlight = false;
    if (devFirestoreRefreshQueued) {
      devFirestoreRefreshQueued = false;
      scheduleDevFirestoreRefresh();
    }
  }
}

async function cleanupSettledCompletionPhotos(): Promise<void> {
  if (devPhotoCleanupInFlight || !useDevFirestore()) return;
  if (Date.now() - devPhotoCleanupLastRun < 30000) return;
  devPhotoCleanupInFlight = true;
  try {
    devPhotoCleanupLastRun = Date.now();
    const { cleanupDevSettledCompletionPhotos } = await import('../platform/firebase/dev-firestore-operations.js');
    await cleanupDevSettledCompletionPhotos({ undoableHistoryLimit: 5 });
  } catch {
    // Photo cleanup is a cost/privacy optimization; it should never block normal app refresh.
  } finally {
    devPhotoCleanupInFlight = false;
  }
}

async function syncNativeAppBadge(state = firestoreState): Promise<void> {
  const capacitor = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Badge?: { set?: (input: { count: number }) => Promise<void>; clear?: () => Promise<void> } } } }).Capacitor;
  if (!capacitor?.isNativePlatform?.()) return;
  const badge = capacitor.Plugins?.Badge;
  if (!badge) return;
  const count = pendingCount(state);
  if (count > 0) await badge.set?.({ count }).catch(() => undefined);
  else await badge.clear?.().catch(() => badge.set?.({ count: 0 }).catch(() => undefined));
}

async function renderDevFirestore(): Promise<void> {
  if (!firestoreState && !firestoreError) {
    renderLoading();
    try {
      firestoreState = await loadDevFirestoreState();
      ensureDevFirestoreSubscription();
    } catch (error) {
      firestoreError = error instanceof Error ? error.message : String(error);
    }
  }

  if (!firestoreState) {
    renderError(firestoreError || 'Unknown Firestore load error.');
    return;
  }
  ensureDevFirestoreSubscription();
  void cleanupSettledCompletionPhotos();
  void syncNativeAppBadge();
  maybeApplyAutoSavingsInterest(firestoreState);

  const activeViewer = getActiveViewer(firestoreState);
  if (!activeViewer) {
    showScreen('screen-home');
    const home = document.getElementById('screen-home');
    if (home) home.innerHTML = renderHomeScreen(firestoreState);
    bindHomeScreenActions(firestoreState);
    return;
  }
  if (activeViewer.role !== 'parent') {
    showScreen('screen-kid');
    const screen = document.getElementById('screen-kid');
    if (screen) screen.innerHTML = `${renderKidScreen(firestoreState, activeViewer, activeKidTab)}${activeKidTimeTaskId ? renderKidTimePicker(firestoreState, activeViewer, activeKidTimeTaskId) : ''}`;
    bindKidPlaceholderActions();
    restoreKidScrollPosition();
    if (!isLittleKidMode(activeViewer) && activeKidTab === 'chores') bounceFirstHint('.kid-routine-shell');
    reconcileKidNotificationModals(firestoreState, activeViewer, { onClose: () => void renderDevFirestore(), speak });
    return;
  }

  await ensureSubscriptionForState(firestoreState);
  if (shouldShowSubscriptionPaywall(activeViewer)) {
    if (!paywallOpen) await showPaywall();
    else renderPaywall();
    return;
  }
  paywallOpen = false;
  showScreen('screen-parent');
  maybeEnsureParentPushRegistration(firestoreState, activeViewer);
  const header = document.getElementById('parent-header');
  if (header) header.innerHTML = renderParentHeader(firestoreState, activeViewer);
  const nav = document.getElementById('parent-nav');
  if (nav) nav.innerHTML = renderParentNav(activeParentTab, pendingCount(firestoreState));
  const content = document.getElementById('parent-content');
  if (!content) return;
  const previousLayout = captureOverviewLayoutPositions();
  content.innerHTML = activeParentTab === 'tasks'
    ? renderParentTasks(firestoreState)
    : activeParentTab === 'prizes'
      ? renderParentPrizes(firestoreState)
      : activeParentTab === 'levels'
        ? renderParentLevels(firestoreState, pendingComboOverrides)
        : activeParentTab === 'stats'
          ? renderParentStats(firestoreState)
    : `${renderParentDashboard(firestoreState)}`;
  bindParentTabNav();
  bindFirestoreActions();
  if (activeParentTab === 'tasks') {
    bindTaskTabActions(firestoreState);
    bounceFirstHint('.parent-chore-shell');
  } else if (activeParentTab === 'prizes') {
    bindPrizeTabActions(firestoreState);
    bounceFirstHint('.parent-prize-shell');
  }
  else if (activeParentTab === 'levels') bindLevelsTabActions(firestoreState);
  else if (activeParentTab === 'stats') bindStatsTabActions(firestoreState);
  else {
    bindOverviewSwipeActions();
    animateOverviewLayoutShift(previousLayout);
    showParentQuickCoachMark();
    bounceFirstHint('.snapshot-summary-shell');
    bounceFirstHint('.activity-swipe-shell');
  }
  showWeekReviewIfNeeded(firestoreState);
}

async function renderLocalLab(): Promise<void> {
  store = loadSharedLabStore(createDemoFamilySeedStore);
  const state = readDemoAppState(store);
  maybeApplyAutoSavingsInterest(state);
  const activeViewer = getActiveViewer(state);
  if (!activeViewer) {
    showScreen('screen-home');
    const home = document.getElementById('screen-home');
    if (home) home.innerHTML = renderHomeScreen(state);
    bindHomeScreenActions(state);
    return;
  }
  if (activeViewer.role !== 'parent') {
    showScreen('screen-kid');
    const screen = document.getElementById('screen-kid');
    if (screen) screen.innerHTML = `${renderKidScreen(state, activeViewer, activeKidTab)}${activeKidTimeTaskId ? renderKidTimePicker(state, activeViewer, activeKidTimeTaskId) : ''}`;
    bindKidPlaceholderActions();
    restoreKidScrollPosition();
    if (!isLittleKidMode(activeViewer) && activeKidTab === 'chores') bounceFirstHint('.kid-routine-shell');
    reconcileKidNotificationModals(state, activeViewer, { onClose: () => { void renderLocalLab(); }, speak });
    return;
  }
  await ensureSubscriptionForState(state);
  if (shouldShowSubscriptionPaywall(activeViewer)) {
    if (!paywallOpen) await showPaywall();
    else renderPaywall();
    return;
  }
  paywallOpen = false;
  showScreen('screen-parent');

  const header = document.getElementById('parent-header');
  if (header) header.innerHTML = renderParentHeader(state, activeViewer);

  const nav = document.getElementById('parent-nav');
  if (nav) nav.innerHTML = renderParentNav(activeParentTab, pendingCount(state));

  const content = document.getElementById('parent-content');
  if (!content) return;
  const previousLayout = captureOverviewLayoutPositions();
  content.innerHTML = activeParentTab === 'tasks'
    ? `${renderParentTasks(state)}${showLab() ? renderDevLab(state, logs, lastScenario) : ''}`
    : activeParentTab === 'prizes'
      ? `${renderParentPrizes(state)}${showLab() ? renderDevLab(state, logs, lastScenario) : ''}`
      : activeParentTab === 'levels'
        ? `${renderParentLevels(state, pendingComboOverrides)}${showLab() ? renderDevLab(state, logs, lastScenario) : ''}`
        : activeParentTab === 'stats'
          ? `${renderParentStats(state)}${showLab() ? renderDevLab(state, logs, lastScenario) : ''}`
    : `
      ${renderParentDashboard(state)}
      ${showLab() ? renderDevLab(state, logs, lastScenario) : ''}
    `;
  bindParentTabNav();
  bindActions();
  if (activeParentTab === 'tasks') {
    bindTaskTabActions(state);
    bounceFirstHint('.parent-chore-shell');
  } else if (activeParentTab === 'prizes') {
    bindPrizeTabActions(state);
    bounceFirstHint('.parent-prize-shell');
  }
  else if (activeParentTab === 'levels') bindLevelsTabActions(state);
  else if (activeParentTab === 'stats') bindStatsTabActions(state);
  else {
    bindOverviewSwipeActions();
    animateOverviewLayoutShift(previousLayout);
    showParentQuickCoachMark();
    bounceFirstHint('.snapshot-summary-shell');
    bounceFirstHint('.activity-swipe-shell');
  }
  showWeekReviewIfNeeded(state);
}

function render(): void {
  if (activeOnboardingStep && isOnboardingEditMode()) {
    renderActiveOnboardingFlow();
    return;
  }
  if (showLandingPreview()) {
    renderLandingPreview();
    return;
  }
  if (useDevFirestore()) {
    void renderDevFirestore();
    return;
  }
  void renderLocalLab();
}

function renderLandingPreview(): void {
  if (activeOnboardingStep) {
    renderActiveOnboardingFlow();
    return;
  }
  showScreen('screen-setup');
  const gate = document.getElementById('setup-gate');
  const content = document.getElementById('setup-content');
  if (landingMode !== 'landing') {
    if (gate) {
      gate.style.display = 'flex';
      gate.innerHTML = landingMode === 'signin-not-found'
        ? renderSignInNotFoundScreen()
        : landingMode === 'signin'
          ? renderReturningSignInScreen(signInMessage)
          : landingMode === 'kid-entry'
            ? renderKidEntryScreen(kidEntryMessage)
            : landingMode === 'kid-select'
              ? renderKidMemberSelectScreen(kidEntryMembers, kidEntryMessage)
              : renderKidQrScannerScreen();
    }
    if (content) {
      content.style.display = 'none';
      content.innerHTML = '';
    }
    bindReturningSignInActions();
    bindKidEntryActions();
    return;
  }
  if (gate) {
    gate.style.display = 'flex';
    gate.innerHTML = renderLandingScreen();
  }
  if (content) {
    content.style.display = 'none';
    content.innerHTML = '';
  }
  bindLandingPreviewActions();
}

function renderActiveOnboardingFlow(): void {
  if (!activeOnboardingStep) return;
  showScreen('screen-setup');
  const gate = document.getElementById('setup-gate');
  const content = document.getElementById('setup-content');
  if (gate) {
    gate.style.display = 'none';
    gate.innerHTML = '';
  }
  if (content) {
    content.style.display = '';
    content.innerHTML = renderOnboardingStep(activeOnboardingStep, onboardingTransitionDirection);
  }
  onboardingTransitionDirection = 'none';
  bindOnboardingPreviewActions();
}

function bindLandingPreviewActions(): void {
  document.querySelectorAll<HTMLElement>('[data-landing-action]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.landingAction || '';
      if (action === 'start') {
        startNewOnboardingDraft();
        activeOnboardingStep = 'welcome';
        landingMode = 'landing';
        onboardingTransitionDirection = 'forward';
        renderLandingPreview();
      } else if (action === 'signin') {
        landingMode = 'signin';
        signInMessage = '';
        renderLandingPreview();
      } else if (action === 'kid') {
        landingMode = 'kid-entry';
        kidEntryMessage = '';
        renderLandingPreview();
      }
    });
  });
}

function bindReturningSignInActions(): void {
  document.querySelectorAll<HTMLElement>('[data-signin-provider]').forEach(button => {
    button.addEventListener('click', () => {
      void handleReturningSignIn(button.dataset.signinProvider || '');
    });
  });
  document.querySelectorAll<HTMLElement>('[data-signin-back]').forEach(button => {
    button.addEventListener('click', () => {
      landingMode = 'landing';
      signInMessage = '';
      renderLandingPreview();
    });
  });
  document.querySelector<HTMLElement>('[data-signin-start]')?.addEventListener('click', () => {
    landingMode = 'landing';
    activeOnboardingStep = 'welcome';
    onboardingTransitionDirection = 'forward';
    renderLandingPreview();
  });
}

function bindKidEntryActions(): void {
  document.querySelector<HTMLElement>('[data-kid-back]')?.addEventListener('click', () => {
    landingMode = landingMode === 'kid-qr' ? 'kid-entry' : 'landing';
    kidEntryMessage = '';
    renderLandingPreview();
  });
  document.querySelector<HTMLElement>('[data-kid-scan]')?.addEventListener('click', () => {
    landingMode = 'kid-qr';
    kidEntryMessage = '';
    renderLandingPreview();
  });
  document.querySelector<HTMLElement>('[data-kid-dev]')?.addEventListener('click', () => {
    void enterKidFamily(true);
  });
  document.querySelector<HTMLElement>('[data-kid-join]')?.addEventListener('click', () => {
    void enterKidFamily(false);
  });
  document.querySelectorAll<HTMLElement>('[data-kid-select]').forEach(button => {
    button.addEventListener('click', () => {
      const memberId = button.dataset.kidSelect || '';
      if (!memberId) return;
      activeViewerMemberId = memberId;
      activeKidTab = 'chores';
      landingMode = 'landing';
      kidEntryMessage = '';
      activeOnboardingStep = null;
      firestoreState = null;
      firestoreError = '';
      const url = new URL(window.location.href);
      url.searchParams.set('source', 'firestore');
      url.searchParams.delete('landing');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      render();
    });
  });
}

async function enterKidFamily(devBypass: boolean): Promise<void> {
  const input = document.querySelector<HTMLInputElement>('[data-kid-family-code]');
  const code = devBypass ? '' : normalizeFamilyCode(input?.value || '');
  if (!devBypass && !code) {
    kidEntryMessage = 'Enter your family code first.';
    renderLandingPreview();
    return;
  }
  const result = await resolveKidDevFamily(code, devBypass);
  if (!result.found) {
    kidEntryMessage = 'Family code not found.';
    renderLandingPreview();
    return;
  }
  kidEntryMembers = result.members;
  const kids = kidEntryMembers.filter(member => member.role !== 'parent' && !member.deleted);
  if (kids.length === 1 && kids[0]?.id) {
    activeViewerMemberId = String(kids[0].id);
    activeKidTab = 'chores';
    landingMode = 'landing';
    kidEntryMessage = '';
    firestoreState = null;
    firestoreError = '';
    const url = new URL(window.location.href);
    url.searchParams.set('source', 'firestore');
    url.searchParams.delete('landing');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    render();
    return;
  }
  landingMode = 'kid-select';
  kidEntryMessage = kids.length ? '' : 'No kid profiles were found in this family.';
  renderLandingPreview();
}

async function resolveKidDevFamily(code: string, devBypass: boolean): Promise<{ found: boolean; members: DemoMember[] }> {
  try {
    const { loadDevFirestoreState } = await import('../platform/firebase/dev-firestore-loader.js');
    const state = await loadDevFirestoreState();
    const familyCode = normalizeFamilyCode(String(state.familyCode || ''));
    if (devBypass || !code || code === familyCode) return { found: true, members: state.members };
    return { found: false, members: [] };
  } catch {
    return { found: false, members: [] };
  }
}

function normalizeFamilyCode(value: string): string {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

async function handleReturningSignIn(action: string): Promise<void> {
  const authUser = action === 'dev-bypass'
    ? createAuthDevBypass()
    : action === 'google' || action === 'apple'
      ? await signInParentWithProvider(action)
      : null;
  if (!authUser) {
    signInMessage = 'Sign-in did not complete.';
    renderLandingPreview();
    return;
  }
  const family = await resolveReturningDevFamily(authUser);
  if (!family.found) {
    landingMode = 'signin-not-found';
    renderLandingPreview();
    return;
  }
  activeViewerMemberId = family.parentMemberId || null;
  landingMode = 'landing';
  signInMessage = '';
  activeOnboardingStep = null;
  firestoreState = null;
  firestoreError = '';
  const url = new URL(window.location.href);
  url.searchParams.set('source', 'firestore');
  url.searchParams.delete('landing');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  render();
}

async function resolveReturningDevFamily(authUser: { uid?: string; email?: string; isDevBypass?: boolean }): Promise<{ found: boolean; parentMemberId?: string }> {
  if (authUser.isDevBypass) return { found: true, parentMemberId: 'preview-parent' };
  try {
    const { loadDevFirestoreState } = await import('../platform/firebase/dev-firestore-loader.js');
    const state = await loadDevFirestoreState();
    const email = String(authUser.email || '').toLowerCase();
    const parent = state.members.find(member => {
      if (member.role !== 'parent') return false;
      const authUid = String((member as DemoMember & { authUid?: string }).authUid || '');
      const providers = Array.isArray((member as DemoMember & { authProviders?: Array<{ uid?: string; email?: string }> }).authProviders)
        ? (member as DemoMember & { authProviders?: Array<{ uid?: string; email?: string }> }).authProviders || []
        : [];
      return authUid === authUser.uid || providers.some(provider => provider.uid === authUser.uid || (email && String(provider.email || '').toLowerCase() === email));
    });
    return { found: !!parent, parentMemberId: parent?.id };
  } catch {
    return { found: false };
  }
}

function bindOnboardingPreviewActions(): void {
  document.querySelectorAll<HTMLElement>('[data-onboarding-action]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.onboardingAction || '';
      if (action === 'landing') {
        activeOnboardingStep = null;
        onboardingTransitionDirection = 'none';
        renderLandingPreview();
        return;
      }
      if (action === 'cancel-edit') {
        activeOnboardingStep = null;
        onboardingTransitionDirection = 'none';
        startNewOnboardingDraft();
        render();
        return;
      }
      if (action === 'finish') {
        void finishOnboardingPreview();
        return;
      }
      const steps = getOnboardingSteps();
      const currentIndex = activeOnboardingStep ? steps.indexOf(activeOnboardingStep) : 0;
      if (action === 'next' && activeOnboardingStep === 'account' && !getOnboardingSetupDraft().authUser) {
        setOnboardingValidationMessage('Please sign in first.');
        renderOnboardingPreservingSetupScroll();
        return;
      }
      if (action === 'next' && activeOnboardingStep === 'appSettings' && !/^\d{4}$/.test(getOnboardingSetupDraft().parentPin)) {
        setOnboardingValidationMessage('Enter a 4-digit parent PIN to continue.');
        renderOnboardingPreservingSetupScroll();
        return;
      }
      clearOnboardingValidationMessage();
      const nextIndex = action === 'back'
        ? Math.max(0, currentIndex - 1)
        : Math.min(steps.length - 1, currentIndex + 1);
      if (action === 'next' && currentIndex === steps.length - 1 && isOnboardingEditMode()) {
        void finishOnboardingPreview();
        return;
      }
      if (nextIndex === currentIndex) return;
      transitionOnboardingTo(steps[nextIndex], action === 'back' ? 'back' : 'forward');
    });
  });
  document.querySelectorAll<HTMLElement>('[data-onboarding-local-action]').forEach(element => {
    element.addEventListener('click', event => {
      const target = event.currentTarget as HTMLElement;
      const action = target.dataset.onboardingLocalAction || '';
      if (target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'radio')) {
        event.stopPropagation();
      }
      if (handleOnboardingPreviewAction(action, datasetToRecord(target.dataset))) {
        if (!['toggle-setting', 'toggle-chore', 'toggle-prize'].includes(action)) {
          renderOnboardingPreservingSetupScroll();
        }
      }
    });
  });
  document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-onboarding-field], [data-onboarding-member-field]').forEach(input => {
    input.addEventListener('input', () => handleOnboardingFieldInput(input));
    input.addEventListener('change', () => handleOnboardingFieldInput(input));
  });
  document.querySelectorAll<HTMLInputElement>('[data-onboarding-setting]').forEach(input => {
    input.addEventListener('change', () => {
      handleOnboardingPreviewAction('toggle-setting', { value: input.dataset.onboardingSetting });
    });
  });
  document.querySelectorAll<HTMLElement>('[data-onboarding-auth]').forEach(button => {
    button.addEventListener('click', () => {
      void handleOnboardingAuth(button.dataset.onboardingAuth || '');
    });
  });
}

async function handleOnboardingAuth(action: string): Promise<void> {
  if (action === 'clear') {
    clearOnboardingAuthUser();
    clearOnboardingValidationMessage();
    renderOnboardingPreservingSetupScroll();
    return;
  }
  const authUser = action === 'dev-bypass'
    ? createAuthDevBypass()
    : action === 'google' || action === 'apple'
      ? await signInParentWithProvider(action)
      : null;
  if (!authUser) {
    if (action === 'google' || action === 'apple') {
      setOnboardingAuthError('Sign-in did not complete in this local preview. Use the dev bypass here, or try the real provider flow on a configured app/device.');
      renderOnboardingPreservingSetupScroll();
    }
    return;
  }
  clearOnboardingValidationMessage();
  setOnboardingAuthUser(authUser);
  renderOnboardingPreservingSetupScroll();
}

async function finishOnboardingPreview(): Promise<void> {
  if (onboardingFinishBusy) return;
  onboardingFinishBusy = true;
  const draft = getOnboardingSetupDraft();
  if (isOnboardingEditMode()) {
    try {
      renderLoadingScreen('Saving');
      await finishOnboardingEdit(draft);
    } finally {
      onboardingFinishBusy = false;
    }
    return;
  }
  if (!/^\d{4}$/.test(draft.parentPin)) {
    showOnboardingPinError();
    onboardingFinishBusy = false;
    return;
  }
  try {
    const { commitDevOnboardingSetup } = await import('../platform/firebase/dev-firestore-operations.js');
    await commitDevOnboardingSetup({ draft });
    const parent = draft.parents[0] || null;
    activeViewerMemberId = parent?.id || null;
    activeOnboardingStep = null;
    onboardingTransitionDirection = 'none';
    firestoreState = null;
    firestoreError = '';
    const url = new URL(window.location.href);
    url.searchParams.set('source', 'firestore');
    url.searchParams.delete('landing');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    void registerParentPushNotifications({
      userId: parent?.id,
      familyId: DEV_FIRESTORE_FAMILY_ID,
      memberId: parent?.id,
      notifyChoreApproval: draft.settings.notifyChoreApproval,
      notifySavingsSpend: draft.settings.notifySavingsSpend,
      saveToken: async (token, metadata) => {
        window.localStorage.setItem('gemsprout.v2.devPushToken', JSON.stringify({ token, metadata }));
        await savePushTokenForSignedInUser(token, metadata as Record<string, unknown>);
      },
    });
    render();
  } finally {
    onboardingFinishBusy = false;
  }
}

async function finishOnboardingEdit(draft: ReturnType<typeof getOnboardingSetupDraft>): Promise<void> {
  const state = currentDemoState();
  const familyId = state.familyId || (useDevFirestore() ? DEV_FIRESTORE_FAMILY_ID : LAB_FAMILY_ID);
  const nextActiveMembers = [...draft.parents, ...draft.kids].map(member => {
    const existing = state.members.find(item => item.id === member.id) || {};
    return {
      ...existing,
      ...member,
      familyId,
      role: member.role,
      deleted: false,
    } as DemoMember;
  });
  const nextIds = new Set(nextActiveMembers.map(member => String(member.id || '')));
  const softDeletedMembers = state.members
    .filter(member => member.id && !member.deleted && !nextIds.has(String(member.id)))
    .map(member => ({ ...member, deleted: true }));
  const nextMembers = [...nextActiveMembers, ...softDeletedMembers];
  const nextFamilyPatch = { name: draft.familyName, updatedAt: Date.now() };

  if (useDevFirestore()) {
    firestoreState = {
      ...(state as DemoAppState),
      familyName: draft.familyName,
      members: nextMembers,
      member: null,
    };
    try {
      const { commitDevFamilyWrite, commitDevMemberWrite } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevFamilyWrite({ familyId, data: nextFamilyPatch });
      await Promise.all(nextMembers.map(member => (
        member.id ? commitDevMemberWrite({ familyId, memberId: String(member.id), data: { ...member } }) : Promise.resolve()
      )));
    } catch (error) {
      firestoreState = null;
      firestoreError = error instanceof Error ? error.message : String(error);
      activeOnboardingStep = null;
      render();
      return;
    }
  } else {
    const existingFamily = store.get<Record<string, unknown>>(familyPath(familyId)) || {};
    store.set(familyPath(familyId), { ...existingFamily, ...nextFamilyPatch });
    nextMembers.forEach(member => {
      if (member.id) store.set(memberPath(familyId, String(member.id)), member);
    });
    saveSharedLabStore(store);
  }

  activeOnboardingStep = null;
  onboardingTransitionDirection = 'none';
  activeViewerMemberId = null;
  startNewOnboardingDraft();
  render();
}

function showOnboardingPinError(): void {
  activeOnboardingStep = 'appSettings';
  onboardingTransitionDirection = 'none';
  renderOnboardingPreservingSetupScroll();
  requestAnimationFrame(() => {
    const pin = document.getElementById('setup-pin') as HTMLInputElement | null;
    const error = document.getElementById('setup-pin-error');
    if (error) {
      error.textContent = 'Enter a 4-digit parent PIN to continue.';
      error.style.visibility = 'visible';
    }
    pin?.focus();
  });
}

function transitionOnboardingTo(nextStep: OnboardingStepId, direction: 'forward' | 'back'): void {
  if (onboardingTransitionTimer) {
    window.clearTimeout(onboardingTransitionTimer);
    onboardingTransitionTimer = 0;
  }
  const flow = document.querySelector<HTMLElement>('#setup-content .setup-flow');
  if (!flow) {
    activeOnboardingStep = nextStep;
    onboardingTransitionDirection = direction;
    if (isOnboardingEditMode()) renderActiveOnboardingFlow();
    else renderLandingPreview();
    return;
  }
  flow.classList.remove('onboarding-pane-exit-left', 'onboarding-pane-exit-right');
  flow.classList.add(direction === 'forward' ? 'onboarding-pane-exit-left' : 'onboarding-pane-exit-right');
  onboardingTransitionTimer = window.setTimeout(() => {
    activeOnboardingStep = nextStep;
    onboardingTransitionDirection = direction;
    if (isOnboardingEditMode()) renderActiveOnboardingFlow();
    else renderLandingPreview();
  }, 180);
}

function renderOnboardingPreservingSetupScroll(): void {
  const screen = document.getElementById('screen-setup');
  const scroller = document.querySelector<HTMLElement>('#setup-content .setup-step-scroll');
  const screenScrollTop = screen?.scrollTop || 0;
  const scrollerScrollTop = scroller?.scrollTop || 0;
  if (isOnboardingEditMode()) renderActiveOnboardingFlow();
  else renderLandingPreview();
  requestAnimationFrame(() => {
    const nextScreen = document.getElementById('screen-setup');
    const nextScroller = document.querySelector<HTMLElement>('#setup-content .setup-step-scroll');
    if (nextScreen) nextScreen.scrollTop = screenScrollTop;
    if (nextScroller) nextScroller.scrollTop = scrollerScrollTop;
  });
}

function datasetToRecord(dataset: DOMStringMap): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(dataset));
}

function handleOnboardingFieldInput(input: HTMLInputElement | HTMLSelectElement): void {
  const data = datasetToRecord(input.dataset);
  if (data.onboardingField) data.field = data.onboardingField;
  if (data.onboardingMemberField) data.field = data.onboardingMemberField;
  data.value = input.value;
  handleOnboardingPreviewAction('field', data);
}

function captureKidScrollPosition(): void {
  const content = document.getElementById('kid-content');
  pendingKidScrollTop = content ? content.scrollTop : window.scrollY || null;
}

function restoreKidScrollPosition(): void {
  if (pendingKidScrollTop == null) return;
  const scrollTop = pendingKidScrollTop;
  pendingKidScrollTop = null;
  requestAnimationFrame(() => {
    const content = document.getElementById('kid-content');
    if (content) content.scrollTop = scrollTop;
    else window.scrollTo({ top: scrollTop });
  });
}

async function submitKidTaskCompletion(taskId: string, slotId: string | null, photoUrl: string | null = null, entryTypeOverride: 'before' | 'after' | null = null): Promise<void> {
  if (pendingKidScrollTop == null) captureKidScrollPosition();
  activeKidTimeTaskId = null;
  const state = currentDemoState();
  const viewer = getActiveViewer(state);
  if (!viewer?.id || viewer.role === 'parent') return;
  const task = state.tasks.find(item => item.id === taskId);
  if (!task) return;
  const shouldSpeakConfirmation = isLittleKidMode(viewer);
  const photoMode = String(task.photoMode || 'none');
  if (photoMode !== 'none' && !photoUrl) {
    const entryType = entryTypeOverride || (photoMode === 'after' ? 'after' : 'before');
    openKidPhotoCapture(taskId, slotId, entryType);
    return;
  }
  const actionKey = `${viewer.id}:${taskId}:${slotId || 'none'}:${entryTypeOverride || 'after'}:${photoUrl ? 'photo' : 'plain'}`;
  if (activeKidTaskActionIds.has(actionKey)) return;
  activeKidTaskActionIds.add(actionKey);
  const now = Date.now();
  const completionId = `completion:${viewer.id}:${taskId}:${now}`;
  const requestId = `request:chore:${completionId}`;
  const points = Number(task.gems ?? task.diamonds ?? 0);
  const entryType = entryTypeOverride || 'after';
  const autoApprove = entryType !== 'before' && state.settings.autoApprove === true;
  const dateKey = todayKeyForApp(now);
  const completionDoc = {
    id: completionId,
    familyId: useDevFirestore() ? DEV_FIRESTORE_FAMILY_ID : LAB_FAMILY_ID,
    choreId: taskId,
    memberId: viewer.id,
    status: autoApprove ? 'approved' : 'pending',
    points,
    createdAt: now,
    approvedAt: autoApprove ? now : null,
    approvedByMemberId: autoApprove ? 'parent_1' : null,
    entryType,
    slotId,
    photoUrl,
    date: dateKey,
  };
  const requestDoc: DemoRequest = {
    id: requestId,
    status: autoApprove ? REQUEST_STATUSES.APPROVED : REQUEST_STATUSES.PENDING,
    kind: entryType === 'before' ? REQUEST_KINDS.CHORE_START : REQUEST_KINDS.CHORE_COMPLETION,
    targetMemberId: viewer.id,
    createdAt: now,
    resolvedAt: autoApprove ? now : null,
    resolvedByMemberId: autoApprove ? 'parent_1' : null,
    snapshot: { title: String(task.title || 'Task'), points },
    source: { choreId: taskId, completionId, prizeId: null, amount: null, reason: '' },
  };

  if (useDevFirestore()) {
    const previous = cloneDemoState(firestoreState);
    firestoreState = applySubmittedCompletionToState(firestoreState, requestDoc, completionDoc, autoApprove, now);
    void renderDevFirestore();
    restoreKidScrollPosition();
    if (shouldSpeakConfirmation) speak('Great job!');
    try {
      const { commitDevKidCompletionRequest, commitDevRequestAction } = await import('../platform/firebase/dev-firestore-operations.js');
      await commitDevKidCompletionRequest({
        completionId,
        requestId,
        memberId: String(viewer.id),
        choreId: taskId,
        title: String(task.title || 'Task'),
        points,
        entryType: entryType === 'before' ? 'before' : 'after',
        slotId,
        photoUrl,
        now,
      });
      if (!autoApprove) {
        void sendParentApprovalPush({ memberId: String(viewer.id), title: String(task.title || 'Task'), kind: 'chore_request' });
      }
      if (autoApprove) {
        await commitDevRequestAction({ action: 'approve', requestId, actorMemberId: 'parent_1', now });
        const { loadDevFirestoreState } = await import('../platform/firebase/dev-firestore-loader.js');
        firestoreState = await loadDevFirestoreState();
        activeViewerMemberId = String(viewer.id);
        void renderDevFirestore();
        restoreKidScrollPosition();
      }
    } catch (error) {
      firestoreState = previous;
      firestoreError = error instanceof Error ? error.message : String(error);
      void renderDevFirestore();
      restoreKidScrollPosition();
    } finally {
      activeKidTaskActionIds.delete(actionKey);
    }
    return;
  }

  const submittingMember = store.get<DemoMember>(memberPath(LAB_FAMILY_ID, String(viewer.id)));
  if (submittingMember?.splitHousehold?.enabled && !isMemberHereOnDate(submittingMember, dateKey)) {
    store.set(memberPath(LAB_FAMILY_ID, String(viewer.id)), {
      ...submittingMember,
      isHereToday: true,
      splitHousehold: {
        ...submittingMember.splitHousehold,
        overrides: { ...(submittingMember.splitHousehold.overrides || {}), [dateKey]: true },
      },
    });
  }
  store.set(completionPath(LAB_FAMILY_ID, completionId), completionDoc);
  store.set(requestPath(LAB_FAMILY_ID, requestId), {
    ...requestDoc,
    familyId: LAB_FAMILY_ID,
    requesterMemberId: viewer.id,
  });
  if (!autoApprove) {
    void sendParentApprovalPush({ memberId: String(viewer.id), title: String(task.title || 'Task'), kind: 'chore_request' });
  }
  if (autoApprove) {
    store.set(completionPath(LAB_FAMILY_ID, completionId), {
      ...completionDoc,
      status: 'pending',
      approvedAt: null,
      approvedByMemberId: null,
    });
    store.set(requestPath(LAB_FAMILY_ID, requestId), {
      ...requestDoc,
      familyId: LAB_FAMILY_ID,
      requesterMemberId: viewer.id,
      status: REQUEST_STATUSES.PENDING,
      resolvedAt: null,
      resolvedByMemberId: null,
    });
    const result = commitRequestOperation(store, createRequestAction('approve', requestId, LAB_FAMILY_ID, now), { now });
    if (result.ok && !result.duplicate) {
      applyApprovalProgressionToStore(store, LAB_FAMILY_ID, requestId, now);
      applyDailyComboBonusToStore(store, LAB_FAMILY_ID, requestId, now);
    }
  }
  saveSharedLabStore(store);
  render();
  restoreKidScrollPosition();
  if (shouldSpeakConfirmation) speak('Great job!');
  activeKidTaskActionIds.delete(actionKey);
}

function applySubmittedCompletionToState(
  current: DemoAppState | null,
  requestDoc: DemoRequest,
  completionDoc: DemoCompletion,
  autoApprove: boolean,
  now: number,
): DemoAppState | null {
  if (!current) return current;
  const next = cloneDemoState(current);
  next.requests = [...(next.requests || []), requestDoc];
  next.completions = [...(next.completions || []), completionDoc];
  next.completion = completionDoc;
  const submittingMember = next.members.find(item => item.id === requestDoc.targetMemberId);
  if (submittingMember?.splitHousehold?.enabled && !isMemberHereOnDate(submittingMember, completionDoc.date || todayKeyForApp(now))) {
    submittingMember.isHereToday = true;
    submittingMember.splitHousehold = {
      ...submittingMember.splitHousehold,
      overrides: { ...(submittingMember.splitHousehold.overrides || {}), [completionDoc.date || todayKeyForApp(now)]: true },
    };
  }
  if (autoApprove) {
    const member = submittingMember || next.members.find(item => item.id === requestDoc.targetMemberId);
    if (member) {
      const points = Number(requestDoc.snapshot?.points || 0);
      const gems = Number(member.gems || member.diamonds || 0) + points;
      member.gems = gems;
      member.diamonds = gems;
      member.totalEarned = Number(member.totalEarned || 0) + points;
    }
    const historyRow = buildOptimisticHistoryRow(requestDoc, 'approve', now);
    next.historyRows = [historyRow, ...next.historyRows.filter(row => row.id !== historyRow.id)].sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
    next.history = next.historyRows[0] || null;
  }
  next.request = pickPrimaryDemoRequest(next.requests);
  return next;
}

subscribeSharedLabStore(() => {
  if (!useDevFirestore()) void renderLocalLab();
});
registerAppSecurityListeners();
render();
