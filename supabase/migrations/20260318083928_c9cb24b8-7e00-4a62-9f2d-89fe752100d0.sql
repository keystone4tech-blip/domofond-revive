
CREATE TABLE public.calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  entrances integer NOT NULL DEFAULT 1,
  total_apartments integer NOT NULL DEFAULT 100,
  smart_intercoms integer NOT NULL DEFAULT 1,
  additional_cameras integer NOT NULL DEFAULT 0,
  elevator_cameras integer NOT NULL DEFAULT 0,
  gates integer NOT NULL DEFAULT 0,
  tariff_per_apt numeric DEFAULT 0,
  tariff_details jsonb DEFAULT '{}'::jsonb,
  is_individual boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.calculations ENABLE ROW LEVEL SECURITY;

-- Anyone can insert calculations (public form)
CREATE POLICY "Anyone can insert calculations"
  ON public.calculations FOR INSERT
  WITH CHECK (true);

-- Admins/managers can view all
CREATE POLICY "Managers can view calculations"
  ON public.calculations FOR SELECT
  USING (is_manager(auth.uid()));

-- Admins can delete
CREATE POLICY "Managers can delete calculations"
  ON public.calculations FOR DELETE
  USING (is_manager(auth.uid()));
