-- 1. Глобальные настройки SEO
CREATE TABLE public.seo_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_apply BOOLEAN NOT NULL DEFAULT false,
  ai_model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  brand_context TEXT DEFAULT 'Домофондар — компания по установке, обслуживанию и ремонту домофонов, видеонаблюдения и систем контроля доступа. Работаем в Краснодаре.',
  schedule_cron TEXT DEFAULT '0 3 * * 1',
  optimize_meta BOOLEAN NOT NULL DEFAULT true,
  optimize_content BOOLEAN NOT NULL DEFAULT true,
  optimize_alt BOOLEAN NOT NULL DEFAULT true,
  optimize_jsonld BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.seo_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view seo settings"
  ON public.seo_settings FOR SELECT
  USING (true);

CREATE POLICY "Admin console can manage seo settings"
  ON public.seo_settings FOR ALL
  USING (has_admin_console_access(auth.uid()))
  WITH CHECK (has_admin_console_access(auth.uid()));

-- Дефолтная запись настроек
INSERT INTO public.seo_settings (is_enabled, auto_apply) VALUES (false, false);

-- 2. Ключевые слова по страницам
CREATE TABLE public.seo_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_path TEXT NOT NULL,
  keyword TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(page_path, keyword)
);

CREATE INDEX idx_seo_keywords_page ON public.seo_keywords(page_path);

ALTER TABLE public.seo_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active keywords"
  ON public.seo_keywords FOR SELECT
  USING (is_active = true OR has_admin_console_access(auth.uid()));

CREATE POLICY "Admin console can manage keywords"
  ON public.seo_keywords FOR ALL
  USING (has_admin_console_access(auth.uid()))
  WITH CHECK (has_admin_console_access(auth.uid()));

-- 3. Текущие meta-теги страниц
CREATE TABLE public.seo_page_meta (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_path TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  keywords TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  canonical_url TEXT,
  json_ld JSONB,
  h1 TEXT,
  is_auto_managed BOOLEAN NOT NULL DEFAULT true,
  last_optimized_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_page_meta_path ON public.seo_page_meta(page_path);

ALTER TABLE public.seo_page_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view page meta"
  ON public.seo_page_meta FOR SELECT
  USING (true);

CREATE POLICY "Admin console can manage page meta"
  ON public.seo_page_meta FOR ALL
  USING (has_admin_console_access(auth.uid()))
  WITH CHECK (has_admin_console_access(auth.uid()));

-- 4. Очередь предложений от AI
CREATE TABLE public.seo_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_path TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  field_name TEXT NOT NULL,
  before_value TEXT,
  after_value TEXT NOT NULL,
  reasoning TEXT,
  keywords_used TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  ai_model TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  applied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_suggestions_status ON public.seo_suggestions(status);
CREATE INDEX idx_seo_suggestions_page ON public.seo_suggestions(page_path);

ALTER TABLE public.seo_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin console can manage suggestions"
  ON public.seo_suggestions FOR ALL
  USING (has_admin_console_access(auth.uid()))
  WITH CHECK (has_admin_console_access(auth.uid()));

-- 5. История применённых изменений (для отката)
CREATE TABLE public.seo_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  suggestion_id UUID REFERENCES public.seo_suggestions(id) ON DELETE SET NULL,
  page_path TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  field_name TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  applied_by UUID,
  is_rolled_back BOOLEAN NOT NULL DEFAULT false,
  rolled_back_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_seo_history_page ON public.seo_history(page_path);

ALTER TABLE public.seo_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin console can view history"
  ON public.seo_history FOR SELECT
  USING (has_admin_console_access(auth.uid()));

CREATE POLICY "Admin console can manage history"
  ON public.seo_history FOR INSERT
  WITH CHECK (has_admin_console_access(auth.uid()));

CREATE POLICY "Admin console can update history"
  ON public.seo_history FOR UPDATE
  USING (has_admin_console_access(auth.uid()))
  WITH CHECK (has_admin_console_access(auth.uid()));

-- Триггеры обновления updated_at
CREATE TRIGGER update_seo_settings_updated_at
  BEFORE UPDATE ON public.seo_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_seo_page_meta_updated_at
  BEFORE UPDATE ON public.seo_page_meta
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();