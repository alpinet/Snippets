import { Tabs } from 'expo-router';
import { CircleUser, History, House, Users } from 'lucide-react-native';
import { Platform, StyleSheet } from 'react-native';
import { colors, iconStroke } from '../../theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.ink2,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', marginTop: 2 },
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.hairlineStrong,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          ...(Platform.OS === 'android' ? { height: 64, paddingBottom: 8 } : null),
        },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <House color={color} size={24} strokeWidth={iconStroke} /> }}
      />
      <Tabs.Screen
        name="friends"
        options={{ title: 'Friends', tabBarIcon: ({ color }) => <Users color={color} size={24} strokeWidth={iconStroke} /> }}
      />
      <Tabs.Screen
        name="lookback"
        options={{ title: 'Lookback', tabBarIcon: ({ color }) => <History color={color} size={24} strokeWidth={iconStroke} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <CircleUser color={color} size={24} strokeWidth={iconStroke} /> }}
      />
    </Tabs>
  );
}
