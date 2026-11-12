function isParentAccount(userData, familyData, members, uid) {
  if (userData.role === 'parent' || familyData.parentAuthUid === uid) return true;
  return [...members, ...legacyMembers(familyData)].some(member =>
    member?.role === 'parent' && hasAuthUid(member, uid)
  );
}

function getParentAuthUids(familyData, members) {
  const ids = new Set();
  if (familyData.parentAuthUid) ids.add(familyData.parentAuthUid);
  for (const member of [...members, ...legacyMembers(familyData)]) {
    if (member?.role !== 'parent') continue;
    if (member.authUid) ids.add(member.authUid);
    (Array.isArray(member.authUids) ? member.authUids : []).forEach(uid => uid && ids.add(uid));
    (Array.isArray(member.authProviders) ? member.authProviders : []).forEach(provider => {
      if (provider?.uid) ids.add(provider.uid);
    });
  }
  return [...ids];
}

function hasAuthUid(member, uid) {
  return member.authUid === uid
    || (Array.isArray(member.authUids) && member.authUids.includes(uid))
    || (Array.isArray(member.authProviders) && member.authProviders.some(provider => provider?.uid === uid));
}

function legacyMembers(familyData) {
  return Array.isArray(familyData.family?.members) ? familyData.family.members : [];
}

module.exports = { getParentAuthUids, isParentAccount };
