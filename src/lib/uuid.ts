/**
 * Утилита безопасной генерации UUID v4.
 * 
 * Причина создания:
 * Стандартный метод `crypto.randomUUID()` доступен в браузерах ТОЛЬКО в Secure Contexts (HTTPS или localhost).
 * При доступе по обычному HTTP (например, прямой IP сервера http://45.8.99.238/)
 * вызов crypto.randomUUID() выбрасывает фатальную ошибку:
 * "TypeError: crypto.randomUUID is not a function", приводя к белому экрану приложения.
 * 
 * Данный модуль предоставляет 100% безопасную альтернативу с автоматическим фоллбеком.
 */

export function generateUUID(): string {
  // 1. Проверяем наличие нативного безопасного генератора crypto.randomUUID
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function") {
    try {
      const nativeUuid = window.crypto.randomUUID();
      return nativeUuid;
    } catch (e) {
      console.warn("[UUID] Ошибка нативного crypto.randomUUID, переключаемся на крипто-буфер фоллбек:", e);
    }
  }

  // 2. Второй уровень: использование window.crypto.getRandomValues (доступен даже по HTTP в большинстве браузеров)
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.getRandomValues === "function") {
    try {
      const buffer = new Uint8Array(16);
      window.crypto.getRandomValues(buffer);

      // Устанавливаем версию 4 (0100) и вариант RFC4122 (10xx)
      buffer[6] = (buffer[6] & 0x0f) | 0x40;
      buffer[8] = (buffer[8] & 0x3f) | 0x80;

      const hex = Array.from(buffer, (b) => b.toString(16).padStart(2, "0")).join("");
      const generated = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
      return generated;
    } catch (e) {
      console.warn("[UUID] Ошибка getRandomValues, переключаемся на Math.random:", e);
    }
  }

  // 3. Третий уровень: надежный математический фоллбек по стандарту RFC4122
  console.log("[UUID] Генерация UUID через алгоритм Math.random фоллбека");
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const randomNibble = (Math.random() * 16) | 0;
    const value = character === "x" ? randomNibble : (randomNibble & 0x3) | 0x8;
    return value.toString(16);
  });
}
