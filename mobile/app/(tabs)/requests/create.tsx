import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, SafeAreaView, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function CreateRequestScreen() {
  const router = useRouter();
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('ул. Пушкина, д. Колотушкина, кв. 10');

  const handleSubmit = () => {
    if (!description) {
      Alert.alert('Ошибка', 'Опишите проблему');
      return;
    }
    console.log('Отправка заявки:', { type, description, address });
    Alert.alert('Успешно', 'Заявка создана', [{ text: 'OK', onPress: () => router.back() }]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.title}>Новая заявка</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.label}>Адрес</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholderTextColor="#94A3B8" />

        <Text style={styles.label}>Описание проблемы</Text>
        <TextInput 
          style={[styles.input, styles.multiline]} 
          value={description} 
          onChangeText={setDescription} 
          placeholder="Подробно опишите неисправность..." 
          placeholderTextColor="#94A3B8"
          multiline 
          numberOfLines={4} 
        />

        <TouchableOpacity style={styles.photoButton}>
          <Ionicons name="camera-outline" size={24} color="#10B981" />
          <Text style={styles.photoButtonText}>Прикрепить фото</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Отправить заявку</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  backButton: { padding: 5 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#F8FAFC' },
  container: { padding: 20 },
  label: { color: '#94A3B8', marginBottom: 8, fontSize: 14 },
  input: { backgroundColor: '#1E293B', color: '#F8FAFC', borderRadius: 8, padding: 15, marginBottom: 20, fontSize: 16 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  photoButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: 15, borderRadius: 8, marginBottom: 30, borderWidth: 1, borderColor: '#10B981', borderStyle: 'dashed' },
  photoButtonText: { color: '#10B981', marginLeft: 10, fontSize: 16, fontWeight: '500' },
  submitButton: { backgroundColor: '#10B981', padding: 15, borderRadius: 8, alignItems: 'center' },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }
});
