import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  // Закреплённый внизу компактный таб-бар с матовым стеклом (не плавающий,
  // чтобы кнопки на экранах не оказывались под ним).
  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 8 : 6);
  const barHeight = 52 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryContainer,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginBottom: 2,
        },
        tabBarItemStyle: {
          paddingTop: 5,
        },
        // Матовое стекло на всю ширину бара
        tabBarBackground: () => (
          <BlurView
            intensity={isDark ? 40 : 55}
            tint={isDark ? 'dark' : 'light'}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: isDark ? 'rgba(18,24,38,0.80)' : 'rgba(255,255,255,0.86)',
              borderTopWidth: 1,
              borderTopColor: colors.border,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              overflow: 'hidden',
            }}
          />
        ),
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: barHeight,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 12,
          shadowColor: isDark ? '#000000' : '#1e3a8a',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.4 : 0.1,
          shadowRadius: 12,
          paddingBottom: bottomInset,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Главная',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests/index"
        options={{
          title: 'Заявки',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'clipboard' : 'clipboard-outline'} size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests/create"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="payments/index"
        options={{
          title: 'Платежи',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'card' : 'card-outline'} size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat/index"
        options={{
          title: 'Чат',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={21} color={color} />,
        }}
      />
    </Tabs>
  );
}
