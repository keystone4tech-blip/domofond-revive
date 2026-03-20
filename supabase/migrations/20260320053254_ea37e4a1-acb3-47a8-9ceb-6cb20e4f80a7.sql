
-- Table for AI chat widget configuration
CREATE TABLE public.chat_widget_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  system_prompt text NOT NULL DEFAULT 'Ты — виртуальный помощник компании Домофондар. Помогай пользователям с вопросами об установке, ремонте и обслуживании домофонов, видеонаблюдения и систем контроля доступа.',
  welcome_message text NOT NULL DEFAULT 'Здравствуйте! 👋 Я виртуальный помощник Домофондар. Чем могу помочь?',
  knowledge_base text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.chat_widget_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read active settings (for the widget)
CREATE POLICY "Anyone can view active chat settings"
ON public.chat_widget_settings FOR SELECT
USING (true);

-- Only admins can manage settings
CREATE POLICY "Admins can update chat settings"
ON public.chat_widget_settings FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert chat settings"
ON public.chat_widget_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete chat settings"
ON public.chat_widget_settings FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default row
INSERT INTO public.chat_widget_settings (system_prompt, welcome_message, knowledge_base)
VALUES (
  'Ты — виртуальный помощник компании Домофондар. Отвечай на русском языке. Помогай пользователям с вопросами об установке, ремонте и обслуживании домофонов, видеонаблюдения и систем контроля доступа. Будь вежливым, компетентным и полезным. Если не знаешь точного ответа, предложи связаться с менеджером по телефону +7 (903) 411-83-93.',
  'Здравствуйте! 👋 Я виртуальный помощник Домофондар. Чем могу помочь?',
  'Компания Домофондар работает с 2005 года в Краснодаре. Адрес: г. Краснодар, проезд Репина 1, 2 этаж, офис 134. Телефон: +7 (903) 411-83-93. Email: domofondar@mail.ru. Услуги: установка домофонов, видеонаблюдение, шлагбаумы и СКУД, ремонт и диагностика, техническое обслуживание. Выезд мастера в течение 2 часов. Гарантия на все работы до 3 лет.'
);
