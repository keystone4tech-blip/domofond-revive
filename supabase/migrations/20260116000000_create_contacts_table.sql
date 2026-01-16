-- Create contacts table for storing form submissions
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on contacts table
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Policy: Managers and admins can view all contacts
CREATE POLICY "Managers can view contacts"
  ON public.contacts
  FOR SELECT
  USING (public.is_manager(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

-- Policy: Anyone can insert contacts (for form submissions)
CREATE POLICY "Anyone can submit contact form"
  ON public.contacts
  FOR INSERT
  WITH CHECK (true);

-- Function to handle contact form submissions via Telegram bot
CREATE OR REPLACE FUNCTION public.send_contact_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  message_text TEXT;
BEGIN
  -- Format notification message
  message_text := 'Новая заявка от клиента!\n\n' ||
                  'Имя: ' || NEW.name || '\n' ||
                  'Телефон: ' || NEW.phone || '\n' ||
                  'Адрес: ' || NEW.address || '\n' ||
                  'Сообщение: ' || NEW.message || '\n' ||
                  'Дата: ' || NEW.created_at;

  -- Call Telegram bot function if it exists
  IF to_regproc('public.send_telegram_message') IS NOT NULL THEN
    PERFORM public.send_telegram_message(message_text);
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger to send notification on new contact form submission
CREATE TRIGGER on_contact_submitted
  AFTER INSERT ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.send_contact_notification();