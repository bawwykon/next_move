import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { colors, spacing } from '@/lib/theme';

export default function TabsLayout() {
  // I18N-01 — tab titles are the phase-1 proof set; Arabic uses the
  // companion display font until the full typography swap (Arabic phase).
  const { t, i18n } = useTranslation();
  const labelFont = i18n.language === 'ar' ? 'Almarai-Bold' : 'Nunito-Bold';
  return (
    <Tabs
      initialRouteName="quest-board"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.reward,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.surfaceElevated,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: spacing.sm,
          paddingTop: spacing.xs,
        },
        tabBarLabelStyle: {
          fontFamily: labelFont,
          fontSize: 12,
        },
      }}
    >
      <Tabs.Screen
        name="quest-board"
        options={{
          title: t('tabs.questBoard'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'compass' : 'compass-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="journey"
        options={{
          title: t('tabs.journey'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
