import { router } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { BackBar } from '../../components/BackBar';
import { ProfileForm } from '../../components/ProfileForm';
import { Loading } from '../../components/ui';
import { useMe } from '../../lib/queries';
import { colors, gutter } from '../../theme';

export default function EditProfile() {
  const me = useMe();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BackBar modal title="Edit profile" />
      <ScrollView contentContainerStyle={{ padding: gutter, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {me.data ? <ProfileForm initial={me.data} submitLabel="Save" onDone={() => router.back()} /> : <Loading />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
