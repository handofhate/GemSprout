import { type DemoAppState, type DemoPrize, type DemoTask, type DemoTeamGoal } from '../../app/local-demo-state';
import { escapeHtml } from '../../ui/html';

export type ParentPrizeEditorDraft = {
  id: string;
  title: string;
  icon: string;
  iconColor: string;
  cost: number;
  recurrence: string;
  requireParentApproval: boolean;
  requirementEnabled: boolean;
  requirementType: string;
  requirementTaskCount: number;
  requirementTaskIds: string[];
};

export type ParentGoalEditorDraft = {
  id: string;
  title: string;
  icon: string;
  iconColor: string;
  targetPoints: number;
};

const ICON_OPTIONS = ['gift', 'popcorn', 'game-controller', 'ice-cream', 'pizza', 'moon-stars', 'trophy', 'sparkle', 'confetti', 'star'];
const COLOR_OPTIONS = ['#FF6584', '#6C63FF', '#FFD93D', '#45B7D1', '#6BCB77', '#F59E0B', '#1D6B57', '#EF4444'];

export function renderParentPrizes(state: DemoAppState): string {
  const prizes = state.prizes.filter(prize => (prize.type || 'individual') === 'individual');
  const goals = state.teamGoals;
  return `
    <section data-motion-key="prizes-list">
      <div class="section-row">
        <span class="section-title"><i class="ph-duotone ph-gift" style="color:#FF6584;font-size:1rem;vertical-align:middle"></i> My Prizes (${prizes.length})</span>
        <button class="btn btn-primary btn-sm" data-prize-create type="button">+ Add</button>
      </div>
      ${prizes.length ? `<div class="parent-prize-list">${prizes.map(renderPrizeCard).join('')}</div>` : `<div class="empty-state"><div class="empty-icon"><i class="ph-duotone ph-gift" style="color:#FF6584;font-size:3rem"></i></div><div class="empty-text">No prizes yet. Add one!</div></div>`}
      <div style="height:14px"></div>
      <div class="section-row">
        <span class="section-title"><i class="ph-duotone ph-trophy" style="color:#D97706;font-size:1rem;vertical-align:middle"></i> Team Prizes (${goals.length})</span>
        <button class="btn btn-teal btn-sm" data-goal-create type="button">+ Add</button>
      </div>
      ${goals.length ? `<div class="parent-prize-list">${goals.map(renderGoalCard).join('')}</div>` : `<div class="empty-state" style="padding:20px"><div class="empty-icon"><i class="ph-duotone ph-trophy" style="color:#D97706;font-size:3rem"></i></div><div class="empty-text">No team prizes yet</div></div>`}
    </section>
  `;
}

function renderPrizeCard(prize: DemoPrize): string {
  const oneTimeRedeemed = prize.recurrence === 'one_time' && Array.isArray(prize.redemptions) && prize.redemptions.length > 0;
  const redeemedByCount = Math.max(1, new Set((prize.redemptions || []).map(item => item.memberId).filter(Boolean)).size || 0);
  const requirementSummary = getPrizeRequirementSummary(prize);
  const recurrenceLabel = formatPrizeRecurrence(prize.recurrence);
  const prizeId = escapeHtml(String(prize.id || ''));
  const swipeId = `parent_prize_${prizeId}`;
  return `
    <div class="snapshot-routine-shell parent-prize-shell" data-swipe-id="${swipeId}">
      <div class="snapshot-routine-reveal snapshot-routine-reveal-secondary parent-prize-reveal ${oneTimeRedeemed ? 'has-reset' : ''}">
        <button class="snapshot-reveal-btn snapshot-reveal-btn-danger parent-prize-reveal-btn" data-prize-delete="${prizeId}" type="button" title="Delete prize">
          <i class="ph-duotone ph-trash"></i>
          <span>Delete</span>
        </button>
        ${oneTimeRedeemed ? `<button class="snapshot-reveal-btn snapshot-reveal-btn-approve parent-prize-reveal-btn" data-prize-reset="${prizeId}" type="button" title="Reset prize">
          <i class="ph-duotone ph-arrow-counter-clockwise"></i>
          <span>Reset</span>
        </button>` : ''}
        <button class="snapshot-reveal-btn snapshot-reveal-btn-secondary parent-prize-reveal-btn" data-prize-edit="${prizeId}" type="button" title="Edit prize">
          <i class="ph-duotone ph-pencil-simple"></i>
          <span>Edit</span>
        </button>
      </div>
      <div class="snapshot-routine-card parent-prize-card ${oneTimeRedeemed ? 'one-time-redeemed' : ''} prize-swipe-card">
        <div class="snapshot-routine-top">
          <div class="snapshot-routine-main">
            <div class="snapshot-routine-title-row">
              <div class="parent-chore-copy">
                <div class="snapshot-routine-title">${escapeHtml(String(prize.title || 'Untitled prize'))}</div>
                <div class="parent-chore-meta">${escapeHtml(recurrenceLabel)}${requirementSummary ? `\n${escapeHtml(requirementSummary)}` : ''}${oneTimeRedeemed ? `\nRedeemed by ${redeemedByCount} kid${redeemedByCount === 1 ? '' : 's'} - reset to make available again` : ''}</div>
              </div>
              <div class="snapshot-routine-diamond-badge">
                <span class="snapshot-routine-glyph-main">${renderIcon(prize.icon, prize.iconColor)}</span>
                <span class="snapshot-routine-glyph-badge">${Number(prize.cost || 0)}</span>
              </div>
              <div class="snapshot-routine-utility">
                <button class="snapshot-routine-swipe-hint" data-prize-swipe-hint="${swipeId}" type="button" aria-label="Reveal actions">
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

function renderGoalCard(goal: DemoTeamGoal): string {
  const total = goalTotal(goal);
  const target = Number(goal.targetPoints || 0);
  const pct = Math.min(100, Math.round(total / Math.max(1, target) * 100));
  const isComplete = target > 0 && total >= target;
  const goalId = escapeHtml(String(goal.id || ''));
  const swipeId = `team_prize_${goalId}`;
  return `
    <div class="snapshot-routine-shell parent-prize-shell" data-swipe-id="${swipeId}">
      <div class="snapshot-routine-reveal snapshot-routine-reveal-secondary parent-prize-reveal ${isComplete ? 'has-reset' : ''}">
        <button class="snapshot-reveal-btn snapshot-reveal-btn-danger parent-prize-reveal-btn" data-goal-delete="${goalId}" type="button" title="Delete team prize">
          <i class="ph-duotone ph-trash"></i>
          <span>Delete</span>
        </button>
        ${isComplete ? `<button class="snapshot-reveal-btn snapshot-reveal-btn-approve parent-prize-reveal-btn" data-goal-reset="${goalId}" type="button" title="Reset team prize">
          <i class="ph-duotone ph-arrow-counter-clockwise"></i>
          <span>Reset</span>
        </button>` : ''}
        <button class="snapshot-reveal-btn snapshot-reveal-btn-secondary parent-prize-reveal-btn" data-goal-edit="${goalId}" type="button" title="Edit team prize">
          <i class="ph-duotone ph-pencil-simple"></i>
          <span>Edit</span>
        </button>
      </div>
      <div class="snapshot-routine-card parent-prize-card prize-swipe-card">
        <div class="snapshot-routine-top">
          <div class="snapshot-routine-main">
            <div class="snapshot-routine-title-row">
              <div class="parent-chore-copy">
                <div class="snapshot-routine-title">${escapeHtml(String(goal.title || 'Untitled team prize'))}</div>
                <div class="parent-chore-meta">${escapeHtml(`${total} / ${target} gems\n${pct}% complete`)}${isComplete ? '\nFully funded - reset to start again' : ''}</div>
              </div>
              <div class="snapshot-routine-diamond-badge">
                <span class="snapshot-routine-glyph-main">${renderIcon(goal.icon, goal.iconColor)}</span>
                <span class="snapshot-routine-glyph-badge">${target}</span>
              </div>
              <div class="snapshot-routine-utility">
                <button class="snapshot-routine-swipe-hint" data-prize-swipe-hint="${swipeId}" type="button" aria-label="Reveal actions">
                  <i class="ph-duotone ph-caret-double-left"></i>
                </button>
              </div>
            </div>
            <div class="progress-wrap parent-prize-progress">
              <div class="progress-fill teal" style="width:${pct}%"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function createPrizeEditorDraft(prize: DemoPrize | null): ParentPrizeEditorDraft {
  return {
    id: String(prize?.id || ''),
    title: String(prize?.title || ''),
    icon: String(prize?.icon || 'gift'),
    iconColor: String(prize?.iconColor || '#FF6584'),
    cost: Math.max(0, Number(prize?.cost || 100) || 100),
    recurrence: String(prize?.recurrence || 'anytime'),
    requireParentApproval: !!prize?.requireParentApproval,
    requirementEnabled: String(prize?.requirementType || 'none') !== 'none',
    requirementType: String(prize?.requirementType || 'task_count'),
    requirementTaskCount: Math.max(1, Number(prize?.requirementTaskCount || 1) || 1),
    requirementTaskIds: Array.isArray(prize?.requirementTaskIds) ? [...prize.requirementTaskIds] : [],
  };
}

export function createGoalEditorDraft(goal: DemoTeamGoal | null): ParentGoalEditorDraft {
  return {
    id: String(goal?.id || ''),
    title: String(goal?.title || ''),
    icon: String(goal?.icon || 'trophy'),
    iconColor: String(goal?.iconColor || '#FFD93D'),
    targetPoints: Math.max(1, Number(goal?.targetPoints || 500) || 500),
  };
}

export function renderPrizeEditorModal(state: DemoAppState, draft: ParentPrizeEditorDraft): string {
  const requirementTasks = renderTaskChecks(state.tasks, draft.requirementTaskIds);
  return `
    <button class="modal-close-x" data-close-modal type="button" aria-label="Close"><i class="ph-duotone ph-x"></i></button>
    <div class="form-group">
      <label class="form-label">Prize name</label>
      <input type="text" id="prize-title" value="${escapeHtml(draft.title)}" placeholder="e.g. Movie Night Pick">
    </div>
    <div class="form-group">
      <div class="icon-color-row">${COLOR_OPTIONS.map(color => `<button class="icon-color-swatch${color === draft.iconColor ? ' sel' : ''}" data-prize-color="${color}" type="button" style="background:${color}"></button>`).join('')}</div>
      <div class="icon-picker" id="prize-icon-grid" style="color:${escapeHtml(draft.iconColor)}">${ICON_OPTIONS.map(icon => `<button class="icon-opt${icon === draft.icon ? ' sel' : ''}" data-prize-icon="${icon}" type="button"><i class="ph-duotone ph-${icon}"></i></button>`).join('')}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Gems cost</label>
      <input type="number" id="prize-cost" min="0" value="${draft.cost}">
    </div>
    <div class="form-group">
      <label class="form-label">Redemption frequency</label>
      <select id="prize-recurrence">
        ${['one_time', 'anytime', 'daily', 'weekly', 'monthly'].map(value => `<option value="${value}" ${draft.recurrence === value ? 'selected' : ''}>${formatPrizeRecurrence(value)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" style="margin-top:-2px">
      <label style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <span>
          <div class="form-label" style="margin:0">Require parent approval</div>
          <div style="font-size:0.78rem;color:var(--muted);margin-top:2px">Prize will be submitted for approval by a parent</div>
        </span>
        <span class="toggle" style="flex-shrink:0"><input type="checkbox" id="prize-parent-approval" ${draft.requireParentApproval ? 'checked' : ''}><span class="toggle-track"></span></span>
      </label>
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;justify-content:space-between;gap:12px">
        <span>
          <div class="form-label" style="margin:0">Additional requirements</div>
          <div style="font-size:0.78rem;color:var(--muted);margin-top:2px">Add task-based requirements</div>
        </span>
        <span class="toggle" style="flex-shrink:0"><input type="checkbox" id="prize-requirement-enabled" ${draft.requirementEnabled ? 'checked' : ''}><span class="toggle-track"></span></span>
      </label>
      <div id="prize-requirement-fields" style="display:${draft.requirementEnabled ? 'block' : 'none'};margin-top:10px;padding:10px;border:1px solid #E5E7EB;border-radius:12px;background:#F8FAFC">
        <select id="prize-requirement-type">
          <option value="task_count" ${draft.requirementType === 'task_count' ? 'selected' : ''}>Total tasks completed</option>
          <option value="combo" ${draft.requirementType === 'combo' ? 'selected' : ''}>Daily Combo completed</option>
          <option value="specific_tasks" ${draft.requirementType === 'specific_tasks' ? 'selected' : ''}>Specific tasks completed</option>
        </select>
        <div id="prize-task-count-wrap" style="margin-top:8px;display:${draft.requirementType === 'task_count' ? 'block' : 'none'}">
          <input type="number" id="prize-task-count" min="1" value="${draft.requirementTaskCount}">
        </div>
        <div id="prize-specific-tasks-wrap" style="margin-top:8px;display:${draft.requirementType === 'specific_tasks' ? 'block' : 'none'}">
          <div style="font-size:0.78rem;color:var(--muted);margin-bottom:6px">Tasks required before this prize unlocks:</div>
          <div style="max-height:220px;overflow:auto;padding:2px 2px 0">${requirementTasks}</div>
        </div>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" data-close-modal type="button">Cancel</button>
      <button class="btn btn-primary" data-prize-save type="button">Save <i class="ph-duotone ph-check-circle" style="font-size:0.95rem;vertical-align:middle"></i></button>
    </div>
  `;
}

export function renderGoalEditorModal(draft: ParentGoalEditorDraft): string {
  return `
    <button class="modal-close-x" data-close-modal type="button" aria-label="Close"><i class="ph-duotone ph-x"></i></button>
    <div class="form-group">
      <label class="form-label">Prize name</label>
      <input type="text" id="goal-title" value="${escapeHtml(draft.title)}" placeholder="e.g. Disney Trip!">
    </div>
    <div class="form-group">
      <div class="icon-color-row">${COLOR_OPTIONS.map(color => `<button class="icon-color-swatch${color === draft.iconColor ? ' sel' : ''}" data-goal-color="${color}" type="button" style="background:${color}"></button>`).join('')}</div>
      <div class="icon-picker" id="goal-icon-grid" style="color:${escapeHtml(draft.iconColor)}">${ICON_OPTIONS.map(icon => `<button class="icon-opt${icon === draft.icon ? ' sel' : ''}" data-goal-icon="${icon}" type="button"><i class="ph-duotone ph-${icon}"></i></button>`).join('')}</div>
    </div>
    <div class="form-group">
      <label class="form-label">Gems target</label>
      <input type="number" id="goal-target" min="1" value="${draft.targetPoints}">
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" data-close-modal type="button">Cancel</button>
      <button class="btn btn-teal" data-goal-save type="button">Save <i class="ph-duotone ph-check" style="font-size:0.95rem;vertical-align:middle"></i></button>
    </div>
  `;
}

export function renderPrizeDeleteModal(kind: 'prize' | 'goal', title: string): string {
  const label = kind === 'goal' ? 'team prize' : 'prize';
  return `
    <button class="modal-close-x" data-close-modal type="button" aria-label="Close"><i class="ph-duotone ph-x"></i></button>
    <div class="confirm-sheet">
      <div class="confirm-sheet-icon"><i class="ph-duotone ph-trash"></i></div>
      <div class="confirm-sheet-title">Delete ${label}?</div>
      <div class="confirm-sheet-copy">"${escapeHtml(title || `This ${label}`)}" will be permanently deleted.</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-close-modal type="button">Cancel</button>
        <button class="btn btn-danger" data-prize-delete-confirm="${kind}" type="button">Delete</button>
      </div>
    </div>
  `;
}

function renderTaskChecks(tasks: DemoTask[], selectedIds: string[]): string {
  const selected = new Set(selectedIds);
  if (!tasks.length) return `<div style="color:var(--muted);font-size:0.85rem;padding:6px 0">No tasks yet</div>`;
  return tasks.map(task => `
    <label class="chore-checkbox-row">
      <input type="checkbox" class="prize-task-check" value="${escapeHtml(String(task.id || ''))}" ${selected.has(String(task.id || '')) ? 'checked' : ''}>
      <span class="chore-checkbox-icon">${renderIcon(task.icon, task.iconColor)}</span>
      <span class="chore-checkbox-label">${escapeHtml(String(task.title || 'Task'))}</span>
    </label>
  `).join('');
}

function renderIcon(icon: string | undefined, color: string | undefined): string {
  return `<i class="ph-duotone ph-${escapeHtml(String(icon || 'gift'))}" style="color:${escapeHtml(String(color || '#FF6584'))}"></i>`;
}

export function goalTotal(goal: DemoTeamGoal | null | undefined): number {
  return Object.values(goal?.contributions || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function formatPrizeRecurrence(recurrence: string | undefined): string {
  if (recurrence === 'one_time') return 'Once';
  if (recurrence === 'daily') return 'Once per day';
  if (recurrence === 'weekly') return 'Once per week';
  if (recurrence === 'monthly') return 'Once per month';
  return 'Unlimited';
}

function getPrizeRequirementSummary(prize: DemoPrize): string {
  if (prize.requirementType === 'task_count') {
    const count = Math.max(1, Number(prize.requirementTaskCount || 1) || 1);
    return `Requires ${count} task${count === 1 ? '' : 's'} completed`;
  }
  if (prize.requirementType === 'combo') return 'Requires Daily Combo complete today';
  if (prize.requirementType === 'specific_tasks') {
    const count = Array.isArray(prize.requirementTaskIds) ? prize.requirementTaskIds.length : 0;
    return count > 0 ? `Requires ${count} specific task${count === 1 ? '' : 's'} today` : 'Requires specific tasks today';
  }
  return '';
}
