import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { LookbackNote } from '../lib/api';
import { noteAge } from '../lib/lookback';
import { useAddLookbackNote, useDeleteLookbackNote } from '../lib/queries';
import { chooseAction } from '../lib/safety';
import { formatLongDate, type ISODate } from '../lib/week';
import { colors, radius, type } from '../theme';
import { TextButton } from './ui';

/** Reflection on top of reflection: dated notes you add to a past moment. Only ever yours. */
export function LookbackNotes({ snippetId, happenedOn, notes, canAdd, autoFocus }: {
  snippetId: string; happenedOn: ISODate; notes: LookbackNote[]; canAdd: boolean; autoFocus?: boolean;
}) {
  const add = useAddLookbackNote();
  const del = useDeleteLookbackNote();
  const [text, setText] = useState('');
  const [open, setOpen] = useState(!!autoFocus);

  if (!notes.length && !canAdd) return null;
  const save = () =>
    add.mutate({ snippetId, body: text }, {
      onSuccess: () => {
        setText('');
        setOpen(false);
      },
    });

  return (
    <View style={{ marginTop: 26 }}>
      <Text style={type.label}>Looking back</Text>
      {notes.map((n) => (
        <View key={n.id} style={styles.note}>
          <Text
            style={[type.reflection, { fontSize: 16, lineHeight: 23 }]}
            onLongPress={() => chooseAction(undefined, [{ label: 'Delete note', destructive: true, run: () => del.mutate(n.id) }])}
          >
            {n.body}
          </Text>
          <Text style={[type.small, { marginTop: 4, color: colors.ink3 }]}>
            {formatLongDate(n.writtenOn)} · {noteAge(happenedOn, n.writtenOn)}
          </Text>
        </View>
      ))}
      {canAdd && !open ? (
        <View style={{ alignItems: 'flex-start', marginTop: 10 }}>
          <TextButton title="Add a note from today" onPress={() => setOpen(true)} />
        </View>
      ) : null}
      {canAdd && open ? (
        <View style={{ marginTop: 10 }}>
          <Text style={[type.secondary, { marginBottom: 8 }]}>Looking back, what do you notice?</Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Only you will see this."
            placeholderTextColor={colors.ink3}
            style={[styles.input, type.reflection]}
            multiline
            maxLength={1000}
            textAlignVertical="top"
            autoFocus
          />
          <View style={styles.actions}>
            <TextButton title="Cancel" color={colors.ink2} onPress={() => setOpen(false)} />
            <TextButton title={add.isPending ? 'Saving…' : 'Save note'} onPress={save} disabled={!text.trim() || add.isPending} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    marginTop: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.accentSoft,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radius.md - 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 90,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20, marginTop: 10 },
});
