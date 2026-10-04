import { addDays, currentWeekStart, parseISODate, setClockOffset } from '../week';
import { DemoApi } from './demo';
import { SupabaseApi } from './supabase';
import type { Api } from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Supabase when configured; otherwise a local seeded demo backend. */
export const api: Api = url && anonKey ? new SupabaseApi(url, anonKey) : new DemoApi();
export const demoApi = api instanceof DemoApi ? api : null;

export * from './types';

// Dev convenience (screenshots / QA): start the demo on Sunday afternoon.
if (demoApi && process.env.EXPO_PUBLIC_DEMO_SUNDAY === '1') {
  const sunday = parseISODate(addDays(currentWeekStart(), 6));
  sunday.setHours(15);
  setClockOffset(Math.max(0, sunday.getTime() - Date.now()));
}
