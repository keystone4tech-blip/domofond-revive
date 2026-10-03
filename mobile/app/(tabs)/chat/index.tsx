// mobile/app/(tabs)/chat/index.tsx — Экран поддержки и связи с диспетчерской в стиле Domofondar CyberShield

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  // Официальный номер диспетчерской службы Домофондар
  const handleSupport = () => {
    const phone = '+79034118393';
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert('Диспетчерская', 'Номер телефона: +7 (903) 411-83-93');
    });
  };

  const safeTop = Math.max(insets.top, 16) + 8;
  const safeBottom = Math.max(insets.bottom, 12) + 75;

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: safeTop, paddingBottom: safeBottom }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Поддержка</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Круглосуточная диспетчерская служба «Домофондар»
        </Text>
      </View>

      <View style={styles.container}>
        <View style={[styles.iconContainer, { backgroundColor: isDark ? '#1c1f2a' : '#eff4ff', borderColor: colors.border }]}>
          <Ionicons name="headset" size={48} color={colors.primaryContainer} />
        </View>

        <Text style={[styles.heading, { color: colors.text }]}>Прямая связь с оператором</Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Если у вас возник экстренный вопрос, пропало питание подъезда или требуется консультация по начислениям, дежурный диспетчер ответит вам прямо сейчас.
        </Text>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primaryContainer }]}
          onPress={handleSupport}
          activeOpacity={0.85}
        >
          <Ionicons name="call" size={20} color="#FFFFFF" style={{ marginRight: 10 }} />
          <Text style={styles.buttonText}>Позвонить: +7 (903) 411-83-93</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { paddingHorizontal: 20, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 2 },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  description: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  button: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
