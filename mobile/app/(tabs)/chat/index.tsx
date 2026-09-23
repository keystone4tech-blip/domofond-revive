import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ChatScreen() {
  const handleSupport = () => {
    Linking.openURL('tel:+79991234567');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Чаты</Text>
      </View>
      
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Ionicons name="chatbubbles-outline" size={80} color="#10B981" />
        </View>
        <Text style={styles.heading}>Скоро здесь будет чат!</Text>
        <Text style={styles.description}>
          Мы усердно работаем над функцией онлайн-чата с диспетчером. Она появится в одном из следующих обновлений.
        </Text>
        
        <TouchableOpacity style={styles.button} onPress={handleSupport}>
          <Ionicons name="call-outline" size={20} color="#FFF" />
          <Text style={styles.buttonText}>Позвонить в поддержку</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  header: { padding: 20, paddingTop: 10 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#F8FAFC' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  iconContainer: { marginBottom: 30, opacity: 0.8 },
  heading: { fontSize: 22, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 15, textAlign: 'center' },
  description: { fontSize: 15, color: '#94A3B8', textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  button: { flexDirection: 'row', backgroundColor: '#10B981', paddingVertical: 15, paddingHorizontal: 25, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginLeft: 10 }
});
