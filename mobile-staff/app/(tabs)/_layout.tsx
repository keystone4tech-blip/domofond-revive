/**
 * Навигационный макет нижнего таб-бара (Tabs Layout)
 * Приложение «Офис Работа»
 *
 * Вкладки показываются по правам сотрудника (единая модель с сайтом, таблица crm_roles).
 * В режиме предпросмотра роли (супер-админ) учитываются права выбранной роли.
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useStaffAuthStore, computeEffectivePermissions } from '../../src/store/auth.store';

export default function TabsLayout() {
  const permissions = useStaffAuthStore((s) => s.permissions);
  const previewRole = useStaffAuthStore((s) => s.previewRole);
  const allRoles = useStaffAuthStore((s) => s.allRoles);
  const allTabIds = useStaffAuthStore((s) => s.allTabIds);

  const eff = computeEffectivePermissions(permissions, previewRole, allRoles, allTabIds);
  const can = (id: string) => eff.includes(id);

  // Доступность вкладок приложения (переиспользуем id разделов сайта)
  const canTasks = can('tasks');
  const canActs = can('installer-sheet') || can('tasks');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F172A',
          borderTopColor: '#1E293B',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 65,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#38BDF8',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      {/* 1. Адаптивный рабочий стол под роль — виден всегда */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'grid' : 'grid-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* 2. Наряды и заявки — право "tasks" */}
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Наряды',
          href: canTasks ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'clipboard' : 'clipboard-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* 3. Электронные акты выполненных работ — право "installer-sheet" (или "tasks") */}
      <Tabs.Screen
        name="acts"
        options={{
          title: 'Акты',
          href: canActs ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'document-text' : 'document-text-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* 4. Оповещения — видно всем */}
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Оповещения',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* 5. Профиль сотрудника и переключение роли — видно всем */}
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
