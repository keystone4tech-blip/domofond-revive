// mobile/app/index.tsx — Стартовый шлюз приложения «Домофондар»
// Отображает фирменный загрузчик пока RootLayout проверяет сессию

import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.logoText}>Домофондар</Text>
      <Text style={styles.subText}>Сервис умного доступа</Text>
      <ActivityIndicator size="large" color="#10B981" style={styles.loader} />
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
    fontSize: 34,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  subText: {
    color: '#94A3B8',
    fontSize: 15,
    marginTop: 8,
  },
  loader: {
    marginTop: 28,
  },
});
