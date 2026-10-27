import { router, useLocalSearchParams } from 'expo-router';
import { Ellipsis } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { BackBar } from '../../components/BackBar';
import { MediaPlayer } from '../../components/media';
import { CommentInput, CommentList, ReactionBar } from '../../components/social';
import { Avatar, ErrorNote, Loading, TextButton } from '../../components/ui';
import { openEditor } from '../../lib/nav';
import { useMe, useSnippet } from '../../lib/queries';
import { blockUser, chooseAction, reportContent } from '../../lib/safety';
import { formatDay } from '../../lib/week';
import { colors, gutter, iconStroke, type } from '../../theme';

export default function SnippetDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const snippet = useSnippet(id);
  const me = useMe();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const s = snippet.data;
  const meId = me.data?.id ?? '';
  const isMine = s?.userId === meId;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BackBar
        title={s ? (isMine ? 'Your moment' : s.author.displayName) : undefined}
        right={
          !s ? null : isMine ? (
            <TextButton title="Edit" onPress={() => openEditor({ weekStart: s.weekStart, id: s.id })} />
          ) : (
            <Pressable
              hitSlop={12}
              accessibilityLabel="More options"
              onPress={() =>
                chooseAction(undefined, [
                  { label: 'Report this moment', run: () => reportContent({ userId: s.userId, snippetId: s.id }, 'moment') },
                  { label: `Block ${s.author.displayName}`, destructive: true, run: () => blockUser(s.userId, s.author.displayName, () => router.back()) },
                ])
              }
            >
              <Ellipsis size={24} color={colors.ink} strokeWidth={iconStroke} />
            </Pressable>
          )
        }
      />
      {snippet.isLoading ? (
        <Loading />
      ) : !s ? (
        <ErrorNote error={snippet.error} onRetry={() => snippet.refetch()} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll}>
            {s.media.map((m) => (
              <MediaPlayer key={m.id} item={m} style={{ width, height: width * 1.2 }} />
            ))}
          </ScrollView>
          {s.media.length > 1 ? (
            <View style={styles.dots}>
              {s.media.map((m, i) => (
                <View key={m.id} style={[styles.dot, i === page && { backgroundColor: colors.accent }]} />
              ))}
            </View>
          ) : null}

          <View style={{ paddingHorizontal: gutter, paddingTop: 18 }}>
            {!isMine ? (
              <View style={styles.author}>
                <Avatar name={s.author.displayName} url={s.author.avatarUrl} size={32} />
                <Text style={[type.body, { fontWeight: '500' }]}>{s.author.displayName}</Text>
              </View>
            ) : null}
            <Text style={type.small}>{formatDay(s.happenedOn)}</Text>
            {s.title ? <Text style={[type.prompt, { fontSize: 22, marginTop: 4 }]}>{s.title}</Text> : null}
            {s.reflection ? <Text style={[type.body, { marginTop: 8, fontSize: 16, lineHeight: 23 }]}>{s.reflection}</Text> : null}

            {s.shared ? (
              <>
                <View style={{ marginTop: 18 }}>
                  <ReactionBar snippet={s} meId={meId} />
                </View>
                <View style={{ marginTop: 16 }}>
                  <CommentList comments={s.comments} meId={meId} ownerId={s.userId} />
                </View>
                <View style={{ marginTop: 14 }}>
                  <CommentInput snippetId={s.id} />
                </View>
              </>
            ) : (
              <Text style={[type.small, { marginTop: 18, color: colors.ink3 }]}>
                Only you can see this until you share the week.
              </Text>
            )}
            {!isMine ? (
              <View style={{ alignItems: 'center', marginTop: 28 }}>
                <TextButton
                  title={`More from ${s.author.displayName}`}
                  onPress={() => router.push({ pathname: '/friend/[id]', params: { id: s.userId } })}
                />
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.hairlineStrong },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
});
