// ============================================================================
// Универсальная загрузка файлов на собственный бэкенд (замена Supabase Storage).
// После переезда с Supabase на PostgreSQL/PostgREST Storage больше нет,
// поэтому файлы (фото новостей, акций, задач, заявок, КП) грузятся сюда.
// Эндпоинт: POST /backend-api/api/upload  ->  { url }
// ============================================================================

// Разрешённые папки-назначения (совпадают с whitelist на бэкенде)
export type UploadFolder =
  | "news"
  | "promotions"
  | "tasks"
  | "requests"
  | "calculations"
  | "portfolio"
  | "employees"
  | "misc";

/**
 * Загружает файл на сервер и возвращает публичный URL (/media/<folder>/<file>).
 * @param file  Файл из <input type="file"> или Blob
 * @param folder Папка назначения (см. UploadFolder)
 * @returns Публичный URL загруженного файла
 */
export async function uploadFile(file: File | Blob, folder: UploadFolder = "misc"): Promise<string> {
  // Преобразуем файл в base64 (тот же формат, что уже принимает /api/portfolio/upload)
  const fileBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });

  const fileName = (file as File).name || `upload_${Date.now()}`;
  const fileType = (file as File).type || "application/octet-stream";

  const res = await fetch("/backend-api/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64, fileName, fileType, folder }),
  });

  if (!res.ok) {
    let msg = "Ошибка загрузки файла на сервер";
    try {
      const err = await res.json();
      msg = err.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const data = await res.json();
  if (!data.url) throw new Error("Сервер не вернул URL загруженного файла");
  return data.url as string;
}
