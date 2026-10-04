// mobile/src/components/LegalModal.tsx
// Просмотр юридических документов (152-ФЗ, оферта, согласие на рекламу) — как на сайте,
// без ухода с экрана регистрации. Тема-зависимый.

import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/theme';
import { ALL_LEGAL_DOCUMENTS } from '@/data/legalDocuments';

interface LegalModalProps {
  visible: boolean;
  docId: string | null;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ visible, docId, onClose }) => {
  const { colors, isDark } = useAppTheme();
  const doc = ALL_LEGAL_DOCUMENTS.find((d) => d.id === docId) || null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}>
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
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator>
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

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: colors.primaryContainer }]}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.closeBtnText}>Понятно</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1,
    maxHeight: '88%', paddingBottom: Platform.OS === 'ios' ? 16 : 8,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12, borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '700' },
  updated: { fontSize: 11, marginTop: 3 },
  body: { paddingHorizontal: 20 },
  desc: { fontSize: 13, lineHeight: 19, marginTop: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  paragraph: { fontSize: 13, lineHeight: 20, marginBottom: 8 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  closeBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
