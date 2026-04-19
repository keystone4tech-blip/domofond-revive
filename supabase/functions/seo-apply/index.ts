import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Не авторизован" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Проверка роли
    const { data: hasAccess } = await supabase.rpc("has_admin_console_access", {
      _user_id: user.id,
    });
    if (!hasAccess) {
      return new Response(JSON.stringify({ error: "Нет прав" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const action: "apply" | "reject" | "rollback" = body.action;
    const ids: string[] = body.suggestion_ids || (body.suggestion_id ? [body.suggestion_id] : []);
    const historyId: string | undefined = body.history_id;

    // ОТКАТ
    if (action === "rollback" && historyId) {
      const { data: hist, error: hErr } = await supabase
        .from("seo_history")
        .select("*")
        .eq("id", historyId)
        .single();
      if (hErr || !hist) throw new Error("Запись истории не найдена");
      if (hist.is_rolled_back) throw new Error("Уже откачено");

      await applyChange(supabase, {
        page_path: hist.page_path,
        target_type: hist.target_type,
        target_id: hist.target_id,
        field_name: hist.field_name,
        new_value: hist.previous_value,
      });

      await supabase
        .from("seo_history")
        .update({ is_rolled_back: true, rolled_back_at: new Date().toISOString() })
        .eq("id", historyId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ids.length) {
      return new Response(JSON.stringify({ error: "Нет ID предложений" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ОТКЛОНИТЬ
    if (action === "reject") {
      await supabase
        .from("seo_suggestions")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .in("id", ids);
      return new Response(JSON.stringify({ success: true, count: ids.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ПРИМЕНИТЬ
    if (action === "apply") {
      const { data: suggestions } = await supabase
        .from("seo_suggestions")
        .select("*")
        .in("id", ids)
        .eq("status", "pending");

      let applied = 0;
      for (const s of suggestions || []) {
        try {
          const previous = await applyChange(supabase, {
            page_path: s.page_path,
            target_type: s.target_type,
            target_id: s.target_id,
            field_name: s.field_name,
            new_value: s.after_value,
          });

          await supabase.from("seo_history").insert({
            suggestion_id: s.id,
            page_path: s.page_path,
            target_type: s.target_type,
            target_id: s.target_id,
            field_name: s.field_name,
            previous_value: previous,
            new_value: s.after_value,
            applied_by: user.id,
          });

          await supabase
            .from("seo_suggestions")
            .update({
              status: "applied",
              reviewed_by: user.id,
              reviewed_at: new Date().toISOString(),
              applied_at: new Date().toISOString(),
            })
            .eq("id", s.id);

          applied++;
        } catch (err) {
          console.error("Apply error for suggestion", s.id, err);
        }
      }

      return new Response(JSON.stringify({ success: true, applied }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Неизвестное действие" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seo-apply error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function applyChange(
  supabase: any,
  ch: {
    page_path: string;
    target_type: string;
    target_id: string | null;
    field_name: string;
    new_value: string | null;
  },
): Promise<string | null> {
  if (ch.target_type === "page_meta" || ch.target_type === "page_h1") {
    // Получаем текущее значение
    const { data: existing } = await supabase
      .from("seo_page_meta")
      .select("*")
      .eq("page_path", ch.page_path)
      .maybeSingle();

    const previous = existing?.[ch.field_name] ?? null;
    const previousStr = previous === null ? null : typeof previous === "string" ? previous : JSON.stringify(previous);

    let valueToWrite: any = ch.new_value;
    if (ch.field_name === "json_ld" && ch.new_value) {
      try {
        valueToWrite = JSON.parse(ch.new_value);
      } catch {
        valueToWrite = ch.new_value;
      }
    }

    if (existing) {
      await supabase
        .from("seo_page_meta")
        .update({
          [ch.field_name]: valueToWrite,
          last_optimized_at: new Date().toISOString(),
        })
        .eq("page_path", ch.page_path);
    } else {
      await supabase.from("seo_page_meta").insert({
        page_path: ch.page_path,
        [ch.field_name]: valueToWrite,
        last_optimized_at: new Date().toISOString(),
      });
    }

    return previousStr;
  }

  if (ch.target_type === "site_block" && ch.target_id) {
    const { data: block } = await supabase
      .from("site_blocks")
      .select("content")
      .eq("id", ch.target_id)
      .single();
    if (!block) throw new Error("Блок не найден");

    const content = { ...(block.content || {}) };
    const previous = content[ch.field_name];
    const previousStr = previous === undefined ? null : typeof previous === "string" ? previous : JSON.stringify(previous);
    content[ch.field_name] = ch.new_value;

    await supabase
      .from("site_blocks")
      .update({ content })
      .eq("id", ch.target_id);

    return previousStr;
  }

  throw new Error(`Неизвестный target_type: ${ch.target_type}`);
}
