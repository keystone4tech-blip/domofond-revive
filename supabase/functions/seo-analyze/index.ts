import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PageContext {
  page_path: string;
  current_meta: any;
  keywords: string[];
  content_blocks: Array<{ id: string; block_name: string; content: any }>;
}

const PAGES = [
  { path: "/", title: "Главная" },
  { path: "/domofony", title: "Домофоны" },
  { path: "/videonablyudenie", title: "Видеонаблюдение" },
  { path: "/smart-intercom", title: "Умный домофон" },
  { path: "/nashi-raboty", title: "Наши работы" },
  { path: "/voprosy", title: "Вопросы" },
  { path: "/kontakty", title: "Контакты" },
  { path: "/calculator", title: "Калькулятор" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const targetPaths: string[] = body.pages || PAGES.map((p) => p.path);

    // Загружаем настройки
    const { data: settings } = await supabase
      .from("seo_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!settings || !settings.is_enabled) {
      return new Response(
        JSON.stringify({ error: "SEO система отключена. Включите её в настройках." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not set");

    const allSuggestions: any[] = [];
    let totalCreated = 0;

    for (const pagePath of targetPaths) {
      // Собираем контекст страницы
      const { data: meta } = await supabase
        .from("seo_page_meta")
        .select("*")
        .eq("page_path", pagePath)
        .maybeSingle();

      const { data: keywords } = await supabase
        .from("seo_keywords")
        .select("keyword, priority")
        .eq("page_path", pagePath)
        .eq("is_active", true)
        .order("priority", { ascending: false });

      const pageKey = pagePath === "/" ? "index" : pagePath.replace(/^\//, "");
      const { data: blocks } = await supabase
        .from("site_blocks")
        .select("id, block_name, content")
        .eq("page", pageKey)
        .eq("is_active", true);

      const context: PageContext = {
        page_path: pagePath,
        current_meta: meta || {},
        keywords: (keywords || []).map((k: any) => k.keyword),
        content_blocks: blocks || [],
      };

      // Запрос к AI
      const systemPrompt = `Ты — эксперт по SEO для русскоязычных сайтов. Твоя задача — оптимизировать meta-теги, заголовки и тексты сайта компании.

КОНТЕКСТ БРЕНДА:
${settings.brand_context || "Компания по обслуживанию домофонов"}

ПРАВИЛА:
- Title: до 60 символов, с ключевым словом в начале
- Description: до 160 символов, с призывом к действию
- H1: один на странице, с главным ключом
- Тексты: естественные, без переспама ключевыми словами
- Сохраняй смысл и тон оригинала
- Используй русский язык
- Если ключевые слова заданы админом — используй их в первую очередь
- Также предложи 3-5 LSI-фраз/синонимов как дополнительные ключи

Отвечай СТРОГО в JSON формате.`;

      const userPrompt = `Страница: ${pagePath}
Целевые ключевые слова: ${context.keywords.length > 0 ? context.keywords.join(", ") : "(не заданы — определи сам по контенту)"}

Текущие meta-теги:
${JSON.stringify(context.current_meta, null, 2)}

Текущие блоки контента:
${JSON.stringify(context.content_blocks.map((b) => ({ name: b.block_name, content: b.content })), null, 2)}

Предложи улучшения для:
${settings.optimize_meta ? "- title, description, og_title, og_description, keywords (meta)\n" : ""}${settings.optimize_content ? "- H1 заголовок, тексты блоков (поля title/text/heading в content)\n" : ""}${settings.optimize_jsonld ? "- JSON-LD структурированные данные (Schema.org)\n" : ""}${settings.optimize_alt ? "- предложения alt-тегов для изображений (если упоминаются)\n" : ""}

Для каждого изменения объясни кратко, почему оно улучшает SEO.`;

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: settings.ai_model || "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "seo_suggestions",
                description: "Предложения по SEO-оптимизации страницы",
                parameters: {
                  type: "object",
                  properties: {
                    suggested_keywords: {
                      type: "array",
                      items: { type: "string" },
                      description: "LSI-фразы и синонимы для расширения семантики",
                    },
                    meta_changes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          field: { type: "string", enum: ["title", "description", "keywords", "og_title", "og_description", "h1"] },
                          new_value: { type: "string" },
                          reasoning: { type: "string" },
                        },
                        required: ["field", "new_value", "reasoning"],
                      },
                    },
                    block_changes: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          block_id: { type: "string" },
                          field_path: { type: "string", description: "Поле в content, например title, text, description" },
                          new_value: { type: "string" },
                          reasoning: { type: "string" },
                        },
                        required: ["block_id", "field_path", "new_value", "reasoning"],
                      },
                    },
                    json_ld: {
                      type: "object",
                      description: "Schema.org JSON-LD объект для страницы",
                    },
                    json_ld_reasoning: { type: "string" },
                  },
                  required: ["meta_changes"],
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "seo_suggestions" } },
        }),
      });

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Превышен лимит запросов AI. Попробуйте позже." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "Закончились кредиты Lovable AI. Пополните баланс." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        const errText = await aiResponse.text();
        console.error(`AI error for ${pagePath}:`, aiResponse.status, errText);
        continue;
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        console.error(`No tool call for ${pagePath}`);
        continue;
      }

      const args = JSON.parse(toolCall.function.arguments);

      // Сохраняем предложения
      const suggestionsToInsert: any[] = [];

      // Meta изменения
      for (const ch of args.meta_changes || []) {
        const before = ch.field === "h1" ? meta?.h1 : meta?.[ch.field];
        if (before === ch.new_value) continue;
        suggestionsToInsert.push({
          page_path: pagePath,
          target_type: ch.field === "h1" ? "page_h1" : "page_meta",
          target_id: null,
          field_name: ch.field,
          before_value: before || null,
          after_value: ch.new_value,
          reasoning: ch.reasoning,
          keywords_used: context.keywords,
          status: "pending",
          ai_model: settings.ai_model,
        });
      }

      // Изменения блоков
      for (const ch of args.block_changes || []) {
        const block = blocks?.find((b: any) => b.id === ch.block_id);
        const before = block?.content?.[ch.field_path];
        if (before === ch.new_value) continue;
        suggestionsToInsert.push({
          page_path: pagePath,
          target_type: "site_block",
          target_id: ch.block_id,
          field_name: ch.field_path,
          before_value: typeof before === "string" ? before : JSON.stringify(before),
          after_value: ch.new_value,
          reasoning: ch.reasoning,
          keywords_used: context.keywords,
          status: "pending",
          ai_model: settings.ai_model,
        });
      }

      // JSON-LD
      if (args.json_ld && settings.optimize_jsonld) {
        const beforeLd = meta?.json_ld ? JSON.stringify(meta.json_ld) : null;
        const afterLd = JSON.stringify(args.json_ld);
        if (beforeLd !== afterLd) {
          suggestionsToInsert.push({
            page_path: pagePath,
            target_type: "page_meta",
            target_id: null,
            field_name: "json_ld",
            before_value: beforeLd,
            after_value: afterLd,
            reasoning: args.json_ld_reasoning || "Структурированные данные Schema.org",
            keywords_used: context.keywords,
            status: "pending",
            ai_model: settings.ai_model,
          });
        }
      }

      // AI-предложенные ключи
      if (args.suggested_keywords?.length) {
        for (const kw of args.suggested_keywords) {
          await supabase.from("seo_keywords").upsert(
            {
              page_path: pagePath,
              keyword: kw,
              source: "ai",
              priority: 0,
              is_active: true,
            },
            { onConflict: "page_path,keyword", ignoreDuplicates: true },
          );
        }
      }

      if (suggestionsToInsert.length > 0) {
        const { data: inserted, error: insErr } = await supabase
          .from("seo_suggestions")
          .insert(suggestionsToInsert)
          .select();
        if (insErr) {
          console.error("Insert error:", insErr);
        } else {
          totalCreated += inserted?.length || 0;
          allSuggestions.push(...(inserted || []));
        }
      }
    }

    // Обновляем last_run_at
    await supabase
      .from("seo_settings")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", settings.id);

    return new Response(
      JSON.stringify({
        success: true,
        total_suggestions: totalCreated,
        pages_analyzed: targetPaths.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("seo-analyze error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
