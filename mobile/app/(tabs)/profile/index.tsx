import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Выход', 'Вы уверены, что хотите выйти?', [
      { text: 'Отмена', style: 'cancel' },
      { 
        text: 'Выйти', 
        style: 'destructive',
        onPress: () => {
          console.log('Очистка данных и выход...');
          router.replace('/(auth)/login');
        }
      }
    ]);
  };

  const MenuItem = ({ icon, title, value = '', isDestructive = false }: any) => (
    <TouchableOpacity style={styles.menuItem}>
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon} size={22} color={isDestructive ? '#EF4444' : '#94A3B8'} />
        <Text style={[styles.menuItemTitle, isDestructive && { color: '#EF4444' }]}>{title}</Text>
      </View>
      <View style={styles.menuItemRight}>
        {value ? <Text style={styles.menuItemValue}>{value}</Text> : null}
        <Ionicons name="chevron-forward" size={20} color="#334155" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Профиль</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>ИИ</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>Иван Иванов</Text>
            <Text style={styles.phone}>+7 (999) 123-45-67</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Настройки</Text>
          <View style={styles.card}>
            <MenuItem icon="person-outline" title="Мои данные" />
            <View style={styles.divider} />
            <MenuItem icon="document-text-outline" title="Лицевой счёт" value="123456789" />
            <View style={styles.divider} />
            <MenuItem icon="notifications-outline" title="Уведомления" value="Вкл" />
            <View style={styles.divider} />
            <MenuItem icon="shield-checkmark-outline" title="Безопасность" />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Приложение</Text>
          <View style={styles.card}>
            <MenuItem icon="color-palette-outline" title="Тема оформления" value="Тёмная" />
            <View style={styles.divider} />
            <MenuItem icon="language-outline" title="Язык" value="Русский" />
            <View style={styles.divider} />
            <MenuItem icon="information-circle-outline" title="О приложении" value="v1.0.0" />
          </View>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          <Text style={styles.logoutButtonText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
        
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  header: { padding: 20, paddingTop: 10 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#F8FAFC' },
  container: { padding: 20 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  avatar: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', marginRight: 20 },
  avatarText: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  profileInfo: { flex: 1 },
  name: { fontSize: 20, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 5 },
  phone: { fontSize: 16, color: '#94A3B8' },
  section: { marginBottom: 25 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#94A3B8', marginBottom: 10, paddingLeft: 5 },
  card: { backgroundColor: 'rgba(30, 41, 59, 0.6)', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center' },
  menuItemTitle: { fontSize: 16, color: '#F8FAFC', marginLeft: 15 },
  menuItemRight: { flexDirection: 'row', alignItems: 'center' },
  menuItemValue: { fontSize: 14, color: '#94A3B8', marginRight: 10 },
  divider: { height: 1, backgroundColor: '#1E293B', marginLeft: 52 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 15, borderRadius: 12, marginTop: 10, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  logoutButtonText: { fontSize: 16, fontWeight: 'bold', color: '#EF4444', marginLeft: 10 }
});
