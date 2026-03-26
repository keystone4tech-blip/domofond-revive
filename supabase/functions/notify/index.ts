import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Unified notification function - sends push + telegram
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { event, data } = await req.json();

    let pushRecipients: { user_ids?: string[]; roles?: string[] } = {};
    let pushTitle = "";
    let pushBody = "";
    let pushUrl = "/fsm";
    let telegramNotify: { phone?: string; message?: string } | null = null;

    switch (event) {
      case "request_created": {
        pushRecipients = { roles: ["admin", "director", "dispatcher", "manager"] };
        pushTitle = "🔔 Новая заявка";
        pushBody = `👤 ${data.name}\n📍 ${data.address}\n📝 ${data.message?.substring(0, 80) || ""}\n📞 ${data.phone}`;
        break;
      }

      case "request_accepted": {
        pushRecipients = { roles: ["admin", "director", "dispatcher"] };
        pushTitle = "✅ Заявка принята";
        pushBody = `👷 ${data.employee_name} принял заявку\n👤 ${data.client_name}\n📍 ${data.address}`;
        // Notify client via telegram
        if (data.client_phone) {
          telegramNotify = {
            phone: data.client_phone,
            message: `✅ Ваша заявка принята в работу!\n\n👷 Мастер: ${data.employee_name}\n📍 ${data.address}\n\nМы скоро свяжемся с вами.`,
          };
        }
        break;
      }

      case "request_completed": {
        pushRecipients = { roles: ["admin", "director", "dispatcher"] };
        pushTitle = "🎉 Заявка выполнена";
        pushBody = `👷 ${data.employee_name}\n👤 ${data.client_name}\n📍 ${data.address}${data.total ? `\n💰 ${data.total} ₸` : ""}`;
        if (data.client_phone) {
          telegramNotify = {
            phone: data.client_phone,
            message: `🎉 Ваша заявка выполнена!\n\n📍 ${data.address}${data.work_notes ? `\n📝 ${data.work_notes}` : ""}${data.total ? `\n💰 Сумма: ${data.total} ₸` : ""}\n\nСпасибо что выбрали Домофондар! ⭐`,
          };
        }
        break;
      }

      case "request_cancelled": {
        pushRecipients = { roles: ["admin", "director", "dispatcher"] };
        pushTitle = "❌ Заявка отменена";
        pushBody = `👤 ${data.client_name}\n📍 ${data.address}\n📝 Причина: ${data.reason?.substring(0, 80) || "не указана"}`;
        if (data.client_phone) {
          telegramNotify = {
            phone: data.client_phone,
            message: `❌ К сожалению, ваша заявка отменена.\n\n📍 ${data.address}\n📝 Причина: ${data.reason || "не указана"}\n\nСвяжитесь с нами для уточнения.`,
          };
        }
        break;
      }

      case "request_declined": {
        pushRecipients = { roles: ["admin", "director", "dispatcher", "master", "engineer"] };
        pushTitle = "🔄 Заявка возвращена";
        pushBody = `👷 ${data.employee_name} отказался\n👤 ${data.client_name}\n📍 ${data.address}\n📝 ${data.reason?.substring(0, 80) || ""}`;
        break;
      }

      case "task_assigned": {
        const assignedUserId = data.assigned_user_id;
        if (assignedUserId) {
          pushRecipients = { user_ids: [assignedUserId] };
        }
        pushTitle = "📋 Новая задача";
        pushBody = `${data.title}\n📅 ${data.scheduled_date || "Без даты"}\n⚡ Приоритет: ${data.priority || "средний"}`;
        break;
      }

      case "verification_request": {
        pushRecipients = { roles: ["admin", "director"] };
        pushTitle = "👤 Запрос на верификацию";
        pushBody = `${data.full_name || "Пользователь"} отправил данные на проверку`;
        break;
      }

      case "verification_approved": {
        if (data.user_id) {
          pushRecipients = { user_ids: [data.user_id] };
        }
        pushTitle = "✅ Верификация одобрена";
        pushBody = "Ваш профиль успешно верифицирован!";
        pushUrl = "/cabinet";
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown event" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Send push notification
    const pushPromise = fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
      body: JSON.stringify({
        ...pushRecipients,
        title: pushTitle,
        body: pushBody,
        url: pushUrl,
        data: { event, ...data },
      }),
    }).catch((e) => console.error("Push error:", e));

    // Send Telegram notification if needed
    let telegramPromise: Promise<void> | null = null;
    if (telegramNotify?.phone) {
      telegramPromise = fetch(`${supabaseUrl}/functions/v1/telegram-client-bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
        body: JSON.stringify({
          action: "notify_by_phone",
          phone: telegramNotify.phone,
          message: telegramNotify.message,
        }),
      }).then(() => {}).catch((e) => console.error("Telegram error:", e));
    }

    await Promise.all([pushPromise, telegramPromise].filter(Boolean));

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Notify error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
