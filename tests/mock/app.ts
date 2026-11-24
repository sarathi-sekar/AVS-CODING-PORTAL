export class FirebaseError extends Error { code: string; constructor(code: string, m: string) { super(m); this.code = code; } }
export const initializeApp = () => ({});
export const getApp = () => ({});
export const deleteApp = async () => undefined;
export type FirebaseOptions = Record<string, unknown>;
