import * as Sharing from 'expo-sharing';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { BackBar } from '../components/BackBar';
import { MediaThumb } from '../components/media';
import { Loading, PrimaryButton } from '../components/ui';
import { track } from '../lib/analytics';
import { useArchive } from '../lib/queries';
import { DAY_SHORT, dayIndex } from '../lib/week';
import { colors, gutter, type } from '../theme';

/**
 * A shareable scrapbook card for any date range (a week, a month — or "Your 2026" in December).
 * Params: from, to (YYYY-MM-DD, inclusive), title (e.g. "My week · Sep 21 – 27").
 * You choose to share it; nothing is posted anywhere by the app.
 */
export default function Recap() {
  const { from, to, title } = useLocalSearchParams<{ from: string; to: string; title: string }>();
  const archive = useArchive();
  const { width } = useWindowDimensions();
  const card = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  const moments = useMemo(
    () =>
      (archive.data ?? [])
        .flatMap((w) => w.snippets)
        .filter((s) => s.happenedOn >= from && s.happenedOn <= to)
        .sort((a, b) => a.happenedOn.localeCompare(b.happenedOn)),
    [archive.data, from, to],
  );
  const covers = moments.map((s) => s.media[0]).filter(Boolean).slice(0, 4);
  const cardW = width - gutter * 2;
  const tile = (cardW - 28 * 2 - 10) / 2;
  const multiDay = from.slice(0, 7) !== to.slice(0, 7) || moments.length > 3;

  const share = async () => {
    setBusy(true);
    try {
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share your snippets' });
      track('recap_shared', { moments: moments.length });
    } catch (e) {
      Alert.alert('Couldn’t make the image', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <BackBar title="Share as image" />
      {archive.isLoading ? (
        <Loading />
      ) : (
        <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 48 }}>
          {/* Everything inside this view becomes the image. */}
          <View ref={card} collapsable={false} style={[styles.card, { width: cardW }]}>
            <Text style={styles.brand}>✦ Snippets</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={[type.secondary, { marginTop: 2 }]}>
              {moments.length} {moments.length === 1 ? 'moment' : 'moments'} I chose to keep
            </Text>

            <View style={styles.grid}>
              {covers.map((m, i) => (
                <MediaThumb
                  key={m.id}
                  item={m}
                  showPlay={false}
                  rounded={14}
                  style={[
                    styles.photo,
                    { width: tile, height: tile * 1.15, transform: [{ rotate: `${[-2.5, 2, 1.5, -2][i]}deg` }] },
                  ]}
                />
              ))}
            </View>

            <View style={{ marginTop: 18, gap: 6 }}>
              {moments.slice(0, 6).map((s) => (
                <Text key={s.id} style={styles.line} numberOfLines={1}>
                  <Text style={styles.lineDay}>
                    {multiDay ? s.happenedOn.slice(5).replace('-', '/') : DAY_SHORT[dayIndex(s.happenedOn)]}
                  </Text>
                  {'  '}
                  {s.title || 'A moment'}
                </Text>
              ))}
              {moments.length > 6 ? <Text style={type.small}>+ {moments.length - 6} more</Text> : null}
            </View>

            <Text style={styles.footer}>Kept with Snippets — a few moments at a time</Text>
          </View>

          <Text style={[type.small, { textAlign: 'center', marginTop: 16, color: colors.ink3 }]}>
            Only titles and cover photos are included — never reflections or comments.
          </Text>
          <PrimaryButton
            title="Share image"
            onPress={share}
            loading={busy}
            disabled={moments.length === 0}
            style={{ marginTop: 16 }}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bg,
    borderRadius: 24,
    padding: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  brand: { fontSize: 14, fontWeight: '600', color: colors.accent, letterSpacing: 0.3 },
  title: { ...type.title, fontSize: 26, marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  photo: { borderWidth: 4, borderColor: colors.card },
  line: { fontSize: 15, color: colors.ink },
  lineDay: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  footer: { fontSize: 12, color: colors.ink3, marginTop: 22 },
});
