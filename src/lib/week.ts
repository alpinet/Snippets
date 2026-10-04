// Week math in the user's local timezone. Weeks run Monday → Sunday.
// Dates are passed around as ISO "YYYY-MM-DD" strings (local calendar days).

export type ISODate = string;

let offsetMs = 0;
/** Demo/dev only: shift the app clock (e.g. to preview Sunday). Server clock is authoritative. */
export function setClockOffset(ms: number) {
  offsetMs = ms;
}
export function now(): Date {
  return new Date(Date.now() + offsetMs);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = parseISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** 0 = Monday … 6 = Sunday */
export function dayIndex(s: ISODate): number {
  return (parseISODate(s).getDay() + 6) % 7;
}

export function weekStartOf(s: ISODate): ISODate {
  return addDays(s, -dayIndex(s));
}

export function today(): ISODate {
  return toISODate(now());
}

export function currentWeekStart(): ISODate {
  return weekStartOf(today());
}

export function isSunday(s: ISODate = today()): boolean {
  return dayIndex(s) === 6;
}

/** The week whose social exchange is current: this week on Sunday, otherwise last week. */
export function socialWeekStart(): ISODate {
  return isSunday() ? currentWeekStart() : addDays(currentWeekStart(), -7);
}

export function weekDays(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "Sep 21 – 27" or "Sep 28 – Oct 4" */
export function formatWeekRange(weekStart: ISODate, compact = false): string {
  const a = parseISODate(weekStart);
  const b = parseISODate(addDays(weekStart, 6));
  const dash = compact ? '–' : ' – ';
  if (a.getMonth() === b.getMonth()) return `${MONTH_SHORT[a.getMonth()]} ${a.getDate()}${dash}${b.getDate()}`;
  return `${MONTH_SHORT[a.getMonth()]} ${a.getDate()}${dash}${MONTH_SHORT[b.getMonth()]} ${b.getDate()}`;
}

/** "Wed, Sep 23" */
export function formatDay(s: ISODate): string {
  const d = parseISODate(s);
  return `${DAY_SHORT[dayIndex(s)]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** "Wednesday, Sep 23" */
export function formatDayLong(s: ISODate): string {
  const d = parseISODate(s);
  return `${DAY_LONG[dayIndex(s)]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "September" */
export function monthName(s: ISODate): string {
  return MONTH_LONG[parseISODate(s).getMonth()];
}

/** "May 23, 2025" */
export function formatLongDate(s: ISODate): string {
  const d = parseISODate(s);
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "September 2026" */
export function formatMonth(s: ISODate): string {
  const d = parseISODate(s);
  return `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export function monthKey(s: ISODate): string {
  return s.slice(0, 7);
}

/** Time until the next Sunday 00:00 local. */
export function untilSunday(): { days: number; hours: number; minutes: number } {
  const n = now();
  const next = parseISODate(addDays(currentWeekStart(), 6));
  const ms = Math.max(0, next.getTime() - n.getTime());
  const minutes = Math.floor(ms / 60000);
  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 };
}

export function timezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}
