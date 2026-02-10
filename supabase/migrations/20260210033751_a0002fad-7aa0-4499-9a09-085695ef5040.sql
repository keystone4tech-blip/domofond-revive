-- Enable realtime for profiles table only (tasks and requests already added)
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;