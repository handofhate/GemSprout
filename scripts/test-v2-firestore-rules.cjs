const fs = require('node:fs');
const path = require('node:path');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} = require('firebase/firestore');

async function main() {
  const rules = fs.readFileSync(path.join(__dirname, '..', 'v2', 'firestore.production.rules'), 'utf8');
  const testEnv = await initializeTestEnvironment({
    projectId: 'demo-gemsprout-rules',
    firestore: { rules },
  });

  try {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, 'families/COLLUM'), {
          family: { members: [{ id: 'parent-1', role: 'parent' }] },
          familyCode: 'COLLUM',
          name: 'Legacy family',
        }),
        setDoc(doc(db, 'families/QAERA6'), { familyCode: 'QAERA6', name: 'V2 family' }),
        setDoc(doc(db, 'families/COLLUM/members/kid-1'), { role: 'kid' }),
        setDoc(doc(db, 'families/QAERA6/members/kid-2'), { role: 'kid' }),
        setDoc(doc(db, 'users/parent-a'), { uid: 'parent-a', familyId: 'COLLUM', familyCode: 'COLLUM', email: 'a@example.com' }),
        setDoc(doc(db, 'users/parent-b'), { uid: 'parent-b', familyId: 'QAERA6', familyCode: 'QAERA6', email: 'b@example.com' }),
        setDoc(doc(db, 'invites/invite-a'), { email: 'a@example.com', familyCode: 'COLLUM' }),
        setDoc(doc(db, 'invites/invite-b'), { email: 'b@example.com', familyCode: 'QAERA6' }),
      ]);
    });

    const familyA = testEnv.authenticatedContext('parent-a', { email: 'a@example.com' }).firestore();
    const familyB = testEnv.authenticatedContext('parent-b', { email: 'b@example.com' }).firestore();

    await assertSucceeds(getDoc(doc(familyA, 'families/COLLUM')));
    await assertSucceeds(updateDoc(doc(familyA, 'families/COLLUM'), { lastV1SyncAt: 1 }));
    await assertSucceeds(getDoc(doc(familyA, 'families/COLLUM/members/kid-1')));
    await assertSucceeds(getDoc(doc(familyB, 'families/QAERA6/members/kid-2')));
    await assertFails(getDoc(doc(familyB, 'families/COLLUM/members/kid-1')));
    await assertFails(getDoc(doc(familyA, 'families/QAERA6/members/kid-2')));
    await assertFails(getDocs(collection(familyA, 'families')));
    await assertSucceeds(getDoc(doc(familyA, 'users/parent-a')));
    await assertFails(getDoc(doc(familyA, 'users/parent-b')));
    await assertSucceeds(getDocs(query(collection(familyA, 'users'), where('email', '==', 'a@example.com'))));
    await assertFails(getDocs(collection(familyA, 'users')));
    await assertSucceeds(getDocs(query(collection(familyA, 'invites'), where('email', '==', 'a@example.com'))));
    await assertFails(getDocs(collection(familyA, 'invites')));

    const kidA = testEnv.authenticatedContext('kid-a').firestore();
    await assertSucceeds(getDoc(doc(kidA, 'families/COLLUM')));
    await assertSucceeds(setDoc(doc(kidA, 'users/kid-a'), {
      uid: 'kid-a', familyId: 'COLLUM', familyCode: 'COLLUM', role: 'kid',
    }));
    await assertSucceeds(getDoc(doc(kidA, 'families/COLLUM/members/kid-1')));
    await assertSucceeds(updateDoc(doc(kidA, 'families/COLLUM'), { lastKidSyncAt: 1 }));
    await assertFails(updateDoc(doc(kidA, 'users/kid-a'), { familyCode: 'bad-code' }));

    const unlinked = testEnv.authenticatedContext('unlinked-user').firestore();
    await assertSucceeds(getDoc(doc(unlinked, 'families/COLLUM')));
    await assertFails(updateDoc(doc(unlinked, 'families/COLLUM'), { name: 'Hijacked' }));
    await assertFails(deleteDoc(doc(unlinked, 'families/COLLUM')));

    const newParent = testEnv.authenticatedContext('new-parent', { email: 'new@example.com' }).firestore();
    const batch = writeBatch(newParent);
    batch.set(doc(newParent, 'families/NEW234'), {
      id: 'NEW234', familyCode: 'NEW234', name: 'New family', parentAuthUid: 'new-parent',
    });
    batch.set(doc(newParent, 'families/NEW234/members/new-parent'), { id: 'new-parent', role: 'parent' });
    batch.set(doc(newParent, 'users/new-parent'), {
      uid: 'new-parent', familyId: 'NEW234', familyCode: 'NEW234', email: 'new@example.com',
    });
    await assertSucceeds(batch.commit());
    await assertSucceeds(getDoc(doc(newParent, 'families/NEW234/members/new-parent')));

    console.log('Firestore production rules checks passed.');
  } finally {
    await testEnv.cleanup();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
