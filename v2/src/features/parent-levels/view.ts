import { type DemoAppState, type DemoFamilySettings, type DemoTask } from '../../app/local-demo-state';
import { escapeHtml } from '../../ui/html';

export const LEVEL_ICON_OPTIONS = [
  { label: 'Leaf', html: '<i class="ph-duotone ph-leaf" style="color:#22C55E;font-size:1.4rem"></i>' },
  { label: 'Gem', html: '<i class="ph-duotone ph-sketch-logo" style="color:#3B82F6;font-size:1.4rem"></i>' },
  { label: 'Trophy', html: '<i class="ph-duotone ph-trophy" style="color:#D97706;font-size:1.4rem"></i>' },
  { label: 'Fire', html: '<i class="ph-duotone ph-fire" style="color:#EF4444;font-size:1.4rem"></i>' },
  { label: 'Shield', html: '<i class="ph-duotone ph-shield-star" style="color:#6C63FF;font-size:1.4rem"></i>' },
  { label: 'Crown', html: '<i class="ph-duotone ph-crown" style="color:#D97706;font-size:1.4rem"></i>' },
  { label: 'Star', html: '<i class="ph-duotone ph-star" style="color:#F59E0B;font-size:1.4rem"></i>' },
  { label: 'Rocket', html: '<i class="ph-duotone ph-rocket-launch" style="color:#6C63FF;font-size:1.4rem"></i>' },
  { label: 'Lightning', html: '<i class="ph-duotone ph-lightning" style="color:#F59E0B;font-size:1.4rem"></i>' },
  { label: 'Medal', html: '<i class="ph-duotone ph-medal" style="color:#D97706;font-size:1.4rem"></i>' },
  { label: 'Sparkle', html: '<i class="ph-duotone ph-sparkle" style="color:#EC4899;font-size:1.4rem"></i>' },
  { label: 'Moon', html: '<i class="ph-duotone ph-moon-stars" style="color:#6366F1;font-size:1.4rem"></i>' },
];

const BADGE_DEFS = [
  { id: 'first_chore', icon: '<i class="ph-duotone ph-check-circle" style="color:#16A34A"></i>', name: 'First Task', desc: 'Complete your very first task' },
  { id: 'streak_3', icon: '<i class="ph-duotone ph-fire" style="color:#F97316"></i>', name: 'On a Roll', desc: '3-day streak' },
  { id: 'streak_7', icon: '<i class="ph-duotone ph-waves" style="color:#3B82F6"></i>', name: 'Week Warrior', desc: '7-day streak' },
  { id: 'streak_14', icon: '<i class="ph-duotone ph-lightning" style="color:#F59E0B"></i>', name: 'Unstoppable', desc: '14-day streak' },
  { id: 'streak_30', icon: '<i class="ph-duotone ph-medal" style="color:#D97706"></i>', name: 'Monthly Hero', desc: '30-day streak' },
  { id: 'dmds_50', icon: '<i class="ph-duotone ph-sketch-logo" style="color:#3B82F6"></i>', name: 'Gem Collector', desc: 'Earn 50 gems total' },
  { id: 'dmds_200', icon: '<i class="ph-duotone ph-sketch-logo" style="color:#7C3AED"></i>', name: 'Gem Hoarder', desc: 'Earn 200 gems total' },
  { id: 'dmds_500', icon: '<i class="ph-duotone ph-piggy-bank" style="color:#10B981"></i>', name: 'Gem Mogul', desc: 'Earn 500 gems total' },
  { id: 'dmds_1000', icon: '<i class="ph-duotone ph-crown" style="color:#D97706"></i>', name: 'Gem Club', desc: 'Earn 1000 gems total' },
  { id: 'level_up', icon: '<i class="ph-duotone ph-rocket-launch" style="color:#6C63FF"></i>', name: 'Level Up!', desc: 'Reach level 2 or higher' },
  { id: 'level_master', icon: '<i class="ph-duotone ph-crown-simple" style="color:#D97706"></i>', name: 'Master Level', desc: 'Reach level 7 (Master)' },
];

const DEFAULT_LEVELS = [
  { level: 1, name: 'Sprout', icon: '<i class="ph-duotone ph-leaf" style="color:#22C55E;font-size:1em"></i>', minXp: 0 },
  { level: 2, name: 'Helper', icon: '<i class="ph-duotone ph-sketch-logo" style="color:#3B82F6;font-size:1em"></i>', minXp: 100 },
  { level: 3, name: 'Shining Star', icon: '<i class="ph-duotone ph-star" style="color:#F59E0B;font-size:1em"></i>', minXp: 250 },
  { level: 4, name: 'Superstar', icon: '<i class="ph-duotone ph-crown" style="color:#D97706;font-size:1em"></i>', minXp: 500 },
];

export function renderParentLevels(state: DemoAppState, pendingComboOverrides: Record<string, Record<number, string>> = {}): string {
  const s = state.settings || {};
  const levels = getLevels(s);
  const baseBadgesEnabled = s.baseBadgesEnabled !== false;
  const baseBadgeRows = BADGE_DEFS.map(def => {
    const merged = getBaseBadgeDef(s, def.id);
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:#FAFAFA;border-radius:10px;border:1px solid #E5E7EB;margin-bottom:6px">
      <button class="btn-icon-sm" data-base-badge-icon="${escapeHtml(def.id)}" type="button" style="width:44px;height:44px;background:#fff;border:1px dashed #D1D5DB;border-radius:10px">${merged.icon}</button>
      <div style="flex:1;min-width:0">
        <div style="font-size:0.9rem;font-weight:600">${escapeHtml(merged.name)}</div>
        <div style="font-size:0.78rem;color:var(--muted)">${escapeHtml(merged.desc)}</div>
      </div>
    </div>`;
  }).join('');

  const choreBadgeCards = state.tasks.length === 0
    ? `<div class="empty-state"><div class="empty-text">No tasks yet - add some from the Tasks tab</div></div>`
    : state.tasks.map((task, taskIndex) => renderTaskBadgeCard(task, taskIndex)).join('');

  return `
    <div class="section-row">
      <span class="section-title"><i class="ph-duotone ph-rocket-launch" style="color:#6C63FF;font-size:1rem;vertical-align:middle"></i> Leveling System</span>
      <label class="toggle"><input type="checkbox" data-setting-toggle="levelingEnabled" ${s.levelingEnabled !== false ? 'checked' : ''}><span class="toggle-track"></span></label>
    </div>
    <div class="card">
      <p style="font-size:0.83rem;color:var(--muted);margin-bottom:${s.levelingEnabled !== false ? '14px' : '0'}">Kids earn XP equal to their gems earned and unlock levels as they progress.</p>
      ${s.levelingEnabled !== false ? `${levels.map((level, index) => renderLevelRow(level, index, levels.length)).join('')}
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-primary btn-sm" data-level-add type="button">+ Add Level</button>
        <button class="btn btn-sm" style="background:#F3F4F6;color:#374151" data-level-reset type="button">Reset to Defaults</button>
      </div>` : ''}
    </div>

    <div class="section-row">
      <span class="section-title"><i class="ph-duotone ph-fire" style="color:#F97316;font-size:1rem;vertical-align:middle"></i> Streak Bonuses</span>
      <label class="toggle"><input type="checkbox" data-setting-toggle="streakEnabled" ${s.streakEnabled !== false ? 'checked' : ''}><span class="toggle-track"></span></label>
    </div>
    <div class="card">
      <p style="font-size:0.83rem;color:var(--muted);margin-bottom:${s.streakEnabled !== false ? '14px' : '0'}">Bonus gems when a kid completes at least one task in their rhythm every day in a row.</p>
      ${s.streakEnabled !== false ? [['3-day streak', 'streakBonus3', 1], ['7-day streak', 'streakBonus7', 3], ['14-day streak', 'streakBonus14', 5], ['30-day streak', 'streakBonus30', 10]].map(([label, key, value]) => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:#FAFAFA;border-radius:10px;border:1px solid #E5E7EB;margin-bottom:8px">
          <span style="flex:1;font-size:0.9rem;font-weight:600">${label}</span>
          <input type="number" data-setting-number="${String(key)}" value="${Number((s as Record<string, unknown>)[String(key)] || value)}" min="0"
            style="width:64px;font-size:0.9rem;padding:6px 8px;border:1px solid #E5E7EB;border-radius:8px;text-align:center">
          <span style="font-size:0.8rem;color:var(--muted);white-space:nowrap"><i class="ph-duotone ph-sketch-logo" style="color:#7C3AED;font-size:0.9rem;vertical-align:middle"></i> bonus</span>
        </div>`).join('') : ''}
    </div>

    <div class="section-row">
      <span class="section-title"><i class="ph-duotone ph-lightning" style="color:#F59E0B;font-size:1rem;vertical-align:middle"></i> Daily Combo</span>
      <label class="toggle"><input type="checkbox" data-setting-toggle="comboEnabled" ${s.comboEnabled !== false ? 'checked' : ''}><span class="toggle-track"></span></label>
    </div>
    <div class="card">
      <p style="font-size:0.83rem;color:var(--muted);margin-bottom:${s.comboEnabled !== false ? '14px' : '0'}">Each kid gets a random set of 3 tasks per day for their Daily Combo - complete all 3 for double gems on those tasks.</p>
      ${s.comboEnabled !== false ? renderComboSettings(state, pendingComboOverrides) : ''}
    </div>

    <div class="section-row">
      <span class="section-title"><i class="ph-duotone ph-shield-check" style="color:#6C63FF;font-size:1rem;vertical-align:middle"></i> Base Badges</span>
      <label class="toggle"><input type="checkbox" data-setting-toggle="baseBadgesEnabled" ${baseBadgesEnabled ? 'checked' : ''}><span class="toggle-track"></span></label>
    </div>
    <div class="card">
      <p style="font-size:0.83rem;color:var(--muted);margin-bottom:${baseBadgesEnabled ? '14px' : '0'}">System-wide achievement badges earned automatically for streaks, levels, and milestones.</p>
      ${baseBadgesEnabled ? baseBadgeRows : ''}
    </div>

    <div class="section-row">
      <span class="section-title"><i class="ph-duotone ph-medal" style="color:#D97706;font-size:1rem;vertical-align:middle"></i> Task Badges</span>
      <label class="toggle"><input type="checkbox" data-setting-toggle="choreBadgesEnabled" ${s.choreBadgesEnabled !== false ? 'checked' : ''}><span class="toggle-track"></span></label>
    </div>
    <div class="card">
      <p style="font-size:0.83rem;color:var(--muted);margin-bottom:${s.choreBadgesEnabled !== false ? '14px' : '0'}">Per-task milestone badges. Kids earn these by completing a task a set number of times. Use <i class="ph-duotone ph-eye" style="color:#9ca3af;vertical-align:middle"></i> to make a badge secret so it won't appear at all until earned, making it a surprise to discover.</p>
      ${s.choreBadgesEnabled !== false ? choreBadgeCards : ''}
    </div>
  `;
}

function renderLevelRow(level: { level?: number; name?: string; icon?: string; minXp?: number }, index: number, levelCount: number): string {
  return `<div class="admin-card" style="margin-bottom:8px;gap:8px;align-items:flex-start">
    <button data-level-icon="${index}" title="Change icon"
      style="font-size:1.4rem;background:none;border:1px dashed #D1D5DB;border-radius:8px;padding:4px 8px;cursor:pointer;min-width:44px;text-align:center;flex-shrink:0;line-height:1.4">${level.icon || LEVEL_ICON_OPTIONS[0].html}</button>
    <div style="flex:1;display:flex;flex-direction:column;gap:6px">
      <input type="text" value="${escapeHtml(String(level.name || ''))}" data-level-name="${index}" placeholder="Level name"
        style="font-size:0.9rem;padding:6px 10px;border:1px solid #E5E7EB;border-radius:8px;width:100%">
      <div style="display:flex;align-items:center;gap:6px">
        <input type="number" value="${Number(level.minXp || 0)}" min="0" ${index === 0 ? 'disabled' : ''} data-level-xp="${index}"
          style="width:80px;font-size:0.9rem;padding:6px 10px;border:1px solid #E5E7EB;border-radius:8px">
        <span style="font-size:0.8rem;color:var(--muted)">XP to unlock</span>
      </div>
    </div>
    ${levelCount > 2 ? `<button class="btn-icon-sm btn-icon-delete" data-level-delete="${index}" type="button" style="flex-shrink:0"><i class="ph-duotone ph-trash"></i></button>` : ''}
  </div>`;
}

function renderComboSettings(state: DemoAppState, pendingComboOverrides: Record<string, Record<number, string>>): string {
  const kids = state.members.filter(member => member.role === 'kid');
  if (!kids.length) return '';
  const multiplier = state.settings.comboMultiplier || 2;
  const today = todayKeyForCombo(state);
  return `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#FFFBEB;border-radius:10px;border:1px solid #FDE68A;margin-bottom:14px">
      <i class="ph-duotone ph-lightning" style="color:#F59E0B;font-size:1.1rem;flex-shrink:0"></i>
      <span style="font-size:0.85rem;color:#92400E;flex:1">Complete all 3 for</span>
      <input type="number" data-setting-number="comboMultiplier" value="${multiplier}" min="2" max="10"
        style="width:48px;font-size:0.9rem;padding:4px 6px;border:1.5px solid #FDE68A;border-radius:8px;text-align:center;font-weight:700;color:#92400E;background:white">
      <span style="font-size:0.85rem;color:#92400E;white-space:nowrap">x <i class="ph-duotone ph-sketch-logo" style="color:#7C3AED;font-size:0.95rem;vertical-align:middle"></i></span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 14px">
      ${kids.map(kid => {
        const kidId = String(kid.id || '');
        const savedCombo = getDailyComboIdsForMember(state, kidId, today);
        const pending = pendingComboOverrides[kidId] || {};
        const hasPending = Object.keys(pending).length > 0;
        const combo = [0, 1, 2].map(index => pending[index] || savedCombo[index]).filter(Boolean);
        const eligible = state.tasks.filter(task =>
          Array.isArray(task.assignedTo)
          && task.assignedTo.includes(kidId)
          && task.schedule?.period !== 'once'
        );
        return `<div style="text-align:center">
          <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px">
            <span style="font-weight:600;font-size:0.95rem">${escapeHtml(String(kid.name || '').split(' ')[0] || 'Kid')}</span>
          </div>
          ${[0, 1, 2].map(i => {
            const otherIds = combo.filter((_, index) => index !== i);
            const slotEligible = eligible.filter(task => !otherIds.includes(String(task.id || '')));
            return `${i > 0 ? `<div style="text-align:center;font-size:1.1rem;font-weight:800;color:#F59E0B;line-height:1;padding:3px 0">+</div>` : ''}
            <select data-combo-select="${escapeHtml(kidId)}:${i}" style="width:100%;text-align:center;text-align-last:center;font-size:0.85rem;padding:9px 10px;border-radius:10px;border:1.5px solid #E5E7EB;background:white;font-weight:500;color:var(--text)">
              ${slotEligible.map(task => `<option value="${escapeHtml(String(task.id || ''))}" ${combo[i] === task.id ? 'selected' : ''}>${escapeHtml(String(task.title || 'Task'))}</option>`).join('')}
            </select>`;
          }).join('')}
          ${hasPending ? `<div style="margin-top:8px"><button class="btn btn-primary btn-sm" data-combo-save="${escapeHtml(kidId)}" type="button">Save Combo</button></div>` : ''}
        </div>`;
      }).join('')}
    </div>
  `;
}

function todayKeyForCombo(state: DemoAppState): string {
  const timezone = state.settings.familyTimezone;
  if (timezone) {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());
    } catch {
      // fall back to local date below
    }
  }
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDailyComboIdsForMember(state: DemoAppState, memberId: string, today: string): string[] {
  const override = state.settings.comboOverrides?.[memberId];
  if (override?.date === today && Array.isArray(override.ids)) return override.ids.slice(0, 3).filter(Boolean);
  const assigned = state.settings.comboAssignments?.[memberId];
  if (Array.isArray(assigned) && assigned.length) return assigned.slice(0, 3).filter(Boolean);
  return getAllDailyComboIds(state, today)[memberId] || [];
}

function getAllDailyComboIds(state: DemoAppState, today: string): Record<string, string[]> {
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
      : seededShuffle(eligible, dailyComboSeed(`${today}|${kidId}`)).slice(0, 3).map(task => String(task.id || ''));
    combos[kidId] = ids.filter(Boolean);
    ids.forEach(id => used.add(id));
  }
  return combos;
}

function dailyComboSeed(value: string): number {
  let seed = 0;
  for (let index = 0; index < value.length; index += 1) seed = Math.imul(seed ^ value.charCodeAt(index), 0x9E3779B9);
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

function renderTaskBadgeCard(task: DemoTask, taskIndex: number): string {
  const badges = Array.isArray(task.badges) ? task.badges : [];
  return `<div style="margin-bottom:14px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <i class="ph-duotone ph-${escapeHtml(String(task.icon || 'broom'))}" style="color:${escapeHtml(String(task.iconColor || '#6BCB77'))};font-size:1.2rem"></i>
      <span style="font-weight:600;font-size:0.95rem">${escapeHtml(String(task.title || 'Task'))}</span>
      <span style="margin-left:auto;font-size:0.75rem;color:var(--muted)">${badges.length} tier${badges.length !== 1 ? 's' : ''}</span>
    </div>
    ${badges.map((badge, badgeIndex) => `<div style="margin-bottom:8px;padding:10px 12px;background:${badge.secret ? '#fdf4ff' : '#f9fafb'};border-radius:10px;border:1px solid ${badge.secret ? '#e9d5ff' : '#e5e7eb'}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <button data-task-badge-icon="${taskIndex}:${badgeIndex}" style="width:48px;height:44px;font-size:1.4rem;background:none;border:1px dashed #d1d5db;border-radius:8px;padding:2px;cursor:pointer;flex-shrink:0;line-height:1" type="button">${badge.icon || '<i class="ph-duotone ph-medal" style="color:#F59E0B"></i>'}</button>
        <input type="text" value="${escapeHtml(String(badge.name || ''))}" data-task-badge-name="${taskIndex}:${badgeIndex}" placeholder="Badge name" style="flex:1;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;font-size:0.9rem">
        <button data-task-badge-delete="${taskIndex}:${badgeIndex}" style="background:none;border:none;color:#EF4444;cursor:pointer;font-size:1.2rem;padding:4px;flex-shrink:0" type="button"><i class="ph-duotone ph-trash"></i></button>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:0.8rem;color:var(--muted);white-space:nowrap">Earn after</span>
          <input type="number" value="${Number(badge.count || 10)}" min="1" data-task-badge-count="${taskIndex}:${badgeIndex}" style="width:64px;border:1px solid #d1d5db;border-radius:8px;padding:6px 8px;font-size:0.9rem;text-align:center">
          <span style="font-size:0.8rem;color:var(--muted);white-space:nowrap">completions</span>
        </div>
        <button data-task-badge-secret="${taskIndex}:${badgeIndex}" style="margin-left:auto;background:${badge.secret ? '#ede9fe' : 'none'};border:1px solid ${badge.secret ? '#c4b5fd' : '#e5e7eb'};border-radius:8px;padding:7px 10px;cursor:pointer;display:flex;align-items:center;gap:5px;color:${badge.secret ? '#7c3aed' : '#9ca3af'}" type="button">
          <i class="ph-duotone ph-${badge.secret ? 'eye-slash' : 'eye'}" style="font-size:1.1rem"></i>${badge.secret ? `<span style="font-size:0.78rem;font-weight:600">Secret</span>` : ''}
        </button>
      </div>
    </div>`).join('')}
    ${badges.length < 5 ? `<button class="btn btn-secondary btn-sm" data-task-badge-add="${taskIndex}" type="button">+ Add Badge Tier</button>` : ''}
    ${badges.length === 0 ? `<div style="height:16px"></div>` : ''}
  </div>`;
}

export function getLevels(settings: DemoFamilySettings): Array<{ level?: number; name?: string; icon?: string; minXp?: number }> {
  return Array.isArray(settings.customLevels) && settings.customLevels.length >= 2 ? settings.customLevels : DEFAULT_LEVELS;
}

export function getBaseBadgeDef(settings: DemoFamilySettings, id: string): { icon: string; name: string; desc: string } {
  const base = BADGE_DEFS.find(badge => badge.id === id) || BADGE_DEFS[0];
  const custom = settings.customBadgeDefs?.[id] || {};
  return { ...base, ...custom };
}
