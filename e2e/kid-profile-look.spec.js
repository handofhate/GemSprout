const { test, expect } = require('@playwright/test');

async function seedKidProfileState(page) {
  await page.goto('/?e2e=1');
  await page.waitForFunction(() => typeof window.defaultData === 'function' && typeof window.normalizeData === 'function');
  await page.evaluate(() => {
    window.speak = () => {};
    window.launchConfetti = () => {};
    saveData = () => {};

    const data = normalizeData(defaultData());
    D = data;
    data.setup = true;
    data.history = [];
    data.prizes = [];
    data.chores = [];

    const kid = normalizeMember({
      id: 'kid_profile_1',
      name: 'Kid Profile',
      role: 'kid',
      color: '#F59E0B',
      avatarColor: '#F59E0B',
      avatar: AVATARS[0],
      gems: 0,
    });

    data.family.name = 'Profile Test Family';
    data.family.members = [kid];

    setCurrentUserId(kid.id);
    setAppUnlocked(true);
    S.currentUser = kid;
    showScreen('screen-kid');
    renderKidView();
  });
}

test.describe('@ui kid profile editor', () => {
  test('can save kid profile look multiple times in a row', async ({ page }) => {
    await seedKidProfileState(page);

    const first = await page.evaluate(() => {
      openKidProfileLookModal();
      _setKidProfileLookAvatar(AVATARS[2]);
      _setKidProfileLookColor('avatarColor', COLORS[3]);
      _setKidProfileLookColor('color', COLORS[4]);
      saveKidProfileLook();
      const kid = getMember('kid_profile_1');
      return { avatar: kid.avatar, avatarColor: kid.avatarColor, color: kid.color };
    });

    const second = await page.evaluate(() => {
      openKidProfileLookModal();
      _setKidProfileLookAvatar(AVATARS[6]);
      _setKidProfileLookColor('avatarColor', COLORS[1]);
      _setKidProfileLookColor('color', COLORS[0]);
      saveKidProfileLook();
      const kid = getMember('kid_profile_1');
      return { avatar: kid.avatar, avatarColor: kid.avatarColor, color: kid.color };
    });

    expect(first.avatar).not.toBe(second.avatar);
    expect(first.avatarColor).not.toBe(second.avatarColor);
    expect(first.color).not.toBe(second.color);
  });
});
