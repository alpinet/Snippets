import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { makeRedirectUri } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { appScheme } from '../config';
import { prepareForUpload } from '../media';
import type { ISODate } from '../week';
import type {
  Api, Comment, FriendRequest, FriendWeek, LocalMedia, MediaItem, Profile, ReactionKind,
  AnalyticsEvent, ReportTarget, Session, Settings, Snippet, SnippetInput, Week, WeekStatus,
} from './types';

WebBrowser.maybeCompleteAuthSession();

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

type ProfileRow = { id: string; username: string | null; display_name: string; avatar_path: string | null };
type MediaRow = {
  id: string; kind: 'image' | 'video'; path: string; thumb_path: string | null;
  width: number; height: number; duration_ms: number | null; position: number;
};
type CommentRow = { id: string; snippet_id: string; body: string; created_at: string; author: ProfileRow };
type SnippetRow = {
  id: string; user_id: string; week_start: string; happened_on: string; title: string;
  reflection: string; position: number; created_at: string;
  media: MediaRow[]; reactions: { user_id: string; kind: ReactionKind }[]; comments: CommentRow[];
  author?: ProfileRow;
};

const PROFILE_COLS = 'id,username,display_name,avatar_path';
const SNIPPET_COLS = `id,user_id,week_start,happened_on,title,reflection,position,created_at,
  media(id,kind,path,thumb_path,width,height,duration_ms,position),
  reactions(user_id,kind),
  comments(id,snippet_id,body,created_at,author:profiles(${PROFILE_COLS}))`;

const SIGNED_URL_TTL = 60 * 60 * 6;

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message);
}

export class SupabaseApi implements Api {
  readonly mode = 'supabase' as const;
  private sb: SupabaseClient;
  private urlCache = new Map<string, { url: string; expires: number }>();

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    });
  }

  private async uid(): Promise<string> {
    const { data } = await this.sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('Not signed in');
    return id;
  }

  // -------------------------------------------------------------------------
  // Signed URLs (private buckets). Cached by path so images stay cacheable.
  // -------------------------------------------------------------------------

  private async sign(bucket: 'media' | 'avatars', paths: (string | null | undefined)[]) {
    const nowMs = Date.now();
    const need = [...new Set(paths.filter((p): p is string => !!p))].filter((p) => {
      const c = this.urlCache.get(`${bucket}:${p}`);
      return !c || c.expires < nowMs + 5 * 60_000;
    });
    for (let i = 0; i < need.length; i += 100) {
      const chunk = need.slice(i, i + 100);
      const { data, error } = await this.sb.storage.from(bucket).createSignedUrls(chunk, SIGNED_URL_TTL);
      fail(error);
      for (const d of data ?? []) {
        if (d.signedUrl && d.path) {
          this.urlCache.set(`${bucket}:${d.path}`, { url: d.signedUrl, expires: nowMs + SIGNED_URL_TTL * 1000 });
        }
      }
    }
  }

  private url(bucket: 'media' | 'avatars', path: string | null): string | null {
    if (!path) return null;
    return this.urlCache.get(`${bucket}:${path}`)?.url ?? null;
  }

  private async hydrateProfiles(rows: ProfileRow[]): Promise<Profile[]> {
    await this.sign('avatars', rows.map((r) => r.avatar_path));
    return rows.map((r) => this.toProfile(r));
  }

  private toProfile(r: ProfileRow): Profile {
    return {
      id: r.id,
      username: r.username,
      displayName: r.display_name || r.username || 'Friend',
      avatarUrl: this.url('avatars', r.avatar_path),
    };
  }

  private async hydrateSnippets(rows: SnippetRow[]): Promise<Snippet[]> {
    await Promise.all([
      this.sign('media', rows.flatMap((s) => s.media.flatMap((m) => [m.path, m.thumb_path]))),
      this.sign('avatars', rows.flatMap((s) => [
        s.author?.avatar_path, ...s.comments.map((c) => c.author?.avatar_path),
      ])),
    ]);
    return rows
      .map((s) => ({
        id: s.id,
        userId: s.user_id,
        weekStart: s.week_start,
        happenedOn: s.happened_on,
        title: s.title,
        reflection: s.reflection,
        createdAt: s.created_at,
        media: [...s.media].sort((a, b) => a.position - b.position).map((m): MediaItem => ({
          id: m.id,
          kind: m.kind,
          url: this.url('media', m.path) ?? '',
          thumbUrl: this.url('media', m.thumb_path),
          cacheKey: m.path,
          width: m.width,
          height: m.height,
          durationMs: m.duration_ms,
        })),
        reactions: s.reactions.map((r) => ({ userId: r.user_id, kind: r.kind })),
        comments: [...s.comments]
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((c) => this.toComment(c)),
      }))
      .sort((a, b) => a.happenedOn.localeCompare(b.happenedOn) || a.createdAt.localeCompare(b.createdAt));
  }

  private toComment(c: CommentRow): Comment {
    return { id: c.id, snippetId: c.snippet_id, body: c.body, createdAt: c.created_at, author: this.toProfile(c.author) };
  }

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  async getSession(): Promise<Session> {
    const { data } = await this.sb.auth.getSession();
    const u = data.session?.user;
    return u ? { userId: u.id, email: u.email ?? null } : null;
  }

  onAuthChange(cb: (s: Session) => void) {
    const { data } = this.sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      cb(u ? { userId: u.id, email: u.email ?? null } : null);
    });
    return () => data.subscription.unsubscribe();
  }

  async signInWithEmail(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password });
    fail(error);
  }

  async signUpWithEmail(email: string, password: string) {
    const { data, error } = await this.sb.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: makeRedirectUri({ scheme: appScheme, path: 'auth-callback' }) },
    });
    fail(error);
    return { needsConfirmation: !data.session };
  }

  async signInWithApple() {
    if (Platform.OS !== 'ios') return this.oauth('apple');
    const rawNonce = Crypto.randomUUID();
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed,
    });
    if (!cred.identityToken) throw new Error('Apple didn’t return a sign-in token');
    const { error } = await this.sb.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken, nonce: rawNonce });
    fail(error);
    // Keep a revocable Apple token server-side so account deletion can revoke it. Best effort.
    if (cred.authorizationCode) {
      this.sb.functions
        .invoke('apple-auth', { body: { code: cred.authorizationCode, clientId: Constants.expoConfig?.ios?.bundleIdentifier } })
        .catch(() => {});
    }
    // Apple only shares the name on first sign-in.
    const name = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ');
    if (name) {
      const me = await this.me();
      if (!me.displayName || me.displayName === 'Friend') await this.updateProfile({ displayName: name });
    }
  }

  async signInWithGoogle() {
    return this.oauth('google');
  }

  private async oauth(provider: 'google' | 'apple') {
    const redirectTo = makeRedirectUri({ scheme: appScheme, path: 'auth-callback' });
    const { data, error } = await this.sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    fail(error);
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type !== 'success') return;
    const code = new URL(res.url).searchParams.get('code');
    if (!code) throw new Error('Sign-in was not completed');
    const { error: exErr } = await this.sb.auth.exchangeCodeForSession(code);
    fail(exErr);
  }

  async signOut() {
    await this.sb.auth.signOut();
    this.urlCache.clear();
  }

  async deleteAccount() {
    const { error } = await this.sb.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw new Error('We couldn’t delete your account. Please try again.');
    await this.sb.auth.signOut({ scope: 'local' });
    this.urlCache.clear();
  }

  // -------------------------------------------------------------------------
  // Profile & settings
  // -------------------------------------------------------------------------

  async me(): Promise<Profile> {
    const uid = await this.uid();
    const { data, error } = await this.sb.from('profiles').select(PROFILE_COLS).eq('id', uid).single();
    fail(error);
    const [p] = await this.hydrateProfiles([data as ProfileRow]);
    return p;
  }

  async updateProfile(p: { username?: string; displayName?: string; avatarUri?: string | null }) {
    const uid = await this.uid();
    const patch: Record<string, unknown> = {};
    if (p.username !== undefined) patch.username = p.username.trim().toLowerCase();
    if (p.displayName !== undefined) patch.display_name = p.displayName.trim();
    let previousAvatar: string | null = null;
    if (p.avatarUri !== undefined) {
      const { data: prev } = await this.sb.from('profiles').select('avatar_path').eq('id', uid).single();
      previousAvatar = prev?.avatar_path ?? null;
      patch.avatar_path = null;
    }
    if (p.avatarUri) {
      const path = `${uid}/avatar-${Date.now()}.jpg`;
      const bytes = await new File(p.avatarUri).arrayBuffer();
      const { error } = await this.sb.storage.from('avatars').upload(path, bytes, { contentType: 'image/jpeg' });
      fail(error);
      patch.avatar_path = path;
    }
    if (Object.keys(patch).length) {
      const { error } = await this.sb.from('profiles').update(patch).eq('id', uid);
      if (error?.code === '23505') throw new Error('That username is taken');
      fail(error);
    }
    // Only after the new photo is saved: remove the old one (avatars are capped per user).
    if (previousAvatar && previousAvatar !== patch.avatar_path) {
      await this.sb.storage.from('avatars').remove([previousAvatar]);
    }
    return this.me();
  }

  async isUsernameAvailable(username: string) {
    const uid = await this.uid();
    const { data } = await this.sb.from('profiles').select('id').eq('username', username.toLowerCase()).maybeSingle();
    return !data || data.id === uid;
  }

  async getSettings(): Promise<Settings> {
    const uid = await this.uid();
    const { data, error } = await this.sb.from('user_private').select('*').eq('user_id', uid).single();
    fail(error);
    return {
      timezone: data.timezone,
      inviteCode: data.invite_code,
      notifySunday: data.notify_sunday,
      notifyNudges: data.notify_nudges,
      notifyFriendPosted: data.notify_friend_posted,
      notifyReplies: data.notify_replies,
    };
  }

  async updateSettings(s: Partial<Omit<Settings, 'inviteCode' | 'timezone'>>) {
    const uid = await this.uid();
    const patch: Record<string, boolean> = {};
    if (s.notifySunday !== undefined) patch.notify_sunday = s.notifySunday;
    if (s.notifyNudges !== undefined) patch.notify_nudges = s.notifyNudges;
    if (s.notifyFriendPosted !== undefined) patch.notify_friend_posted = s.notifyFriendPosted;
    if (s.notifyReplies !== undefined) patch.notify_replies = s.notifyReplies;
    const { error } = await this.sb.from('user_private').update(patch).eq('user_id', uid);
    fail(error);
  }

  async syncTimezone(tz: string) {
    const { error } = await this.sb.rpc('set_timezone', { tz });
    fail(error);
  }

  async registerPushToken(token: string, platform: string) {
    const uid = await this.uid();
    const { error } = await this.sb.from('devices').upsert({ token, user_id: uid, platform, updated_at: new Date().toISOString() });
    fail(error);
  }

  // -------------------------------------------------------------------------
  // My weeks
  // -------------------------------------------------------------------------

  async myWeek(weekStart: ISODate): Promise<Week> {
    const uid = await this.uid();
    const [w, s] = await Promise.all([
      this.sb.from('weeks').select('status,published_at').eq('user_id', uid).eq('week_start', weekStart).maybeSingle(),
      this.sb.from('snippets').select(SNIPPET_COLS).eq('user_id', uid).eq('week_start', weekStart),
    ]);
    fail(w.error);
    fail(s.error);
    return {
      weekStart,
      status: (w.data?.status as WeekStatus) ?? 'draft',
      publishedAt: w.data?.published_at ?? null,
      snippets: await this.hydrateSnippets((s.data ?? []) as unknown as SnippetRow[]),
    };
  }

  async myArchive(): Promise<Week[]> {
    const uid = await this.uid();
    const [w, s] = await Promise.all([
      this.sb.from('weeks').select('week_start,status,published_at').eq('user_id', uid),
      this.sb.from('snippets').select(SNIPPET_COLS).eq('user_id', uid),
    ]);
    fail(w.error);
    fail(s.error);
    const snippets = await this.hydrateSnippets((s.data ?? []) as unknown as SnippetRow[]);
    return (w.data ?? [])
      .map((row) => ({
        weekStart: row.week_start as string,
        status: row.status as WeekStatus,
        publishedAt: row.published_at as string | null,
        snippets: snippets.filter((x) => x.weekStart === row.week_start),
      }))
      .filter((wk) => wk.snippets.length > 0)
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }

  async saveSnippet(input: SnippetInput, onProgress?: (f: number) => void): Promise<Snippet> {
    const uid = await this.uid();
    const isNew = !input.id;
    const id = input.id ?? Crypto.randomUUID();
    const fields = {
      happened_on: input.happenedOn,
      title: input.title.trim(),
      reflection: input.reflection.trim(),
    };

    if (isNew) {
      const { error } = await this.sb.from('snippets').insert({ id, user_id: uid, week_start: input.weekStart, ...fields });
      fail(error);
    } else {
      const { error } = await this.sb.from('snippets').update(fields).eq('id', id);
      fail(error);
    }

    try {
      // Remove media the user took out.
      const { data: existing, error: exErr } = await this.sb
        .from('media').select('id,path,thumb_path').eq('snippet_id', id);
      fail(exErr);
      const keep = new Set(input.media.filter((m) => !m.local).map((m) => m.id));
      const removed = (existing ?? []).filter((m) => !keep.has(m.id));
      if (removed.length) {
        await this.sb.from('media').delete().in('id', removed.map((m) => m.id));
        await this.sb.storage.from('media').remove(removed.flatMap((m) => [m.path, m.thumb_path].filter(Boolean) as string[]));
      }

      // Upload new media, then write positions for everything.
      const uploads = input.media.filter((m): m is LocalMedia => !!m.local);
      let done = 0;
      onProgress?.(uploads.length ? 0.05 : 1);
      for (const [position, m] of input.media.entries()) {
        if (!m.local) {
          await this.sb.from('media').update({ position }).eq('id', m.id);
          continue;
        }
        const prepared = await prepareForUpload(m);
        const mediaId = Crypto.randomUUID();
        const path = `${uid}/${id}/${mediaId}.${prepared.ext}`;
        const bytes = await new File(prepared.uri).arrayBuffer();
        const up = await this.sb.storage.from('media').upload(path, bytes, { contentType: prepared.mimeType });
        fail(up.error);
        let thumbPath: string | null = null;
        if (prepared.thumb) {
          thumbPath = `${uid}/${id}/${mediaId}-thumb.jpg`;
          const tb = await new File(prepared.thumb.uri).arrayBuffer();
          const tu = await this.sb.storage.from('media').upload(thumbPath, tb, { contentType: 'image/jpeg' });
          fail(tu.error);
        }
        const { error } = await this.sb.from('media').insert({
          id: mediaId, snippet_id: id, user_id: uid, kind: m.kind, path, thumb_path: thumbPath,
          width: prepared.width, height: prepared.height, duration_ms: m.durationMs, position,
        });
        fail(error);
        done += 1;
        onProgress?.(done / uploads.length);
      }
    } catch (e) {
      if (isNew) await this.deleteSnippet(id).catch(() => {});
      throw e;
    }

    const { data, error } = await this.sb.from('snippets').select(SNIPPET_COLS).eq('id', id).single();
    fail(error);
    const [s] = await this.hydrateSnippets([data as unknown as SnippetRow]);
    return s;
  }

  async deleteSnippet(id: string) {
    const { data: media } = await this.sb.from('media').select('path,thumb_path').eq('snippet_id', id);
    const paths = (media ?? []).flatMap((m) => [m.path, m.thumb_path]).filter(Boolean) as string[];
    const { error } = await this.sb.from('snippets').delete().eq('id', id);
    fail(error);
    if (paths.length) await this.sb.storage.from('media').remove(paths);
  }

  async publishWeek(weekStart: ISODate) {
    const { error } = await this.sb.rpc('publish_week', { wk: weekStart });
    fail(error);
  }

  async backfillWeek(weekStart: ISODate) {
    const { error } = await this.sb.rpc('backfill_week', { wk: weekStart });
    fail(error);
  }

  async getSnippet(id: string) {
    const { data, error } = await this.sb
      .from('snippets').select(`${SNIPPET_COLS},author:profiles(${PROFILE_COLS})`).eq('id', id).single();
    fail(error);
    const row = data as unknown as SnippetRow;
    const [[s], week] = await Promise.all([
      this.hydrateSnippets([row]),
      this.sb.from('weeks').select('status').eq('user_id', row.user_id).eq('week_start', row.week_start).maybeSingle(),
    ]);
    return { ...s, author: this.toProfile(row.author!), shared: (week.data?.status ?? 'draft') !== 'draft' };
  }

  // -------------------------------------------------------------------------
  // Friends' weeks
  // -------------------------------------------------------------------------

  async friendsWeek(weekStart: ISODate): Promise<FriendWeek[]> {
    const [statusRes, friends] = await Promise.all([
      this.sb.rpc('friends_week_status', { wk: weekStart }),
      this.friends(),
    ]);
    fail(statusRes.error);
    const statuses = (statusRes.data ?? []) as {
      friend_id: string; posted: boolean; snippet_count: number; nudged: boolean; unlocked: boolean;
    }[];
    const unlockedIds = statuses.filter((s) => s.unlocked).map((s) => s.friend_id);
    let snippets: Snippet[] = [];
    if (unlockedIds.length) {
      const { data, error } = await this.sb
        .from('snippets').select(SNIPPET_COLS).eq('week_start', weekStart).in('user_id', unlockedIds);
      fail(error);
      snippets = await this.hydrateSnippets((data ?? []) as unknown as SnippetRow[]);
    }
    return friends.map((friend) => {
      const st = statuses.find((s) => s.friend_id === friend.id);
      return {
        friend,
        posted: !!st?.posted,
        snippetCount: st?.snippet_count ?? 0,
        nudged: !!st?.nudged,
        unlocked: !!st?.unlocked,
        snippets: snippets.filter((s) => s.userId === friend.id),
      };
    });
  }

  async friendHistory(friendId: string): Promise<Week[]> {
    const [w, s] = await Promise.all([
      this.sb.from('weeks').select('week_start,status,published_at').eq('user_id', friendId),
      this.sb.from('snippets').select(SNIPPET_COLS).eq('user_id', friendId),
    ]);
    fail(w.error);
    fail(s.error);
    const snippets = await this.hydrateSnippets((s.data ?? []) as unknown as SnippetRow[]);
    return (w.data ?? [])
      .map((row) => ({
        weekStart: row.week_start as string,
        status: row.status as WeekStatus,
        publishedAt: row.published_at as string | null,
        snippets: snippets.filter((x) => x.weekStart === row.week_start),
      }))
      .filter((wk) => wk.snippets.length)
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }

  async react(snippetId: string, kind: ReactionKind | null) {
    const uid = await this.uid();
    if (!kind) {
      const { error } = await this.sb.from('reactions').delete().eq('snippet_id', snippetId).eq('user_id', uid);
      fail(error);
      return;
    }
    const { error } = await this.sb.from('reactions').upsert({ snippet_id: snippetId, user_id: uid, kind });
    fail(error);
  }

  async comment(snippetId: string, body: string): Promise<Comment> {
    const { data, error } = await this.sb
      .from('comments')
      .insert({ snippet_id: snippetId, body: body.trim() })
      .select(`id,snippet_id,body,created_at,author:profiles(${PROFILE_COLS})`)
      .single();
    fail(error);
    const row = data as unknown as CommentRow;
    await this.sign('avatars', [row.author.avatar_path]);
    return this.toComment(row);
  }

  async deleteComment(id: string) {
    const { error } = await this.sb.from('comments').delete().eq('id', id);
    fail(error);
  }

  async nudge(friendId: string) {
    const { error } = await this.sb.rpc('nudge', { friend: friendId });
    fail(error);
  }

  // -------------------------------------------------------------------------
  // Friendships
  // -------------------------------------------------------------------------

  private async friendshipRows() {
    const uid = await this.uid();
    const { data, error } = await this.sb
      .from('friendships')
      .select(`id,status,requester_id,recipient_id,
        requester:profiles!friendships_requester_id_fkey(${PROFILE_COLS}),
        recipient:profiles!friendships_recipient_id_fkey(${PROFILE_COLS})`);
    fail(error);
    type Row = { id: string; status: string; requester_id: string; recipient_id: string; requester: ProfileRow; recipient: ProfileRow };
    const rows = (data ?? []) as unknown as Row[];
    await this.sign('avatars', rows.flatMap((r) => [r.requester.avatar_path, r.recipient.avatar_path]));
    return rows.map((r) => {
      const outgoing = r.requester_id === uid;
      return { id: r.id, status: r.status, outgoing, other: this.toProfile(outgoing ? r.recipient : r.requester) };
    });
  }

  async friends(): Promise<Profile[]> {
    const rows = await this.friendshipRows();
    return rows
      .filter((r) => r.status === 'accepted')
      .map((r) => r.other)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async friendRequests(): Promise<FriendRequest[]> {
    const rows = await this.friendshipRows();
    return rows
      .filter((r) => r.status === 'pending')
      .map((r) => ({ id: r.id, profile: r.other, direction: r.outgoing ? 'outgoing' : 'incoming' }));
  }

  async searchUsers(query: string) {
    const q = query.trim().toLowerCase().replace(/^@/, '').replace(/[%_]/g, '');
    if (q.length < 2) return [];
    const uid = await this.uid();
    const [{ data, error }, rows] = await Promise.all([
      this.sb.from('profiles').select(PROFILE_COLS).ilike('username', `${q}%`).neq('id', uid).limit(20),
      this.friendshipRows(),
    ]);
    fail(error);
    const profiles = await this.hydrateProfiles((data ?? []) as ProfileRow[]);
    return profiles.map((p) => {
      const rel = rows.find((r) => r.other.id === p.id);
      return { ...p, relation: rel ? (rel.status === 'accepted' ? 'friend' : 'pending') : 'none' } as const;
    });
  }

  async sendFriendRequest(userId: string) {
    const { data, error } = await this.sb.rpc('send_friend_request', { target: userId });
    fail(error);
    return data === 'accepted' ? 'accepted' : 'pending';
  }

  async respondToRequest(requestId: string, accept: boolean) {
    const { error } = await this.sb.rpc('respond_friend_request', { request_id: requestId, accept });
    fail(error);
  }

  async removeFriend(userId: string) {
    const { error } = await this.sb.rpc('remove_friend', { other: userId });
    fail(error);
  }

  async acceptInvite(code: string) {
    const { data, error } = await this.sb.rpc('accept_invite', { code });
    fail(error);
    const { data: p, error: pErr } = await this.sb.from('profiles').select(PROFILE_COLS).eq('id', data).single();
    fail(pErr);
    const [profile] = await this.hydrateProfiles([p as ProfileRow]);
    return profile;
  }

  async regenerateInviteCode() {
    const { data, error } = await this.sb.rpc('regenerate_invite_code');
    fail(error);
    return data as string;
  }

  // -------------------------------------------------------------------------
  // Safety
  // -------------------------------------------------------------------------

  async report(target: ReportTarget, reason: string) {
    const { error } = await this.sb.from('reports').insert({
      target_user_id: target.userId,
      snippet_id: target.snippetId ?? null,
      comment_id: target.commentId ?? null,
      reason,
    });
    fail(error);
  }

  async blockUser(userId: string) {
    const { error } = await this.sb.rpc('block_user', { target: userId });
    fail(error);
  }

  async track(name: AnalyticsEvent, props?: Record<string, number | string | boolean>) {
    const { data } = await this.sb.auth.getSession();
    if (!data.session) return;
    await this.sb.from('app_events').insert({ name, props: props ?? {} });
  }
}
