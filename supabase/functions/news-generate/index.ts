import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Settings {
  id: string;
  is_enabled: boolean;
  publish_mode: "auto" | "review" | "mixed";
  news_source: "gemini_grounding" | "perplexity" | "firecrawl";
  image_strategy: "ai_generate" | "stock_photos" | "mixed" | "none";
  photo_source: "unsplash" | "pexels";
  region: string;
  ai_model: string;
  posts_per_run: number;
  brand_pitch: string;
  topics: string[];
}

interface Segment {
  slug: string;
  name: string;
  description: string;
  tone: string;
  pain_points: string;
  cta_style: string;
  weight: number;
  publish_mode: "auto" | "review" | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY не настроен");

    // Параметры (можно переопределить из body для ручного запуска)
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch (_) {
      // пустое тело — ОК
    }
    const forceSegment = (body?.segment_slug as string) || null;
    const forceTopic = (body?.topic as string) || null;
    const forceCount = body?.count as number | undefined;
    const dryRun = body?.dry_run === true;

    // Загрузка настроек
    const { data: settings } = await supabase
      .from("news_automation_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (!settings) throw new Error("Настройки авто-новостей не найдены");
    const cfg = settings as Settings;

    if (!cfg.is_enabled && !dryRun && !forceSegment) {
      return json({ success: false, message: "Авто-новости выключены" });
    }

    // Загрузка сегментов
    const { data: segmentsRaw } = await supabase
      .from("news_segments")
      .select("*")
      .eq("is_active", true);
    const segments = (segmentsRaw || []) as Segment[];
    if (!segments.length) throw new Error("Нет активных сегментов");

    const count = Math.min(forceCount ?? cfg.posts_per_run ?? 1, 5);
    const results: Array<{ ok: boolean; draft_id?: string; error?: string; title?: string }> = [];

    for (let i = 0; i < count; i++) {
      try {
        // 1. Выбираем сегмент
        const segment = forceSegment
          ? segments.find((s) => s.slug === forceSegment) || pickWeighted(segments)
          : pickWeighted(segments);

        // 2. Выбираем тему
        const topic = forceTopic || cfg.topics[Math.floor(Math.random() * cfg.topics.length)];

        // 3. Сбор фактов из источника
        const research = await gatherNews({ source: cfg.news_source, topic, region: cfg.region, lovableKey: LOVABLE_API_KEY });

        // 4. Генерация поста под сегмент
        const post = await generatePost({
          model: cfg.ai_model,
          lovableKey: LOVABLE_API_KEY,
          research,
          topic,
          region: cfg.region,
          segment,
          brandPitch: cfg.brand_pitch,
        });

        // 5. Картинка
        let imageUrl: string | null = null;
        let imagePrompt: string | null = null;
        if (cfg.image_strategy !== "none") {
          const strategy = resolveImageStrategy(cfg.image_strategy, segment);
          const imgResult = await fetchImage({
            strategy,
            photoSource: cfg.photo_source,
            topic,
            post,
            lovableKey: LOVABLE_API_KEY,
            supabase,
          });
          imageUrl = imgResult.url;
          imagePrompt = imgResult.prompt;
        }

        // 6. Решение: автопубликация или черновик
        const segmentMode = segment.publish_mode;
        const effectiveMode =
          cfg.publish_mode === "mixed"
            ? segmentMode || "review"
            : cfg.publish_mode;
        const shouldAutoPublish = effectiveMode === "auto" && !dryRun;

        if (dryRun) {
          results.push({ ok: true, title: post.title });
          continue;
        }

        // Сохраняем как черновик (всегда), если auto — сразу публикуем
        const { data: draft, error: dErr } = await supabase
          .from("news_drafts")
          .insert({
            title: post.title,
            excerpt: post.excerpt,
            content: post.content,
            image_url: imageUrl,
            image_prompt: imagePrompt,
            segment_slug: segment.slug,
            source_urls: research.sources,
            raw_research: research.text.slice(0, 5000),
            ai_model: cfg.ai_model,
            status: shouldAutoPublish ? "approved" : "pending",
          })
          .select()
          .single();
        if (dErr) throw new Error(`Сохранение черновика: ${dErr.message}`);

        if (shouldAutoPublish) {
          const { data: news, error: nErr } = await supabase
            .from("news")
            .insert({
              title: post.title,
              content: post.content,
              excerpt: post.excerpt,
              image_url: imageUrl,
              is_published: true,
              published_at: new Date().toISOString(),
              segment_slug: segment.slug,
              is_auto_generated: true,
              source_urls: research.sources,
              seo_keywords: post.keywords,
            })
            .select()
            .single();
          if (nErr) throw new Error(`Публикация: ${nErr.message}`);
          await supabase
            .from("news_drafts")
            .update({ status: "published", published_news_id: news.id, reviewed_at: new Date().toISOString() })
            .eq("id", draft.id);
        }

        results.push({ ok: true, draft_id: draft.id, title: post.title });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Ошибка генерации:", msg);
        results.push({ ok: false, error: msg });
      }
    }

    // Обновим last_run_at
    if (!dryRun) {
      await supabase
        .from("news_automation_settings")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", cfg.id);
    }

    return json({ success: true, results });
  } catch (e) {
    console.error("news-generate error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + (i.weight || 1), 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.weight || 1;
    if (r <= 0) return it;
  }
  return items[0];
}

function resolveImageStrategy(
  strat: Settings["image_strategy"],
  _segment: Segment,
): "ai_generate" | "stock_photos" {
  if (strat === "mixed") return Math.random() < 0.5 ? "ai_generate" : "stock_photos";
  if (strat === "stock_photos") return "stock_photos";
  return "ai_generate";
}

// =================== ИСТОЧНИКИ НОВОСТЕЙ ===================
async function gatherNews(opts: {
  source: Settings["news_source"];
  topic: string;
  region: string;
  lovableKey: string;
}): Promise<{ text: string; sources: string[] }> {
  const { source, topic, region, lovableKey } = opts;

  if (source === "perplexity") {
    const key = Deno.env.get("PERPLEXITY_API_KEY");
    if (!key) {
      console.warn("PERPLEXITY_API_KEY не настроен, fallback на gemini_grounding");
      return gatherViaGemini(topic, region, lovableKey);
    }
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: "Ты — журналист, ищущий свежие, местные новости и факты." },
          {
            role: "user",
            content: `Найди 2-3 свежих факта/события за последние 30 дней по теме "${topic}" в регионе ${region}. Также общие тренды отрасли. Кратко, с источниками.`,
          },
        ],
        search_recency_filter: "month",
      }),
    });
    if (!res.ok) {
      console.warn("Perplexity fail:", res.status);
      return gatherViaGemini(topic, region, lovableKey);
    }
    const j = await res.json();
    const text = j?.choices?.[0]?.message?.content || "";
    const sources = (j?.citations || []) as string[];
    return { text, sources };
  }

  if (source === "firecrawl") {
    const key = Deno.env.get("FIRECRAWL_API_KEY");
    if (!key) {
      console.warn("FIRECRAWL_API_KEY не настроен, fallback");
      return gatherViaGemini(topic, region, lovableKey);
    }
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `${topic} ${region} новости 2025 2026`,
        limit: 5,
        tbs: "qdr:m",
        scrapeOptions: { formats: ["markdown"] },
      }),
    });
    if (!res.ok) return gatherViaGemini(topic, region, lovableKey);
    const j = await res.json();
    const items = (j?.data || []) as Array<{ url: string; title: string; markdown?: string; description?: string }>;
    const text = items
      .map((it) => `### ${it.title}\n${it.url}\n${(it.markdown || it.description || "").slice(0, 800)}`)
      .join("\n\n");
    return { text, sources: items.map((i) => i.url) };
  }

  return gatherViaGemini(topic, region, lovableKey);
}

async function gatherViaGemini(topic: string, region: string, lovableKey: string) {
  // У Lovable AI gateway нет явного web grounding — используем модель как research-агента
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "Ты — эксперт по безопасности, домофонам и видеонаблюдению. Опиши актуальные тренды и типичные кейсы из практики.",
        },
        {
          role: "user",
          content: `Опиши 2-3 актуальные ситуации/тренда по теме "${topic}" применительно к региону ${region}. Включи: реальные проблемы жильцов и УК, технологические новинки, изменения в нормативах. Используй свои общие знания (без выдуманных фактов и без конкретных дат/цифр, если не уверен).`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Lovable AI research fail [${res.status}]: ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  return { text: j?.choices?.[0]?.message?.content || "", sources: [] as string[] };
}

// =================== ГЕНЕРАЦИЯ ПОСТА ===================
async function generatePost(opts: {
  model: string;
  lovableKey: string;
  research: { text: string; sources: string[] };
  topic: string;
  region: string;
  segment: Segment;
  brandPitch: string;
}): Promise<{ title: string; excerpt: string; content: string; keywords: string[] }> {
  const { model, lovableKey, research, topic, region, segment, brandPitch } = opts;

  const systemPrompt = `Ты — SEO-копирайтер компании Домофондар (Краснодар).
Твоя задача — написать рекламно-полезный пост для блога компании.

ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА:
1. Пост ВСЕГДА завершается коммерческим предложением от Домофондар
2. Упоминай "Домофондар" минимум 2 раза по тексту
3. Адаптируй стиль под целевой сегмент
4. Используй SEO-ключи естественно
5. Никаких выдуманных дат, цифр, конкретных адресов
6. Длина основного текста: 350-600 слов
7. Структура: цепляющий заголовок → проблема → анализ → решение от Домофондар → CTA
8. Региональная привязка: ${region}

КОМПАНИЯ: ${brandPitch}

ЦЕЛЕВОЙ СЕГМЕНТ: ${segment.name}
- Тон: ${segment.tone}
- Боли аудитории: ${segment.pain_points}
- Стиль призыва к действию: ${segment.cta_style}`;

  const userPrompt = `ТЕМА: ${topic}

ИСХОДНЫЕ ФАКТЫ/ТРЕНДЫ ДЛЯ ОПОРЫ:
${research.text}

Напиши SEO-оптимизированный пост для сегмента "${segment.name}". Верни через инструмент output_post.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "output_post",
            description: "Возвращает структурированный пост для блога",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "SEO-заголовок 50-70 символов с ключевым словом" },
                excerpt: { type: "string", description: "Анонс 150-200 символов для карточки и meta-description" },
                content: { type: "string", description: "Полный текст в Markdown с заголовками ## и списками" },
                keywords: {
                  type: "array",
                  items: { type: "string" },
                  description: "5-8 SEO-ключей которые использованы в тексте",
                },
                image_prompt: {
                  type: "string",
                  description:
                    "Подробный prompt на английском для генерации картинки или поиска фото в стоке (тематика домофоны/видеонаблюдение/безопасность ЖК Краснодара)",
                },
              },
              required: ["title", "excerpt", "content", "keywords", "image_prompt"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "output_post" } },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Превышен лимит AI-запросов. Попробуйте позже.");
    if (res.status === 402) throw new Error("Закончились кредиты Lovable AI. Пополните в Settings → Workspace → Usage.");
    throw new Error(`AI Gateway [${res.status}]: ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  const tc = j?.choices?.[0]?.message?.tool_calls?.[0];
  if (!tc) throw new Error("AI не вернул структурированный пост");
  const args = JSON.parse(tc.function.arguments);
  // Сохраним image_prompt чтобы потом использовать
  return {
    title: args.title,
    excerpt: args.excerpt,
    content: args.content,
    keywords: args.keywords || [],
    // image_prompt передаётся отдельно через возвращаемое значение fetchImage
    // @ts-ignore — добавляем для удобства
    image_prompt: args.image_prompt,
  } as never;
}

// =================== КАРТИНКИ ===================
async function fetchImage(opts: {
  strategy: "ai_generate" | "stock_photos";
  photoSource: "unsplash" | "pexels";
  topic: string;
  post: { title: string; image_prompt?: string };
  lovableKey: string;
  supabase: any;
}): Promise<{ url: string | null; prompt: string }> {
  const { strategy, photoSource, topic, post, lovableKey, supabase } = opts;
  const prompt = (post as unknown as { image_prompt?: string }).image_prompt || `${topic}, security, intercom, Krasnodar`;

  if (strategy === "stock_photos") {
    const url = await fetchStockPhoto(photoSource, prompt, topic);
    if (url) return { url, prompt };
    // fallback к AI если не нашли
  }

  // AI generation
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: `Photorealistic image: ${prompt}. Modern, professional, security/intercom theme. No text overlays. 16:9 aspect.`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      console.warn("AI image fail:", res.status, t.slice(0, 200));
      return { url: null, prompt };
    }
    const j = await res.json();
    const dataUrl = j?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl) return { url: null, prompt };

    // Загружаем в storage
    const uploaded = await uploadDataUrlToStorage(supabase, dataUrl, "news");
    return { url: uploaded, prompt };
  } catch (e) {
    console.error("AI image gen error:", e);
    return { url: null, prompt };
  }
}

async function fetchStockPhoto(
  source: "unsplash" | "pexels",
  prompt: string,
  topic: string,
): Promise<string | null> {
  const query = encodeURIComponent(`${topic} security intercom`);

  if (source === "unsplash") {
    const key = Deno.env.get("UNSPLASH_ACCESS_KEY");
    if (key) {
      const r = await fetch(
        `https://api.unsplash.com/search/photos?query=${query}&per_page=5&orientation=landscape`,
        { headers: { Authorization: `Client-ID ${key}` } },
      );
      if (r.ok) {
        const j = await r.json();
        const arr = j?.results || [];
        const pick = arr[Math.floor(Math.random() * arr.length)];
        return pick?.urls?.regular || null;
      }
    }
    // Бесплатный source endpoint без ключа
    return `https://source.unsplash.com/1600x900/?${query}`;
  }

  if (source === "pexels") {
    const key = Deno.env.get("PEXELS_API_KEY");
    if (!key) return null;
    const r = await fetch(`https://api.pexels.com/v1/search?query=${query}&per_page=5&orientation=landscape`, {
      headers: { Authorization: key },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const arr = j?.photos || [];
    const pick = arr[Math.floor(Math.random() * arr.length)];
    return pick?.src?.large || null;
  }
  return null;
}

async function uploadDataUrlToStorage(
  supabase: ReturnType<typeof createClient>,
  dataUrl: string,
  bucket: string,
): Promise<string | null> {
  try {
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
    if (!match) return null;
    const mime = match[1];
    const ext = mime.split("/")[1];
    const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    const path = `auto/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (error) {
      console.error("Storage upload error:", error);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || null;
  } catch (e) {
    console.error("uploadDataUrlToStorage:", e);
    return null;
  }
}
