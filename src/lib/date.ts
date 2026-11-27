const IST = 'Asia/Kolkata';

/** YYYY-MM-DD for a Date in Asia/Kolkata. */
export function istDateKey(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function currentYearIST(): number {
  return Number(istDateKey().slice(0, 4));
}

export function greeting(): string {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: '2-digit', hour12: false }).format(new Date()));
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
