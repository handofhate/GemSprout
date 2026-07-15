import { deleteUser, getAuth, GoogleAuthProvider, OAuthProvider, signInWithCredential, signInWithPopup, signOut, type User } from 'firebase/auth';

type FirebaseAuthenticationPlugin = {
  signInWithGoogle?: () => Promise<NativeSignInResult>;
  signInWithApple?: () => Promise<NativeSignInResult>;
};

type NativeSignInResult = {
  credential?: { idToken?: string; nonce?: string } | null;
  user?: AuthUserLike | null;
};

type AuthUserLike = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
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
};

let lastParentAuthError = '';

export async function signInParentWithProvider(providerId: AuthProviderId): Promise<ParentAuthUser | null> {
  lastParentAuthError = '';
  try {
    const user = providerId === 'google'
      ? await signInWithGoogle()
      : await signInWithApple();
    return user ? normalizeAuthUser(user, providerId === 'google' ? 'google.com' : 'apple.com') : null;
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code || '') : '';
    const message = error instanceof Error ? error.message : String(error);
    lastParentAuthError = [code, message].filter(Boolean).join(': ');
    if (!/cancel/i.test(message)) console.warn(`${providerId} sign-in failed:`, message);
    return null;
  }
}

export function getLastParentAuthError(): string {
  return lastParentAuthError;
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

async function signInWithGoogle(): Promise<AuthUserLike | null> {
  const nativeAuth = getNativeAuthPlugin();
  const auth = getAuth();
  if (nativeAuth?.signInWithGoogle) {
    const result = await nativeAuth.signInWithGoogle();
    if (result.credential?.idToken) {
      const credential = GoogleAuthProvider.credential(result.credential.idToken);
      return (await signInWithCredential(auth, credential)).user;
    }
    return result.user || auth.currentUser;
  }
  return (await signInWithPopup(auth, new GoogleAuthProvider())).user;
}

async function signInWithApple(): Promise<AuthUserLike | null> {
  const nativeAuth = getNativeAuthPlugin();
  const auth = getAuth();
  const provider = new OAuthProvider('apple.com');
  if (nativeAuth?.signInWithApple) {
    const result = await nativeAuth.signInWithApple();
    if (result.credential?.idToken) {
      const credential = provider.credential({
        idToken: result.credential.idToken,
        rawNonce: result.credential.nonce,
      });
      return (await signInWithCredential(auth, credential)).user;
    }
    return result.user || auth.currentUser;
  }
  return (await signInWithPopup(auth, provider)).user;
}

function getNativeAuthPlugin(): FirebaseAuthenticationPlugin | null {
  const capacitor = (window as CapacitorWindow).Capacitor;
  if (!capacitor?.isNativePlatform?.()) return null;
  return capacitor.Plugins?.FirebaseAuthentication || null;
}

function normalizeAuthUser(user: AuthUserLike, providerId: string): ParentAuthUser {
  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    providerId,
  };
}
