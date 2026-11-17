const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const functions = require('firebase-functions/v1');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getParentAuthUids, isParentAccount } = require('./family-auth');

initializeApp();

const db = getFirestore();

exports.sendApprovalNotification = onCall({ region: 'us-central1' }, async request => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in before sending a notification.');

  const data = request.data || {};
  const familyCode = String(data.familyCode || '').trim().toUpperCase();
  const familyId = String(data.familyId || familyCode).trim();
  const kidName = String(data.kidName || 'A kid').trim();
  const title = String(data.choreTitle || data.choreName || data.prizeName || '').trim();
  const notificationType = String(data.notificationType || data.type || '').trim().toLowerCase();
  if (!familyCode && !familyId || !title) {
    throw new HttpsError('invalid-argument', 'Missing family or task details.');
  }

  const callerSnap = await db.doc(`users/${request.auth.uid}`).get();
  const caller = callerSnap.exists ? callerSnap.data() || {} : {};
  const callerFamily = String(caller.familyId || caller.familyCode || '').trim().toUpperCase();
  const requestedFamily = (familyCode || familyId).toUpperCase();
  if (callerFamily && callerFamily !== requestedFamily) {
    throw new HttpsError('permission-denied', 'The request does not belong to this family.');
  }

  const userRefs = new Map();
  const queries = [];
  if (familyCode) queries.push(db.collection('users').where('familyCode', '==', familyCode).get());
  if (familyId && familyId !== familyCode) queries.push(db.collection('users').where('familyId', '==', familyId).get());
  const snapshots = await Promise.all(queries);
  snapshots.forEach(snapshot => snapshot.docs.forEach(userDoc => userRefs.set(userDoc.id, userDoc)));

  const tokenDocMap = new Map();
  userRefs.forEach(userDoc => {
    const userData = userDoc.data() || {};
    const tokens = Array.isArray(userData.fcmTokens) ? userData.fcmTokens : [];
    tokens.forEach(token => {
      if (typeof token === 'string' && token) tokenDocMap.set(token, userDoc.ref);
    });
  });
  const tokens = [...tokenDocMap.keys()];
  if (!tokens.length) return { sent: 0, reason: 'no_tokens' };

  const isPrize = notificationType === 'prize_request';
  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: isPrize ? 'Prize Request!' : 'Task Complete!',
      body: `${kidName} ${isPrize ? 'requested' : 'finished'} "${title}"`,
    },
    data: {
      type: notificationType || 'approval_request',
      familyCode: familyCode || familyId,
      pendingCount: String(data.pendingCount || ''),
    },
    apns: {
      payload: {
        aps: { sound: 'default', badge: 1 },
      },
    },
  });

  const staleErrors = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
  ]);
  const cleanup = [];
  response.responses.forEach((result, index) => {
    if (!result.success && staleErrors.has(result.error?.code)) {
      const userRef = tokenDocMap.get(tokens[index]);
      if (userRef) cleanup.push(userRef.update({ fcmTokens: FieldValue.arrayRemove(tokens[index]) }));
    }
  });
  if (cleanup.length) await Promise.allSettled(cleanup);
  return { sent: response.successCount, failed: response.failureCount };
});

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
