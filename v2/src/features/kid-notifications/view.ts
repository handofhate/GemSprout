import { type AppState, type AppHistoryRow, type AppMember } from '../../app/app-state';
import { escapeHtml } from '../../ui/html';

type KidNotification = {
  id: string;
  kind: string;
  icon: string;
  title: string;
  sub: string;
  gems?: number;
  dollars?: number;
  currency?: string;
  badgeIcon?: string;
  rainType?: 'confetti' | 'badge' | 'dollar' | 'none';
  buttonLabel?: string;
  noAnimation?: boolean;
  tts?: string;
  createdAt?: number;
};

type KidNotificationOptions = {
  onClose?: () => void;
  speak?: (text: string) => void;
};

const SEEN_PREFIX = 'gemsprout.v2.kidNotificationSeen';
const sessionStartedAt = Date.now();
const queuedIds = new Set<string>();
const queue: Array<{ item: KidNotification; options: KidNotificationOptions }> = [];
let active = false;

export function reconcileKidNotificationModals(state: AppState, member: AppMember, options: KidNotificationOptions = {}): void {
  if (!member.id || member.role !== 'kid') return;
  const items = buildKidNotifications(state, member);
  const seen = readSeenIds(member.id);
  if (!hasSeenBaseline(member.id)) {
    items.filter(item => Number(item.createdAt || 0) < sessionStartedAt).forEach(item => seen.add(item.id));
    writeSeenIds(member.id, seen);
    markSeenBaseline(member.id);
  }
  const unseen = items.filter(item => !seen.has(item.id) && !queuedIds.has(item.id));
  if (!unseen.length) return;
  unseen.forEach(item => {
    seen.add(item.id);
    queuedIds.add(item.id);
    queue.push({ item, options });
  });
  writeSeenIds(member.id, seen);
  drainQueue();
}

function buildKidNotifications(state: AppState, member: AppMember): KidNotification[] {
  const rows = state.historyRows
    .filter(row => row.memberId === member.id && row.id)
    .sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
  return rows.flatMap(row => notificationFromHistory(row, state, member)).filter(Boolean);
}

function notificationFromHistory(row: AppHistoryRow, state: AppState, member: AppMember): KidNotification[] {
  const whileAway = Number(row.createdAt || 0) < sessionStartedAt;
  const titlePrefix = whileAway ? '<i class="ph-duotone ph-moon-stars" style="color:#7C3AED"></i> While you were away...' : '';
  const type = String(row.type || '');
  if (type === 'chore' && Number(row.gems || 0) > 0) {
    return [{
      id: String(row.id),
      kind: 'task-approved',
      icon: iconForTask(row, state),
      title: titlePrefix || '<i class="ph-duotone ph-check-circle" style="color:#16A34A"></i> Task Approved!',
      sub: `"${String(row.title || 'Task')}" approved!`,
      gems: Number(row.gems || 0),
      rainType: 'confetti',
      tts: isLittleKid(member) ? `Your grown-up approved your task. You earned ${Number(row.gems || 0)} gems!` : undefined,
      createdAt: Number(row.createdAt || 0),
    }];
  }
  if (type === 'bonus' && Number(row.gems || 0) > 0 && row.title !== 'Daily Combo Bonus!') {
    return [{
      id: String(row.id),
      kind: 'bonus',
      icon: '<i class="ph-duotone ph-star" style="color:#F59E0B;font-size:3rem"></i>',
      title: titlePrefix || '<i class="ph-duotone ph-sparkle" style="color:#7C3AED"></i> Bonus Gems!',
      sub: String(row.title || 'Bonus gems'),
      gems: Number(row.gems || 0),
      rainType: 'confetti',
      tts: isLittleKid(member) ? `You got ${Number(row.gems || 0)} bonus gems!` : undefined,
      createdAt: Number(row.createdAt || 0),
    }];
  }
  if (type === 'savings_deposit' && Number(row.amount || 0) > 0) {
    const currency = state.settings.currency || '$';
    return [{
      id: String(row.id),
      kind: 'savings-deposit',
      icon: '<i class="ph-duotone ph-piggy-bank" style="color:#16A34A;font-size:3rem"></i>',
      title: titlePrefix || '<i class="ph-duotone ph-piggy-bank" style="color:#16A34A"></i> Savings Deposit!',
      sub: String(row.title || 'Savings deposit'),
      dollars: Number(row.amount || 0),
      currency,
      rainType: 'dollar',
      tts: isLittleKid(member) ? `Your savings went up ${currency}${Number(row.amount || 0).toFixed(2)}.` : undefined,
      createdAt: Number(row.createdAt || 0),
    }];
  }
  if (type === 'savings_withdraw') {
    if (!row.requestId && !row.metadata?.approvedByMemberId) return [];
    const amount = Number(row.amount || 0);
    const currency = state.settings.currency || '$';
    return [{
      id: String(row.id),
      kind: 'spend-approved',
      icon: '<i class="ph-duotone ph-shopping-bag" style="color:#16A34A;font-size:3rem"></i>',
      title: titlePrefix || '<i class="ph-duotone ph-check-circle" style="color:#16A34A"></i> Spend Approved!',
      sub: `${String(row.title || 'Savings spend approved')}${amount > 0 ? ` for ${currency}${amount.toFixed(2)}` : ''}.`,
      noAnimation: true,
      tts: isLittleKid(member) && amount > 0 ? `Your grown-up said yes. You can spend ${currency}${amount.toFixed(2)}.` : undefined,
      createdAt: Number(row.createdAt || 0),
    }];
  }
  if (type === 'prize') {
    if (!row.requestId && !row.metadata?.approvedByMemberId) return [];
    return [{
      id: String(row.id),
      kind: 'prize-approved',
      icon: '<i class="ph-duotone ph-gift" style="color:#16A34A;font-size:3rem"></i>',
      title: titlePrefix || '<i class="ph-duotone ph-check-circle" style="color:#16A34A"></i> Prize Approved!',
      sub: `"${String(row.title || 'Prize')}" approved!`,
      noAnimation: true,
      tts: isLittleKid(member) ? `Your grown-up said yes to ${String(row.title || 'your prize')}.` : undefined,
      createdAt: Number(row.createdAt || 0),
    }];
  }
  if (type === 'request_denied') {
    return [{
      id: String(row.id),
      kind: 'request-denied',
      icon: deniedIcon(row),
      title: titlePrefix || deniedTitle(row),
      sub: deniedSub(row),
      buttonLabel: 'OK',
      noAnimation: true,
      tts: isLittleKid(member) ? 'Your grown-up said not right now.' : undefined,
      createdAt: Number(row.createdAt || 0),
    }];
  }
  if (type === 'badge') {
    const badgeIcon = String(row.metadata?.badgeIcon || '<i class="ph-duotone ph-medal" style="color:#7C3AED"></i>');
    const choreTitle = String(row.metadata?.choreTitle || '');
    const reasonLine = choreTitle ? `${String(row.title || 'Badge')} for "${choreTitle}"` : `${String(row.title || 'Badge')} unlocked`;
    return [{
      id: String(row.id),
      kind: 'badge',
      icon: resizeIcon(badgeIcon, '3rem'),
      title: titlePrefix || '<i class="ph-duotone ph-medal" style="color:#7C3AED"></i> New Badge!',
      sub: reasonLine,
      badgeIcon,
      rainType: 'badge',
      tts: isLittleKid(member) ? `You earned a new badge. ${reasonLine}.` : undefined,
      createdAt: Number(row.createdAt || 0),
    }];
  }
  return [];
}

function drainQueue(): void {
  if (active || !queue.length) return;
  const next = queue.shift();
  if (!next) return;
  active = true;
  showNotification(next.item, next.options);
}

function showNotification(item: KidNotification, options: KidNotificationOptions): void {
  const root = document.getElementById('celebration-root');
  if (!root) {
    active = false;
    return;
  }
  const hasReward = Number(item.gems || 0) > 0 || Number(item.dollars || 0) > 0;
  const remaining = queue.length;
  root.innerHTML = `
    <div class="celebration-overlay kid-notification-overlay">
      ${item.rainType !== 'none' && !item.noAnimation ? '<div class="celebration-rain-layer" data-kid-notification-rain></div>' : ''}
      <div class="celebration-box kid-notification-box">
        <div class="cel-icon">${item.icon}</div>
        <div class="cel-title">${item.title}</div>
        <div class="cel-sub">${escapeHtml(item.sub)}</div>
        ${item.gems ? `<div class="cel-diamonds">+${item.gems} gems</div>` : ''}
        ${item.dollars ? `<div class="cel-diamonds" style="color:#16A34A">+${escapeHtml(item.currency || '$')}${item.dollars.toFixed(2)}</div>` : ''}
        ${remaining > 0 ? `<div style="font-size:0.78rem;color:var(--muted);margin-top:8px">${remaining} more notification${remaining > 1 ? 's' : ''} waiting...</div>` : ''}
        <button class="btn btn-primary btn-full" data-kid-notification-next type="button">${escapeHtml(item.buttonLabel || 'Yay!')} <i class="ph-duotone ph-confetti" style="font-size:1rem;vertical-align:middle"></i></button>
        ${remaining > 0 ? '<button class="btn btn-secondary btn-full" style="margin-top:10px" data-kid-notification-dismiss-all type="button">Dismiss All</button>' : ''}
      </div>
    </div>`;
  const rainRoot = root.querySelector<HTMLElement>('[data-kid-notification-rain]');
  if (rainRoot) {
    if (item.rainType === 'badge') launchBadgeRain(item.badgeIcon || item.icon, 110, rainRoot);
    else if (item.rainType === 'dollar') launchDollarRain(160, rainRoot);
    else if (hasReward) launchConfetti(100, rainRoot);
  }
  if (item.tts) options.speak?.(item.tts);
  const closeCurrent = () => {
    root.innerHTML = '';
    queuedIds.delete(item.id);
    active = false;
    options.onClose?.();
  };
  root.querySelector<HTMLElement>('[data-kid-notification-next]')?.addEventListener('click', () => {
    closeCurrent();
    drainQueue();
  });
  root.querySelector<HTMLElement>('[data-kid-notification-dismiss-all]')?.addEventListener('click', () => {
    queue.splice(0).forEach(entry => queuedIds.delete(entry.item.id));
    closeCurrent();
  });
}

function launchConfetti(count: number, root: HTMLElement): void {
  launchRain(({ index, size }) => {
    const piece = document.createElement('div');
    const icons = [
      '<i class="ph-duotone ph-sketch-logo" style="color:#1D6B57"></i>',
      '<i class="ph-duotone ph-star" style="color:#F59E0B"></i>',
      '<i class="ph-duotone ph-confetti" style="color:#F97316"></i>',
      '<i class="ph-duotone ph-sparkle" style="color:#7C3AED"></i>',
    ];
    piece.innerHTML = icons[index % icons.length];
    piece.style.cssText = `font-size:${Math.max(1, size / 20).toFixed(2)}rem;line-height:1;`;
    return piece;
  }, count, root, { minSize: 20, maxSize: 50, minDuration: 1.5, durationRange: 2.3, maxDelay: 1.4 });
}

function launchBadgeRain(iconHtml: string, count: number, root: HTMLElement): void {
  launchRain(({ size }) => {
    const piece = document.createElement('div');
    piece.innerHTML = resizeIcon(iconHtml, `${Math.max(1, size / 20).toFixed(2)}rem`);
    piece.style.cssText = 'line-height:1;';
    return piece;
  }, count, root, { minSize: 20, maxSize: 48, minDuration: 1.5, durationRange: 2, maxDelay: 1.6 });
}

function launchDollarRain(count: number, root: HTMLElement): void {
  launchRain(({ index, size }) => {
    const piece = document.createElement('div');
    piece.innerHTML = index % 2 === 0
      ? '<i class="ph-duotone ph-money-wavy" style="color:#16A34A"></i>'
      : '<i class="ph-duotone ph-currency-circle-dollar" style="color:#E8C76A"></i>';
    piece.style.cssText = `font-size:${Math.max(1, size / 18).toFixed(2)}rem;line-height:1;`;
    return piece;
  }, count, root, { minSize: 18, maxSize: 52, minDuration: 1.4, durationRange: 2, maxDelay: 1.4 });
}

function launchRain(
  factory: (input: { index: number; size: number }) => HTMLElement,
  count: number,
  root: HTMLElement,
  options: { minSize: number; maxSize: number; minDuration: number; durationRange: number; maxDelay: number },
): void {
  const batchId = `${Date.now()}-${Math.random()}`;
  for (let index = 0; index < count; index += 1) {
    const size = options.minSize + Math.random() * Math.max(0, options.maxSize - options.minSize);
    const drift = -18 + Math.random() * 36;
    const rotateStart = -35 + Math.random() * 70;
    const rotateEnd = rotateStart + (Math.random() > 0.5 ? 1 : -1) * (80 + Math.random() * 180);
    const piece = factory({ index, size });
    piece.dataset.batch = batchId;
    piece.classList.add('gem-rain-piece');
    piece.style.cssText = `
      ${piece.style.cssText || ''};
      left:${Math.random() * 110 - 5}%;
      animation-duration:${options.minDuration + Math.random() * options.durationRange}s;
      animation-delay:${Math.random() * options.maxDelay}s;
      opacity:${0.72 + Math.random() * 0.28};
      --rain-drift:${drift}px;
      --rain-rotate-start:${rotateStart}deg;
      --rain-rotate-end:${rotateEnd}deg;
    `;
    root.appendChild(piece);
  }
  window.setTimeout(() => {
    root.querySelectorAll(`[data-batch="${batchId}"]`).forEach(piece => piece.remove());
  }, 5000);
}

function iconForTask(row: AppHistoryRow, state: AppState): string {
  const taskId = String(row.metadata?.choreId || '');
  const task = taskId ? state.tasks.find(item => item.id === taskId) : null;
  const icon = String(task?.icon || 'confetti').replace(/^ph-/, '');
  const color = String(task?.iconColor || '#F97316');
  return `<i class="ph-duotone ph-${escapeHtml(icon)}" style="color:${escapeHtml(color)};font-size:3rem"></i>`;
}

function deniedTitle(row: AppHistoryRow): string {
  const kind = String(row.metadata?.kind || '');
  if (kind === 'savings_spend') return '<i class="ph-duotone ph-x-circle" style="color:#9CA3AF"></i> Not This Time';
  if (kind === 'prize_redeem') return '<i class="ph-duotone ph-x-circle" style="color:#9CA3AF"></i> Prize Not Approved';
  return '<i class="ph-duotone ph-x-circle" style="color:#EF4444"></i> Task Declined';
}

function deniedSub(row: AppHistoryRow): string {
  const kind = String(row.metadata?.kind || '');
  const title = String(row.title || 'Request');
  if (kind === 'savings_spend') return `Your spend request for "${title}" was not approved.`;
  if (kind === 'prize_redeem') return `"${title}" was not approved.`;
  return `"${title}" was declined.`;
}

function deniedIcon(row: AppHistoryRow): string {
  const kind = String(row.metadata?.kind || '');
  if (kind === 'savings_spend') return '<i class="ph-duotone ph-smiley-sad" style="color:#9CA3AF;font-size:3rem"></i>';
  if (kind === 'prize_redeem') return '<i class="ph-duotone ph-gift" style="color:#9CA3AF;font-size:3rem"></i>';
  return '<i class="ph-duotone ph-x-circle" style="color:#EF4444;font-size:3rem"></i>';
}

function resizeIcon(icon: string, size: string): string {
  if (!icon.includes('<')) return `<span style="font-size:${size}">${escapeHtml(icon)}</span>`;
  return icon.includes('font-size:')
    ? icon.replace(/font-size:[^;'"]+/g, `font-size:${size}`)
    : icon.replace(/style="/, `style="font-size:${size};`);
}

function isLittleKid(member: AppMember): boolean {
  return member.displayMode === 'tiny' || member.mode === 'tiny';
}

function seenKey(memberId: string): string {
  return `${SEEN_PREFIX}.${memberId}`;
}

function baselineKey(memberId: string): string {
  return `${seenKey(memberId)}.baseline`;
}

function readSeenIds(memberId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(seenKey(memberId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function writeSeenIds(memberId: string, ids: Set<string>): void {
  try {
    window.localStorage.setItem(seenKey(memberId), JSON.stringify([...ids].slice(-250)));
  } catch {}
}

function hasSeenBaseline(memberId: string): boolean {
  try {
    return window.localStorage.getItem(baselineKey(memberId)) === '1';
  } catch {
    return true;
  }
}

function markSeenBaseline(memberId: string): void {
  try {
    window.localStorage.setItem(baselineKey(memberId), '1');
  } catch {}
}
