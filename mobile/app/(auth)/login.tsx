import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
// import { useForm, Controller } from 'react-hook-form';
// import { zodResolver } from '@hookform/resolvers/zod';
// import * as z from 'zod';

export default function LoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    console.log('Попытка входа с телефоном:', phone);
    try {
      // POST /api/auth/login
      console.log('Успешный вход, перенаправление...');
      router.replace('/(tabs)/home');
    } catch (error) {
      console.error('Ошибка входа:', error);
      Alert.alert('Ошибка', 'Неверный телефон или пароль');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Домофондар</Text>
      
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="+7 (___) ___-__-__"
          placeholderTextColor="#94A3B8"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        
        <View style={styles.passwordContainer}>
          <TextInput
            style={styles.passwordInput}
            placeholder="Пароль"
            placeholderTextColor="#94A3B8"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Text style={styles.showHide}>{showPassword ? 'Скрыть' : 'Показать'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Войти</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
          <Text style={styles.linkText}>Нет аккаунта? Зарегистрируйтесь</Text>
        </TouchableOpacity>

        <View style={styles.dividerContainer}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>или</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Войти по лицевому счёту</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Войти по биометрии</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', padding: 20 },
  title: { fontSize: 36, fontWeight: 'bold', color: '#10B981', textAlign: 'center', marginBottom: 40 },
  card: { backgroundColor: 'rgba(30, 41, 59, 0.7)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  input: { backgroundColor: '#1E293B', color: '#F8FAFC', borderRadius: 8, padding: 15, marginBottom: 15, fontSize: 16 },
  passwordContainer: { flexDirection: 'row', backgroundColor: '#1E293B', borderRadius: 8, marginBottom: 20, alignItems: 'center', paddingRight: 15 },
  passwordInput: { flex: 1, color: '#F8FAFC', padding: 15, fontSize: 16 },
  showHide: { color: '#10B981', fontSize: 14 },
  loginButton: { backgroundColor: '#10B981', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 15 },
  loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  linkText: { color: '#94A3B8', textAlign: 'center', marginBottom: 20 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  divider: { flex: 1, height: 1, backgroundColor: '#334155' },
  dividerText: { color: '#94A3B8', paddingHorizontal: 10 },
  secondaryButton: { backgroundColor: '#1E293B', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  secondaryButtonText: { color: '#F8FAFC', fontSize: 14 }
});
