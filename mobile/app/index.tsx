import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Проверка токена в SecureStore...');
        // const token = await SecureStore.getItemAsync('jwt_token');
        const token = null; // Эмуляция

        if (token) {
          console.log('Токен найден. Переход на главную.');
          router.replace('/(tabs)/home');
        } else {
          console.log('Токен не найден. Переход на экран входа.');
          router.replace('/(auth)/login');
        }
      } catch (error) {
        console.error('Ошибка при проверке авторизации:', error);
        router.replace('/(auth)/login');
      }
    };

    checkAuth();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.logoText}>Домофондар</Text>
      <ActivityIndicator size="large" color="#10B981" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  logoText: {
    color: '#10B981',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
  }
});
