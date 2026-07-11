type CapacitorMessagingPlugin = {
  requestPermissions?: () => Promise<{ receive?: string }>;
  checkPermissions?: () => Promise<{ receive?: string }>;
  getToken?: () => Promise<{ token?: string }>;
  addListener?: (eventName: string, callback: (event: { token?: string; notification?: unknown; data?: unknown }) => void) => Promise<{ remove?: () => Promise<void> | void }>;
  removeAllListeners?: () => Promise<void>;
};

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: {
      FirebaseMessaging?: CapacitorMessagingPlugin;
    };
  };
};

export type PushRegistrationInput = {
  userId?: string;
  familyId?: string;
  memberId?: string;
  email?: string;
  notifyChoreApproval?: boolean;
  notifySavingsSpend?: boolean;
  saveToken?: (token: string, metadata: PushTokenMetadata) => Promise<void>;
  onForegroundNotification?: (event: unknown) => void;
  onNotificationAction?: (event: unknown) => void;
};

export type PushTokenMetadata = {
  userId?: string;
  familyId?: string;
  memberId?: string;
  email?: string;
  platform: 'ios' | 'native' | 'web';
  updatedAt: number;
};

export type PushRegistrationResult = {
  ok: boolean;
  status: 'disabled' | 'web-only' | 'plugin-missing' | 'permission-denied' | 'token-missing' | 'registered' | 'error';
  permission?: string;
  token?: string;
  message?: string;
};

let listenerUserId = '';
let listenerHandles: Array<{ remove?: () => Promise<void> | void }> = [];

export async function registerParentPushNotifications(input: PushRegistrationInput): Promise<PushRegistrationResult> {
  if (input.notifyChoreApproval === false && input.notifySavingsSpend === false) {
    return { ok: true, status: 'disabled' };
  }

  const capacitor = (window as CapacitorWindow).Capacitor;
  if (!capacitor?.isNativePlatform?.()) return { ok: false, status: 'web-only' };

  const messaging = capacitor.Plugins?.FirebaseMessaging;
  if (!messaging?.requestPermissions || !messaging.getToken) {
    return { ok: false, status: 'plugin-missing', message: 'FirebaseMessaging plugin not found.' };
  }

  try {
    const permission = await messaging.requestPermissions();
    if (permission?.receive && permission.receive !== 'granted') {
      return { ok: false, status: 'permission-denied', permission: permission.receive };
    }

    const tokenResult = await messaging.getToken();
    const token = tokenResult?.token || '';
    if (!token) return { ok: false, status: 'token-missing', permission: permission?.receive };

    const metadata: PushTokenMetadata = {
      userId: input.userId,
      familyId: input.familyId,
      memberId: input.memberId,
      email: input.email?.toLowerCase() || '',
      platform: 'native',
      updatedAt: Date.now(),
    };
    await input.saveToken?.(token, metadata);
    await bindPushListeners(messaging, token, input, metadata);
    return { ok: true, status: 'registered', permission: permission?.receive || 'granted', token };
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

async function bindPushListeners(
  messaging: CapacitorMessagingPlugin,
  token: string,
  input: PushRegistrationInput,
  metadata: PushTokenMetadata,
): Promise<void> {
  const nextListenerUserId = input.userId || input.memberId || token;
  if (listenerUserId === nextListenerUserId) return;
  await resetPushListeners(messaging);
  listenerUserId = nextListenerUserId;

  if (messaging.addListener) {
    listenerHandles.push(await messaging.addListener('tokenReceived', async event => {
      if (!event?.token) return;
      await input.saveToken?.(event.token, { ...metadata, updatedAt: Date.now() });
    }));
    listenerHandles.push(await messaging.addListener('notificationReceived', event => {
      input.onForegroundNotification?.(event);
    }));
    listenerHandles.push(await messaging.addListener('notificationActionPerformed', event => {
      input.onNotificationAction?.(event);
    }));
  }
}

async function resetPushListeners(messaging: CapacitorMessagingPlugin): Promise<void> {
  const handles = listenerHandles;
  listenerHandles = [];
  await Promise.all(handles.map(handle => Promise.resolve(handle.remove?.()).catch(() => undefined)));
  if (messaging.removeAllListeners) await messaging.removeAllListeners().catch(() => undefined);
}
