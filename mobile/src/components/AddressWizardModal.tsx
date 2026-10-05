// mobile/src/components/AddressWizardModal.tsx — Мастер привязки адреса/лицевого счёта
// Как на сайте: пошаговый выбор Улица → Дом → Подъезд → Квартира (автоподсказки из базы),
// либо быстрый ввод номера лицевого счёта, либо поиск по номеру телефона.
// По завершении привязывает счёт/адрес к профилю (/api/user/bind-account).

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ActivityIndicator, FlatList, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiClient } from '@/api/client';
import { useAppTheme } from '@/theme';

type Method = 'address' | 'account' | 'phone';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: (account: any) => void;
}

const OFFICE_PHONE = '+7 (903) 411-83-93';

export function AddressWizardModal({ visible, onClose, onSuccess }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  const [method, setMethod] = useState<Method>('address');
  const [binding, setBinding] = useState(false);

  // Пошаговый адрес
  const [streetQuery, setStreetQuery] = useState('');
  const [streets, setStreets] = useState<string[]>([]);
  const [street, setStreet] = useState<string | null>(null);
  const [houses, setHouses] = useState<any[]>([]);
  const [house, setHouse] = useState<any | null>(null);
  const [entrances, setEntrances] = useState<any[]>([]);
  const [entrance, setEntrance] = useState<string | null>(null);
  const [apartments, setApartments] = useState<any[]>([]);
  const [loadingStep, setLoadingStep] = useState(false);

  // Быстрые методы
  const [accountInput, setAccountInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');

  const reset = () => {
    setStreetQuery(''); setStreets([]); setStreet(null);
    setHouses([]); setHouse(null); setEntrances([]); setEntrance(null);
    setApartments([]); setAccountInput(''); setPhoneInput('');
  };

  useEffect(() => { if (!visible) reset(); }, [visible]);

  // Автоподсказка улиц (с debounce)
  useEffect(() => {
    if (method !== 'address' || street) return;
    const q = streetQuery.trim();
    if (q.length < 1) { setStreets([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await apiClient.get('/api/lookup/streets', { params: { q } });
        if (Array.isArray(r.data)) setStreets(r.data);
      } catch { /* no-op */ }
    }, 300);
    return () => clearTimeout(t);
  }, [streetQuery, method, street]);

  const pickStreet = useCallback(async (s: string) => {
    setStreet(s); setStreets([]); setLoadingStep(true);
    try {
      const r = await apiClient.get('/api/lookup/houses', { params: { street: s } });
      setHouses(Array.isArray(r.data) ? r.data : []);
    } catch { setHouses([]); } finally { setLoadingStep(false); }
  }, []);

  const pickHouse = useCallback(async (h: any) => {
    setHouse(h); setLoadingStep(true);
    try {
      const r = await apiClient.get('/api/lookup/entrances', {
        params: { street, house: h.house, housing: h.housing || '' },
      });
      setEntrances(Array.isArray(r.data) ? r.data : []);
    } catch { setEntrances([]); } finally { setLoadingStep(false); }
  }, [street]);

  const pickEntrance = useCallback(async (e: string) => {
    setEntrance(e); setLoadingStep(true);
    try {
      const r = await apiClient.get('/api/lookup/apartments', {
        params: { street, house: house?.house, housing: house?.housing || '', entrance: e },
      });
      setApartments(Array.isArray(r.data) ? r.data : []);
    } catch { setApartments([]); } finally { setLoadingStep(false); }
  }, [street, house]);

  const bind = useCallback(async (payload: { account_number?: string; address?: string; apartment?: string }) => {
    setBinding(true);
    try {
      const r = await apiClient.post('/api/user/bind-account', payload);
      if (r.data?.ok) {
        onSuccess(r.data.account || null);
        onClose();
      } else {
        Alert.alert('Не удалось', r.data?.error || 'Проверьте данные и попробуйте снова.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Не удалось привязать адрес. Обратитесь в офис.';
      Alert.alert('Ошибка', msg);
    } finally { setBinding(false); }
  }, [onSuccess, onClose]);

  const pickApartment = useCallback((apt: any) => {
    bind({ account_number: apt.account_number, address: apt.address, apartment: apt.apartment });
  }, [bind]);

  const findByAccount = useCallback(() => {
    const digits = accountInput.replace(/\D/g, '');
    if (!digits) { Alert.alert('Внимание', 'Введите номер лицевого счёта'); return; }
    bind({ account_number: digits });
  }, [accountInput, bind]);

  const findByPhone = useCallback(async () => {
    const digits = phoneInput.replace(/\D/g, '');
    if (digits.length < 10) { Alert.alert('Внимание', 'Введите корректный номер телефона'); return; }
    setBinding(true);
    try {
      const r = await apiClient.get('/api/lookup/by-phone', { params: { phone: digits } });
      if (r.data?.account_number) {
        await bind({ account_number: r.data.account_number, address: r.data.address, apartment: r.data.apartment });
      } else {
        Alert.alert('Не найдено', `Лицевой счёт по этому номеру не найден. Обратитесь в офис: ${OFFICE_PHONE}`);
      }
    } catch {
      Alert.alert('Ошибка', 'Не удалось выполнить поиск. Попробуйте позже.');
    } finally { setBinding(false); }
  }, [phoneInput, bind]);

  const chipStyle = (active: boolean) => [
    styles.chip,
    { backgroundColor: active ? colors.primaryContainer : (isDark ? '#1c1f2a' : '#eff4ff'), borderColor: colors.border },
  ];

  const tile = (label: string, onPress: () => void, key: string, badge?: boolean) => (
    <TouchableOpacity key={key} style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.tileText, { color: colors.text }]}>{label}</Text>
      {badge ? <Ionicons name="hardware-chip-outline" size={14} color={colors.secondary} /> : null}
    </TouchableOpacity>
  );

  const inputStyle = [styles.input, { backgroundColor: isDark ? '#171b26' : '#f8f9ff', borderColor: colors.border, color: colors.text }];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 12) }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Привязка адреса</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Выбор способа */}
        <View style={styles.methodRow}>
          <TouchableOpacity style={chipStyle(method === 'address')} onPress={() => setMethod('address')}>
            <Text style={[styles.chipText, { color: method === 'address' ? '#fff' : colors.textSecondary }]}>По адресу</Text>
          </TouchableOpacity>
          <TouchableOpacity style={chipStyle(method === 'account')} onPress={() => setMethod('account')}>
            <Text style={[styles.chipText, { color: method === 'account' ? '#fff' : colors.textSecondary }]}>Лицевой счёт</Text>
          </TouchableOpacity>
          <TouchableOpacity style={chipStyle(method === 'phone')} onPress={() => setMethod('phone')}>
            <Text style={[styles.chipText, { color: method === 'phone' ? '#fff' : colors.textSecondary }]}>По телефону</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {method === 'address' && (
            <>
              {/* Шаг 1: улица */}
              <Text style={[styles.step, { color: colors.textSecondary }]}>Улица</Text>
              {street ? (
                <TouchableOpacity style={[styles.selected, { borderColor: colors.border }]} onPress={() => { setStreet(null); setHouse(null); setEntrance(null); setHouses([]); setEntrances([]); setApartments([]); }}>
                  <Text style={[styles.selectedText, { color: colors.text }]}>{street}</Text>
                  <Ionicons name="pencil" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ) : (
                <>
                  <TextInput style={inputStyle} placeholder="Начните вводить улицу…" placeholderTextColor={colors.textMuted} value={streetQuery} onChangeText={setStreetQuery} autoCorrect={false} />
                  {streets.map((s) => tile(s, () => pickStreet(s), s))}
                </>
              )}

              {/* Шаг 2: дом */}
              {street && !house && (
                <>
                  <Text style={[styles.step, { color: colors.textSecondary, marginTop: 16 }]}>Дом</Text>
                  {loadingStep ? <ActivityIndicator color={colors.primaryContainer} /> :
                    <View style={styles.grid}>{houses.map((h, i) => tile(h.label || h.house, () => pickHouse(h), `h${i}`))}</View>}
                </>
              )}

              {/* Шаг 3: подъезд */}
              {house && !entrance && (
                <>
                  <Text style={[styles.step, { color: colors.textSecondary, marginTop: 16 }]}>Подъезд</Text>
                  {loadingStep ? <ActivityIndicator color={colors.primaryContainer} /> :
                    <View style={styles.grid}>{entrances.map((e, i) => tile(`Подъезд ${e.entrance}`, () => pickEntrance(e.entrance), `e${i}`, e.has_smart_intercom))}</View>}
                </>
              )}

              {/* Шаг 4: квартира */}
              {entrance && (
                <>
                  <Text style={[styles.step, { color: colors.textSecondary, marginTop: 16 }]}>Квартира</Text>
                  {loadingStep ? <ActivityIndicator color={colors.primaryContainer} /> :
                    <View style={styles.grid}>{apartments.map((a, i) => tile(`кв. ${a.apartment}`, () => pickApartment(a), `a${i}`))}</View>}
                </>
              )}
            </>
          )}

          {method === 'account' && (
            <>
              <Text style={[styles.step, { color: colors.textSecondary }]}>Номер лицевого счёта (с квитанции)</Text>
              <TextInput style={inputStyle} placeholder="Например, 1234567890" placeholderTextColor={colors.textMuted} value={accountInput} onChangeText={setAccountInput} keyboardType="number-pad" />
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primaryContainer }]} onPress={findByAccount} disabled={binding} activeOpacity={0.85}>
                {binding ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Найти и привязать</Text>}
              </TouchableOpacity>
            </>
          )}

          {method === 'phone' && (
            <>
              <Text style={[styles.step, { color: colors.textSecondary }]}>Телефон, указанный при подключении</Text>
              <TextInput style={inputStyle} placeholder="+7 (999) 123-45-67" placeholderTextColor={colors.textMuted} value={phoneInput} onChangeText={setPhoneInput} keyboardType="phone-pad" />
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primaryContainer }]} onPress={findByPhone} disabled={binding} activeOpacity={0.85}>
                {binding ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Найти и привязать</Text>}
              </TouchableOpacity>
            </>
          )}

          <Text style={[styles.office, { color: colors.textMuted }]}>
            Не нашли свой адрес? Обратитесь в офис: {OFFICE_PHONE}
          </Text>
        </ScrollView>

        {binding && method === 'address' && (
          <View style={styles.bindingOverlay}><ActivityIndicator size="large" color={colors.primaryContainer} /></View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: '800' },
  methodRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  chip: { flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  chipText: { fontSize: 12.5, fontWeight: '700' },
  body: { padding: 16, paddingBottom: 40 },
  step: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, marginBottom: 8 },
  selected: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  selectedText: { fontSize: 15, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8 },
  tileText: { fontSize: 14, fontWeight: '600' },
  primaryBtn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  office: { fontSize: 12.5, textAlign: 'center', marginTop: 24, lineHeight: 18 },
  bindingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
});
