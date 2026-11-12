import test from 'node:test';
import assert from 'node:assert/strict';
import { type AppMember, type AppState } from '../../src/app/app-state';
import { renderParentStats, renderStatsDetailModal } from '../../src/features/parent-stats/view';

const firstParent: AppMember = {
  id: 'parent-1',
  name: 'Alex',
  role: 'parent',
  avatar: 'user-circle',
  avatarColor: '#2563EB',
};

const secondParent: AppMember = {
  id: 'parent-2',
  name: 'Jordan',
  role: 'parent',
  avatar: '<i class="ph-duotone ph-heart" style="color:#F43F5E"></i>',
  avatarColor: '#F43F5E',
};

const kid: AppMember = {
  id: 'kid-1',
  name: 'Maya',
  role: 'kid',
  avatar: '<i class="ph-duotone ph-star" style="color:#F59E0B"></i>',
  avatarColor: '#43D9AD',
};

function state(): AppState {
  return {
    member: firstParent,
    members: [firstParent, secondParent, kid],
    tasks: [],
    prizes: [],
    teamGoals: [],
    settings: { levelingEnabled: true, streakEnabled: true },
    request: null,
    requests: [],
    completions: [],
    completion: null,
    operation: null,
    history: null,
    historyRows: [],
  };
}

test('family stats snapshots use the active parent avatar', () => {
  const html = renderParentStats(state(), secondParent);
  const familyCard = html.slice(html.indexOf('data-open-stats="family"'));
  const card = familyCard.match(/stats-launch-avatar-family">([\s\S]*?)<\/div>/)?.[1] || '';
  assert.match(card, /ph-heart/);
  assert.match(card, /#F43F5E/);
  assert.doesNotMatch(card, /gemsprout\.png/);

  const detail = renderStatsDetailModal(state(), 'family', '', 'left', secondParent);
  assert.match(detail, /snapshot-panel-avatar"><i class="ph-duotone ph-heart"/);
});

test('kid stats snapshots render legacy inline avatar icons with the selected color', () => {
  const html = renderParentStats(state(), secondParent);
  const card = html.match(/<div class="stats-launch-avatar">([\s\S]*?)<\/div>/)?.[1] || '';
  assert.match(card, /ph-star/);
  assert.match(card, /#43D9AD/);
  assert.doesNotMatch(card, /ph-<i/);
});
