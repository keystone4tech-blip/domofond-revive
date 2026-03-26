
-- Table for Telegram bot users (clients)
CREATE TABLE public.telegram_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint UNIQUE NOT NULL,
  chat_id bigint NOT NULL,
  first_name text,
  last_name text,
  username text,
  phone text,
  linked_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table for Telegram conversations
CREATE TABLE public.telegram_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id uuid REFERENCES public.telegram_users(id) ON DELETE CASCADE NOT NULL,
  started_at timestamptz DEFAULT now(),
  last_message_at timestamptz DEFAULT now(),
  messages_count integer DEFAULT 0,
  status text DEFAULT 'active'
);

-- Table for Telegram messages history
CREATE TABLE public.telegram_messages_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES public.telegram_conversations(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_messages_log ENABLE ROW LEVEL SECURITY;

-- RLS policies - only managers can view
CREATE POLICY "Managers can view telegram users" ON public.telegram_users
  FOR SELECT TO authenticated USING (is_manager(auth.uid()));

CREATE POLICY "Managers can view telegram conversations" ON public.telegram_conversations
  FOR SELECT TO authenticated USING (is_manager(auth.uid()));

CREATE POLICY "Managers can view telegram messages" ON public.telegram_messages_log
  FOR SELECT TO authenticated USING (is_manager(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER set_telegram_users_updated_at
  BEFORE UPDATE ON public.telegram_users
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
