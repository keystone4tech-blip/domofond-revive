import { supabase } from "@/integrations/supabase/client";

// Единый помощник журналирования удалений. Вызывается из всех мест, где что-то удаляют,
// чтобы в журнале осталось: что удалили, снимок, и КТО из сотрудников удалил.
export async function logDeletion(
  entityType: string,
  entityId: string | number | null,
  entityLabel?: string | null,
  snapshot?: any,
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id || null;
    let byName = session?.user?.email || "";
    if (uid) {
      try {
        const { data } = await supabase.from("profiles").select("full_name").eq("id", uid).single();
        if (data?.full_name && data.full_name.trim()) byName = data.full_name.trim();
      } catch { /* имя не критично */ }
    }
    await supabase.from("deletion_log").insert({
      entity_type: entityType,
      entity_id: entityId != null ? String(entityId) : null,
      entity_label: entityLabel || null,
      snapshot: snapshot ?? null,
      deleted_by: uid,
      deleted_by_name: byName || null,
    });
  } catch (e) {
    console.warn("[audit] Не удалось записать удаление в журнал:", e);
  }
}
