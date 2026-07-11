import { type FirestoreWriteSpec } from '../../sync';
import { type FirestoreGateway, type FirestoreSetOptions, type FirestoreTransaction } from './firestore-gateway';

type CompatDocSnapshot = {
  exists: boolean;
  data(): unknown;
};

type CompatDocRef = {
  get(): Promise<CompatDocSnapshot>;
  set(data: unknown, options?: FirestoreSetOptions): Promise<void>;
};

type CompatTransaction = {
  get(ref: CompatDocRef): Promise<CompatDocSnapshot>;
  set(ref: CompatDocRef, data: unknown, options?: FirestoreSetOptions): CompatTransaction;
};

export type CompatFirestore = {
  doc(path: string): CompatDocRef;
  runTransaction<T>(callback: (transaction: CompatTransaction) => Promise<T>): Promise<T>;
};

function snapshotData<T>(snapshot: CompatDocSnapshot): T | null {
  return snapshot.exists ? (snapshot.data() as T) : null;
}

export class CompatFirestoreGateway implements FirestoreGateway {
  constructor(private readonly firestore: CompatFirestore) {}

  get<T = unknown>(path: string): T | null {
    throw new Error(`CompatFirestoreGateway.get("${path}") must be used inside runTransaction or replaced by async gateway methods.`);
  }

  set(_path: string, _data: unknown, _options: FirestoreSetOptions = {}): void {
    throw new Error('CompatFirestoreGateway.set() must be used inside runTransaction or replaced by async gateway methods.');
  }

  applyWrites(_writes: FirestoreWriteSpec[]): void {
    throw new Error('CompatFirestoreGateway.applyWrites() must be used inside runTransaction or replaced by async gateway methods.');
  }

  runTransaction<T>(callback: (transaction: FirestoreTransaction) => T): T {
    throw new Error('CompatFirestoreGateway.runTransaction() is async in real Firestore. Use runAsyncTransaction().');
  }

  async runAsyncTransaction<T>(callback: (transaction: FirestoreTransaction) => T | Promise<T>): Promise<T> {
    return this.firestore.runTransaction(async compatTransaction => {
      const transaction = new CompatFirestoreGatewayTransaction(this.firestore, compatTransaction);
      return callback(transaction);
    });
  }
}

class CompatFirestoreGatewayTransaction implements FirestoreTransaction {
  private readCache = new Map<string, unknown | null>();
  private pendingWrites: FirestoreWriteSpec[] = [];

  constructor(
    private readonly firestore: CompatFirestore,
    private readonly transaction: CompatTransaction,
  ) {}

  get<T = unknown>(path: string): T | null {
    if (!this.readCache.has(path)) {
      throw new Error(`Document "${path}" was not preloaded. Use preload() before synchronous transaction reads.`);
    }
    return this.readCache.get(path) as T | null;
  }

  set(path: string, data: unknown, options: FirestoreSetOptions = {}): void {
    this.pendingWrites.push({ path, op: 'set', data, merge: options.merge === true, reason: 'gateway set' });
    this.transaction.set(this.firestore.doc(path), data, options);
  }

  applyWrites(writes: FirestoreWriteSpec[]): void {
    for (const write of writes) {
      if (write.op !== 'set') throw new Error(`Unsupported Firestore write op: ${write.op}`);
      this.set(write.path, write.data, { merge: write.merge });
    }
  }

  async preload(paths: string[]): Promise<void> {
    for (const path of paths) {
      const snapshot = await this.transaction.get(this.firestore.doc(path));
      this.readCache.set(path, snapshotData(snapshot));
    }
  }

  get writes(): FirestoreWriteSpec[] {
    return [...this.pendingWrites];
  }
}
