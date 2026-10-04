import { router } from 'expo-router';
import { CalendarHeart, Lock, LockOpen, Sparkles } from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
  type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, PrimaryButton, TextButton } from '../../components/ui';
import { DAY_SHORT } from '../../lib/week';
import { cardStyle, colors, gutter, iconStroke, type } from '../../theme';

/** First-launch intro: what Snippets is for, in four calm slides, then sign up. */
export default function Intro() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const slides: { key: string; art: ReactNode; title: string; body: string }[] = [
    {
      key: 'hello',
      art: (
        <View style={{ alignItems: 'center', gap: 14 }}>
          <Sparkles size={44} color={colors.accent} strokeWidth={1.25} />
          <Text style={[type.title, { fontSize: 40, letterSpacing: -0.6 }]}>Snippets</Text>
        </View>
      ),
      title: 'A few moments from your week.',
      body: 'Snippets is a private weekly scrapbook for you and your closest friends.',
    },
    {
      key: 'small',
      art: <MomentsArt />,
      title: 'The small stuff counts.',
      body: 'A good dinner. A rough game. A random Tuesday. Save up to three moments a week, using photos you already took.',
    },
    {
      key: 'sunday',
      art: <SundayArt />,
      title: 'Share on Sunday. See theirs.',
      body: 'Once a week, you and your friends swap weeks. Theirs open up when you share yours.',
    },
    {
      key: 'people',
      art: <PeopleArt />,
      title: 'Just people you know.',
      body: 'No followers, no feed, no likes, no streaks. And in a year, you’ll actually remember your year.',
    },
  ];
  const last = page === slides.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };
  const next = () => {
    if (last) return router.push('/sign-in');
    scroller.current?.scrollTo({ x: width * (page + 1), animated: true });
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.top}>
        {!last ? <TextButton title="Skip" color={colors.ink2} onPress={() => router.push('/sign-in')} /> : null}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={32}
        style={{ flex: 1 }}
      >
        {slides.map((s) => (
          <View key={s.key} style={[styles.slide, { width }]}>
            <View style={styles.art}>{s.art}</View>
            <Text style={[type.title, styles.title]}>{s.title}</Text>
            <Text style={[type.body, styles.body]}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {slides.map((s, i) => (
          <View key={s.key} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>
      <View style={{ paddingHorizontal: gutter + 8, gap: 14, alignItems: 'center' }}>
        <PrimaryButton title={last ? 'Get started' : 'Next'} onPress={next} style={{ alignSelf: 'stretch' }} />
        <Pressable onPress={() => router.push('/sign-in')} hitSlop={8} style={{ opacity: last ? 1 : 0 }} disabled={!last}>
          <Text style={type.secondary}>I already have an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MomentsArt() {
  const rows = [
    { day: 'Mon', title: 'Ramen, finally' },
    { day: 'Wed', title: 'Lost by 20, still fun' },
    { day: 'Sat', title: 'Philly day trip' },
  ];
  return (
    <View style={{ gap: 8, width: 270 }}>
      {rows.map((r, i) => (
        <View key={r.day} style={[cardStyle, styles.miniCard, { marginLeft: i * 14 }]}>
          <Text style={[type.small, { width: 34 }]}>{r.day}</Text>
          <Text style={[type.body, { flex: 1, fontWeight: '500' }]} numberOfLines={1}>{r.title}</Text>
          <View style={styles.miniThumb} />
        </View>
      ))}
    </View>
  );
}

function SundayArt() {
  return (
    <View style={{ alignItems: 'center', gap: 18 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {DAY_SHORT.map((d, i) => (
          <View key={d} style={[styles.dayChip, i === 6 && styles.dayChipOn]}>
            <Text style={[styles.dayChipText, i === 6 && { color: colors.accentInk }]}>{d[0]}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Lock size={22} color={colors.ink3} strokeWidth={iconStroke} />
        <CalendarHeart size={30} color={colors.accent} strokeWidth={1.5} />
        <LockOpen size={22} color={colors.accent} strokeWidth={iconStroke} />
      </View>
    </View>
  );
}

function PeopleArt() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {['Sarah', 'Mike', 'You', 'Jess', 'Priya'].map((n, i) => (
        <View key={n} style={{ marginLeft: i ? -10 : 0, transform: [{ translateY: i % 2 ? 6 : -4 }] }}>
          <Avatar name={n} size={i === 2 ? 64 : 50} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { height: 44, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: gutter },
  slide: { paddingHorizontal: gutter + 12, justifyContent: 'center' },
  art: { height: 220, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  title: { fontSize: 30, lineHeight: 36 },
  body: { fontSize: 17, lineHeight: 25, color: colors.ink2, marginTop: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: 22 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.hairlineStrong },
  dotActive: { backgroundColor: colors.accent, width: 18 },
  miniCard: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14 },
  miniThumb: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.accentSoft },
  dayChip: {
    width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairlineStrong,
  },
  dayChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayChipText: { fontSize: 14, fontWeight: '500', color: colors.ink2 },
});
