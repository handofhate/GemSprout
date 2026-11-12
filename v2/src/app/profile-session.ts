import type { AppMember } from './app-state';

export type ParentAuthIdentity = {
  uid: string;
  email?: string;
  providerId?: string;
};

export function readActiveProfileMemberId(raw: string | null, familyId: string): string | null {
  if (!raw || !familyId) return null;
  try {
    const session = JSON.parse(raw) as { familyId?: unknown; memberId?: unknown };
    if (session.familyId !== familyId || typeof session.memberId !== 'string' || !session.memberId) return null;
    return session.memberId;
  } catch {
    return null;
  }
}

export function serializeActiveProfile(familyId: string, memberId: string): string | null {
  if (!familyId || !memberId) return null;
  return JSON.stringify({ familyId, memberId });
}

export function isParentAuthLinkedToMember(member: AppMember, auth: ParentAuthIdentity | null): boolean {
  if (!auth?.uid || member.role !== 'parent' || !['google.com', 'apple.com'].includes(auth.providerId || '')) return false;
  const email = String(auth.email || '').toLowerCase();
  const providers = Array.isArray(member.authProviders) ? member.authProviders : [];
  return member.authUid === auth.uid
    || (member.authUids || []).includes(auth.uid)
    || providers.some(provider => provider.uid === auth.uid || (!!email && String(provider.email || '').toLowerCase() === email));
}
