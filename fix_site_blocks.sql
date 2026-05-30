DROP TABLE IF EXISTS public.site_blocks CASCADE;

CREATE TABLE public.site_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page VARCHAR(255) NOT NULL,
    block_name VARCHAR(255) NOT NULL,
    content JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant permissions for API access
GRANT ALL ON TABLE public.site_blocks TO anon;
GRANT ALL ON TABLE public.site_blocks TO authenticated;

-- Reload schema cache in PostgREST
NOTIFY pgrst, 'reload schema';
