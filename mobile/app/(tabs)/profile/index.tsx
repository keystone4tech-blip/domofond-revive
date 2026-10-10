// mobile/app/(tabs)/profile/index.tsx — Профиль / личный кабинет жильца «Домофондар»
// Мои данные (+индикатор незаполненных), email, верификация (загрузка документа),
// разрешения (уведомления/фото/гео), «О нас» (документы), «Как проехать» (2ГИС/Яндекс),
// изменение данных через модерацию, темы. Полная поддержка тем.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '@/store/auth.store';
import { useAppTheme } from '@/theme';
import { apiClient } from '@/api/client';
import { APP_VERSION, APP_DOWNLOAD_URL } from '@/config/constants';
import { ALL_LEGAL_DOCUMENTS } from '@/data/legalDocuments';
import type { ThemeMode } from '@/store/theme.store';
import { PermissionsCenterModal } from '@/components/PermissionsCenterModal';
import { initializeUserNotificationChannel } from '@/services/permissionsService';

// expo-location подключаем безопасно: если модуль ещё не установлен, приложение не падает.
let Location: any = null;
try { Location = require('expo-location'); } catch { Location = null; }

// Контакты офиса (как на сайте домофондар.рф)
const OFFICE_ADDRESS = 'г. Краснодар, проезд Репина, 1, 2 этаж, офис 134';
const OFFICE_PHONE = '+79034118393';
const OFFICE_EMAIL = 'domofondar@mail.ru';
const MAP_YANDEX = 'https://yandex.ru/maps/-/CLhNYJYt';
const MAP_2GIS = 'https://go.2gis.com/Morvu';
const WHATSAPP_URL = 'https://wa.me/79034118393';
const TELEGRAM_URL = 'https://t.me/domofondar123';
const TELEGRAM_BOT_URL = 'https://t.me/Domofondar_bot';
const SITE_URL = 'https://домофондар.рф';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout, loadProfile } = useAuthStore();
  const { colors, isDark, colorScheme, setTheme } = useAppTheme();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState((user as any)?.email || '');
  const [address, setAddress] = useState((user as any)?.address || '');
  const [apartment, setApartment] = useState((user as any)?.apartment || '');
  const [isSaving, setIsSaving] = useState(false);

  const [verifying, setVerifying] = useState(false);
  const [docReaderId, setDocReaderId] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [mapsOpen, setMapsOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const [mediaGranted, setMediaGranted] = useState<boolean | null>(null);
  const [geoGranted, setGeoGranted] = useState<boolean | null>(null);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);

  const vStatus: string = (user as any)?.verification_status || (user?.is_verified ? 'verified' : 'unverified');

  // Безопасная инициализация статуса разрешений (с задержкой после отрисовки экрана,
  // чтобы нативный поток Android не падал при монтировании таба)
  useEffect(() => {
    let isMounted = true;
    initializeUserNotificationChannel().catch(() => {});
    const timer = setTimeout(async () => {
      try {
        if (!isMounted) return;
        // Проверяем уведомления только если модуль корректно отвечает
        if (Notifications && typeof Notifications.getPermissionsAsync === 'function') {
          const n = await Notifications.getPermissionsAsync().catch(() => null);
          if (isMounted && n) setNotifGranted(Boolean(n.granted));
        }
      } catch (err) {
        console.log('[Profile] Не удалось безопасно проверить статус уведомлений:', err);
      }

      try {
        if (!isMounted) return;
        if (ImagePicker && typeof ImagePicker.getMediaLibraryPermissionsAsync === 'function') {
          const m = await ImagePicker.getMediaLibraryPermissionsAsync().catch(() => null);
          if (isMounted && m) setMediaGranted(Boolean(m.granted));
        }
      } catch (err) {
        console.log('[Profile] Не удалось безопасно проверить статус галереи:', err);
      }
    }, 400);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const handleOpenEdit = () => {
    setFullName(user?.full_name || '');
    setPhone(user?.phone || '');
    setEmail((user as any)?.email || '');
    setAddress((user as any)?.address || '');
    setApartment((user as any)?.apartment || '');
    setIsEditModalOpen(true);
  };

  const submitProfileChange = async () => {
    setIsSaving(true);
    try {
      const isExisting = !!(user?.is_verified || (user as any)?.address || (user as any)?.account_number);
      if (isExisting) {
        await apiClient.post('/api/user/request-data-change', {
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
          apartment: apartment.trim(),
          account_number: (user as any)?.account_number || undefined,
        });
        setIsEditModalOpen(false);
        Alert.alert('Отправлено на проверку', 'Заявка на изменение данных направлена диспетчеру. Новые данные вступят в силу после подтверждения.');
      } else {
        await apiClient.put('/api/user/profile', {
          full_name: fullName.trim(), phone: phone.trim(), address: address.trim(), apartment: apartment.trim(),
        });
        await loadProfile();
        setIsEditModalOpen(false);
        Alert.alert('Сохранено', 'Данные профиля сохранены.');
      }
    } catch (err: any) {
      Alert.alert('Ошибка', err.response?.data?.error || 'Не удалось сохранить данные');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveProfile = () => {
    if (!fullName.trim()) { Alert.alert('Внимание', 'Укажите ФИО'); return; }
    if (!address.trim()) { Alert.alert('Внимание', 'Укажите адрес'); return; }
    const isExisting = !!(user?.is_verified || (user as any)?.address || (user as any)?.account_number);
    if (isExisting) {
      Alert.alert('Изменение данных абонента', 'Данные меняются только после проверки диспетчером. Отправить заявку на изменение?',
        [{ text: 'Отмена', style: 'cancel' }, { text: 'Отправить на проверку', onPress: submitProfileChange }]);
    } else {
      submitProfileChange();
    }
  };

  const submitVerification = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setMediaGranted(perm.granted);
      if (!perm.granted) { Alert.alert('Нужен доступ к фото', 'Разрешите доступ к медиатеке, чтобы приложить документ.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, base64: true });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const dataUrl = asset.base64 ? `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}` : asset.uri;
      setVerifying(true);
      await apiClient.post('/api/user/submit-verification', { document_base64: dataUrl });
      await loadProfile();
      Alert.alert('Документ отправлен', 'Документ отправлен на проверку диспетчеру. Статус появится в профиле после рассмотрения.');
    } catch (err: any) {
      Alert.alert('Ошибка верификации', err.response?.data?.error || 'Не удалось отправить документ.');
    } finally {
      setVerifying(false);
    }
  };

  const toggleNotifications = async () => {
    try {
      if (notifGranted) { Linking.openSettings(); return; }
      const r = await Notifications.requestPermissionsAsync();
      setNotifGranted(r.granted);
      if (!r.granted) Linking.openSettings();
    } catch { Alert.alert('Ошибка', 'Не удалось изменить разрешение на уведомления.'); }
  };
  const requestMedia = async () => {
    try { const r = await ImagePicker.requestMediaLibraryPermissionsAsync(); setMediaGranted(r.granted); if (!r.granted) Linking.openSettings(); } catch {}
  };
  const requestGeo = async () => {
    try {
      if (!Location) { Alert.alert('Геопозиция', 'Модуль геолокации появится после обновления приложения.'); return; }
      const r = await Location.requestForegroundPermissionsAsync();
      setGeoGranted(r.granted);
      if (!r.granted) Linking.openSettings();
    } catch {}
  };

  const openRoute = (app: 'gis' | 'yandex') => {
    const url = app === 'gis' ? MAP_2GIS : MAP_YANDEX;
    Linking.openURL(url).catch(() => Alert.alert('Не удалось открыть карты'));
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert('Не удалось открыть ссылку'));
  };

  const handleCheckUpdateManual = async () => {
    try {
      const response = await apiClient.get<any>('/api/app/version');
      const latest = response.data?.latestVersion;
      if (latest && latest !== APP_VERSION) {
        Alert.alert('Доступно обновление', `Доступна версия ${latest}. Обновить сейчас?`, [
          { text: 'Позже', style: 'cancel' },
          { text: 'Обновить', onPress: () => Linking.openURL(response.data?.downloadUrl || APP_DOWNLOAD_URL) },
        ]);
      } else {
        Alert.alert('Обновление не требуется', `У вас последняя версия (${APP_VERSION}).`);
      }
    } catch { Alert.alert('Версия приложения', `У вас установлена версия ${APP_VERSION}.`); }
  };

  const handleLogout = () => {
    Alert.alert('Выход из аккаунта', 'Выйти из личного кабинета?', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Выйти', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
    ]);
  };

  const displayName = user?.full_name || (user as any)?.email || 'Абонент';
  const displayPhone = user?.phone || 'Телефон не указан';
  const rawAddr = (user as any)?.address || '';
  const apt = (user as any)?.apartment ? String((user as any).apartment).trim() : '';
  const hasAptInAddr = rawAddr && (/кв\.?\s*\d+/i.test(rawAddr) || /квартира\s*\d+/i.test(rawAddr));
  const displayAddress = rawAddr
    ? (hasAptInAddr || !apt ? rawAddr : `${rawAddr}, кв. ${apt}`)
    : 'Адрес не заполнен';
  const initials = displayName.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0].toUpperCase()).join('') || 'ДД';

  // Подсчёт незаполненных полей для индикатора на «Мои данные»
  const emptyCount = [user?.full_name, user?.phone, (user as any)?.email, (user as any)?.address].filter((v) => !v || !String(v).trim()).length;

  const themeOptions: { mode: ThemeMode; label: string; icon: any }[] = [
    { mode: 'system', label: 'Система', icon: 'phone-portrait-outline' },
    { mode: 'light', label: 'Светлая', icon: 'sunny-outline' },
    { mode: 'dark', label: 'Тёмная', icon: 'moon-outline' },
  ];

  const vBadge = vStatus === 'verified'
    ? { label: 'Подтверждён', color: colors.secondary, icon: 'shield-checkmark' as const, bg: isDark ? 'rgba(16,185,129,0.15)' : '#ecfdf5' }
    : vStatus === 'pending'
    ? { label: 'На проверке', color: colors.warning, icon: 'time' as const, bg: isDark ? 'rgba(245,158,11,0.15)' : '#fef3c7' }
    : vStatus === 'rejected'
    ? { label: 'Отклонён', color: colors.error, icon: 'close-circle' as const, bg: isDark ? 'rgba(239,68,68,0.15)' : '#fee2e2' }
    : { label: 'Не подтверждён', color: colors.textMuted, icon: 'shield-outline' as const, bg: isDark ? '#171b26' : '#eff4ff' };

  const docs: { id: string; title: string }[] = [
    { id: 'data-consent', title: 'Согласие на обработку персональных данных' },
    { id: 'privacy-policy', title: 'Политика конфиденциальности' },
    { id: 'public-offer', title: 'Публичная оферта' },
    { id: 'advertising-consent', title: 'Согласие на рекламную рассылку' },
  ];

  const Row = ({ icon, title, value = '', badge, isDestructive = false, onPress }: any) => {
    const hasBadge = badge !== undefined && badge !== null && badge !== 0 && badge !== false && String(badge).length > 0;
    const hasValue = value !== undefined && value !== null && String(value).trim().length > 0;
    return (
      <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={onPress ? 0.7 : 1} disabled={!onPress}>
        <View style={styles.menuItemLeft}>
          <Ionicons name={icon} size={22} color={isDestructive ? colors.error : colors.textMuted} />
          <Text style={[styles.menuItemTitle, { color: isDestructive ? colors.error : colors.text }]} numberOfLines={1}>{title}</Text>
          {hasBadge ? (
            <View style={[styles.warnBadge, { backgroundColor: colors.warning }]}>
              <Ionicons name="alert" size={11} color="#fff" />
              <Text style={styles.warnBadgeText}>{String(badge)}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.menuItemRight}>
          {hasValue ? <Text style={[styles.menuItemValue, { color: colors.textSecondary }]} numberOfLines={1}>{String(value)}</Text> : null}
          {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.safeArea, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.header}><Text style={[styles.title, { color: colors.text }]}>Профиль</Text></View>

      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 90 + insets.bottom }]}>
        {/* Карточка пользователя */}
        <View style={[styles.profileHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: isDark ? '#1c1f2a' : '#e0f2fe', borderColor: colors.primaryContainer }]}>
            <Ionicons name="shield-checkmark" size={30} color={colors.primaryContainer} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{displayName}</Text>
            <Text style={[styles.phone, { color: colors.textSecondary }]}>{displayPhone}</Text>
            <View style={[styles.vChip, { backgroundColor: vBadge.bg }]}>
              <Ionicons name={vBadge.icon} size={12} color={vBadge.color} style={{ marginRight: 4 }} />
              <Text style={[styles.vChipText, { color: vBadge.color }]}>{vBadge.label}</Text>
            </View>
          </View>
        </View>

        {/* Верификация */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Верификация</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 16 }]}>
            {vStatus === 'verified' ? (
              <View style={styles.vRow}><Ionicons name="shield-checkmark" size={22} color={colors.secondary} /><Text style={[styles.vInfo, { color: colors.text }]}>Ваш аккаунт подтверждён. Доступны все функции кабинета.</Text></View>
            ) : vStatus === 'pending' ? (
              <View style={styles.vRow}><Ionicons name="time" size={22} color={colors.warning} /><Text style={[styles.vInfo, { color: colors.text }]}>Документ на проверке у диспетчера. Обычно до 1 рабочего дня.</Text></View>
            ) : (
              <>
                <Text style={[styles.vInfo, { color: colors.textSecondary, marginBottom: 12 }]}>
                  {vStatus === 'rejected'
                    ? `Заявка отклонена${(user as any)?.verification_reject_reason ? `: ${(user as any).verification_reject_reason}` : ''}. Приложите корректный документ повторно.`
                    : 'Подтвердите проживание/собственность, приложив документ (свидетельство, выписка ЕГРН, прописка).'}
                </Text>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primaryContainer }, verifying && { opacity: 0.6 }]} onPress={submitVerification} disabled={verifying} activeOpacity={0.85}>
                  {verifying ? <ActivityIndicator color="#fff" /> : (<><Ionicons name="cloud-upload-outline" size={18} color="#fff" style={{ marginRight: 8 }} /><Text style={styles.primaryBtnText}>{vStatus === 'rejected' ? 'Загрузить повторно' : 'Пройти верификацию'}</Text></>)}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Данные абонента */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Данные абонента</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Row icon="person-circle-outline" title="Мои данные" badge={emptyCount > 0 ? emptyCount : undefined} value={emptyCount > 0 ? 'Заполнить' : 'Заполнено'} onPress={handleOpenEdit} />
          </View>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 10, padding: 14 }]}>
            <Text style={[styles.dataLine, { color: colors.textSecondary }]}>ФИО: <Text style={{ color: colors.text }}>{user?.full_name || '—'}</Text></Text>
            <Text style={[styles.dataLine, { color: colors.textSecondary }]}>Телефон: <Text style={{ color: colors.text }}>{user?.phone || '—'}</Text></Text>
            <Text style={[styles.dataLine, { color: colors.textSecondary }]}>Email: <Text style={{ color: colors.text }}>{(user as any)?.email || '—'}</Text></Text>
            <Text style={[styles.dataLine, { color: colors.textSecondary }]}>Адрес: <Text style={{ color: colors.text }}>{displayAddress}</Text></Text>
          </View>
        </View>

        {/* Разрешения */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Разрешения и фоновая работа</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.menuItem} onPress={toggleNotifications} activeOpacity={0.7}>
              <View style={styles.menuItemLeft}><Ionicons name="notifications-outline" size={22} color={colors.textMuted} /><Text style={[styles.menuItemTitle, { color: colors.text }]}>Уведомления</Text></View>
              <Text style={[styles.permStatus, { color: notifGranted ? colors.secondary : colors.textMuted }]}>{notifGranted == null ? '…' : notifGranted ? 'Разрешены' : 'Включить'}</Text>
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={requestMedia} activeOpacity={0.7}>
              <View style={styles.menuItemLeft}><Ionicons name="images-outline" size={22} color={colors.textMuted} /><Text style={[styles.menuItemTitle, { color: colors.text }]}>Доступ к фото и файлам</Text></View>
              <Text style={[styles.permStatus, { color: mediaGranted ? colors.secondary : colors.textMuted }]}>{mediaGranted == null ? '…' : mediaGranted ? 'Разрешён' : 'Включить'}</Text>
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={requestGeo} activeOpacity={0.7}>
              <View style={styles.menuItemLeft}><Ionicons name="location-outline" size={22} color={colors.textMuted} /><Text style={[styles.menuItemTitle, { color: colors.text }]}>Геопозиция</Text></View>
              <Text style={[styles.permStatus, { color: geoGranted ? colors.secondary : colors.textMuted }]}>{geoGranted == null ? '…' : geoGranted ? 'Разрешена' : 'Включить'}</Text>
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.menuItem} onPress={() => setPermissionsModalOpen(true)} activeOpacity={0.7}>
              <View style={styles.menuItemLeft}><Ionicons name="shield-checkmark-outline" size={22} color={colors.primaryContainer} /><Text style={[styles.menuItemTitle, { color: colors.primaryContainer, fontWeight: '700' }]}>Центр разрешений (Батарея / Фоновый режим)</Text></View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Оформление / тема */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Оформление</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, padding: 12 }]}>
            <Text style={[styles.themeHint, { color: colors.textSecondary }]}>Тема приложения</Text>
            <View style={[styles.segment, { backgroundColor: isDark ? '#171b26' : '#eff4ff', borderColor: colors.border }]}>
              {themeOptions.map((opt) => {
                const active = colorScheme === opt.mode;
                return (
                  <TouchableOpacity key={opt.mode} style={[styles.segmentBtn, active && { backgroundColor: colors.primaryContainer }]} onPress={() => setTheme(opt.mode)} activeOpacity={0.8}>
                    <Ionicons name={opt.icon} size={16} color={active ? '#ffffff' : colors.textSecondary} style={{ marginRight: 5 }} />
                    <Text style={{ color: active ? '#ffffff' : colors.textSecondary, fontWeight: active ? '700' : '500', fontSize: 13 }}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Инфо и действия */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Информация</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Row icon="information-circle-outline" title="О нас" onPress={() => setAboutOpen(true)} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Row icon="navigate-outline" title="Как проехать в офис" onPress={() => setMapsOpen(true)} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Row icon="globe-outline" title="Наш сайт" onPress={() => openLink(SITE_URL)} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Row icon="call-outline" title="Служба поддержки" onPress={() => Linking.openURL(`tel:${OFFICE_PHONE}`)} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Row icon="phone-portrait-outline" title="Версия приложения" value={APP_VERSION} onPress={handleCheckUpdateManual} />
          </View>
        </View>

        {/* Документы — отдельной кнопкой */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Документы</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Row icon="document-text-outline" title="Правовые документы" onPress={() => { setDocReaderId(null); setDocsOpen(true); }} />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row icon="log-out-outline" title="Выйти из аккаунта" isDestructive onPress={handleLogout} />
        </View>
      </ScrollView>

      {/* Модалка редактирования данных */}
      <Modal visible={isEditModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.border, paddingTop: Math.max(insets.top, 12) + 8 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Мои данные</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}><Ionicons name="close" size={24} color={colors.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>ФИО абонента</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]} value={fullName} onChangeText={setFullName} placeholder="Иванов Иван Иванович" placeholderTextColor={colors.textMuted} />
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Номер телефона</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]} value={phone} onChangeText={setPhone} placeholder="+7 (___) ___-__-__" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Электронная почта</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]} value={email} onChangeText={setEmail} placeholder="example@mail.ru" placeholderTextColor={colors.textMuted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Адрес (город, улица, дом, подъезд)</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]} value={address} onChangeText={setAddress} placeholder="например: г. Краснодар, ул. Казбекская, д. 13, п. 2" placeholderTextColor={colors.textMuted} />
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Номер квартиры</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]} value={apartment} onChangeText={setApartment} placeholder="например: 116" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
              <Text style={[styles.moderationNote, { color: colors.textMuted }]}>Изменения проходят проверку диспетчером и вступают в силу после подтверждения.</Text>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.secondaryContainer }, isSaving && { opacity: 0.6 }]} onPress={handleSaveProfile} disabled={isSaving} activeOpacity={0.85}>
                {isSaving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>Отправить на проверку</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Модалка «О нас»: информация о компании, режим работы, мессенджеры (как на сайте) */}
      <Modal visible={aboutOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setAboutOpen(false)}>
        <View style={[styles.modalFull, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 12) + 8 }]}>
          <View style={[styles.modalContentFull, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>О нас</Text>
              <TouchableOpacity onPress={() => setAboutOpen(false)}><Ionicons name="close" size={24} color={colors.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator>
              <Text style={[styles.aboutCompany, { color: colors.text }]}>ООО «ДомофонДар»</Text>
              <Text style={[styles.aboutDesc, { color: colors.textSecondary }]}>
                Обслуживание, ремонт и монтаж домофонных систем в Краснодаре. Многолетний опыт и поддержка жильцов.
              </Text>

              <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 16 }]}>Режим работы</Text>
              <View style={[styles.aboutRow, { borderColor: colors.border }]}>
                <Ionicons name="time-outline" size={18} color={colors.primaryContainer} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.aboutRowText, { color: colors.text }]}>Пн–Пт: 9:00 – 17:00</Text>
                  <Text style={[styles.aboutRowSub, { color: colors.textMuted }]}>Сб, Вс — выходной</Text>
                  <Text style={[styles.aboutRowSub, { color: colors.textMuted }]}>Заявки и заказы в приложении принимаются круглосуточно, обрабатываются в рабочее время.</Text>
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 16 }]}>Телефон и почта</Text>
              <TouchableOpacity style={[styles.aboutRow, { borderColor: colors.border }]} onPress={() => openLink(`tel:${OFFICE_PHONE}`)} activeOpacity={0.7}>
                <Ionicons name="call-outline" size={18} color={colors.primaryContainer} style={{ marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.aboutRowText, { color: colors.text }]}>+7 (903) 411-83-93</Text>
                  <Text style={[styles.aboutRowSub, { color: colors.textMuted }]}>Приём звонков: Пн–Пт 9:00–17:00</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.aboutRow, { borderColor: colors.border }]} onPress={() => openLink(`mailto:${OFFICE_EMAIL}`)} activeOpacity={0.7}>
                <Ionicons name="mail-outline" size={18} color={colors.primaryContainer} style={{ marginRight: 10 }} />
                <Text style={[styles.aboutRowText, { color: colors.text, flex: 1 }]}>{OFFICE_EMAIL}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 16 }]}>Мессенджеры</Text>
              <View style={styles.routeRow}>
                <TouchableOpacity style={[styles.routeBtn, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border }]} onPress={() => openLink(WHATSAPP_URL)} activeOpacity={0.85}>
                  <Ionicons name="logo-whatsapp" size={18} color="#25D366" style={{ marginRight: 6 }} />
                  <Text style={[styles.routeBtnText, { color: colors.text }]}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.routeBtn, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border }]} onPress={() => openLink(TELEGRAM_URL)} activeOpacity={0.85}>
                  <Ionicons name="paper-plane-outline" size={18} color="#2AABEE" style={{ marginRight: 6 }} />
                  <Text style={[styles.routeBtnText, { color: colors.text }]}>Telegram</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={[styles.aboutRow, { borderColor: colors.border, marginTop: 10 }]} onPress={() => openLink(TELEGRAM_BOT_URL)} activeOpacity={0.7}>
                <Ionicons name="chatbubbles-outline" size={18} color={colors.primaryContainer} style={{ marginRight: 10 }} />
                <Text style={[styles.aboutRowText, { color: colors.text, flex: 1 }]}>Telegram-бот @Domofondar_bot</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 16 }]}>Наш сайт</Text>
              <TouchableOpacity style={[styles.aboutRow, { borderColor: colors.border }]} onPress={() => openLink(SITE_URL)} activeOpacity={0.7}>
                <Ionicons name="globe-outline" size={18} color={colors.primaryContainer} style={{ marginRight: 10 }} />
                <Text style={[styles.aboutRowText, { color: colors.text, flex: 1 }]}>домофондар.рф</Text>
                <Ionicons name="open-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>

              <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 16 }]}>Адрес офиса</Text>
              <Text style={[styles.aboutAddr, { color: colors.text }]}>{OFFICE_ADDRESS}</Text>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primaryContainer, marginTop: 14 }]} onPress={() => { setAboutOpen(false); setMapsOpen(true); }} activeOpacity={0.85}>
                <Text style={styles.saveButtonText}>Как проехать</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={[styles.modalFooter, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
              <TouchableOpacity style={[styles.modalCloseBtn, { borderColor: colors.border }]} onPress={() => setAboutOpen(false)} activeOpacity={0.85}>
                <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>Закрыть</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модалка «Как проехать»: карты 2ГИС и Яндекс (организация как на сайте) */}
      <Modal visible={mapsOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setMapsOpen(false)}>
        <View style={[styles.modalFull, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 12) + 8 }]}>
          <View style={[styles.modalContentFull, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Как проехать</Text>
              <TouchableOpacity onPress={() => setMapsOpen(false)}><Ionicons name="close" size={24} color={colors.textMuted} /></TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Адрес офиса</Text>
              <Text style={[styles.aboutAddr, { color: colors.text }]}>{OFFICE_ADDRESS}</Text>
              <Text style={[styles.aboutRowSub, { color: colors.textMuted, marginTop: 6 }]}>Откройте карточку организации «ДомофонДар» в приложении карт:</Text>
              <View style={[styles.routeRow, { marginTop: 14 }]}>
                <TouchableOpacity style={[styles.routeBtn, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border }]} onPress={() => openRoute('gis')} activeOpacity={0.85}>
                  <Ionicons name="map-outline" size={18} color={colors.primaryContainer} style={{ marginRight: 6 }} />
                  <Text style={[styles.routeBtnText, { color: colors.text }]}>2ГИС</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.routeBtn, { backgroundColor: isDark ? '#1c1f2a' : '#f8f9ff', borderColor: colors.border }]} onPress={() => openRoute('yandex')} activeOpacity={0.85}>
                  <Ionicons name="map-outline" size={18} color={colors.primaryContainer} style={{ marginRight: 6 }} />
                  <Text style={[styles.routeBtnText, { color: colors.text }]}>Яндекс.Карты</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View style={[styles.modalFooter, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
              <TouchableOpacity style={[styles.modalCloseBtn, { borderColor: colors.border }]} onPress={() => setMapsOpen(false)} activeOpacity={0.85}>
                <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>Закрыть</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Модалка «Документы»: правовые документы */}
      <Modal visible={docsOpen} animationType="slide" transparent onRequestClose={() => { if (docReaderId) setDocReaderId(null); else setDocsOpen(false); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderColor: colors.border, paddingTop: Math.max(insets.top, 12) + 8 }]}>
            {docReaderId ? (() => {
              // Чтение документа ВНУТРИ этого же окна (без второго модального окна — иначе на Android ломается скролл)
              const doc = ALL_LEGAL_DOCUMENTS.find((d) => d.id === docReaderId) || null;
              return (
                <>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={() => setDocReaderId(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginRight: 10 }}>
                      <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.modalTitle, { color: colors.text, flex: 1 }]} numberOfLines={1}>{doc?.shortTitle || doc?.title || 'Документ'}</Text>
                    <TouchableOpacity onPress={() => { setDocReaderId(null); setDocsOpen(false); }}><Ionicons name="close" size={24} color={colors.textMuted} /></TouchableOpacity>
                  </View>
                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator>
                    <Text style={[styles.docTitleFull, { color: colors.text }]}>{doc?.title}</Text>
                    {doc?.updatedAt ? <Text style={[styles.aboutRowSub, { color: colors.textMuted, marginBottom: 6 }]}>Редакция от {doc.updatedAt}</Text> : null}
                    {doc?.description ? <Text style={[styles.docParagraph, { color: colors.textSecondary }]}>{doc.description}</Text> : null}
                    {doc?.sections.map((sec, i) => (
                      <View key={i} style={{ marginTop: 16 }}>
                        <Text style={[styles.docSectionTitle, { color: colors.text }]}>{sec.title}</Text>
                        {sec.content.map((p, j) => (
                          <Text key={j} style={[styles.docParagraph, { color: colors.textSecondary }]}>{p}</Text>
                        ))}
                      </View>
                    ))}
                    {!doc ? <Text style={[styles.docParagraph, { color: colors.textSecondary }]}>Документ не найден.</Text> : null}
                  </ScrollView>
                  <View style={[styles.modalFooter, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
                    <TouchableOpacity style={[styles.modalCloseBtn, { borderColor: colors.border }]} onPress={() => setDocReaderId(null)} activeOpacity={0.85}>
                      <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>Назад к списку</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })() : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Документы</Text>
                  <TouchableOpacity onPress={() => setDocsOpen(false)}><Ionicons name="close" size={24} color={colors.textMuted} /></TouchableOpacity>
                </View>
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator>
                  {docs.map((d) => (
                    <TouchableOpacity key={d.id} style={[styles.docRow, { borderColor: colors.border }]} onPress={() => setDocReaderId(d.id)} activeOpacity={0.7}>
                      <Ionicons name="document-text-outline" size={18} color={colors.primaryContainer} style={{ marginRight: 10 }} />
                      <Text style={[styles.docRowText, { color: colors.text }]}>{d.title}</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <View style={[styles.modalFooter, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
                  <TouchableOpacity style={[styles.modalCloseBtn, { borderColor: colors.border }]} onPress={() => setDocsOpen(false)} activeOpacity={0.85}>
                    <Text style={[styles.modalCloseText, { color: colors.textSecondary }]}>Закрыть</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Центр системных разрешений и фонового режима для жильцов */}
      <PermissionsCenterModal
        visible={permissionsModalOpen}
        onClose={() => setPermissionsModalOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: 'bold' },
  container: { padding: 20 },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { fontSize: 22, fontWeight: 'bold' },
  profileInfo: { flex: 1 },
  name: { fontSize: 18, fontWeight: 'bold' },
  phone: { fontSize: 14, marginTop: 4 },
  vChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  vChipText: { fontSize: 11, fontWeight: '700' },
  vRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vInfo: { flex: 1, fontSize: 13, lineHeight: 19 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 14 },
  primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginBottom: 10, marginLeft: 4 },
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#1e3a8a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: 16 },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 },
  menuItemTitle: { fontSize: 15, marginLeft: 12, fontWeight: '500', flexShrink: 1 },
  menuItemRight: { flexDirection: 'row', alignItems: 'center' },
  menuItemValue: { fontSize: 14, marginRight: 8, maxWidth: 150 },
  warnBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  warnBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', marginLeft: 2 },
  permStatus: { fontSize: 13, fontWeight: '600' },
  dataLine: { fontSize: 13.5, lineHeight: 24 },
  divider: { height: 1, marginLeft: 50 },
  themeHint: { fontSize: 13, fontWeight: '600', marginBottom: 10, marginLeft: 4 },
  segment: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 4, gap: 4 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 9 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'flex-end' },
  modalContent: { flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0, borderWidth: 0 },
  modalFull: { flex: 1, paddingHorizontal: 20 },
  modalContentFull: { flex: 1 },
  modalFooter: { paddingTop: 10, borderTopWidth: 1 },
  modalCloseBtn: { height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { fontSize: 15, fontWeight: '700' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  modalInput: { borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, borderWidth: 1 },
  moderationNote: { fontSize: 11.5, lineHeight: 16, marginTop: 14 },
  saveButton: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 14, marginBottom: 20 },
  saveButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  aboutAddr: { fontSize: 15, fontWeight: '600', marginTop: 4 },
  aboutCompany: { fontSize: 18, fontWeight: '800', marginTop: 4 },
  aboutDesc: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginTop: 8 },
  aboutRowText: { fontSize: 15, fontWeight: '600' },
  aboutRowSub: { fontSize: 12, marginTop: 2 },
  routeRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  routeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  routeBtnText: { fontSize: 14, fontWeight: '700' },
  docRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1 },
  docRowText: { flex: 1, fontSize: 13.5 },
  docTitleFull: { fontSize: 16, fontWeight: '800', marginTop: 6, marginBottom: 2, lineHeight: 22 },
  docSectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  docParagraph: { fontSize: 13, lineHeight: 20, marginBottom: 8 },
});
