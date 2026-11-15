// Lookback rituals, as plain functions over your archive. No counts to beat, no streaks.
import { MOMENT_KINDS, type MomentKind, type MonthPicks, type Snippet } from './api/types';
import { addDays, dayIndex, monthKey, parseISODate, toISODate, type ISODate } from './week';

export type Thread = { kind: MomentKind; title: string; snippets: Snippet[] };

/** "Your firsts this year", "Small joys this year"… one per kind you've used this year, newest moments first. */
export function threadsForYear(snippets: Snippet[], year: number): Thread[] {
  const thisYear = snippets.filter((s) => s.kind && parseISODate(s.happenedOn).getFullYear() === year);
  return MOMENT_KINDS.map(({ kind, thread }) => ({
    kind,
    title: `${thread} this year`,
    snippets: thisYear.filter((s) => s.kind === kind).sort((a, b) => b.happenedOn.localeCompare(a.happenedOn)),
  })).filter((t) => t.snippets.length > 0);
}

/** The last Sunday of the month that `month` ("YYYY-MM") names. */
export function lastSundayOfMonth(month: string): ISODate {
  const [y, m] = month.split('-').map(Number);
  const last = toISODate(new Date(y, m, 0));
  return addDays(last, -((dayIndex(last) + 1) % 7));
}

/**
 * "Which moment stood out this month?" Asked from the month's last Sunday onwards, for this month
 * or the one before, never for older months. Needs at least two moments to choose between.
 */
export function monthToPick(
  snippets: Snippet[], picks: MonthPicks, today: ISODate,
): { month: string; snippets: Snippet[] } | null {
  const current = monthKey(today);
  const previous = monthKey(addDays(`${current}-01`, -1));
  for (const month of [current, previous]) {
    if (month === current && today < lastSundayOfMonth(month)) continue;
    if (picks[month]) continue;
    const inMonth = snippets
      .filter((s) => monthKey(s.happenedOn) === month && s.happenedOn <= today)
      .sort((a, b) => a.happenedOn.localeCompare(b.happenedOn));
    if (inMonth.length >= 2) return { month, snippets: inMonth };
  }
  return null;
}

/** A moment from around this time last year (within ten days), if you kept one. */
export function aroundLastYear(snippets: Snippet[], today: ISODate): Snippet | undefined {
  const d = parseISODate(today);
  d.setFullYear(d.getFullYear() - 1);
  const target = toISODate(d);
  const lo = addDays(target, -10);
  const hi = addDays(target, 10);
  const dist = (s: Snippet) => Math.abs(parseISODate(s.happenedOn).getTime() - d.getTime());
  return snippets
    .filter((s) => s.happenedOn >= lo && s.happenedOn <= hi)
    .sort((a, b) => dist(a) - dist(b))[0];
}

/** "Mar 3, 2026 · a year later" style label for when a looking-back note was written. */
export function noteAge(happenedOn: ISODate, writtenOn: ISODate): string {
  const days = Math.round((parseISODate(writtenOn).getTime() - parseISODate(happenedOn).getTime()) / 86_400_000);
  if (days < 1) return 'the same day';
  if (days < 7) return days === 1 ? 'a day later' : `${days} days later`;
  if (days < 30) return Math.round(days / 7) === 1 ? 'a week later' : `${Math.round(days / 7)} weeks later`;
  if (days < 365) return Math.round(days / 30.4) <= 1 ? 'a month later' : `${Math.round(days / 30.4)} months later`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'a year later' : `${years} years later`;
}
