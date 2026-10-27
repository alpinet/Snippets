import { DemoApi } from '../api/demo';
import type { LocalMedia } from '../api/types';
import { addDays, currentWeekStart, setClockOffset, today } from '../week';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be synchronous
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// demo.ts doesn't need the Supabase client, but types import from the barrel file.
jest.mock('../api/supabase', () => ({}));

const photo = (): LocalMedia => ({
  local: true, uri: 'file:///x.jpg', kind: 'image', width: 100, height: 100, durationMs: null, mimeType: 'image/jpeg',
});

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

test('a week holds up to 3 moments', async () => {
  const wk = currentWeekStart();
  const existing = (await api.myWeek(wk)).snippets.length;
  for (let i = existing; i < 3; i++) {
    await api.saveSnippet({ weekStart: wk, happenedOn: today(), title: `m${i}`, reflection: '', visibility: 'friends' as const, media: [photo()] });
  }
  await expect(
    api.saveSnippet({ weekStart: wk, happenedOn: today(), title: 'one too many', reflection: '', visibility: 'friends' as const, media: [photo()] }),
  ).rejects.toThrow('up to 3 moments');
});

test('a moment holds 1–3 photos or videos', async () => {
  const base = { weekStart: currentWeekStart(), happenedOn: today(), title: '', reflection: '', visibility: 'friends' as const };
  await expect(api.saveSnippet({ ...base, media: [] })).rejects.toThrow();
  await expect(api.saveSnippet({ ...base, media: [photo(), photo(), photo(), photo()] })).rejects.toThrow('up to 3');
});

test('no moments on days that have not happened', async () => {
  await expect(
    api.saveSnippet({ weekStart: currentWeekStart(), happenedOn: addDays(today(), 1), title: '', reflection: '', visibility: 'friends' as const, media: [photo()] }),
  ).rejects.toThrow('hasn’t happened');
});

test('publishing only opens on Sunday', async () => {
  await expect(api.publishWeek(currentWeekStart())).rejects.toThrow('Sunday');
  toSunday();
  await expect(api.publishWeek(currentWeekStart())).resolves.toBeUndefined();
  expect((await api.myWeek(currentWeekStart())).status).toBe('published');
});

test('unlock: friends stay locked until you keep your week', async () => {
  toSunday();
  const wk = currentWeekStart();
  const before = await api.friendsWeek(wk);
  const sarah = before.find((f) => f.friend.id === 'sarah')!;
  expect(sarah.posted).toBe(true);
  expect(sarah.unlocked).toBe(false);
  expect(sarah.snippets).toHaveLength(0);
  expect(sarah.snippetCount).toBe(2); // she kept 3 moments but shared 2

  await api.publishWeek(wk);
  const after = (await api.friendsWeek(wk)).find((f) => f.friend.id === 'sarah')!;
  expect(after.unlocked).toBe(true);
  expect(after.snippets).toHaveLength(2);
  expect(after.snippets.every((s) => s.visibility === 'friends')).toBe(true);
});

test('every moment must be marked private or shared', async () => {
  await expect(
    api.saveSnippet({
      weekStart: currentWeekStart(), happenedOn: today(), title: 'undecided', reflection: '', media: [photo()],
      visibility: undefined as never,
    }),
  ).rejects.toThrow('who this moment is for');
});

test('private moments are never visible to friends, even after they unlock', async () => {
  toSunday();
  const wk = currentWeekStart();
  const db = await (api as unknown as { load(): Promise<{ snippets: { id: string; userId: string; weekStart: string; visibility: string }[] }> }).load();
  const sarahPrivate = db.snippets.find((s) => s.userId === 'sarah' && s.weekStart === wk && s.visibility === 'private')!;
  await api.publishWeek(wk);
  await expect(api.getSnippet(sarahPrivate.id)).rejects.toThrow();
  await expect(api.react(sarahPrivate.id, 'heart')).rejects.toThrow('Not allowed');
  const history = await api.friendHistory('sarah');
  expect(history.flatMap((w) => w.snippets).some((s) => s.id === sarahPrivate.id)).toBe(false);
});

test('a week kept entirely for yourself still unlocks friends’ shared moments', async () => {
  toSunday();
  const wk = currentWeekStart();
  for (const s of (await api.myWeek(wk)).snippets) {
    await api.saveSnippet({ ...s, visibility: 'private' });
  }
  await api.publishWeek(wk);
  const mine = await api.myWeek(wk);
  expect(mine.status).toBe('published');
  expect(mine.snippets.every((s) => s.visibility === 'private')).toBe(true);
  const sarah = (await api.friendsWeek(wk)).find((f) => f.friend.id === 'sarah')!;
  expect(sarah.unlocked).toBe(true);
  expect(sarah.snippets).toHaveLength(2);
});

test('backfilling never unlocks friends’ past weeks', async () => {
  const missed = addDays(currentWeekStart(), -14 * 7); // seeded as a week I missed, Sarah shared
  await api.saveSnippet({ weekStart: missed, happenedOn: missed, title: 'late', reflection: '', visibility: 'friends' as const, media: [photo()] });
  await api.backfillWeek(missed);
  expect((await api.myWeek(missed)).status).toBe('backfilled');
  const sarah = (await api.friendsWeek(missed)).find((f) => f.friend.id === 'sarah')!;
  expect(sarah.posted).toBe(true);
  expect(sarah.unlocked).toBe(false);
});

test('one nudge per friend per week', async () => {
  toSunday();
  const wk = currentWeekStart();
  await api.nudge('jess');
  await api.nudge('jess');
  const jess = (await api.friendsWeek(wk)).find((f) => f.friend.id === 'jess')!;
  expect(jess.nudged).toBe(true);
});

test('cannot react to or comment on a locked snippet', async () => {
  toSunday();
  const wk = currentWeekStart();
  const lockedId = (await api.myArchive()).length && (await (api as any).load()).snippets.find(
    (s: { userId: string; weekStart: string }) => s.userId === 'sarah' && s.weekStart === wk,
  ).id;
  await expect(api.react(lockedId, 'heart')).rejects.toThrow('Not allowed');
  await expect(api.comment(lockedId, 'hi')).rejects.toThrow('Not allowed');
  await api.publishWeek(wk);
  await expect(api.react(lockedId, 'heart')).resolves.toBeUndefined();
});
