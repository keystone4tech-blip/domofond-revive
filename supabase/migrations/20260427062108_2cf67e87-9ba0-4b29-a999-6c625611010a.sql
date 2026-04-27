
-- ============ МОДУЛЬ ГОЛОСОВАНИЙ СОБСТВЕННИКОВ ============

-- Голосование (ОСС или опрос)
CREATE TABLE public.votings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  voting_type TEXT NOT NULL DEFAULT 'survey', -- 'oss' | 'survey'
  building_address TEXT NOT NULL,             -- адрес дома, по которому голосование
  initiator_name TEXT,                        -- инициатор (для ОСС)
  initiator_apartment TEXT,
  legal_basis TEXT,                           -- ссылка на ст. ЖК РФ для ОСС
  total_apartments INTEGER,                   -- всего квартир в доме (для кворума ОСС)
  total_area_sqm NUMERIC,                     -- общая площадь жилых помещений
  quorum_percent NUMERIC NOT NULL DEFAULT 50, -- требуемый кворум
  pass_threshold_percent NUMERIC NOT NULL DEFAULT 50, -- порог принятия решения
  status TEXT NOT NULL DEFAULT 'draft',       -- draft | active | finished | cancelled
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Вопросы голосования
CREATE TABLE public.voting_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voting_id UUID NOT NULL REFERENCES public.votings(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  -- варианты ответа: всегда За/Против/Воздержался для ОСС, для опроса — кастомные
  options JSONB NOT NULL DEFAULT '["За","Против","Воздержался"]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Бюллетень (один на голосующего на голосование)
CREATE TABLE public.voting_ballots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voting_id UUID NOT NULL REFERENCES public.votings(id) ON DELETE CASCADE,
  voter_full_name TEXT NOT NULL,
  voter_phone TEXT NOT NULL,
  voter_apartment TEXT NOT NULL,
  voter_area_sqm NUMERIC,                  -- площадь квартиры (для подсчёта голосов в %)
  is_owner_confirmed BOOLEAN NOT NULL DEFAULT false, -- галочка «являюсь собственником»
  ownership_doc_url TEXT,                   -- опциональная выписка ЕГРН
  phone_verified_at TIMESTAMPTZ,            -- момент успешного SMS-подтверждения
  ip_address TEXT,
  user_agent TEXT,
  user_id UUID,                             -- если авторизован
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (voting_id, voter_phone, voter_apartment)
);

-- Ответы на вопросы в бюллетене
CREATE TABLE public.voting_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ballot_id UUID NOT NULL REFERENCES public.voting_ballots(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.voting_questions(id) ON DELETE CASCADE,
  selected_option TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ballot_id, question_id)
);

-- SMS-коды для подтверждения телефона
CREATE TABLE public.voting_phone_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voting_id UUID NOT NULL REFERENCES public.votings(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индексы
CREATE INDEX idx_voting_questions_voting ON public.voting_questions(voting_id);
CREATE INDEX idx_voting_ballots_voting ON public.voting_ballots(voting_id);
CREATE INDEX idx_voting_answers_ballot ON public.voting_answers(ballot_id);
CREATE INDEX idx_voting_phone_codes_phone ON public.voting_phone_codes(voting_id, phone);

-- Триггеры updated_at
CREATE TRIGGER trg_votings_updated_at
  BEFORE UPDATE ON public.votings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============ RLS ============
ALTER TABLE public.votings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voting_phone_codes ENABLE ROW LEVEL SECURITY;

-- VOTINGS: все могут видеть активные/завершённые; админ всё
CREATE POLICY "Public can view non-draft votings"
ON public.votings FOR SELECT
USING (status <> 'draft' OR has_admin_console_access(auth.uid()));

CREATE POLICY "Admin console manages votings"
ON public.votings FOR ALL
USING (has_admin_console_access(auth.uid()))
WITH CHECK (has_admin_console_access(auth.uid()));

-- QUESTIONS: видны если видно голосование; админ управляет
CREATE POLICY "Public can view questions of visible votings"
ON public.voting_questions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.votings v
    WHERE v.id = voting_id
      AND (v.status <> 'draft' OR has_admin_console_access(auth.uid()))
  )
);

CREATE POLICY "Admin console manages questions"
ON public.voting_questions FOR ALL
USING (has_admin_console_access(auth.uid()))
WITH CHECK (has_admin_console_access(auth.uid()));

-- BALLOTS: вставлять может любой (после прохождения SMS-проверки, проверяется в edge-функции);
-- читать — только администрация + сам голосующий по своему user_id
CREATE POLICY "Anyone can insert ballot"
ON public.voting_ballots FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admin can view all ballots"
ON public.voting_ballots FOR SELECT
USING (has_admin_console_access(auth.uid()));

CREATE POLICY "Owner can view own ballot"
ON public.voting_ballots FOR SELECT
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Admin can update ballot"
ON public.voting_ballots FOR UPDATE
USING (has_admin_console_access(auth.uid()));

-- ANSWERS: вставка вместе с бюллетенем; чтение — админ + владелец бюллетеня
CREATE POLICY "Anyone can insert answers"
ON public.voting_answers FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admin can view answers"
ON public.voting_answers FOR SELECT
USING (has_admin_console_access(auth.uid()));

CREATE POLICY "Owner can view own answers"
ON public.voting_answers FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.voting_ballots b
    WHERE b.id = ballot_id AND b.user_id = auth.uid()
  )
);

-- PHONE CODES: служебная таблица, никто из клиентов напрямую не читает
CREATE POLICY "Admin can view phone codes"
ON public.voting_phone_codes FOR SELECT
USING (has_admin_console_access(auth.uid()));

CREATE POLICY "Anyone can insert phone code request"
ON public.voting_phone_codes FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update phone code (verify)"
ON public.voting_phone_codes FOR UPDATE
USING (true)
WITH CHECK (true);
