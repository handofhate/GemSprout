import { type DemoAppState, type DemoMember } from '../../app/local-demo-state';
import { escapeHtml } from '../../ui/html';

export type ParentQuickActionId = 'listening' | 'savings' | 'gems';

type ParentQuickAction = {
  id: ParentQuickActionId;
  label: string;
  icon: string;
  tint: string;
};

export type ListeningQuickActionState = {
  selectedKidIds: string[];
  accumulatedMs: number;
  isHolding: boolean;
  diamondsLost: number;
};

export type SavingsQuickActionState = {
  sign: 1 | -1;
  selectedKidIds: string[];
  amount: string;
  reason: string;
};

export type GemsQuickActionState = {
  sign: 1 | -1;
  selectedKidIds: string[];
  amount: string;
  reason: string;
};

export type ParentQuickActionState = {
  listening?: ListeningQuickActionState;
  savings?: SavingsQuickActionState;
  gems?: GemsQuickActionState;
};

const PARENT_QUICK_ACTIONS: ParentQuickAction[] = [
  { id: 'listening', label: 'Not Listening', icon: 'ph-speaker-slash', tint: '#f6b4a8' },
  { id: 'savings', label: 'Savings', icon: 'ph-piggy-bank', tint: '#a8e6c0' },
  { id: 'gems', label: 'Gems', icon: 'ph-sketch-logo', tint: '#f4d58d' },
];

export function renderParentQuickLaunch(state: DemoAppState): string {
  const actions = PARENT_QUICK_ACTIONS.filter(action => action.id !== 'listening' || state.settings.notListeningEnabled !== false);
  const quickActionsHtml = actions.map(action => `
    <button
      class="hero-quick-action"
      data-parent-quick-action="${action.id}"
      style="--fan-tint:${action.tint}"
      type="button"
    >
      <i class="ph-duotone ${action.icon}" style="font-size:1rem"></i>
      <span>${action.label}</span>
    </button>
  `).join('');

  return `
    <div id="parent-quick-launch" class="hero-quick-launch" aria-expanded="false">
      <button class="hero-quick-trigger" data-parent-quick-trigger type="button" aria-label="Quick actions">
        <i class="ph-duotone ph-plus-circle"></i>
      </button>
      <div class="hero-quick-fan" data-parent-quick-fan>${quickActionsHtml}</div>
    </div>
  `;
}

export function createInitialQuickActionState(actionId: ParentQuickActionId, state: DemoAppState): ParentQuickActionState {
  const kids = getKids(state);
  const defaultSelectedKidIds = kids.length === 1 && kids[0].id ? [kids[0].id] : [];
  if (actionId === 'listening') {
    return {
      listening: {
        selectedKidIds: defaultSelectedKidIds,
        accumulatedMs: 0,
        isHolding: false,
        diamondsLost: 0,
      },
    };
  }
  if (actionId === 'savings') {
    return {
      savings: {
        sign: 1,
        selectedKidIds: [],
        amount: '',
        reason: '',
      },
    };
  }
  return {
    gems: {
      sign: 1,
      selectedKidIds: [],
      amount: '',
      reason: '',
    },
  };
}

export function renderParentQuickActionModal(actionId: ParentQuickActionId, state: DemoAppState, quickState: ParentQuickActionState): string {
  switch (actionId) {
    case 'listening':
      return renderNotListeningModal(state, quickState.listening || createInitialQuickActionState('listening', state).listening!);
    case 'savings':
      return renderSavingsModal(state, quickState.savings || createInitialQuickActionState('savings', state).savings!);
    case 'gems':
      return renderGemsModal(state, quickState.gems || createInitialQuickActionState('gems', state).gems!);
    default:
      return '';
  }
}

function renderNotListeningModal(state: DemoAppState, quickState: ListeningQuickActionState): string {
  const kids = getKids(state);
  const totalSecs = Math.floor(quickState.accumulatedMs / 1000);
  const mins = String(Math.floor(totalSecs / 60)).padStart(2, '0');
  const secs = String(totalSecs % 60).padStart(2, '0');

  return renderQuickModalShell(
    'Not Listening',
    `
      <div id="nl-modal-body" class="nl-modal-shell">
        <div class="nl-timer" id="nl-timer">${mins}:${secs}</div>
        <div class="nl-dmds-lost" id="nl-dmds">${quickState.diamondsLost > 0 ? `-${quickState.diamondsLost} gems so far` : 'Hold the button to deduct gems'}</div>
        <div class="nl-kids">
          ${kids.map(member => {
            const selected = quickState.selectedKidIds.includes(String(member.id || ''));
            const secsLabel = formatKidListeningLabel(state, member, quickState, selected);
            return `
              <button class="nl-kid-chip ${selected ? 'selected' : ''}" data-quick-kid="${escapeHtml(String(member.id || ''))}" type="button">
                ${renderKidChipAvatar(member)} ${escapeHtml(member.name || 'Kid')}<br><span style="font-size:0.72rem;opacity:0.8">${escapeHtml(secsLabel)}</span>
              </button>
            `;
          }).join('')}
        </div>
        <button class="nl-hold-btn ${quickState.isHolding ? 'holding' : ''}" id="nl-hold-btn" data-nl-hold type="button">
          <span class="nl-hold-btn-text">${quickState.isHolding ? 'RUNNING' : 'HOLD'}</span>
          <span class="nl-hold-hint">${quickState.isHolding ? 'Release to pause' : 'Hold to penalize'}</span>
        </button>
        <div class="nl-actions">
          <button class="nl-btn-cancel" data-close-modal type="button">Cancel</button>
          <button class="nl-btn-done" data-quick-submit type="button">Apply &amp; Done</button>
        </div>
      </div>
    `,
  );
}

function renderSavingsModal(state: DemoAppState, quickState: SavingsQuickActionState): string {
  const kids = getKids(state);
  const currency = '$';
  return renderQuickModalShell(
    'Savings',
    `
      <div id="adj-sav-body">
        ${renderActionToggle('Action', quickState.sign, '+ Deposit', 'Withdraw', '#16A34A')}
        ${renderKidSelector(kids, quickState.selectedKidIds, '#16A34A', '#DCFCE7')}
        <div class="form-group">
          <label class="form-label">Amount (${currency})</label>
          <input type="number" data-quick-amount min="0.01" step="0.01" value="${escapeHtml(quickState.amount)}" placeholder="e.g. 5.00" style="font-size:1.1rem">
        </div>
        <div class="form-group">
          <label class="form-label">Reason <span class="form-label-hint">optional</span></label>
          <input type="text" data-quick-reason value="${escapeHtml(quickState.reason)}" placeholder="${quickState.sign === 1 ? 'Birthday money, allowance...' : 'Spending...'}">
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-close-modal type="button">Cancel</button>
          <button class="btn btn-primary" data-quick-submit type="button">Done</button>
        </div>
      </div>
    `,
  );
}

function renderGemsModal(state: DemoAppState, quickState: GemsQuickActionState): string {
  const kids = getKids(state);
  return renderQuickModalShell(
    'Gems',
    `
      <div id="adj-dmds-body">
        ${renderActionToggle('Action', quickState.sign, '+ Add', 'Remove', '#6C63FF')}
        ${renderKidSelector(kids, quickState.selectedKidIds, '#6C63FF', '#EDE9FE')}
        <div class="form-group">
          <label class="form-label">Amount (gems)</label>
          <input type="number" data-quick-amount min="1" value="${escapeHtml(quickState.amount)}" placeholder="e.g. 5" style="font-size:1.1rem">
        </div>
        <div class="form-group">
          <label class="form-label">Reason <span class="form-label-hint">optional</span></label>
          <input type="text" data-quick-reason value="${escapeHtml(quickState.reason)}" placeholder="${quickState.sign === 1 ? 'Bonus for helping...' : 'Adjustment...'}">
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" data-close-modal type="button">Cancel</button>
          <button class="btn btn-primary" data-quick-submit type="button">Done</button>
        </div>
      </div>
    `,
  );
}

function renderQuickModalShell(title: string, body: string): string {
  return `
    <div class="modal-handle"></div>
    <button class="modal-close-x" data-close-modal type="button" aria-label="Close">
      <i class="ph-duotone ph-x"></i>
    </button>
    ${body}
  `;
}

function renderActionToggle(label: string, sign: 1 | -1, positiveLabel: string, negativeLabel: string, positiveColor: string): string {
  return `
    <div class="toggle-row" style="margin-bottom:16px">
      <span class="form-label" style="margin-bottom:0">${escapeHtml(label)}</span>
      <div style="display:flex;gap:6px">
        <button data-quick-sign="1" type="button"
          style="padding:8px 18px;border-radius:99px;border:2px solid ${sign === 1 ? positiveColor : '#E5E7EB'};
            background:${sign === 1 ? positiveColor : '#fff'};color:${sign === 1 ? '#fff' : 'var(--text)'};font-weight:700;cursor:pointer">
          ${escapeHtml(positiveLabel)}
        </button>
        <button data-quick-sign="-1" type="button"
          style="padding:8px 18px;border-radius:99px;border:2px solid ${sign === -1 ? '#EF4444' : '#E5E7EB'};
            background:${sign === -1 ? '#EF4444' : '#fff'};color:${sign === -1 ? '#fff' : 'var(--text)'};font-weight:700;cursor:pointer">
          ${escapeHtml(negativeLabel)}
        </button>
      </div>
    </div>
  `;
}

function renderKidSelector(kids: DemoMember[], selectedKidIds: string[], color: string, background: string): string {
  if (kids.length <= 1) return '';
  return `
    <div style="margin-bottom:16px">
      <div class="form-label" style="margin-bottom:8px">Who</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${kids.map(member => {
          const selected = selectedKidIds.includes(String(member.id || ''));
          return `
            <button data-quick-kid="${escapeHtml(String(member.id || ''))}" type="button"
              style="padding:8px 16px;border-radius:99px;border:2px solid ${selected ? color : '#E5E7EB'};
                background:${selected ? background : '#fff'};color:${selected ? color : 'var(--text)'};
                font-weight:700;font-size:0.95rem;cursor:pointer">
              ${renderKidChipAvatar(member)} ${escapeHtml(member.name || 'Kid')}
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderKidChipAvatar(member: DemoMember): string {
  const avatar = String(member.avatar || '').trim();
  if (/ph-/.test(avatar)) return avatar;
  return '<i class="ph-duotone ph-smiley" style="color:#9CA3AF"></i>';
}

function formatKidListeningLabel(state: DemoAppState, member: DemoMember, quickState: ListeningQuickActionState, selected: boolean): string {
  const todayKey = todayKeyForQuickAction(state);
  const currentSecs = member.nlDate === todayKey ? Number(member.nlTodaySecs || 0) : 0;
  const previewSecs = selected ? currentSecs + Math.floor(quickState.accumulatedMs / 1000) : currentSecs;
  if (previewSecs <= 0) return 'no time today';
  return `${Math.floor(previewSecs / 60)}m${previewSecs % 60}s today`;
}

function todayKeyForQuickAction(state: DemoAppState): string {
  const timezone = String(state.settings.familyTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Phoenix');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getKids(state: DemoAppState): DemoMember[] {
  const members = state.members?.length ? state.members : [state.member].filter((member): member is DemoMember => !!member);
  return members.filter(member => member.role === 'kid' || !member.role);
}
