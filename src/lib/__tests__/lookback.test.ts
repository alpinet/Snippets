import { DemoApi } from '../api/demo';
import type { LocalMedia, Snippet } from '../api/types';
import { aroundLastYear, lastSundayOfMonth, monthToPick, noteAge, threadsForYear } from '../lookback';
import { addDays, currentWeekStart, setClockOffset, today } from '../week';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be synchronous
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../api/supabase', () => ({}));

const photo = (): LocalMedia => ({
  local: true, uri: 'file:///x.jpg', kind: 'image', width: 100, height: 100, durationMs: null, mimeType: 'image/jpeg',
});
const moment = (happenedOn: string, kind: Snippet['kind'] = null, id = happenedOn): Snippet => ({
  id, userId: 'me', weekStart: happenedOn, happenedOn, title: id, reflection: '', visibility: 'private', kind,
  notes: [], media: [], reactions: [], comments: [], createdAt: `${happenedOn}T12:00:00Z`,
});

type Internals = {
  load(): Promise<{
    snippets: { id: string; userId: string; weekStart: string; visibility: string }[];
    notes: { snippetId: string; userId: string }[];
    weekLines: { userId: string }[];
  }>;
};

const WEDNESDAY = new Date('2026-09-30T12:00:00');
const toSunday = () => setClockOffset(4 * 86_400_000);

let api: DemoApi;
beforeEach(async () => {
  jest.useFakeTimers({ advanceTimers: true, now: WEDNESDAY });
  setClockOffset(0);
  api = new DemoApi();
  await api.reset();
  await api.signInWithEmail('a@b.co', 'secret1');
});
afterEach(() => jest.useRealTimers());

// Moment kinds ----------------------------------------------------------------

test('a moment can optionally be marked with a kind', async () => {
  const base = { weekStart: currentWeekStart(), happenedOn: today(), title: 'k', reflection: '', visibility: 'private' as const, media: [photo()] };
  const plain = await api.saveSnippet(base);
  expect(plain.kind).toBeNull();
  const first = await api.saveSnippet({ ...base, id: plain.id, kind: 'first_time' });
  expect(first.kind).toBe('first_time');
  await expect(api.saveSnippet({ ...base, id: plain.id, kind: 'best_ever' as never })).rejects.toThrow('kind of moment');
});

// Looking-back notes ---------------------------------------------------------

test('you can add dated notes to your own past moments', async () => {
  const [past] = (await api.myArchive()).filter((w) => w.weekStart < currentWeekStart()).flatMap((w) => w.snippets);
  const n = await api.addLookbackNote(past.id, '  Looking back, I was braver than I thought.  ');
  expect(n.body).toBe('Looking back, I was braver than I thought.');
  expect(n.writtenOn).toBe(today());
  expect((await api.getSnippet(past.id)).notes.map((x) => x.id)).toContain(n.id);
  await expect(api.addLookbackNote(past.id, '   ')).rejects.toThrow();

  await api.deleteLookbackNote(n.id);
  expect((await api.getSnippet(past.id)).notes.map((x) => x.id)).not.toContain(n.id);
});

test('looking-back notes are owner-only', async () => {
  toSunday();
  const wk = currentWeekStart();
  await api.publishWeek(wk);
  const lw = addDays(wk, -7);
  const sarahShared = (await api.friendsWeek(lw)).find((f) => f.friend.id === 'sarah')!.snippets;
  expect(sarahShared.length).toBeGreaterThan(0);
  // Sarah has a seeded note on her ramen moment; friends never see it.
  const db = await (api as unknown as Internals).load();
  expect(db.notes.some((n) => n.userId === 'sarah' && sarahShared.some((s) => s.id === n.snippetId))).toBe(true);
  for (const s of sarahShared) {
    expect(s.notes).toEqual([]);
    expect((await api.getSnippet(s.id)).notes).toEqual([]);
  }
  expect((await api.friendHistory('sarah')).flatMap((w) => w.snippets).every((s) => s.notes.length === 0)).toBe(true);
  // And nobody can write notes on someone else's moment.
  await expect(api.addLookbackNote(sarahShared[0].id, 'mine now')).rejects.toThrow('Not allowed');
});

// Weekly line -------------------------------------------------------------------

test('keeping your week can save one private line', async () => {
  toSunday();
  const wk = currentWeekStart();
  await api.publishWeek(wk, '  A quiet week, and I liked it.  ');
  expect((await api.myWeek(wk)).line).toBe('A quiet week, and I liked it.');
  expect((await api.myArchive()).find((w) => w.weekStart === wk)?.line).toBe('A quiet week, and I liked it.');
  await api.setWeekLine(wk, '');
  expect((await api.myWeek(wk)).line).toBeNull();
  await expect(api.setWeekLine(wk, 'x'.repeat(141))).rejects.toThrow('one line');
});

test('weekly lines are owner-only', async () => {
  toSunday();
  await api.publishWeek(currentWeekStart());
  // Sarah wrote a line for last week; it never reaches friends.
  expect((await (api as unknown as Internals).load()).weekLines.some((l) => l.userId === 'sarah')).toBe(true);
  expect((await api.friendHistory('sarah')).every((w) => w.line === null)).toBe(true);
});

// Month pick -----------------------------------------------------------------

test('a month pick must be one of your own moments from that month', async () => {
  const mine = (await api.myArchive()).flatMap((w) => w.snippets);
  const s = mine[mine.length - 1];
  const month = s.happenedOn.slice(0, 7);
  await api.pickMonth(month, s.id);
  expect((await api.monthPicks())[month]).toBe(s.id);
  const otherMonth = mine.find((x) => x.happenedOn.slice(0, 7) !== month)!;
  await expect(api.pickMonth(month, otherMonth.id)).rejects.toThrow();
  const db = await (api as unknown as Internals).load();
  const sarahs = db.snippets.find((x) => x.userId === 'sarah')!;
  await expect(api.pickMonth(month, sarahs.id)).rejects.toThrow();
  await api.pickMonth(month, null);
  expect((await api.monthPicks())[month]).toBeUndefined();
});

// Pure helpers ----------------------------------------------------------------

test('threads gather this year’s moments by kind, with no counts', () => {
  const t = threadsForYear(
    [moment('2026-03-01', 'first_time'), moment('2026-05-01', 'first_time'), moment('2025-05-01', 'first_time'),
      moment('2026-06-01', 'proud_of'), moment('2026-06-02')],
    2026,
  );
  expect(t.map((x) => x.title)).toEqual(['Your firsts this year', 'Things you were proud of this year']);
  expect(t[0].snippets.map((s) => s.happenedOn)).toEqual(['2026-05-01', '2026-03-01']);
});

test('last Sunday of a month', () => {
  expect(lastSundayOfMonth('2026-10')).toBe('2026-10-25');
  expect(lastSundayOfMonth('2026-05')).toBe('2026-05-31');
  expect(lastSundayOfMonth('2026-02')).toBe('2026-02-22');
});

test('the month pick is asked from the last Sunday on, and only once', () => {
  const oct = [moment('2026-10-03'), moment('2026-10-14')];
  const sep = [moment('2026-09-02'), moment('2026-09-20')];
  expect(monthToPick(oct, {}, '2026-10-24')).toBeNull(); // before the last Sunday; no September moments
  expect(monthToPick(oct, {}, '2026-10-25')?.month).toBe('2026-10');
  expect(monthToPick([...oct, ...sep], {}, '2026-10-10')?.month).toBe('2026-09');
  expect(monthToPick([...oct, ...sep], { '2026-09': sep[0].id }, '2026-10-10')).toBeNull();
  expect(monthToPick([moment('2026-10-03')], {}, '2026-10-26')).toBeNull(); // nothing to choose between
  expect(monthToPick([moment('2026-08-03'), moment('2026-08-09')], {}, '2026-10-10')).toBeNull(); // too long ago
});

test('around this time last year', () => {
  const s = [moment('2025-10-20'), moment('2025-10-26'), moment('2025-12-01')];
  expect(aroundLastYear(s, '2026-10-27')?.happenedOn).toBe('2025-10-26');
  expect(aroundLastYear(s, '2026-07-01')).toBeUndefined();
});

test('note ages read naturally', () => {
  expect(noteAge('2026-01-01', '2026-01-01')).toBe('the same day');
  expect(noteAge('2026-01-01', '2026-01-15')).toBe('2 weeks later');
  expect(noteAge('2026-01-01', '2026-04-01')).toBe('3 months later');
  expect(noteAge('2025-01-01', '2026-01-05')).toBe('a year later');
});
