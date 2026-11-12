const assert = require('node:assert/strict');
const test = require('node:test');
const { getParentAuthUids, isParentAccount } = require('./family-auth');

test('recognizes a linked V1 parent and gathers its linked providers', () => {
  const family = {
    parentAuthUid: 'parent-a',
    family: {
      members: [{ role: 'parent', authUid: 'parent-a', authProviders: [{ uid: 'parent-b' }] }],
    },
  };

  assert.equal(isParentAccount({}, family, [], 'parent-b'), true);
  assert.deepEqual(getParentAuthUids(family, []), ['parent-a', 'parent-b']);
});

test('finds separate parent auths in V2 members and ignores kid auths', () => {
  const family = {};
  const members = [
    { role: 'parent', authUids: ['parent-a', 'parent-b'] },
    { role: 'kid', authUid: 'kid-a' },
  ];

  assert.equal(isParentAccount({}, family, members, 'parent-b'), true);
  assert.equal(isParentAccount({}, family, members, 'kid-a'), false);
  assert.deepEqual(getParentAuthUids(family, members), ['parent-a', 'parent-b']);
});
