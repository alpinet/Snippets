import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ChevronRight } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Avatar, Card, Hairline, Screen, ScreenHeader, SectionLabel, TextButton } from '../../components/ui';
import { api, demoApi, type Settings } from '../../lib/api';
import { links } from '../../lib/config';
import { exportArchive } from '../../lib/exportArchive';
import { shareInvite } from '../../lib/invite';
import { keys, queryClient, useFriends, useMe, useSettings } from '../../lib/queries';
import { addDays, currentWeekStart, isSunday, parseISODate, setClockOffset } from '../../lib/week';
import { colors, iconStroke, type } from '../../theme';

export default function Profile() {
  const me = useMe();
  const friends = useFriends();
  const settings = useSettings();

  const update = useMutation({
    mutationFn: (s: Partial<Settings>) => api.updateSettings(s),
    onMutate: (s) => queryClient.setQueryData<Settings>(keys.settings, (prev) => (prev ? { ...prev, ...s } : prev)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.settings }),
  });

  const del = useMutation({ mutationFn: () => api.deleteAccount() });

  const [exporting, setExporting] = useState(false);
  const onExport = async () => {
    if (exporting || !me.data) return;
    setExporting(true);
    try {
      await exportArchive(me.data, await api.myArchive());
    } catch (e) {
      Alert.alert('Couldn’t export', e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const onInvite = () => {
    const code = settings.data?.inviteCode;
    if (!code) return;
    shareInvite(code);
  };

  const confirmDelete = () =>
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your profile, every snippet, photo and video, and your friendships. It can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', 'Your archive will be gone for good.', [
              { text: 'Keep my account', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => del.mutate() },
            ]),
        },
      ],
    );

  const p = me.data;
  const s = settings.data;

  return (
    <Screen>
      <ScreenHeader title="Profile" subline={p?.username ? `@${p.username}` : undefined} />

      <Card style={styles.profileCard} onPress={() => router.push('/settings/profile')}>
        <Avatar name={p?.displayName ?? ''} url={p?.avatarUrl} size={60} />
        <View style={{ flex: 1 }}>
          <Text style={[type.prompt, { fontSize: 19 }]}>{p?.displayName}</Text>
          <Text style={type.small}>Edit name, username and photo</Text>
        </View>
        <ChevronRight size={20} color={colors.ink3} strokeWidth={iconStroke} />
      </Card>

      <SectionLabel style={styles.section}>Friends</SectionLabel>
      <Card style={styles.group}>
        <Item label="Your friends" value={friends.data ? String(friends.data.length) : undefined} onPress={() => router.push('/friends/manage')} />
        <Hairline style={styles.sep} />
        <Item label="Invite a friend" onPress={onInvite} />
      </Card>

      <SectionLabel style={styles.section}>Your archive</SectionLabel>
      <Card style={styles.group}>
        <Item label={exporting ? 'Making your scrapbook…' : 'Export as a PDF scrapbook'} onPress={onExport} />
      </Card>

      <SectionLabel style={styles.section}>Notifications</SectionLabel>
      <Card style={styles.group}>
        <Toggle
          label="Sunday reminder"
          hint="One gentle note on Sunday evening if you haven’t shared."
          value={s?.notifySunday}
          onChange={(v) => update.mutate({ notifySunday: v })}
        />
        <Hairline style={styles.sep} />
        <Toggle label="Nudges from friends" value={s?.notifyNudges} onChange={(v) => update.mutate({ notifyNudges: v })} />
        <Hairline style={styles.sep} />
        <Toggle
          label="Replies to your moments"
          value={s?.notifyReplies}
          onChange={(v) => update.mutate({ notifyReplies: v })}
        />
        <Hairline style={styles.sep} />
        <Toggle
          label="When friends share"
          value={s?.notifyFriendPosted}
          onChange={(v) => update.mutate({ notifyFriendPosted: v })}
        />
      </Card>

      <SectionLabel style={styles.section}>Privacy</SectionLabel>
      <Card style={[styles.group, { paddingVertical: 14 }]}>
        <Text style={type.secondary}>
          Only friends you approve can see your snippets. No public profiles, no followers, no ads, no algorithms.
          Friends see your week only after they share theirs.
        </Text>
      </Card>
      <Card style={[styles.group, { marginTop: 10 }]}>
        <Item label="Privacy policy" onPress={() => WebBrowser.openBrowserAsync(links.privacy)} />
        <Hairline style={styles.sep} />
        <Item label="Terms of use" onPress={() => WebBrowser.openBrowserAsync(links.terms)} />
        <Hairline style={styles.sep} />
        <Item label="Contact support" onPress={() => WebBrowser.openBrowserAsync(links.support)} />
      </Card>

      {demoApi ? <DemoTools /> : null}

      <View style={styles.footer}>
        <TextButton title="Sign out" color={colors.ink} onPress={() => api.signOut()} />
        <TextButton title={del.isPending ? 'Deleting…' : 'Delete account'} color={colors.danger} onPress={confirmDelete} disabled={del.isPending} />
        <Text style={[type.small, { color: colors.ink3 }]}>A few moments from your week.</Text>
      </View>
    </Screen>
  );
}

function Item({ label, value, onPress }: { label: string; value?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && { opacity: 0.6 }]}>
      <Text style={[type.body, { flex: 1, fontSize: 16 }]}>{label}</Text>
      {value ? <Text style={type.secondary}>{value}</Text> : null}
      <ChevronRight size={18} color={colors.ink3} strokeWidth={iconStroke} />
    </Pressable>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value?: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.item}>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { fontSize: 16 }]}>{label}</Text>
        {hint ? <Text style={[type.small, { marginTop: 2 }]}>{hint}</Text> : null}
      </View>
      <Switch
        value={!!value}
        onValueChange={onChange}
        trackColor={{ true: colors.accent, false: colors.fill }}
        ios_backgroundColor={colors.fill}
      />
    </View>
  );
}

function DemoTools(): ReactNode {
  const [sunday, setSunday] = useState(isSunday());
  const togglePretendSunday = (v: boolean) => {
    if (v) {
      const sundayNoon = parseISODate(addDays(currentWeekStart(), 6));
      sundayNoon.setHours(12);
      setClockOffset(Math.max(0, sundayNoon.getTime() - Date.now()));
    } else {
      setClockOffset(0);
    }
    setSunday(isSunday());
    queryClient.invalidateQueries();
  };
  return (
    <>
      <SectionLabel style={styles.section}>Demo mode</SectionLabel>
      <Card style={styles.group}>
        <Text style={[type.small, { paddingTop: 12 }]}>
          No backend is configured, so the app is running on local sample data. Set EXPO_PUBLIC_SUPABASE_URL to go live.
        </Text>
        <Toggle label="Pretend it’s Sunday" value={sunday} onChange={togglePretendSunday} />
        <Hairline style={styles.sep} />
        <Item
          label="Reset sample data"
          onPress={async () => {
            setClockOffset(0);
            setSunday(isSunday());
            await demoApi!.reset();
            queryClient.invalidateQueries();
          }}
        />
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  section: { marginTop: 26 },
  group: { paddingHorizontal: 16 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 8 },
  sep: { marginLeft: 0 },
  footer: { alignItems: 'center', gap: 22, marginTop: 34 },
});
