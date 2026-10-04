import { MutationCache, QueryCache, QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { api, type ReactionKind } from './api';
import { reportError } from './monitoring';
import type { ISODate } from './week';

export const queryClient = new QueryClient({
  // Every failed load or save is reported (with the query key, never the payload).
  queryCache: new QueryCache({ onError: (e, q) => reportError(e, { query: q.queryKey.join('/') }) }),
  mutationCache: new MutationCache({ onError: (e) => reportError(e, { kind: 'mutation' }) }),
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: {
      onError: (e) => Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e)),
    },
  },
});

export const keys = {
  me: ['me'] as const,
  settings: ['settings'] as const,
  myWeek: (w: ISODate) => ['myWeek', w] as const,
  archive: ['archive'] as const,
  friendsWeek: (w: ISODate) => ['friendsWeek', w] as const,
  friendHistory: (id: string) => ['friendHistory', id] as const,
  snippet: (id: string) => ['snippet', id] as const,
  friends: ['friends'] as const,
  requests: ['requests'] as const,
};

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api.me() });
export const useSettings = () => useQuery({ queryKey: keys.settings, queryFn: () => api.getSettings() });
export const useMyWeek = (w: ISODate) => useQuery({ queryKey: keys.myWeek(w), queryFn: () => api.myWeek(w) });
export const useArchive = () => useQuery({ queryKey: keys.archive, queryFn: () => api.myArchive() });
export const useFriendsWeek = (w: ISODate) =>
  useQuery({ queryKey: keys.friendsWeek(w), queryFn: () => api.friendsWeek(w) });
export const useFriendHistory = (id: string, enabled = true) =>
  useQuery({ queryKey: keys.friendHistory(id), queryFn: () => api.friendHistory(id), enabled: enabled && !!id });
export const useSnippet = (id: string) => useQuery({ queryKey: keys.snippet(id), queryFn: () => api.getSnippet(id) });
export const useFriends = () => useQuery({ queryKey: keys.friends, queryFn: () => api.friends() });
export const useRequests = () => useQuery({ queryKey: keys.requests, queryFn: () => api.friendRequests() });

/** Anything touching snippets, reactions or comments invalidates the snippet views. */
export function invalidateSnippets() {
  return Promise.all(
    ['myWeek', 'archive', 'friendsWeek', 'friendHistory', 'snippet'].map((k) =>
      queryClient.invalidateQueries({ queryKey: [k] }),
    ),
  );
}

export function invalidateFriends() {
  return Promise.all(
    ['friends', 'requests', 'friendsWeek', 'friendHistory'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })),
  );
}

export function useReact() {
  return useMutation({
    mutationFn: ({ snippetId, kind }: { snippetId: string; kind: ReactionKind | null }) => api.react(snippetId, kind),
    onSettled: invalidateSnippets,
  });
}

export function useComment() {
  return useMutation({
    mutationFn: ({ snippetId, body }: { snippetId: string; body: string }) => api.comment(snippetId, body),
    onSuccess: invalidateSnippets,
  });
}

export function useDeleteComment() {
  return useMutation({ mutationFn: (id: string) => api.deleteComment(id), onSuccess: invalidateSnippets });
}

export function useNudge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (friendId: string) => api.nudge(friendId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friendsWeek'] }),
  });
}
