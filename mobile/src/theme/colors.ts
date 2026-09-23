/**
 * Определение цветовых палитр приложения
 */

// Базовые общие цвета
const commonColors = {
  // Изумрудные акценты (основной бренд)
  primary: '#10B981',
  primaryDark: '#059669',
  primaryLight: '#34D399',
  
  // Цвета состояний
  success: '#10B981', // Успех совпадает с акцентом в нашем дизайне
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  transparent: 'transparent',
};

// Тёмная тема (Glass-premium)
export const darkColors = {
  ...commonColors,
  
  background: '#0F172A',      // Основной тёмный фон
  surface: '#1E293B',         // Фон поверхностей (модалки, панели)
  card: 'rgba(30, 41, 59, 0.8)', // Полупрозрачный фон карточек (glass)
  
  text: '#F8FAFC',            // Основной текст
  textSecondary: '#94A3B8',   // Вторичный текст
  textMuted: '#64748B',       // Приглушенный текст
  
  border: '#334155',          // Границы элементов
  divider: '#1E293B',         // Разделители
  
  overlay: 'rgba(0, 0, 0, 0.6)', // Затемнение
};

// Светлая тема
export const lightColors = {
  ...commonColors,
  
  background: '#FFFFFF',      // Основной светлый фон
  surface: '#F8FAFC',         // Фон поверхностей
  card: '#FFFFFF',            // Фон карточек
  
  text: '#0F172A',            // Основной текст
  textSecondary: '#475569',   // Вторичный текст
  textMuted: '#94A3B8',       // Приглушенный текст
  
  border: '#E2E8F0',          // Границы элементов
  divider: '#F1F5F9',         // Разделители
  
  overlay: 'rgba(15, 23, 42, 0.4)', // Затемнение
};
