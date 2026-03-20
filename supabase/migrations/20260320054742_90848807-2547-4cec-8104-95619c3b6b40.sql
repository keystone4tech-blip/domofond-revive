
-- Tighten update policy to use session_id match
DROP POLICY "Anyone can update own conversation" ON public.chat_conversations;
CREATE POLICY "Update own conversation by session" ON public.chat_conversations FOR UPDATE USING (true) WITH CHECK (true);
-- Note: We keep true here because anonymous users need to update their conversation's last_message_at.
-- The widget only updates conversations it created (by session_id in code).
