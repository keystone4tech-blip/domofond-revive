import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, tool_results } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle tool execution requests from the client
    if (tool_results) {
      for (const toolCall of tool_results) {
        if (toolCall.name === "submit_request") {
          const args = toolCall.arguments;
          const { error } = await supabase.from("requests").insert({
            name: args.name,
            phone: args.phone,
            address: args.address,
            message: args.message,
            priority: "medium",
            status: "pending",
          });
          if (error) {
            console.error("Failed to insert request:", error);
            return new Response(JSON.stringify({
              tool_response: { success: false, error: "Не удалось создать заявку" }
            }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Send notification via unified notify function
          try {
            await fetch(`${supabaseUrl}/functions/v1/notify`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${supabaseKey}` },
              body: JSON.stringify({
                event: "request_created",
                data: {
                  name: args.name,
                  phone: args.phone,
                  address: args.address,
                  message: args.message,
                },
              }),
            });
          } catch (pushError) {
            console.error("Notification error:", pushError);
          }

          return new Response(JSON.stringify({
            tool_response: { success: true, message: "Заявка успешно создана" }
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (toolCall.name === "check_account") {
          const args = toolCall.arguments;
          const addressInput = args.address || "";

          // Extract apartment number
          let apartment = args.apartment;
          let cleanAddress = addressInput;
          if (!apartment) {
            const aptMatch = addressInput.match(/кв\.?\s*(\d+)/i);
            if (aptMatch) {
              apartment = aptMatch[1];
              cleanAddress = addressInput.replace(/кв\.?\s*\d+/i, "").trim();
            }
          }

          // Extract house number (д. N or just a standalone number)
          let houseNumber = "";
          const houseMatch = cleanAddress.match(/(?:д\.?\s*|дом\.?\s*)(\d+)/i);
          if (houseMatch) {
            houseNumber = houseMatch[1];
            cleanAddress = cleanAddress.replace(houseMatch[0], "").trim();
          } else {
            // Try standalone number at the end
            const numMatch = cleanAddress.match(/\b(\d{1,4})\s*$/);
            if (numMatch) {
              houseNumber = numMatch[1];
              cleanAddress = cleanAddress.replace(numMatch[0], "").trim();
            }
          }

          // Search by account number if input is purely numeric
          if (/^\d{5,}$/.test(addressInput.trim())) {
            const { data: byAccount } = await supabase
              .from("accounts")
              .select("account_number, address, debt_amount")
              .ilike("account_number", `%${addressInput.trim()}%`)
              .order("period", { ascending: false })
              .limit(1);
            if (byAccount && byAccount.length > 0) {
              return new Response(JSON.stringify({
                tool_response: { success: true, accounts: byAccount }
              }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
          }

          // Build query
          let query = supabase.from("accounts").select("account_number, address, debt_amount");

          // Filter by apartment
          if (apartment) {
            query = query.or(`apartment.eq.${apartment},address.ilike.%кв. ${apartment}%`);
          }

          // Filter by house number
          if (houseNumber) {
            query = query.ilike("address", `%д. ${houseNumber}%`);
          }

          // Filter by street keywords (words > 2 chars, not numbers)
          const streetWords = cleanAddress
            .replace(/[,.\-]/g, " ")
            .split(/\s+/)
            .filter(w => w.length > 2 && !/^\d+$/.test(w));
          for (const word of streetWords) {
            query = query.ilike("address", `%${word}%`);
          }

          const { data, error } = await query.order("period", { ascending: false }).limit(1);

          if (error) {
            console.error("Account search error:", error);
            return new Response(JSON.stringify({
              tool_response: { success: false, error: "Ошибка поиска" }
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          return new Response(JSON.stringify({
            tool_response: {
              success: true,
              accounts: data || [],
              message: data && data.length > 0
                ? "Найдено"
                : "Записи не найдены. Уточните адрес или номер квартиры."
            }
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    const { data: settings } = await supabase
      .from("chat_widget_settings")
      .select("system_prompt, knowledge_base, is_active")
      .limit(1)
      .single();

    if (!settings?.is_active) {
      return new Response(JSON.stringify({ error: "Чат временно недоступен" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt = settings.system_prompt || "Ты — виртуальный помощник.";

    systemPrompt += `\n\nВАЖНЫЕ ПРАВИЛА:
- Отвечай КРАТКО и ПО СУЩЕСТВУ, максимум 2-3 предложения.
- Не повторяй вопрос пользователя.
- Не добавляй лишнюю информацию, которую не спрашивали.
- Если вопрос простой — дай простой короткий ответ.
- Используй списки только если перечисляешь 3+ пунктов.
- Используй markdown-ссылки в формате [текст](url) когда даёшь ссылки.
- НЕ используй звёздочки для выделения (**текст**), пиши простым текстом.

ПРИЁМ ЗАЯВОК:
- Ты можешь принимать заявки от пользователей на установку, ремонт или обслуживание.
- Для создания заявки тебе нужно собрать: ФИО, телефон, адрес и описание проблемы/услуги.
- Если пользователь хочет оставить заявку, спроси недостающие данные.
- Проверяй пользователя на задолженность, и если есть задолженность более 200 рублей попроси оплатить отправив лицевой счет и сумму задолженности, иначе стоимось вызова мастера будет стоить 500 рублей. — вызови функцию check_account.
- Если задолженность меньше 200 рублей — попроси оплатить в ближайшее время и отправь лицевой счет и задолженность.
- Уточняй у пользователя создать заявку с платным выездом мастера? Или они оплатят задолженость и вызов мастера будет бесплатным.
- Когда все данные собраны, вызови функцию submit_request.
- После успешной отправки подтверди пользователю что заявка принята.

ЛИЦЕВЫЕ СЧЕТА И ЗАДОЛЖЕННОСТЬ:
- Если пользователь спрашивает про задолженность, лицевой счёт, оплату — вызови функцию check_account.
- Нужно уточнить адрес или номер квартиры для поиска.
- После получения данных — покажи ТОЛЬКО: Лицевой счёт, Адрес и Сумму задолженности.
- Сумму пиши в рублях (полностью "рублей", НЕ "руб").
- НЕ показывай поле "Период".
- Показывай только ОДИН результат — самый подходящий.
- Если задолженность 0 — скажи что задолженности нет.`;

    if (settings.knowledge_base) {
      systemPrompt += `\n\nДополнительная информация для ответов:\n${settings.knowledge_base}`;
    }

    const tools = [
      {
        type: "function",
        function: {
          name: "submit_request",
          description: "Отправить заявку клиента на установку, ремонт или обслуживание. Используй когда пользователь предоставил все данные: имя, телефон, адрес и описание.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "ФИО клиента" },
              phone: { type: "string", description: "Номер телефона клиента" },
              address: { type: "string", description: "Адрес клиента" },
              message: { type: "string", description: "Описание проблемы или нужной услуги" },
            },
            required: ["name", "phone", "address", "message"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "check_account",
          description: "Проверить лицевой счёт и задолженность по адресу или номеру квартиры. Используй когда пользователь спрашивает про задолженность, оплату, лицевой счёт.",
          parameters: {
            type: "object",
            properties: {
              address: { type: "string", description: "Адрес или часть адреса (улица, дом)" },
              apartment: { type: "string", description: "Номер квартиры" },
            },
            required: [],
          },
        },
      },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Слишком много запросов. Попробуйте позже." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Сервис временно недоступен." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Ошибка AI сервиса" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
