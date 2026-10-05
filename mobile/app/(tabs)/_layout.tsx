import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  // Плавающий таб-бар из матового стекла, приподнятый над нижним краем
  const bottomInset = insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 10 : 8);
  const barHeight = 62;
  const sideMargin = 14;
  const liftFromBottom = bottomInset + 8;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryContainer,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: '700',
          marginBottom: 8,
        },
        tabBarItemStyle: {
          paddingTop: 8,
        },
        // Прозрачный контейнер + размытая матовая подложка под ним (frosted glass)
        tabBarBackground: () => (
          <BlurView
            intensity={isDark ? 40 : 60}
            tint={isDark ? 'dark' : 'light'}
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: 26,
              overflow: 'hidden',
              backgroundColor: isDark ? 'rgba(18,24,38,0.62)' : 'rgba(255,255,255,0.72)',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
        ),
        tabBarStyle: {
          position: 'absolute',
          left: sideMargin,
          right: sideMargin,
          bottom: liftFromBottom,
          height: barHeight,
          borderRadius: 26,
          borderTopWidth: 0,
          backgroundColor: 'transparent',
          elevation: 18,
          shadowColor: isDark ? '#000000' : '#1e3a8a',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: isDark ? 0.5 : 0.18,
          shadowRadius: 20,
          paddingHorizontal: 6,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Главная',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests/index"
        options={{
          title: 'Заявки',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'clipboard' : 'clipboard-outline'} size={23} color={color} />,
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
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'card' : 'card-outline'} size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat/index"
        options={{
          title: 'Чат',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={23} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'person' : 'person-outline'} size={23} color={color} />,
        }}
      />
    </Tabs>
  );
}
