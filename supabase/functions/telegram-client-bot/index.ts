import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

interface TelegramMessage {
  message_id: number;
  from: { id: number; first_name: string; last_name?: string; username?: string };
  chat: { id: number; type: string };
  text?: string;
  contact?: { phone_number: string; first_name: string; user_id?: number };
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

async function sendTelegram(chatId: number, text: string, botToken: string, extra?: Record<string, unknown>) {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", ...extra }),
  });
}

// Get or create telegram user
async function getOrCreateUser(msg: TelegramMessage) {
  const { data: existing } = await supabaseAdmin
    .from("telegram_users")
    .select("*")
    .eq("telegram_id", msg.from.id)
    .maybeSingle();

  if (existing) return existing;

  const { data: created } = await supabaseAdmin
    .from("telegram_users")
    .insert({
      telegram_id: msg.from.id,
      chat_id: msg.chat.id,
      first_name: msg.from.first_name,
      last_name: msg.from.last_name || null,
      username: msg.from.username || null,
    })
    .select()
    .single();

  return created;
}

// Get or create active conversation
async function getActiveConversation(telegramUserId: string) {
  const { data: existing } = await supabaseAdmin
    .from("telegram_conversations")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data: created } = await supabaseAdmin
    .from("telegram_conversations")
    .insert({ telegram_user_id: telegramUserId })
    .select()
    .single();

  return created;
}

// Save message to DB
async function saveMessage(conversationId: string, role: string, content: string) {
  await supabaseAdmin.from("telegram_messages_log").insert({
    conversation_id: conversationId,
    role,
    content,
  });
  await supabaseAdmin
    .from("telegram_conversations")
    .update({ last_message_at: new Date().toISOString(), messages_count: undefined })
    .eq("id", conversationId);
  
  // Increment messages_count via raw increment
  try { await supabaseAdmin.rpc("increment_telegram_messages_count" as any, { conv_id: conversationId }); } catch { /* ignore */ }
}

// Get AI response
async function getAIResponse(conversationId: string, userMessage: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return "Сервис временно недоступен.";

  // Get chat settings
  const { data: settings } = await supabaseAdmin
    .from("chat_widget_settings")
    .select("system_prompt, knowledge_base")
    .limit(1)
    .single();

  // Get last 10 messages for context
  const { data: history } = await supabaseAdmin
    .from("telegram_messages_log")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(10);

  const messages = (history || []).reverse().map((m: any) => ({
    role: m.role === "bot" ? "assistant" : "user",
    content: m.content,
  }));
  messages.push({ role: "user", content: userMessage });

  let systemPrompt = settings?.system_prompt || "Ты — виртуальный помощник компании Домофондар.";
  systemPrompt += `\n\nВАЖНЫЕ ПРАВИЛА:
- Отвечай КРАТКО, максимум 2-3 предложения.
- Не используй markdown-разметку, пиши простым текстом.
- Ты работаешь в Telegram боте компании Домофондар.
- Помогай с вопросами об установке, ремонте и обслуживании домофонов, видеонаблюдения.

ПРИЁМ ЗАЯВОК:
- Ты можешь принимать заявки. Для заявки нужно: ФИО, телефон, адрес и описание проблемы.
- Когда все данные собраны, ответь РОВНО в формате: ЗАЯВКА|ФИО|телефон|адрес|описание
- Не добавляй ничего после этого формата.`;

  if (settings?.knowledge_base) {
    systemPrompt += `\n\nДополнительная информация:\n${settings.knowledge_base}`;
  }

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (!response.ok) return "Сервис временно недоступен. Попробуйте позже.";

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "Не удалось получить ответ.";
  } catch {
    return "Ошибка связи с сервисом.";
  }
}

// Process AI response - check if it's a request submission
async function processAIResponse(aiText: string): Promise<{ reply: string; requestCreated: boolean }> {
  if (aiText.startsWith("ЗАЯВКА|")) {
    const parts = aiText.split("|");
    if (parts.length >= 5) {
      const [, name, phone, address, message] = parts;
      const { error } = await supabaseAdmin.from("requests").insert({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        message: message.trim(),
        priority: "medium",
        status: "pending",
      });

      if (!error) {
        // Notify managers
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const { data: managerRoles } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .in("role", ["admin", "director", "dispatcher", "manager"]);

        if (managerRoles?.length) {
          await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
            body: JSON.stringify({
              user_ids: managerRoles.map((r: any) => r.user_id),
              title: "📱 Заявка из Telegram",
              body: `${name.trim()}: ${message.trim().substring(0, 100)}\n📍 ${address.trim()}\n📞 ${phone.trim()}`,
              url: "/fsm",
            }),
          }).catch(console.error);
        }

        return { reply: `✅ Ваша заявка принята!\n\n📋 Имя: ${name.trim()}\n📞 Телефон: ${phone.trim()}\n📍 Адрес: ${address.trim()}\n📝 ${message.trim()}\n\nМы свяжемся с вами в ближайшее время.`, requestCreated: true };
      }
      return { reply: "❌ Не удалось создать заявку. Попробуйте позже или позвоните нам.", requestCreated: false };
    }
  }
  return { reply: aiText, requestCreated: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!botToken) {
      return new Response(JSON.stringify({ error: "Bot token not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    
    // Handle webhook setup request
    if (body.action === "set_webhook") {
      const webhookUrl = body.webhook_url;
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const result = await resp.json();
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle send notification request (internal)
    if (body.action === "send_notification") {
      const { telegram_id, message: notifMessage } = body;
      const { data: tgUser } = await supabaseAdmin
        .from("telegram_users")
        .select("chat_id")
        .eq("telegram_id", telegram_id)
        .maybeSingle();

      if (tgUser) {
        await sendTelegram(tgUser.chat_id, notifMessage, botToken);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle send to all users with linked profile
    if (body.action === "notify_by_phone") {
      const { phone, message: notifMessage } = body;
      const { data: tgUsers } = await supabaseAdmin
        .from("telegram_users")
        .select("chat_id")
        .eq("phone", phone);

      if (tgUsers?.length) {
        for (const u of tgUsers) {
          await sendTelegram(u.chat_id, notifMessage, botToken);
        }
      }
      return new Response(JSON.stringify({ ok: true, sent: tgUsers?.length || 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process Telegram webhook update
    const update: TelegramUpdate = body;
    const message = update.message;
    if (!message || !message.text) {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chatId = message.chat.id;
    const text = message.text;

    // Get or create user
    const tgUser = await getOrCreateUser(message);
    if (!tgUser) {
      await sendTelegram(chatId, "Ошибка системы. Попробуйте позже.", botToken);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle /start
    if (text === "/start") {
      await sendTelegram(chatId, `Здравствуйте, ${message.from.first_name}! 👋

Я — бот компании <b>Домофондар</b>. Помогу с вопросами об установке и обслуживании домофонов, видеонаблюдения и систем контроля доступа.

Вы можете:
• Задать вопрос о наших услугах
• Оставить заявку на установку или ремонт
• Узнать статус вашей заявки

Просто напишите ваш вопрос! 💬`, botToken, {
        reply_markup: {
          keyboard: [
            [{ text: "📋 Оставить заявку" }],
            [{ text: "📞 Контакты" }, { text: "❓ Помощь" }],
            [{ text: "📱 Отправить номер телефона", request_contact: true }],
          ],
          resize_keyboard: true,
        },
      });
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle contact sharing
    if (message.contact) {
      await supabaseAdmin
        .from("telegram_users")
        .update({ phone: message.contact.phone_number })
        .eq("id", tgUser.id);
      
      await sendTelegram(chatId, `✅ Спасибо! Ваш номер ${message.contact.phone_number} сохранён.`, botToken);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle quick buttons
    if (text === "📞 Контакты") {
      await sendTelegram(chatId, `📞 <b>Контакты Домофондар</b>\n\n📱 +7 (XXX) XXX-XX-XX\n🌐 domofondar.kz\n📍 Казахстан`, botToken);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (text === "❓ Помощь") {
      await sendTelegram(chatId, `❓ <b>Как пользоваться ботом</b>\n\n• Напишите вопрос — я отвечу\n• Для заявки нажмите "📋 Оставить заявку"\n• Отправьте номер телефона для привязки аккаунта`, botToken);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get conversation and process with AI
    const conversation = await getActiveConversation(tgUser.id);
    if (!conversation) {
      await sendTelegram(chatId, "Ошибка системы. Попробуйте /start.", botToken);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save user message
    await saveMessage(conversation.id, "user", text);

    // Get AI response
    const aiResponse = await getAIResponse(conversation.id, text);
    const { reply } = await processAIResponse(aiResponse);

    // Save bot response
    await saveMessage(conversation.id, "bot", reply);

    // Send reply
    await sendTelegram(chatId, reply, botToken);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
