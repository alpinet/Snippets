import type { ISODate } from '../week';

export type ReactionKind = 'heart' | 'laugh' | 'wow' | 'thumbs';
export const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: 'heart', emoji: '❤️', label: 'Love' },
  { kind: 'laugh', emoji: '😂', label: 'Funny' },
  { kind: 'wow', emoji: '😮', label: 'Wow' },
  { kind: 'thumbs', emoji: '👍', label: 'Nice' },
];

export type Profile = {
  id: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export type MediaItem = {
  id: string;
  kind: 'image' | 'video';
  url: string;
  thumbUrl: string | null;
  /** Stable key for image caching (signed URLs rotate). */
  cacheKey: string;
  width: number;
  height: number;
  durationMs: number | null;
};

export type Reaction = { userId: string; kind: ReactionKind };

export type Comment = {
  id: string;
  snippetId: string;
  author: Profile;
  body: string;
  createdAt: string;
};

/** Every moment is explicitly kept for yourself or shared with friends. There is no default. */
export type Visibility = 'private' | 'friends';

/** Optional: what kind of moment this was. Lets Lookback gather threads ("Your firsts this year"). */
export type MomentKind = 'small_joy' | 'first_time' | 'proud_of' | 'hard_but_worth_it' | 'people';
export const MOMENT_KINDS: { kind: MomentKind; label: string; prompt: string; thread: string }[] = [
  { kind: 'small_joy', label: 'Small joy', prompt: 'What made this small thing feel good?', thread: 'Small joys' },
  { kind: 'first_time', label: 'First time', prompt: 'What was new for you here?', thread: 'Your firsts' },
  { kind: 'proud_of', label: 'Proud of', prompt: 'What did it take to get here?', thread: 'Things you were proud of' },
  { kind: 'hard_but_worth_it', label: 'Hard but worth it', prompt: 'What made it worth it?', thread: 'Hard but worth it' },
  { kind: 'people', label: 'People', prompt: 'What do you appreciate about them?', thread: 'Your people' },
];
export const isMomentKind = (k: unknown): k is MomentKind => MOMENT_KINDS.some((m) => m.kind === k);
export const kindLabel = (k: MomentKind | null) => (k ? MOMENT_KINDS.find((m) => m.kind === k)?.label ?? null : null);

/** A dated note added to a past moment later ("A year later, I still think about this"). Only ever the owner's. */
export type LookbackNote = {
  id: string;
  snippetId: string;
  body: string;
  writtenOn: ISODate;
  createdAt: string;
};

export type Snippet = {
  id: string;
  userId: string;
  weekStart: ISODate;
  happenedOn: ISODate;
  title: string;
  reflection: string;
  visibility: Visibility;
  kind: MomentKind | null;
  /** Your own looking-back notes, oldest first. Always empty on other people's moments. */
  notes: LookbackNote[];
  media: MediaItem[];
  reactions: Reaction[];
  comments: Comment[];
  createdAt: string;
};

export type WeekStatus = 'draft' | 'published' | 'backfilled';

export type Week = {
  weekStart: ISODate;
  status: WeekStatus;
  publishedAt: string | null;
  /** Your private one-line answer when you kept the week. Never shown to anyone else. */
  line: string | null;
  snippets: Snippet[];
};

/** "YYYY-MM" → the id of the moment that stood out that month. */
export type MonthPicks = Record<string, string>;

export type FriendWeek = {
  friend: Profile;
  posted: boolean;
  snippetCount: number;
  nudged: boolean;
  unlocked: boolean;
  snippets: Snippet[];
};

export type FriendRequest = { id: string; profile: Profile; direction: 'incoming' | 'outgoing' };

export type Settings = {
  timezone: string;
  inviteCode: string;
  notifySunday: boolean;
  notifyNudges: boolean;
  notifyFriendPosted: boolean;
  notifyReplies: boolean;
};

/** Media chosen on-device, not yet uploaded. */
export type LocalMedia = {
  local: true;
  uri: string;
  kind: 'image' | 'video';
  width: number;
  height: number;
  durationMs: number | null;
  mimeType: string;
};

export type DraftMedia = LocalMedia | (MediaItem & { local?: false });

export type SnippetInput = {
  id?: string;
  weekStart: ISODate;
  happenedOn: ISODate;
  title: string;
  reflection: string;
  visibility: Visibility;
  kind?: MomentKind | null;
  media: DraftMedia[];
};

export type Session = { userId: string; email: string | null } | null;

export interface Api {
  readonly mode: 'supabase' | 'demo';

  // Auth
  getSession(): Promise<Session>;
  onAuthChange(cb: (s: Session) => void): () => void;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signInWithApple(): Promise<void>;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;

  // Profile & settings
  me(): Promise<Profile>;
  updateProfile(p: { username?: string; displayName?: string; avatarUri?: string | null }): Promise<Profile>;
  isUsernameAvailable(username: string): Promise<boolean>;
  getSettings(): Promise<Settings>;
  updateSettings(s: Partial<Omit<Settings, 'inviteCode' | 'timezone'>>): Promise<void>;
  syncTimezone(tz: string): Promise<void>;
  registerPushToken(token: string, platform: string): Promise<void>;

  // My weeks
  myWeek(weekStart: ISODate): Promise<Week>;
  myArchive(): Promise<Week[]>;
  saveSnippet(input: SnippetInput, onProgress?: (fraction: number) => void): Promise<Snippet>;
  deleteSnippet(id: string): Promise<void>;
  /** Keep your week on Sunday, optionally with its private one-line answer. */
  publishWeek(weekStart: ISODate, line?: string): Promise<void>;
  /** Set or clear (empty string) a week's private line. */
  setWeekLine(weekStart: ISODate, line: string): Promise<void>;
  backfillWeek(weekStart: ISODate): Promise<void>;
  /** `shared`: friends can see it (marked for friends, and the week has been kept). */
  getSnippet(id: string): Promise<Snippet & { author: Profile; shared: boolean }>;

  // Looking back (owner-only)
  addLookbackNote(snippetId: string, body: string): Promise<LookbackNote>;
  deleteLookbackNote(id: string): Promise<void>;
  monthPicks(): Promise<MonthPicks>;
  /** month is "YYYY-MM"; null clears the pick. */
  pickMonth(month: string, snippetId: string | null): Promise<void>;

  // Friends' weeks
  friendsWeek(weekStart: ISODate): Promise<FriendWeek[]>;
  friendHistory(friendId: string): Promise<Week[]>;
  react(snippetId: string, kind: ReactionKind | null): Promise<void>;
  comment(snippetId: string, body: string): Promise<Comment>;
  deleteComment(id: string): Promise<void>;
  nudge(friendId: string): Promise<void>;

  // Friendships
  friends(): Promise<Profile[]>;
  friendRequests(): Promise<FriendRequest[]>;
  searchUsers(query: string): Promise<(Profile & { relation: 'none' | 'friend' | 'pending' })[]>;
  sendFriendRequest(userId: string): Promise<'pending' | 'accepted'>;
  respondToRequest(requestId: string, accept: boolean): Promise<void>;
  removeFriend(userId: string): Promise<void>;
  acceptInvite(code: string): Promise<Profile>;
  regenerateInviteCode(): Promise<string>;

  // First-party analytics: event names and small counts only, never content.
  track(name: AnalyticsEvent, props?: Record<string, number | string | boolean>): Promise<void>;

  // Safety
  report(target: ReportTarget, reason: string): Promise<void>;
  blockUser(userId: string): Promise<void>;
}

export type AnalyticsEvent =
  | 'app_open' | 'friends_viewed' | 'invite_sent' | 'invite_accepted'
  | 'recap_shared' | 'archive_exported' | 'moment_saved' | 'week_shared' | 'week_kept';

export type ReportTarget = { userId: string; snippetId?: string; commentId?: string };
