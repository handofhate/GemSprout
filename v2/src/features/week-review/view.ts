import { todayKeyForTimezone } from '../../app/date-keys';
import { type AppState, type AppHistoryRow, type AppMember } from '../../app/app-state';
import { escapeHtml } from '../../ui/html';

type WeekReviewSaved = { dollars: number; gems: number };
type WeekReviewBadgeDisplay = { name?: string; icon?: string };
type WeekReviewRow = {
  avatar?: string;
  name: string;
  stat?: string;
  statHtml?: string;
  sub?: string;
  hideAvatar?: boolean;
  badgesDisplay?: WeekReviewBadgeDisplay[];
  delay?: number;
  motionClass?: string;
};
type WeekReviewSlide = {
  type?: 'cover' | 'finale';
  gradient: string;
  label: string;
  icon: string;
  bigStat?: string;
  subStat?: string;
  dateRangeText?: string;
  coverMessage?: string;
  finaleIcon?: string;
  finaleHeadline?: string;
  finaleMessage?: string;
  rows: WeekReviewRow[];
  audioSrc?: string;
};
type WeekReviewStory = {
  state: AppState;
  slides: WeekReviewSlide[];
  index: number;
  timer: number | null;
  paused: boolean;
  remainingMs: number;
  slideMs: number;
  timingScale: number;
  slideStartedAt: number;
  audioSlideIndex: number;
  cardHeight?: number;
};

const WEEK_REVIEW_KEY = 'gemsprout.v2.weekReviewShown';
const WEEK_REVIEW_SLIDE_MS = 10000;
const WEEK_REVIEW_MESSAGE_INDEX_KEY = 'gemsprout.v2.wirMessageIndex';
const WEEK_REVIEW_MESSAGE_ORDER_KEY = 'gemsprout.v2.wirMessageOrder';
const WEEK_REVIEW_COVER_MESSAGES = [
  "What a week. Let's take a look at everything your family accomplished together.",
  "Another week of showing up. Your family put in the work - let's celebrate it.",
  "Big things happened in your family this week. Here's the recap.",
  "Savings, tasks, badges - your family had a full week. Let's see it.",
  "Every task completed, every gem earned. Your family brought it this week.",
  "Look at your family go. Here's everything you did together this week.",
  "Consistency is everything. Your family showed up again this week.",
  "It all adds up. Here's proof of what your family built this week.",
  "Week after week, your family keeps going. Let's look at this one.",
  "Hard work, good habits, and a little fun. Sounds like your week.",
  "Your family made moves this week. Here's the full picture.",
  "Tasks done, gems earned, savings growing. Let's take it all in.",
  "This is what effort looks like. Your family's week in numbers.",
  "Another week in the books. Your family should be proud.",
  "Small wins add up to big things. Here's your family's week.",
  "Your kids showed up this week. Let's celebrate that.",
  "A whole week of your family doing the thing. Here it is.",
  "Good habits are being built one week at a time. Here's this one.",
  "Your family put in real effort this week. Let's see what it added up to.",
  "This is the recap your family earned. Take a look.",
];

let story: WeekReviewStory | null = null;
let audio: HTMLAudioElement | null = null;
let audioPrimeToken = 0;
let press: { dir: 'prev' | 'next' | 'hold'; startedAt: number; suppressNav: boolean } | null = null;

export function renderWeekReviewLaunchCard(state: AppState): string {
  const kids = activeKids(state);
  const { start, end } = getWeekRange(state);
  const summary = buildWeekReviewSummary(state, start, end);
  return `
    <button class="snapshot-summary-card stats-launch-card stats-launch-card-family" data-week-review-open type="button" style="--stats-accent:#7C3AED">
      <div class="stats-launch-head">
        <div class="stats-launch-avatar stats-launch-avatar-family"><i class="ph-duotone ph-calendar-star" style="color:#7C3AED;font-size:2rem"></i></div>
        <div class="stats-launch-hero">
          <div class="stats-launch-name">Week in Review</div>
          <div class="stats-launch-sub">${escapeHtml(formatWeekReviewDateRange(start, end))}</div>
        </div>
      </div>
      <div class="stats-launch-spotlight-grid">
        <div class="stats-launch-spotlight">
          <div class="stats-launch-spotlight-value">${summary.totalGems}</div>
          <div class="stats-launch-spotlight-label">Gems earned last week</div>
        </div>
        <div class="stats-launch-spotlight">
          <div class="stats-launch-spotlight-value">${summary.totalTasks}</div>
          <div class="stats-launch-spotlight-label">Tasks completed last week</div>
        </div>
      </div>
      <div class="stats-launch-gridline">
        <span class="stats-launch-chip"><strong>${kids.length}</strong><small>Kids</small></span>
        <span class="stats-launch-chip"><strong>${summary.totalBadges}</strong><small>Badges</small></span>
        <span class="stats-launch-chip"><strong>${summary.savedLabel || '$0.00'}</strong><small>Saved</small></span>
      </div>
    </button>
  `;
}

export function bindWeekReviewLaunch(root: ParentNode, state: AppState): void {
  root.querySelector<HTMLElement>('[data-week-review-open]')?.addEventListener('click', () => showWeekReview(state));
}

export function showWeekReviewIfNeeded(state: AppState, delayMs = 1600): void {
  const today = todayKeyForTimezone(state.settings.familyTimezone || 'America/Phoenix');
  if (parseDateLocal(today).getDay() !== 0) return;
  if (!activeKids(state).length) return;
  try {
    if (window.localStorage.getItem(WEEK_REVIEW_KEY) === today) return;
    window.localStorage.setItem(WEEK_REVIEW_KEY, today);
  } catch {}
  window.setTimeout(() => showWeekReviewTeaser(state), delayMs);
}

export function showWeekReview(state: AppState): void {
  const kids = activeKids(state);
  if (!kids.length) return;
  const { start, end } = getWeekRange(state);
  const slides = buildWeekReviewSlides(state, start, end);
  if (!slides.length) return;
  assignWeekReviewAudio(slides, start);
  closeWeekReview();
  const overlay = document.createElement('div');
  overlay.id = 'week-review-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;overflow:hidden;-webkit-overflow-scrolling:touch';
  document.body.appendChild(overlay);
  const slideMs = WEEK_REVIEW_SLIDE_MS;
  story = {
    state,
    slides,
    index: 0,
    timer: null,
    paused: false,
    remainingMs: slideMs,
    slideMs,
    timingScale: timingScale(kids.length),
    slideStartedAt: 0,
    audioSlideIndex: -1,
  };
  primeAudio(slides[0]?.audioSrc);
  renderWeekReviewStory();
}

export function closeWeekReview(): void {
  if (story?.timer) window.clearTimeout(story.timer);
  stopAudio();
  story = null;
  document.getElementById('week-review-overlay')?.remove();
}

function showWeekReviewTeaser(state: AppState): void {
  const kids = activeKids(state);
  if (!kids.length) return;
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-overlay quick-modal-overlay" data-week-review-teaser-overlay>
      <div class="modal quick-action-modal quick-action-modal-wide modal-origin-sheet" role="dialog" aria-modal="true">
        <div style="text-align:center;padding:8px 0 4px">
          <i class="ph-duotone ph-calendar-star" style="color:#7C3AED;font-size:3rem"></i>
          <div class="modal-title" style="margin-top:10px">Your Week in Review is ready!</div>
          <p style="color:var(--muted);font-size:0.88rem;line-height:1.5;margin:8px 0 20px">
            See how ${escapeHtml(kids.length === 1 ? String(kids[0].name || 'your kid') : 'your family')} did this week - gems earned, tasks completed, badges unlocked, and more.
          </p>
          <button class="btn btn-primary btn-full" data-week-review-teaser-start type="button">Let's see it!</button>
          <button class="btn btn-secondary btn-full" style="margin-top:8px" data-week-review-teaser-close type="button">Maybe later</button>
          <div style="color:var(--muted);font-size:0.78rem;margin-top:14px">You can always find it on the Stats tab.</div>
        </div>
      </div>
    </div>`;
  const close = () => { root.innerHTML = ''; };
  root.querySelector<HTMLElement>('[data-week-review-teaser-overlay]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) close();
  });
  root.querySelector<HTMLElement>('[data-week-review-teaser-close]')?.addEventListener('click', close);
  root.querySelector<HTMLElement>('[data-week-review-teaser-start]')?.addEventListener('click', () => {
    close();
    showWeekReview(state);
  });
}

function buildWeekReviewSlides(state: AppState, start: string, end: string): WeekReviewSlide[] {
  const kids = activeKids(state);
  const weekRows = weekHistory(state, start, end);
  const choreRows = weekRows.filter(row => row.type === 'chore');
  const taskRows = choreRows.filter(row => !String(row.title || '').startsWith('Streak bonus ('));
  const bonusRows = weekRows.filter(row => row.type === 'bonus');
  const penaltyRows = weekRows.filter(row => row.type === 'penalty');
  const badgeRows = weekRows.filter(row => row.type === 'badge');
  const savingsRows = weekRows.filter(row => row.type === 'savings_deposit' || row.type === 'savings');
  const totalGems = sumGems(choreRows) + sumGems(bonusRows) - sumAbsGems(penaltyRows);
  const totalTasks = taskRows.length;
  const totalSaved = computeSavedTotals(savingsRows);
  const totalBadges = badgeRows.length;
  const taskCounts = countByTitle(taskRows);
  const topTask = Object.entries(taskCounts).sort((left, right) => right[1] - left[1])[0];
  const kidData = kids.map(kid => {
    const kidRows = (rows: AppHistoryRow[]) => rows.filter(row => row.memberId === kid.id);
    const kChores = kidRows(choreRows);
    const kTaskRows = kidRows(taskRows);
    const kBadges = kidRows(badgeRows);
    const kTaskCounts = countByTitle(kTaskRows);
    return {
      kid,
      gems: sumGems(kChores) + sumGems(kidRows(bonusRows)) - sumAbsGems(kidRows(penaltyRows)),
      tasks: kTaskRows.length,
      saved: computeSavedTotals(kidRows(savingsRows)),
      topTask: Object.entries(kTaskCounts).sort((left, right) => right[1] - left[1])[0],
      badges: kBadges,
    };
  });
  const currency = state.settings.currency || '$';
  const savingsOn = state.settings.savingsEnabled !== false;
  const dateRange = formatWeekReviewDateRange(start, end);
  const coverDateRange = formatWeekReviewDateRange(start, end, true);
  const slides: WeekReviewSlide[] = [{
    type: 'cover',
    gradient: 'linear-gradient(160deg,#3f6c5f 0%,#26443d 54%,#1b2f2a 100%)',
    label: 'Week in Review',
    icon: '<i class="ph-duotone ph-calendar-star" style="color:rgba(244,239,228,0.84);font-size:1rem"></i>',
    bigStat: coverDateRange,
    dateRangeText: dateRange,
    coverMessage: nextCoverMessage(),
    rows: [],
  }];
  if (totalGems > 0) {
    const savedLabel = savedLabelFor(totalSaved, currency);
    slides.push({
      gradient: 'linear-gradient(160deg,#2f7f88 0%,#1f5f6a 54%,#173f49 100%)',
      label: 'Gems Earned',
      icon: '<i class="ph-duotone ph-sketch-logo" style="color:rgba(244,239,228,0.82);font-size:0.9rem"></i>',
      bigStat: `${totalGems} gems`,
      subStat: `earned by the whole family${savingsOn && savedLabel ? ` - ${savedLabel} saved` : ''}`,
      rows: kidData.filter(row => row.gems > 0).map(row => ({
        avatar: renderWeekReviewAvatar(row.kid),
        name: String(row.kid.name || 'Kid'),
        stat: `${row.gems} gems`,
        sub: savingsOn ? savedLabelFor(row.saved, currency) ? `${savedLabelFor(row.saved, currency)} saved this week` : '' : '',
      })),
    });
  }
  if (totalTasks > 0) {
    slides.push({
      gradient: 'linear-gradient(160deg,#d59d4d 0%,#bd7440 58%,#8a5133 100%)',
      label: 'Tasks Completed',
      icon: '<i class="ph-duotone ph-check-circle" style="color:rgba(255,248,238,0.82);font-size:0.9rem"></i>',
      bigStat: `${totalTasks} tasks`,
      subStat: 'completed by the whole family',
      rows: kidData.filter(row => row.tasks > 0).map(row => ({
        avatar: renderWeekReviewAvatar(row.kid),
        name: String(row.kid.name || 'Kid'),
        stat: `${row.tasks} task${row.tasks === 1 ? '' : 's'}`,
      })),
    });
  }
  if (topTask) {
    slides.push({
      gradient: 'linear-gradient(160deg,#8b7d4f 0%,#6e633f 56%,#4c442e 100%)',
      label: 'Top Task of the Week',
      icon: '<i class="ph-duotone ph-star" style="color:rgba(251,248,239,0.82);font-size:0.9rem"></i>',
      bigStat: topTask[0],
      subStat: `completed ${topTask[1]} time${topTask[1] === 1 ? '' : 's'} as a family`,
      rows: kidData.filter(row => row.topTask).map(row => ({
        avatar: renderWeekReviewAvatar(row.kid),
        name: String(row.kid.name || 'Kid'),
        stat: row.topTask?.[0] || '',
        sub: timesLabel(row.topTask?.[1] || 0),
      })),
    });
  }
  if (totalBadges > 0) {
    slides.push({
      gradient: 'linear-gradient(160deg,#c76f58 0%,#a85646 58%,#6f3832 100%)',
      label: 'Badges Earned',
      icon: '<i class="ph-duotone ph-medal" style="color:rgba(255,246,241,0.82);font-size:0.9rem"></i>',
      bigStat: `${totalBadges} badges`,
      subStat: 'earned by the whole family',
      rows: kidData.filter(row => row.badges.length > 0).map(row => ({
        name: String(row.kid.name || 'Kid'),
        statHtml: `${row.badges.length} New<br>Badge${row.badges.length === 1 ? '' : 's'}`,
        hideAvatar: true,
        badgesDisplay: row.badges.slice(0, 6).map(badge => ({
          name: badge.title || 'Badge',
          icon: String((badge.metadata || {}).badgeIcon || '<i class="ph-duotone ph-medal" style="color:#FDE68A"></i>'),
        })),
      })),
    });
  }
  const familyName = state.familyName?.trim() || 'The Family';
  slides.push(totalTasks === 0
    ? {
      type: 'finale',
      gradient: 'linear-gradient(160deg,#5b5f8f 0%,#44496f 58%,#2d3150 100%)',
      label: 'Next Week',
      icon: '<i class="ph-duotone ph-moon-stars" style="color:rgba(255,255,255,0.58);font-size:1rem"></i>',
      bigStat: 'Quiet week',
      subStat: 'Make it count next Sunday!',
      rows: [],
    }
    : {
      type: 'finale',
      gradient: 'linear-gradient(160deg,#6f6aa8 0%,#534d85 58%,#35315a 100%)',
      label: 'Week in Review',
      icon: '<i class="ph-duotone ph-calendar-star" style="color:rgba(244,239,228,0.84);font-size:1rem"></i>',
      finaleIcon: '<i class="ph-duotone ph-plant" style="color:rgba(255,255,255,0.88)"></i>',
      finaleHeadline: 'Great job!',
      finaleMessage: "Let's keep growing!",
      subStat: familyName,
      rows: [],
    });
  return splitOverflowSlides(slides);
}

function renderWeekReviewStory(): void {
  const overlay = document.getElementById('week-review-overlay');
  if (!overlay || !story) return;
  overlay.innerHTML = weekReviewHtml(story.slides, story.index);
  bindWeekReviewOverlay(overlay);
  const slides = story.slides || [];
  if (shouldUseUniformCardHeight()) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => applyUniformCardHeight(overlay, slides));
    });
  } else {
    overlay.style.removeProperty('--wr-card-uniform-height');
  }
  overlay.classList.toggle('wr-paused', !!story.paused);
  syncAudio();
  if (story.paused) {
    if (story.timer) {
      window.clearTimeout(story.timer);
      story.timer = null;
    }
    return;
  }
  startTimer();
}

function weekReviewHtml(slides: WeekReviewSlide[], currentIndex: number): string {
  if (!story) return '';
  story.index = currentIndex;
  const slide = slides[currentIndex];
  const slideMs = story.slideMs || WEEK_REVIEW_SLIDE_MS;
  const revealDuration = Math.max(0.42, 0.7 * (story.timingScale || 1));
  const headerDate = slide.type === 'cover' ? 'This past week' : slides[0]?.dateRangeText || '';
  const progress = slides.map((_, i) => `
    <span class="wr-progress-track">
      <span class="wr-progress-fill${i === currentIndex ? ' active' : ''}${i < currentIndex ? ' done' : ''}" style="${i === currentIndex ? `animation-duration:${slideMs}ms` : ''}"></span>
    </span>`).join('');
  return `
    <style>${weekReviewCss(revealDuration)}</style>
    <div class="wr-shell">
      <div class="wr-top">
        <div class="wr-progress-row">${progress}</div>
        <div class="wr-head">
          <div>
            <div class="wr-title">Week in Review</div>
            <div class="wr-date">${escapeHtml(headerDate)}</div>
          </div>
          <div class="wr-head-actions">
            <button data-week-review-pause class="wr-close wr-pause-btn" aria-label="${story.paused ? 'Resume story' : 'Pause story'}" type="button"><i class="ph-duotone ${story.paused ? 'ph-play' : 'ph-pause'}" style="font-size:1rem"></i></button>
            <button data-week-review-close class="wr-close" aria-label="Close week in review" type="button"><i class="ph-duotone ph-x" style="font-size:1.1rem"></i></button>
          </div>
        </div>
      </div>
      <div class="wr-scene">
        <button class="wr-tap wr-tap-left" data-week-review-dir="prev" aria-label="Previous story" type="button"></button>
        <button class="wr-tap wr-tap-right" data-week-review-dir="next" aria-label="Next story" type="button"></button>
        <div class="wr-slide" data-week-review-card>
          ${cardBodyHtml(slide)}
        </div>
      </div>
      ${slide.type === 'finale' ? '<div class="wr-bottom-note wr-reveal wr-reveal-from-bottom" style="--wr-delay:3s">Tap anywhere to close or let the story finish.</div>' : ''}
    </div>`;
}

function bindWeekReviewOverlay(overlay: HTMLElement): void {
  overlay.querySelector<HTMLElement>('[data-week-review-close]')?.addEventListener('click', closeWeekReview);
  overlay.querySelector<HTMLElement>('[data-week-review-pause]')?.addEventListener('click', togglePause);
  overlay.querySelectorAll<HTMLElement>('[data-week-review-dir]').forEach(button => {
    const dir = button.dataset.weekReviewDir === 'prev' ? 'prev' : 'next';
    button.addEventListener('pointerdown', event => handlePress(dir, event));
    button.addEventListener('pointerup', () => handleRelease(dir));
    button.addEventListener('pointercancel', () => handleRelease(dir));
    button.addEventListener('pointerleave', () => handleRelease(dir));
    button.addEventListener('click', event => handleTap(dir, event));
  });
  const card = overlay.querySelector<HTMLElement>('[data-week-review-card]');
  card?.addEventListener('pointerdown', event => {
    event.preventDefault();
    press = { dir: 'hold', startedAt: Date.now(), suppressNav: true };
    pauseStory();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => {
    card?.addEventListener(type, () => {
      if (press?.dir === 'hold') press = null;
      resumeStory();
    });
  });
}

function cardBodyHtml(slide: WeekReviewSlide): string {
  const timing = story?.timingScale || 1;
  const rows = slide.rows || [];
  const rowCount = rows.length;
  const listClass = listClassFor(rowCount);
  const rowDelayBase = slide.type === 'cover' ? 4 : 3;
  const rowsHtml = rows.map((row, index) => rowHtml({
    ...row,
    delay: scaledDelay(rowDelayBase + index, timing),
    motionClass: row.motionClass || (rowCount >= 3 ? (index % 2 === 0 ? 'wr-reveal-from-left' : 'wr-reveal-from-right') : 'wr-reveal-from-bottom-card'),
  })).join('');
  const isCover = slide.type === 'cover';
  const isFinale = slide.type === 'finale';
  const headerDelay = scaledDelay(1, timing);
  const subDelay = scaledDelay(isCover ? 2 : 1, timing);
  return `
    <div class="wr-card${isFinale ? ' wr-finale' : ''}${isCover ? ' wr-card-cover' : ''}" style="background:${slide.gradient}">
      <div class="wr-card-label">${slide.icon}${escapeHtml(slide.label)}</div>
      <div class="wr-card-body">
        ${isFinale ? `
          <div class="wr-finale-stage-one">
            <div class="wr-finale-icon wr-reveal wr-reveal-from-left" style="--wr-delay:0s">${slide.finaleIcon || slide.icon}</div>
            <div class="wr-card-big wr-reveal wr-reveal-from-left" style="--wr-delay:0s">${escapeHtml(slide.finaleHeadline || slide.bigStat || '')}</div>
          </div>
          <div class="wr-finale-stage-two">
            ${slide.finaleMessage ? `<div class="wr-finale-message wr-reveal wr-reveal-from-right" style="--wr-delay:${scaledDelay(1, timing)}s">${escapeHtml(slide.finaleMessage)}</div>` : ''}
            <div class="wr-card-sub wr-reveal wr-reveal-from-right" style="--wr-delay:${scaledDelay(1, timing)}s">${escapeHtml(slide.subStat || '')}</div>
          </div>
        ` : isCover ? `
          <div class="wr-card-big wr-reveal wr-reveal-from-left" style="--wr-delay:${headerDelay}s;margin-bottom:2px">${slide.bigStat || ''}</div>
          ${slide.coverMessage ? `<div class="wr-cover-quote-wrap wr-reveal wr-reveal-from-bottom-card" style="--wr-delay:${subDelay}s"><div class="wr-cover-quote">${escapeHtml(slide.coverMessage)}</div></div>` : ''}
        ` : `
          <div class="wr-card-big wr-reveal wr-reveal-from-left" style="--wr-delay:${headerDelay}s">${escapeHtml(slide.bigStat || '')}</div>
          <div class="wr-card-sub wr-reveal wr-reveal-from-left" style="--wr-delay:${subDelay}s">${escapeHtml(slide.subStat || '')}</div>
        `}
        ${rows.length ? `<div class="wr-kid-list${listClass}">${rowsHtml}</div>` : ''}
      </div>
    </div>`;
}

function rowHtml(row: WeekReviewRow): string {
  const badges = Array.isArray(row.badgesDisplay) ? row.badgesDisplay.slice(0, 6) : [];
  return `
    <div class="wr-kid-row${badges.length ? ' wr-kid-row-badge' : ''}${row.hideAvatar ? ' wr-kid-row-no-avatar' : ''}${row.motionClass ? ` ${row.motionClass}` : ''} wr-reveal" style="--wr-delay:${Number(row.delay || 0)}s">
      ${row.hideAvatar ? '' : `<span class="wr-kid-avatar">${row.avatar || ''}</span>`}
      <div class="wr-kid-copy">
        <div class="wr-kid-name">${escapeHtml(row.name)}</div>
        ${row.statHtml ? `<div class="wr-kid-stat">${row.statHtml}</div>` : row.stat ? `<div class="wr-kid-stat">${escapeHtml(row.stat)}</div>` : ''}
        ${row.sub ? `<div class="wr-kid-sub">${escapeHtml(row.sub)}</div>` : ''}
      </div>
      ${badges.length ? `
        <div class="wr-kid-badge-grid wr-kid-badge-grid-count-${Math.min(badges.length, 6)}">
          ${badges.map((badge, index) => `
            <div class="wr-kid-badge-item${index === badges.length - 1 && (badges.length === 3 || badges.length === 5) ? ' wr-kid-badge-item-center' : ''}">
              <div class="wr-kid-badge-icon">${badge.icon || ''}</div>
              <div class="wr-kid-badge-name">${escapeHtml(badge.name || 'Badge')}</div>
            </div>
          `).join('')}
        </div>` : ''}
    </div>`;
}

function startTimer(): void {
  if (!story) return;
  if (story.timer) window.clearTimeout(story.timer);
  story.slideStartedAt = Date.now();
  story.timer = window.setTimeout(() => nextSlide(true), Math.max(150, story.remainingMs || story.slideMs));
}

function nextSlide(fromTimer = false): void {
  if (!story) return;
  if (story.index >= story.slides.length - 1) {
    closeWeekReview();
    return;
  }
  story.index += 1;
  story.remainingMs = story.slideMs;
  story.paused = false;
  renderWeekReviewStory();
  if (!fromTimer) press = null;
}

function prevSlide(): void {
  if (!story) return;
  story.index = Math.max(0, story.index - 1);
  story.remainingMs = story.slideMs;
  story.paused = false;
  renderWeekReviewStory();
}

function pauseStory(): void {
  if (!story || story.paused) return;
  story.paused = true;
  if (story.timer) {
    window.clearTimeout(story.timer);
    story.timer = null;
  }
  if (story.slideStartedAt) {
    story.remainingMs = Math.max(150, (story.remainingMs || story.slideMs) - (Date.now() - story.slideStartedAt));
  }
  document.getElementById('week-review-overlay')?.classList.add('wr-paused');
  audio?.pause();
}

function resumeStory(): void {
  if (!story || !story.paused) return;
  story.paused = false;
  document.getElementById('week-review-overlay')?.classList.remove('wr-paused');
  audio?.play().catch(() => undefined);
  startTimer();
}

function togglePause(): void {
  if (story?.paused) resumeStory();
  else pauseStory();
  renderWeekReviewStory();
}

function handlePress(dir: 'prev' | 'next', event: Event): void {
  event.preventDefault();
  press = { dir, startedAt: Date.now(), suppressNav: false };
  pauseStory();
}

function handleRelease(dir: 'prev' | 'next'): void {
  if (press?.dir === dir) press.suppressNav = (Date.now() - press.startedAt) > 180;
  resumeStory();
}

function handleTap(dir: 'prev' | 'next', event: Event): void {
  event.preventDefault();
  const activePress = press;
  press = null;
  if (activePress?.dir === dir && activePress.suppressNav) return;
  if (dir === 'prev') prevSlide();
  else nextSlide();
}

function weekReviewCss(revealDuration: number): string {
  return `
    #week-review-overlay{background:linear-gradient(180deg,#365e4f 0%,#365e4f 45%,#f4efe4 45%,#f4efe4 100%);color:#273229;font-family:"Avenir Next","Trebuchet MS","Segoe UI",system-ui,sans-serif;touch-action:manipulation}
    @keyframes wr-scene-in{from{opacity:0;transform:translateY(20px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes wr-progress{from{transform:scaleX(0)}to{transform:scaleX(1)}}
    @keyframes wr-reveal{from{opacity:1;transform:translate3d(var(--wr-from-x,0),var(--wr-from-y,18px),0)}to{opacity:1;transform:translate3d(0,0,0)}}
    .wr-reveal-from-bottom{--wr-from-x:0px;--wr-from-y:calc(100dvh + 120px)}.wr-reveal-from-bottom-card{--wr-from-x:0px;--wr-from-y:calc(100dvh + 160px)}.wr-reveal-from-left{--wr-from-x:calc(-100vw - 160px);--wr-from-y:0px}.wr-reveal-from-right{--wr-from-x:calc(100vw + 160px);--wr-from-y:0px}
    .wr-shell{max-width:520px;margin:0 auto;min-height:100dvh;padding:env(safe-area-inset-top,20px) 16px calc(env(safe-area-inset-bottom,0px) + 18px);display:flex;flex-direction:column;user-select:none;-webkit-user-select:none;box-sizing:border-box}
    .wr-top{padding:4px 0 10px}.wr-progress-row{display:flex;gap:6px;margin-bottom:16px}.wr-progress-track{flex:1;height:4px;border-radius:999px;overflow:hidden;background:rgba(255,253,248,.24)}.wr-progress-fill{display:block;width:100%;height:100%;transform-origin:left center;transform:scaleX(0);background:rgba(255,248,239,.92);border-radius:inherit}.wr-progress-fill.done{transform:scaleX(1)}.wr-progress-fill.active{animation:wr-progress linear forwards}
    .wr-head{padding:8px 0;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.wr-title{color:#fff8ef;font-size:1.28rem;font-weight:900;letter-spacing:0}.wr-date{color:rgba(244,239,228,.62);font-size:.82rem;margin-top:4px}.wr-head-actions{display:flex;align-items:center;gap:8px}.wr-close{background:rgba(255,253,248,.14);border:1px solid rgba(255,253,248,.18);color:rgba(255,248,239,.78);width:38px;height:38px;border-radius:999px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 18px rgba(15,29,25,.14)}
    .wr-scene{position:relative;flex:1;display:flex;align-items:center;min-height:0}.wr-tap{position:absolute;top:0;bottom:0;width:24%;z-index:5;border:none;background:transparent;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;touch-action:manipulation}.wr-tap-left{left:0}.wr-tap-right{right:0}.wr-slide{position:relative;width:100%;min-height:0;display:flex;flex-direction:column;justify-content:center;animation:wr-scene-in .45s cubic-bezier(.22,1,.36,1) both}
    .wr-card{width:100%;max-height:100%;border-radius:30px;padding:26px 24px;border:1px solid rgba(255,255,255,.14);box-shadow:0 8px 32px rgba(0,0,0,.3);min-height:var(--wr-card-uniform-height,clamp(460px,62dvh,620px));height:var(--wr-card-uniform-height,auto);display:flex;flex-direction:column;justify-content:flex-start;box-sizing:border-box}.wr-reveal{opacity:1;--wr-from-x:0px;--wr-from-y:0px;transform:translate3d(var(--wr-from-x),var(--wr-from-y),0);will-change:transform;animation:wr-reveal ${revealDuration}s cubic-bezier(.16,1,.3,1) both;animation-delay:var(--wr-delay,0s)}#week-review-overlay.wr-paused .wr-progress-fill.active,#week-review-overlay.wr-paused .wr-reveal{animation-play-state:paused!important}
    .wr-card-label{display:flex;align-items:center;gap:8px;font-size:.86rem;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:rgba(255,248,239,.64);margin-bottom:20px}.wr-card-body{flex:1;display:flex;flex-direction:column;justify-content:center;gap:18px;padding-bottom:10px}.wr-card-cover .wr-card-body{justify-content:space-between}.wr-card-big{font-size:clamp(3.4rem,15vw,5.6rem);font-weight:900;color:#fff9f1;line-height:.92;letter-spacing:0;margin-bottom:16px;text-wrap:balance}.wr-card-sub{font-size:1.18rem;color:rgba(255,246,238,.78);line-height:1.5;max-width:28rem}.wr-cover-quote-wrap{flex:1 1 auto;display:flex;align-items:center;justify-content:center;min-height:0}.wr-cover-quote{text-align:center;font-size:clamp(28px,7vw,40px);font-weight:700;line-height:1.45;padding:20px 24px 28px;color:rgba(250,248,244,.96)}
    .wr-kid-list{display:flex;flex-direction:column;gap:16px;margin-top:14px;overflow:hidden}.wr-kid-list-count-3,.wr-kid-list-count-4,.wr-kid-list-count-5,.wr-kid-list-count-6{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:stretch}.wr-kid-list-count-3 .wr-kid-row:last-child,.wr-kid-list-count-5 .wr-kid-row:last-child{grid-column:1/-1;width:min(48%,220px);justify-self:center}.wr-kid-list-compact{gap:12px;margin-top:28px}
    .wr-kid-row{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:20px 18px 18px;min-height:138px;text-align:center;background:rgba(255,253,248,.18);border:1px solid rgba(255,253,248,.16);border-radius:22px;backdrop-filter:blur(8px);box-sizing:border-box}.wr-kid-row-badge{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;text-align:left;gap:14px}.wr-kid-row-no-avatar{grid-template-columns:minmax(0,1fr) auto}.wr-kid-list-compact .wr-kid-row{min-height:112px;padding:14px 12px 13px;gap:8px;border-radius:18px}.wr-kid-avatar{width:54px;height:54px;border-radius:18px;display:inline-flex;align-items:center;justify-content:center;background:rgba(255,250,243,.78);color:#31453e;font-size:1.9rem;line-height:1;flex-shrink:0;overflow:hidden}.wr-kid-avatar .avatar-img{width:100%;height:100%;object-fit:cover}.wr-kid-copy{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;min-height:96px}.wr-kid-row-badge .wr-kid-copy{align-items:flex-start;text-align:left}.wr-kid-name,.wr-kid-stat{font-weight:900;color:#fff9f1;font-size:1.12rem;line-height:1.12}.wr-kid-sub{font-size:.92rem;color:rgba(255,246,238,.72);line-height:1.35}.wr-kid-badge-grid{display:grid;justify-items:center;align-content:center;gap:8px 10px;min-width:88px}.wr-kid-badge-grid-count-3,.wr-kid-badge-grid-count-4,.wr-kid-badge-grid-count-5,.wr-kid-badge-grid-count-6{grid-template-columns:repeat(2,minmax(0,1fr))}.wr-kid-badge-item{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}.wr-kid-badge-item-center{grid-column:1/-1}.wr-kid-badge-icon{width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;background:rgba(255,250,243,.84);color:#4b5563;font-size:1.55rem;line-height:1}.wr-kid-badge-name{font-size:.76rem;font-weight:700;line-height:1.2;color:rgba(255,246,238,.74);text-wrap:balance}
    .wr-finale{text-align:center;align-items:stretch}.wr-finale .wr-card-body{align-items:center;text-align:center;justify-content:center;padding-top:8px;padding-bottom:18px}.wr-finale-stage-one,.wr-finale-stage-two{display:flex;flex-direction:column;align-items:center;width:100%}.wr-finale-icon{width:100%;display:flex;align-items:center;justify-content:center;font-size:8.4rem;color:rgba(255,255,255,.72);margin:-104px 0 -16px;line-height:1}.wr-finale-icon i{display:block;font-size:1em!important;line-height:1;transform:translateY(-36px)}.wr-finale-message{font-size:clamp(2.2rem,10vw,3.35rem);font-weight:900;color:#fff9f1;line-height:1.04;letter-spacing:0}.wr-bottom-note{position:absolute;left:16px;right:16px;bottom:8px;text-align:center;color:rgba(255,255,255,.78);font-size:.84rem;font-weight:700}.wr-measure-host{position:absolute;inset:0;pointer-events:none;visibility:hidden;z-index:-1;overflow:hidden}.wr-measure-slide{position:absolute;inset:0;display:flex;align-items:center}.wr-measure-host .wr-card{min-height:0!important;height:auto!important}
    @media(max-width:420px) and (max-height:760px){.wr-shell{padding:env(safe-area-inset-top,20px) 12px calc(env(safe-area-inset-bottom,0px) + 12px)}.wr-progress-row{margin-bottom:12px}.wr-title{font-size:1.12rem}.wr-date{font-size:.74rem}.wr-close{width:34px;height:34px}.wr-scene{align-items:stretch}.wr-slide{flex:1 1 auto;justify-content:stretch}.wr-card{min-height:0;height:100%;max-height:none;padding:18px 16px;border-radius:24px}.wr-card-label{font-size:.72rem;margin-bottom:12px}.wr-card-body{justify-content:flex-start;gap:10px;padding-bottom:0}.wr-card-cover .wr-card-body{justify-content:space-between}.wr-card-big{font-size:clamp(2.3rem,11.5vw,3.4rem);margin-bottom:8px}.wr-card-sub{font-size:.88rem;line-height:1.32}.wr-cover-quote{font-size:clamp(22px,7vw,30px);padding:12px 10px}.wr-kid-list{gap:8px;margin-top:6px}.wr-kid-row{min-height:88px;padding:10px 8px;gap:6px;border-radius:16px}.wr-kid-avatar{width:34px;height:34px;border-radius:11px;font-size:1.15rem}.wr-kid-copy{min-height:0;gap:2px}.wr-kid-name,.wr-kid-stat{font-size:.8rem;line-height:1.02}.wr-kid-sub{font-size:.66rem;line-height:1.18}.wr-kid-badge-grid{min-width:44px;gap:3px 4px}.wr-kid-badge-icon{width:28px;height:28px;border-radius:9px;font-size:.86rem}.wr-kid-badge-name{font-size:.52rem}.wr-finale-icon{font-size:6.2rem;margin:-44px 0 -6px}.wr-finale-icon i{transform:translateY(-14px)}.wr-finale-message{font-size:clamp(1.8rem,8.6vw,2.6rem)}}
  `;
}

function buildWeekReviewSummary(state: AppState, start: string, end: string): { totalGems: number; totalTasks: number; totalBadges: number; savedLabel: string } {
  const rows = weekHistory(state, start, end);
  const chores = rows.filter(row => row.type === 'chore');
  const bonus = rows.filter(row => row.type === 'bonus');
  const penalty = rows.filter(row => row.type === 'penalty');
  const totalGems = sumGems(chores) + sumGems(bonus) - sumAbsGems(penalty);
  return {
    totalGems,
    totalTasks: chores.filter(row => !String(row.title || '').startsWith('Streak bonus (')).length,
    totalBadges: rows.filter(row => row.type === 'badge').length,
    savedLabel: savedLabelFor(computeSavedTotals(rows.filter(row => row.type === 'savings_deposit' || row.type === 'savings')), state.settings.currency || '$'),
  };
}

function activeKids(state: AppState): AppMember[] {
  return state.members.filter(member => member.role === 'kid' && !member.deleted);
}

function weekHistory(state: AppState, start: string, end: string): AppHistoryRow[] {
  const timezone = state.settings.familyTimezone || 'America/Phoenix';
  return state.historyRows.filter(row => {
    const date = historyDateKey(row, timezone);
    return date >= start && date <= end;
  });
}

function historyDateKey(row: AppHistoryRow, timezone: string): string {
  const date = String((row as AppHistoryRow & { date?: string }).date || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return dateKeyFromTimestamp(Number(row.createdAt || Date.now()), timezone);
}

function dateKeyFromTimestamp(timestamp: number, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(timestamp));
    const year = parts.find(part => part.type === 'year')?.value || '1970';
    const month = parts.find(part => part.type === 'month')?.value || '01';
    const day = parts.find(part => part.type === 'day')?.value || '01';
    return `${year}-${month}-${day}`;
  } catch {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}

function getWeekRange(state: AppState): { start: string; end: string } {
  const today = todayKeyForTimezone(state.settings.familyTimezone || 'America/Phoenix');
  const date = parseDateLocal(today);
  const day = date.getDay();
  const end = new Date(date);
  end.setDate(date.getDate() - day);
  if (day === 0) end.setDate(end.getDate() - 7);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return { start: formatDateLocal(start), end: formatDateLocal(end) };
}

function parseDateLocal(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function ordinalDay(day: number): string {
  const value = day % 100;
  if (value >= 11 && value <= 13) return `${day}th`;
  if (day % 10 === 1) return `${day}st`;
  if (day % 10 === 2) return `${day}nd`;
  if (day % 10 === 3) return `${day}rd`;
  return `${day}th`;
}

function formatWeekReviewDateRange(start: string, end: string, multiline = false): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const startDate = parseDateLocal(start);
  const endDate = parseDateLocal(end);
  const startText = `${months[startDate.getMonth()]} ${ordinalDay(startDate.getDate())}`;
  const endText = `${months[endDate.getMonth()]} ${ordinalDay(endDate.getDate())}`;
  return multiline ? `${startText} -<br>${endText}` : `${startText} - ${endText}, ${endDate.getFullYear()}`;
}

function sumGems(rows: AppHistoryRow[]): number {
  return rows.reduce((sum, row) => sum + (Number((row as AppHistoryRow & { diamonds?: number }).diamonds ?? row.gems ?? 0) || 0), 0);
}

function sumAbsGems(rows: AppHistoryRow[]): number {
  return rows.reduce((sum, row) => sum + Math.abs(Number((row as AppHistoryRow & { diamonds?: number }).diamonds ?? row.gems ?? 0) || 0), 0);
}

function computeSavedTotals(rows: AppHistoryRow[]): WeekReviewSaved {
  return rows.reduce<WeekReviewSaved>((saved, row) => {
    if (row.type === 'savings_deposit') saved.dollars += Number((row as AppHistoryRow & { dollars?: number }).dollars ?? row.amount ?? 0) || 0;
    if (row.type === 'savings') {
      const dollars = Number(row.amount || 0) || 0;
      if (dollars > 0) {
        saved.dollars += dollars;
        return saved;
      }
      const delta = Number((row as AppHistoryRow & { diamonds?: number }).diamonds ?? row.gems ?? 0) || 0;
      if (delta < 0) saved.gems += Math.abs(delta);
    }
    return saved;
  }, { dollars: 0, gems: 0 });
}

function savedLabelFor(saved: WeekReviewSaved, currency: string): string {
  const parts: string[] = [];
  if (saved.dollars > 0) parts.push(`${currency}${saved.dollars.toFixed(2)}`);
  if (saved.gems > 0) parts.push(`${saved.gems} gems`);
  return parts.join(' + ');
}

function countByTitle(rows: AppHistoryRow[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((counts, row) => {
    const title = String(row.title || 'Task');
    counts[title] = (counts[title] || 0) + 1;
    return counts;
  }, {});
}

function timesLabel(count: number): string {
  if (count === 1) return 'Once';
  if (count === 2) return 'Twice';
  return `${count} Times`;
}

function renderWeekReviewAvatar(member: AppMember): string {
  const avatar = String(member.avatar || member.icon || 'smiley');
  const color = String(member.avatarColor || member.color || '#6C63FF');
  if (/\.(png|jpe?g|gif|webp)$/i.test(avatar)) return `<img src="${escapeHtml(avatar)}" class="avatar-img" alt="">`;
  if (avatar.includes('<')) return avatar.replace(/color:\s*#[0-9a-fA-F]{3,8}/, `color:${color}`);
  return `<i class="ph-duotone ph-${escapeHtml(avatar.replace(/^ph-duotone\s+/, '').replace(/^ph-/, ''))}" style="color:${escapeHtml(color)}"></i>`;
}

function timingScale(kidCount: number): number {
  if (kidCount <= 2) return 1;
  return Math.max(0.6, 1 - (Math.min(4, kidCount - 2) * 0.1));
}

function scaledDelay(value: number, scale: number): number {
  return Math.max(0, Number((value * scale).toFixed(3)));
}

function listClassFor(count: number): string {
  if (count >= 6) return ' wr-kid-list-count-6 wr-kid-list-compact';
  if (count === 5) return ' wr-kid-list-count-5 wr-kid-list-compact';
  if (count === 4) return ' wr-kid-list-count-4';
  if (count === 3) return ' wr-kid-list-count-3';
  return '';
}

function slideRowLimit(slide: WeekReviewSlide): number {
  const rows = slide.rows || [];
  if (!rows.length) return 0;
  if (slide.type === 'cover') return 4;
  if (rows.some(row => row.badgesDisplay?.length)) return 3;
  return 4;
}

function splitOverflowSlides(slides: WeekReviewSlide[]): WeekReviewSlide[] {
  return slides.flatMap(slide => {
    const limit = slideRowLimit(slide);
    if (!limit || slide.rows.length <= limit) return [slide];
    const chunks: WeekReviewRow[][] = [];
    for (let index = 0; index < slide.rows.length; index += limit) chunks.push(slide.rows.slice(index, index + limit));
    return chunks.map((rows, index) => ({ ...slide, rows, label: `${slide.label} ${index + 1}/${chunks.length}` }));
  });
}

function shuffleMessageOrder(size: number): number[] {
  const order = Array.from({ length: size }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  return order;
}

function readMessageOrder(size: number): number[] {
  try {
    const raw = window.localStorage.getItem(WEEK_REVIEW_MESSAGE_ORDER_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length === size && parsed.every(item => Number.isInteger(item) && item >= 0 && item < size)) return parsed;
  } catch {}
  const order = shuffleMessageOrder(size);
  try {
    window.localStorage.setItem(WEEK_REVIEW_MESSAGE_ORDER_KEY, JSON.stringify(order));
    window.localStorage.setItem(WEEK_REVIEW_MESSAGE_INDEX_KEY, '0');
  } catch {}
  return order;
}

function nextCoverMessage(): string {
  const size = WEEK_REVIEW_COVER_MESSAGES.length;
  let order = readMessageOrder(size);
  let index = 0;
  try {
    index = parseInt(window.localStorage.getItem(WEEK_REVIEW_MESSAGE_INDEX_KEY) || '0', 10) || 0;
  } catch {}
  if (index < 0 || index >= order.length) index = 0;
  const message = WEEK_REVIEW_COVER_MESSAGES[order[index] || 0] || WEEK_REVIEW_COVER_MESSAGES[0];
  const next = (index + 1) % order.length;
  try {
    window.localStorage.setItem(WEEK_REVIEW_MESSAGE_INDEX_KEY, String(next));
    if (next === 0) {
      order = shuffleMessageOrder(size);
      window.localStorage.setItem(WEEK_REVIEW_MESSAGE_ORDER_KEY, JSON.stringify(order));
    }
  } catch {}
  return message;
}

function trackPath(trackNumber: number): string {
  return `assets/week-review-audio/${trackNumber}.wav`;
}

function assignWeekReviewAudio(slides: WeekReviewSlide[], weekSeed: string): void {
  const intro = trackPath(1);
  const middle = seededShuffle([trackPath(2), trackPath(3), trackPath(4), trackPath(5)], weekSeed);
  let middleIndex = 0;
  let previous = '';
  const allTracks = [intro, ...middle];
  slides.forEach((slide, index) => {
    if (index === 0 || index === slides.length - 1 || slide.type === 'cover' || slide.type === 'finale') {
      slide.audioSrc = intro !== previous ? intro : allTracks.find(track => track !== previous) || intro;
    } else {
      const nextMiddle = middle.find((_, offset) => middle[(middleIndex + offset) % middle.length] !== previous) || middle[0] || intro;
      slide.audioSrc = nextMiddle;
      middleIndex = (middle.indexOf(nextMiddle) + 1) % Math.max(1, middle.length);
    }
    previous = slide.audioSrc || '';
  });
}

function seededShuffle(items: string[], seed: string): string[] {
  const list = items.slice();
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const rand = () => {
    hash += 0x6D2B79F5;
    let next = hash;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rand() * (index + 1));
    [list[index], list[swap]] = [list[swap], list[index]];
  }
  return list;
}

function ensureAudio(src = ''): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(src);
    (audio as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
    audio.preload = 'auto';
  } else if (src && audio.src !== new URL(src, window.location.href).href) {
    audio.pause();
    audio.src = src;
  }
  return audio;
}

function primeAudio(src?: string): void {
  if (!src) return;
  const element = ensureAudio(src);
  const token = ++audioPrimeToken;
  const wasMuted = element.muted;
  element.muted = true;
  element.currentTime = 0;
  element.load();
  element.play().then(() => {
    if (token !== audioPrimeToken) {
      element.muted = wasMuted;
      return;
    }
    if (!story || story.audioSlideIndex < 0 || story.paused) {
      element.pause();
      element.currentTime = 0;
    }
    element.muted = wasMuted;
  }).catch(() => {
    element.muted = wasMuted;
  });
}

function syncAudio(): void {
  const slide = story?.slides[story.index];
  if (!story || !slide?.audioSrc) return;
  audioPrimeToken += 1;
  const resolved = new URL(slide.audioSrc, window.location.href).href;
  const changed = story.audioSlideIndex !== story.index;
  const element = ensureAudio(slide.audioSrc);
  if (element.src !== resolved) {
    element.pause();
    element.src = slide.audioSrc;
    element.load();
  }
  if (changed) element.currentTime = 0;
  story.audioSlideIndex = story.index;
  if (story.paused) {
    element.pause();
    return;
  }
  element.muted = false;
  const attempt = () => element.play().catch(() => bindAudioRetry());
  if (element.readyState < 2) element.addEventListener('canplay', attempt, { once: true });
  attempt();
}

function bindAudioRetry(): void {
  const overlay = document.getElementById('week-review-overlay');
  if (!overlay || overlay.dataset.wrAudioRetryBound === '1') return;
  const retry = () => {
    if (story?.paused) return;
    audio?.play().catch(() => undefined);
  };
  overlay.addEventListener('pointerdown', retry, { passive: true });
  overlay.addEventListener('touchstart', retry, { passive: true });
  overlay.addEventListener('click', retry, { passive: true });
  overlay.dataset.wrAudioRetryBound = '1';
}

function stopAudio(): void {
  audioPrimeToken += 1;
  audio?.pause();
  if (audio) audio.currentTime = 0;
  audio = null;
}

function shouldUseUniformCardHeight(): boolean {
  const height = Math.max(window.visualViewport?.height || 0, window.innerHeight || 0, document.documentElement?.clientHeight || 0);
  return height > 760;
}

function applyUniformCardHeight(overlay: HTMLElement, slides: WeekReviewSlide[]): void {
  if (!story || !slides.length) return;
  if (story.cardHeight) {
    overlay.style.setProperty('--wr-card-uniform-height', `${story.cardHeight}px`);
    return;
  }
  const host = document.createElement('div');
  host.className = 'wr-measure-host';
  host.setAttribute('aria-hidden', 'true');
  host.innerHTML = slides.map(slide => `<div class="wr-slide wr-measure-slide">${cardBodyHtml(slide)}</div>`).join('');
  overlay.appendChild(host);
  const heights = Array.from(host.querySelectorAll<HTMLElement>('.wr-card')).map(card => Math.ceil(card.getBoundingClientRect().height)).filter(Boolean);
  host.remove();
  if (!heights.length) return;
  story.cardHeight = Math.max(...heights);
  overlay.style.setProperty('--wr-card-uniform-height', `${story.cardHeight}px`);
}
