import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleRegister = async () => {
    console.log('Попытка регистрации:', { fullName, phone });
    if (password !== confirmPassword) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }
    try {
      // POST /api/auth/register
      console.log('Регистрация успешна, перенаправление...');
      router.replace('/(tabs)/home');
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      Alert.alert('Ошибка', 'Не удалось зарегистрироваться');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Регистрация</Text>
      
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="ФИО"
          placeholderTextColor="#94A3B8"
          value={fullName}
          onChangeText={setFullName}
        />
        <TextInput
          style={styles.input}
          placeholder="+7 (___) ___-__-__"
          placeholderTextColor="#94A3B8"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="Пароль"
          placeholderTextColor="#94A3B8"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Подтверждение пароля"
          placeholderTextColor="#94A3B8"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
          <Text style={styles.registerButtonText}>Зарегистрироваться</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.linkText}>Уже есть аккаунт? Войти</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#0F172A', justifyContent: 'center', padding: 20 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#10B981', textAlign: 'center', marginBottom: 30 },
  card: { backgroundColor: 'rgba(30, 41, 59, 0.7)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  input: { backgroundColor: '#1E293B', color: '#F8FAFC', borderRadius: 8, padding: 15, marginBottom: 15, fontSize: 16 },
  registerButton: { backgroundColor: '#10B981', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 15, marginTop: 10 },
  registerButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  linkText: { color: '#94A3B8', textAlign: 'center' }
});
