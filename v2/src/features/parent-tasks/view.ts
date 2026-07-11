import { type DemoAppState, type DemoTask } from '../../app/local-demo-state';
import { escapeHtml } from '../../ui/html';

export type ParentTaskEditorDraft = {
  id: string;
  title: string;
  icon: string;
  iconColor: string;
  gems: number;
  assignedTo: string[];
  photoMode: string;
  description: string;
};

const TASK_ICON_OPTIONS = ['broom', 'tooth', 'bed', 'dog', 't-shirt', 'backpack', 'book-open-text', 'sparkle', 'fork-knife', 'bathtub'];
const TASK_COLOR_OPTIONS = ['#6BCB77', '#F59E0B', '#45B7D1', '#6C63FF', '#FF6584', '#1D6B57', '#EF4444', '#A78BFA'];

export function renderParentTasks(state: DemoAppState): string {
  return `
    <section data-motion-key="tasks-list">
      <div class="section-row">
        <span class="section-title"><i class="ph-duotone ph-clipboard-text" style="color:#9CA3AF;font-size:1rem;vertical-align:middle"></i> All Tasks (${state.tasks.length})</span>
        <button class="btn btn-primary btn-sm" data-task-create type="button">+ Add</button>
      </div>
      ${state.tasks.length
        ? `<div class="parent-chore-list">${state.tasks.map(renderTaskCard).join('')}</div>`
        : `<div class="empty-state"><div class="empty-icon"><i class="ph-duotone ph-clipboard-text" style="color:#9CA3AF;font-size:3rem"></i></div><div class="empty-text">No tasks yet. Add one!</div></div>`}
    </section>
  `;
}

function renderTaskCard(task: DemoTask): string {
  const taskId = escapeHtml(String(task.id || ''));
  const swipeId = `parent_chore_${taskId}`;
  return `
    <div class="snapshot-routine-shell parent-chore-shell" data-swipe-id="${swipeId}">
      <div class="snapshot-routine-reveal snapshot-routine-reveal-secondary parent-chore-reveal">
        <button class="snapshot-reveal-btn snapshot-reveal-btn-danger parent-chore-reveal-btn" data-task-delete="${taskId}" type="button" title="Delete task">
          <i class="ph-duotone ph-trash"></i>
          <span>Delete</span>
        </button>
        <button class="snapshot-reveal-btn snapshot-reveal-btn-secondary parent-chore-reveal-btn" data-task-edit="${taskId}" type="button" title="Edit task">
          <i class="ph-duotone ph-pencil-simple"></i>
          <span>Edit</span>
        </button>
      </div>
      <div class="snapshot-routine-card parent-chore-card task-swipe-card">
        <div class="snapshot-routine-top">
          <div class="snapshot-routine-main">
            <div class="snapshot-routine-title-row">
              <div class="parent-chore-copy">
                <div class="snapshot-routine-title">${escapeHtml(String(task.title || 'Untitled task'))}</div>
                <div class="parent-chore-meta">${escapeHtml(parentChoreMetaSummary(task))}</div>
              </div>
              <div class="snapshot-routine-diamond-badge">
                <span class="snapshot-routine-glyph-main">${renderTaskIcon(task.icon, task.iconColor)}</span>
                <span class="snapshot-routine-glyph-badge">${Number(task.gems ?? task.diamonds ?? 0)}</span>
              </div>
              <div class="snapshot-routine-utility">
                <button class="snapshot-routine-swipe-hint" data-task-swipe-hint="${swipeId}" type="button" aria-label="Reveal actions">
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

function renderTaskIcon(icon: string | undefined, color: string | undefined): string {
  return `<i class="ph-duotone ph-${escapeHtml(String(icon || 'broom'))}" style="color:${escapeHtml(String(color || '#6BCB77'))}"></i>`;
}

function formatDaysOfWeek(daysOfWeek: number[] | undefined): string {
  if (!Array.isArray(daysOfWeek) || !daysOfWeek.length) return 'no days selected';
  if (daysOfWeek.length === 7) return 'every day';
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return daysOfWeek.map(day => labels[day] || '').filter(Boolean).join(', ');
}

function parentChoreMetaSummary(task: DemoTask): string {
  const schedule = task.schedule || {};
  if (schedule.period === 'once') return 'one-time';
  const slotCount = Array.isArray(schedule.slots) ? schedule.slots.length : 0;
  const countLabel = slotCount > 0
    ? `${slotCount}x per day`
    : schedule.period === 'week'
      ? `${Number(schedule.targetCount || 1)}x per week`
      : `${Number(schedule.targetCount || 1)}x per day`;
  return `${countLabel}\n${formatDaysOfWeek(schedule.daysOfWeek)}`;
}

export function createTaskEditorDraft(task: DemoTask | null): ParentTaskEditorDraft {
  return {
    id: String(task?.id || ''),
    title: String(task?.title || ''),
    icon: String(task?.icon || 'broom'),
    iconColor: String(task?.iconColor || '#6BCB77'),
    gems: Math.max(1, Number(task?.gems ?? task?.diamonds ?? 5) || 5),
    assignedTo: Array.isArray(task?.assignedTo) ? [...task.assignedTo] : [],
    photoMode: String(task?.photoMode || 'none'),
    description: String(task?.description || ''),
  };
}

export function renderTaskEditorModal(state: DemoAppState, draft: ParentTaskEditorDraft, mode: 'create' | 'edit'): string {
  const kids = state.members.filter(member => member.role === 'kid');
  return `
    <button class="modal-close-x" data-close-modal type="button" aria-label="Close">
      <i class="ph-duotone ph-x"></i>
    </button>
    <div class="form-group">
      <label class="form-label">Task name</label>
      <input type="text" id="task-title" value="${escapeHtml(draft.title)}" placeholder="e.g. Brush Teeth">
    </div>
    <div class="form-group">
      <div class="icon-color-row">${TASK_COLOR_OPTIONS.map(color => `<button class="icon-color-swatch${color === draft.iconColor ? ' sel' : ''}" data-task-color="${color}" type="button" style="background:${color}"></button>`).join('')}</div>
      <div class="icon-picker" id="task-icon-grid" style="color:${escapeHtml(draft.iconColor)}">${TASK_ICON_OPTIONS.map(icon => `<button class="icon-opt${icon === draft.icon ? ' sel' : ''}" data-task-icon="${icon}" data-icon="${icon}" type="button"><i class="ph-duotone ph-${icon}"></i></button>`).join('')}</div>
    </div>
    <div class="input-row">
      <div class="form-group mb-0">
        <label class="form-label">Gems</label>
        <input type="number" id="task-gems" min="1" max="500" value="${draft.gems}">
      </div>
      <div class="form-group mb-0">
        <label class="form-label">Photo requirement</label>
        <select id="task-photo-mode">
          <option value="none" ${draft.photoMode === 'none' ? 'selected' : ''}>No photo needed</option>
          <option value="after" ${draft.photoMode === 'after' ? 'selected' : ''}>Completion photo</option>
          <option value="before_after" ${draft.photoMode === 'before_after' ? 'selected' : ''}>Before + after</option>
        </select>
      </div>
    </div>
    ${kids.length ? `<div class="form-group"><label class="form-label">Assign to</label>${kids.map(kid => `
      <label class="chore-checkbox-row">
        <input type="checkbox" value="${escapeHtml(String(kid.id || ''))}" ${draft.assignedTo.includes(String(kid.id || '')) ? 'checked' : ''} data-task-assign>
        <span class="chore-checkbox-icon">${renderMemberAvatar(kid.avatar, kid.color)}</span>
        <span class="chore-checkbox-label">${escapeHtml(String(kid.name || 'Kid'))}</span>
      </label>`).join('')}</div>` : ''}
    <div class="form-group">
      <label class="form-label">Description <span class="form-label-hint">optional</span></label>
      <textarea id="task-description" placeholder="Any instructions...">${escapeHtml(draft.description)}</textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" data-close-modal type="button">Cancel</button>
      <button class="btn btn-primary" data-task-save="${mode}" type="button">Save <i class="ph-duotone ph-check-circle" style="font-size:0.95rem;vertical-align:middle"></i></button>
    </div>
  `;
}

export function renderTaskDeleteModal(task: DemoTask): string {
  return `
    <button class="modal-close-x" data-close-modal type="button" aria-label="Close">
      <i class="ph-duotone ph-x"></i>
    </button>
    <div class="confirm-sheet">
      <div class="confirm-sheet-icon"><i class="ph-duotone ph-trash"></i></div>
      <div class="confirm-sheet-title">Delete task?</div>
      <div class="confirm-sheet-copy">"${escapeHtml(String(task.title || 'This task'))}" will be permanently deleted.</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-close-modal type="button">Cancel</button>
        <button class="btn btn-danger" data-task-confirm-delete="${escapeHtml(String(task.id || ''))}" type="button">Delete</button>
      </div>
    </div>
  `;
}

function renderMemberAvatar(avatar: string | undefined, color: string | undefined): string {
  const icon = String(avatar || 'smiley');
  return `<i class="ph-duotone ph-${escapeHtml(icon.replace(/^ph-/, ''))}" style="color:${escapeHtml(String(color || '#6BCB77'))}"></i>`;
}
