/**
 * Экспорт объектов тем (светлой и тёмной) для использования в приложении
 */
import { lightColors, darkColors } from './colors';

// Общие настройки отступов (spacing)
const spacing = {
  xs: 4,
  s: 8,
  m: 16,
  l: 24,
  xl: 32,
  xxl: 40,
};

// Настройки скруглений (border radius) для эффекта premium
const borderRadius = {
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  round: 9999,
};

// Типографика (базовые размеры шрифтов)
const typography = {
  h1: { fontSize: 32, fontWeight: '700' as const },
  h2: { fontSize: 24, fontWeight: '700' as const },
  h3: { fontSize: 20, fontWeight: '600' as const },
  body1: { fontSize: 16, fontWeight: '400' as const },
  body2: { fontSize: 14, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
};

// Объект светлой темы
export const lightTheme = {
  colors: lightColors,
  spacing,
  borderRadius,
  typography,
  isDark: false,
};

// Объект тёмной темы
export const darkTheme = {
  colors: darkColors,
  spacing,
  borderRadius,
  typography,
  isDark: true,
};

// Экспортируем тип темы для использования в Styled Components / хуках
export type AppTheme = typeof lightTheme;
