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

export type Snippet = {
  id: string;
  userId: string;
  weekStart: ISODate;
  happenedOn: ISODate;
  title: string;
  reflection: string;
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
  snippets: Snippet[];
};

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
  publishWeek(weekStart: ISODate): Promise<void>;
  backfillWeek(weekStart: ISODate): Promise<void>;
  /** `shared` is false while the moment's week is still a private draft. */
  getSnippet(id: string): Promise<Snippet & { author: Profile; shared: boolean }>;

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

  // Safety
  report(target: ReportTarget, reason: string): Promise<void>;
  blockUser(userId: string): Promise<void>;
}

export type ReportTarget = { userId: string; snippetId?: string; commentId?: string };
