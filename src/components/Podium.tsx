import { Crown } from 'lucide-react';
import { Avatar } from './ui';
import type { LeaderboardEntry } from '../types';

const STYLE = [
  { h: 'h-20', ring: 'ring-amber-400', tone: 'bg-amber-100 dark:bg-amber-950/50' },
  { h: 'h-14', ring: 'ring-slate-400', tone: 'bg-slate-100 dark:bg-slate-800/60' },
  { h: 'h-10', ring: 'ring-orange-400', tone: 'bg-orange-100 dark:bg-orange-950/50' },
];

/** Top-3 podium (order shown: 2nd, 1st, 3rd). */
export function Podium({ top }: { top: LeaderboardEntry[] }) {
  if (top.length === 0) return null;
  const order = [1, 0, 2].filter((i) => top[i]);
  return (
    <div className="mt-4 flex items-end justify-center gap-2" aria-label="Top three">
      {order.map((i) => (
        <div key={top[i].uid} className="flex w-1/3 max-w-[110px] flex-col items-center text-center">
          {i === 0 && <Crown className="mb-0.5 h-5 w-5 text-amber-500" aria-hidden />}
          <span className={`rounded-full ring-2 ${STYLE[i].ring}`}><Avatar name={top[i].displayName} size={i === 0 ? 48 : 40} /></span>
          <p className="mt-1 w-full truncate text-xs font-medium">{top[i].displayName}</p>
          <p className="text-[11px] text-muted">{top[i].points} XP</p>
          <div className={`mt-1 flex w-full items-start justify-center rounded-t-lg pt-1 text-sm font-bold ${STYLE[i].h} ${STYLE[i].tone}`}>{i + 1}</div>
        </div>
      ))}
    </div>
  );
}
