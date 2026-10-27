import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { InviteButton, InviteCodeEntry, UserSearch } from '../../components/FriendFinder';
import { PrimaryButton, TextButton } from '../../components/ui';
import { useOnboarding } from '../../lib/onboarding';
import { useFriends } from '../../lib/queries';
import { colors, gutter, type } from '../../theme';

export default function OnboardingFriends() {
  const insets = useSafeAreaInsets();
  const { finish } = useOnboarding();
  const friends = useFriends();
  const n = friends.data?.length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: gutter + 8, paddingTop: insets.top + 40, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={type.title}>Who do you want to swap weeks with?</Text>
        <Text style={[type.subline, { marginTop: 4, marginBottom: 28 }]}>
          A few close friends is perfect. Friendships are always mutual.
        </Text>
        <InviteButton />
        <InviteCodeEntry />
        <View style={{ height: 16 }} />
        <UserSearch />
        {n ? (
          <Text style={[type.small, { marginTop: 18 }]}>
            You have {n} {n === 1 ? 'friend' : 'friends'} on Snippets already.
          </Text>
        ) : null}
      </ScrollView>
      <View style={{ paddingHorizontal: gutter + 8, paddingBottom: insets.bottom + 16, gap: 14, alignItems: 'center' }}>
        <PrimaryButton title="Start my week" onPress={finish} style={{ alignSelf: 'stretch' }} />
        {!n ? <TextButton title="I’ll add friends later" color={colors.ink2} onPress={finish} /> : null}
      </View>
    </View>
  );
}
