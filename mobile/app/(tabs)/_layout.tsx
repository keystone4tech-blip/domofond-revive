import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : '#0F172A',
          position: 'absolute',
          borderTopWidth: 0,
          elevation: 0,
          opacity: 0.95,
          height: 60,
          paddingBottom: 10,
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
