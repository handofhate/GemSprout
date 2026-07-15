import { deleteUser, getAuth, GoogleAuthProvider, OAuthProvider, signInWithCredential, signInWithPopup, signOut, type User } from 'firebase/auth';

type FirebaseAuthenticationPlugin = {
  signInWithGoogle?: (options?: { skipNativeAuth?: boolean }) => Promise<NativeAuthResult>;
  signInWithApple?: (options?: { skipNativeAuth?: boolean }) => Promise<NativeAuthResult>;
};

type NativeAuthResult = {
  credential?: { idToken?: string; accessToken?: string; nonce?: string };
  user?: {
    uid?: string;
    email?: string | null;
    displayName?: string | null;
    providerId?: string | null;
  };
};

type CapacitorWindow = Window & {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    Plugins?: {
      FirebaseAuthentication?: FirebaseAuthenticationPlugin;
    };
  };
};

export type AuthProviderId = 'google' | 'apple';

export type ParentAuthUser = {
  uid: string;
  email: string;
  displayName: string;
  providerId: string;
  isDevBypass?: boolean;
};

export async function signInParentWithProvider(providerId: AuthProviderId): Promise<ParentAuthUser | null> {
  try {
    const user = providerId === 'google'
      ? await signInWithGoogle()
      : await signInWithApple();
    return user ? normalizeAuthUser(user, providerId === 'google' ? 'google.com' : 'apple.com') : null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/cancel/i.test(message)) console.warn(`${providerId} sign-in failed:`, message);
    return null;
  }
}

export function createDevBypassParentAuth(): ParentAuthUser {
  const now = Date.now();
  return {
    uid: `dev-parent-${now}`,
    email: 'dev-parent@gemsprout.local',
    displayName: 'Parent',
    providerId: 'dev-bypass',
    isDevBypass: true,
  };
}

export async function signOutParentAuth(): Promise<void> {
  await signOut(getAuth());
}

export async function deleteCurrentParentAuth(): Promise<void> {
  const user = getAuth().currentUser;
  if (user) await deleteUser(user);
}

export function getCurrentParentAuthUid(): string {
  return getAuth().currentUser?.uid || '';
}

export function getCurrentParentAuthInfo(): ParentAuthUser | null {
  const user = getAuth().currentUser;
  if (!user) return null;
  const providerId = user.providerData[0]?.providerId || 'unknown';
  return normalizeAuthUser(user, providerId);
}

async function signInWithGoogle(): Promise<User | null> {
  const nativeAuth = getNativeAuthPlugin();
  const auth = getAuth();
  if (nativeAuth?.signInWithGoogle) {
    const result = await nativeAuth.signInWithGoogle({ skipNativeAuth: true });
    const idToken = result.credential?.idToken || undefined;
    const accessToken = result.credential?.accessToken || undefined;
    if (!idToken && !accessToken) {
      throw new Error('Google sign-in did not return an OAuth token for Firebase Auth.');
    }
    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    return (await signInWithCredential(auth, credential)).user;
  }
  return (await signInWithPopup(auth, new GoogleAuthProvider())).user;
}

async function signInWithApple(): Promise<User | null> {
  const nativeAuth = getNativeAuthPlugin();
  const auth = getAuth();
  const provider = new OAuthProvider('apple.com');
  if (nativeAuth?.signInWithApple) {
    const result = await nativeAuth.signInWithApple({ skipNativeAuth: true });
    if (!result.credential?.idToken) {
      throw new Error('Apple sign-in did not return an ID token for Firebase Auth.');
    }
    const credential = provider.credential({
      idToken: result.credential?.idToken,
      rawNonce: result.credential?.nonce,
    });
    return (await signInWithCredential(auth, credential)).user;
  }
  return (await signInWithPopup(auth, provider)).user;
}

function getNativeAuthPlugin(): FirebaseAuthenticationPlugin | null {
  const capacitor = (window as CapacitorWindow).Capacitor;
  if (!capacitor?.isNativePlatform?.()) return null;
  return capacitor.Plugins?.FirebaseAuthentication || null;
}

function normalizeAuthUser(user: User, providerId: string): ParentAuthUser {
  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    providerId,
  };
}
