import { useMemo, useState } from 'react';
import { collection, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useQueryDocs } from '../lib/useDocs';
import type { LeaderboardEntry } from '../types';
import { Avatar, EmptyState, ErrorNote, PageHeader, Spinner } from '../components/ui';

export default function Leaderboard() {
  const { profile } = useAuth();
  const [dept, setDept] = useState('');
  const board = useQueryDocs<LeaderboardEntry & { solved: number }>(() => query(collection(db, 'leaderboard'), orderBy('points', 'desc'), limit(100)), 'lb', (id, d) => ({ ...(d as Omit<LeaderboardEntry & { solved: number }, 'uid'>), uid: id }));
  const depts = useMemo(() => [...new Set(board.data.map((b) => b.department))].sort(), [board.data]);
  const rows = board.data.filter((b) => !dept || b.department === dept);
  return (
    <>
      <PageHeader title="Leaderboard" subtitle="Ranked by XP earned from verified problems, lessons and tests." action={<select className="input !w-auto" aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All departments</option>{depts.map((d) => <option key={d}>{d}</option>)}</select>} />
      {board.error && <ErrorNote message={board.error} />}
      <div className="card !p-0">
        {board.loading ? <Spinner /> : rows.length === 0 ? <EmptyState title="No rankings yet" hint="Solve a problem or complete a lesson to appear here." /> : (
          <ol>{rows.map((b, i) => (
            <li key={b.uid} className={`flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 ${b.uid === profile?.uid ? 'bg-brand-soft' : ''}`}>
              <span className="w-7 text-center text-sm font-semibold text-muted">{i + 1}</span><Avatar name={b.displayName} size={32} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{b.displayName}</p><p className="truncate text-xs text-muted">{b.department}</p></div>
              <div className="text-right"><p className="text-sm font-semibold">{b.points} XP</p><p className="text-xs text-muted">{b.solved} solved</p></div>
            </li>))}</ol>
        )}
      </div>
    </>
  );
}
