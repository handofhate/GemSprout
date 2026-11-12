const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const functions = require('firebase-functions/v1');
const { getParentAuthUids, isParentAccount } = require('./family-auth');

initializeApp();

const db = getFirestore();

exports.cleanupDeletedParentFamily = functions
  .region('us-central1')
  .runWith({ failurePolicy: true })
  .auth.user()
  .onDelete(async user => {
    const uid = user.uid;
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return;

    const userData = userSnap.data() || {};
    const familyId = String(userData.familyId || userData.familyCode || '');
    if (!familyId) {
      await userRef.delete();
      return;
    }

    const familyRef = db.doc(`families/${familyId}`);
    if (userData.deletingFamily === true) {
      if ((await familyRef.get()).exists) await db.recursiveDelete(familyRef);
      await deleteFamilyUserLinks(familyId);
      return;
    }
    const familySnap = await familyRef.get();
    const familyData = familySnap.exists ? familySnap.data() || {} : {};
    const memberSnapshot = await familyRef.collection('members').get();
    const members = memberSnapshot.docs.map(memberDoc => memberDoc.data());
    if (!isParentAccount(userData, familyData, members, uid)) {
      await userRef.delete();
      return;
    }

    const remainingParentUids = getParentAuthUids(familyData, members).filter(parentUid => parentUid !== uid);
    if (remainingParentUids.length) {
      await unlinkParentAuth(familyRef, familyData, memberSnapshot, uid, remainingParentUids[0]);
      await userRef.delete();
      return;
    }

    await userRef.set({ deletingFamily: true }, { merge: true });
    await db.recursiveDelete(familyRef);
    await deleteFamilyUserLinks(familyId);
  });

async function unlinkParentAuth(familyRef, familyData, memberSnapshot, deletedUid, nextParentUid) {
  const updates = memberSnapshot.docs
    .filter(memberDoc => memberDoc.data().role === 'parent' && hasAuthUid(memberDoc.data(), deletedUid))
    .map(memberDoc => {
      const member = memberDoc.data();
      const authProviders = (member.authProviders || []).filter(provider => provider?.uid !== deletedUid);
      const authUids = (member.authUids || []).filter(uid => uid !== deletedUid);
      return memberDoc.ref.update({
        authProviders,
        authUids,
        authUid: member.authUid === deletedUid ? (authProviders[0]?.uid || authUids[0] || '') : member.authUid,
      });
    });

  const legacyMembers = familyData.family?.members;
  if (Array.isArray(legacyMembers)) {
    const nextLegacyMembers = legacyMembers.map(member => removeAuthUid(member, deletedUid));
    updates.push(familyRef.update({ 'family.members': nextLegacyMembers }));
  }
  if (familyData.parentAuthUid === deletedUid) {
    updates.push(familyRef.update({ parentAuthUid: nextParentUid }));
  }
  await Promise.all(updates);
}

function hasAuthUid(member, uid) {
  return member.authUid === uid
    || (Array.isArray(member.authUids) && member.authUids.includes(uid))
    || (Array.isArray(member.authProviders) && member.authProviders.some(provider => provider?.uid === uid));
}

function removeAuthUid(member, uid) {
  if (member?.role !== 'parent') return member;
  const authProviders = (member.authProviders || []).filter(provider => provider?.uid !== uid);
  const authUids = (member.authUids || []).filter(authUid => authUid !== uid);
  return {
    ...member,
    authProviders,
    authUids,
    authUid: member.authUid === uid ? (authProviders[0]?.uid || authUids[0] || '') : member.authUid,
  };
}

async function deleteFamilyUserLinks(familyId) {
  const links = new Map();
  for (const field of ['familyId', 'familyCode']) {
    const snapshot = await db.collection('users').where(field, '==', familyId).get();
    snapshot.docs.forEach(userDoc => links.set(userDoc.ref.path, userDoc.ref));
  }

  const refs = [...links.values()];
  for (let offset = 0; offset < refs.length; offset += 450) {
    const batch = db.batch();
    refs.slice(offset, offset + 450).forEach(ref => batch.delete(ref));
    await batch.commit();
  }
}
