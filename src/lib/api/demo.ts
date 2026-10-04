// Local, seeded backend used when no Supabase project is configured.
// Mirrors the server rules in supabase/migrations so the whole app can be exercised offline.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addDays, currentWeekStart, dayIndex, isSunday, now, today, weekStartOf, type ISODate,
} from '../week';
import type {
  AnalyticsEvent, Api, Comment, FriendRequest, FriendWeek, MediaItem, Profile, ReactionKind, ReportTarget, Session,
  Settings, Snippet, SnippetInput, Week, WeekStatus,
} from './types';

const KEY = 'snippets-demo-v1';
const ME = 'me';

type DProfile = { id: string; username: string | null; displayName: string; avatarUri: string | null };
type DWeek = { userId: string; weekStart: ISODate; status: WeekStatus; publishedAt: string | null };
type DSnippet = {
  id: string; userId: string; weekStart: ISODate; happenedOn: ISODate; title: string;
  reflection: string; createdAt: string; media: MediaItem[];
};
type DB = {
  session: { userId: string; email: string | null } | null;
  profiles: Record<string, DProfile>;
  weeks: DWeek[];
  snippets: DSnippet[];
  reactions: { snippetId: string; userId: string; kind: ReactionKind }[];
  comments: { id: string; snippetId: string; userId: string; body: string; createdAt: string }[];
  friendships: { id: string; requester: string; recipient: string; status: 'pending' | 'accepted' }[];
  nudges: { from: string; to: string; weekStart: ISODate }[];
  blocks?: string[];
  events?: { name: AnalyticsEvent; props: Record<string, unknown>; at: string }[];
  reports?: (ReportTarget & { reason: string })[];
  settings: Settings;
};

let seq = 0;
const uid = () => `${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

// picsum ids chosen for warm, everyday scenes (food, coffee, nature, city, books…)
const PHOTOS = [
  1060, 225, 431, 292, 312, 429, 435, 488, 493, 1080, 102, 1011, 1015, 1018, 1036, 1039, 1043, 1044,
  1047, 1050, 1051, 1053, 1056, 1057, 1059, 1067, 1069, 1071, 1074, 1076, 1084, 110, 111, 116, 119,
  133, 139, 142, 145, 152, 158, 164, 165, 167, 171, 174, 175, 180, 183, 184, 188, 191, 192, 193,
];
let photoCursor = 0;
function photo(): MediaItem {
  const id = PHOTOS[photoCursor++ % PHOTOS.length];
  return {
    id: uid(), kind: 'image', url: `https://picsum.photos/id/${id}/900/1100`, thumbUrl: null,
    cacheKey: `picsum-${id}`, width: 900, height: 1100, durationMs: null,
  };
}

const MOMENTS: [string, string][] = [
  ['Finally tried that ramen place', 'Worth the 30-min wait — rich broth, perfect noodles. Already planning to return.'],
  ['Early morning walk', 'Quiet and crisp outside.'],
  ['Basketball was rough', 'We lost by 20 but somehow still had a great time.'],
  ['Philly day trip', 'Didn’t really have a plan. Just walked around all day.'],
  ['Coffee with Priya', 'Caught up at the corner café.'],
  ['Finished reading chapter 4', 'Slow progress but good.'],
  ['Rooftop sunset', ''],
  ['New plant for the window', 'Named him Gerald.'],
  ['Sunday pancakes', 'Burnt the first three, nailed the rest.'],
  ['Farmers market haul', 'Peaches are back.'],
  ['Long call with Mom', 'She finally figured out FaceTime.'],
  ['Beach, finally', 'Cold water, warm sand, no phone for three hours.'],
  ['Late night at the office', 'Boring, but we shipped it.'],
  ['Hike up Bear Mountain', 'Legs are still angry.'],
  ['Game night', 'Catan friendships were tested.'],
  ['Tried pottery', 'Made a bowl. Mostly a bowl.'],
];
let momentCursor = 0;

function seed(): DB {
  photoCursor = 0;
  momentCursor = 0;
  const t = today();
  const cw = currentWeekStart();
  const db: DB = {
    session: null,
    profiles: {
      [ME]: { id: ME, username: null, displayName: '', avatarUri: null },
      sarah: { id: 'sarah', username: 'sarah', displayName: 'Sarah', avatarUri: null },
      mike: { id: 'mike', username: 'mikeb', displayName: 'Mike', avatarUri: null },
      jess: { id: 'jess', username: 'jess.k', displayName: 'Jess', avatarUri: null },
      priya: { id: 'priya', username: 'priya', displayName: 'Priya', avatarUri: null },
      dan: { id: 'dan', username: 'danny', displayName: 'Dan', avatarUri: null },
      noor: { id: 'noor', username: 'noor', displayName: 'Noor', avatarUri: null },
    },
    weeks: [],
    snippets: [],
    reactions: [],
    comments: [],
    friendships: [
      { id: 'f1', requester: ME, recipient: 'sarah', status: 'accepted' },
      { id: 'f2', requester: 'mike', recipient: ME, status: 'accepted' },
      { id: 'f3', requester: ME, recipient: 'jess', status: 'accepted' },
      { id: 'f4', requester: 'priya', recipient: ME, status: 'accepted' },
      { id: 'f5', requester: 'dan', recipient: ME, status: 'pending' },
    ],
    nudges: [],
    settings: { timezone: 'UTC', inviteCode: 'a1b2c3d4e5f6', notifySunday: true, notifyNudges: true, notifyFriendPosted: true, notifyReplies: true },
  };

  const add = (userId: string, weekStart: ISODate, days: number[], status: WeekStatus, photos = [1, 2, 1]) => {
    db.weeks.push({ userId, weekStart, status, publishedAt: status === 'draft' ? null : `${addDays(weekStart, 6)}T19:00:00Z` });
    days.forEach((d, i) => {
      const [title, reflection] = MOMENTS[momentCursor++ % MOMENTS.length];
      const s: DSnippet = {
        id: uid(), userId, weekStart, happenedOn: addDays(weekStart, d), title, reflection,
        createdAt: `${addDays(weekStart, d)}T12:00:00Z`,
        media: Array.from({ length: photos[i % photos.length] }, photo),
      };
      db.snippets.push(s);
    });
  };

  // This week: a couple of drafts on days that have already happened.
  const ti = dayIndex(t);
  add(ME, cw, [0, Math.min(1, ti)].filter((d, i, a) => a.indexOf(d) === i), 'draft', [1, 1]);
  // Friends have drafted too; they become "posted" when Sunday arrives (see friendPosted).
  add('sarah', cw, [0, 2, 5], 'published', [1, 2, 3]);
  add('mike', cw, [1, 4], 'published', [2, 1]);

  // Last week: everyone except Jess shared.
  const lw = addDays(cw, -7);
  add(ME, lw, [0, 2, 5], 'published', [1, 1, 2]);
  add('sarah', lw, [2, 5, 6], 'published', [1, 2, 3]);
  add('mike', lw, [1, 3], 'published', [2, 1]);
  add('priya', lw, [4], 'published', [3]);

  const sarahWed = db.snippets.find((s) => s.userId === 'sarah' && s.weekStart === lw)!;
  sarahWed.title = 'Finally tried that ramen place';
  sarahWed.reflection = 'Worth the 30-min wait — rich broth, perfect noodles. Already planning to return.';
  db.reactions.push({ snippetId: sarahWed.id, userId: 'jess', kind: 'heart' }, { snippetId: sarahWed.id, userId: 'mike', kind: 'laugh' });
  db.comments.push(
    { id: uid(), snippetId: sarahWed.id, userId: 'jess', body: 'the broth looks unreal', createdAt: `${addDays(lw, 6)}T20:00:00Z` },
    { id: uid(), snippetId: sarahWed.id, userId: 'mike', body: 'we have to go together next time', createdAt: `${addDays(lw, 6)}T20:05:00Z` },
  );
  const myLast = db.snippets.filter((s) => s.userId === ME && s.weekStart === lw);
  db.comments.push({ id: uid(), snippetId: myLast[0].id, userId: 'sarah', body: 'love this', createdAt: `${addDays(lw, 6)}T21:00:00Z` });
  db.reactions.push({ snippetId: myLast[1].id, userId: 'priya', kind: 'wow' });

  // Archive: ~5 months back with gaps (for backfill) and one unshared draft week.
  for (let w = 2; w <= 22; w++) {
    const ws = addDays(cw, -7 * w);
    if (w % 2 === 0) add('sarah', ws, [1, 4], 'published', [1, 1]);
    if (w === 5 || w === 9 || w === 14) continue; // weeks I missed (backfill candidates)
    const status: WeekStatus = w === 7 ? 'draft' : w === 17 ? 'backfilled' : 'published';
    const count = 1 + ((w * 7) % 3);
    add(ME, ws, [0, 2, 5].slice(0, count), status, [1, 2, 1]);
    const mine = db.snippets.filter((s) => s.userId === ME && s.weekStart === ws);
    if (status === 'published' && w % 3 !== 0) {
      db.comments.push({ id: uid(), snippetId: mine[0].id, userId: 'mike', body: 'this is great', createdAt: `${addDays(ws, 6)}T20:00:00Z` });
    }
  }
  return db;
}

export class DemoApi implements Api {
  readonly mode = 'demo' as const;
  private db: DB | null = null;
  private listeners = new Set<(s: Session) => void>();

  private async load(): Promise<DB> {
    if (this.db) return this.sanitize(this.db);
    try {
      const raw = await AsyncStorage.getItem(KEY);
      this.db = raw ? (JSON.parse(raw) as DB) : seed();
    } catch {
      this.db = seed();
    }
    // Fill settings added after this device's demo data was created.
    this.db.settings.notifyReplies ??= true;
    this.sanitize(this.db);
    // Dev convenience (screenshots / QA): start signed in as the seeded user.
    if (process.env.EXPO_PUBLIC_DEMO_AUTOLOGIN === '1' && !this.db.session) {
      this.db.session = { userId: ME, email: 'alex@example.com' };
      this.db.profiles[ME].username ??= 'alex';
      this.db.profiles[ME].displayName ||= 'Alex';
    }
    return this.db;
  }

  /**
   * Undo state that only a shifted demo clock ("Pretend it's Sunday") could create:
   * future-dated moments, and a share of the current week before its Sunday.
   */
  private sanitize(db: DB): DB {
    // Moments dated after "today" were made under a shifted demo clock; drop them.
    const t = today();
    const future = new Set(db.snippets.filter((x) => x.userId === ME && x.happenedOn > t).map((x) => x.id));
    if (future.size) db.snippets = db.snippets.filter((x) => !future.has(x.id));
    if (isSunday()) return db;
    for (const w of db.weeks) {
      if (w.userId === ME && w.weekStart === currentWeekStart() && w.status === 'published') {
        w.status = 'draft';
        w.publishedAt = null;
      }
    }
    return db;
  }

  private async save() {
    if (this.db) await AsyncStorage.setItem(KEY, JSON.stringify(this.db)).catch(() => {});
  }

  /** Dev helper: wipe demo data back to the seed. */
  async reset() {
    const session = (await this.load()).session;
    this.db = seed();
    this.db.session = session;
    if (session) {
      this.db.profiles[ME].username = 'alex';
      this.db.profiles[ME].displayName = 'Alex';
    }
    await this.save();
  }

  private delay<T>(v: T, ms = 120): Promise<T> {
    return new Promise((r) => setTimeout(() => r(v), ms));
  }

  private profile(id: string): Profile {
    const p = this.db!.profiles[id];
    return { id: p.id, username: p.username, displayName: p.displayName || p.username || 'Friend', avatarUrl: p.avatarUri };
  }

  private snippet(s: DSnippet): Snippet {
    const db = this.db!;
    return {
      id: s.id, userId: s.userId, weekStart: s.weekStart, happenedOn: s.happenedOn, title: s.title,
      reflection: s.reflection, createdAt: s.createdAt, media: s.media,
      reactions: db.reactions.filter((r) => r.snippetId === s.id).map((r) => ({ userId: r.userId, kind: r.kind })),
      comments: db.comments
        .filter((c) => c.snippetId === s.id && !(db.blocks ?? []).includes(c.userId))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((c): Comment => ({ id: c.id, snippetId: c.snippetId, body: c.body, createdAt: c.createdAt, author: this.profile(c.userId) })),
    };
  }

  private weekRow(userId: string, weekStart: ISODate) {
    return this.db!.weeks.find((w) => w.userId === userId && w.weekStart === weekStart);
  }

  private friendIds(): string[] {
    return this.db!.friendships
      .filter((f) => f.status === 'accepted' && (f.requester === ME || f.recipient === ME))
      .map((f) => (f.requester === ME ? f.recipient : f.requester));
  }

  /** Seeded friends "publish" their current week once the (demo) clock reaches Sunday. */
  private friendPosted(userId: string, weekStart: ISODate): boolean {
    const w = this.weekRow(userId, weekStart);
    if (!w || w.status !== 'published') return false;
    return weekStart < currentWeekStart() || isSunday();
  }

  private canView(owner: string, weekStart: ISODate): boolean {
    if (owner === ME) return true;
    const w = this.weekRow(owner, weekStart);
    const sharedByOwner = w?.status === 'backfilled' || this.friendPosted(owner, weekStart);
    return this.friendIds().includes(owner) && sharedByOwner && this.weekRow(ME, weekStart)?.status === 'published';
  }

  private emit() {
    const s = this.db?.session ?? null;
    this.listeners.forEach((l) => l(s));
  }

  // Auth ---------------------------------------------------------------------

  async getSession() {
    return (await this.load()).session;
  }
  onAuthChange(cb: (s: Session) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }
  private async signIn(email: string | null) {
    const db = await this.load();
    db.session = { userId: ME, email };
    await this.save();
    this.emit();
  }
  async signInWithEmail(email: string, password: string) {
    if (!email.includes('@') || password.length < 6) throw new Error('Check your email and password');
    await this.signIn(email);
  }
  async signUpWithEmail(email: string, password: string) {
    if (!email.includes('@')) throw new Error('That email doesn’t look right');
    if (password.length < 8) throw new Error('Use at least 8 characters');
    await this.signIn(email);
    return { needsConfirmation: false };
  }
  async signInWithApple() {
    await this.signIn('demo@privaterelay.appleid.com');
  }
  async signInWithGoogle() {
    await this.signIn('demo@gmail.com');
  }
  async signOut() {
    const db = await this.load();
    db.session = null;
    await this.save();
    this.emit();
  }
  async deleteAccount() {
    this.db = seed();
    await this.save();
    this.emit();
  }

  // Profile ------------------------------------------------------------------

  async me() {
    await this.load();
    return this.delay(this.profile(ME));
  }
  async updateProfile(p: { username?: string; displayName?: string; avatarUri?: string | null }) {
    const db = await this.load();
    const me = db.profiles[ME];
    if (p.username !== undefined) {
      const u = p.username.trim().toLowerCase();
      if (!/^[a-z0-9_.]{3,20}$/.test(u)) throw new Error('Usernames are 3–20 letters, numbers, _ or .');
      if (!(await this.isUsernameAvailable(u))) throw new Error('That username is taken');
      me.username = u;
    }
    if (p.displayName !== undefined) me.displayName = p.displayName.trim();
    if (p.avatarUri !== undefined) me.avatarUri = p.avatarUri;
    await this.save();
    return this.profile(ME);
  }
  async isUsernameAvailable(username: string) {
    const db = await this.load();
    return !Object.values(db.profiles).some((p) => p.id !== ME && p.username === username.toLowerCase());
  }
  async getSettings() {
    return { ...(await this.load()).settings };
  }
  async updateSettings(s: Partial<Omit<Settings, 'inviteCode' | 'timezone'>>) {
    const db = await this.load();
    Object.assign(db.settings, s);
    await this.save();
  }
  async syncTimezone(tz: string) {
    (await this.load()).settings.timezone = tz;
  }
  async registerPushToken() {}

  // My weeks -----------------------------------------------------------------

  async myWeek(weekStart: ISODate): Promise<Week> {
    const db = await this.load();
    const w = this.weekRow(ME, weekStart);
    return this.delay({
      weekStart,
      status: w?.status ?? 'draft',
      publishedAt: w?.publishedAt ?? null,
      snippets: db.snippets
        .filter((s) => s.userId === ME && s.weekStart === weekStart)
        .sort((a, b) => a.happenedOn.localeCompare(b.happenedOn) || a.createdAt.localeCompare(b.createdAt))
        .map((s) => this.snippet(s)),
    });
  }

  async myArchive(): Promise<Week[]> {
    const db = await this.load();
    const weeks = db.weeks.filter((w) => w.userId === ME);
    return this.delay(
      weeks
        .map((w) => ({
          weekStart: w.weekStart,
          status: w.status,
          publishedAt: w.publishedAt,
          snippets: db.snippets
            .filter((s) => s.userId === ME && s.weekStart === w.weekStart)
            .sort((a, b) => a.happenedOn.localeCompare(b.happenedOn))
            .map((s) => this.snippet(s)),
        }))
        .filter((w) => w.snippets.length)
        .sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    );
  }

  async saveSnippet(input: SnippetInput, onProgress?: (f: number) => void): Promise<Snippet> {
    const db = await this.load();
    if (input.weekStart > currentWeekStart()) throw new Error('You can’t add moments to a future week');
    if (input.happenedOn > today()) throw new Error('That day hasn’t happened yet');
    if (weekStartOf(input.happenedOn) !== input.weekStart) throw new Error('That day isn’t in this week');
    if (input.media.length < 1) throw new Error('Add at least one photo or video');
    if (input.media.length > 3) throw new Error('A moment holds up to 3 photos or videos');

    let s = input.id ? db.snippets.find((x) => x.id === input.id && x.userId === ME) : undefined;
    if (!s) {
      const count = db.snippets.filter((x) => x.userId === ME && x.weekStart === input.weekStart).length;
      if (count >= 3) throw new Error('A week holds up to 3 moments');
      if (!this.weekRow(ME, input.weekStart)) {
        db.weeks.push({ userId: ME, weekStart: input.weekStart, status: 'draft', publishedAt: null });
      }
      s = { id: uid(), userId: ME, weekStart: input.weekStart, happenedOn: input.happenedOn, title: '', reflection: '', createdAt: now().toISOString(), media: [] };
      db.snippets.push(s);
    }
    s.happenedOn = input.happenedOn;
    s.title = input.title.trim();
    s.reflection = input.reflection.trim();
    s.media = input.media.map((m) =>
      m.local
        ? { id: uid(), kind: m.kind, url: m.uri, thumbUrl: null, cacheKey: m.uri, width: m.width, height: m.height, durationMs: m.durationMs }
        : m,
    );
    onProgress?.(0.5);
    await this.delay(null, 350);
    onProgress?.(1);
    await this.save();
    return this.snippet(s);
  }

  async deleteSnippet(id: string) {
    const db = await this.load();
    const s = db.snippets.find((x) => x.id === id && x.userId === ME);
    db.snippets = db.snippets.filter((x) => x.id !== id);
    db.reactions = db.reactions.filter((r) => r.snippetId !== id);
    db.comments = db.comments.filter((c) => c.snippetId !== id);
    if (s && !db.snippets.some((x) => x.userId === ME && x.weekStart === s.weekStart)) {
      db.weeks = db.weeks.filter((w) => !(w.userId === ME && w.weekStart === s.weekStart && w.status === 'draft'));
    }
    await this.save();
  }

  async publishWeek(weekStart: ISODate) {
    const db = await this.load();
    if (weekStart !== currentWeekStart()) throw new Error('Only this week can be shared');
    if (!isSunday()) throw new Error('Sharing opens on Sunday');
    const w = this.weekRow(ME, weekStart);
    if (!w || !db.snippets.some((s) => s.userId === ME && s.weekStart === weekStart)) {
      throw new Error('Add at least one moment first');
    }
    if (w.status === 'draft') {
      w.status = 'published';
      w.publishedAt = now().toISOString();
    }
    await this.save();
    await this.delay(null, 400);
  }

  async backfillWeek(weekStart: ISODate) {
    const db = await this.load();
    if (weekStart >= currentWeekStart()) throw new Error('Only past weeks can be backfilled');
    const w = this.weekRow(ME, weekStart);
    if (!w || !db.snippets.some((s) => s.userId === ME && s.weekStart === weekStart)) {
      throw new Error('Add at least one moment first');
    }
    if (w.status === 'draft') {
      w.status = 'backfilled';
      w.publishedAt = now().toISOString();
    }
    await this.save();
  }

  async getSnippet(id: string) {
    const db = await this.load();
    const s = db.snippets.find((x) => x.id === id);
    if (!s || !this.canView(s.userId, s.weekStart)) throw new Error('This moment isn’t available');
    const shared = (this.weekRow(s.userId, s.weekStart)?.status ?? 'draft') !== 'draft';
    return this.delay({ ...this.snippet(s), author: this.profile(s.userId), shared });
  }

  // Friends' weeks -------------------------------------------------------------

  async friendsWeek(weekStart: ISODate): Promise<FriendWeek[]> {
    const db = await this.load();
    return this.delay(
      this.friendIds()
        .map((id) => {
          const posted = this.friendPosted(id, weekStart);
          const unlocked = this.canView(id, weekStart);
          const snippets = db.snippets.filter((s) => s.userId === id && s.weekStart === weekStart);
          return {
            friend: this.profile(id),
            posted,
            snippetCount: posted ? snippets.length : 0,
            nudged: db.nudges.some((n) => n.from === ME && n.to === id && n.weekStart === weekStart),
            unlocked,
            snippets: unlocked
              ? snippets.sort((a, b) => a.happenedOn.localeCompare(b.happenedOn)).map((s) => this.snippet(s))
              : [],
          };
        })
        .sort((a, b) => a.friend.displayName.localeCompare(b.friend.displayName)),
    );
  }

  async friendHistory(friendId: string): Promise<Week[]> {
    const db = await this.load();
    return this.delay(
      db.weeks
        .filter((w) => w.userId === friendId && this.canView(friendId, w.weekStart))
        .map((w) => ({
          weekStart: w.weekStart,
          status: w.status,
          publishedAt: w.publishedAt,
          snippets: db.snippets
            .filter((s) => s.userId === friendId && s.weekStart === w.weekStart)
            .map((s) => this.snippet(s)),
        }))
        .filter((w) => w.snippets.length)
        .sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    );
  }

  async react(snippetId: string, kind: ReactionKind | null) {
    const db = await this.load();
    const s = db.snippets.find((x) => x.id === snippetId);
    if (!s || !this.canView(s.userId, s.weekStart)) throw new Error('Not allowed');
    db.reactions = db.reactions.filter((r) => !(r.snippetId === snippetId && r.userId === ME));
    if (kind) db.reactions.push({ snippetId, userId: ME, kind });
    await this.save();
  }

  async comment(snippetId: string, body: string) {
    const db = await this.load();
    const s = db.snippets.find((x) => x.id === snippetId);
    if (!s || !this.canView(s.userId, s.weekStart)) throw new Error('Not allowed');
    const text = body.trim();
    if (!text || text.length > 500) throw new Error('Comments are 1–500 characters');
    const c = { id: uid(), snippetId, userId: ME, body: text, createdAt: now().toISOString() };
    db.comments.push(c);
    await this.save();
    return { id: c.id, snippetId, body: c.body, createdAt: c.createdAt, author: this.profile(ME) };
  }

  async deleteComment(id: string) {
    const db = await this.load();
    db.comments = db.comments.filter((c) => {
      if (c.id !== id) return true;
      const s = db.snippets.find((x) => x.id === c.snippetId);
      return !(c.userId === ME || s?.userId === ME);
    });
    await this.save();
  }

  async nudge(friendId: string) {
    const db = await this.load();
    if (!this.friendIds().includes(friendId)) throw new Error('Not friends');
    const wk = currentWeekStart();
    if (this.friendPosted(friendId, wk)) return;
    if (!db.nudges.some((n) => n.from === ME && n.to === friendId && n.weekStart === wk)) {
      db.nudges.push({ from: ME, to: friendId, weekStart: wk });
    }
    await this.save();
  }

  // Friendships ----------------------------------------------------------------

  async friends() {
    await this.load();
    return this.delay(
      this.friendIds().map((id) => this.profile(id)).sort((a, b) => a.displayName.localeCompare(b.displayName)),
    );
  }

  async friendRequests(): Promise<FriendRequest[]> {
    const db = await this.load();
    return db.friendships
      .filter((f) => f.status === 'pending' && (f.requester === ME || f.recipient === ME))
      .map((f) => ({
        id: f.id,
        profile: this.profile(f.requester === ME ? f.recipient : f.requester),
        direction: f.requester === ME ? 'outgoing' : 'incoming',
      }));
  }

  async searchUsers(query: string) {
    const db = await this.load();
    const q = query.trim().toLowerCase().replace(/^@/, '');
    if (q.length < 2) return [];
    return Object.values(db.profiles)
      .filter((p) => p.id !== ME && p.username?.startsWith(q))
      .map((p) => {
        const f = db.friendships.find((x) => (x.requester === p.id && x.recipient === ME) || (x.requester === ME && x.recipient === p.id));
        return { ...this.profile(p.id), relation: f ? (f.status === 'accepted' ? 'friend' : 'pending') : 'none' } as const;
      });
  }

  async sendFriendRequest(userId: string) {
    const db = await this.load();
    if ((db.blocks ?? []).includes(userId)) throw new Error('You can’t add this person');
    const f = db.friendships.find((x) => (x.requester === userId && x.recipient === ME) || (x.requester === ME && x.recipient === userId));
    if (f) {
      if (f.status === 'pending' && f.recipient === ME) f.status = 'accepted';
      await this.save();
      return f.status === 'accepted' ? 'accepted' : 'pending';
    }
    db.friendships.push({ id: uid(), requester: ME, recipient: userId, status: 'pending' });
    await this.save();
    return 'pending' as const;
  }

  async respondToRequest(requestId: string, accept: boolean) {
    const db = await this.load();
    const f = db.friendships.find((x) => x.id === requestId && x.recipient === ME);
    if (!f) return;
    if (accept) f.status = 'accepted';
    else db.friendships = db.friendships.filter((x) => x.id !== requestId);
    await this.save();
  }

  async removeFriend(userId: string) {
    const db = await this.load();
    db.friendships = db.friendships.filter(
      (x) => !((x.requester === userId && x.recipient === ME) || (x.requester === ME && x.recipient === userId)),
    );
    await this.save();
  }

  async acceptInvite(code: string) {
    const db = await this.load();
    if (!/^[a-f0-9]{12}$/i.test(code)) throw new Error('This invite link isn’t valid anymore');
    // In demo mode any well-formed code befriends Noor.
    if (!db.friendships.some((f) => f.requester === 'noor' || f.recipient === 'noor')) {
      db.friendships.push({ id: uid(), requester: 'noor', recipient: ME, status: 'accepted' });
    }
    await this.save();
    return this.profile('noor');
  }

  async regenerateInviteCode() {
    const db = await this.load();
    db.settings.inviteCode = Array.from({ length: 12 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
    await this.save();
    return db.settings.inviteCode;
  }

  // Safety ---------------------------------------------------------------------

  async report(target: ReportTarget, reason: string) {
    const db = await this.load();
    (db.reports ??= []).push({ ...target, reason });
    await this.save();
  }

  async blockUser(userId: string) {
    const db = await this.load();
    (db.blocks ??= []).push(userId);
    await this.removeFriend(userId);
  }

  async track(name: AnalyticsEvent, props?: Record<string, number | string | boolean>) {
    const db = await this.load();
    (db.events ??= []).push({ name, props: props ?? {}, at: now().toISOString() });
    if (db.events.length > 200) db.events.splice(0, db.events.length - 200);
    await this.save();
  }

  /** Test/dev helper: recorded analytics events. */
  async recordedEvents() {
    return [...((await this.load()).events ?? [])];
  }
}
