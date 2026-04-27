import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(d: unknown, status = 200) {
  return new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const action = body?.action as "request_code" | "verify_and_submit";

    // ============ ШАГ 1: ЗАПРОС SMS-КОДА ============
    if (action === "request_code") {
      const { voting_id, phone } = body;
      if (!voting_id || !phone) return json({ error: "voting_id и phone обязательны" }, 400);

      const normalized = String(phone).replace(/[^\d+]/g, "");
      if (normalized.length < 11) return json({ error: "Некорректный номер" }, 400);

      // Проверим что голосование активно
      const { data: voting } = await supabase
        .from("votings")
        .select("status, ends_at")
        .eq("id", voting_id)
        .maybeSingle();
      if (!voting || voting.status !== "active") return json({ error: "Голосование не активно" }, 400);
      if (voting.ends_at && new Date(voting.ends_at) < new Date()) {
        return json({ error: "Голосование завершено" }, 400);
      }

      // Анти-спам: не чаще 1 кода в минуту
      const { data: recent } = await supabase
        .from("voting_phone_codes")
        .select("created_at")
        .eq("voting_id", voting_id)
        .eq("phone", normalized)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recent && Date.now() - new Date(recent.created_at).getTime() < 60_000) {
        return json({ error: "Подождите минуту перед повторной отправкой" }, 429);
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expires_at = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      await supabase.from("voting_phone_codes").insert({
        voting_id, phone: normalized, code, expires_at,
      });

      // TODO: интеграция с реальным SMS-провайдером (SMS.RU / Twilio).
      // Пока — возвращаем код в dev-режиме для локального теста через лог.
      console.log(`[VOTING SMS] phone=${normalized} code=${code}`);

      // В проде НЕ возвращаем код клиенту. Сейчас возвращаем dev-флаг.
      return json({ ok: true, dev_code: code });
    }

    // ============ ШАГ 2: ПРОВЕРКА КОДА И ПРИЁМ БЮЛЛЕТЕНЯ ============
    if (action === "verify_and_submit") {
      const {
        voting_id, phone, code,
        full_name, apartment, area_sqm, is_owner_confirmed,
        answers, // [{question_id, selected_option}, ...]
      } = body;

      if (!voting_id || !phone || !code || !full_name || !apartment || !answers?.length) {
        return json({ error: "Не все обязательные поля заполнены" }, 400);
      }
      if (!is_owner_confirmed) {
        return json({ error: "Подтвердите статус собственника" }, 400);
      }

      const normalized = String(phone).replace(/[^\d+]/g, "");

      // Проверим код
      const { data: rec } = await supabase
        .from("voting_phone_codes")
        .select("*")
        .eq("voting_id", voting_id)
        .eq("phone", normalized)
        .eq("is_used", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!rec) return json({ error: "Запросите код заново" }, 400);
      if (new Date(rec.expires_at) < new Date()) return json({ error: "Код просрочен" }, 400);
      if (rec.attempts >= 5) return json({ error: "Превышено число попыток" }, 429);
      if (String(rec.code) !== String(code)) {
        await supabase.from("voting_phone_codes").update({ attempts: rec.attempts + 1 }).eq("id", rec.id);
        return json({ error: "Неверный код" }, 400);
      }

      // Голосование активно?
      const { data: voting } = await supabase
        .from("votings")
        .select("status, ends_at")
        .eq("id", voting_id)
        .maybeSingle();
      if (!voting || voting.status !== "active") return json({ error: "Голосование не активно" }, 400);
      if (voting.ends_at && new Date(voting.ends_at) < new Date()) {
        return json({ error: "Голосование завершено" }, 400);
      }

      // Уже голосовал?
      const { data: existing } = await supabase
        .from("voting_ballots")
        .select("id, is_revoked")
        .eq("voting_id", voting_id)
        .eq("voter_phone", normalized)
        .eq("voter_apartment", String(apartment))
        .maybeSingle();
      if (existing && !existing.is_revoked) {
        return json({ error: "Бюллетень от этой квартиры уже принят" }, 409);
      }

      // Создаём бюллетень
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
      const ua = req.headers.get("user-agent") || null;
      const { data: ballot, error: bErr } = await supabase
        .from("voting_ballots")
        .insert({
          voting_id,
          voter_full_name: String(full_name).trim(),
          voter_phone: normalized,
          voter_apartment: String(apartment).trim(),
          voter_area_sqm: area_sqm ? Number(area_sqm) : null,
          is_owner_confirmed: true,
          phone_verified_at: new Date().toISOString(),
          ip_address: ip,
          user_agent: ua,
        })
        .select()
        .single();
      if (bErr) return json({ error: `Ошибка сохранения бюллетеня: ${bErr.message}` }, 500);

      // Ответы
      const rows = (answers as Array<{ question_id: string; selected_option: string }>).map((a) => ({
        ballot_id: ballot.id,
        question_id: a.question_id,
        selected_option: String(a.selected_option),
      }));
      const { error: aErr } = await supabase.from("voting_answers").insert(rows);
      if (aErr) {
        // откатим бюллетень
        await supabase.from("voting_ballots").delete().eq("id", ballot.id);
        return json({ error: `Ошибка сохранения ответов: ${aErr.message}` }, 500);
      }

      // Помечаем код использованным
      await supabase.from("voting_phone_codes").update({ is_used: true }).eq("id", rec.id);

      return json({ ok: true, ballot_id: ballot.id });
    }

    return json({ error: "Неизвестное action" }, 400);
  } catch (e) {
    console.error("voting-submit error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});
