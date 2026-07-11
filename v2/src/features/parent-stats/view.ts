import { type DemoAppState, type DemoHistoryRow, type DemoMember } from '../../app/local-demo-state';
import { escapeHtml } from '../../ui/html';
import { getLevels } from '../parent-levels/view';
import { renderWeekReviewLaunchCard } from '../week-review/view';

type MemberStats = {
  diamondsEarned: number;
  savings: number;
  choreDone: number;
  rewardCount: number;
  badgeCount: number;
  totalXP: number;
  streak: number;
  currentLevel: { level?: number; name?: string; icon?: string };
};

export function renderParentStats(state: DemoAppState): string {
  const kids = state.members.filter(member => member.role === 'kid');
  return `
    <section data-motion-key="stats-launch">
      <div class="section-row">
        <span class="section-title"><i class="ph-duotone ph-chart-bar" style="color:#6C63FF;font-size:1rem;vertical-align:middle"></i> Lifetime Stats</span>
      </div>
      <div class="overview-kids-grid overview-kids-grid-spaced">
        ${renderWeekReviewLaunchCard(state)}
        ${renderFamilyStatsLaunchCard(kids, state)}
        ${kids.map((kid, index) => renderMemberStatsLaunchCard(kid, state, index % 2 === 1 ? 'right' : 'left')).join('')}
      </div>
    </section>
  `;
}

export function renderStatsDetailModal(state: DemoAppState, kind: 'family' | 'kid', memberId = '', side: 'left' | 'right' = 'left'): string {
  if (kind === 'family') {
    const kids = state.members.filter(member => member.role === 'kid');
    return `
      <div class="snapshot-panel-head stats-panel-head" style="--snapshot-accent:#6C63FF">
        <button class="snapshot-panel-close" data-close-modal type="button"><i class="ph-duotone ph-arrow-left"></i></button>
        <div class="snapshot-panel-person">
          <div class="snapshot-panel-avatar"><img src="/gemsprout.png" alt="" style="width:100%;height:100%;border-radius:20px"></div>
          <div>
            <div class="snapshot-panel-name">The Family</div>
            <div class="snapshot-panel-sub">Combined lifetime stats</div>
          </div>
        </div>
      </div>
      <div class="snapshot-panel-body stats-panel-body">${renderFamilyStatsCard(kids, state)}</div>
    `;
  }
  const member = state.members.find(item => item.id === memberId);
  if (!member) return '';
  return `
    <div class="snapshot-panel-head stats-panel-head" style="--snapshot-accent:${escapeHtml(String(member.color || '#6C63FF'))}">
      <button class="snapshot-panel-close" data-close-modal type="button"><i class="ph-duotone ph-arrow-left"></i></button>
      <div class="snapshot-panel-person">
        <div class="snapshot-panel-avatar">${renderMemberAvatar(member)}</div>
        <div>
          <div class="snapshot-panel-name">${escapeHtml(String(member.name || 'Kid'))}</div>
          <div class="snapshot-panel-sub">Lifetime stats</div>
        </div>
      </div>
    </div>
    <div class="snapshot-panel-body stats-panel-body">${renderMemberStatsCard(member, state)}</div>
  `;
}

function renderFamilyStatsLaunchCard(kids: DemoMember[], state: DemoAppState): string {
  const choreHist = state.historyRows.filter(row => row.type === 'chore');
  const totalDiamonds = kids.reduce((sum, kid) => sum + Number(kid.totalEarned || 0), 0);
  const totalPrizes = state.prizes.reduce((sum, prize) => sum + (prize.redemptions || []).length, 0);
  const totalSavings = kids.reduce((sum, kid) => sum + Number(kid.savings || 0), 0);
  return `
    <button class="snapshot-summary-card stats-launch-card stats-launch-card-family" data-open-stats="family" type="button" style="--stats-accent:#365e4f">
      <div class="stats-launch-head">
        <div class="stats-launch-avatar stats-launch-avatar-family"><img src="/gemsprout.png" alt="" style="width:100%;height:100%;border-radius:18px"></div>
        <div class="stats-launch-hero">
          <div class="stats-launch-name">The Family</div>
          <div class="stats-launch-sub">Family snapshot</div>
        </div>
      </div>
      <div class="stats-launch-spotlight-grid">
        <div class="stats-launch-spotlight">
          <div class="stats-launch-spotlight-value">${totalDiamonds}</div>
          <div class="stats-launch-spotlight-label">Gems earned across the family</div>
        </div>
        <div class="stats-launch-spotlight">
          <div class="stats-launch-spotlight-value">$${totalSavings.toFixed(2)}</div>
          <div class="stats-launch-spotlight-label">Current family savings</div>
        </div>
      </div>
      <div class="stats-launch-gridline">
        <span class="stats-launch-chip"><strong>${choreHist.length}</strong><small>Tasks</small></span>
        <span class="stats-launch-chip"><strong>${totalPrizes}</strong><small>Prizes</small></span>
        <span class="stats-launch-chip"><strong>${kids.length}</strong><small>Kids</small></span>
      </div>
    </button>
  `;
}

function renderMemberStatsLaunchCard(member: DemoMember, state: DemoAppState, side: 'left' | 'right'): string {
  const stats = buildMemberStats(member, state);
  return `
    <button class="snapshot-summary-card stats-launch-card" data-open-stats="kid" data-stats-member-id="${escapeHtml(String(member.id || ''))}" data-stats-side="${side}" type="button" style="--stats-accent:${escapeHtml(String(member.color || '#6C63FF'))}">
      <div class="stats-launch-head">
        <div class="stats-launch-avatar">${renderMemberAvatar(member)}</div>
        <div class="stats-launch-hero">
          <div class="stats-launch-name">${escapeHtml(String(member.name || 'Kid'))}</div>
          <div class="stats-launch-sub">${stats.currentLevel.icon || ''}<span>${escapeHtml(String(stats.currentLevel.name || 'Level 1'))}</span></div>
        </div>
      </div>
      <div class="stats-launch-spotlight">
        <div class="stats-launch-spotlight-value">${stats.diamondsEarned}</div>
        <div class="stats-launch-spotlight-label">Lifetime gems earned</div>
      </div>
      <div class="stats-launch-spotlight">
        <div class="stats-launch-spotlight-value">$${stats.savings.toFixed(2)}</div>
        <div class="stats-launch-spotlight-label">Current savings</div>
      </div>
      <div class="stats-launch-gridline stats-launch-gridline-2x2">
        <span class="stats-launch-chip"><strong>${stats.choreDone}</strong><small>Tasks</small></span>
        <span class="stats-launch-chip"><strong>${stats.streak}</strong><small>Streak</small></span>
        <span class="stats-launch-chip"><strong>${stats.rewardCount}</strong><small>Prizes</small></span>
        <span class="stats-launch-chip"><strong>${stats.totalXP}</strong><small>Total XP</small></span>
      </div>
    </button>
  `;
}

function renderFamilyStatsCard(kids: DemoMember[], state: DemoAppState): string {
  const totalEarned = kids.reduce((sum, kid) => sum + Number(kid.totalEarned || 0), 0);
  const totalSavings = kids.reduce((sum, kid) => sum + Number(kid.savings || 0), 0);
  const totalTasks = state.historyRows.filter(row => row.type === 'chore').length;
  const totalPrizes = state.historyRows.filter(row => row.type === 'prize').length;
  const totalBadges = state.historyRows.filter(row => row.type === 'badge').length;
  const streakingKids = kids.filter(kid => Number((kid as DemoMember & { streak?: { current?: number } }).streak?.current || 0) > 0).length;
  return `
    <div class="stats-panel-card stats-panel-family-card">
      <div class="stats-panel-section">
        <div class="stats-panel-section-title">Family Overview</div>
        <div class="stats-panel-grid">
          ${renderStatTile('<i class="ph-duotone ph-sketch-logo" style="color:#D97706"></i>', 'Gems Earned', String(totalEarned), '#92400e', 'all time, all kids')}
          ${renderStatTile('<i class="ph-duotone ph-piggy-bank" style="color:#16A34A"></i>', 'Savings', `$${totalSavings.toFixed(2)}`, '#166534', 'current balance')}
          ${renderStatTile('<i class="ph-duotone ph-check-circle" style="color:#16A34A"></i>', 'Tasks Done', String(totalTasks), '#166534', 'all time')}
          ${renderStatTile('<i class="ph-duotone ph-gift" style="color:#2563EB"></i>', 'Prizes', String(totalPrizes), '#1e40af', 'redeemed')}
          ${renderStatTile('<i class="ph-duotone ph-seal-check" style="color:#7C3AED"></i>', 'Badges', String(totalBadges), '#4c1d95', 'earned')}
          ${renderStatTile('<i class="ph-duotone ph-fire" style="color:#F97316"></i>', 'Active Streaks', String(streakingKids), '#b45309', 'kids on a streak')}
        </div>
      </div>
    </div>
    <div class="stats-panel-card">
      <div class="stats-panel-section">
        <div class="stats-panel-section-title">Family Totals</div>
        <table class="stats-panel-table">
          <tr><td>Kids tracked</td><td>${kids.length}</td></tr>
          <tr><td>Prize redemptions</td><td>${totalPrizes}</td></tr>
          <tr><td>Tasks completed</td><td>${totalTasks}</td></tr>
          <tr><td>Badges earned</td><td>${totalBadges}</td></tr>
        </table>
      </div>
    </div>
  `;
}

function renderMemberStatsCard(member: DemoMember, state: DemoAppState): string {
  const stats = buildMemberStats(member, state);
  const levelLabel = stats.currentLevel.level ? `Level ${stats.currentLevel.level}` : 'Current level';
  return `
    <div class="stats-panel-card">
      <div class="stats-panel-section">
        <div class="stats-panel-section-title">Routine & Gems</div>
        <div class="stats-panel-grid">
          ${renderStatTile('<i class="ph-duotone ph-sketch-logo" style="color:#D97706"></i>', 'Gems Earned', String(stats.diamondsEarned), '#92400e')}
          ${renderStatTile('<i class="ph-duotone ph-piggy-bank" style="color:#16A34A"></i>', 'Savings', `$${stats.savings.toFixed(2)}`, '#166534')}
          ${renderStatTile('<i class="ph-duotone ph-check-circle" style="color:#16A34A"></i>', 'Tasks Done', String(stats.choreDone), '#166534')}
          ${renderStatTile('<i class="ph-duotone ph-seal-check" style="color:#7C3AED"></i>', 'Badges', String(stats.badgeCount), '#4c1d95')}
          ${renderStatTile('<i class="ph-duotone ph-gift" style="color:#2563EB"></i>', 'Prizes', String(stats.rewardCount), '#1e40af')}
          ${renderStatTile('<i class="ph-duotone ph-sparkle" style="color:#7C3AED"></i>', 'Total XP', String(stats.totalXP), '#4c1d95')}
        </div>
      </div>
    </div>
    <div class="stats-panel-card">
      <div class="stats-panel-section">
        <div class="stats-panel-section-title">Progress</div>
        <div class="stats-panel-grid">
          ${renderStatTile(stats.currentLevel.icon || '<i class="ph-duotone ph-trophy" style="color:#D97706"></i>', levelLabel, escapeHtml(String(stats.currentLevel.name || 'Level 1')), '#4c1d95')}
          ${renderStatTile('<i class="ph-duotone ph-fire" style="color:#F97316"></i>', 'Current Streak', String(stats.streak), '#b45309', 'days')}
          ${renderStatTile('<i class="ph-duotone ph-gift" style="color:#2563EB"></i>', 'Prize Count', String(stats.rewardCount), '#1e40af', 'redeemed')}
        </div>
      </div>
    </div>
  `;
}

function buildMemberStats(member: DemoMember, state: DemoAppState): MemberStats {
  const history = state.historyRows.filter(row => row.memberId === member.id);
  const levels = getLevels(state.settings || {});
  const totalXP = Number(member.totalEarned || 0);
  let currentLevel = levels[0] || { name: 'Level 1', icon: '' };
  for (const level of levels) {
    if (totalXP >= Number(level.minXp || 0)) currentLevel = level;
  }
  return {
    diamondsEarned: Number(member.totalEarned || 0),
    savings: Number(member.savings || 0),
    choreDone: history.filter(row => row.type === 'chore').length,
    rewardCount: history.filter(row => row.type === 'prize').length,
    badgeCount: history.filter(row => row.type === 'badge').length,
    totalXP,
    streak: Number((member as DemoMember & { streak?: { current?: number } }).streak?.current || 0),
    currentLevel,
  };
}

function renderMemberAvatar(member: DemoMember): string {
  const avatar = String(member.avatar || member.icon || 'smiley');
  const iconName = avatar.replace(/^ph-/, '');
  return `<i class="ph-duotone ph-${escapeHtml(iconName)}" style="color:${escapeHtml(String(member.color || '#6C63FF'))}"></i>`;
}

function renderStatTile(icon: string, label: string, value: string, color: string, sub = ''): string {
  return `
    <div class="stats-panel-tile">
      <div class="stats-panel-tile-icon">${icon}</div>
      <div class="stats-panel-tile-value" style="color:${escapeHtml(color)}">${value}</div>
      <div class="stats-panel-tile-label">${escapeHtml(label)}</div>
      ${sub ? `<div class="stats-panel-tile-sub">${escapeHtml(sub)}</div>` : ''}
    </div>
  `;
}
