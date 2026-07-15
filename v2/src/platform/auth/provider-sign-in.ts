import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { DEV_FIRESTORE_CONFIG } from '../firebase/dev-firestore-config';

type FirebaseAuthenticationPlugin = {
  signInWithGoogle?: () => Promise<NativeSignInResult>;
  signInWithApple?: () => Promise<NativeSignInResult>;
};

type NativeSignInResult = {
  credential?: { idToken?: string; nonce?: string } | null;
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
  await getCompatAuth().signOut();
}

export async function deleteCurrentParentAuth(): Promise<void> {
  const user = getCompatAuth().currentUser;
  if (user) await user.delete();
}

export function getCurrentParentAuthUid(): string {
  return getCompatAuth().currentUser?.uid || '';
}

export function getCurrentParentAuthUser(): ParentAuthUser | null {
  const user = getCompatAuth().currentUser;
  if (!user) return null;
  const providerId = user.providerData.find(provider => provider?.providerId === 'google.com' || provider?.providerId === 'apple.com')?.providerId
    || user.providerData[0]?.providerId
    || 'google.com';
  return normalizeAuthUser(user, providerId);
}

async function signInWithGoogle(): Promise<AuthUserLike | null> {
  const nativeAuth = getNativeAuthPlugin();
  const auth = getCompatAuth();
  if (nativeAuth?.signInWithGoogle) {
    const result = await nativeAuth.signInWithGoogle();
    const credential = firebase.auth.GoogleAuthProvider.credential(result.credential?.idToken);
    const userCredential = await auth.signInWithCredential(credential);
    return userCredential.user;
  }
  const provider = new firebase.auth.GoogleAuthProvider();
  await auth.signInWithPopup(provider);
  return auth.currentUser;
}

async function signInWithApple(): Promise<AuthUserLike | null> {
  const nativeAuth = getNativeAuthPlugin();
  const auth = getCompatAuth();
  const provider = new firebase.auth.OAuthProvider('apple.com');
  if (nativeAuth?.signInWithApple) {
    const result = await nativeAuth.signInWithApple();
    const credential = provider.credential({
      idToken: result.credential?.idToken,
      rawNonce: result.credential?.nonce,
    });
    const userCredential = await auth.signInWithCredential(credential);
    return userCredential.user;
  }
  await auth.signInWithPopup(provider);
  return auth.currentUser;
}

function getCompatAuth(): firebase.auth.Auth {
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(DEV_FIRESTORE_CONFIG);
  return app.auth();
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
