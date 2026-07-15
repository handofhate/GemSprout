export const DEV_FIRESTORE_FAMILY_ID = 'migration-preview';
const DEV_FIRESTORE_CURRENT_FAMILY_KEY = 'gemsprout.v2.currentFirestoreFamilyId';

export const DEV_FIRESTORE_CONFIG = {
  projectId: 'gemsprout-v2-dev',
  appId: '1:578603238289:web:cf9d90b51580e437379030',
  storageBucket: 'gemsprout-v2-dev.firebasestorage.app',
  apiKey: 'AIzaSyBMVJlIRL1avzDjaZ3RB1ANCy5u2pAJlQE',
  authDomain: 'gemsprout-v2-dev.firebaseapp.com',
  messagingSenderId: '578603238289',
};

function storage(): Storage | null {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function getDevFirestoreFamilyId(): string {
  const stored = storage()?.getItem(DEV_FIRESTORE_CURRENT_FAMILY_KEY)?.trim();
  return stored || DEV_FIRESTORE_FAMILY_ID;
}

export function setDevFirestoreFamilyId(familyId: string): void {
  const normalized = familyId.trim();
  if (!normalized) return;
  storage()?.setItem(DEV_FIRESTORE_CURRENT_FAMILY_KEY, normalized);
}

export function clearDevFirestoreFamilyId(): void {
  storage()?.removeItem(DEV_FIRESTORE_CURRENT_FAMILY_KEY);
}
