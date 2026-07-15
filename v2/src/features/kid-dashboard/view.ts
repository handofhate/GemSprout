import { type DemoAppState, type DemoCompletion, type DemoMember, type DemoPrize, type DemoTask, type DemoTeamGoal } from '../../app/local-demo-state';
import { getBaseBadgeDef } from '../parent-levels/view';
import { escapeHtml } from '../../ui/html';
import { dayIndexForDateKey, todayKeyForTimezone } from '../../app/date-keys';

export type KidTabId = 'chores' | 'diamonds' | 'shop' | 'team' | 'stats';

export type KidPrizeRedeemStatus = {
  ok: boolean;
  reason: string;
  message: string;
  schedule?: { ok: boolean; reason: string; periodKey: string; message: string };
  requirement?: { ok: boolean; reason: string; message: string };
  canAfford: boolean;
  gemsNeeded: number;
};

export function isLittleKidMode(member: DemoMember | null | undefined): boolean {
  if (!member) return false;
  if (member.displayMode) return member.displayMode === 'tiny' || member.displayMode === 'little';
  return member.mode === 'tiny' || member.mode === 'little';
}

function speakAttr(text: string): string {
  return ` data-speak="${escapeHtml(text)}"`;
}

export function renderKidScreen(state: DemoAppState, member: DemoMember, activeTab: KidTabId): string {
  const littleKid = isLittleKidMode(member);
  const headerClass = littleKid ? ' little-kid-header tiny-kid-header' : '';
  const contentClass = littleKid ? ' little-kid-mode tiny-mode' : '';
  const navClass = littleKid ? ' little-kid-nav tiny-kid-nav' : '';
  return `
    <header class="app-header${headerClass}" id="kid-header">${renderKidHeader(state, member)}</header>
    <main class="main-content${contentClass}" id="kid-content">${renderKidTab(state, member, activeTab)}</main>
    <nav class="nav-bar${navClass}" id="kid-nav">${renderKidNav(member, activeTab)}</nav>
  `;
}

function renderKidHeader(state: DemoAppState, member: DemoMember): string {
  const gems = Number(member.gems || member.diamonds || 0);
  const accent = String(member.color || '#6C63FF');
  const themeVars = `--kid-accent:${accent};--kid-accent-soft:${accent}1A;--kid-accent-softer:${accent}0E;--kid-accent-border:${accent}40`;
  const littleKid = isLittleKidMode(member);
  const summary = summarizeChores(state, member, assignedTasks(state, member));
  const headerSpeech = summary.totalUnits > 0
    ? `Hi ${String(member.name || 'Kid')}. You have ${gems} gems, and ${summary.doneUnits} out of ${summary.totalUnits} tasks complete today.`
    : `Hi ${String(member.name || 'Kid')}. You have ${gems} gems and no tasks in today's rhythm yet.`;
  return `
    <div class="header-left kid-themed-header-left" style="${themeVars}"${littleKid ? speakAttr(headerSpeech) : ''}>
      <span class="header-avatar" data-kid-header-avatar style="cursor:pointer">${renderMemberAvatar(member, true)}</span>
      <div>
        <div class="header-name">Hi, ${escapeHtml(String(member.name || 'Kid'))}!</div>
      </div>
    </div>
    <div class="header-actions">
      <div class="header-badge kid-themed-header-badge" style="${themeVars}"${littleKid ? speakAttr(`You have ${gems} gems.`) : ''}><i class="ph-duotone ph-sketch-logo" style="color:${accent};font-size:0.95rem;vertical-align:middle"></i> ${gems}</div>
      <button class="btn-icon-sm kid-themed-settings-btn" style="${themeVars}" data-kid-settings type="button" title="Settings"${littleKid ? speakAttr('Settings.') : ''}><i class="ph-duotone ph-gear-six" style="color:${accent};font-size:1.15rem"></i></button>
    </div>
  `;
}

function renderKidNav(member: DemoMember, activeTab: KidTabId): string {
  const accent = String(member.color || '#6C63FF');
  const littleKid = isLittleKidMode(member);
  const themeVars = `--kid-accent:${accent};--kid-accent-soft:${accent}1A;--kid-accent-softer:${accent}0E;--kid-accent-border:${accent}40`;
  const tabs: Array<{ id: KidTabId; icon: string; label: string }> = [
    { id: 'chores', icon: navIcon('chores'), label: 'Tasks' },
    { id: 'diamonds', icon: navIcon('diamond'), label: 'Gems' },
    { id: 'shop', icon: navIcon('shop'), label: 'Shop' },
    { id: 'team', icon: navIcon('team'), label: 'Team' },
    { id: 'stats', icon: navIcon('stats'), label: 'Stats' },
  ];
  return tabs.map(tab => `
    <button class="nav-item kid-themed-nav-item${activeTab === tab.id ? ' active' : ''}" style="${themeVars}" data-kid-tab="${tab.id}" type="button"${littleKid ? speakAttr(kidTabSpeech(tab.id)) : ''}>
      <span class="nav-icon">${tab.icon}</span>${tab.label}
    </button>
  `).join('');
}

function kidTabSpeech(tab: KidTabId): string {
  if (tab === 'chores') return "Let's look at your rhythm.";
  if (tab === 'diamonds') return 'Gems.';
  if (tab === 'shop') return 'Shop.';
  if (tab === 'team') return 'Team prizes.';
  return 'Stats.';
}

function renderKidTab(state: DemoAppState, member: DemoMember, activeTab: KidTabId): string {
  switch (activeTab) {
    case 'chores':
      return renderKidChores(state, member);
    case 'diamonds':
      return renderKidGems(state, member);
    case 'shop':
      return renderKidShop(state, member);
    case 'team':
      return renderKidTeam(state, member);
    case 'stats':
      return renderKidStats(state, member);
  }
}

function renderKidChores(state: DemoAppState, member: DemoMember): string {
  const chores = assignedTasks(state, member);
  const littleKid = isLittleKidMode(member);
  const hideUnavailable = state.settings.hideUnavailable === true;
  if (!chores.length) {
    return `
      <div class="empty-state">
        <div class="empty-icon"><i class="ph-duotone ph-confetti" style="color:#F97316;font-size:3rem"></i></div>
        <div class="empty-text">No tasks assigned yet. Ask a parent to add some.</div>
      </div>
    `;
  }

  const summary = summarizeChores(state, member, chores);
  const todoVisible = hideUnavailable ? summary.todo.filter(item => item.canSubmit || item.hasAvailableSlot) : summary.todo;
  const progressHeading = summary.percent === 100
    ? 'Everything for today is wrapped up.'
    : todoVisible.length > 0
      ? `${todoVisible.length} task${todoVisible.length === 1 ? '' : 's'} ready right now.`
      : summary.pending.length > 0
        ? 'You are waiting on a parent check-in.'
        : 'Your day is in motion.';
  const progressSupport = summary.percent === 100
    ? 'Take a breath, check your gems, and enjoy the momentum.'
    : summary.pending.length > 0
      ? `${summary.pending.length} item${summary.pending.length === 1 ? '' : 's'} already sent for review.`
      : 'Keep going. Every task you finish adds more gems.';

  return `
    <section class="kid-chores-hero${summary.percent === 100 ? ' is-complete' : ''}"${littleKid ? speakAttr(`Today you've done ${summary.doneUnits} out of ${summary.totalUnits} tasks in your rhythm.`) : ''}>
      <div class="kid-chores-hero-copy">
        <div class="kid-chores-head">
          <div>
            <div class="kid-chores-eyebrow">Today</div>
            <div class="kid-chores-title-row">
              <h2 class="kid-chores-title">Your rhythm</h2>
            </div>
          </div>
          <div class="kid-chores-title-utility">
            <div class="kid-chores-avatar">${summary.percent === 100 ? '<i class="ph-duotone ph-seal-check" style="color:#e8c76a"></i>' : renderMemberAvatar(member, true)}</div>
          </div>
        </div>
        <div class="kid-chores-progress-line">
          <span class="kid-chores-progress-value">${summary.doneUnits} / ${summary.totalUnits}</span>
          <span class="kid-chores-progress-label">tasks complete</span>
        </div>
        <p class="kid-chores-lead">${escapeHtml(progressHeading)}</p>
        <p class="kid-chores-support">${escapeHtml(progressSupport)}</p>
        <div class="kid-chores-progress-shell" aria-label="${summary.percent}% complete">
          <div class="kid-chores-progress-fill" style="width:${summary.percent}%"></div>
        </div>
      </div>
      <div class="kid-chores-summary-grid">
        <div class="kid-chores-summary-card"${littleKid ? speakAttr(`${todoVisible.length} ready`) : ''}><span class="kid-chores-summary-label">Ready</span><strong class="kid-chores-summary-value">${todoVisible.length}</strong></div>
        <div class="kid-chores-summary-card"${littleKid ? speakAttr(`${summary.pending.length} waiting`) : ''}><span class="kid-chores-summary-label">Waiting</span><strong class="kid-chores-summary-value">${summary.pending.length}</strong></div>
        <div class="kid-chores-summary-card"${littleKid ? speakAttr(`${summary.done.length} complete`) : ''}><span class="kid-chores-summary-label">Complete</span><strong class="kid-chores-summary-value">${summary.done.length}</strong></div>
        <div class="kid-chores-summary-card"${littleKid ? speakAttr(`${summary.earnedGems} gems`) : ''}><span class="kid-chores-summary-label">Today's Gems</span><strong class="kid-chores-summary-value">${summary.earnedGems}</strong></div>
      </div>
    </section>

    ${renderDailyCombo(state, member, summary.models, littleKid)}
    ${renderStage('Open Now', 'ph-sun-horizon', '#1D6B57', todoVisible, 'Start here first', 'primary', littleKid)}
    ${renderStage('In Motion', 'ph-path', '#c96f3b', summary.partial, 'Already started', 'progress', littleKid)}
    ${renderStage('Pending', 'ph-hourglass', '#6f8f99', summary.pending, 'Waiting for parent approval', 'progress', littleKid)}
    ${renderStage('Complete', 'ph-check-circle', '#5f8f63', summary.done, 'Done for today', 'progress', littleKid)}
    ${hideUnavailable ? '' : renderStage('Later Windows', 'ph-moon-stars', '#6b6d63', summary.unavailable, 'These unlock later in the day', 'default', littleKid)}
    <div class="tab-end-cap" aria-hidden="true"></div>
  `;
}

function renderKidGems(state: DemoAppState, member: DemoMember): string {
  const gems = Number(member.gems || member.diamonds || 0);
  const savings = Number(member.savings || 0);
  const accent = String(member.color || '#6C63FF');
  const currency = String(state.settings.currency || '$');
  const savingsEnabled = state.settings.savingsEnabled !== false;
  const littleKid = isLittleKidMode(member);
  const themeVars = `--kid-accent:${accent};--kid-accent-soft:${accent}1A;--kid-accent-softer:${accent}0E;--kid-accent-border:${accent}40`;
  const kidHistory = state.historyRows.filter(row => row.memberId === member.id);
  const recentHistory = kidHistory.slice(0, 5);
  const summaryCards = [
    state.settings.levelingEnabled !== false ? renderKidLevelCard(state, member, littleKid) : '',
    state.settings.streakEnabled !== false ? renderKidStreakCard(member, littleKid) : '',
    !littleKid && state.settings.notListeningEnabled !== false ? renderKidNotListeningCard(state, member) : '',
  ].filter(Boolean);
  const savingsSpeech = `You have ${formatCurrency(savings, currency)} in savings.`;

  return `
    <div class="stats-grid kid-gems-top-stats kid-gems-top-stats-${savingsEnabled ? 2 : 1}">
      <div class="stat-card kid-gems-top-card kid-themed-stat-card" style="${themeVars}"${littleKid ? speakAttr(`You have ${gems} gems.`) : ''}>
        <div class="stat-val" style="color:${accent}">${gems}</div>
        <div class="stat-label"><i class="ph-duotone ph-sketch-logo" style="color:${accent};font-size:0.95rem;vertical-align:middle"></i> Gems</div>
      </div>
      ${savingsEnabled ? `<div class="stat-card kid-gems-top-card kid-themed-stat-card" style="${themeVars}"${littleKid ? speakAttr(savingsSpeech) : ''}>
        <div class="stat-val" style="color:${accent}">${formatCurrency(savings, currency)}</div>
        <div class="stat-label"><i class="ph-duotone ph-piggy-bank" style="color:#16A34A;font-size:0.95rem;vertical-align:middle"></i> Savings</div>
      </div>` : ''}
    </div>

    ${summaryCards.length ? `<div class="kid-gems-summary-grid kid-gems-summary-grid-${summaryCards.length}">${summaryCards.join('')}</div>` : ''}
    ${renderKidBadges(state, member, littleKid)}
    ${savingsEnabled ? renderKidSavingsCard(state, member, littleKid) : ''}
    ${renderKidRecentActivity(recentHistory, kidHistory.length, littleKid)}
    <div class="tab-end-cap" aria-hidden="true"></div>
  `;
}

function renderKidLevelCard(state: DemoAppState, member: DemoMember, littleKid = false): string {
  const progress = getKidLevelProgress(state, member);
  const speech = progress.next
    ? `You are currently level ${Number(progress.current.level || 1)}, and need ${Math.max(0, progress.xpNeeded - progress.xpIntoLevel)} more X P to level up.`
    : 'You are at the max level! Amazing!';
  return `
    <div class="card kid-gems-summary-card kid-gems-level-card"${littleKid ? speakAttr(speech) : ''}>
      <div class="kid-gems-summary-label">Level ${Number(progress.current.level || 1)}</div>
      <div class="kid-gems-summary-well kid-gems-level-well">
        <div class="kid-gems-summary-well-value kid-gems-level-icon">${progress.current.icon || '<i class="ph-duotone ph-leaf" style="color:#22C55E"></i>'}</div>
        <div class="kid-gems-summary-well-label">${escapeHtml(String(progress.current.name || 'Sprout'))}</div>
      </div>
      ${progress.next
        ? `<div class="level-xp-bar kid-gems-level-bar"><div class="level-xp-fill" style="width:${progress.pct}%"></div></div>
           <div class="kid-gems-summary-sub">${progress.xpIntoLevel}/${progress.xpNeeded} XP</div>`
        : `<div class="level-xp-bar kid-gems-level-bar"><div class="level-xp-fill" style="width:100%"></div></div>
           <div class="kid-gems-summary-sub">Max level reached</div>`}
    </div>
  `;
}

function renderKidStreakCard(member: DemoMember, littleKid = false): string {
  const streak = Number(member.streak?.current || member.comboStreak?.current || 0);
  const best = Number(member.streak?.best || member.comboStreak?.best || 0);
  const speech = streak > 0 && streak >= best
    ? `You currently have a ${streak} day streak, and this is your best streak so far!`
    : `You currently have a ${streak} day streak, and your best streak is ${best} days.`;
  return `
    <div class="card kid-gems-summary-card kid-gems-streak-card"${littleKid ? speakAttr(speech) : ''}>
      <div class="kid-gems-summary-label">Current Streak</div>
      <div class="kid-gems-summary-well kid-gems-streak-well">
        <div class="kid-gems-summary-well-value kid-gems-streak-value"><i class="ph-duotone ph-fire" style="color:#F97316"></i></div>
        <div class="kid-gems-summary-well-label">${streak} day${streak === 1 ? '' : 's'}</div>
      </div>
      <div class="kid-gems-summary-sub">Best - ${best} day${best === 1 ? '' : 's'}</div>
    </div>
  `;
}

function renderKidNotListeningCard(state: DemoAppState, member: DemoMember): string {
  const notListeningSecondsPerGem = Math.max(1, Number(state.settings.notListeningSecs || 60));
  const pendingSeconds = Number(member.nlPendingSecs || 0);
  const todaySeconds = member.nlDate === todayKey(state) ? Number(member.nlTodaySecs || 0) : 0;
  const progress = Math.min(100, Math.round((pendingSeconds / notListeningSecondsPerGem) * 100));
  const minutes = Math.floor(todaySeconds / 60);
  return `
    <div class="card kid-gems-summary-card kid-gems-nl-card">
      <div class="kid-gems-summary-label kid-gems-nl-label"><i class="ph-duotone ph-speaker-slash" style="color:#D95B4B;font-size:0.9rem;vertical-align:middle"></i> Not Listening</div>
      <div class="nl-ring-wrap">
        <div class="nl-ring" style="--nl-progress:${progress}%">
          <div class="nl-ring-center">
            <strong>${minutes}</strong>
            <span>${minutes === 1 ? 'minute' : 'minutes'}</span>
          </div>
        </div>
      </div>
      <div class="kid-gems-summary-sub kid-gems-nl-sub">${todaySeconds > 0 ? `${formatDuration(todaySeconds)} today` : 'None today'}</div>
    </div>
  `;
}

function renderKidBadges(state: DemoAppState, member: DemoMember, littleKid = false): string {
  if (state.settings.baseBadgesEnabled === false && state.settings.choreBadgesEnabled === false) return '';
  const earned = Array.isArray(member.badges) ? member.badges : [];
  const baseBadges = state.settings.baseBadgesEnabled === false
    ? ''
    : BASE_BADGE_IDS.map(id => {
      const badge = getBaseBadgeDef(state.settings, id);
      const hasBadge = earned.includes(id);
      return `<div class="badge-chip ${hasBadge ? 'earned' : 'badge-chip-locked'}"${littleKid ? speakAttr(hasBadge ? badge.name : `${badge.name} - not earned yet.`) : ''}${hasBadge ? ` data-kid-badge-card data-badge-id="${escapeHtml(id)}" data-badge-type="base" data-badge-member="${escapeHtml(String(member.id || ''))}"` : ''}>
        <span class="badge-chip-icon">${badge.icon}</span>${escapeHtml(badge.name)}
      </div>`;
    }).join('');
  const choreBadges = state.settings.choreBadgesEnabled === false
    ? ''
    : state.tasks.flatMap(task => (task.badges || []).map(badge => {
      const key = `cb_${badge.id}`;
      const hasBadge = earned.includes(key);
      if (!hasBadge && badge.secret) return '';
      return `<div class="badge-chip ${hasBadge ? 'earned' : 'badge-chip-locked'}"${littleKid ? speakAttr(hasBadge ? String(badge.name || 'Badge') : `${String(badge.name || 'Badge')} - not earned yet.`) : ''}${hasBadge ? ` data-kid-badge-card data-badge-id="${escapeHtml(String(badge.id || ''))}" data-badge-type="chore" data-badge-member="${escapeHtml(String(member.id || ''))}" data-badge-chore-title="${escapeHtml(String(task.title || ''))}" data-badge-chore-count="${Number(badge.count || 0)}"` : ''}>
        <span class="badge-chip-icon">${badge.icon || '<i class="ph-duotone ph-medal" style="color:#F59E0B"></i>'}</span>${escapeHtml(String(badge.name || ''))}
      </div>`;
    })).join('');
  return `
    <div class="section-row kid-gems-section-row">
      <div class="section-title"${littleKid ? speakAttr('Badges. Tap a badge to hear its name.') : ''}><i class="ph-duotone ph-medal" style="color:#7C3AED;font-size:1rem;vertical-align:middle"></i> Badges</div>
    </div>
    <div class="card kid-gems-section-card">
      <div class="badge-grid">${baseBadges}${choreBadges}</div>
    </div>
  `;
}

function renderKidSavingsCard(state: DemoAppState, member: DemoMember, littleKid = false): string {
  const savings = Number(member.savings || 0);
  const currency = String(state.settings.currency || '$');
  const gifted = Number(member.savingsGifted || 0);
  const matched = Number(member.savingsMatched || 0);
  const interest = Number(member.savingsInterest || 0);
  const selfSaved = Math.max(0, savings - gifted - matched - interest);
  const matchOn = state.settings.savingsMatchingEnabled === true;
  const interestOn = state.settings.savingsInterestEnabled === true;
  const matchPct = Number(state.settings.savingsMatchPercent || 50);
  const interestRate = Number(state.settings.savingsInterestRate || 5);
  const interestPeriod = String(state.settings.savingsInterestPeriod || 'monthly');
  const interestMode = String(state.settings.savingsInterestMode || 'kid_claim');
  const todayKey = todayKeyForTimezone(state.settings.familyTimezone);
  const claimableInterest = calculateSavingsInterestForView(state, member, todayKey);
  const interestTip = interestPeriod === 'weekly'
    ? `claimable every ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(state.settings.savingsInterestDay ?? 1)] || 'Monday'}`
    : `claimable on the ${ordinal(Number(state.settings.savingsInterestDayOfMonth || 1))} of each month`;
  const statCards = [
    selfSaved > 0 ? `<div class="snapshot-stat-card"><strong>${formatCurrency(selfSaved, currency)}</strong><small>Yours</small></div>` : '',
    gifted > 0 ? `<div class="snapshot-stat-card"><strong>${formatCurrency(gifted, currency)}</strong><small>Gifted</small></div>` : '',
    matched > 0 ? `<div class="snapshot-stat-card"><strong>${formatCurrency(matched, currency)}</strong><small>Matched</small></div>` : '',
    interest > 0 ? `<div class="snapshot-stat-card"><strong>${formatCurrency(interest, currency)}</strong><small>Interest</small></div>` : '',
  ].filter(Boolean);
  const pendingSpend = state.requests.some(request =>
    request.status === 'pending'
    && request.kind === 'savings_spend'
    && request.targetMemberId === member.id
  );
  const savingsSpeech = `You have ${formatCurrency(savings, currency)} in savings.${matched > 0 ? ` Your grown-up matched ${formatCurrency(matched, currency)}.` : ''}${interest > 0 ? ` You have earned ${formatCurrency(interest, currency)} in interest.` : ''}`;
  return `
    <div class="section-row kid-gems-section-row">
      <div class="section-title"><i class="ph-duotone ph-piggy-bank" style="color:#16A34A;font-size:1rem;vertical-align:middle"></i> My Savings Jar</div>
    </div>
    <div class="card savings-card kid-gems-section-card"${littleKid ? speakAttr(savingsSpeech) : ''}>
      <div class="savings-card-top">
        <div>
          <div class="savings-card-eyebrow">Saved So Far</div>
          <div class="savings-amount">${formatCurrency(savings, currency)}</div>
          <div class="savings-label">Great work!</div>
        </div>
        <div class="savings-card-hero"><i class="ph-duotone ph-piggy-bank"></i></div>
      </div>
      ${statCards.length >= 2 ? `<div class="snapshot-stats-grid savings-stats-grid savings-stats-grid-${statCards.length}">${statCards.join('')}</div>` : ''}
      ${(matchOn || interestOn)
        ? `<div class="savings-card-notes">
             ${matchOn ? `<div class="savings-card-note"><i class="ph-duotone ph-hand-heart"></i> ${matchPct}% parent match active</div>` : ''}
             ${interestOn ? `<div class="savings-card-note"><i class="ph-duotone ph-trend-up"></i> ${interestRate}% interest ${interestTip}</div>` : ''}
           </div>`
        : ''}
      <div class="savings-card-actions">
        <button class="btn btn-sm savings-card-btn savings-card-btn-primary" data-kid-savings-add="${escapeHtml(String(member.id || ''))}" type="button"${littleKid ? speakAttr('Add savings.') : ''}><i class="ph-duotone ph-plus-circle" style="font-size:0.95rem;vertical-align:middle"></i> Add Savings</button>
        <button class="btn btn-sm savings-card-btn savings-card-btn-neutral" data-kid-savings-history="${escapeHtml(String(member.id || ''))}" type="button"${littleKid ? speakAttr('Savings history.') : ''}><i class="ph-duotone ph-clock-clockwise" style="font-size:0.9rem;vertical-align:middle"></i> History</button>
        ${pendingSpend
          ? `<button class="btn btn-sm savings-card-btn savings-card-btn-pending" type="button"><i class="ph-duotone ph-hourglass" style="font-size:0.9rem;vertical-align:middle"></i> Pending</button>`
          : savings > 0
            ? `<button class="btn btn-sm savings-card-btn savings-card-btn-accent" data-kid-savings-spend="${escapeHtml(String(member.id || ''))}" type="button"${littleKid ? speakAttr('Spend savings.') : ''}><i class="ph-duotone ph-shopping-cart" style="font-size:0.9rem;vertical-align:middle"></i> Spend</button>`
            : ''}
        ${interestOn && interestMode !== 'auto_claim' && claimableInterest > 0
          ? `<button class="btn btn-sm savings-card-btn savings-card-btn-accent" data-kid-savings-claim="${escapeHtml(String(member.id || ''))}" type="button"${littleKid ? speakAttr('Claim interest.') : ''}><i class="ph-duotone ph-trend-up" style="font-size:0.9rem;vertical-align:middle"></i> Claim ${formatCurrency(claimableInterest, currency)}</button>`
          : ''}
      </div>
    </div>
  `;
}

function calculateSavingsInterestForView(state: DemoAppState, member: DemoMember, todayKey: string): number {
  if (state.settings.savingsEnabled === false || state.settings.savingsInterestEnabled !== true) return 0;
  if (!isSavingsInterestDayForView(state, todayKey)) return 0;
  if (member.savingsInterestLastDate === todayKey) return 0;
  const savings = Number(member.savings || 0);
  if (savings <= 0) return 0;
  const interest = Number((savings * Number(state.settings.savingsInterestRate || 5) / 100).toFixed(2));
  return interest > 0 ? interest : 0;
}

function isSavingsInterestDayForView(state: DemoAppState, todayKey: string): boolean {
  const parsed = new Date(`${todayKey}T00:00:00`);
  if (String(state.settings.savingsInterestPeriod || 'monthly') === 'weekly') {
    return parsed.getDay() === Number(state.settings.savingsInterestDay ?? 1);
  }
  return parsed.getDate() === Number(state.settings.savingsInterestDayOfMonth || 1);
}

function renderKidRecentActivity(recentHistory: DemoAppState['historyRows'], totalHistory: number, littleKid = false): string {
  if (!recentHistory.length) {
    return `<div class="empty-state"><div class="empty-icon"><i class="ph-duotone ph-scroll" style="color:#9CA3AF;font-size:3rem"></i></div><div class="empty-text">Complete tasks to earn gems!</div></div>`;
  }
  return `
    <div class="section-row kid-gems-section-row">
      <span class="section-title"${littleKid ? speakAttr("Here's what you've been up to recently.") : ''}><i class="ph-duotone ph-clipboard-text" style="color:#9CA3AF;font-size:1rem;vertical-align:middle"></i> Recent Activity</span>
    </div>
    <div class="card activity-card kid-gems-section-card">
      ${recentHistory.map(row => renderKidActivityRow(row, littleKid)).join('')}
      ${totalHistory > 5 ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid #f3f4f6"><button class="btn btn-secondary btn-sm btn-full" data-kid-full-activity type="button"${littleKid ? speakAttr('All your activity.') : ''}>View All Activity</button></div>` : ''}
    </div>
  `;
}

function renderKidShop(state: DemoAppState, member: DemoMember): string {
  const showLockedRecurringPrizes = state.settings.showLockedRecurringPrizes !== false;
  const littleKid = isLittleKidMode(member);
  const prizes = state.prizes
    .filter(prize => String(prize.type || 'individual') === 'individual')
    .filter(prize => {
      const status = getKidPrizeRedeemStatus(state, prize, member);
      if (status.reason === 'one_time_locked') return false;
      if (showLockedRecurringPrizes) return true;
      return status.reason !== 'window_locked';
    })
    .slice()
    .sort((left, right) => Number(left.cost || 0) - Number(right.cost || 0) || String(left.title || '').localeCompare(String(right.title || '')));

  if (!prizes.length) {
    return `
      <div class="empty-state">
        <div class="empty-icon"><i class="ph-duotone ph-gift" style="color:#FF6584;font-size:3rem"></i></div>
        <div class="empty-text">${showLockedRecurringPrizes ? 'No prizes yet! Ask a parent to add some.' : 'No prizes available right now. Check back later!'}</div>
      </div>
    `;
  }

  return `
    <div class="section-row">
      <span class="section-title"${littleKid ? speakAttr('My prizes. Tap a prize to hear what it costs.') : ''}><i class="ph-duotone ph-gift" style="color:#FF6584;font-size:1rem;vertical-align:middle"></i> My Prizes</span>
    </div>
    <div class="prize-grid kid-shop-prize-grid">
      ${prizes.map(prize => renderKidPrizeCard(state, prize, member, littleKid)).join('')}
    </div>
    <div class="tab-end-cap" aria-hidden="true"></div>
  `;
}

function renderKidPrizeCard(state: DemoAppState, prize: DemoPrize, member: DemoMember, littleKid = false): string {
  const title = String(prize.title || 'Untitled prize');
  const cost = Math.max(0, Number(prize.cost || 0));
  const status = getKidPrizeRedeemStatus(state, prize, member);
  const note = status.ok ? 'Ready!' : formatPrizeRedeemStatusMessage(status);
  const recurrenceSummary = formatPrizeRecurrence(String(prize.recurrence || 'anytime'));
  const requirementSummary = getPrizeRequirementSummary(state, prize);
  const cls = [
    status.ok ? 'can-afford' : '',
    status.reason === 'window_locked' ? 'locked-window' : '',
    status.reason === 'pending_review' ? 'pending-review' : '',
  ].filter(Boolean).join(' ');
  const speech = kidPrizeSpeech(title, cost, status, note);
  return `
    <div class="prize-card kid-shop-prize-card ${cls}" data-kid-prize-card="${escapeHtml(String(prize.id || ''))}" role="button" tabindex="0"${littleKid ? speakAttr(speech) : ''}>
      <div class="kid-shop-prize-top">
        <span class="prize-icon kid-shop-prize-icon">${renderPrizeIcon(prize)}</span>
        <span class="kid-shop-prize-cost">
          <i class="ph-duotone ph-sketch-logo" style="font-size:0.95rem;vertical-align:middle"></i>
          ${cost}
        </span>
      </div>
      <div class="prize-name kid-shop-prize-name">${escapeHtml(title)}</div>
      <div class="kid-shop-prize-note">${escapeHtml(note)}</div>
      <div style="margin-top:4px;font-size:0.74rem;color:var(--muted);text-align:center">${escapeHtml(recurrenceSummary)}${requirementSummary ? ` &middot; ${escapeHtml(requirementSummary)}` : ''}</div>
    </div>
  `;
}

function kidPrizeSpeech(title: string, cost: number, status: KidPrizeRedeemStatus, note: string): string {
  const costClause = cost > 0 ? `Costs ${cost} gems.` : '';
  const condition = status.ok ? 'You can get this now!' : note.replace(/[.!?]+$/, '');
  return `${title}. ${costClause}${condition ? ` ${condition}.` : ''}`;
}

function renderKidTeam(state: DemoAppState, member: DemoMember): string {
  const gems = Number(member.gems ?? member.diamonds ?? 0);
  const littleKid = isLittleKidMode(member);
  const goals = (state.teamGoals || [])
    .slice()
    .sort((left, right) => Number(left.targetPoints || 0) - Number(right.targetPoints || 0) || String(left.title || '').localeCompare(String(right.title || '')));
  const kids = state.members.filter(item => item.role === 'kid' && !item.deleted);

  if (!goals.length) {
    return `
      <div class="empty-state">
        <div class="empty-icon"><i class="ph-duotone ph-trophy" style="color:#D97706;font-size:3rem"></i></div>
        <div class="empty-text">No team prizes yet! Ask a parent to add some.</div>
      </div>
    `;
  }

  return `
    <div class="section-row">
      <span class="section-title"${littleKid ? speakAttr('Team prizes. Tap a card to hear how close your team is.') : ''}><i class="ph-duotone ph-trophy" style="color:#D97706;font-size:1rem;vertical-align:middle"></i> Team Prizes</span>
    </div>
    ${goals.map(goal => renderKidTeamGoalCard(goal, kids, gems, String(member.id || ''), littleKid)).join('')}
    <div class="tab-end-cap" aria-hidden="true"></div>
  `;
}

function renderKidTeamGoalCard(goal: DemoTeamGoal, kids: DemoMember[], gems: number, memberId: string, littleKid = false): string {
  const total = goalTotal(goal);
  const target = Math.max(1, Number(goal.targetPoints || 1));
  const pct = Math.min(100, Math.round((total / target) * 100));
  const reached = pct >= 100;
  const needed = Math.max(0, target - total);
  const speech = reached
    ? `${String(goal.title || 'Team prize')}. Amazing! The team reached this goal!`
    : total > 0
      ? `${String(goal.title || 'Team prize')}. The team needs ${needed} more gems.`
      : `${String(goal.title || 'Team prize')}. The team needs ${target} gems to reach this goal.`;
  const contribs = kids.map(kid => {
    const contribution = Number(goal.contributions?.[String(kid.id || '')] || 0);
    const pctBar = total > 0 ? Math.round((contribution / total) * 100) : 0;
    return `
      <div class="contrib-row kid-team-contrib-row">
        <span class="contrib-avatar kid-team-contrib-avatar">${renderMemberAvatar(kid)}</span>
        <span class="contrib-name kid-team-contrib-name">${escapeHtml(String(kid.name || 'Kid'))}</span>
        <div class="contrib-bar-bg"><div class="contrib-fill" style="width:${pctBar}%"></div></div>
        <span class="contrib-val kid-team-contrib-val">${contribution}</span>
      </div>`;
  }).join('');

  return `
    <div class="goal-card kid-team-goal-card"${littleKid ? speakAttr(speech) : ''}>
      <div class="kid-team-goal-top">
        <div class="kid-team-goal-copy">
          <div class="goal-title kid-team-goal-title">${escapeHtml(String(goal.title || 'Team prize'))}</div>
          <div class="goal-sub kid-team-goal-sub">${reached ? 'Team prize reached' : `${total} / ${target} gems gathered`}</div>
        </div>
        <div class="kid-team-goal-badge">
          <span class="kid-team-goal-glyph">${renderGoalIcon(goal)}</span>
          <span class="kid-team-goal-target">${target}</span>
        </div>
      </div>
      <div class="goal-bar-bg kid-team-goal-bar-bg"><div class="goal-bar-fill kid-team-goal-bar-fill" style="width:${pct}%"></div></div>
      <div class="goal-dmds kid-team-goal-status">${pct}% there${reached ? ' &middot; Goal reached!' : ''}</div>
      ${kids.length > 1 ? `<div class="kid-team-contrib-list">${contribs}</div>` : ''}
      ${!reached
        ? `<div class="kid-team-goal-action">
             ${gems > 0
               ? `<button class="btn btn-primary btn-full kid-team-goal-btn" data-kid-team-contribute="${escapeHtml(memberId)}:${escapeHtml(String(goal.id || ''))}" type="button"${littleKid ? speakAttr('Add gems.') : ''}>Add Gems!</button>`
               : `<div class="kid-team-goal-empty">Complete tasks to earn gems first!</div>`}
           </div>`
        : `<div class="kid-team-goal-complete">Tell a parent to collect the reward! <i class="ph-duotone ph-confetti" style="font-size:1rem;vertical-align:middle"></i></div>`}
    </div>`;
}

function goalTotal(goal: DemoTeamGoal): number {
  return Object.values(goal.contributions || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function renderGoalIcon(goal: DemoTeamGoal): string {
  const icon = String(goal.icon || 'trophy').replace(/^ph-/, '');
  const color = String(goal.iconColor || '#D97706');
  return `<i class="ph-duotone ph-${escapeHtml(icon)}" style="color:${escapeHtml(color)};font-size:2rem"></i>`;
}

function renderKidStats(state: DemoAppState, member: DemoMember): string {
  const littleKid = isLittleKidMode(member);
  return `
    <div>
      <div class="section-row">
        <span class="section-title"${littleKid ? speakAttr('Lifetime stats. Tap any card to hear more.') : ''}><i class="ph-duotone ph-chart-bar" style="color:#6C63FF;font-size:1rem;vertical-align:middle"></i> Lifetime Stats</span>
      </div>
      ${renderKidStatsCard(state, member)}
      <div class="tab-end-cap tab-end-cap-gem">
        <img src="/gemsprout.png" id="egg-gem" data-stats-egg-gem alt="" style="width:36px;height:36px;cursor:pointer">
      </div>
    </div>
  `;
}

function renderKidStatsCard(state: DemoAppState, member: DemoMember): string {
  const stats = buildKidStats(state, member);
  const color = String(member.color || '#6C63FF');
  const littleKid = isLittleKidMode(member);
  const tts = (text: string) => littleKid ? text : '';
  const choresSection = renderStatSection('Routine & Gems',
    renderStatTile('<i class="ph-duotone ph-check-circle" style="color:#16A34A"></i>', 'Tasks Done', stats.choreDone, '#166534', '', tts(`${stats.choreDone} tasks done.`))
    + renderStatTile('<i class="ph-duotone ph-sketch-logo" style="color:#D97706"></i>', 'Gems Earned', stats.gemsEarned, '#92400e', '', tts(`You have earned ${stats.gemsEarned} gems.`))
    + renderStatTile('<i class="ph-duotone ph-sparkle" style="color:#7C3AED"></i>', 'Total XP', stats.totalXP, '#4c1d95', '', tts(`You have ${stats.totalXP} total X P.`))
  );
  const levelTiles = [
    state.settings.levelingEnabled !== false ? renderStatTile('<i class="ph-duotone ph-trophy" style="color:#D97706"></i>', 'Level', `${stats.currentLevel.icon || ''} ${Number(stats.currentLevel.level || 1)}`, color, String(stats.currentLevel.name || 'Level 1'), tts(`You are level ${Number(stats.currentLevel.level || 1)}, ${String(stats.currentLevel.name || 'Level 1')}.`)) : '',
    state.settings.streakEnabled !== false ? renderStatTile('<i class="ph-duotone ph-fire" style="color:#F97316"></i>', 'Best Streak', `${stats.bestStreak}d`, '#b45309', stats.currentStreak > 0 ? `${stats.currentStreak}d now` : '', tts(`Your best streak is ${stats.bestStreak} days.${stats.currentStreak > 0 ? ` You are on a ${stats.currentStreak} day streak right now!` : ''}`)) : '',
    state.settings.streakEnabled !== false ? renderStatTile('<i class="ph-duotone ph-lightning" style="color:#F59E0B"></i>', 'Best Combo Streak', `${stats.bestComboStreak}d`, '#92400E', stats.currentComboStreak > 0 ? `${stats.currentComboStreak}d now` : '', tts(`Your best combo streak is ${stats.bestComboStreak} days.`)) : '',
    renderStatTile('<i class="ph-duotone ph-calendar-check" style="color:#0E7490"></i>', 'Days Active', stats.daysActive, '#0e7490', '', tts(`You have been active for ${stats.daysActive} days.`)),
  ].join('');
  const levelSection = levelTiles.trim() ? renderStatSection('Level & Streaks', levelTiles) : '';
  const rewardSection = renderStatSection('Rewards & Combos',
    renderStatTile('<i class="ph-duotone ph-gift" style="color:#1D4ED8"></i>', 'Prizes Won', stats.rewardCount, '#1e40af', '', tts(`You have won ${stats.rewardCount} prize${stats.rewardCount !== 1 ? 's' : ''}.`))
    + renderStatTile('<i class="ph-duotone ph-lightning" style="color:#F59E0B"></i>', 'Combos Hit', stats.comboCount, '#b45309', `+${stats.comboGems} bonus gems`, tts(`You have hit ${stats.comboCount} combo${stats.comboCount !== 1 ? 's' : ''}.`))
    + renderStatTile('<i class="ph-duotone ph-shopping-cart" style="color:#374151"></i>', 'Gems Spent', stats.gemsSpent, '#374151', 'on prizes', tts(`You have spent ${stats.gemsSpent} gems on prizes.`))
  );
  const currency = String(state.settings.currency || '$');
  const savingsSection = state.settings.savingsEnabled !== false ? renderStatSection('Savings Jar',
    renderStatTile('<i class="ph-duotone ph-piggy-bank" style="color:#16A34A"></i>', 'Balance', `${currency}${stats.savings.toFixed(2)}`, '#166534', 'current', tts(`You have ${currency}${stats.savings.toFixed(2)} in savings.`))
    + renderStatTile('<i class="ph-duotone ph-arrow-circle-down" style="color:#2563EB"></i>', 'Total Deposited', `${currency}${stats.totalDeposited.toFixed(2)}`, '#1e40af', 'all time')
    + renderStatTile('<i class="ph-duotone ph-shopping-bag" style="color:#6C63FF"></i>', 'Total Spent', `${currency}${stats.totalWithdrawn.toFixed(2)}`, '#4c1d95', 'from savings')
  ) : '';
  const badgeSection = state.settings.levelingEnabled !== false ? renderStatSection('Achievements',
    renderStatTile('<i class="ph-duotone ph-medal" style="color:#7C3AED"></i>', 'Badges', stats.badgeCount, '#7c3aed', '', tts(`You have ${stats.badgeCount} badge${stats.badgeCount !== 1 ? 's' : ''}.`))
    + renderStatTile('<i class="ph-duotone ph-trend-up" style="color:#0F766E"></i>', 'Level-Ups', stats.levelUps, '#0f766e', '', tts(`You have leveled up ${stats.levelUps} time${stats.levelUps !== 1 ? 's' : ''}.`))
    + renderStatTile('<i class="ph-duotone ph-chart-bar" style="color:#374151"></i>', 'Avg/Day', stats.avgTasksPerDay, '#374151', 'tasks per active day', tts(`You average ${stats.avgTasksPerDay} tasks per day.`))
  ) : '';
  const penaltySection = renderStatSection('Penalties',
    renderStatTile('<i class="ph-duotone ph-speaker-slash" style="color:#991B1B"></i>', 'Penalties', stats.penaltyCount, '#991b1b', '', tts(`You have had ${stats.penaltyCount} penalty${stats.penaltyCount !== 1 ? 's' : ''}.`))
    + renderStatTile('<i class="ph-duotone ph-sketch-logo" style="color:#EF4444"></i>', 'Gems Deducted', stats.penaltyAmount, '#991b1b', '', tts(`You have had ${stats.penaltyAmount} gems deducted.`))
    + renderStatTile('<i class="ph-duotone ph-timer" style="color:#B45309"></i>', 'NL Time', stats.notListeningLabel, '#b45309', 'lifetime', tts(formatNotListeningSpeech(stats.notListeningSecs)))
  );
  const extraSection = renderStatSection('Fun Facts',
    renderStatTile('<i class="ph-duotone ph-calendar-star" style="color:#D97706"></i>', 'Best Day', stats.bestDate ? `${stats.bestDate.gems} gems` : 'None', '#d97706', stats.bestDate ? `${formatDateKey(stats.bestDate.date)} \u00b7 ${stats.bestDate.gems} gems` : 'No data yet', tts(stats.bestDate ? `Your best day was ${stats.bestDate.gems} gems.` : 'No best day yet.'))
    + renderStatTile('<i class="ph-duotone ph-heart" style="color:#DB2777"></i>', 'Fav Task', stats.favTask ? stats.favTask[0].split(' ')[0] : 'None', '#db2777', stats.favTask ? `${stats.favTask[1]}x completed` : 'No tasks yet', tts(stats.favTask ? `Your favorite task is ${stats.favTask[0]}.` : 'No favorite chore yet.'))
    + renderStatTile('<i class="ph-duotone ph-arrow-u-down-left" style="color:#6B7280"></i>', 'Declined', stats.declineCount, '#374151', 'tasks declined', tts(`You have had ${stats.declineCount} declined task${stats.declineCount !== 1 ? 's' : ''}.`))
  );
  return `
    <div class="stats-panel-card" style="--stats-accent:${escapeHtml(color)}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
        <span style="font-size:2.5rem;width:2.5rem;text-align:center;flex-shrink:0">${renderMemberAvatar(member)}</span>
        <div>
          <div class="stats-panel-header-title">${escapeHtml(String(member.name || 'Kid'))}</div>
          <div class="stats-panel-header-sub">${state.settings.levelingEnabled !== false ? `${stats.currentLevel.icon || ''} ${escapeHtml(String(stats.currentLevel.name || 'Level 1'))} &middot; ` : ''}${stats.gemsEarned} total gems earned</div>
        </div>
      </div>
      ${choresSection}
      ${levelSection}
      ${rewardSection}
      ${savingsSection}
      ${badgeSection}
      ${renderKidStatsBadgeGrid(state, member, littleKid)}
      ${penaltySection}
      ${extraSection}
      ${renderStatsBreakdown('Task Breakdown', '<i class="ph-duotone ph-clipboard-text" style="color:#9CA3AF;vertical-align:middle"></i>', stats.taskBreakdown, 'times', littleKid)}
      ${renderPrizeStatsBreakdown(stats.prizeBreakdown, littleKid)}
    </div>
  `;
}

function renderStatTile(icon: string, label: string, value: string | number, color: string, sub = '', ttsText = ''): string {
  return `
    <div class="stats-panel-tile"${ttsText ? speakAttr(ttsText) : ''}>
      <div class="stats-panel-tile-icon">${icon}</div>
      <div class="stats-panel-tile-value" style="color:${escapeHtml(color)}">${value}</div>
      <div class="stats-panel-tile-label">${escapeHtml(label)}</div>
      ${sub ? `<div class="stats-panel-tile-sub">${escapeHtml(sub)}</div>` : ''}
    </div>`;
}

function renderStatSection(title: string, tilesHtml: string): string {
  return `
    <div class="stats-panel-section">
      <div class="stats-panel-section-title">${title}</div>
      <div class="stats-panel-grid">${tilesHtml}</div>
    </div>`;
}

function renderStatsBreakdown(title: string, icon: string, rows: Array<[string, number]>, unit: string, littleKid = false): string {
  return `
    <div class="stats-panel-section">
      <div class="stats-panel-section-title">${icon} ${escapeHtml(title)}</div>
      ${rows.length
        ? `<table class="stats-panel-table">${rows.slice(0, 10).map(([name, count], index) => `
            <tr${littleKid ? speakAttr(statBreakdownSpeech(name, count, unit)) : ''}><td class="${index === 0 ? 'top-row' : ''}">${escapeHtml(name)}</td><td>${count} ${escapeHtml(unit)}</td></tr>
          `).join('')}</table>`
        : '<div class="stats-panel-empty">None yet</div>'}
    </div>`;
}

function statBreakdownSpeech(name: string, count: number, unit: string): string {
  const spokenUnit = count === 1 && unit === 'times' ? 'time' : unit;
  return `${name}. ${count} ${spokenUnit}.`;
}

function renderPrizeStatsBreakdown(rows: Array<[string, { count: number; icon?: string }]>, littleKid = false): string {
  return `
    <div class="stats-panel-section">
      <div class="stats-panel-section-title"><i class="ph-duotone ph-gift" style="color:#FF6584;vertical-align:middle"></i> Prize Breakdown</div>
      ${rows.length
        ? `<table class="stats-panel-table">${rows.slice(0, 10).map(([name, info], index) => `
            <tr${littleKid ? speakAttr(`${name}. Redeemed ${info.count} time${info.count !== 1 ? 's' : ''}.`) : ''}>
              <td class="${index === 0 ? 'top-row' : ''}">${renderInlineIcon(info.icon || 'gift')} ${escapeHtml(name)}</td>
              <td style="padding:5px 4px;text-align:right;font-weight:700;color:#6C63FF">${info.count}x</td>
            </tr>
          `).join('')}</table>`
        : '<div class="stats-panel-empty">No prizes redeemed yet</div>'}
    </div>`;
}

function renderKidStatsBadgeGrid(state: DemoAppState, member: DemoMember, littleKid = false): string {
  if (state.settings.levelingEnabled === false) return '';
  const earned = new Set(member.badges || []);
  const baseBadges = state.settings.baseBadgesEnabled === false ? '' : `
    <div style="margin-bottom:18px">
      <div style="font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;margin-bottom:8px"><i class="ph-duotone ph-seal-check" style="color:#6C63FF;vertical-align:middle"></i> Default Badges</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${BASE_BADGE_IDS.map(id => {
          const badge = getBaseBadgeDef(state.settings, id);
          const have = earned.has(id);
          return `<div class="badge-chip ${have ? 'earned' : 'badge-chip-locked'}" title="${escapeHtml(badge.name)}"${littleKid ? speakAttr(have ? badge.name : `${badge.name} - not earned yet.`) : ''}${have ? ` data-kid-badge-card data-badge-id="${escapeHtml(id)}" data-badge-type="base" data-badge-member="${escapeHtml(String(member.id || ''))}"` : ''}>
            <span class="badge-chip-icon">${badge.icon || '<i class="ph-duotone ph-medal" style="color:#7C3AED"></i>'}</span>${escapeHtml(badge.name || id)}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  const choreBadgeItems = state.settings.choreBadgesEnabled === false
    ? []
    : state.tasks.flatMap(task => (task.badges || []).map(badge => ({ badge, task, have: earned.has(`cb_${badge.id}`) }))).filter(item => item.have || !item.badge.secret);
  const choreBadges = choreBadgeItems.length === 0 ? '' : `
    <div style="margin-bottom:18px">
      <div style="font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#9ca3af;margin-bottom:8px"><i class="ph-duotone ph-medal" style="color:#7C3AED;vertical-align:middle"></i> Task Badges</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${choreBadgeItems.map(({ badge, task, have }) => `<div class="badge-chip ${have ? 'earned' : 'badge-chip-locked'}" title="${escapeHtml(String(task.title || ''))} - ${Number(badge.count || 0)}"${littleKid ? speakAttr(have ? String(badge.name || 'Badge') : `${String(badge.name || 'Badge')} - not earned yet.`) : ''}${have ? ` data-kid-badge-card data-badge-id="${escapeHtml(String(badge.id || ''))}" data-badge-type="chore" data-badge-member="${escapeHtml(String(member.id || ''))}" data-badge-chore-title="${escapeHtml(String(task.title || ''))}" data-badge-chore-count="${Number(badge.count || 0)}"` : ''}>
          <span class="badge-chip-icon">${badge.icon || '<i class="ph-duotone ph-medal" style="color:#F59E0B"></i>'}</span>${escapeHtml(String(badge.name || ''))}
        </div>`).join('')}
      </div>
    </div>`;
  return `${baseBadges}${choreBadges}`;
}

function buildKidStats(state: DemoAppState, member: DemoMember): {
  choreDone: number;
  gemsEarned: number;
  totalXP: number;
  currentLevel: { level?: number; name?: string; icon?: string; minXp?: number };
  bestStreak: number;
  currentStreak: number;
  bestComboStreak: number;
  currentComboStreak: number;
  daysActive: number;
  rewardCount: number;
  comboCount: number;
  comboGems: number;
  gemsSpent: number;
  savings: number;
  totalDeposited: number;
  totalWithdrawn: number;
  badgeCount: number;
  levelUps: number;
  avgTasksPerDay: string;
  penaltyCount: number;
  penaltyAmount: number;
  notListeningLabel: string;
  notListeningSecs: number;
  declineCount: number;
  bestDate: { date: string; gems: number } | null;
  favTask: [string, number] | null;
  taskBreakdown: Array<[string, number]>;
  prizeBreakdown: Array<[string, { count: number; icon?: string }]>;
} {
  const history = state.historyRows.filter(row => row.memberId === member.id);
  const choreRows = history.filter(row => row.type === 'chore' || row.type === 'request.approved');
  const prizeRows = history.filter(row => row.type === 'prize');
  const comboRows = history.filter(row => row.type === 'bonus' || String(row.type || '').includes('combo'));
  const savingsWithdrawRows = history.filter(row => row.type === 'savings_withdraw');
  const savingsDepositRows = history.filter(row => row.type === 'savings' || row.type === 'savings_deposit');
  const penaltyRows = history.filter(row => String(row.type || '').includes('penalty') || Number(row.gems || 0) < 0 && String(row.type || '') !== 'prize' && String(row.type || '') !== 'goal');
  const taskCounts = countBy(choreRows.filter(row => !String(row.title || '').startsWith('Streak bonus (')).map(row => String(row.title || 'Task')));
  const taskBreakdown = Object.entries(taskCounts).sort((left, right) => right[1] - left[1]);
  const prizeCounts: Record<string, { count: number; icon?: string }> = {};
  state.prizes.forEach(prize => {
    const count = (prize.redemptions || []).filter(redemption => redemption.memberId === member.id).length;
    if (count > 0) prizeCounts[String(prize.title || 'Prize')] = { count, icon: prize.icon };
  });
  prizeRows.forEach(row => {
    const title = String(row.title || 'Prize');
    if (!prizeCounts[title]) prizeCounts[title] = { count: 0, icon: 'gift' };
    prizeCounts[title].count += 1;
  });
  const dateGems: Record<string, number> = {};
  choreRows.forEach(row => {
    const key = rowDateKey(row);
    dateGems[key] = (dateGems[key] || 0) + Number(row.gems || 0);
  });
  const bestDateEntry = Object.entries(dateGems).sort((left, right) => right[1] - left[1])[0] || null;
  const activeDays = Object.keys(dateGems).filter(Boolean).length;
  const totalWithdrawn = savingsWithdrawRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const savings = Number(member.savings || 0);
  const totalDeposited = Math.max(savings + totalWithdrawn, savingsDepositRows.reduce((sum, row) => sum + Math.max(0, Number(row.amount || 0)), 0));
  const progress = getKidLevelProgress(state, member);
  const nlLifetimeSecs = Number((member as DemoMember & { nlLifetimeSecs?: number }).nlLifetimeSecs || 0);
  return {
    choreDone: choreRows.length,
    gemsEarned: Number(member.totalEarned || 0),
    totalXP: Number(member.xp ?? member.totalEarned ?? 0),
    currentLevel: progress.current,
    bestStreak: Number(member.streak?.best || 0),
    currentStreak: Number(member.streak?.current || 0),
    bestComboStreak: Number(member.comboStreak?.best || 0),
    currentComboStreak: Number(member.comboStreak?.current || 0),
    daysActive: activeDays,
    rewardCount: prizeRows.length,
    comboCount: comboRows.length,
    comboGems: comboRows.reduce((sum, row) => sum + Math.abs(Number(row.gems || 0)), 0),
    gemsSpent: prizeRows.reduce((sum, row) => sum + Math.abs(Number(row.gems || 0)), 0),
    savings,
    totalDeposited,
    totalWithdrawn,
    badgeCount: (member.badges || []).length,
    levelUps: history.filter(row => String(row.type || '').includes('level')).length,
    avgTasksPerDay: activeDays > 0 ? (choreRows.length / activeDays).toFixed(1).replace(/\.0$/, '') : '0',
    penaltyCount: penaltyRows.length,
    penaltyAmount: penaltyRows.reduce((sum, row) => sum + Math.abs(Number(row.gems || 0)), 0),
    notListeningLabel: formatDuration(nlLifetimeSecs),
    notListeningSecs: nlLifetimeSecs,
    declineCount: history.filter(row => row.type === 'decline' || row.type === 'request_denied').length,
    bestDate: bestDateEntry ? { date: bestDateEntry[0], gems: bestDateEntry[1] } : null,
    favTask: taskBreakdown[0] || null,
    taskBreakdown,
    prizeBreakdown: Object.entries(prizeCounts).sort((left, right) => right[1].count - left[1].count),
  };
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {});
}

function rowDateKey(row: DemoAppState['historyRows'][number]): string {
  const metadataDate = typeof row.metadata?.date === 'string' ? row.metadata.date : '';
  if (metadataDate) return metadataDate;
  return dateKeyFromTimestamp(Number(row.createdAt || 0));
}

function dateKeyFromTimestamp(createdAt: number): string {
  if (!createdAt) return todayKey();
  const date = new Date(createdAt);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateKey(dateKey: string): string {
  const [year, month, day] = String(dateKey || '').split('-');
  if (!year || !month || !day) return String(dateKey || '');
  return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
}

function renderInlineIcon(iconValue: string): string {
  const icon = String(iconValue || 'gift').replace(/^ph-/, '');
  return `<i class="ph-duotone ph-${escapeHtml(icon)}"></i>`;
}

function renderPrizeIcon(prize: DemoPrize): string {
  const icon = String(prize.icon || 'gift').replace(/^ph-/, '');
  const color = String(prize.iconColor || '#FF6584');
  return `<i class="ph-duotone ph-${escapeHtml(icon)}" style="color:${escapeHtml(color)}"></i>`;
}

function formatPrizeRecurrence(recurrence: string): string {
  if (recurrence === 'one_time') return 'Once';
  if (recurrence === 'daily') return 'Once per day';
  if (recurrence === 'weekly') return 'Once per week';
  if (recurrence === 'monthly') return 'Once per month';
  return 'Unlimited';
}

export function getPrizeRequirementSummary(state: DemoAppState | null, prize: DemoPrize): string {
  if (prize.requirementType === 'task_count') {
    const count = Math.max(1, Number(prize.requirementTaskCount || 1) || 1);
    return `Requires ${count} task${count === 1 ? '' : 's'} completed`;
  }
  if (prize.requirementType === 'combo') return 'Requires Daily Combo complete today';
  if (prize.requirementType === 'specific_tasks') {
    const ids = Array.isArray(prize.requirementTaskIds) ? prize.requirementTaskIds.filter(Boolean) : [];
    const names = state
      ? ids.map(id => state.tasks.find(task => String(task.id || '') === String(id))?.title).filter(Boolean)
      : [];
    if (names.length > 0 && names.length <= 2) return `Requires: ${names.join(' + ')}`;
    const count = ids.length;
    return count > 0 ? `Requires ${count} specific task${count === 1 ? '' : 's'} today` : 'Requires specific tasks today';
  }
  return '';
}

export function formatPrizeRedeemStatusMessage(status: KidPrizeRedeemStatus | null | undefined): string {
  if (!status || status.ok) return '';
  if (status.message) return status.message;
  if (status.reason === 'gems') return `${status.gemsNeeded || 0} more gems needed`;
  return 'This prize is not ready yet';
}

export function getKidPrizeRedeemStatus(state: DemoAppState, prize: DemoPrize, member: DemoMember, dateStr = todayKey(state)): KidPrizeRedeemStatus {
  const cost = Math.max(0, Number(prize.cost || 0));
  const balance = Math.max(0, Number(member.gems ?? member.diamonds ?? 0));
  const schedule = getPrizeScheduleStatus(prize, String(member.id || ''), dateStr);
  const requirement = getPrizeRequirementStatus(state, prize, member, dateStr);
  const canAfford = balance >= cost;
  const gemsNeeded = Math.max(0, cost - balance);
  const pendingReview = state.requests.some(request =>
    request.status === 'pending'
    && request.kind === 'prize_redeem'
    && request.targetMemberId === member.id
    && request.source?.prizeId === prize.id
  );
  if (pendingReview) return { ok: false, reason: 'pending_review', message: 'Pending parent review', schedule, requirement, canAfford, gemsNeeded };
  if (!schedule.ok) return { ok: false, reason: schedule.reason, message: schedule.message, schedule, requirement, canAfford, gemsNeeded };
  if (!requirement.ok) return { ok: false, reason: requirement.reason, message: requirement.message, schedule, requirement, canAfford, gemsNeeded };
  if (!canAfford) return { ok: false, reason: 'gems', message: gemsNeeded > 0 ? `${gemsNeeded} more gems needed` : 'Not enough gems', schedule, requirement, canAfford, gemsNeeded };
  return { ok: true, reason: 'ok', message: '', schedule, requirement, canAfford, gemsNeeded };
}

function getPrizeRequirementStatus(state: DemoAppState, prize: DemoPrize, member: DemoMember, dateStr: string): { ok: boolean; reason: string; message: string } {
  const memberId = String(member.id || '');
  const requirementType = String(prize.requirementType || 'none');
  if (requirementType === 'none') return { ok: true, reason: 'none', message: '' };
  const completedIds = new Set(getMemberCompletedTaskIdsOnDate(state, memberId, dateStr));
  if (requirementType === 'task_count') {
    const doneCount = completedIds.size;
    const required = Math.max(1, Number(prize.requirementTaskCount || 1) || 1);
    if (doneCount >= required) return { ok: true, reason: 'task_count', message: '' };
    const remaining = required - doneCount;
    return { ok: false, reason: 'task_count', message: `${remaining} more task${remaining === 1 ? '' : 's'} needed today` };
  }
  if (requirementType === 'combo') {
    if (state.settings.comboEnabled === false) return { ok: false, reason: 'combo_disabled', message: 'Daily Combo is currently off' };
    const combo = getDailyComboTasks(state, member);
    if (combo.length < 3) return { ok: false, reason: 'combo_missing', message: 'Daily Combo not ready yet' };
    const missing = combo.filter(task => !completedIds.has(String(task.id || '')));
    if (!missing.length) return { ok: true, reason: 'combo', message: '' };
    return { ok: false, reason: 'combo', message: 'Finish today\'s Daily Combo first' };
  }
  if (requirementType === 'specific_tasks') {
    const required = (prize.requirementTaskIds || []).filter(id => state.tasks.some(task => String(task.id || '') === String(id)));
    if (!required.length) return { ok: false, reason: 'specific_tasks_missing', message: 'Required tasks are no longer available' };
    const missing = required.filter(id => !completedIds.has(String(id)));
    if (!missing.length) return { ok: true, reason: 'specific_tasks', message: '' };
    const firstName = state.tasks.find(task => String(task.id || '') === String(missing[0]))?.title || 'required tasks';
    return {
      ok: false,
      reason: 'specific_tasks',
      message: missing.length === 1 ? `Finish "${firstName}" today` : `Finish ${missing.length} required tasks today`,
    };
  }
  return { ok: true, reason: 'none', message: '' };
}

function getMemberCompletedTaskIdsOnDate(state: DemoAppState, memberId: string, dateStr: string): string[] {
  const ids = new Set<string>();
  state.completions.forEach(completion => {
    if (completion.memberId !== memberId) return;
    if (completion.status !== 'approved') return;
    if (completion.entryType === 'before') return;
    if (String(completion.date || '') !== dateStr) return;
    if (completion.choreId) ids.add(String(completion.choreId));
  });
  state.historyRows.forEach(row => {
    if (row.memberId !== memberId) return;
    if (!(row.type === 'chore' || row.type === 'request.approved')) return;
    if (!isHistoryFromToday(row, { period: 'day', targetCount: 1, daysOfWeek: [], windows: {}, slots: [] }, dateStr)) return;
    const choreId = row.metadata?.choreId;
    if (choreId) ids.add(String(choreId));
  });
  return [...ids];
}

function getPrizeScheduleStatus(prize: DemoPrize, memberId: string, dateStr: string): { ok: boolean; reason: string; periodKey: string; message: string } {
  const recurrence = normalizePrizeRecurrence(prize.recurrence);
  const redemptions = Array.isArray(prize.redemptions) ? prize.redemptions : [];
  if (recurrence === 'one_time') {
    const redeemed = redemptions.some(redemption => redemption.memberId === memberId);
    if (!redeemed) return { ok: true, reason: 'one_time_open', periodKey: 'one_time', message: '' };
    return { ok: false, reason: 'one_time_locked', periodKey: 'one_time', message: 'This one-time prize has already been redeemed' };
  }
  if (recurrence === 'anytime') return { ok: true, reason: 'anytime', periodKey: 'anytime', message: '' };
  const periodKey = getPrizePeriodKey(recurrence, dateStr);
  const lastRedemption = redemptions.find(redemption => {
    if (redemption.memberId !== memberId) return false;
    const redemptionDate = String(redemption.date || dateStr);
    const key = redemption.periodKey || getPrizePeriodKey(recurrence, redemptionDate);
    return key === periodKey;
  });
  if (!lastRedemption) return { ok: true, reason: 'window_open', periodKey, message: '' };
  return { ok: false, reason: 'window_locked', periodKey, message: getPrizeLockedWindowMessage(recurrence, String(lastRedemption.date || dateStr), dateStr) };
}

export function getPrizePeriodKey(recurrenceValue: unknown, dateStr = todayKey()): string {
  const recurrence = normalizePrizeRecurrence(recurrenceValue);
  if (recurrence === 'one_time') return 'one_time';
  if (recurrence === 'daily') return dateStr;
  if (recurrence === 'weekly') return `w:${startOfWeekKey(dateStr)}`;
  if (recurrence === 'monthly') return `m:${dateStr.slice(0, 7)}`;
  return 'anytime';
}

function normalizePrizeRecurrence(value: unknown): string {
  const recurrence = String(value || 'anytime');
  return ['anytime', 'one_time', 'daily', 'weekly', 'monthly'].includes(recurrence) ? recurrence : 'anytime';
}

function getPrizeLockedWindowMessage(recurrence: string, redemptionDate: string, todayDateKey: string): string {
  if (recurrence === 'daily') return 'This prize will be available again tomorrow';
  if (recurrence === 'weekly') {
    const days = getDaysUntilDate(addDaysToDate(startOfWeekKey(redemptionDate), 7), todayDateKey);
    if (days <= 1) return 'This prize will be available again tomorrow';
    return `This prize will be available again in ${days} days`;
  }
  if (recurrence === 'monthly') {
    const days = getDaysUntilDate(addMonthsToDate(`${redemptionDate.slice(0, 7)}-01`, 1), todayDateKey);
    if (days <= 1) return 'This prize will be available again tomorrow';
    return `This prize will be available again in ${days} days`;
  }
  return 'This prize is not available right now';
}

function addDaysToDate(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addMonthsToDate(dateKey: string, months: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDaysUntilDate(dateKey: string, todayDateKey: string): number {
  const now = new Date(`${todayDateKey}T00:00:00`);
  const target = new Date(`${dateKey}T00:00:00`);
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}

function todayKey(state?: DemoAppState): string {
  return todayKeyForTimezone(state?.settings.familyTimezone);
}

function startOfWeekKey(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
}

function renderKidActivityRow(row: DemoAppState['historyRows'][number], littleKid = false): string {
  const badge = activityBadge(row);
  const delta = Number(row.gems || 0);
  const amount = Number(row.amount || 0);
  const hasMoney = !delta && amount !== 0;
  const dateLabel = formatHistoryDate(Number(row.createdAt || 0));
  const title = String(row.title || 'Activity');
  const speech = activitySpeech(row, title, delta, amount);
  return `
    <div class="activity-row"${littleKid ? speakAttr(speech) : ''}>
      <span class="activity-badge" style="background:${badge.bg};color:${badge.color}">${badge.icon}</span>
      <div class="activity-body">
        <div class="activity-title">${escapeHtml(title)}</div>
        <div class="activity-meta">${escapeHtml(dateLabel)}</div>
      </div>
      <div class="activity-delta-slot">
        ${delta !== 0 ? `<div class="activity-delta ${delta > 0 ? 'positive' : 'negative'}">
          <span class="activity-delta-value">${delta > 0 ? `+${delta}` : delta}</span>
          <span class="activity-delta-unit">gems</span>
        </div>` : hasMoney ? `<div class="activity-delta ${amount > 0 ? 'positive' : 'negative'}">
          <span class="activity-delta-value">${amount > 0 ? '+' : '-'}${formatCurrency(Math.abs(amount), '')}</span>
          <span class="activity-delta-unit">saved</span>
        </div>` : ''}
      </div>
    </div>
  `;
}

function activitySpeech(row: DemoAppState['historyRows'][number], title: string, delta: number, amount: number): string {
  const type = String(row.type || '');
  const absGems = Math.abs(delta);
  const absAmount = Math.abs(amount);
  if (type.includes('badge')) return `You earned the ${title} badge!`;
  if (type.includes('level')) return `${title}.`;
  if (type.includes('prize')) return delta < 0 ? `${title}. You spent ${absGems} gems.` : `${title}.`;
  if (type.includes('savings_withdraw')) return `${title}. Money came out of your savings.`;
  if (type.includes('savings') && absAmount > 0) return `${title}. ${formatCurrency(absAmount, '')} was added to your savings.`;
  if (type.includes('bonus')) return `${title}. You got ${absGems} bonus gems!`;
  if (delta > 0) return `${title}. You earned ${absGems} gems.`;
  if (delta < 0) return `${title}. You lost ${absGems} gems.`;
  return `${title}.`;
}

function renderStage(title: string, icon: string, color: string, items: ChoreCardModel[], sub = '', emphasis: 'default' | 'primary' | 'progress' = 'default', littleKid = false): string {
  if (!items.length) return '';
  return `
    <section class="routine-stage routine-stage-${emphasis} routine-stage-bare">
      <div class="routine-stage-head">
        <div>
          <div class="routine-stage-title"><i class="ph-duotone ${icon}" style="color:${color};font-size:1rem"></i> ${escapeHtml(title)}</div>
          ${sub ? `<div class="routine-stage-sub">${escapeHtml(sub)}</div>` : ''}
        </div>
        <div class="routine-stage-count">${items.length} Task${items.length === 1 ? '' : 's'}</div>
      </div>
      <div class="chore-stack">
        ${items.map(item => renderChoreCard(item, littleKid)).join('')}
      </div>
    </section>
  `;
}

type ChoreStatus = 'todo' | 'partial' | 'pending' | 'done' | 'unavailable';
type ChoreCardModel = {
  id: string;
  title: string;
  icon: string;
  iconColor: string;
  gems: number;
  status: ChoreStatus;
  canSubmit: boolean;
  revealLabel: string;
  revealIcon: string;
  entryType: 'before' | 'after' | null;
  slotId?: string | null;
  hasSlots: boolean;
  hasAvailableSlot: boolean;
  metaLines: string[];
  isCombo: boolean;
};

function renderChoreCard(chore: ChoreCardModel, littleKid = false): string {
  const statusClass = chore.status === 'todo' ? '' : ` ${chore.status}`;
  const comboClass = chore.isCombo && chore.status !== 'done' ? ' combo-chore' : '';
  if (littleKid) return renderLittleKidChoreCard(chore, statusClass, comboClass);
  if (chore.status === 'done' || chore.status === 'pending') {
    return `
      <div class="snapshot-routine-card kid-routine-card kid-routine-card-static${statusClass}${comboClass}">
        ${comboClass ? '<div class="snapshot-routine-combo-label">Combo</div>' : ''}
        <div class="snapshot-routine-top">
          <div class="snapshot-routine-main">
            <div class="snapshot-routine-title-row">
              <div class="kid-routine-copy">
                <div class="snapshot-routine-title">${escapeHtml(chore.title)}</div>
                <div class="kid-routine-body">
                  ${chore.metaLines.map(line => `<div class="chore-meta">${escapeHtml(line)}</div>`).join('')}
                </div>
              </div>
              <div class="snapshot-routine-diamond-badge">
                <span class="snapshot-routine-glyph-main"><i class="ph-duotone ph-${escapeHtml(chore.icon)}" style="color:${escapeHtml(chore.iconColor)}"></i></span>
                <span class="snapshot-routine-glyph-badge">${chore.gems}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  const actionClass = chore.canSubmit ? 'snapshot-reveal-btn-approve' : 'snapshot-reveal-btn-secondary';
  return `
    <div class="snapshot-routine-shell kid-routine-shell" data-swipe-id="kid_task_${escapeHtml(chore.id)}">
      <div class="snapshot-routine-reveal snapshot-routine-reveal-secondary kid-routine-reveal">
        <button
          class="snapshot-reveal-btn ${actionClass} kid-routine-reveal-status"
          type="button"
          ${chore.canSubmit ? `data-kid-task-complete="${escapeHtml(chore.id)}"${chore.slotId ? ` data-kid-task-slot="${escapeHtml(chore.slotId)}"` : ''}${chore.entryType ? ` data-kid-task-entry-type="${chore.entryType}"` : ''}` : ''}
          ${chore.hasSlots && !chore.canSubmit ? `data-kid-task-times="${escapeHtml(chore.id)}"` : ''}
          ${!chore.canSubmit && !chore.hasSlots ? 'disabled' : ''}
        >
          <i class="ph-duotone ${escapeHtml(chore.revealIcon)}"></i>
          <span>${escapeHtml(chore.revealLabel)}</span>
        </button>
      </div>
      <div class="snapshot-routine-card kid-routine-card task-swipe-card${statusClass}${comboClass}">
        ${comboClass ? '<div class="snapshot-routine-combo-label">Combo</div>' : ''}
        <div class="snapshot-routine-top">
          <div class="snapshot-routine-main">
            <div class="snapshot-routine-title-row">
              <div class="kid-routine-copy">
                <div class="snapshot-routine-title">${escapeHtml(chore.title)}</div>
                <div class="kid-routine-body">
                  ${chore.metaLines.map(line => `<div class="chore-meta">${escapeHtml(line)}</div>`).join('')}
                </div>
              </div>
              <div class="snapshot-routine-diamond-badge">
                <span class="snapshot-routine-glyph-main"><i class="ph-duotone ph-${escapeHtml(chore.icon)}" style="color:${escapeHtml(chore.iconColor)}"></i></span>
                <span class="snapshot-routine-glyph-badge">${chore.gems}</span>
              </div>
              <div class="snapshot-routine-utility">
                <button class="snapshot-routine-swipe-hint" type="button" aria-label="Reveal action" data-kid-task-swipe-hint>
                  <i class="ph-duotone ph-caret-double-left"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderLittleKidChoreCard(chore: ChoreCardModel, statusClass: string, comboClass: string): string {
  const action = renderLittleKidTaskAction(chore);
  const speakText = chore.status === 'pending'
    ? `${chore.title}. Waiting for your grown-up to check.`
    : chore.status === 'done'
      ? `${chore.title}. Done! You earned ${chore.gems} gems.`
      : chore.status === 'partial'
        ? `${chore.title}. Already started. Worth ${chore.gems} gems.`
        : chore.status === 'unavailable'
          ? `${chore.title}. Not available right now. Worth ${chore.gems} gems.`
          : `${chore.title}. Worth ${chore.gems} gems.`;
  return `
    <div class="snapshot-routine-card kid-routine-card little-kid-routine-card${statusClass}${comboClass}"${speakAttr(speakText)}>
      ${comboClass ? '<div class="snapshot-routine-combo-label">Combo</div>' : ''}
      <div class="snapshot-routine-top">
        <div class="snapshot-routine-main">
          <div class="snapshot-routine-title-row">
            <div class="snapshot-routine-diamond-badge">
              <span class="snapshot-routine-glyph-main"><i class="ph-duotone ph-${escapeHtml(chore.icon)}" style="color:${escapeHtml(chore.iconColor)}"></i></span>
              <span class="snapshot-routine-glyph-badge">${chore.gems}</span>
            </div>
            <div class="kid-routine-copy">
              <div class="snapshot-routine-title">${escapeHtml(chore.title)}</div>
              <div class="kid-routine-body">
                ${chore.metaLines.map(line => `<div class="chore-meta">${escapeHtml(line)}</div>`).join('')}
              </div>
            </div>
            <div class="snapshot-routine-utility">${action}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderLittleKidTaskAction(chore: ChoreCardModel): string {
  if (chore.canSubmit) {
    return `
      <button
        class="kid-routine-action-orb kid-routine-action-orb-approve"
        type="button"
        data-kid-task-complete="${escapeHtml(chore.id)}"
        ${chore.slotId ? `data-kid-task-slot="${escapeHtml(chore.slotId)}"` : ''}
        ${chore.entryType ? `data-kid-task-entry-type="${chore.entryType}"` : ''}
        ${chore.entryType === 'before' ? speakAttr("Let's take a picture first! Tap on the camera.") : ''}
      >
        <i class="ph-duotone ${escapeHtml(chore.revealIcon)}"></i>
      </button>`;
  }
  if (chore.hasSlots && chore.status !== 'done' && chore.status !== 'pending') {
    return `
      <button class="kid-routine-action-orb kid-routine-action-orb-secondary" type="button" data-kid-task-times="${escapeHtml(chore.id)}"${speakAttr('Choose a time for this task.')}>
        <i class="ph-duotone ph-clock"></i>
      </button>`;
  }
  const tone = chore.status === 'done' ? 'done' : 'secondary';
  const icon = chore.status === 'done'
    ? 'ph-check-circle'
    : chore.status === 'pending' || chore.status === 'partial'
      ? 'ph-hourglass'
      : 'ph-clock';
  return `<span class="kid-routine-action-orb kid-routine-action-orb-${tone} is-static"><i class="ph-duotone ${icon}"></i></span>`;
}

const BASE_BADGE_IDS = [
  'first_chore',
  'streak_3',
  'streak_7',
  'streak_14',
  'streak_30',
  'dmds_50',
  'dmds_200',
  'dmds_500',
  'dmds_1000',
  'level_up',
  'level_master',
];

const V1_KID_LEVELS = [
  { level: 1, name: 'Rookie', icon: '<i class="ph-duotone ph-leaf" style="color:#22C55E"></i>', minXp: 0 },
  { level: 2, name: 'Helper', icon: '<i class="ph-duotone ph-sketch-logo" style="color:#3B82F6"></i>', minXp: 50 },
  { level: 3, name: 'Gem', icon: '<i class="ph-duotone ph-sketch-logo" style="color:#7C3AED"></i>', minXp: 150 },
  { level: 4, name: 'Champ', icon: '<i class="ph-duotone ph-trophy" style="color:#D97706"></i>', minXp: 300 },
  { level: 5, name: 'Legend', icon: '<i class="ph-duotone ph-fire" style="color:#EF4444"></i>', minXp: 500 },
  { level: 6, name: 'Hero', icon: '<i class="ph-duotone ph-shield-star" style="color:#6C63FF"></i>', minXp: 800 },
  { level: 7, name: 'Master', icon: '<i class="ph-duotone ph-crown" style="color:#D97706"></i>', minXp: 1200 },
];

function getKidLevelProgress(state: DemoAppState, member: DemoMember): {
  current: { level?: number; name?: string; icon?: string; minXp?: number };
  next: { level?: number; name?: string; icon?: string; minXp?: number } | null;
  xpIntoLevel: number;
  xpNeeded: number;
  pct: number;
} {
  const levels = getKidLevels(state).slice().sort((left, right) => Number(left.minXp || 0) - Number(right.minXp || 0));
  const xp = Number(member.xp ?? member.totalEarned ?? 0);
  let current = levels[0] || { level: 1, name: 'Sprout', icon: '<i class="ph-duotone ph-leaf" style="color:#22C55E"></i>', minXp: 0 };
  for (const level of levels) {
    if (xp >= Number(level.minXp || 0)) current = level;
  }
  const currentIndex = levels.indexOf(current);
  const next = currentIndex >= 0 ? levels[currentIndex + 1] || null : null;
  if (!next) return { current, next: null, xpIntoLevel: 0, xpNeeded: 0, pct: 100 };
  const currentMin = Number(current.minXp || 0);
  const nextMin = Math.max(currentMin + 1, Number(next.minXp || 0));
  const xpIntoLevel = Math.max(0, xp - currentMin);
  const xpNeeded = Math.max(1, nextMin - currentMin);
  return { current, next, xpIntoLevel, xpNeeded, pct: Math.max(0, Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100))) };
}

function getKidLevels(state: DemoAppState): Array<{ level?: number; name?: string; icon?: string; minXp?: number }> {
  return Array.isArray(state.settings.customLevels) && state.settings.customLevels.length >= 2
    ? state.settings.customLevels
    : V1_KID_LEVELS;
}

function activityBadge(row: DemoAppState['historyRows'][number]): { icon: string; bg: string; color: string } {
  const type = String(row.type || '');
  if (type.includes('savings')) return { icon: '<i class="ph-duotone ph-piggy-bank"></i>', bg: '#DCFCE7', color: '#166534' };
  if (type.includes('badge')) return { icon: '<i class="ph-duotone ph-medal"></i>', bg: '#F3E8FF', color: '#7C3AED' };
  if (type.includes('level')) return { icon: '<i class="ph-duotone ph-rocket-launch"></i>', bg: '#E0E7FF', color: '#4338CA' };
  if (type.includes('bonus')) return { icon: '<i class="ph-duotone ph-sparkle"></i>', bg: '#FEF3C7', color: '#B45309' };
  if (type.includes('penalty')) return { icon: '<i class="ph-duotone ph-minus-circle"></i>', bg: '#FEE2E2', color: '#B91C1C' };
  if (type.includes('prize')) return { icon: '<i class="ph-duotone ph-gift"></i>', bg: '#EDE9FE', color: '#6D28D9' };
  return { icon: '<i class="ph-duotone ph-check-circle"></i>', bg: '#DCFCE7', color: '#15803D' };
}

function formatCurrency(value: number, currency: string): string {
  return `${currency}${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

function ordinal(value: number): string {
  const day = Math.min(31, Math.max(1, Math.round(value || 1)));
  const mod100 = day % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th';
  return `${day}${suffix}`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes <= 0) return `${Math.max(0, Math.round(seconds))} sec`;
  const remainder = Math.round(seconds % 60);
  return remainder > 0 ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

function formatNotListeningSpeech(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds || 0));
  if (totalSeconds === 0) return 'No not-listening time. Great job!';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} and ${minutes} minute${minutes !== 1 ? 's' : ''} of not-listening time.`;
  if (minutes > 0 && secs > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''} of not-listening time.`;
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} of not-listening time.`;
  return `${secs} second${secs !== 1 ? 's' : ''} of not-listening time.`;
}

function formatHistoryDate(createdAt: number): string {
  if (!createdAt) return 'Recently';
  const date = new Date(createdAt);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function summarizeChores(state: DemoAppState, member: DemoMember, chores: DemoTask[]) {
  const comboIds = new Set(getDailyComboTasks(state, member).map(task => String(task.id || '')));
  const models = chores.map(task => buildChoreCardModel(state, member, task, comboIds));
  const todo = models.filter(item => item.status === 'todo');
  const partial = models.filter(item => item.status === 'partial');
  const pending = models.filter(item => item.status === 'pending');
  const done = models.filter(item => item.status === 'done');
  const unavailable = models.filter(item => item.status === 'unavailable');
  const totalUnits = Math.max(chores.length, 1);
  const doneUnits = done.length + partial.length;
  const totalGems = models.reduce((sum, item) => sum + item.gems, 0);
  const earnedGems = done.reduce((sum, item) => sum + item.gems, 0) + partial.reduce((sum, item) => sum + item.gems, 0);
  const percent = totalGems > 0 ? Math.round((earnedGems / totalGems) * 100) : Math.round((doneUnits / totalUnits) * 100);
  return { models, todo, partial, pending, done, unavailable, totalUnits, doneUnits, earnedGems, percent };
}

function buildChoreCardModel(state: DemoAppState, member: DemoMember, task: DemoTask, comboIds = new Set<string>()): ChoreCardModel {
  const taskId = String(task.id || '');
  const schedule = normalizeSchedule(task);
  const today = todayKey(state);
  const dayIndex = dayIndexForDateKey(today);
  const relevantCompletions = (state.completions || []).filter(completion =>
    completion.memberId === member.id
    && completion.choreId === taskId
    && isCompletionRelevant(completion, schedule, today)
  );
  const pendingRequests = state.requests.filter(request =>
    request.status === 'pending'
    && request.targetMemberId === member.id
    && request.source?.choreId === taskId
  );
  const pendingRequestCompletionIds = pendingCompletionIdsForRequests(pendingRequests);
  const pendingCompletions = relevantCompletions.filter(entry =>
    entry.status === 'pending'
    && pendingRequestCompletionIds.has(String(entry.id || ''))
  );
  const approvedHistoryCount = state.historyRows.filter(row =>
    row.memberId === member.id
    && (row.type === 'chore' || row.type === 'request.approved')
    && row.metadata?.choreId === taskId
    && isHistoryFromToday(row, schedule, today)
  ).length;
  const scheduledToday = schedule.period === 'once' || schedule.daysOfWeek.includes(dayIndex);
  const targetCount = schedule.slots.length > 0
    ? schedule.slots.length
    : schedule.period === 'week'
      ? Math.max(1, schedule.targetCount)
      : Math.max(1, schedule.targetCount);
  const doneCount = Math.max(
    relevantCompletions.filter(entry => entry.status === 'approved' && entry.entryType !== 'before').length,
    approvedHistoryCount,
  );
  const pendingCount = Math.max(
    pendingCompletions.length,
    pendingRequests.length,
  );
  const completedCount = Math.min(targetCount, doneCount + pendingCount);
  const slotStatuses = schedule.slots.map(slot => {
    const progress = slotProgressStatus(task, relevantCompletions, pendingRequests, slot);
    if (progress) return { label: slotSummary(slot), status: progress };
    if (isSlotOpen(slot)) return { label: slotSummary(slot), status: 'available' as const };
    return { label: slotSummary(slot), status: 'waiting' as const };
  });
  const beforeApproved = relevantCompletions.some(entry => entry.entryType === 'before' && entry.status === 'approved');
  const beforePending = pendingCompletions.some(entry => entry.entryType === 'before') || pendingRequests.some(request => request.kind === 'chore_start');
  const afterPending = pendingCompletions.some(entry => entry.entryType !== 'before') || pendingRequests.some(request => request.kind === 'chore_completion');
  let status: ChoreStatus = 'todo';
  if (!scheduledToday) status = 'unavailable';
  else if (doneCount >= targetCount) status = 'done';
  else if (beforePending || afterPending || (pendingCount > 0 && completedCount >= targetCount)) status = 'pending';
  else if (task.photoMode === 'before_after' && beforeApproved) status = 'partial';
  else if (completedCount > 0) status = 'partial';
  const hasAvailableSlot = slotStatuses.some(slot => slot.status === 'available');
  const canSubmit = scheduledToday && (
    schedule.slots.length > 1
      ? false
      : schedule.slots.length === 1
        ? slotStatuses[0]?.status === 'available'
        : completedCount < targetCount && isWindowOpen(task, dayIndex)
  );
  const photoMode = String(task.photoMode || 'none');
  const entryType: ChoreCardModel['entryType'] = photoMode === 'before_after'
    ? beforeApproved ? 'after' : 'before'
    : photoMode === 'after'
      ? 'after'
      : null;
  const metaLines = [
    schedulePrimaryLine(schedule),
    ...scheduleSecondaryLines(task, schedule, status, slotStatuses),
  ].filter(Boolean);
  const visibleStatus = status === 'unavailable' && hasAvailableSlot ? 'todo' : status;
  const reveal = canSubmit
    ? { label: entryType === 'before' ? 'Request' : entryType === 'after' ? 'Done' : 'Done', icon: entryType ? 'ph-camera' : 'ph-check-circle' }
    : schedule.slots.length > 1
      ? { label: 'Times', icon: 'ph-clock' }
      : status === 'done'
        ? { label: 'Done', icon: 'ph-check-circle' }
        : status === 'pending' || status === 'partial'
          ? { label: 'Pending', icon: 'ph-hourglass' }
          : { label: 'Later', icon: 'ph-clock' };
  return {
    id: taskId,
    title: String(task.title || 'Untitled task'),
    icon: String(task.icon || 'broom').replace(/^ph-/, ''),
    iconColor: String(task.iconColor || '#6BCB77'),
    gems: Number(task.gems ?? task.diamonds ?? 0),
    status: visibleStatus,
    canSubmit,
    revealLabel: reveal.label,
    revealIcon: reveal.icon,
    entryType,
    slotId: schedule.slots.length === 1 ? String(schedule.slots[0]?.id || '') : null,
    hasSlots: schedule.slots.length > 1,
    hasAvailableSlot,
    metaLines,
    isCombo: comboIds.has(taskId),
  };
}

export function renderKidTimePicker(state: DemoAppState, member: DemoMember, taskId: string): string {
  const task = state.tasks.find(item => String(item.id || '') === taskId);
  if (!task) return '';
  const littleKid = isLittleKidMode(member);
  const schedule = normalizeSchedule(task);
  const model = buildChoreCardModel(state, member, task);
  const today = todayKey(state);
  const completions = (state.completions || []).filter(completion =>
    completion.memberId === member.id
    && completion.choreId === taskId
    && String(completion.date || '') === today
  );
  const buttons = schedule.slots.map((slot, index) => {
    const slotId = String(slot.id || '');
    const requests = state.requests.filter(request =>
      request.status === 'pending'
      && request.targetMemberId === member.id
      && request.source?.choreId === taskId
    );
    const progress = slotProgressStatus(task, completions, requests, slot);
    const status = progress === 'done'
      ? 'done'
      : progress === 'pending'
        ? 'pending'
        : isSlotOpen(slot)
          ? 'todo'
          : 'later';
    const icon = status === 'done'
      ? 'ph-check-circle'
      : status === 'pending'
        ? 'ph-hourglass'
        : status === 'later'
          ? 'ph-clock'
          : model.revealIcon;
    const label = slotSummary(slot);
    const disabled = !littleKid && (status === 'done' || status === 'pending' || status === 'later') ? 'disabled' : '';
    return `<button class="snapshot-time-orb ${status}" style="--slot-index:${index}" type="button" ${disabled} data-kid-time-slot="${escapeHtml(taskId)}:${escapeHtml(slotId)}" data-kid-time-slot-status="${status}" data-kid-time-slot-label="${escapeHtml(label)}" ${model.entryType ? `data-kid-time-entry-type="${model.entryType}"` : ''}>
      <i class="ph-duotone ${escapeHtml(icon)}" aria-hidden="true"></i>
      <span class="snapshot-time-orb-label">${escapeHtml(label)}</span>
    </button>`;
  }).join('');
  const layout = schedule.slots.length <= 3 ? 'wide' : 'compact';
  return `<div class="snapshot-time-picker-shell open" data-kid-time-picker-shell>
    <div class="snapshot-time-orb-grid snapshot-time-orb-grid-${layout}">
      ${buttons || '<div class="empty-text">No times configured</div>'}
    </div>
  </div>`;
}

function slotProgressStatus(task: DemoTask, completions: DemoCompletion[], requests: DemoAppState['requests'], slot: { id?: string }): 'done' | 'pending' | null {
  const slotId = String(slot.id || '');
  const slotCompletions = completions.filter(entry => String(entry.slotId || '') === slotId);
  const slotRequests = requests.filter(request => {
    const completionId = String(request.source?.completionId || '');
    return completionId && slotCompletions.some(entry => entry.id === completionId);
  });
  const slotPendingCompletionIds = pendingCompletionIdsForRequests(slotRequests);
  const hasLinkedPendingCompletion = slotCompletions.some(entry =>
    entry.status === 'pending'
    && slotPendingCompletionIds.has(String(entry.id || ''))
  );
  if (task.photoMode === 'before_after') {
    if (slotCompletions.some(entry => entry.entryType !== 'before' && entry.status === 'approved')) return 'done';
    if (hasLinkedPendingCompletion || slotRequests.some(request => request.status === 'pending')) return 'pending';
    return null;
  }
  if (slotCompletions.some(entry => entry.status === 'approved')) return 'done';
  if (hasLinkedPendingCompletion || slotRequests.some(request => request.status === 'pending')) return 'pending';
  return null;
}

function pendingCompletionIdsForRequests(requests: DemoAppState['requests']): Set<string> {
  return new Set(requests
    .filter(request => request.status === 'pending')
    .map(request => String(request.source?.completionId || ''))
    .filter(Boolean));
}

export function renderKidPhotoCapture(task: DemoTask, entryType: 'before' | 'after', slotId = ''): string {
  const isBefore = entryType === 'before';
  return `
    <div class="photo-capture-overlay" data-photo-capture-overlay>
      <div class="photo-capture-sheet" role="dialog" aria-modal="true" aria-label="Photo capture">
        <button class="modal-close-x" type="button" aria-label="Close" data-photo-cancel>
          <span aria-hidden="true">&times;</span>
        </button>
        <div class="modal-title"><i class="ph-duotone ph-camera" style="color:#6C63FF;font-size:1.1rem;vertical-align:middle"></i> ${isBefore ? 'Take a "Before" Photo' : 'Take a "Done" Photo'}</div>
        <p style="color:var(--muted);font-size:0.88rem;margin-bottom:14px">${isBefore
          ? `Show the current state of "${escapeHtml(task.title || '')}" - e.g. the messy room, the full trash can. Parent will approve before you start.`
          : `Show that you've completed "${escapeHtml(task.title || '')}"`}</p>
        <button class="photo-preview-wrap" type="button" data-photo-pick>
          <img data-photo-preview-img src="" alt="" style="display:none">
          <div data-photo-drop-hint style="color:var(--muted);font-size:2rem;padding:20px 0">
            <i class="ph-duotone ph-camera" style="color:#9CA3AF;font-size:2.5rem"></i><br><span style="font-size:0.95rem">Tap to take photo or choose image</span>
          </div>
        </button>
        <input type="file" data-photo-file-input accept="image/*" capture="environment" style="display:none">
        <div class="modal-actions">
          <button class="btn btn-primary" data-photo-submit data-photo-task="${escapeHtml(String(task.id || ''))}" data-photo-slot="${escapeHtml(slotId)}" data-photo-entry-type="${entryType}" style="opacity:0.4;pointer-events:none">${isBefore ? 'Submit' : 'Submit Completion'}</button>
          <button class="btn btn-secondary" data-photo-cancel>Cancel</button>
        </div>
      </div>
    </div>`;
}

function renderDailyCombo(state: DemoAppState, member: DemoMember, models: ChoreCardModel[], littleKid = false): string {
  if (state.settings.comboEnabled === false) return '';
  const comboTasks = getDailyComboTasks(state, member);
  if (comboTasks.length < 3) return '';

  const modelById = new Map(models.map(model => [model.id, model]));
  const comboModels = comboTasks.slice(0, 3).map(task => {
    const id = String(task.id || '');
    return modelById.get(id) || buildChoreCardModel(state, member, task, new Set(comboTasks.map(comboTask => String(comboTask.id || ''))));
  });
  const comboCompleted = comboModels.filter(model => model.status === 'done').length;
  const multiplier = Math.max(2, Number(state.settings.comboMultiplier || 2));
  const bonusGems = Math.max(1, multiplier - 1) * comboModels.reduce((sum, model) => sum + model.gems, 0);
  const comboBonusAlreadyAwarded = String(member.comboBonusDate || '') === todayKey(state);
  const comboNames = comboModels.map(model => model.title);
  const comboNameText = comboNames.length > 1 ? `${comboNames.slice(0, -1).join(', ')}, and ${comboNames[comboNames.length - 1]}` : comboNames[0] || 'your combo tasks';
  const comboSpeech = comboBonusAlreadyAwarded
    ? 'Amazing! You completed the daily routine and earned bonus gems!'
    : `If you can finish ${comboNameText} today, you will earn bonus gems for all three tasks!`;

  return `
    <div class="combo-banner"${littleKid ? speakAttr(comboSpeech) : ''}>
      <div class="combo-banner-header">
        <div>
          <div class="combo-banner-title"><i class="ph-duotone ph-lightning" style="color:#F59E0B;font-size:1rem;vertical-align:middle"></i> Daily Combo ${comboBonusAlreadyAwarded ? 'Complete! <i class="ph-duotone ph-confetti" style="font-size:0.95rem;vertical-align:middle"></i>' : ''}</div>
          <div class="combo-banner-sub">${comboBonusAlreadyAwarded
            ? `You earned ${bonusGems} bonus gems today!`
            : `Complete all 3 for ${bonusGems} bonus gems`}</div>
        </div>
        <div class="combo-progress-badge ${comboCompleted >= 3 ? 'complete' : ''}" style="--combo-progress:${Math.min(100, Math.round((comboCompleted / 3) * 100))}%">
          <div class="combo-progress-badge-center">
            <strong>${comboCompleted}</strong>
            <span>/3</span>
          </div>
        </div>
      </div>
      <div class="combo-chore-list">
        ${comboModels.map(model => {
          const isDone = model.status === 'done';
          return `<div class="combo-chore-item ${isDone ? 'done' : ''}">
            <span class="combo-chore-item-check">${isDone ? '<i class="ph-duotone ph-check-circle" style="color:#16A34A;font-size:1.1rem"></i>' : '<i class="ph-duotone ph-circle" style="color:#D1D5DB;font-size:1.1rem"></i>'}</span>
            <span><i class="ph-duotone ph-${escapeHtml(model.icon)}" style="color:${escapeHtml(model.iconColor)};font-size:1rem;vertical-align:middle"></i> <span class="combo-item-title">${escapeHtml(model.title)}</span></span>
            <span class="combo-task-reward${isDone ? ' combo-task-reward-done' : ''}">${model.gems}</span>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

function getDailyComboTasks(state: DemoAppState, member: DemoMember): DemoTask[] {
  const memberId = String(member.id || '');
  const today = todayKey(state);
  const override = state.settings.comboOverrides?.[memberId];
  const configuredIds = override && override.date === today && Array.isArray(override.ids)
    ? override.ids
    : state.settings.comboAssignments?.[memberId] || getAllDailyComboIds(state)[memberId] || [];
  return configuredIds
    .map(id => state.tasks.find(task => String(task.id || '') === String(id)))
    .filter((task): task is DemoTask => !!task)
    .slice(0, 3);
}

function getAllDailyComboIds(state: DemoAppState): Record<string, string[]> {
  const kids = state.members.filter(member => member.role === 'kid' && !member.deleted).sort((left, right) => String(left.id || '').localeCompare(String(right.id || '')));
  const used = new Set<string>();
  const combos: Record<string, string[]> = {};
  for (const kid of kids) {
    const kidId = String(kid.id || '');
    const eligible = state.tasks.filter(task =>
      Array.isArray(task.assignedTo)
      && task.assignedTo.includes(kidId)
      && task.schedule?.period !== 'once'
      && !used.has(String(task.id || ''))
    );
    const ids = eligible.length <= 3
      ? eligible.map(task => String(task.id || ''))
      : seededShuffle(eligible, dailyComboSeed(`${todayKey(state)}|${kidId}`)).slice(0, 3).map(task => String(task.id || ''));
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

function assignedTasks(state: DemoAppState, member: DemoMember): DemoTask[] {
  return state.tasks
    .filter(task => Array.isArray(task.assignedTo) && task.assignedTo.includes(String(member.id || '')))
    .sort((left, right) => Number(left.gems ?? left.diamonds ?? 0) - Number(right.gems ?? right.diamonds ?? 0) || String(left.title || '').localeCompare(String(right.title || '')));
}

function renderKidPlaceholderCard(title: string, copy: string): string {
  return `
    <section class="card">
      <div class="card-title">${escapeHtml(title)}</div>
      <div class="text-muted">${escapeHtml(copy)}</div>
    </section>
  `;
}

function renderMemberAvatar(member: DemoMember, preferCircle = false): string {
  const rawAvatar = String(member.avatar || member.icon || '').trim();
  const fallback = preferCircle ? 'user-circle' : 'smiley';
  const avatarColor = String(member.avatarColor || member.color || '#6C63FF');
  if (!rawAvatar) {
    return `<i class="ph-duotone ph-${fallback}" style="color:${escapeHtml(avatarColor)}"></i>`;
  }
  if (rawAvatar.startsWith('<')) return applyAvatarColor(rawAvatar, avatarColor);
  if (/\.(png|jpe?g|gif|webp)$/i.test(rawAvatar)) return `<img src="${escapeHtml(rawAvatar)}" class="avatar-img">`;
  const avatar = rawAvatar.replace(/^ph-duotone\s+/, '').replace(/^ph-/, '') || fallback;
  return `<i class="ph-duotone ph-${escapeHtml(avatar)}" style="color:${escapeHtml(avatarColor)}"></i>`;
}

function applyAvatarColor(html: string, color: string): string {
  if (!html || !color || /\.(png|jpe?g|gif|webp)$/i.test(html)) return html;
  if (html.includes('style=')) return html.replace(/color\s*:\s*[^;"']+/i, `color:${escapeHtml(color)}`);
  return html.replace('<i ', `<i style="color:${escapeHtml(color)}" `);
}

function normalizeSchedule(task: DemoTask): { period: string; targetCount: number; daysOfWeek: number[]; windows: Record<string, { start?: string; end?: string }>; slots: Array<{ id?: string; label?: string; start?: string; end?: string }> } {
  const schedule = task.schedule || {};
  return {
    period: String(schedule.period || 'day'),
    targetCount: Math.max(1, Number(schedule.targetCount || 1)),
    daysOfWeek: Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length ? schedule.daysOfWeek : [0, 1, 2, 3, 4, 5, 6],
    windows: schedule.windows || {},
    slots: Array.isArray(schedule.slots) ? schedule.slots : [],
  };
}

function isCompletionRelevant(completion: DemoCompletion, schedule: ReturnType<typeof normalizeSchedule>, today: string): boolean {
  if (schedule.period === 'once') return true;
  if (schedule.period === 'week') {
    const start = startOfWeekKey(today);
    return String(completion.date || '') >= start && String(completion.date || '') <= today;
  }
  return String(completion.date || '') === today;
}

function isHistoryFromToday(row: DemoAppState['historyRows'][number], schedule: ReturnType<typeof normalizeSchedule>, today: string): boolean {
  const createdAt = Number(row.createdAt || 0);
  if (!createdAt) return false;
  const date = new Date(createdAt);
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  if (schedule.period === 'once') return true;
  if (schedule.period === 'week') {
    const start = startOfWeekKey(today);
    return dateKey >= start && dateKey <= today;
  }
  return dateKey === today;
}

function schedulePrimaryLine(schedule: ReturnType<typeof normalizeSchedule>): string {
  if (schedule.period === 'once') return 'One-time task';
  if (schedule.slots.length > 0) return `${schedule.slots.length}x per day`;
  if (schedule.period === 'week') return `${schedule.targetCount}x per week`;
  return `${schedule.targetCount}x per day`;
}

function scheduleSecondaryLines(_task: DemoTask, schedule: ReturnType<typeof normalizeSchedule>, _status: ChoreStatus, _slotStatuses: Array<{ label: string; status: 'done' | 'pending' | 'available' | 'waiting' }>): string[] {
  const lines: string[] = [];
  const days = formatDays(schedule.daysOfWeek);
  if (days) lines.push(days);
  return lines;
}

function formatDays(days: number[]): string {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (days.length === 7) return 'Every day';
  return days.map(day => labels[day] || '').filter(Boolean).join(', ');
}

function formatWindow(window: { start?: string; end?: string }): string {
  if (!window.start && !window.end) return '';
  if (window.start && window.end) return `${formatTime(window.start)} - ${formatTime(window.end)}`;
  if (window.start) return `After ${formatTime(window.start)}`;
  return `Before ${formatTime(String(window.end || ''))}`;
}

function slotSummary(slot: { label?: string; start?: string; end?: string }): string {
  if (slot.label) return String(slot.label);
  return formatWindow({ start: slot.start, end: slot.end }) || 'Any time';
}

function isWindowOpen(task: DemoTask, dayIndex: number): boolean {
  const schedule = normalizeSchedule(task);
  if (schedule.period !== 'day' && schedule.period !== 'week') return true;
  const window = schedule.windows[String(dayIndex)] || {};
  if (!window.start && !window.end) return true;
  const now = minutesNow();
  const start = timeToMinutes(window.start);
  const end = timeToMinutes(window.end);
  if (start == null && end == null) return true;
  if (start != null && end != null) return start <= end ? now >= start && now <= end : now >= start || now <= end;
  if (start != null) return now >= start;
  return now <= (end as number);
}

function isSlotOpen(slot: { start?: string; end?: string }): boolean {
  if (!slot.start && !slot.end) return true;
  const now = minutesNow();
  const start = timeToMinutes(slot.start);
  const end = timeToMinutes(slot.end);
  if (start == null && end == null) return true;
  if (start != null && end != null) return start <= end ? now >= start && now <= end : now >= start || now <= end;
  if (start != null) return now >= start;
  return now <= (end as number);
}

function minutesNow(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function timeToMinutes(value?: string): number | null {
  if (!value) return null;
  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatTime(value: string): string {
  const match = String(value).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;
  const hours24 = Number(match[1]);
  const minutes = match[2];
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = ((hours24 + 11) % 12) + 1;
  return `${hours12}:${minutes} ${suffix}`;
}

function navIcon(kind: 'chores' | 'diamond' | 'shop' | 'team' | 'stats'): string {
  switch (kind) {
    case 'chores':
      return `<svg viewBox="0 0 28 28" fill="none" width="1em" height="1em"><rect x="6" y="5" width="16" height="20" rx="3" fill="#6BCB77" fill-opacity=".18" stroke="#6BCB77" stroke-width="1.8"/><rect x="10" y="3.5" width="8" height="4" rx="2" fill="#6BCB77"/><line x1="10" y1="12" x2="18" y2="12" stroke="#6BCB77" stroke-width="1.6" stroke-linecap="round"/><line x1="10" y1="16" x2="18" y2="16" stroke="#6BCB77" stroke-width="1.6" stroke-linecap="round"/><polyline points="10,21.5 12.5,24 18,18" stroke="#6BCB77" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
    case 'diamond':
      return `<i class="ph-duotone ph-sketch-logo" style="color:#6C63FF"></i>`;
    case 'shop':
      return `<svg viewBox="0 0 28 28" fill="none" width="1em" height="1em"><path d="M6 11h16l-1.5 15H7.5L6 11z" fill="#FFD93D" fill-opacity=".28" stroke="#FF9A3C" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 11V8.5C10 5.9 11.8 4 14 4s4 1.9 4 4.5V11" stroke="#FF9A3C" stroke-width="1.9" stroke-linecap="round" fill="none"/><line x1="9.5" y1="18.5" x2="18.5" y2="18.5" stroke="#FF9A3C" stroke-width="1.5" stroke-linecap="round" opacity=".6"/></svg>`;
    case 'team':
      return `<svg viewBox="0 0 28 28" fill="none" width="1em" height="1em"><path d="M9 4h10v12c0 2.8-2.2 5-5 5s-5-2.2-5-5V4z" fill="#FFD93D" fill-opacity=".3" stroke="#FFD93D" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 8H5v4c0 2.2 1.8 4 4 4" stroke="#FFD93D" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M19 8h4v4c0 2.2-1.8 4-4 4" stroke="#FFD93D" stroke-width="1.8" stroke-linecap="round" fill="none"/><line x1="14" y1="21" x2="14" y2="24" stroke="#FFD93D" stroke-width="1.8" stroke-linecap="round"/><line x1="10" y1="24" x2="18" y2="24" stroke="#FFD93D" stroke-width="2.2" stroke-linecap="round"/></svg>`;
    case 'stats':
      return `<svg viewBox="0 0 28 28" fill="none" width="1em" height="1em"><circle cx="14" cy="14" r="9.5" fill="#45B7D1" fill-opacity=".16" stroke="#45B7D1" stroke-width="1.8"/><path d="M14 4.5a9.5 9.5 0 0 1 8.86 6.06L14 14V4.5z" fill="#45B7D1" fill-opacity=".85"/><path d="M14 14l-5.9 7.44A9.5 9.5 0 0 1 4.5 14H14z" fill="#45B7D1" fill-opacity=".38"/><circle cx="14" cy="14" r="2.3" fill="#45B7D1"/></svg>`;
  }
}
