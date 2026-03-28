const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

if (getApps().length === 0) initializeApp();

exports.sendApprovalNotification = onCall(async (request) => {
  const { familyCode, kidName, choreTitle } = request.data;

  if (!familyCode || typeof familyCode !== 'string' ||
      !kidName    || typeof kidName    !== 'string' ||
      !choreTitle || typeof choreTitle !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing required fields: familyCode, kidName, choreTitle');
  }

  try {
    const db = getFirestore();

    // Find all parent user docs for this family
    const snapshot = await db.collection('users')
      .where('familyCode', '==', familyCode)
      .get();

    if (snapshot.empty) return { sent: 0, reason: 'no_users' };

    // Collect all FCM tokens across all parent docs
    const tokenDocMap = new Map(); // token -> docRef (for stale token cleanup)
    snapshot.forEach(doc => {
      const tokens = doc.data().fcmTokens;
      if (Array.isArray(tokens)) {
        tokens.forEach(t => {
          if (t && typeof t === 'string') tokenDocMap.set(t, doc.ref);
        });
      }
    });

    const tokens = [...new Set(tokenDocMap.keys())];
    if (tokens.length === 0) return { sent: 0, reason: 'no_tokens' };

    const message = {
      tokens,
      notification: {
        title: 'Chore Complete! 🌱',
        body: `${kidName} finished "${choreTitle}"`,
      },
      data: {
        type: 'approval_request',
        familyCode,
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await getMessaging().sendEachForMulticast(message);

    // Clean up stale tokens
    const staleErrors = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];
    const cleanupPromises = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && staleErrors.includes(resp.error?.code)) {
        const staleToken = tokens[idx];
        const docRef = tokenDocMap.get(staleToken);
        if (docRef) {
          cleanupPromises.push(docRef.update({ fcmTokens: FieldValue.arrayRemove(staleToken) }));
        }
      }
    });
    if (cleanupPromises.length > 0) await Promise.allSettled(cleanupPromises);

    return { sent: response.successCount, failed: response.failureCount };

  } catch (e) {
    console.error('sendApprovalNotification error:', e);
    throw new HttpsError('internal', 'Failed to send notification');
  }
});
