import {
  addDays, currentWeekStart, dayIndex, formatWeekRange, isSunday, setClockOffset, socialWeekStart, today,
  untilSunday, weekStartOf,
} from '../week';

const at = (iso: string) => jest.setSystemTime(new Date(iso));

beforeEach(() => {
  jest.useFakeTimers({ advanceTimers: true });
  setClockOffset(0);
});
afterEach(() => jest.useRealTimers());

test('weeks run Monday to Sunday', () => {
  expect(weekStartOf('2026-09-27')).toBe('2026-09-21'); // Sunday → previous Monday
  expect(weekStartOf('2026-09-28')).toBe('2026-09-28'); // Monday
  expect(weekStartOf('2026-10-01')).toBe('2026-09-28');
  expect(dayIndex('2026-09-27')).toBe(6);
});

test('crosses month and year boundaries', () => {
  expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  expect(weekStartOf('2027-01-01')).toBe('2026-12-28');
  expect(formatWeekRange('2026-09-28')).toBe('Sep 28 – Oct 4');
  expect(formatWeekRange('2026-09-21')).toBe('Sep 21 – 27');
});

test('social week is this week on Sunday, last week otherwise', () => {
  at('2026-09-27T10:00:00');
  expect(isSunday()).toBe(true);
  expect(socialWeekStart()).toBe('2026-09-21');

  at('2026-09-29T10:00:00');
  expect(isSunday()).toBe(false);
  expect(currentWeekStart()).toBe('2026-09-28');
  expect(socialWeekStart()).toBe('2026-09-21');
});

test('countdown to Sunday', () => {
  at('2026-10-02T12:00:00'); // Friday noon
  expect(untilSunday()).toEqual({ days: 1, hours: 12, minutes: 0 });
});

test('clock offset (demo) moves "today"', () => {
  at('2026-09-29T10:00:00');
  setClockOffset(5 * 86_400_000);
  expect(today()).toBe('2026-10-04');
  expect(isSunday()).toBe(true);
});
