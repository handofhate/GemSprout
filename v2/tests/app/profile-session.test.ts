import test from 'node:test';
import assert from 'node:assert/strict';
import type { AppMember } from '../../src/app/app-state';
import { isParentAuthLinkedToMember, readActiveProfileMemberId, serializeActiveProfile } from '../../src/app/profile-session';

test('saved profile is restored only for its saved family', () => {
  const stored = serializeActiveProfile('family-1', 'parent-1');
  assert.equal(readActiveProfileMemberId(stored, 'family-1'), 'parent-1');
  assert.equal(readActiveProfileMemberId(stored, 'family-2'), null);
  assert.equal(readActiveProfileMemberId('{bad json', 'family-1'), null);
  assert.equal(serializeActiveProfile('', 'parent-1'), null);
});

test('parent session restoration requires a linked Google or Apple identity', () => {
  const parent: AppMember = {
    id: 'parent-1',
    role: 'parent',
    authUid: 'uid-1',
    authProviders: [{ providerId: 'google.com', uid: 'uid-1', email: 'parent@example.com' }],
  };
  assert.equal(isParentAuthLinkedToMember(parent, { uid: 'uid-1', providerId: 'google.com' }), true);
  assert.equal(isParentAuthLinkedToMember(parent, { uid: 'uid-2', email: 'parent@example.com', providerId: 'apple.com' }), true);
  assert.equal(isParentAuthLinkedToMember(parent, { uid: 'uid-2', providerId: 'google.com' }), false);
  assert.equal(isParentAuthLinkedToMember({ ...parent, role: 'kid' }, { uid: 'uid-1', providerId: 'google.com' }), false);
  assert.equal(isParentAuthLinkedToMember(parent, { uid: 'uid-1', providerId: 'anonymous' }), false);
});
