import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserIdentity } from "@/lib/audit";

// ============================================================================
// Помощники для раздела «Новые дома» (объекты на монтаже) и истории подъездов.
// ============================================================================

// Нормализация части адреса: нижний регистр, схлопнутые пробелы, без лишних символов.
export const normPart = (s?: string | null): string =>
  String(s || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");

// Ключ дома: улица + дом (без подъезда) — для сопоставления заявок с объектом.
export const houseKey = (street?: string | null, house?: string | null): string =>
  `${normPart(street)}|${normPart(house)}`;

// Записать переход статуса подъезда в историю (entrance_status_history).
export async function logEntranceStatus(
  entrance: { id: string; city?: string | null; street?: string | null; house?: string | null; entrance?: string | null },
  status: string,
): Promise<void> {
  try {
    const me = await getCurrentUserIdentity();
    await supabase.from("entrance_status_history").insert({
      entrance_id: entrance.id,
      city: entrance.city ?? null,
      street: entrance.street ?? null,
      house: entrance.house ?? null,
      entrance: entrance.entrance ?? null,
      status,
      changed_by: me.id,
      changed_by_name: me.name || null,
    });
  } catch (e) {
    console.warn("[newBuildings] Не удалось записать историю статуса подъезда:", e);
  }
}

// Человекочитаемая метка статуса.
export const statusLabel = (s?: string | null): string =>
  s === "installation" ? "На монтаже" : s === "rent" ? "Аренда" : s === "maintenance" ? "На обслуживании" : (s || "—");
