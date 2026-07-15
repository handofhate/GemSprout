import test from 'node:test';
import assert from 'node:assert/strict';
import { renderKidScreen } from '../../src/features/kid-dashboard/view';
import { type AppState, type AppMember } from '../../src/app/app-state';

const kid: AppMember = {
  id: 'kid_1',
  name: 'Maya',
  role: 'kid',
  avatar: '<i class="ph-duotone ph-star" style="color:#F59E0B"></i>',
  avatarColor: '#43D9AD',
  color: '#6C63FF',
  gems: 12,
  diamonds: 12,
  totalEarned: 85,
  xp: 85,
  badges: [],
};

function state(overrides: Partial<AppState> = {}): AppState {
  return {
    member: kid,
    members: [kid],
    tasks: [],
    prizes: [],
    teamGoals: [],
    settings: {
      levelingEnabled: true,
      streakEnabled: true,
      comboEnabled: true,
      baseBadgesEnabled: true,
      choreBadgesEnabled: true,
    },
    request: null,
    requests: [],
    completions: [],
    completion: null,
    operation: null,
    history: null,
    historyRows: [],
    ...overrides,
  };
}

test('kid header keeps v1 settings and avatar easter egg hooks', () => {
  const html = renderKidScreen(state(), kid, 'chores');
  assert.match(html, /data-kid-header-avatar/);
  assert.match(html, /data-kid-settings/);
  assert.doesNotMatch(html, /data-kid-switch-user type="button" title="Switch user"/);
});

test('kid avatars render with the editable avatar color', () => {
  const html = renderKidScreen(state(), kid, 'chores');
  assert.match(html, /ph-star/);
  assert.match(html, /color:#43D9AD/);
});

test('kid stats includes the GemSprout easter egg end cap', () => {
  const html = renderKidScreen(state(), kid, 'stats');
  assert.match(html, /id="egg-gem"/);
  assert.match(html, /data-stats-egg-gem/);
});
