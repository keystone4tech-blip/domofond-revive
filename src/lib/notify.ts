// ============================================================================
// Отправка уведомлений через собственный бэкенд (замена Supabase Edge Function notify).
// Fire-and-forget: ошибки не пробрасываются, чтобы не прерывать основные операции
// (создание заявки, верификация и т.п.).
// Эндпоинт: POST /backend-api/api/notify { event, data }
// ============================================================================

export async function notify(event: string, data: Record<string, unknown> = {}): Promise<void> {
  try {
    await fetch("/backend-api/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, data }),
    });
  } catch (e) {
    // Уведомления не критичны — просто логируем
    console.warn("[notify] Не удалось отправить уведомление:", e);
  }
}
