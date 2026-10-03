import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  // Вычисляем реальный отступ снизу под полоску жестов смартфона
  const bottomPadding = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 10 : 8);
  const barHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 4,
        },
        tabBarStyle: {
          backgroundColor: '#0F172A',
          position: 'absolute',
          borderTopWidth: 1,
          borderTopColor: 'rgba(148, 163, 184, 0.12)',
          elevation: 8,
          height: barHeight,
          paddingTop: 6,
          paddingBottom: bottomPadding,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Главная',
          tabBarIcon: ({ color }) => <Ionicons name="home-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests/index"
        options={{
          title: 'Заявки',
          tabBarIcon: ({ color }) => <Ionicons name="clipboard-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests/create"
        options={{ href: null }} // Скрываем из табов
      />
      <Tabs.Screen
        name="payments/index"
        options={{
          title: 'Платежи',
          tabBarIcon: ({ color }) => <Ionicons name="card-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat/index"
        options={{
          title: 'Чат',
          tabBarIcon: ({ color }) => <Ionicons name="chatbubbles-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
