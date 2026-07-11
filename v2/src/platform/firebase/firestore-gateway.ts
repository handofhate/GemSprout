import { type FirestoreWriteSpec } from '../../sync';

export type FirestoreSetOptions = {
  merge?: boolean;
};

export type FirestoreTransaction = {
  get<T = unknown>(path: string): T | null;
  set(path: string, data: unknown, options?: FirestoreSetOptions): void;
  applyWrites(writes: FirestoreWriteSpec[]): void;
};

export type FirestoreGateway = {
  get<T = unknown>(path: string): T | null;
  set(path: string, data: unknown, options?: FirestoreSetOptions): void;
  applyWrites(writes: FirestoreWriteSpec[]): void;
  runTransaction<T>(callback: (transaction: FirestoreTransaction) => T): T;
};
