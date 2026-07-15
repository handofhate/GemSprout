import { initializeApp, getApp, getApps } from 'firebase/app';
import { collection, doc, getDoc, getDocs, getFirestore, initializeFirestore, limit, onSnapshot, orderBy, query, type Firestore, type Unsubscribe } from 'firebase/firestore';
import { type DemoAppState, type DemoCompletion, type DemoFamilySettings, type DemoHistoryRow, type DemoMember, type DemoPrize, type DemoRequest, type DemoTask, type DemoTeamGoal } from '../../app/local-demo-state';
import { DEV_FIRESTORE_CONFIG, getDevFirestoreFamilyId } from './dev-firestore-config';

type CompletionDoc = DemoCompletion;
type OperationDoc = { id?: string; status?: string; error?: { reason?: string } };

let devFirestore: Firestore | null = null;

export function getDevFirestore(): Firestore {
  if (devFirestore) return devFirestore;
  const app = getApps().length ? getApp() : initializeApp(DEV_FIRESTORE_CONFIG);
  try {
    const webViewSettings = {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
    } as unknown as Parameters<typeof initializeFirestore>[1];
    devFirestore = initializeFirestore(app, webViewSettings);
  } catch {
    devFirestore = getFirestore(app);
  }
  return devFirestore;
}

function byCreatedAtAsc<T extends { createdAt?: number }>(left: T, right: T): number {
  return Number(left.createdAt || 0) - Number(right.createdAt || 0);
}

function byCreatedAtDesc<T extends { createdAt?: number }>(left: T, right: T): number {
  return Number(right.createdAt || 0) - Number(left.createdAt || 0);
}

function chooseKid(members: DemoMember[]): DemoMember | null {
  return members.find(member => member.role === 'kid') || members.find(member => member.role !== 'parent') || members[0] || null;
}

function pickPrimaryRequest(requests: DemoRequest[]): DemoRequest | null {
  return requests.find(request => request.status === 'pending') || requests[0] || null;
}

function matchingCompletion(completions: CompletionDoc[], request: DemoRequest | null): CompletionDoc | null {
  const completionId = request?.source?.completionId || '';
  if (completionId) return completions.find(completion => completion.id === completionId) || null;
  return completions.find(completion => completion.status === 'pending') || completions[0] || null;
}

async function loadCollection<T>(db: Firestore, path: string): Promise<T[]> {
  const snapshot = await getDocs(collection(db, path));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as T);
}

async function loadHistory(db: Firestore, familyId: string): Promise<DemoHistoryRow[]> {
  try {
    const historyQuery = query(collection(db, `families/${familyId}/history`), orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(historyQuery);
    return snapshot.docs.map(item => ({ id: item.id, ...item.data() }) as DemoHistoryRow);
  } catch {
    const rows = await loadCollection<DemoHistoryRow>(db, `families/${familyId}/history`);
    return rows.sort(byCreatedAtDesc).slice(0, 100);
  }
}

export async function loadDevFirestoreState(familyId = getDevFirestoreFamilyId()): Promise<DemoAppState> {
  if (!familyId) throw new Error('No Firestore family is selected.');
  const db = getDevFirestore();
  const [familyDoc, members, tasks, prizes, requests, completions, operations, historyRows] = await Promise.all([
    getDoc(doc(db, `families/${familyId}`)),
    loadCollection<DemoMember>(db, `families/${familyId}/members`),
    loadCollection<DemoTask>(db, `families/${familyId}/chores`),
    loadCollection<DemoPrize>(db, `families/${familyId}/prizes`),
    loadCollection<DemoRequest>(db, `families/${familyId}/requests`),
    loadCollection<CompletionDoc>(db, `families/${familyId}/completions`),
    loadCollection<OperationDoc>(db, `families/${familyId}/operations`),
    loadHistory(db, familyId),
  ]);

  if (!familyDoc.exists()) {
    throw new Error(`Dev Firestore family "${familyId}" was not found.`);
  }

  const familyData = familyDoc.data() as { id?: string; name?: string; familyCode?: string; teamGoals?: DemoTeamGoal[]; settings?: DemoFamilySettings };
  const sortedRequests = requests.sort(byCreatedAtAsc);
  const request = pickPrimaryRequest(sortedRequests);
  return {
    familyId: familyData.id || familyId,
    familyCode: familyData.familyCode || '',
    familyName: familyData.name || '',
    member: chooseKid(members),
    members: members.sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''))),
    tasks: tasks.sort((left, right) => {
      const byGems = Number(left.gems ?? left.diamonds ?? 0) - Number(right.gems ?? right.diamonds ?? 0);
      if (byGems !== 0) return byGems;
      return String(left.title || '').localeCompare(String(right.title || ''));
    }),
    prizes: prizes.sort((left, right) => {
      const byCost = Number(left.cost || 0) - Number(right.cost || 0);
      if (byCost !== 0) return byCost;
      return String(left.title || '').localeCompare(String(right.title || ''));
    }),
    teamGoals: Array.isArray(familyData.teamGoals)
      ? [...familyData.teamGoals].sort((left, right) => {
        const byTarget = Number(left.targetPoints || 0) - Number(right.targetPoints || 0);
        if (byTarget !== 0) return byTarget;
        return String(left.title || '').localeCompare(String(right.title || ''));
      })
      : [],
    settings: familyData.settings || {},
    request,
    requests: sortedRequests,
    completions: completions.sort(byCreatedAtAsc),
    completion: matchingCompletion(completions, request),
    operation: operations[0] || null,
    history: historyRows[0] || null,
    historyRows,
  };
}

export function subscribeDevFirestoreState(
  onChange: () => void,
  familyId = getDevFirestoreFamilyId(),
): Unsubscribe {
  const db = getDevFirestore();
  let initialSnapshotsRemaining = 7;
  let debounceTimer = 0;
  const scheduleChange = (): void => {
    if (initialSnapshotsRemaining > 0) {
      initialSnapshotsRemaining -= 1;
      return;
    }
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(onChange, 120);
  };
  const unsubscribes = [
    onSnapshot(doc(db, `families/${familyId}`), scheduleChange, scheduleChange),
    onSnapshot(collection(db, `families/${familyId}/members`), scheduleChange, scheduleChange),
    onSnapshot(collection(db, `families/${familyId}/chores`), scheduleChange, scheduleChange),
    onSnapshot(collection(db, `families/${familyId}/prizes`), scheduleChange, scheduleChange),
    onSnapshot(collection(db, `families/${familyId}/requests`), scheduleChange, scheduleChange),
    onSnapshot(collection(db, `families/${familyId}/completions`), scheduleChange, scheduleChange),
    onSnapshot(query(collection(db, `families/${familyId}/history`), orderBy('createdAt', 'desc'), limit(100)), scheduleChange, scheduleChange),
  ];
  return () => {
    window.clearTimeout(debounceTimer);
    unsubscribes.forEach(unsubscribe => unsubscribe());
  };
}
