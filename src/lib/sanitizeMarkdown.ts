// Очистка Markdown от типичных «мусорных» артефактов AI-генерации:
// - незакрытые ** в начале/конце абзацев
// - заголовки, обёрнутые в **
// - служебные хвосты tool-arg вроде "excerpt:", "image_prompt:"
// - пустые ## или ###, пустые буллеты
// Применяется и к старым новостям, сохранённым до правок Edge Function.
export function sanitizeMarkdown(input: string | null | undefined): string {
  if (!input) return "";
  let out = String(input);

  // 1. Хвостовые служебные метки tool-arg
  out = out.replace(/[\s,;.]*\b(excerpt|keywords|image_prompt|title|content)\s*[:=][\s\S]*$/i, "");
  out = out.replace(/[\s,;]+(excerpt|keywords|image_prompt|title|content)\s*$/gim, "");

  // 2. Заголовки в **...** → чистые
  out = out.replace(/^(#{1,6})\s*\*+\s*(.+?)\s*\*+\s*$/gm, "$1 $2");

  // 3. Пустые заголовки и буллеты
  out = out.replace(/^#{1,6}\s*$/gm, "");
  out = out.replace(/^[-*]\s*$/gm, "");

  // 4. Абзац, начинающийся с ** без закрытия на той же строке
  out = out.replace(/^\*\*(?!\*)([^\n*]*?)$/gm, (_m, p1) => p1);

  // 5. Хвостовые ** без открывающей пары
  out = out.replace(/^([^\n*]*?)\*\*\s*$/gm, (m, p1) => {
    return (p1.match(/\*\*/g) || []).length % 2 === 0 ? p1 : m;
  });

  // 6. Пустой жирный/курсив
  out = out.replace(/\*\*\s*\*\*/g, "");
  out = out.replace(/(?<!\*)\*\s*\*(?!\*)/g, "");

  // 7. 3+ звёздочек → 2
  out = out.replace(/\*{3,}/g, "**");

  // 8. Балансировка нечётного количества **
  const stars = (out.match(/\*\*/g) || []).length;
  if (stars % 2 === 1) {
    out = out.replace(/\*\*([^*]*)$/, "$1");
  }

  // 9. Заголовки без пробела после #
  out = out.replace(/^(#{1,6})([^\s#])/gm, "$1 $2");

  // 10. Одиночные # в конце текста
  out = out.replace(/\n+#{1,6}\s*$/g, "");

  // 11. Сжимаем переносы
  out = out.replace(/\n{3,}/g, "\n\n");

  return out.trim();
}
