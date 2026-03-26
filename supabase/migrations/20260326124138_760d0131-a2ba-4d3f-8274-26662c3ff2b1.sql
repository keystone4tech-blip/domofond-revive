
CREATE OR REPLACE FUNCTION public.increment_telegram_messages_count(conv_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE telegram_conversations
  SET messages_count = messages_count + 1,
      last_message_at = now()
  WHERE id = conv_id;
$$;
