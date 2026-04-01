
-- Grant permissions for calculations table
GRANT INSERT ON public.calculations TO anon;
GRANT INSERT ON public.calculations TO authenticated;
GRANT SELECT ON public.calculations TO authenticated;
GRANT DELETE ON public.calculations TO authenticated;

-- Grant permissions for accounts table
GRANT ALL ON public.accounts TO authenticated;
GRANT SELECT ON public.accounts TO anon;
