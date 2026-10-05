/**
 * Цветовая палитра темы «Domofondar CyberShield & Frosted Arctic Glass»
 * Разработана для мобильного приложения с поддержкой двух премиальных тем:
 * - Cyber Dark / Deep Nebula Glass: глубокий графитово-обсидиановый фон с неоновыми акцентами
 * - Frosted Arctic Glass: нежно-пастельный голубоватый фон, матовые стеклянные карточки с тенями
 */

// Базовые общие цвета бренда
const commonColors = {
  accentBlue: '#0ea5e9',
  accentEmerald: '#10b981',
  accentGreen: '#4edea3',
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

// Тёмная тема (Cyber Dark / Deep Nebula Glass)
export const darkColors = {
  ...commonColors,
  isDark: true,

  // Фоны и поверхности (Глубокий обсидианово-графитовый фон)
  background: '#0B0F17',          // Премиальный ультра-тёмный фон без глухоты
  surface: '#111722',             // Подложка блоков и карточек
  card: '#161C28',                // Базовый фон матовых карточек
  cardHigh: '#1E2638',            // Приподнятые элементы / чипы
  cardHighest: '#283248',         // Активные поля ввода и контролы
  overlay: 'rgba(8, 12, 20, 0.8)',

  // Стеклянные эффекты (Glassmorphism)
  glassCard: 'rgba(22, 28, 40, 0.85)',
  glassBorder: 'rgba(255, 255, 255, 0.08)',
  glassInnerGlow: 'rgba(255, 255, 255, 0.05)',

  // Акценты
  primary: '#89ceff',             // Кибер-голубой неоновый текст/иконки
  primaryContainer: '#0ea5e9',    // Яркая синяя кнопка / плашка
  onPrimary: '#00344d',
  
  secondary: '#4edea3',           // Изумрудный статус безопасности «В норме»
  secondaryContainer: '#00a572',
  onSecondary: '#003824',

  // Текст
  text: '#f1f5f9',                // Основной светлый контрастный текст
  textSecondary: '#cbd5e1',       // Вторичный поясняющий текст
  textMuted: '#94a3b8',           // Приглушенные подписи / метки

  // Границы и разделители
  border: 'rgba(255, 255, 255, 0.08)', // Тонкая высокотехнологичная граница
  outline: '#334155',
  divider: 'rgba(255, 255, 255, 0.06)',

  // Статусы
  error: '#ffb4ab',
  errorContainer: '#93000a',
  warning: '#fbbf24',
  success: '#4edea3',
};

// Светлая тема (Frosted Arctic Glass: нежно-голубой фон, матовое стекло, мягкие тени)
export const lightColors = {
  ...commonColors,
  isDark: false,

  // Фоны и поверхности (Мягкий льдисто-пастельный фон вместо слепящего белого)
  background: '#EDF4FB',          // Комфортный для глаз нежно-голубоватый фон
  surface: '#E2EEFA',             // Подложка блоков
  card: '#FFFFFF',                // Чистая карточка с матовой полупрозрачностью
  cardHigh: '#DDE9F8',            // Голубоватые чипы / бейджи
  cardHighest: '#D4E4F5',         // Поля ввода
  overlay: 'rgba(15, 23, 42, 0.4)',

  // Стеклянные эффекты (Glassmorphism)
  glassCard: 'rgba(255, 255, 255, 0.92)',
  glassBorder: 'rgba(186, 215, 245, 0.65)',
  glassInnerGlow: 'rgba(255, 255, 255, 0.95)',

  // Акценты
  primary: '#0284c7',             // Глубокий синий
  primaryContainer: '#0ea5e9',    // Яркая технологичная кнопка
  onPrimary: '#ffffff',

  // Безопасность и статусы
  secondary: '#059669',           // Изумрудный индикатор «В норме»
  secondaryContainer: '#10b981',
  onSecondary: '#ffffff',

  // Текст (Высокий контраст без слепящей белизны подложки)
  text: '#0F172A',                // Глубокий графитовый текст отличной читаемости
  textSecondary: '#475569',       // Спокойный поясняющий текст
  textMuted: '#64748B',           // Приглушенные подписи

  // Границы и разделители
  border: '#CADDF4',              // Мягкая голубоватая окантовка (фаска стекла)
  outline: '#BACFE8',
  divider: '#DDE8F6',

  // Статусы
  error: '#dc2626',
  errorContainer: '#fee2e2',
  warning: '#d97706',
  success: '#059669',
};
