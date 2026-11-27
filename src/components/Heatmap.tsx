import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { DailyActivity } from '../types';
import { currentYearIST, istDateKey } from '../lib/date';
import { useNarrow } from '../lib/useNarrow';

const DAILY_GOAL_MINUTES = 10;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function heatLevel(solved: number): 0 | 1 | 2 | 3 | 4 {
  if (solved <= 0) return 0;
  if (solved === 1) return 1;
  if (solved <= 4) return 2;
  if (solved <= 9) return 3;
  return 4;
}

interface Cell {
  key: string;
  date: Date;
}

function buildWeeks(year: number): (Cell | null)[][] {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  const weeks: (Cell | null)[][] = [];
  let week: (Cell | null)[] = Array(start.getUTCDay()).fill(null);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const copy = new Date(d);
    week.push({ key: copy.toISOString().slice(0, 10), date: copy });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

interface Props {
  year: number;
  onYearChange: (y: number) => void;
  activity: Record<string, DailyActivity>;
  loading?: boolean;
}

export function Heatmap({ year, onYearChange, activity, loading }: Props) {
  const allWeeks = useMemo(() => buildWeeks(year), [year]);
  const narrow = useNarrow();
  // Phones show the latest 26 weeks so cells stay tappable and the page never scrolls sideways.
  const weeks = useMemo(() => {
    if (!narrow) return allWeeks;
    const t = istDateKey();
    let end = allWeeks.length - 1;
    if (t.startsWith(String(year))) end = Math.max(0, allWeeks.findIndex((w) => w.some((c) => c?.key === t)));
    return allWeeks.slice(Math.max(0, end - 25), end + 1);
  }, [allWeeks, narrow, year]);
  const [pinned, setPinned] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const selected = hover ?? pinned;
  const today = istDateKey();
  const thisYear = currentYearIST();

  let lastLabel = -10;
  let lastMonth = -1;
  const monthLabels = weeks.map((w, i) => {
    const first = w.find(Boolean);
    if (!first) return '';
    const m = first.date.getUTCMonth();
    if (m === lastMonth) return '';
    lastMonth = m;
    if (i - lastLabel < 3) return ''; // avoid overlapping labels on narrow screens
    lastLabel = i;
    return MONTHS[m];
  });

  const sel = selected ? activity[selected] : undefined;
  const selDate = selected ? new Date(selected + 'T00:00:00Z') : null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-end gap-1">
        <button type="button" aria-label="Previous year" onClick={() => onYearChange(year - 1)} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-subtle">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[3rem] text-center text-sm font-medium">{year}</span>
        <button type="button" aria-label="Next year" disabled={year >= thisYear} onClick={() => onYearChange(year + 1)} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-subtle disabled:opacity-40">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className={loading ? 'opacity-60' : ''}>
        <div className="mb-1 grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }} aria-hidden>
          {monthLabels.map((m, i) => <span key={i} className="overflow-visible whitespace-nowrap text-[9px] leading-none text-muted sm:text-[10px]">{m}</span>)}
        </div>
        <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
          {weeks.map((w, wi) => (
            <div key={wi} className="flex min-w-0 flex-col gap-[2px]">
              {w.map((c, di) => {
                if (!c) return <span key={di} className="aspect-square w-full" />;
                const a = activity[c.key];
                const lvl = heatLevel(a?.solved ?? 0);
                const future = c.key > today;
                return (
                  <button key={di} type="button" disabled={future} onClick={() => setPinned(c.key)} onMouseEnter={() => setHover(c.key)} onMouseLeave={() => setHover(null)} onFocus={() => setPinned(c.key)}
                    aria-label={`${c.key}: ${a?.solved ?? 0} solved`}
                    className={`aspect-square w-full rounded-[2px] ${selected === c.key ? 'ring-2 ring-brand-ink' : ''} ${future ? 'opacity-30' : ''}`}
                    style={{ backgroundColor: `rgb(var(--heat${lvl}))` }} />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <div className="min-h-[2.5rem] flex-1 text-ink" aria-live="polite">
          {selected && selDate ? (
            <>
              <p className="font-medium">{selDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</p>
              <p className="text-muted">
                Attempted {sel?.attempted ?? 0} · Solved {sel?.solved ?? 0} · {sel?.minutes ?? 0} min ·{' '}
                {(sel?.minutes ?? 0) >= DAILY_GOAL_MINUTES ? 'Daily goal met' : 'Daily goal not met'}
              </p>
            </>
          ) : (
            <p className="text-muted">Hover or tap a day to see details.</p>
          )}
        </div>
        <div className="flex items-center gap-1" aria-hidden>
          Less
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="h-[12px] w-[12px] rounded-[3px]" style={{ backgroundColor: `rgb(var(--heat${l}))` }} />
          ))}
          More
        </div>
      </div>
    </div>
  );
}
