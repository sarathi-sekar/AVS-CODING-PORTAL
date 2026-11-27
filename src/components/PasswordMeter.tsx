import { passwordStrength } from '../lib/password';

const COLOR = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-600'];
const TEXT = ['text-red-600', 'text-red-600', 'text-amber-600', 'text-lime-700', 'text-emerald-700'];

export function PasswordMeter({ password }: { password: string }) {
  if (!password) return null;
  const s = passwordStrength(password);
  const filled = password.length < 8 ? 1 : s.score;
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= filled ? COLOR[s.score] : 'bg-subtle'}`} />)}
      </div>
      <p className="mt-1 text-xs"><span className={`font-semibold ${TEXT[s.score]}`}>{s.label}</span> <span className="text-muted">- {s.hint}</span></p>
    </div>
  );
}
