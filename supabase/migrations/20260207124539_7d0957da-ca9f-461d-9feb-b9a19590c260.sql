-- Create request_checklists table
CREATE TABLE public.request_checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  item_text TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create request_history table for tracking all actions
CREATE TABLE public.request_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  description TEXT,
  performed_by UUID REFERENCES public.employees(id),
  performed_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.request_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for request_checklists
CREATE POLICY "FSM users can view request checklists" 
ON public.request_checklists FOR SELECT 
USING (has_fsm_role(auth.uid()));

CREATE POLICY "FSM users can manage request checklists" 
ON public.request_checklists FOR INSERT 
WITH CHECK (has_fsm_role(auth.uid()));

CREATE POLICY "FSM users can update request checklists" 
ON public.request_checklists FOR UPDATE 
USING (has_fsm_role(auth.uid()));

CREATE POLICY "FSM users can delete request checklists" 
ON public.request_checklists FOR DELETE 
USING (has_fsm_role(auth.uid()));

-- RLS Policies for request_history
CREATE POLICY "FSM users can view request history" 
ON public.request_history FOR SELECT 
USING (has_fsm_role(auth.uid()));

CREATE POLICY "FSM users can add history entries" 
ON public.request_history FOR INSERT 
WITH CHECK (has_fsm_role(auth.uid()));