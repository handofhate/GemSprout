import { escapeHtml } from '../../ui/html';

export const ONBOARDING_STEPS = ['welcome', 'account', 'parents', 'members', 'chores', 'prizes', 'appSettings', 'done'] as const;
const ONBOARDING_EDIT_STEPS = ['welcome', 'parents', 'members'] as const;

export type OnboardingStepId = typeof ONBOARDING_STEPS[number];
export type OnboardingTransitionDirection = 'forward' | 'back' | 'none';

type SetupMember = {
  id: string;
  name: string;
  role: 'parent' | 'kid';
  avatar: string;
  color: string;
  avatarColor?: string;
  displayMode?: 'regular' | 'tiny';
  birthday?: string;
  ttsVoice?: string;
};

type OnboardingSettings = {
  familyName: string;
  parentPin: string;
  familyCode: string;
  authUser: ParentSetupAuthUser | null;
  authError: string;
  validationMessage: string;
  autoApprove: boolean;
  hideUnavailable: boolean;
  hideUnavailablePrizes: boolean;
  timezone: string;
  notifyChore: boolean;
  notifySpend: boolean;
  selectedChores: Set<string>;
  selectedPrizes: Set<string>;
};

type OnboardingModal = 'invite-parent' | 'kid-qr' | null;

export type ParentSetupAuthUser = {
  uid: string;
  email: string;
  displayName: string;
  providerId: string;
  isDevBypass?: boolean;
};

export type OnboardingSetupDraft = {
  familyName: string;
  familyCode: string;
  authUser: ParentSetupAuthUser | null;
  parentPin: string;
  settings: {
    autoApprove: boolean;
    hideUnavailable: boolean;
    showLockedRecurringPrizes: boolean;
    familyTimezone: string;
    notifyChoreApproval: boolean;
    notifySavingsSpend: boolean;
  };
  parents: SetupMember[];
  kids: SetupMember[];
  chores: Array<(typeof DEFAULT_CHORES)[number]>;
  prizes: Array<(typeof DEFAULT_PRIZES)[number]>;
};

const COLORS = ['#6C63FF', '#FF6584', '#43D9AD', '#FFD93D', '#6BCB77', '#FF9A3C', '#4ECDC4', '#45B7D1', '#E91E63', '#9C27B0'];

const AVATARS = [
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

const DEFAULT_CHORES = [
  { title: 'Make My Bed', icon: 'bed', iconColor: '#43D9AD', gems: 10, frequency: 'daily' },
  { title: 'Brush Teeth', icon: 'tooth', iconColor: '#45B7D1', gems: 5, frequency: 'daily' },
  { title: 'Put Toys Away', icon: 'house', iconColor: '#6C63FF', gems: 10, frequency: 'daily' },
  { title: 'Set the Table', icon: 'fork-knife', iconColor: '#FF9A3C', gems: 10, frequency: 'daily' },
  { title: 'Clear the Table', icon: 'broom', iconColor: '#6BCB77', gems: 10, frequency: 'daily' },
  { title: 'Take Out Trash', icon: 'trash', iconColor: '#6BCB77', gems: 15, frequency: 'weekly' },
  { title: 'Do Homework', icon: 'books', iconColor: '#45B7D1', gems: 20, frequency: 'daily' },
  { title: 'Put Clothes Away', icon: 't-shirt', iconColor: '#FF6584', gems: 10, frequency: 'daily' },
  { title: 'Feed the Pet', icon: 'paw-print', iconColor: '#FF9A3C', gems: 15, frequency: 'daily' },
  { title: 'Help with Laundry', icon: 'washing-machine', iconColor: '#43D9AD', gems: 20, frequency: 'weekly' },
];

const DEFAULT_PRIZES = [
  { title: 'Movie Night Pick', icon: 'film-strip', iconColor: '#6C63FF', cost: 100, type: 'individual' },
  { title: '30 min Extra Screen Time', icon: 'television', iconColor: '#45B7D1', cost: 50, type: 'individual' },
  { title: 'Stay Up 30 min Late', icon: 'moon', iconColor: '#6C63FF', cost: 75, type: 'individual' },
  { title: 'Choose Dinner', icon: 'fork-knife', iconColor: '#FF9A3C', cost: 75, type: 'individual' },
  { title: 'Small Toy or Book', icon: 'gift', iconColor: '#FF6584', cost: 250, type: 'individual' },
  { title: 'Family Ice Cream Night', icon: 'ice-cream', iconColor: '#FFD93D', cost: 400, type: 'family' },
  { title: 'Family Movie Night', icon: 'film-strip', iconColor: '#6C63FF', cost: 500, type: 'family' },
  { title: 'Bowling Night', icon: 'trophy', iconColor: '#FFD93D', cost: 800, type: 'family' },
];

let previewParents: SetupMember[] = [
  {
    id: 'preview-parent',
    name: 'Parent',
    role: 'parent',
    avatar: '<i class="ph-duotone ph-user-circle" style="color:#6C63FF"></i>',
    color: '#6C63FF',
    avatarColor: '#6C63FF',
  },
];

let previewKids: SetupMember[] = [
  {
    id: 'preview-kid-1',
    name: 'Avery',
    role: 'kid',
    avatar: '<i class="ph-duotone ph-smiley" style="color:#F59E0B"></i>',
    color: '#6C63FF',
    avatarColor: '#F59E0B',
    displayMode: 'regular',
  },
];

let previewSettings: OnboardingSettings = {
  familyName: 'GemSprout Family',
  parentPin: '',
  familyCode: makePreviewFamilyCode(),
  authUser: null,
  authError: '',
  validationMessage: '',
  autoApprove: false,
  hideUnavailable: false,
  hideUnavailablePrizes: false,
  timezone: 'America/Phoenix',
  notifyChore: true,
  notifySpend: true,
  selectedChores: new Set(DEFAULT_CHORES.map(task => task.title)),
  selectedPrizes: new Set(DEFAULT_PRIZES.map(prize => prize.title)),
};

let activeModal: OnboardingModal = null;
let nextKidId = 3;
let onboardingMode: 'new' | 'edit' = 'new';

export function getOnboardingSteps(): readonly OnboardingStepId[] {
  return onboardingMode === 'edit' ? ONBOARDING_EDIT_STEPS : ONBOARDING_STEPS;
}

export function isOnboardingEditMode(): boolean {
  return onboardingMode === 'edit';
}

export function startNewOnboardingDraft(): void {
  onboardingMode = 'new';
  activeModal = null;
}

export function startOnboardingEditDraft(state: {
  familyName?: string;
  members?: Array<Record<string, unknown>>;
  settings?: Record<string, unknown>;
}): void {
  onboardingMode = 'edit';
  activeModal = null;
  const settings = state.settings || {};
  previewSettings = {
    ...previewSettings,
    familyName: state.familyName || 'GemSprout Family',
    parentPin: String(settings.parentPin || previewSettings.parentPin || ''),
    autoApprove: settings.autoApprove === true,
    hideUnavailable: settings.hideUnavailable === true,
    hideUnavailablePrizes: settings.showLockedRecurringPrizes === false,
    timezone: String(settings.familyTimezone || previewSettings.timezone || 'America/Phoenix'),
    notifyChore: settings.notifyChoreApproval !== false,
    notifySpend: settings.notifySavingsSpend !== false,
    validationMessage: '',
    authError: '',
  };
  const activeMembers = (state.members || []).filter(member => !member.deleted);
  previewParents = activeMembers
    .filter(member => member.role === 'parent')
    .map((member, index) => normalizeSetupMember(member, 'parent', index));
  if (!previewParents.length) {
    previewParents = [{
      id: 'preview-parent',
      name: 'Parent',
      role: 'parent',
      avatar: '<i class="ph-duotone ph-user-circle" style="color:#6C63FF"></i>',
      color: '#6C63FF',
      avatarColor: '#6C63FF',
    }];
  }
  previewKids = activeMembers
    .filter(member => member.role !== 'parent')
    .map((member, index) => normalizeSetupMember(member, 'kid', index));
  if (!previewKids.length) addPreviewKid();
  nextKidId = previewKids.length + 1;
}

export function renderOnboardingStep(stepId: OnboardingStepId, direction: OnboardingTransitionDirection = 'none'): string {
  const steps = getOnboardingSteps();
  const stepIndex = steps.indexOf(stepId);
  const content = renderStepBody(stepId);
  const nav = renderStepNav(stepIndex);
  const enterClass = direction === 'forward' ? ' onboarding-pane-enter-right' : direction === 'back' ? ' onboarding-pane-enter-left' : '';
  return `
    <div class="setup-flow onboarding-pane${enterClass}" style="position:relative">
      <div class="step-indicator" style="padding-top:16px">${renderDots(stepIndex)}</div>
      <div class="setup-step active">
        <div class="setup-step-scroll">${content}</div>
        ${nav ? `<div class="setup-step-nav">${nav}</div>` : ''}
      </div>
    </div>
    ${renderOnboardingModal()}
  `;
}

export function handleOnboardingPreviewAction(action: string, data: Record<string, string | undefined>): boolean {
  if (action === 'invite-parent') activeModal = 'invite-parent';
  else if (action === 'kid-qr') activeModal = 'kid-qr';
  else if (action === 'close-modal') activeModal = null;
  else if (action === 'add-kid') addPreviewKid();
  else if (action === 'remove-kid') removePreviewKid(data.memberId || '');
  else if (action === 'copy-code') activeModal = 'kid-qr';
  else if (action === 'preview-voice') activeModal = 'kid-qr';
  else if (action === 'field') updateField(data);
  else if (action === 'select-avatar') updateMember(data.memberId || '', { avatar: data.value || AVATARS[0] });
  else if (action === 'select-avatar-color') updateMember(data.memberId || '', { avatarColor: data.value || COLORS[0] });
  else if (action === 'select-profile-color') updateMember(data.memberId || '', { color: data.value || COLORS[0] });
  else if (action === 'select-mode') updateMember(data.memberId || '', { displayMode: data.value === 'tiny' ? 'tiny' : 'regular' });
  else if (action === 'toggle-chore') toggleSet(previewSettings.selectedChores, data.value || '');
  else if (action === 'toggle-prize') toggleSet(previewSettings.selectedPrizes, data.value || '');
  else if (action === 'toggle-setting') toggleSetting(data.value || '');
  else return false;
  return true;
}

export function setOnboardingValidationMessage(message: string): void {
  previewSettings.validationMessage = message;
}

export function clearOnboardingValidationMessage(): void {
  previewSettings.validationMessage = '';
}

export function setOnboardingAuthUser(user: ParentSetupAuthUser): void {
  previewSettings.authUser = user;
  previewSettings.authError = '';
  const parent = previewParents[0];
  if (parent && !parent.name.trim() && user.displayName) {
    previewParents = [{ ...parent, name: user.displayName }];
  }
}

export function clearOnboardingAuthUser(): void {
  previewSettings.authUser = null;
  previewSettings.authError = '';
}

export function setOnboardingAuthError(message: string): void {
  previewSettings.authError = message;
}

export function getOnboardingSetupDraft(): OnboardingSetupDraft {
  return {
    familyName: previewSettings.familyName.trim() || 'GemSprout Family',
    familyCode: previewSettings.familyCode,
    authUser: previewSettings.authUser,
    parentPin: previewSettings.parentPin,
    settings: {
      autoApprove: previewSettings.autoApprove,
      hideUnavailable: previewSettings.hideUnavailable,
      showLockedRecurringPrizes: !previewSettings.hideUnavailablePrizes,
      familyTimezone: previewSettings.timezone,
      notifyChoreApproval: previewSettings.notifyChore,
      notifySavingsSpend: previewSettings.notifySpend,
    },
    parents: previewParents.map(member => ({ ...member })),
    kids: previewKids.map(member => ({ ...member })),
    chores: DEFAULT_CHORES.filter(task => previewSettings.selectedChores.has(task.title)),
    prizes: DEFAULT_PRIZES.filter(prize => previewSettings.selectedPrizes.has(prize.title)),
  };
}

function renderStepBody(stepId: OnboardingStepId): string {
  if (stepId === 'welcome') return renderWelcomePane();
  if (stepId === 'account') return renderAccountPane();
  if (stepId === 'parents') return renderParentsPane();
  if (stepId === 'members') return renderMembersPane();
  if (stepId === 'chores') return renderChoresPane();
  if (stepId === 'prizes') return renderPrizesPane();
  if (stepId === 'appSettings') return renderSettingsPane();
  return renderDonePane();
}

function renderDots(stepIndex: number): string {
  return getOnboardingSteps().map((_, index) => `<div class="step-dot ${index === stepIndex ? 'active' : index < stepIndex ? 'done' : ''}"></div>`).join('');
}

function renderStepNav(stepIndex: number): string {
  const steps = getOnboardingSteps();
  if (steps[stepIndex] === 'done') return '';
  const backAction = stepIndex === 0 ? (onboardingMode === 'edit' ? 'cancel-edit' : 'landing') : 'back';
  const nextLabel = stepIndex === steps.length - 1 || stepIndex === ONBOARDING_STEPS.length - 2 ? 'Finish!' : 'Next';
  const nextIcon = nextLabel === 'Finish!' ? ' <i class="ph-duotone ph-confetti" style="font-size:0.95rem;vertical-align:middle"></i>' : '';
  return `
    ${previewSettings.validationMessage ? `<div style="margin:0 0 10px;color:#991B1B;background:#FEE2E2;border:1px solid #FCA5A5;border-radius:12px;padding:9px 12px;font-size:0.82rem;line-height:1.35;text-align:center">${escapeHtml(previewSettings.validationMessage)}</div>` : ''}
    <div class="flex gap-10 mt-8">
      <button class="btn btn-secondary" style="flex:0 0 80px" data-onboarding-action="${backAction}" type="button"><i class="ph-duotone ph-arrow-left" style="font-size:0.95rem;vertical-align:middle"></i> Back</button>
      <button class="btn btn-primary" style="flex:1" data-onboarding-action="next" type="button">${nextLabel}${nextIcon}</button>
    </div>
  `;
}

function renderWelcomePane(): string {
  return `
    <div class="setup-top">
      <div class="setup-emoji"><i class="ph-duotone ph-house" style="color:#6C63FF;font-size:3rem"></i></div>
      <div class="setup-title">${onboardingMode === 'edit' ? 'Edit Family' : 'Welcome to GemSprout'}</div>
      <div class="setup-sub">${onboardingMode === 'edit' ? 'Update your family profiles.' : "Let's build your family growth space in just a few steps."}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Family name</label>
      <input type="text" id="setup-family-name" placeholder="The Smiths" value="${escapeHtml(previewSettings.familyName)}" data-onboarding-field="familyName">
    </div>
  `;
}

function renderParentsPane(): string {
  return `
    <div class="setup-top" style="padding-top:20px">
      <div class="setup-emoji"><i class="ph-duotone ph-shield-star" style="color:#6C63FF;font-size:3rem"></i></div>
      <div class="setup-title">Your Profile</div>
      <div class="setup-sub">Setup your parent profile, and invite a second parent if you'd like. A second parent can always be added later in Settings.</div>
    </div>
    <div id="parents-list">${previewParents.map(renderParentCard).join('')}</div>
    <button class="btn btn-secondary btn-full mt-8" style="margin-bottom:14px" data-onboarding-local-action="invite-parent" type="button">
      <i class="ph-duotone ph-user-plus" style="vertical-align:middle;margin-right:6px"></i> Invite a Parent
    </button>
  `;
}

function renderAccountPane(): string {
  const authUser = previewSettings.authUser;
  if (authUser) {
    return `
      <div class="setup-top" style="padding-top:20px">
        <div class="setup-emoji"><i class="ph-duotone ph-shield-check" style="color:#16A34A;font-size:3rem"></i></div>
        <div class="setup-title">Account Secured</div>
        <div class="setup-sub">This parent account will own the family setup and sync it across devices.</div>
      </div>
      <div class="card" style="text-align:center">
        <div style="font-size:2.5rem;margin-bottom:8px">${authUser.providerId === 'google.com' ? googleIcon() : authUser.providerId === 'apple.com' ? appleIcon('#111') : '<i class="ph-duotone ph-code" style="color:#6C63FF"></i>'}</div>
        <div style="font-weight:800;color:var(--text);font-size:1.05rem">${escapeHtml(authUser.displayName || 'Parent')}</div>
        <div style="color:var(--muted);font-size:0.86rem;margin-top:4px">${escapeHtml(authUser.email || authUser.providerId)}</div>
        ${authUser.isDevBypass ? '<div style="margin-top:10px;font-size:0.78rem;color:#92400E;background:#FEF3C7;border:1px solid #FCD34D;border-radius:10px;padding:8px 10px">Temporary dev bypass. Real sign-in still uses Google or Apple.</div>' : ''}
      </div>
      <button class="btn btn-secondary btn-full mt-8" data-onboarding-auth="clear" type="button">Use a different account</button>
    `;
  }
  return `
    <div class="setup-top" style="padding-top:20px">
      <div class="setup-emoji"><i class="ph-duotone ph-lock-key" style="color:#6C63FF;font-size:3rem"></i></div>
      <div class="setup-title">Create Your Family</div>
      <div class="setup-sub">Sign in to secure your account and sync your family across devices.</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:320px;margin:0 auto">
      <button class="btn" style="background:#fff;color:#333;font-size:1rem;padding:14px 20px;border-radius:12px;display:flex;align-items:center;gap:12px;justify-content:center;font-weight:600;border:1px solid rgba(39,66,57,0.14)" data-onboarding-auth="google" type="button">
        ${googleIcon()}
        Continue with Google
      </button>
      <button class="btn" style="background:#000;color:#fff;font-size:1rem;padding:14px 20px;border-radius:12px;display:flex;align-items:center;gap:12px;justify-content:center;font-weight:600;border:none" data-onboarding-auth="apple" type="button">
        ${appleIcon('#fff')}
        Continue with Apple&nbsp;
      </button>
      <button class="btn btn-secondary" style="font-size:0.9rem;padding:12px 16px;border-radius:12px" data-onboarding-auth="dev-bypass" type="button">
        <i class="ph-duotone ph-code" style="font-size:1rem"></i>
        Dev bypass login
      </button>
    </div>
    ${previewSettings.authError ? `<div style="margin:14px auto 0;max-width:320px;color:#991B1B;background:#FEE2E2;border:1px solid #FCA5A5;border-radius:12px;padding:10px 12px;font-size:0.82rem;line-height:1.4;text-align:center">${escapeHtml(previewSettings.authError)}</div>` : ''}
  `;
}

function renderMembersPane(): string {
  return `
    <div class="setup-top" style="padding-top:20px">
      <div class="setup-emoji"><i class="ph-duotone ph-users-three" style="color:#6C63FF;font-size:3rem"></i></div>
      <div class="setup-title">Kids</div>
      <div class="setup-sub">Add the kids who will be using GemSprout.</div>
    </div>
    <div id="members-list">${previewKids.map(renderKidCard).join('')}</div>
    <button class="btn btn-secondary btn-full mt-8" style="margin-bottom:14px" data-onboarding-local-action="add-kid" type="button">+ Add a kid</button>
  `;
}

function renderChoresPane(): string {
  const rows = [...DEFAULT_CHORES]
    .sort((left, right) => left.gems - right.gems || left.title.localeCompare(right.title))
    .map((task, index) => `
      <label class="chore-checkbox-row">
        <input type="checkbox" id="sc${index}" ${previewSettings.selectedChores.has(task.title) ? 'checked' : ''} data-onboarding-local-action="toggle-chore" data-value="${escapeHtml(task.title)}">
        <span class="chore-checkbox-icon">${renderIcon(task.icon, task.iconColor, 'font-size:1.4rem')}</span>
        <span class="chore-checkbox-label">${escapeHtml(task.title)}</span>
        <span class="chore-checkbox-dmds">${task.gems} gems / ${escapeHtml(task.frequency)}</span>
      </label>
    `).join('');
  return `
    <div class="setup-top" style="padding-top:20px">
      <div class="setup-emoji"><i class="ph-duotone ph-clipboard-text" style="color:#6C63FF;font-size:3rem"></i></div>
      <div class="setup-title">Starter Tasks</div>
      <div class="setup-sub">Get started with a few ready-made tasks. Everything can be customized later from your parent dashboard.</div>
    </div>
    <div id="chore-checks">${rows}</div>
  `;
}

function renderPrizesPane(): string {
  const rows = [...DEFAULT_PRIZES]
    .sort((left, right) => left.cost - right.cost || left.title.localeCompare(right.title))
    .map((prize, index) => `
      <label class="chore-checkbox-row">
        <input type="checkbox" id="sp${index}" ${previewSettings.selectedPrizes.has(prize.title) ? 'checked' : ''} data-onboarding-local-action="toggle-prize" data-value="${escapeHtml(prize.title)}">
        <span class="chore-checkbox-icon">${renderIcon(prize.icon, prize.iconColor)}</span>
        <span class="chore-checkbox-label">${escapeHtml(prize.title)}</span>
        <span class="chore-checkbox-dmds">${prize.cost} gems &middot; ${escapeHtml(prize.type)}</span>
      </label>
    `).join('');
  return `
    <div class="setup-top" style="padding-top:20px">
      <div class="setup-emoji"><i class="ph-duotone ph-gift" style="color:#FF6584;font-size:3rem"></i></div>
      <div class="setup-title">Rewards & Motivation</div>
      <div class="setup-sub">Choose a few starter rewards. These can be customized later as well.</div>
    </div>
    <div id="prize-checks">${rows}</div>
  `;
}

function renderSettingsPane(): string {
  return `
    <div class="setup-top" style="padding-top:20px">
      <div class="setup-emoji"><i class="ph-duotone ph-gear-six" style="color:#6C63FF;font-size:3rem"></i></div>
      <div class="setup-title">Family Settings</div>
      <div class="setup-sub">Tune approvals, notifications, and protections for your household. You can change these any time.</div>
    </div>
    <div class="form-group" id="setup-pin-group" style="margin-bottom:0">
      <label class="form-label">Parent PIN <span class="form-label-hint">(required)</span></label>
      <div style="font-size:0.78rem;color:var(--muted);margin-bottom:6px">Protects the parent dashboard and family account settings.</div>
      <input type="password" id="setup-pin" maxlength="4" placeholder="4 digits" inputmode="numeric" pattern="[0-9]*" value="${escapeHtml(previewSettings.parentPin)}" data-onboarding-field="parentPin">
      <div id="setup-pin-error" style="display:block;min-height:20px;color:var(--pink);font-size:0.8rem;line-height:1.2;margin-top:5px;visibility:hidden"></div>
    </div>
    <div class="section-row" style="margin-top:0"><span class="section-title"><i class="ph-duotone ph-sliders" style="color:#6C63FF;font-size:1rem;vertical-align:middle"></i> General</span></div>
    <div class="card">
      ${renderToggle('autoApprove', 'Auto-approve tasks', 'Kids earn gems instantly without parent approval', previewSettings.autoApprove)}
      ${renderToggle('hideUnavailable', 'Hide unavailable tasks', "Tasks outside their time window won't show on kids' screens", previewSettings.hideUnavailable)}
      ${renderToggle('hideUnavailablePrizes', 'Hide redeemed recurring prizes', 'Daily, weekly, and monthly prizes disappear after they are redeemed until their next reset', previewSettings.hideUnavailablePrizes)}
      <div class="form-group mb-0">
        <label class="form-label">Family timezone</label>
        <select id="setup-timezone" style="width:100%" data-onboarding-field="timezone">
          ${['America/Phoenix', 'America/New_York', 'America/Chicago', 'America/Los_Angeles'].map(timezone => `<option value="${timezone}" ${previewSettings.timezone === timezone ? 'selected' : ''}>${timezone.replace(/_/g, ' ')}</option>`).join('')}
        </select>
        <div style="font-size:0.78rem;color:var(--muted);margin-top:4px">This will be used to determine "today" for tasks and streaks when family members are in different time zones</div>
      </div>
    </div>
    <div class="section-row" style="margin-top:14px"><span class="section-title"><i class="ph-duotone ph-device-mobile" style="color:#6C63FF;font-size:1rem;vertical-align:middle"></i> Push Notifications</span></div>
    <div class="card">
      ${renderToggle('notifyChore', 'Task approval requests', 'Get notified when a kid marks a task complete and it needs your review', previewSettings.notifyChore)}
      ${renderToggle('notifySpend', 'Savings spend requests', 'Get notified when a kid requests to spend from their savings', previewSettings.notifySpend)}
    </div>
  `;
}

function renderDonePane(): string {
  return `
    <div style="text-align:center;padding:24px 20px 12px">
      <div style="font-size:4rem"><i class="ph-duotone ph-confetti" style="color:#F97316"></i></div>
      <div class="setup-title mt-8">You're all set!</div>
      <div class="setup-sub mt-4">Your family growth space is ready.</div>
    </div>
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:0.82rem;font-weight:700;color:#6C63FF;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em"><i class="ph-duotone ph-smiley" style="vertical-align:middle;margin-right:4px"></i> Adding your kids</div>
      <p style="font-size:0.83rem;color:var(--muted);line-height:1.5;margin-bottom:10px">On each kid's device, open GemSprout and tap <strong>I'm a Kid</strong>. Next, enter your Family Code found below or scan the QR code found in <strong>Settings &middot; Add user</strong>.</p>
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:1.8rem;font-weight:900;letter-spacing:0.18em;color:#4C1D95;font-family:'Jost','Avenir Next','Segoe UI',system-ui,sans-serif;flex:1">${escapeHtml(previewSettings.familyCode)}</div>
        <button class="btn btn-secondary btn-sm" data-onboarding-local-action="copy-code" type="button"><i class="ph-duotone ph-copy" style="font-size:0.9rem;vertical-align:middle"></i> Copy</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:12px">
      <div style="font-size:0.82rem;font-weight:700;color:#6C63FF;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em"><i class="ph-duotone ph-user-plus" style="vertical-align:middle;margin-right:4px"></i> Adding your partner</div>
      <p style="font-size:0.83rem;color:var(--muted);line-height:1.5">Have them install GemSprout and sign in with the same account that you invited during setup. If you still need to invite them, go to <strong>Settings &middot; Add user &middot; Invite a parent</strong>.</p>
    </div>
    <button class="btn btn-primary btn-full" data-onboarding-action="finish" type="button">Let's go!</button>
  `;
}

function normalizeSetupMember(member: Record<string, unknown>, role: 'parent' | 'kid', index: number): SetupMember {
  const color = String(member.color || COLORS[index % COLORS.length]);
  const fallbackAvatar = role === 'parent'
    ? '<i class="ph-duotone ph-user-circle" style="color:#6C63FF"></i>'
    : AVATARS[index % AVATARS.length];
  return {
    id: String(member.id || `${role}-${Date.now()}-${index}`),
    name: String(member.name || (role === 'parent' ? 'Parent' : '')),
    role,
    avatar: String(member.avatar || fallbackAvatar),
    color,
    avatarColor: String(member.avatarColor || color),
    displayMode: member.displayMode === 'tiny' || member.mode === 'tiny' ? 'tiny' : 'regular',
    birthday: String(member.birthday || ''),
    ttsVoice: typeof member.ttsVoice === 'string' ? member.ttsVoice : undefined,
  };
}

function renderParentCard(parent: SetupMember): string {
  return `
    <div class="kid-setup-card" style="--setup-accent:${escapeHtml(parent.color)}">
      <div class="kid-setup-card-header">
        <span class="setup-card-header-label" style="font-size:1.5rem;font-weight:700">
          <span class="setup-card-header-avatar">${renderAvatar(parent.avatar, parent.avatarColor || parent.color)}</span>
          <span>${escapeHtml(parent.name || 'Parent')}</span>
        </span>
      </div>
      ${renderProfileFields(parent, true)}
    </div>
  `;
}

function renderKidCard(kid: SetupMember): string {
  const modes = [
    { id: 'regular', icon: '<i class="ph-duotone ph-user" style="color:#6C63FF;font-size:1.1rem"></i>', label: 'Big Kid', sub: 'Standard view' },
    { id: 'tiny', icon: '<i class="ph-duotone ph-star" style="color:#F97316;font-size:1.1rem"></i>', label: 'Little Kid', sub: 'Larger icons & text-to-speech & no not-listening meter' },
  ];
  return `
    <div class="kid-setup-card" style="--setup-accent:${escapeHtml(kid.color)}">
      <div class="kid-setup-card-header">
        <span class="setup-card-header-label" style="font-size:1.5rem;font-weight:700">
          <span class="setup-card-header-avatar">${renderAvatar(kid.avatar, kid.avatarColor || kid.color)}</span>
          <span>${escapeHtml(kid.name || 'Kid')}</span>
        </span>
        <button class="btn-icon-sm btn-icon-delete" data-onboarding-local-action="remove-kid" data-member-id="${escapeHtml(kid.id)}" type="button"><i class="ph-duotone ph-x" style="font-size:0.9rem"></i></button>
      </div>
      <div class="form-group mb-0">
        <label class="form-label">Name</label>
        <input type="text" placeholder="Name" value="${escapeHtml(kid.name)}" data-onboarding-member-field="name" data-member-id="${escapeHtml(kid.id)}">
      </div>
      <div class="form-group mt-8">
        <label class="form-label"><i class="ph-duotone ph-cake" style="color:#F97316;font-size:1rem;vertical-align:middle"></i> Birthday <span class="form-label-hint">for surprise animations!</span></label>
        <div class="input-row">${renderMonthSelect()}${renderDaySelect()}</div>
      </div>
      <div class="form-group" style="position:relative">
        <label class="form-label">Display Mode</label>
        <div class="display-mode-row">${modes.map(mode => `
          <div class="mode-opt${kid.displayMode === mode.id ? ' sel' : ''}" data-onboarding-local-action="select-mode" data-member-id="${escapeHtml(kid.id)}" data-value="${mode.id}">
            <span class="mode-opt-icon">${mode.icon}</span>
            <span class="mode-opt-title">${mode.label}</span>
            <span class="mode-opt-sub">${mode.sub}</span>
          </div>
        `).join('')}</div>
      </div>
      ${kid.displayMode === 'tiny' ? `
        <div class="form-group">
          <label class="form-label"><i class="ph-duotone ph-speaker-high" style="color:#6C63FF;font-size:1rem;vertical-align:middle"></i> Voice</label>
          <div style="display:flex;gap:8px;align-items:center">
            <select style="flex:1" data-onboarding-member-field="ttsVoice" data-member-id="${escapeHtml(kid.id)}">${['Samantha', 'Alex', 'Victoria'].map(voice => `<option ${kid.ttsVoice === voice ? 'selected' : ''}>${voice}</option>`).join('')}</select>
            <button class="btn btn-secondary btn-sm" style="flex-shrink:0" data-onboarding-local-action="preview-voice" type="button"><i class="ph-duotone ph-play" style="font-size:0.9rem;vertical-align:middle"></i> Preview</button>
          </div>
        </div>
      ` : ''}
      ${renderAppearanceFields(kid)}
    </div>
  `;
}

function renderProfileFields(member: SetupMember, parent: boolean): string {
  return `
    <div class="form-group${parent ? '' : ' mt-8'}">
      <label class="form-label">Name</label>
      <input type="text" placeholder="Name" value="${escapeHtml(member.name)}" data-onboarding-member-field="name" data-member-id="${escapeHtml(member.id)}">
    </div>
    ${parent ? `
      <div class="form-group">
        <label class="form-label"><i class="ph-duotone ph-cake" style="color:#F97316;font-size:1rem;vertical-align:middle"></i> Birthday <span class="form-label-hint">for surprise animations!</span></label>
        <div class="input-row">${renderMonthSelect()}${renderDaySelect()}</div>
      </div>
    ` : ''}
    ${renderAppearanceFields(member)}
  `;
}

function renderAppearanceFields(member: SetupMember): string {
  return `
    <div class="form-group mt-8">
      <label class="form-label">Avatar</label>
      <div class="avatar-grid">${renderAvatarOptions(member.avatar, member.id)}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Avatar Color</label>
      <div class="color-row">${renderColorSwatches(member.avatarColor || member.color, member.id, 'select-avatar-color')}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Profile Color</label>
      <div class="color-row">${renderColorSwatches(member.color, member.id, 'select-profile-color')}</div>
    </div>
  `;
}

function renderToggle(id: keyof Pick<OnboardingSettings, 'autoApprove' | 'hideUnavailable' | 'hideUnavailablePrizes' | 'notifyChore' | 'notifySpend'>, label: string, sub: string, checked: boolean): string {
  return `
    <div class="toggle-row">
      <div><div class="toggle-label">${escapeHtml(label)}</div><div class="toggle-sub">${escapeHtml(sub)}</div></div>
      <label class="toggle"><input type="checkbox" ${checked ? 'checked' : ''} data-onboarding-setting="${id}"><span class="toggle-track"></span></label>
    </div>
  `;
}

function renderAvatarOptions(selected: string, memberId = ''): string {
  return [
    '<i class="ph-duotone ph-leaf" style="color:#16A34A"></i>',
    ...AVATARS.slice(0, 23),
  ].map(avatar => `<div class="avatar-opt${avatar === selected ? ' sel' : ''}" data-onboarding-local-action="select-avatar" data-member-id="${escapeHtml(memberId)}" data-value="${escapeHtml(avatar)}">${avatar}</div>`).join('');
}

function renderColorSwatches(selected: string, memberId = '', action = 'select-profile-color'): string {
  return COLORS.map(color => `<div class="color-swatch${color === selected ? ' sel' : ''}" style="background:${escapeHtml(color)}" data-onboarding-local-action="${action}" data-member-id="${escapeHtml(memberId)}" data-value="${escapeHtml(color)}"></div>`).join('');
}

function renderMonthSelect(): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `<select><option value="">Month</option>${months.map((month, index) => `<option value="${String(index + 1).padStart(2, '0')}">${month}</option>`).join('')}</select>`;
}

function renderDaySelect(): string {
  return `<select><option value="">Day</option>${Array.from({ length: 31 }, (_, index) => index + 1).map(day => `<option value="${String(day).padStart(2, '0')}">${day}</option>`).join('')}</select>`;
}

function renderAvatar(avatar: string, color: string): string {
  return avatar.replace(/color\s*:\s*[^;"']+/i, `color:${color}`);
}

function renderIcon(name: string, color: string, extraStyle = ''): string {
  return `<i class="ph-duotone ph-${escapeHtml(name)}" style="color:${escapeHtml(color)};${escapeHtml(extraStyle)}"></i>`;
}

function googleIcon(): string {
  return '<svg width="20" height="20" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
}

function appleIcon(fill: string): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="${fill}" xmlns="http://www.w3.org/2000/svg"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z"/></svg>`;
}

function addPreviewKid(): void {
  const color = COLORS[previewKids.length % COLORS.length];
  const avatar = AVATARS[previewKids.length % AVATARS.length];
  previewKids.push({
    id: `preview-kid-${nextKidId++}`,
    name: '',
    role: 'kid',
    avatar,
    color,
    avatarColor: color,
    displayMode: 'regular',
  });
}

function removePreviewKid(memberId: string): void {
  if (previewKids.length <= 1) return;
  previewKids = previewKids.filter(kid => kid.id !== memberId);
}

function updateField(data: Record<string, string | undefined>): void {
  const field = data.field || '';
  const memberId = data.memberId || '';
  const value = data.value || '';
  if (field === 'familyName') previewSettings.familyName = value;
  else if (field === 'parentPin') previewSettings.parentPin = value.replace(/\D/g, '').slice(0, 4);
  else if (field === 'timezone') previewSettings.timezone = value || 'America/Phoenix';
  else if (field && memberId) updateMember(memberId, { [field]: value });
}

function updateMember(memberId: string, patch: Partial<SetupMember>): void {
  previewParents = previewParents.map(member => member.id === memberId ? { ...member, ...patch } : member);
  previewKids = previewKids.map(member => member.id === memberId ? { ...member, ...patch } : member);
}

function toggleSet(set: Set<string>, value: string): void {
  if (!value) return;
  if (set.has(value)) set.delete(value);
  else set.add(value);
}

function toggleSetting(id: string): void {
  if (id === 'autoApprove') previewSettings.autoApprove = !previewSettings.autoApprove;
  else if (id === 'hideUnavailable') previewSettings.hideUnavailable = !previewSettings.hideUnavailable;
  else if (id === 'hideUnavailablePrizes') previewSettings.hideUnavailablePrizes = !previewSettings.hideUnavailablePrizes;
  else if (id === 'notifyChore') previewSettings.notifyChore = !previewSettings.notifyChore;
  else if (id === 'notifySpend') previewSettings.notifySpend = !previewSettings.notifySpend;
}

function renderOnboardingModal(): string {
  if (activeModal === 'invite-parent') {
    return `
      <div class="modal-overlay quick-modal-overlay onboarding-preview-modal-overlay" data-onboarding-local-action="close-modal">
        <div class="modal quick-action-modal quick-action-modal-wide onboarding-preview-modal" onclick="event.stopPropagation()">
          <div class="modal-handle"></div>
          <div style="text-align:center;padding:4px 0 8px">
            <i class="ph-duotone ph-user-plus" style="font-size:2.5rem;color:#6C63FF"></i>
            <div class="modal-title" style="margin-top:8px">Add a parent</div>
            <p style="font-size:0.88rem;color:var(--muted);margin:8px 0 16px;line-height:1.5">Enter the email they'll use to sign in with Google or Apple. No email will be sent; just have them open GemSprout and sign in with this account.</p>
          </div>
          <div style="min-height:210px;display:flex;flex-direction:column">
            <input type="email" placeholder="partner@email.com" autocomplete="email" style="width:100%;box-sizing:border-box;padding:12px 14px;border:1.5px solid #E5E7EB;border-radius:10px;font-size:1rem;margin-bottom:16px;outline:none">
            <div style="margin-top:auto">
              <button class="btn btn-primary" style="width:100%" data-onboarding-local-action="close-modal" type="button">
                <i class="ph-duotone ph-user-plus" style="vertical-align:middle;margin-right:6px"></i> Add parent
              </button>
              <button class="btn btn-secondary" style="width:100%;margin-top:8px" data-onboarding-local-action="close-modal" type="button">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  if (activeModal === 'kid-qr') {
    return `
      <div class="modal-overlay quick-modal-overlay onboarding-preview-modal-overlay" data-onboarding-local-action="close-modal">
        <div class="modal quick-action-modal quick-action-modal-wide onboarding-preview-modal" onclick="event.stopPropagation()">
          <div class="modal-handle"></div>
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
          <div style="text-align:center;font-size:1.8rem;font-weight:900;letter-spacing:0.2em;color:#4C1D95;font-family:'Jost','Avenir Next','Segoe UI',system-ui,sans-serif;margin-bottom:16px">${escapeHtml(previewSettings.familyCode)}</div>
          <button class="btn btn-secondary" style="width:100%" data-onboarding-local-action="close-modal" type="button">Done</button>
        </div>
      </div>
    `;
  }
  return '';
}

function makePreviewFamilyCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const values = new Uint32Array(6);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(values);
  } else {
    for (let index = 0; index < values.length; index += 1) values[index] = Math.floor(Math.random() * alphabet.length);
  }
  return Array.from(values, value => alphabet[value % alphabet.length]).join('');
}
