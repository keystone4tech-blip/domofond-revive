-- Create requests table for storing client requests/service calls
CREATE TABLE public.requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    phone text NOT NULL,
    address text NOT NULL,
    message text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    priority text NOT NULL DEFAULT 'medium',
    assigned_to uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    accepted_by uuid REFERENCES public.employees(id) ON DELETE SET NULL,
    accepted_at timestamp with time zone,
    completed_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create products table for services/materials pricing
CREATE TABLE public.products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL DEFAULT 0,
    unit text DEFAULT 'шт',
    category text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create request_items table for products added to requests
CREATE TABLE public.request_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity numeric(10,2) NOT NULL DEFAULT 1,
    price numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for requests
CREATE POLICY "Anyone can insert requests"
ON public.requests FOR INSERT
WITH CHECK (true);

CREATE POLICY "FSM users can view all requests"
ON public.requests FOR SELECT
USING (has_fsm_role(auth.uid()));

CREATE POLICY "FSM users can update requests"
ON public.requests FOR UPDATE
USING (has_fsm_role(auth.uid()));

CREATE POLICY "Managers can delete requests"
ON public.requests FOR DELETE
USING (is_manager(auth.uid()));

-- RLS Policies for products
CREATE POLICY "Anyone can view active products"
ON public.products FOR SELECT
USING (is_active = true OR has_fsm_role(auth.uid()));

CREATE POLICY "FSM users can manage products"
ON public.products FOR INSERT
WITH CHECK (has_fsm_role(auth.uid()));

CREATE POLICY "FSM users can update products"
ON public.products FOR UPDATE
USING (has_fsm_role(auth.uid()));

CREATE POLICY "Managers can delete products"
ON public.products FOR DELETE
USING (is_manager(auth.uid()));

-- RLS Policies for request_items
CREATE POLICY "FSM users can view request items"
ON public.request_items FOR SELECT
USING (has_fsm_role(auth.uid()));

CREATE POLICY "FSM users can manage request items"
ON public.request_items FOR INSERT
WITH CHECK (has_fsm_role(auth.uid()));

CREATE POLICY "FSM users can update request items"
ON public.request_items FOR UPDATE
USING (has_fsm_role(auth.uid()));

CREATE POLICY "FSM users can delete request items"
ON public.request_items FOR DELETE
USING (has_fsm_role(auth.uid()));

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_requests_updated_at
    BEFORE UPDATE ON public.requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON public.products
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();