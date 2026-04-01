
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT INSERT ON TABLE public.calculations TO anon;
GRANT INSERT ON TABLE public.calculations TO authenticated;
GRANT SELECT ON TABLE public.calculations TO authenticated;
GRANT DELETE ON TABLE public.calculations TO authenticated;
GRANT ALL ON TABLE public.accounts TO authenticated;
GRANT SELECT ON TABLE public.accounts TO anon;
