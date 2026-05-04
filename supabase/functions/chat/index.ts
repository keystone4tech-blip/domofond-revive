import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: any) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, tool_results, user_context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const ctx = user_context || { isAuthenticated: false, isVerified: false };
    const isFullAccess = !!(ctx.isAuthenticated && ctx.isVerified);

    // Handle tool execution requests from the client
    if (tool_results) {
      for (const toolCall of tool_results) {
        if (toolCall.name === "submit_request") {
          const args = toolCall.arguments;

          // Format period helper (used for debt info)
          const formatPeriodForRequest = (period: string | null | undefined): string => {
            if (!period) return "не указан";
            const months = ["", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
            const p = String(period).trim();
            if (/^\d{4}$/.test(p)) {
              const m = parseInt(p.substring(0, 2), 10);
              const y = "20" + p.substring(2);
              return `${months[m] || p.substring(0, 2)} ${y}`;
            }
            if (/^\d{1,2}$/.test(p)) {
              const m = parseInt(p, 10);
              return months[m] || p;
            }
            return p;
          };

          // Auto-check debt for the submitted address
          let debtInfo = "";
          let priority: string = "medium";
          try {
            const addr = args.address || "";
            // Extract apartment
            let apt = "";
            let cleanAddr = addr;
            const aptMatch = addr.match(/кв\.?\s*(\d+)/i);
            if (aptMatch) {
              apt = aptMatch[1];
              cleanAddr = addr.replace(/кв\.?\s*\d+/i, "").trim();
            }
            // Extract house
            let house = "";
            const hMatch = cleanAddr.match(/(?:д\.?\s*|дом\.?\s*)(\d+)/i);
            if (hMatch) {
              house = hMatch[1];
              cleanAddr = cleanAddr.replace(hMatch[0], "").trim();
            } else {
              const nMatch = cleanAddr.match(/\b(\d{1,4})\s*$/);
              if (nMatch) {
                house = nMatch[1];
                cleanAddr = cleanAddr.replace(nMatch[0], "").trim();
              }
            }

            let q = supabase.from("accounts").select("account_number, address, debt_amount, period");
            if (apt) q = q.or(`apartment.eq.${apt},address.ilike.%кв. ${apt}%`);
            if (house) q = q.ilike("address", `%д. ${house}%`);
            const streetWords = cleanAddr.replace(/[,.\-]/g, " ").split(/\s+/).filter((w: any) => w.length > 2 && !/^\d+$/.test(w));
            for (const w of streetWords) q = q.ilike("address", `%${w}%`);

            const { data: accs } = await q.order("period", { ascending: false }).limit(5);
            let acc = accs && accs.length > 0 ? accs[0] : null;
            if (acc && house) {
              const filtered = accs!.filter((a: any) => {
                const ad = (a.address || "").toLowerCase();
                const esc = house.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return new RegExp(`(?:д\\.?|дом|\\b)${esc}(?:\\b|[ ,]|$)`, "i").test(ad);
              });
              if (filtered.length > 0) acc = filtered[0];
            }

            if (acc && Number(acc.debt_amount) > 0) {
              debtInfo = `\n\n⚠️ ЗАДОЛЖЕННОСТЬ КЛИЕНТА:\n• Лицевой счёт: ${acc.account_number}\n• Сумма долга: ${acc.debt_amount} руб.\n• Период начисления: ${formatPeriodForRequest(acc.period)}\n• Адрес по счёту: ${acc.address}`;
              if (Number(acc.debt_amount) > 200) {
                debtInfo += `\n• Выезд платный (500 руб.) либо требуется погашение долга.`;
                priority = "high";
              }
            }
          } catch (debtErr) {
            console.error("Debt check on submit failed:", debtErr);
          }

          const fullMessage = `ФИО: ${args.name}\nТелефон: ${args.phone}\nАдрес: ${args.address}\n\nОписание: ${args.message}${debtInfo}`;

          const { error } = await supabase.from("requests").insert({
            name: args.name,
            phone: args.phone,
            address: args.address,
            message: fullMessage,
            priority,
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
                  message: fullMessage,
                },
              }),
            });
          } catch (pushError) {
            console.error("Notification error:", pushError);
          }

          return new Response(JSON.stringify({
            tool_response: {
              success: true,
              message: debtInfo
                ? "Заявка создана. Информация о задолженности приложена для мастера."
                : "Заявка успешно создана"
            }
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (toolCall.name === "check_account") {
          const args = toolCall.arguments;
          let addressInput = args.address || "";

          // SECURITY: Verified users may only see their own address. Override any other input.
          if (isFullAccess && ctx.address) {
            addressInput = ctx.address + (ctx.apartment ? ` кв. ${ctx.apartment}` : "");
            args.apartment = ctx.apartment || args.apartment;
          }

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

          // Format period MMYY → "Месяц YYYY"
          const formatPeriod = (period: string | null | undefined): string => {
            if (!period) return "не указан";
            const months = ["", "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
            const p = String(period).trim();
            if (/^\d{4}$/.test(p)) {
              const m = parseInt(p.substring(0, 2), 10);
              const y = "20" + p.substring(2);
              return `${months[m] || p.substring(0, 2)} ${y}`;
            }
            if (/^\d{1,2}$/.test(p)) {
              const m = parseInt(p, 10);
              return months[m] || p;
            }
            return p;
          };

          // Search by account number if input is purely numeric
          if (/^\d{5,}$/.test(addressInput.trim())) {
            const { data: byAccount } = await supabase
              .from("accounts")
              .select("account_number, address, debt_amount, period")
              .ilike("account_number", `%${addressInput.trim()}%`)
              .order("period", { ascending: false })
              .limit(1);
            if (byAccount && byAccount.length > 0) {
              return new Response(JSON.stringify({
                tool_response: {
                  success: true,
                  accounts: byAccount.map((acc: any) => ({
                    ...acc,
                    period: formatPeriod(acc.period),
                  })),
                }
              }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
          }

          // Build query
          let query = supabase.from("accounts").select("account_number, address, debt_amount, period");

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
            .filter((w: any) => w.length > 2 && !/^\d+$/.test(w));
          for (const word of streetWords) {
            query = query.ilike("address", `%${word}%`);
          }

          let { data, error } = await query.order("period", { ascending: false }).limit(20);

          if (error) {
            console.error("Account search error:", error);
            return new Response(JSON.stringify({
              tool_response: { success: false, error: "Ошибка поиска" }
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }

          // Дополнительная фильтрация по номеру дома в JS для точности
          if (data && houseNumber) {
            const filtered = data.filter((acc: any) => {
              const addr = (acc.address || "").toLowerCase();
              const escapedHN = houseNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
              const houseRegex = new RegExp(`(?:д\\.?|дом|\\b)${escapedHN}(?:\\b|[ ,]|$)`, "i");
              return houseRegex.test(addr);
            });
            if (filtered.length > 0) data = filtered;
          }

          // Оставляем только один результат (самый свежий)
          const finalResult = data && data.length > 0 ? [data[0]] : [];

          const mappedAccounts = finalResult.map((acc: any) => {
            const debt = Number(acc.debt_amount) || 0;
            if (isFullAccess) {
              return {
                account_number: acc.account_number,
                address: acc.address,
                debt_amount: debt,
                period: formatPeriod(acc.period),
                has_debt: debt > 0,
                debt_over_300: debt > 300,
              };
            }
            // Restricted: hide amount and period
            return {
              account_number: acc.account_number,
              address: acc.address,
              has_debt: debt > 0,
              debt_over_300: debt > 300,
              restricted: true,
            };
          });

          return new Response(JSON.stringify({
            tool_response: {
              success: true,
              accounts: mappedAccounts,
              user_authenticated: ctx.isAuthenticated,
              user_verified: ctx.isVerified,
              message: finalResult.length > 0
                ? "Найдено"
                : "Записи не найдены. Уточните адрес или номер дома."
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

    // Очищаем промпт от старых упоминаний тенге и опечаток
    systemPrompt = systemPrompt
      .replace(/тенге/g, "рублях")
      .replace(/ тг/g, " руб.")
      .replace(/выез /g, "выезд ")
      .replace(/html разметку/g, "разметку в формате Markdown [текст](ссылка)");

    systemPrompt += `\n\nВАЖНЫЕ ПРАВИЛА:
- Отвечай КРАТКО и ПО СУЩЕСТВУ, максимум 2-3 предложения.
- Не повторяй вопрос пользователя.
- Не добавляй лишнюю информацию, которую не спрашивали.
- Если вопрос простой — дай простой короткий ответ.
- Используй списки только если перечисляешь 3+ пунктов.
- Используй markdown-ссылки в формате [текст](url) когда даёшь ссылки.
- НЕ используй звёздочки для выделения (**текст**), пиши простым текстом.
- ВАЖНО: ВСЕГДА ПИШИ СУММЫ В РУБЛЯХ (РУБ.). НИКАКИХ ТЕНГЕ.
- Если поиск по адресу вернул несколько вариантов (что маловероятно), попроси пользователя уточнить номер дома, не выводи всё сразу.

КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ:
- Авторизован: ${ctx.isAuthenticated ? "ДА" : "НЕТ"}
- Верифицирован: ${ctx.isVerified ? "ДА" : "НЕТ"}
${ctx.fullName ? `- Имя: ${ctx.fullName}` : ""}
${ctx.address ? `- Адрес из профиля: ${ctx.address}${ctx.apartment ? `, кв. ${ctx.apartment}` : ""}` : ""}
${ctx.phone ? `- Телефон: ${ctx.phone}` : ""}

ПРИЁМ ЗАЯВОК:
- Ты можешь принимать заявки от пользователей на установку, ремонт или обслуживание.
- Для создания заявки тебе нужно собрать: ФИО, телефон, адрес и описание проблемы/услуги.
- Если пользователь авторизован — используй его данные из профиля и не спрашивай повторно.
- Перед созданием заявки проверяй пользователя на задолженность (функция check_account).

ЛИЦЕВЫЕ СЧЕТА И ЗАДОЛЖЕННОСТЬ — РАЗНОЕ ПОВЕДЕНИЕ:

${isFullAccess ? `РЕЖИМ ПОЛНОГО ДОСТУПА (пользователь верифицирован):
- Информация доступна ТОЛЬКО по адресу из профиля пользователя (${ctx.address || ""}${ctx.apartment ? `, кв. ${ctx.apartment}` : ""}).
- Если пользователь спрашивает про ДРУГОЙ адрес — вежливо откажи: "Я могу показать информацию только по вашему адресу из профиля. Для смены адреса обновите данные в [личном кабинете](/cabinet)."
- По своему адресу: показывай лицевой счёт, точную сумму задолженности или переплаты в рублях.
- Если задолженность больше 300 руб. — предупреди что выезд платный (500 руб.) либо нужно погасить долг.
- Если 0 — скажи что задолженности нет.`
: `РЕЖИМ ОГРАНИЧЕННОГО ДОСТУПА (пользователь НЕ авторизован или НЕ верифицирован):
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО называть точную сумму задолженности и период.
- Можно сообщить ТОЛЬКО: лицевой счёт и адрес.
- Если по счёту есть долг — предупреди о наличии задолженности БЕЗ суммы.
- Если поле debt_over_300 = true — предупреди что выезд будет платным (500 руб.) либо предложи сначала оплатить задолженность по указанному лицевому счёту.
- Если debt_over_300 = false но есть долг — попроси оплатить в ближайшее время.
- ${ctx.isAuthenticated ? "Предложи пройти верификацию в [личном кабинете](/cabinet) для просмотра полной информации." : "Если нашёл лицевой счёт по адресу — предложи [зарегистрироваться в личном кабинете](/auth) для полного взаимодействия с компанией: видеть точную сумму, период, оплачивать онлайн."}
- НЕ упоминай поле "Период" вообще.`}

- Показывай ТОЛЬКО ОДИН результат — самый свежий.`;

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
