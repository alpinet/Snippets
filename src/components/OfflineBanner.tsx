import { WifiOff } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnline } from '../lib/useOnline';
import { colors, iconStroke } from '../theme';

/** A quiet strip at the top of the app while offline. */
export function OfflineBanner() {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 4 }]} accessibilityLiveRegion="polite">
      <View style={styles.pill}>
        <WifiOff size={14} color={colors.ink2} strokeWidth={iconStroke} />
        <Text style={styles.text}>You’re offline — saving and sharing will wait until you’re back</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
    shadowColor: '#5A4030',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    marginHorizontal: 16,
  },
  text: { fontSize: 12, color: colors.ink2, flexShrink: 1 },
});
