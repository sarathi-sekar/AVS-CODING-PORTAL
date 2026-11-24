export type Data = Record<string, unknown>;

export interface Tx {
  get(path: string): Promise<Data | null>;
  getMany(paths: string[]): Promise<(Data | null)[]>;
  /** Create or fully replace a document when the transaction commits. */
  set(path: string, data: Data): void;
}

export interface Store {
  get(path: string): Promise<Data | null>;
  transact<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

export const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
export const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
export const arr = <T = unknown>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
export const obj = (v: unknown): Data => (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) ? (v as Data) : {});
