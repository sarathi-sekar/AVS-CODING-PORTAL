import { FirebaseError } from 'firebase/app';

export function friendlyError(e: unknown): string {
  if (e instanceof FirebaseError) {
    switch (e.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
      case 'auth/invalid-email':
        return 'Invalid email or password.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Please log in instead.';
      case 'auth/weak-password':
        return 'Password must be at least 6 characters.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a few minutes and try again.';
      case 'auth/network-request-failed':
      case 'unavailable':
        return 'Network problem. Check your internet connection and try again.';
      case 'permission-denied':
        return 'You do not have permission to do that.';
      default:
        return e.message.replace('Firebase: ', '');
    }
  }
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}
