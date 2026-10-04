import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { api, type ReportTarget } from './api';
import { invalidateFriends, invalidateSnippets } from './queries';

const REASONS = ['It’s inappropriate or offensive', 'It’s harassment or bullying', 'It’s spam', 'Something else'];

/** Cross-platform action sheet. */
export function chooseAction(
  title: string | undefined,
  actions: { label: string; destructive?: boolean; run: () => void }[],
) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...actions.map((a) => a.label), 'Cancel'],
        destructiveButtonIndex: actions.map((a, i) => (a.destructive ? i : -1)).filter((i) => i >= 0),
        cancelButtonIndex: actions.length,
      },
      (i) => actions[i]?.run(),
    );
  } else {
    Alert.alert(title ?? '', undefined, [
      ...actions.map((a) => ({ text: a.label, style: a.destructive ? ('destructive' as const) : ('default' as const), onPress: a.run })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }
}

export function reportContent(target: ReportTarget, what: 'moment' | 'comment' | 'person') {
  chooseAction(`Report this ${what}`, REASONS.map((reason) => ({
    label: reason,
    run: async () => {
      try {
        await api.report(target, reason);
        Alert.alert('Thanks for telling us', 'We review every report within 24 hours. You can also block this person.');
      } catch (e) {
        Alert.alert('Couldn’t send report', e instanceof Error ? e.message : String(e));
      }
    },
  })));
}

export function blockUser(userId: string, name: string, onDone?: () => void) {
  Alert.alert(
    `Block ${name}?`,
    'You’ll stop being friends, their comments will be hidden from you, and they won’t be able to add you again. They won’t be notified.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.blockUser(userId);
            await Promise.all([invalidateFriends(), invalidateSnippets()]);
            onDone?.();
          } catch (e) {
            Alert.alert('Couldn’t block', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ],
  );
}
