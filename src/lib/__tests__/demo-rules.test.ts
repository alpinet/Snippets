import { DemoApi } from '../api/demo';
import type { LocalMedia } from '../api/types';
import { addDays, currentWeekStart, setClockOffset, today } from '../week';

jest.mock('@react-native-async-storage/async-storage', () =>
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
    await api.saveSnippet({ weekStart: wk, happenedOn: today(), title: `m${i}`, reflection: '', media: [photo()] });
  }
  await expect(
    api.saveSnippet({ weekStart: wk, happenedOn: today(), title: 'one too many', reflection: '', media: [photo()] }),
  ).rejects.toThrow('up to 3 moments');
});

test('a moment holds 1–3 photos or videos', async () => {
  const base = { weekStart: currentWeekStart(), happenedOn: today(), title: '', reflection: '' };
  await expect(api.saveSnippet({ ...base, media: [] })).rejects.toThrow();
  await expect(api.saveSnippet({ ...base, media: [photo(), photo(), photo(), photo()] })).rejects.toThrow('up to 3');
});

test('no moments on days that have not happened', async () => {
  await expect(
    api.saveSnippet({ weekStart: currentWeekStart(), happenedOn: addDays(today(), 1), title: '', reflection: '', media: [photo()] }),
  ).rejects.toThrow('hasn’t happened');
});

test('publishing only opens on Sunday', async () => {
  await expect(api.publishWeek(currentWeekStart())).rejects.toThrow('Sunday');
  toSunday();
  await expect(api.publishWeek(currentWeekStart())).resolves.toBeUndefined();
  expect((await api.myWeek(currentWeekStart())).status).toBe('published');
});

test('post-to-unlock: friends stay locked until you share', async () => {
  toSunday();
  const wk = currentWeekStart();
  const before = await api.friendsWeek(wk);
  const sarah = before.find((f) => f.friend.id === 'sarah')!;
  expect(sarah.posted).toBe(true);
  expect(sarah.unlocked).toBe(false);
  expect(sarah.snippets).toHaveLength(0);
  expect(sarah.snippetCount).toBe(3);

  await api.publishWeek(wk);
  const after = (await api.friendsWeek(wk)).find((f) => f.friend.id === 'sarah')!;
  expect(after.unlocked).toBe(true);
  expect(after.snippets).toHaveLength(3);
});

test('backfilling never unlocks friends’ past weeks', async () => {
  const missed = addDays(currentWeekStart(), -14 * 7); // seeded as a week I missed, Sarah shared
  await api.saveSnippet({ weekStart: missed, happenedOn: missed, title: 'late', reflection: '', media: [photo()] });
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
