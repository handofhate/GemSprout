import { REQUEST_KINDS, REQUEST_STATUSES } from '../domain/requests';
import { completionPath, familyPath, historyPath, memberPath, prizePath, requestPath } from '../sync/firestore-paths';

type RecordValue = Record<string, unknown>;

export type V1ToV2MigrationOptions = {
  familyId: string;
  migratedAt?: number;
};

export type V2DocumentWrite = {
  path: string;
  data: RecordValue;
};

export type V1ToV2MigrationResult = {
  writes: V2DocumentWrite[];
  summary: {
    families: number;
    members: number;
    chores: number;
    completions: number;
    prizes: number;
    requests: number;
    history: number;
    users: number;
  };
  warnings: string[];
};

function asRecord(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asString(value: unknown, fallback = ''): string {
  return value == null ? fallback : String(value);
}

function asNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function cleanUndefined<T extends RecordValue>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function write(writes: V2DocumentWrite[], path: string, data: RecordValue): void {
  writes.push({ path, data: cleanUndefined(data) });
}

export function migrateV1FamilySnapshot(snapshotInput: unknown, options: V1ToV2MigrationOptions): V1ToV2MigrationResult {
  const snapshot = asRecord(snapshotInput);
  const family = asRecord(snapshot.family);
  const familyId = options.familyId;
  const migratedAt = options.migratedAt || Date.now();
  const warnings: string[] = [];
  const writes: V2DocumentWrite[] = [];

  write(writes, familyPath(familyId), {
    id: familyId,
    name: asString(family.name, 'Our Family'),
    setup: snapshot.setup === true,
    settings: asRecord(snapshot.settings),
    source: {
      version: asNumber(snapshot.v, 0),
      migratedAt,
      migration: 'v1-family-snapshot-to-v2',
    },
  });

  for (const member of asArray<RecordValue>(family.members)) {
    const memberId = asString(member.id);
    if (!memberId) {
      warnings.push('Skipped a member without an id.');
      continue;
    }
    write(writes, memberPath(familyId, memberId), {
      ...member,
      id: memberId,
      familyId,
      gems: asNumber(member.gems ?? member.diamonds, 0),
      diamonds: asNumber(member.diamonds ?? member.gems, 0),
      savings: asNumber(member.savings, 0),
      totalEarned: asNumber(member.totalEarned, 0),
      migratedAt,
    });
    for (const uid of authUidsForMember(member)) {
      write(writes, `users/${uid}`, {
        uid,
        familyId,
        memberId,
        role: asString(member.role),
        email: firstProviderEmail(member),
        migratedAt,
      });
    }
  }

  for (const chore of asArray<RecordValue>(snapshot.chores)) {
    const choreId = asString(chore.id);
    if (!choreId) {
      warnings.push('Skipped a chore without an id.');
      continue;
    }
    const { completions: completionsByMember, ...choreWithoutCompletions } = chore;
    write(writes, `${familyPath(familyId)}/chores/${choreId}`, {
      ...choreWithoutCompletions,
      id: choreId,
      familyId,
      migratedAt,
    });
    for (const [memberId, completions] of Object.entries(asRecord(completionsByMember))) {
      asArray<RecordValue>(completions).forEach((completion, index) => {
        const completionId = asString(completion.id, `${choreId}:${memberId}:${asString(completion.date, 'unknown')}:${index}`);
        write(writes, completionPath(familyId, completionId), {
          ...completion,
          id: completionId,
          familyId,
          choreId,
          memberId,
          points: asNumber(completion.points ?? chore.points ?? chore.diamonds, 0),
          migratedAt,
        });
        if (completion.status === 'pending') {
          write(writes, requestPath(familyId, `request:chore:${completionId}`), {
            id: `request:chore:${completionId}`,
            familyId,
            kind: completion.entryType === 'before' ? REQUEST_KINDS.CHORE_START : REQUEST_KINDS.CHORE_COMPLETION,
            status: REQUEST_STATUSES.PENDING,
            requesterMemberId: memberId,
            targetMemberId: memberId,
            createdAt: asNumber(completion.createdAt, migratedAt),
            resolvedAt: null,
            resolvedByMemberId: null,
            source: { choreId, completionId, prizeId: null, amount: null, reason: '' },
            snapshot: { title: asString(chore.title, 'Chore'), points: asNumber(completion.points ?? chore.points ?? chore.diamonds, 0) },
            migratedAt,
          });
        }
      });
    }
  }

  const prizesById = new Map<string, RecordValue>();
  for (const prize of asArray<RecordValue>(snapshot.prizes)) {
    const prizeId = asString(prize.id);
    if (!prizeId) {
      warnings.push('Skipped a prize without an id.');
      continue;
    }
    prizesById.set(prizeId, prize);
    write(writes, prizePath(familyId, prizeId), {
      ...prize,
      id: prizeId,
      familyId,
      migratedAt,
    });
  }

  for (const request of asArray<RecordValue>(snapshot.prizeRequests)) {
    const requestId = asString(request.id);
    if (!requestId) continue;
    const prizeId = asString(request.prizeId);
    const prize = prizesById.get(prizeId);
    write(writes, requestPath(familyId, requestId), {
      id: requestId,
      familyId,
      kind: REQUEST_KINDS.PRIZE_REDEEM,
      status: asString(request.status, REQUEST_STATUSES.PENDING),
      requesterMemberId: asString(request.memberId),
      targetMemberId: asString(request.memberId),
      createdAt: asNumber(request.createdAt, migratedAt),
      resolvedAt: request.resolvedAt == null ? null : asNumber(request.resolvedAt, migratedAt),
      resolvedByMemberId: asString(request.resolvedByMemberId, ''),
      source: { choreId: null, completionId: null, prizeId, amount: null, reason: '' },
      snapshot: { title: asString(request.title ?? prize?.title, 'Prize'), cost: asNumber(request.cost ?? prize?.cost, 0) },
      migratedAt,
    });
  }

  for (const request of asArray<RecordValue>(snapshot.savingsRequests)) {
    const requestId = asString(request.id);
    if (!requestId) continue;
    write(writes, requestPath(familyId, requestId), {
      id: requestId,
      familyId,
      kind: REQUEST_KINDS.SAVINGS_SPEND,
      status: asString(request.status, REQUEST_STATUSES.PENDING),
      requesterMemberId: asString(request.memberId),
      targetMemberId: asString(request.memberId),
      createdAt: asNumber(request.createdAt, migratedAt),
      resolvedAt: request.resolvedAt == null ? null : asNumber(request.resolvedAt, migratedAt),
      resolvedByMemberId: asString(request.resolvedByMemberId, ''),
      source: { choreId: null, completionId: null, prizeId: null, amount: asNumber(request.amount, 0), reason: asString(request.reason) },
      snapshot: { title: asString(request.reason, 'Savings request'), amount: asNumber(request.amount, 0) },
      migratedAt,
    });
  }

  asArray<RecordValue>(snapshot.history).forEach((entry, index) => {
    const id = asString(entry.id, `history:v1:${index}`);
    write(writes, historyPath(familyId, id), {
      ...entry,
      id,
      familyId,
      migratedAt,
    });
  });

  return { writes, summary: summarize(writes), warnings };
}

function authUidsForMember(member: RecordValue): string[] {
  const uids = new Set<string>();
  const authUid = asString(member.authUid);
  if (authUid) uids.add(authUid);
  for (const uid of asArray(member.authUids).map(value => asString(value)).filter(Boolean)) {
    uids.add(uid);
  }
  for (const provider of asArray<RecordValue>(member.authProviders)) {
    const uid = asString(provider.uid);
    if (uid) uids.add(uid);
  }
  return [...uids];
}

function firstProviderEmail(member: RecordValue): string {
  for (const provider of asArray<RecordValue>(member.authProviders)) {
    const email = asString(provider.email);
    if (email) return email.toLowerCase();
  }
  return '';
}

function summarize(writes: V2DocumentWrite[]): V1ToV2MigrationResult['summary'] {
  return {
    families: writes.filter(item => /^families\/[^/]+$/.test(item.path)).length,
    members: writes.filter(item => item.path.includes('/members/')).length,
    chores: writes.filter(item => item.path.includes('/chores/')).length,
    completions: writes.filter(item => item.path.includes('/completions/')).length,
    prizes: writes.filter(item => item.path.includes('/prizes/')).length,
    requests: writes.filter(item => item.path.includes('/requests/')).length,
    history: writes.filter(item => item.path.includes('/history/')).length,
    users: writes.filter(item => item.path.startsWith('users/')).length,
  };
}
