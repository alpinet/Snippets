import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, gutter, radius, type } from '../theme';
import { PrimaryButton, TextButton } from './ui';

/** Sunday's close: a summary, one optional private line, then keep. */
export function KeepWeekSheet({ visible, count, sharedCount, loading, onKeep, onClose }: {
  visible: boolean; count: number; sharedCount: number; loading: boolean;
  onKeep: (line: string) => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [line, setLine] = useState('');

  const summary = [
    `${count === 1 ? 'Your moment goes' : `Your ${count} moments go`} into your Lookback.`,
    sharedCount === 0
      ? 'All of it is just for you.'
      : `${sharedCount === count ? (count === 1 ? 'It’s' : 'All are') : `${sharedCount} of ${count} are`} shared with friends.`,
    'Then you can see what your friends shared.',
  ].join(' ');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Not yet" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.grabber} />
          <Text style={type.prompt}>Keep your week?</Text>
          <Text style={[type.secondary, { marginTop: 6 }]}>{summary}</Text>

          <Text style={[type.label, { marginTop: 22, marginBottom: 8 }]}>
            What will you remember about this week? <Text style={{ color: colors.ink3, fontWeight: '400' }}>Optional</Text>
          </Text>
          <TextInput
            value={line}
            onChangeText={setLine}
            placeholder="One line, just for you."
            placeholderTextColor={colors.ink3}
            style={[styles.input, type.reflection]}
            maxLength={140}
            returnKeyType="done"
            onSubmitEditing={() => onKeep(line)}
          />
          <Text style={[type.small, { marginTop: 6, color: colors.ink3 }]}>Only you will see this, on your Lookback.</Text>

          <PrimaryButton title="Keep my week" onPress={() => onKeep(line)} loading={loading} style={{ marginTop: 22 }} />
          <View style={{ alignItems: 'center', marginTop: 14 }}>
            <TextButton title="Not yet" color={colors.ink2} onPress={onClose} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(46, 41, 38, 0.28)' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg + 4,
    borderTopRightRadius: radius.lg + 4,
    paddingHorizontal: gutter,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.hairlineStrong,
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md - 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
