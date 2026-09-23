import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/src/design/ThemeProvider';

const icons = { index: 'home-outline', transactions: 'receipt-outline', add: 'add-circle', budgets: 'pie-chart-outline', splits: 'people-outline', settings: 'settings-outline' } as const;

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.tabInactive,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 68, paddingTop: 6, paddingBottom: 8 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarIcon: ({ color, size }) => <Ionicons name={icons[route.name as keyof typeof icons] ?? 'ellipse-outline'} color={color} size={route.name === 'add' ? size + 5 : size} />,
    })}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Activity' }} />
      <Tabs.Screen name="add" options={{ title: 'Add' }} />
      <Tabs.Screen name="budgets" options={{ title: 'Budgets' }} />
      <Tabs.Screen name="splits" options={{ title: 'Splits' }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
