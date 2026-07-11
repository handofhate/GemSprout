import { FakeFirestoreGateway } from '../platform/firebase';

const STORAGE_KEY = 'gemsprout.v2.approvalLab.store.v2';
const CHANNEL_NAME = 'gemsprout.v2.approvalLab';

type StoreFactory = () => FakeFirestoreGateway;

function canUseStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function readDump(): Record<string, unknown> | null {
  if (!canUseStorage()) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDump(dump: Record<string, unknown>): void {
  if (!canUseStorage()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dump));
}

export function loadSharedLabStore(seed: StoreFactory): FakeFirestoreGateway {
  const existing = readDump();
  if (existing) return new FakeFirestoreGateway(existing);
  const store = seed();
  writeDump(store.dump());
  return store;
}

export function saveSharedLabStore(store: FakeFirestoreGateway): void {
  writeDump(store.dump());
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ type: 'store-updated' });
    channel.close();
  } catch {
    window.dispatchEvent(new Event('gemsprout-v2-lab-updated'));
  }
}

export function resetSharedLabStore(seed: StoreFactory): FakeFirestoreGateway {
  const store = seed();
  writeDump(store.dump());
  saveSharedLabStore(store);
  return store;
}

export function subscribeSharedLabStore(onChange: () => void): () => void {
  const handleStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEY) onChange();
  };
  const handleFallback = (): void => onChange();
  window.addEventListener('storage', handleStorage);
  window.addEventListener('gemsprout-v2-lab-updated', handleFallback);

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = event => {
      if (event.data?.type === 'store-updated') onChange();
    };
  } catch {
    channel = null;
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener('gemsprout-v2-lab-updated', handleFallback);
    channel?.close();
  };
}
