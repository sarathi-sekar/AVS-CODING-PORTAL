const role = () => localStorage.getItem('mockRole') ?? 'student';
export const mockUser = { uid: 'stu1', email: 'sarathi@avsec.edu', displayName: 'Sarathi S', getIdToken: async () => 'tok' };
export const getAuth = () => ({ get currentUser() { return mockUser; } });
export const onAuthStateChanged = (_a: unknown, cb: (u: unknown) => void) => { setTimeout(() => cb(localStorage.getItem('mockSignedOut') ? null : mockUser), 0); return () => undefined; };
export const signOut = async () => undefined; export const signInWithEmailAndPassword = async () => undefined;
export const createUserWithEmailAndPassword = async () => ({ user: mockUser }); export const sendPasswordResetEmail = async () => undefined;
export const updateProfile = async () => undefined; export const deleteUser = async () => undefined;
export type User = typeof mockUser; export { role };
