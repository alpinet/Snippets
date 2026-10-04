import { DemoApi } from '../api/demo';
import type { LocalMedia } from '../api/types';
import { parseInviteCode } from '../invite';
import { addDays, currentWeekStart, setClockOffset } from '../week';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must be synchronous
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('../api/supabase', () => ({}));
jest.mock('../api', () => ({ api: { track: jest.fn(() => Promise.resolve()), acceptInvite: jest.fn() } }));
jest.mock('../queries', () => ({ invalidateFriends: jest.fn() }));

const photo = (): LocalMedia => ({
  local: true, uri: 'file:///x.jpg', kind: 'image', width: 100, height: 100, durationMs: null, mimeType: 'image/jpeg',
});

let api: DemoApi;
beforeEach(async () => {
  jest.useFakeTimers({ advanceTimers: true, now: new Date('2026-09-30T12:00:00') }); // a Wednesday
  setClockOffset(0);
  api = new DemoApi();
  await api.reset();
  await api.signInWithEmail('a@b.co', 'secret1');
});
afterEach(() => jest.useRealTimers());

test('invite codes can be typed or pasted as links', () => {
  expect(parseInviteCode('a1b2c3d4e5f6')).toBe('a1b2c3d4e5f6');
  expect(parseInviteCode('  A1B2C3D4E5F6 ')).toBe('a1b2c3d4e5f6');
  expect(parseInviteCode('https://snippets.app/invite/a1b2c3d4e5f6')).toBe('a1b2c3d4e5f6');
  expect(parseInviteCode('snippets://invite/a1b2c3d4e5f6/')).toBe('a1b2c3d4e5f6');
  expect(parseInviteCode('hello')).toBeNull();
});

test('analytics events carry names and counts only', async () => {
  await api.track('moment_saved', { media: 2, backfill: false });
  const events = await api.recordedEvents();
  expect(events).toHaveLength(1);
  expect(events[0].name).toBe('moment_saved');
  expect(Object.keys(events[0].props).sort()).toEqual(['backfill', 'media']);
});

test('unshared moments are marked private in detail', async () => {
  const s = await api.saveSnippet({
    weekStart: currentWeekStart(), happenedOn: currentWeekStart(), title: 'draft', reflection: '', media: [photo()],
  });
  expect((await api.getSnippet(s.id)).shared).toBe(false);
});

test('keeping last week’s unshared drafts archives them without unlocking friends', async () => {
  const lastWeek = addDays(currentWeekStart(), -7);
  // Simulate a week that ended with drafts: un-share the seeded week.
  const db = await (api as unknown as { load(): Promise<{ weeks: { userId: string; weekStart: string; status: string }[] }> }).load();
  db.weeks.find((w) => w.userId === 'me' && w.weekStart === lastWeek)!.status = 'draft';

  await api.backfillWeek(lastWeek);
  expect((await api.myWeek(lastWeek)).status).toBe('backfilled');
  const sarah = (await api.friendsWeek(lastWeek)).find((f) => f.friend.id === 'sarah')!;
  expect(sarah.unlocked).toBe(false);
});

test('reply notifications are on by default and can be turned off', async () => {
  expect((await api.getSettings()).notifyReplies).toBe(true);
  await api.updateSettings({ notifyReplies: false });
  expect((await api.getSettings()).notifyReplies).toBe(false);
});
