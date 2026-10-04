import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gutter, iconStroke, type } from '../theme';

/** Quiet top bar for pushed screens. */
export function BackBar({ title, right }: { title?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={12}
        accessibilityLabel="Back"
        style={styles.side}
      >
        <ChevronLeft size={26} color={colors.ink} strokeWidth={iconStroke} />
      </Pressable>
      <Text style={[type.cardTitle, { fontSize: 16 }]} numberOfLines={1}>{title}</Text>
      <View style={[styles.side, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter - 6,
    paddingBottom: 8,
    backgroundColor: colors.bg,
  },
  side: { minWidth: 60 },
});
