import { type AppState, type AppHistoryRow, type AppMember } from '../../app/app-state';
import { escapeHtml, statusPill } from '../../ui/html';
import { createParentDashboardModel, type ParentDashboardModel, type ParentSnapshotCard } from './model';
import { renderParentQuickLaunch } from './quick-actions';

export type ParentTabId = 'overview' | 'tasks' | 'prizes' | 'levels' | 'stats';

export function renderParentHeader(state: AppState, activeParent?: AppMember | null): string {
  const parent = activeParent?.role === 'parent'
    ? activeParent
    : state.members.find(member => member.role === 'parent') || null;
  const parentName = String(parent?.name || 'Parent');
  const rawFamilyName = String(state.familyName || 'GemSprout Family');
  const familyStem = rawFamilyName
    .replace(/^\s*the\s+/i, '')
    .replace(/\s+family\s*$/i, '')
    .trim() || rawFamilyName;
  const parentAvatar = renderAvatar(String(parent?.avatar || parent?.icon || 'user-circle'), String(parent?.avatarColor || parent?.color || '#6C63FF'));
  return `
    <div class="header-left">
      <span class="header-avatar">${parentAvatar}</span>
      <div>
        <div class="header-name">Hi, ${escapeHtml(parentName)}!</div>
        <div class="header-sub">The ${escapeHtml(familyStem)} Family</div>
      </div>
    </div>
    <div class="header-actions">
      <button class="btn-icon-sm parent-settings-gear-btn" id="reset-state-btn" type="button" aria-label="Open settings">
        <i class="ph-duotone ph-gear-six" style="font-size:1.15rem"></i>
      </button>
    </div>
  `;
}

export function renderParentNav(activeTab: ParentTabId, pendingCount = 0): string {
  return `
    <button class="nav-item ${activeTab === 'overview' ? 'active' : ''}" data-parent-tab="overview" type="button">
      <span class="nav-icon">${navIcon('home')}</span>
      <span>Overview</span>
      ${pendingCount > 0 ? `<span class="nav-badge">${pendingCount}</span>` : ''}
    </button>
    <button class="nav-item ${activeTab === 'tasks' ? 'active' : ''}" data-parent-tab="tasks" type="button">
      <span class="nav-icon">${navIcon('tasks')}</span>
      <span>Tasks</span>
    </button>
    <button class="nav-item ${activeTab === 'prizes' ? 'active' : ''}" data-parent-tab="prizes" type="button">
      <span class="nav-icon">${navIcon('prizes')}</span>
      <span>Prizes</span>
    </button>
    <button class="nav-item ${activeTab === 'levels' ? 'active' : ''}" data-parent-tab="levels" type="button">
      <span class="nav-icon">${navIcon('levels')}</span>
      <span>Levels</span>
    </button>
    <button class="nav-item ${activeTab === 'stats' ? 'active' : ''}" data-parent-tab="stats" type="button">
      <span class="nav-icon">${navIcon('stats')}</span>
      <span>Stats</span>
    </button>
  `;
}

export function renderParentDashboard(state: AppState): string {
  const model = createParentDashboardModel(state);
  return `
    ${renderHero(model)}
    ${renderInbox(model)}
    ${renderSnapshots(model)}
    ${renderHistory(model.historyRows)}
  `;
}

export function renderHero(model: ParentDashboardModel): string {
  return `
    <section class="parent-hero" id="overview-hero-section" data-motion-key="overview-hero">
      <div class="parent-hero-head">
        <div class="parent-hero-copy">
          <div class="parent-hero-kicker">Family Control Center</div>
          <div class="parent-hero-title">Today at a glance</div>
          <div class="parent-hero-sub">See what needs review, how your kids are progressing, and where family momentum stands right now.</div>
        </div>
        ${renderParentQuickLaunch(model.state)}
      </div>
      <div class="parent-summary-grid">
        <div class="parent-summary-tile">
          <div class="parent-summary-label">Needs Review</div>
          <div class="parent-summary-value">${model.pendingCount}</div>
          <div class="parent-summary-sub">0 in progress</div>
        </div>
        <div class="parent-summary-tile">
          <div class="parent-summary-label">Finished Today</div>
          <div class="parent-summary-value">${model.finishedToday}</div>
          <div class="parent-summary-sub">across all kids</div>
        </div>
        <div class="parent-summary-tile">
          <div class="parent-summary-label">Gem Balance</div>
          <div class="parent-summary-value">${model.gems}</div>
          <div class="parent-summary-sub">across all kids</div>
        </div>
        <div class="parent-summary-tile">
          <div class="parent-summary-label">Family Savings</div>
          <div class="parent-summary-value">$${model.savings.toFixed(2)}</div>
          <div class="parent-summary-sub">current balance</div>
        </div>
      </div>
    </section>
  `;
}

function renderInbox(model: ParentDashboardModel): string {
  const rows = model.inboxItems.length
    ? model.inboxItems.map(item => `
        <div class="admin-card inbox-item inbox-item-${escapeHtml(item.tone)}">
          <div class="admin-icon"><i class="ph-duotone ${escapeHtml(item.icon)}"></i></div>
          ${item.photoUrl ? `<button class="photo-approval-thumb-btn photo-approval-thumb-card" data-view-photo="${escapeHtml(item.photoUrl)}" type="button" title="View photo"><img src="${escapeHtml(item.photoUrl)}" class="photo-approval-thumb photo-approval-thumb-inline" alt="Photo"></button>` : ''}
          <div class="admin-info">
            <div class="admin-name">
              ${escapeHtml(item.title)}
              ${item.slotLabel ? `<span style="font-size:0.8rem;color:var(--muted)">(${escapeHtml(item.slotLabel)})</span>` : ''}
            </div>
            <div class="admin-meta">${item.photoUrl ? `${escapeHtml(item.memberName || '')} - ${escapeHtml(item.pointsLabel || '')}` : escapeHtml(item.meta)}</div>
          </div>
          <div class="admin-actions">
            ${item.canAct ? `
              <button class="btn-icon-sm btn-icon-reject" data-deny-request-id="${escapeHtml(item.id)}" type="button" aria-label="Deny request"><i class="ph-duotone ph-x"></i></button>
              <button class="btn-icon-sm btn-icon-approve" data-approve-request-id="${escapeHtml(item.id)}" type="button" aria-label="Approve request"><i class="ph-duotone ph-check"></i></button>
            ` : statusPill(item.status)}
          </div>
        </div>
      `).join('')
    : '<div class="text-muted inbox-empty-state">You\'re all caught up!</div>';

  return `
    <section id="family-inbox-section" data-motion-key="overview-inbox">
      <div class="inbox-head">
        <div class="inbox-title"><i class="ph-duotone ph-tray" style="color:#1D6B57;font-size:1rem"></i> Family Inbox</div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="inbox-count">${model.pendingCount} Item${model.pendingCount === 1 ? '' : 's'}</div>
          <button class="inbox-refresh-btn" id="reset-hero-btn" type="button" aria-label="Refresh family inbox"><i class="ph-duotone ph-arrow-clockwise"></i></button>
        </div>
      </div>
      <div class="inbox-list">${rows}</div>
    </section>
  `;
}

export function renderSnapshots(model: ParentDashboardModel): string {
  const rows = model.snapshots.length
    ? `<div class="overview-kids-grid overview-kids-grid-spaced">${model.snapshots.map(renderSnapshotCard).join('')}</div>`
    : '<div class="empty-state"><div class="empty-icon"><i class="ph-duotone ph-smiley" style="color:#9CA3AF;font-size:3rem"></i></div><div class="empty-text">No kids yet - go to Setup!</div></div>';

  return `
    <section id="overview-snapshots-section" data-motion-key="overview-snapshots">
      <div class="section-row">
        <span class="section-title"><i class="ph-duotone ph-users-three" style="color:#1D6B57;font-size:1rem;vertical-align:middle"></i> Family Snapshots</span>
      </div>
      ${rows}
    </section>
  `;
}

function renderSnapshotCard(snapshot: ParentSnapshotCard, index: number): string {
  const side = index % 2 === 0 ? 'left' : 'right';
  const totalTasks = snapshot.totalTasks || snapshot.completeCount || snapshot.waitingCount;
  const statuses = totalTasks
    ? [
        `<span class="snapshot-summary-status"><strong>${snapshot.completeCount}/${totalTasks}</strong> Complete</span>`,
        ...(snapshot.waitingCount > 0 ? [`<span class="snapshot-summary-status"><strong>${snapshot.waitingCount}</strong> Waiting</span>`] : []),
      ].join('')
    : '<span class="snapshot-summary-status-empty">No tasks assigned yet</span>';

  return `
    <div class="snapshot-summary-shell" data-summary-id="summary_${escapeHtml(snapshot.id)}" data-side="${side}">
      <div class="snapshot-summary-reveal ${snapshot.isHereToday ? 'here' : 'away'} ${snapshot.claimableSavingsInterest > 0 ? 'has-claim' : ''}">
        <div class="snapshot-summary-toggle-row">
          <button class="snapshot-summary-toggle-btn home ${snapshot.isHereToday ? 'active' : ''}" data-summary-home="${escapeHtml(snapshot.id)}" type="button">
            <i class="ph-duotone ph-house-line"></i><span>Home</span>
          </button>
          <button class="snapshot-summary-toggle-btn away ${snapshot.isHereToday ? '' : 'active'}" data-summary-away="${escapeHtml(snapshot.id)}" type="button">
            <i class="ph-duotone ph-house-line"></i><span>Away</span>
          </button>
          ${snapshot.claimableSavingsInterest > 0 ? `<button class="snapshot-summary-toggle-btn home" data-summary-claim-interest="${escapeHtml(snapshot.id)}" type="button">
            <i class="ph-duotone ph-trend-up"></i><span>Interest</span>
          </button>` : ''}
        </div>
      </div>
      <button class="snapshot-summary-card" data-summary-card="${escapeHtml(snapshot.id)}" data-summary-side="${side}" style="--snapshot-accent:${escapeHtml(snapshot.color)}" type="button">
        <div class="snapshot-summary-name-row">
          <div class="snapshot-summary-name">${escapeHtml(snapshot.name)}</div>
          <span class="snapshot-summary-avatar">${renderAvatar(snapshot.avatar, snapshot.color)}</span>
        </div>
        <div class="snapshot-summary-sub">${statuses}</div>
        <div class="snapshot-summary-chips">
          <span class="snapshot-summary-chip"><strong>${snapshot.gems}</strong><small>Gems</small></span>
          <span class="snapshot-summary-chip"><strong>$${snapshot.savings.toFixed(2)}</strong><small>Savings</small></span>
        </div>
        <div class="snapshot-summary-swipe-note"><i class="ph-duotone ph-caret-double-right"></i></div>
      </button>
    </div>
  `;
}

function renderAvatar(avatar: string, color: string): string {
  const iconClasses = [...avatar.matchAll(/\bph-([a-z0-9-]+)\b/gi)].map(match => match[1]).filter(name => name !== 'duotone');
  const iconNameFromHtml = iconClasses[0];
  if (iconNameFromHtml) {
    return `<i class="ph-duotone ph-${escapeHtml(iconNameFromHtml)}" style="color:${escapeHtml(color)}"></i>`;
  }
  if (/^ph-/.test(avatar)) {
    return `<i class="ph-duotone ${escapeHtml(avatar)}" style="color:${escapeHtml(color)}"></i>`;
  }
  if (/^[a-z0-9-]+$/i.test(avatar)) {
    return `<i class="ph-duotone ph-${escapeHtml(avatar)}" style="color:${escapeHtml(color)}"></i>`;
  }
  return escapeHtml(avatar);
}

export function renderHistory(historyRows: AppHistoryRow[]): string {
  const rows = historyRows.length
    ? historyRows.slice(0, 5).map(row => {
      const value = historyValue(row);
      const tone = value.startsWith('-') ? 'negative' : value === '0' ? 'neutral' : 'positive';
      const canUndo = canUndoHistoryRow(row);
      const rowId = escapeHtml(String(row.id || row.createdAt || row.title || 'row'));
      const rowHtml = `
        <div class="activity-row ${canUndo ? 'activity-row-swipe' : ''}">
          <div class="activity-badge" style="background:${activityBadgeBackground(row)};color:${activityBadgeColor(row)}">
            <i class="ph-duotone ${activityIcon(row)}"></i>
          </div>
          <div class="activity-body">
            <div class="activity-title">${escapeHtml(row.title || row.type || 'Activity')}</div>
            <div class="activity-meta">${formatActivityTimestamp(row.createdAt)}</div>
          </div>
          <div class="activity-delta ${tone}">
            <div class="activity-delta-value">${value}</div>
            <div class="activity-delta-unit">${row.amount ? 'cash' : 'gems'}</div>
          </div>
          ${canUndo ? `<div class="activity-swipe-hint"><i class="ph-duotone ph-caret-double-left"></i></div>` : ''}
        </div>
      `;
      if (!canUndo) return rowHtml;
      return `
      <div class="snapshot-routine-shell activity-swipe-shell" data-swipe-id="activity_${rowId}">
        <div class="snapshot-routine-reveal activity-reveal">
          <button class="snapshot-reveal-btn snapshot-reveal-btn-danger activity-reveal-btn" data-history-undo="${escapeHtml(String(row.id || ''))}" type="button" title="Undo action">
            <i class="ph-duotone ph-arrow-counter-clockwise"></i>
          </button>
        </div>
        <div class="snapshot-routine-card activity-row-card">
          ${rowHtml}
        </div>
      </div>
    `;
    }).join('')
    : '<div class="text-muted">No activity yet.</div>';

  return `
    <section id="overview-history-section" data-motion-key="overview-history">
      <div class="section-row">
        <span class="section-title"><i class="ph-duotone ph-clipboard-text" style="color:#9CA3AF;font-size:1rem;vertical-align:middle"></i> Recent Activity</span>
      </div>
      <div class="card activity-card">${rows}</div>
      ${historyRows.length > 5 ? `<div class="card" style="margin-top:12px;padding:12px 14px"><button class="btn btn-secondary btn-sm" data-open-full-history type="button" style="width:100%">See All History</button></div>` : ''}
    </section>
  `;
}
function historyValue(row: AppHistoryRow): string {
  const gems = Number(row.gems || 0);
  if (gems) return `${gems > 0 ? '+' : ''}${gems}`;
  if (row.amount) return `$${Number(row.amount).toFixed(2)}`;
  return '0';
}

function activityIcon(row: AppHistoryRow): string {
  const type = String(row.type || '');
  if (type.includes('prize')) return 'ph-gift';
  if (type.includes('saving')) return 'ph-piggy-bank';
  if (type.includes('decline') || type.includes('denied')) return 'ph-x-circle';
  return 'ph-check-circle';
}

function activityBadgeBackground(row: AppHistoryRow): string {
  const type = String(row.type || '');
  if (type.includes('decline') || type.includes('denied')) return '#FEE2E2';
  if (type.includes('prize')) return '#F3E4B8';
  if (type.includes('saving')) return '#DCFCE7';
  return '#DCFCE7';
}

function canUndoHistoryRow(row: AppHistoryRow): boolean {
  return !!getHistoryRequestId(row);
}

function getHistoryRequestId(row: AppHistoryRow): string {
  if (row.requestId) return String(row.requestId);
  const id = String(row.id || '');
  const match = id.match(/^history:request:(.+):(approve|deny)$/);
  return match?.[1] || '';
}

export function renderFullHistoryModal(historyRows: AppHistoryRow[]): string {
  const rows = historyRows.length
    ? historyRows.map(row => {
      const value = historyValue(row);
      const tone = value.startsWith('-') ? 'negative' : value === '0' ? 'neutral' : 'positive';
      return `
        <div class="activity-row">
          <div class="activity-badge" style="background:${activityBadgeBackground(row)};color:${activityBadgeColor(row)}">
            <i class="ph-duotone ${activityIcon(row)}"></i>
          </div>
          <div class="activity-body">
            <div class="activity-title">${escapeHtml(row.title || row.type || 'Activity')}</div>
            <div class="activity-meta">${formatActivityTimestamp(row.createdAt)}</div>
          </div>
          <div class="activity-delta ${tone}">
            <div class="activity-delta-value">${value}</div>
            <div class="activity-delta-unit">${row.amount ? 'cash' : 'gems'}</div>
          </div>
        </div>
      `;
    }).join('')
    : '<div class="text-muted">No activity yet.</div>';

  return `
    <div class="settings-subpane settings-subpane-enter">
      <div class="settings-header">
        <button class="btn-back" data-close-history-pane type="button">&larr;</button>
        <span class="settings-header-title"><i class="ph-duotone ph-clipboard-text" style="color:#9CA3AF;font-size:1.1rem;vertical-align:middle"></i> Full Activity History</span>
      </div>
      <div class="settings-body">
        <div class="card activity-card">
          ${rows}
        </div>
      </div>
    </div>
  `;
}
function activityBadgeColor(row: AppHistoryRow): string {
  const type = String(row.type || '');
  if (type.includes('decline') || type.includes('denied')) return '#EF4444';
  if (type.includes('prize')) return '#9A6419';
  if (type.includes('saving')) return '#167047';
  return '#16A34A';
}

export function renderParentSnapshotModal(state: AppState, snapshotId: string, side: 'left' | 'right' = 'left'): string {
  const model = createParentDashboardModel(state);
  const snapshot = model.snapshots.find(item => item.id === snapshotId);
  if (!snapshot) return '';

  const memberHistory = state.historyRows
    .filter(row => row.memberId === snapshotId || !row.memberId)
    .slice(0, 6)
    .map(row => {
      const value = historyValue(row);
      const tone = value.startsWith('-') ? 'negative' : value === '0' ? 'neutral' : 'positive';
      return `
        <div class="activity-row">
          <div class="activity-badge" style="background:${activityBadgeBackground(row)};color:${activityBadgeColor(row)}">
            <i class="ph-duotone ${activityIcon(row)}"></i>
          </div>
          <div class="activity-body">
            <div class="activity-title">${escapeHtml(row.title || row.type || 'Activity')}</div>
            <div class="activity-meta">${formatActivityTimestamp(row.createdAt)}</div>
          </div>
          <div class="activity-delta ${tone}">
            <div class="activity-delta-value">${value}</div>
            <div class="activity-delta-unit">${row.amount ? 'cash' : 'gems'}</div>
          </div>
        </div>
      `;
    }).join('');

  return `
    <div class="modal-overlay snapshot-panel-overlay" data-modal-overlay>
      <div class="modal snapshot-panel snapshot-panel-${side}">
        <div class="snapshot-panel-head" style="--snapshot-accent:${escapeHtml(snapshot.color)}">
          <button class="snapshot-panel-close" data-close-modal type="button"><i class="ph-duotone ph-arrow-left"></i></button>
          <div>
            <div class="snapshot-panel-person">
              <div class="snapshot-panel-avatar">${renderAvatar(snapshot.avatar, snapshot.color)}</div>
              <div>
                <div class="snapshot-panel-name">${escapeHtml(snapshot.name)}</div>
                <div class="snapshot-panel-sub">${snapshot.completeCount}/${snapshot.totalTasks} tasks wrapped up${snapshot.waitingCount > 0 ? ` - ${snapshot.waitingCount} waiting` : ''}</div>
              </div>
            </div>
            <div class="snapshot-panel-stats">
              <span class="snapshot-panel-stat"><strong>${snapshot.gems}</strong><small>Gems</small></span>
              <span class="snapshot-panel-stat"><strong>$${snapshot.savings.toFixed(2)}</strong><small>Savings</small></span>
              <span class="snapshot-panel-stat"><strong>${snapshot.totalEarned}</strong><small>Total Earned</small></span>
            </div>
          </div>
        </div>
        <div class="snapshot-panel-body">
          <div class="section-row"><span class="section-title"><i class="ph-duotone ph-clipboard-text" style="color:#9CA3AF;font-size:1rem;vertical-align:middle"></i> Recent Activity</span></div>
          <div class="card activity-card">${memberHistory || '<div class="text-muted">No activity yet.</div>'}</div>
        </div>
      </div>
    </div>
  `;
}

function formatActivityTimestamp(createdAt?: number): string {
  if (!createdAt) return 'No timestamp';
  return new Date(createdAt).toLocaleString([], {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function navIcon(kind: 'home' | 'tasks' | 'prizes' | 'levels' | 'stats'): string {
  switch (kind) {
    case 'home':
      return `<svg viewBox="0 0 28 28" fill="none" width="1em" height="1em"><path d="M14 4L3 13h3v10h6v-6h4v6h6V13h3L14 4z" fill="#6C63FF" fill-opacity=".18" stroke="#6C63FF" stroke-width="1.8" stroke-linejoin="round"/><rect x="11.5" y="17" width="5" height="6" rx="1.2" fill="#6C63FF" opacity=".5"/></svg>`;
    case 'tasks':
      return `<svg viewBox="0 0 28 28" fill="none" width="1em" height="1em"><rect x="6" y="5" width="16" height="20" rx="3" fill="#6BCB77" fill-opacity=".18" stroke="#6BCB77" stroke-width="1.8"/><rect x="10" y="3.5" width="8" height="4" rx="2" fill="#6BCB77"/><line x1="10" y1="12" x2="18" y2="12" stroke="#6BCB77" stroke-width="1.6" stroke-linecap="round"/><line x1="10" y1="16" x2="18" y2="16" stroke="#6BCB77" stroke-width="1.6" stroke-linecap="round"/><polyline points="10,21.5 12.5,24 18,18" stroke="#6BCB77" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
    case 'prizes':
      return `<svg viewBox="0 0 28 28" fill="none" width="1em" height="1em"><rect x="4" y="13" width="20" height="11" rx="2" fill="#FF6584" fill-opacity=".18" stroke="#FF6584" stroke-width="1.8"/><rect x="4" y="9" width="20" height="5" rx="2" fill="#FF6584" fill-opacity=".3" stroke="#FF6584" stroke-width="1.8"/><line x1="14" y1="9" x2="14" y2="24" stroke="#FF6584" stroke-width="1.8"/><path d="M14 9c-1-2.5-4.5-4-5.5-1.5S11 10.5 14 9z" fill="#FF6584"/><path d="M14 9c1-2.5 4.5-4 5.5-1.5S17 10.5 14 9z" fill="#FF6584"/><circle cx="14" cy="9" r="1.6" fill="#FF6584"/></svg>`;
    case 'levels':
      return `<svg viewBox="0 0 28 28" fill="none" width="1em" height="1em"><path d="M9 4h10v12c0 2.8-2.2 5-5 5s-5-2.2-5-5V4z" fill="#FFD93D" fill-opacity=".3" stroke="#FFD93D" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 8H5v4c0 2.2 1.8 4 4 4" stroke="#FFD93D" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M19 8h4v4c0 2.2-1.8 4-4 4" stroke="#FFD93D" stroke-width="1.8" stroke-linecap="round" fill="none"/><line x1="14" y1="21" x2="14" y2="24" stroke="#FFD93D" stroke-width="1.8" stroke-linecap="round"/><line x1="10" y1="24" x2="18" y2="24" stroke="#FFD93D" stroke-width="2.2" stroke-linecap="round"/></svg>`;
    case 'stats':
      return `<svg viewBox="0 0 28 28" fill="none" width="1em" height="1em"><circle cx="14" cy="14" r="9.5" fill="#45B7D1" fill-opacity=".16" stroke="#45B7D1" stroke-width="1.8"/><path d="M14 4.5a9.5 9.5 0 0 1 8.86 6.06L14 14V4.5z" fill="#45B7D1" fill-opacity=".85"/><path d="M14 14l-5.9 7.44A9.5 9.5 0 0 1 4.5 14H14z" fill="#45B7D1" fill-opacity=".38"/><circle cx="14" cy="14" r="2.3" fill="#45B7D1"/></svg>`;
  }
}





