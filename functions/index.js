const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

// Fetch an OAuth2 access token directly from the GCP metadata server.
// This is the most reliable way to get credentials in Cloud Run.
async function getAccessToken() {
  const res = await fetch(
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    { headers: { 'Metadata-Flavor': 'Google' } }
  );
  if (!res.ok) throw new Error(`Metadata server error: ${res.status}`);
  const json = await res.json();
  return json.access_token;
}

exports.sendApprovalNotification = onCall({ invoker: 'public' }, async (request) => {
  const { familyCode, kidName, choreTitle } = request.data;

  if (!familyCode || typeof familyCode !== 'string' ||
      !kidName    || typeof kidName    !== 'string' ||
      !choreTitle || typeof choreTitle !== 'string') {
    throw new HttpsError('invalid-argument', 'Missing required fields: familyCode, kidName, choreTitle');
  }

  try {
    const db = admin.firestore();

    // Find all parent user docs for this family
    const snapshot = await db.collection('users')
      .where('familyCode', '==', familyCode)
      .get();

    if (snapshot.empty) return { sent: 0, reason: 'no_users' };

    // Collect all FCM tokens across all parent docs
    const tokenDocMap = new Map();
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

    console.log(`Sending FCM to ${tokens.length} token(s) for family ${familyCode}`);

    // Get access token directly from metadata server
    const accessToken = await getAccessToken();

    // Send to each token via FCM HTTP v1 API directly
    let successCount = 0;
    let failureCount = 0;
    const staleErrors = ['UNREGISTERED', 'INVALID_ARGUMENT'];
    const cleanupPromises = [];

    for (const token of tokens) {
      const body = {
        message: {
          token,
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
        },
      };

      const fcmRes = await fetch(
        'https://fcm.googleapis.com/v1/projects/gemsprout1/messages:send',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }
      );

      const fcmJson = await fcmRes.json();

      if (fcmRes.ok) {
        successCount++;
        console.log(`FCM send success for token: ${token.slice(0, 20)}...`);
      } else {
        failureCount++;
        console.error(`FCM send failed: status=${fcmRes.status} error=${JSON.stringify(fcmJson)}`);
        // Clean up stale tokens
        if (staleErrors.includes(fcmJson?.error?.details?.[0]?.errorCode)) {
          const docRef = tokenDocMap.get(token);
          if (docRef) {
            cleanupPromises.push(
              docRef.update({ fcmTokens: admin.firestore.FieldValue.arrayRemove(token) })
            );
          }
        }
      }
    }

    if (cleanupPromises.length > 0) await Promise.allSettled(cleanupPromises);

    return { sent: successCount, failed: failureCount };

  } catch (e) {
    console.error('sendApprovalNotification error:', e);
    throw new HttpsError('internal', e.message || 'Failed to send notification');
  }
});
