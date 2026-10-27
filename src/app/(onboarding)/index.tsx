import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileForm } from '../../components/ProfileForm';
import { Loading } from '../../components/ui';
import { useMe } from '../../lib/queries';
import { colors, gutter, type } from '../../theme';

export default function OnboardingProfile() {
  const insets = useSafeAreaInsets();
  const me = useMe();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: gutter + 8, paddingTop: insets.top + 40, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={type.title}>What should friends call you?</Text>
        <Text style={[type.subline, { marginTop: 4, marginBottom: 28 }]}>Only people you add will see this.</Text>
        {me.data ? (
          <ProfileForm initial={me.data} submitLabel="Continue" onDone={() => router.push('/add-friends')} />
        ) : (
          <Loading />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
