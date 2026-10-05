// mobile/src/components/LegalModal.tsx
// Просмотр юридических документов (152-ФЗ, оферта, согласие на рекламу) — на весь экран,
// с закреплённым заголовком и кнопкой закрытия. Тема-зависимый.

import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/theme';
import { ALL_LEGAL_DOCUMENTS } from '@/data/legalDocuments';

interface LegalModalProps {
  visible: boolean;
  docId: string | null;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ visible, docId, onClose }) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const doc = ALL_LEGAL_DOCUMENTS.find((d) => d.id === docId) || null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 12) }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {doc?.title || 'Документ'}
            </Text>
            {doc?.updatedAt ? (
              <Text style={[styles.updated, { color: colors.textMuted }]}>Редакция от {doc.updatedAt}</Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={26} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} showsVerticalScrollIndicator>
          {doc?.description ? (
            <Text style={[styles.desc, { color: colors.textSecondary }]}>{doc.description}</Text>
          ) : null}
          {doc?.sections.map((sec, i) => (
            <View key={i} style={{ marginTop: 16 }}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{sec.title}</Text>
              {sec.content.map((p, j) => (
                <Text key={j} style={[styles.paragraph, { color: colors.textSecondary }]}>{p}</Text>
              ))}
            </View>
          ))}
          {!doc ? (
            <Text style={[styles.paragraph, { color: colors.textSecondary }]}>Документ не найден.</Text>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.primaryContainer }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <Text style={styles.closeBtnText}>Понятно</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1,
  },
  title: { fontSize: 17, fontWeight: '700' },
  updated: { fontSize: 11, marginTop: 3 },
  desc: { fontSize: 13, lineHeight: 19, marginTop: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  paragraph: { fontSize: 13, lineHeight: 20, marginBottom: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  closeBtn: { height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
