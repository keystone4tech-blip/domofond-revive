-- 1. Глобальные настройки авто-постинга
CREATE TABLE IF NOT EXISTS public.news_automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  publish_mode TEXT NOT NULL DEFAULT 'review' CHECK (publish_mode IN ('auto', 'review', 'mixed')),
  -- Источник новостей: gemini_grounding (бесплатно), perplexity, firecrawl
  news_source TEXT NOT NULL DEFAULT 'gemini_grounding' CHECK (news_source IN ('gemini_grounding', 'perplexity', 'firecrawl')),
  -- Стратегия картинок: ai_generate, stock_photos, mixed
  image_strategy TEXT NOT NULL DEFAULT 'ai_generate' CHECK (image_strategy IN ('ai_generate', 'stock_photos', 'mixed', 'none')),
  -- Источник фото если stock: unsplash, pexels
  photo_source TEXT NOT NULL DEFAULT 'unsplash' CHECK (photo_source IN ('unsplash', 'pexels')),
  region TEXT NOT NULL DEFAULT 'Краснодар, Краснодарский край',
  ai_model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  posts_per_run INTEGER NOT NULL DEFAULT 1 CHECK (posts_per_run BETWEEN 1 AND 10),
  schedule_cron TEXT DEFAULT '0 9 * * *',
  brand_pitch TEXT DEFAULT 'Домофондар — лидер в Краснодаре по установке и обслуживанию домофонов, видеонаблюдения и систем контроля доступа. Работаем с управляющими компаниями, ЖК и частными домами. Гарантия качества, выездные мастера, 24/7 поддержка.',
  topics TEXT[] DEFAULT ARRAY['домофоны', 'умные домофоны', 'видеонаблюдение', 'системы контроля доступа', 'безопасность ЖК', 'управляющие компании Краснодар']::text[],
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.news_automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin console manages news settings"
ON public.news_automation_settings
FOR ALL
USING (has_admin_console_access(auth.uid()))
WITH CHECK (has_admin_console_access(auth.uid()));

CREATE POLICY "Anyone can view news settings"
ON public.news_automation_settings
FOR SELECT
USING (true);

-- 2. Сегменты аудитории
CREATE TABLE IF NOT EXISTS public.news_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  tone TEXT NOT NULL,
  pain_points TEXT,
  cta_style TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  weight INTEGER NOT NULL DEFAULT 1,
  publish_mode TEXT DEFAULT NULL CHECK (publish_mode IS NULL OR publish_mode IN ('auto', 'review')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.news_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin console manages segments"
ON public.news_segments
FOR ALL
USING (has_admin_console_access(auth.uid()))
WITH CHECK (has_admin_console_access(auth.uid()));

CREATE POLICY "Anyone can view active segments"
ON public.news_segments
FOR SELECT
USING (is_active = true OR has_admin_console_access(auth.uid()));

-- 3. Черновики авто-новостей (требующие подтверждения)
CREATE TABLE IF NOT EXISTS public.news_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  image_url TEXT,
  image_prompt TEXT,
  segment_slug TEXT,
  source_urls TEXT[],
  raw_research TEXT,
  ai_model TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'published', 'failed')),
  scheduled_for TIMESTAMPTZ,
  published_news_id UUID REFERENCES public.news(id) ON DELETE SET NULL,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.news_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin console manages drafts"
ON public.news_drafts
FOR ALL
USING (has_admin_console_access(auth.uid()))
WITH CHECK (has_admin_console_access(auth.uid()));

-- 4. Расширение news
ALTER TABLE public.news
  ADD COLUMN IF NOT EXISTS segment_slug TEXT,
  ADD COLUMN IF NOT EXISTS is_auto_generated BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_urls TEXT[],
  ADD COLUMN IF NOT EXISTS seo_keywords TEXT[];

-- 5. Индексы
CREATE INDEX IF NOT EXISTS idx_news_drafts_status ON public.news_drafts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_drafts_scheduled ON public.news_drafts(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_news_segment ON public.news(segment_slug);

-- 6. Триггеры updated_at
CREATE TRIGGER trg_news_settings_updated
BEFORE UPDATE ON public.news_automation_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_news_segments_updated
BEFORE UPDATE ON public.news_segments
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER trg_news_drafts_updated
BEFORE UPDATE ON public.news_drafts
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. Стартовые данные
INSERT INTO public.news_automation_settings (is_enabled, publish_mode)
SELECT false, 'review'
WHERE NOT EXISTS (SELECT 1 FROM public.news_automation_settings);

INSERT INTO public.news_segments (slug, name, description, tone, pain_points, cta_style, weight)
VALUES
  (
    'premium_zhk',
    'Премиум-ЖК и бизнес-класс',
    'Жители элитных комплексов, ценящие технологии и статус',
    'Премиальный, экспертный, технологичный. Подчёркивать инновации, эксклюзивность, smart-функции',
    'Безопасность семьи, защита от посторонних, удобство для гостей, интеграция с умным домом',
    'Записаться на консультацию инженера / Получить индивидуальное предложение',
    3
  ),
  (
    'econom_zhk',
    'Эконом-ЖК и хрущёвки',
    'Жители обычных домов, чувствительные к цене',
    'Дружелюбный, простой, практичный. Без сложных терминов. Акцент на надёжность и доступность',
    'Чужие в подъезде, поломанные домофоны, дорогой ремонт, риск кражи',
    'Узнать цену рассрочки / Заменить старый домофон со скидкой',
    3
  ),
  (
    'managing_companies',
    'Управляющие компании Краснодара',
    'Руководители УК, которым важна экономия, отчётность и надёжность',
    'Деловой, B2B, конкретный. Цифры, кейсы, экономия, гарантии',
    'Жалобы жильцов, частые поломки, перерасход бюджета, отчёты для собрания',
    'Запросить КП для УК / Бесплатный аудит подъездов',
    3
  ),
  (
    'private_houses',
    'Частные дома и коттеджи',
    'Владельцы частных домов и КП',
    'Уверенный, защитный. Акцент на периметр, дальность, ночное видение',
    'Воровство, проникновение, дикие животные, контроль работников',
    'Выезд инженера на замер бесплатно / Подобрать камеры под мой участок',
    2
  )
ON CONFLICT (slug) DO NOTHING;