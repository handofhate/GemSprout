import { type ApprovalState, type ApprovalRequest, type Completion, type Member, type Prize } from '../../domain/requests';
import { executeOperation, planRequestOperationReads, planRequestOperationTransaction, type FirestoreWriteSpec, type OperationExecutionResult, type OperationRecord, type OperationState } from '../../sync';
import { completionPath, memberPath, operationPath, prizePath, requestPath } from '../../sync/firestore-paths';
import { OPERATION_STATUSES } from '../../sync/operation-model';
import { type FirestoreGateway, type FirestoreSetOptions, type FirestoreTransaction } from './firestore-gateway';

type DocData = Record<string, unknown>;

function clone<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function pathId(path: string): string {
  return path.split('/').at(-1) || '';
}

function setById<T extends { id?: string }>(target: Record<string, T>, value: T | null | undefined): void {
  if (!value?.id) return;
  target[value.id] = clone(value);
}

export class FakeFirestoreGateway implements FirestoreGateway {
  private docs = new Map<string, unknown>();

  constructor(seed: Record<string, unknown> = {}) {
    for (const [path, data] of Object.entries(seed)) {
      this.set(path, data);
    }
  }

  get<T = unknown>(path: string): T | null {
    return this.docs.has(path) ? clone(this.docs.get(path) as T) : null;
  }

  set(path: string, data: unknown, options: FirestoreSetOptions = {}): void {
    const current = this.docs.get(path);
    if (options.merge && isPlainObject(current) && isPlainObject(data)) {
      this.docs.set(path, { ...current, ...clone(data) });
      return;
    }
    this.docs.set(path, clone(data));
  }

  applyWrites(writes: FirestoreWriteSpec[]): void {
    for (const write of writes) {
      if (write.op !== 'set') throw new Error(`Unsupported fake write op: ${write.op}`);
      this.set(write.path, write.data, { merge: write.merge });
    }
  }

  runTransaction<T>(callback: (transaction: FirestoreTransaction) => T): T {
    const working = new FakeFirestoreGateway(this.dump());
    const result = callback(working);
    this.docs = new Map(Object.entries(working.dump()));
    return result;
  }

  dump(): Record<string, unknown> {
    return Object.fromEntries([...this.docs.entries()].map(([path, data]) => [path, clone(data)]));
  }
}

export const FakeFirestoreStore = FakeFirestoreGateway;

function isPlainObject(value: unknown): value is DocData {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function loadRequestOperationState(store: Pick<FirestoreGateway, 'get'>, operation: OperationRecord): OperationState {
  const familyId = operation.familyId;
  const requestId = operation.requestId || operation.payload.requestId || '';
  const state: OperationState = {
    membersById: {},
    completionsById: {},
    prizesById: {},
    requestsById: {},
    historyById: {},
    operationsById: {},
  };

  const existingOperation = store.get<OperationRecord>(operationPath(familyId, operation.id));
  if (existingOperation) setById(state.operationsById || {}, existingOperation);

  const request = requestId ? store.get<Partial<ApprovalRequest>>(requestPath(familyId, requestId)) : null;
  if (request?.id) {
    setById(state.requestsById || {}, request);

    if (request.targetMemberId) {
      const member = store.get<Member>(memberPath(familyId, request.targetMemberId));
      setById(state.membersById || {}, member);
    }
    if (request.source?.completionId) {
      const completion = store.get<Completion>(completionPath(familyId, request.source.completionId));
      setById(state.completionsById || {}, completion);
    }
    if (request.source?.prizeId) {
      const prize = store.get<Prize>(prizePath(familyId, request.source.prizeId));
      setById(state.prizesById || {}, prize);
    }
  }

  return state;
}

export type FakeOperationCommitResult = OperationExecutionResult & {
  reads: string[];
  writes: string[];
};

export function commitRequestOperation(gateway: FirestoreGateway, operation: OperationRecord, options: { now?: number } = {}): FakeOperationCommitResult {
  return gateway.runTransaction(transaction => {
    const requestId = operation.requestId || operation.payload.requestId || '';
    const readSpecs = requestId
      ? planRequestOperationReads(operation.familyId, operation.id, requestId)
      : [{ path: operationPath(operation.familyId, operation.id), reason: 'check operation idempotency' }];
    const state = loadRequestOperationState(transaction, operation);
    const execution = executeOperation(state, operation, options);
    const plan = planRequestOperationTransaction(execution);

    transaction.applyWrites(plan.writes);

    return {
      ...execution,
      reads: readSpecs.map(read => read.path),
      writes: plan.writes.map(write => write.path),
    };
  });
}

export function isAppliedOperation(gateway: FirestoreGateway, familyId: string, operationId: string): boolean {
  return gateway.get<OperationRecord>(operationPath(familyId, operationId))?.status === OPERATION_STATUSES.APPLIED;
}
