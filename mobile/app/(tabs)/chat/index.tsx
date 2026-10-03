import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const insets = useSafeAreaInsets();

  // Официальный номер диспетчерской службы Домофондар
  const handleSupport = () => {
    Linking.openURL('tel:+79034118393');
  };

  const safeTop = Math.max(insets.top, 16) + 8;
  const safeBottom = Math.max(insets.bottom, 12) + 75;

  return (
    <View style={[styles.safeArea, { paddingTop: safeTop, paddingBottom: safeBottom }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Поддержка</Text>
      </View>
      
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Ionicons name="chatbubbles-outline" size={80} color="#10B981" />
        </View>
        <Text style={styles.heading}>Связь с диспетчерской</Text>
        <Text style={styles.description}>
          Чат с диспетчером появится в следующем релизе. Для оперативного решения любых вопросов вы можете сразу позвонить в круглосуточную службу.
        </Text>
        
        <TouchableOpacity style={styles.button} onPress={handleSupport} activeOpacity={0.85}>
          <Ionicons name="call-outline" size={20} color="#FFF" />
          <Text style={styles.buttonText}>Позвонить: +7 (903) 411-83-93</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#F8FAFC' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
  iconContainer: { marginBottom: 24, opacity: 0.85 },
  heading: { fontSize: 22, fontWeight: 'bold', color: '#F8FAFC', marginBottom: 12, textAlign: 'center' },
  description: { fontSize: 15, color: '#94A3B8', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  button: { flexDirection: 'row', backgroundColor: '#10B981', paddingVertical: 15, paddingHorizontal: 24, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold', marginLeft: 10 }
});
