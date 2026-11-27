export type StrengthLabel = 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
export interface Strength { score: 0 | 1 | 2 | 3 | 4; label: StrengthLabel; ok: boolean; hint: string }

/** Simple, explainable strength rule. A password is accepted from "Fair" upwards (8+ chars with letters and numbers). */
export function passwordStrength(pw: string): Strength {
  if (pw.length < 8) return { score: 0, label: 'Too short', ok: false, hint: 'Use at least 8 characters.' };
  const lower = /[a-z]/.test(pw);
  const upper = /[A-Z]/.test(pw);
  const digit = /\d/.test(pw);
  const symbol = /[^A-Za-z0-9]/.test(pw);
  const classes = [lower, upper, digit, symbol].filter(Boolean).length;
  let score = 1;
  if (classes >= 2) score = 2;
  if (classes >= 3 && pw.length >= 10) score = 3;
  if (classes === 4 && pw.length >= 12) score = 4;
  if (/^(.)\1+$/.test(pw) || /^(password|12345678|qwertyui)/i.test(pw)) score = 1;
  const needsMix = !(/[A-Za-z]/.test(pw) && digit);
  const ok = score >= 2 && !needsMix;
  const label: StrengthLabel = ok ? (score >= 4 ? 'Strong' : score === 3 ? 'Good' : 'Fair') : 'Weak';
  const hint = ok ? (score >= 3 ? 'Nice and strong.' : 'Add a capital letter or symbol to make it stronger.') : 'Mix letters and numbers.';
  return { score: (ok ? score : 1) as Strength['score'], label, ok, hint };
}
