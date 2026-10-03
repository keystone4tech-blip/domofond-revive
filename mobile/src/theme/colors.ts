/**
 * Цветовая палитра темы «Domofondar CyberShield»
 * Разработана для мобильного приложения с поддержкой двух премиальных тем:
 * - Cyber Dark: глубокий графитовый фон, неоновые бирюзовые и изумрудные акценты
 * - Clean Tech: чистый светлый фон с мягкими голубыми карточками и контрастным текстом
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

// Тёмная тема (Cyber Dark)
export const darkColors = {
  ...commonColors,
  isDark: true,

  // Фоны и поверхности
  background: '#0f131d',          // Основной ультра-темный кибер-фон
  surface: '#171b26',             // Промежуточная подложка
  card: '#1c1f2a',                // Базовый фон карточек
  cardHigh: '#262a35',            // Приподнятые элементы / чипы
  cardHighest: '#313540',         // Активные поля ввода и контролы
  overlay: 'rgba(10, 14, 24, 0.75)',

  // Акценты
  primary: '#89ceff',             // Кибер-голубой неоновый текст/иконки
  primaryContainer: '#0ea5e9',    // Яркая синяя кнопка / плашка
  onPrimary: '#00344d',
  
  secondary: '#4edea3',           // Изумрудный статус безопасности «В норме»
  secondaryContainer: '#00a572',
  onSecondary: '#003824',

  // Текст
  text: '#dfe2f1',                // Основной светлый контрастный текст
  textSecondary: '#bec8d2',       // Вторичный поясняющий текст
  textMuted: '#88929b',           // Приглушенные подписи / метки

  // Границы и разделители
  border: 'rgba(148, 163, 184, 0.16)', // Тонкая высокотехнологичная граница
  outline: '#3e4850',
  divider: '#262a35',

  // Статусы
  error: '#ffb4ab',
  errorContainer: '#93000a',
  warning: '#fbbf24',
  success: '#4edea3',
};

// Светлая тема (Clean Tech)
export const lightColors = {
  ...commonColors,
  isDark: false,

  // Фоны и поверхности
  background: '#f8f9ff',          // Чистый высокотехнологичный светлый фон
  surface: '#eff4ff',             // Подложка блоков
  card: '#ffffff',                // Белоснежная карточка
  cardHigh: '#e5eeff',            // Голубоватые чипы / бейджи
  cardHighest: '#dce9ff',         // Поля ввода
  overlay: 'rgba(11, 28, 48, 0.4)',

  // Акценты
  primary: '#0284c7',             // Глубокий синий
  primaryContainer: '#0ea5e9',    // Яркая кнопка
  onPrimary: '#ffffff',

  secondary: '#059669',           // Изумрудный индикатор «В норме»
  secondaryContainer: '#10b981',
  onSecondary: '#ffffff',

  // Текст
  text: '#0b1c30',                // Глубокий темный текст высокой читаемости
  textSecondary: '#45464d',       // Поясняющий текст
  textMuted: '#76777d',           // Приглушенные подписи

  // Границы и разделители
  border: '#d3e4fe',              // Легкая мягкая голубоватая окантовка
  outline: '#c6c6cd',
  divider: '#e5eeff',

  // Статусы
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  warning: '#d97706',
  success: '#059669',
};

