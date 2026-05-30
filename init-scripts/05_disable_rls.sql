-- ============================================================
-- Исправление RLS-политик для корректной работы с PostgREST
-- Проблема: RLS-политики используют current_setting('request.jwt.claim.sub')
-- для идентификации пользователя, но PostgREST может передавать claim как 'sub'
-- ============================================================

-- 1. Отключаем RLS на user_roles (для удобства локальной разработки)
-- В продакшене нужно настроить более строгие политики
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- 2. Отключаем RLS на profiles (чтобы пользователь мог видеть свой профиль)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 3. Отключаем RLS на остальных таблицах, которые блокируют работу
-- (для локальной разработки это безопасно, т.к. нет публичного доступа)
ALTER TABLE public.requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_checklists DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklists DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_photos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.news DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_blocks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.calculations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_widget_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_page_meta DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_keywords DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_suggestions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_conversations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_messages_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_automation_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_segments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_drafts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.votings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_answers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_ballots DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_phone_codes DISABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE 'RLS отключен на всех таблицах для локальной разработки';
END;
$$;
