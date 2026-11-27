import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, type Firestore } from 'firebase/firestore';

const env = import.meta.env;

export const firebaseOptions: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const firebaseConfigured = Boolean(firebaseOptions.apiKey && firebaseOptions.projectId && firebaseOptions.appId);

const app = initializeApp(
  firebaseConfigured ? firebaseOptions : { apiKey: 'unset', projectId: 'unset', appId: 'unset', authDomain: 'unset' },
);

export const auth = getAuth(app);
// - long polling auto-detect: college/office networks often block Firestore's streaming connection
// - ignoreUndefinedProperties: optional fields left empty must never crash a save
// - persistent cache: repeat visits load instantly from the browser, then refresh from the server
function makeDb(): Firestore {
  const base = { experimentalAutoDetectLongPolling: true, ignoreUndefinedProperties: true } as const;
  try {
    return initializeFirestore(app, { ...base, localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    return initializeFirestore(app, base);
  }
}
export const db = makeDb();
