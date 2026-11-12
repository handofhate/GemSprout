import { Capacitor } from '@capacitor/core';
import { Badge } from '@capawesome/capacitor-badge';

let latestCount = 0;
let latestRevision = 0;
let updateQueue: Promise<void> = Promise.resolve();

export function syncNativeAppBadge(count: number): Promise<void> {
  latestCount = Math.max(0, Math.floor(Number(count) || 0));
  const revision = ++latestRevision;
  updateQueue = updateQueue.catch(() => undefined).then(async () => {
    if (revision !== latestRevision || !Capacitor.isNativePlatform()) return;
    try {
      const support = await Badge.isSupported();
      if (!support.isSupported) return;
      await Badge.set({ count: latestCount });
    } catch (error) {
      console.warn('Could not sync the app icon badge:', error);
    }
  });
  return updateQueue;
}
