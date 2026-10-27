import { Image } from 'expo-image';
import type { ReactNode, Ref } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
  type PressableProps, type ScrollViewProps, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cardStyle, colors, gutter, radius, type } from '../theme';

export function Screen({
  children, scroll = true, contentStyle, ref, ...rest
}: {
  children: ReactNode; scroll?: boolean; contentStyle?: StyleProp<ViewStyle>; ref?: Ref<ScrollView>;
} & ScrollViewProps) {
  const insets = useSafeAreaInsets();
  if (!scroll) {
    return <View style={[styles.screen, { paddingTop: insets.top }, contentStyle]}>{children}</View>;
  }
  return (
    <ScrollView
      ref={ref}
      style={styles.screen}
      contentContainerStyle={[{ paddingTop: insets.top + 12, paddingBottom: 40, paddingHorizontal: gutter }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

/** Left-aligned ~28pt medium title with a small warm-gray subline. Invites, never announces. */
export function ScreenHeader({ title, subline, right, large }: {
  title: string; subline?: string; right?: ReactNode; large?: boolean;
}) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={[type.title, large && styles.largeTitle]} accessibilityRole="header">{title}</Text>
        {subline ? <Text style={[type.subline, { marginTop: 2 }]}>{subline}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress, dashed }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; dashed?: boolean;
}) {
  const base = [dashed ? styles.dashed : cardStyle, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

export function PrimaryButton({ title, onPress, disabled, loading, style }: {
  title: string; onPress?: () => void; disabled?: boolean; loading?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primary,
        (disabled || loading) && { opacity: 0.45 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.accentInk} /> : <Text style={styles.primaryText}>{title}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, icon, style, disabled }: {
  title: string; onPress?: () => void; icon?: ReactNode; style?: StyleProp<ViewStyle>; disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }, disabled && { opacity: 0.45 }, style]}
    >
      {icon}
      <Text style={styles.secondaryText}>{title}</Text>
    </Pressable>
  );
}

/** Small quiet text action (e.g. Nudge). */
export function TextButton({ title, onPress, color = colors.accent, disabled, style, hitSlop = 10 }: {
  title: string; onPress?: () => void; color?: string; disabled?: boolean;
  style?: StyleProp<TextStyle>; hitSlop?: PressableProps['hitSlop'];
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} hitSlop={hitSlop}>
      {({ pressed }) => (
        <Text style={[styles.textButton, { color: disabled ? colors.ink3 : color }, pressed && { opacity: 0.6 }, style]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const AVATAR_TINTS = ['#EBD9CC', '#E3DDD0', '#DCE2D6', '#E6D5D2', '#DDD8E2', '#D8E0E0'];

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const tint = AVATAR_TINTS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TINTS.length];
  const style = { width: size, height: size, borderRadius: size / 2 };
  if (url) return <Image source={{ uri: url }} style={[style, styles.avatarBorder]} contentFit="cover" transition={150} />;
  return (
    <View style={[style, styles.avatarBorder, { backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: colors.ink, fontSize: size * 0.4, fontWeight: '500' }}>
        {(name.trim()[0] ?? '?').toUpperCase()}
      </Text>
    </View>
  );
}

export function Badge({ label, icon, variant = 'filled', onPress }: {
  label: string; icon?: ReactNode; variant?: 'filled' | 'outline'; onPress?: () => void;
}) {
  const filled = variant === 'filled';
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.badge,
        filled ? { backgroundColor: colors.accent } : { borderWidth: 1, borderColor: colors.accent },
        pressed && { opacity: 0.7 },
      ]}
    >
      {icon}
      <Text style={[styles.badgeText, { color: filled ? colors.accentInk : colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={[type.prompt, { textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.secondary, { textAlign: 'center', marginTop: 6 }]}>{body}</Text> : null}
      {action ? <View style={{ marginTop: 18 }}>{action}</View> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ paddingVertical: 60, alignItems: 'center' }}>
      <ActivityIndicator color={colors.ink3} />
    </View>
  );
}

export function ErrorNote({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <EmptyState
      title="Couldn’t load this right now"
      body={error instanceof Error ? error.message : undefined}
      action={onRetry ? <TextButton title="Try again" onPress={onRetry} /> : undefined}
    />
  );
}

export function SectionLabel({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[type.label, { marginBottom: 8 }, style]}>{children}</Text>;
}

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong }, style]} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 16, marginBottom: 20 },
  largeTitle: { fontSize: 38, letterSpacing: -0.6 },
  dashed: {
    borderRadius: radius.lg,
    borderWidth: 1.25,
    borderStyle: 'dashed',
    borderColor: 'rgba(191, 101, 71, 0.45)',
    backgroundColor: 'transparent',
  },
  primary: {
    height: 54,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  primaryText: { color: colors.accentInk, fontSize: 17, fontWeight: '500', letterSpacing: -0.1 },
  secondary: {
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
  },
  secondaryText: { color: colors.ink, fontSize: 16, fontWeight: '500' },
  textButton: { fontSize: 15, fontWeight: '500' },
  avatarBorder: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: { fontSize: 14, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 },
});
