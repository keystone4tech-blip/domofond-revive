-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create promotions table
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active promotions"
  ON public.promotions
  FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert promotions"
  ON public.promotions
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update promotions"
  ON public.promotions
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete promotions"
  ON public.promotions
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Create news table
CREATE TABLE public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  image_url TEXT,
  video_url TEXT,
  is_published BOOLEAN DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published news"
  ON public.news
  FOR SELECT
  USING (is_published = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert news"
  ON public.news
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update news"
  ON public.news
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete news"
  ON public.news
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Create site_blocks table
CREATE TABLE public.site_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page TEXT NOT NULL,
  block_name TEXT NOT NULL,
  content JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(page, block_name)
);

ALTER TABLE public.site_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active blocks"
  ON public.site_blocks
  FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage blocks"
  ON public.site_blocks
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_news_updated_at
  BEFORE UPDATE ON public.news
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_site_blocks_updated_at
  BEFORE UPDATE ON public.site_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('promotions', 'promotions', true);

INSERT INTO storage.buckets (id, name, public) 
VALUES ('news', 'news', true);

-- Storage policies for promotions
CREATE POLICY "Anyone can view promotion images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'promotions');

CREATE POLICY "Admins can upload promotion images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'promotions' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update promotion images"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'promotions' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete promotion images"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'promotions' AND public.has_role(auth.uid(), 'admin'));

-- Storage policies for news
CREATE POLICY "Anyone can view news media"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'news');

CREATE POLICY "Admins can upload news media"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'news' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update news media"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'news' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete news media"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'news' AND public.has_role(auth.uid(), 'admin'));