-- Add is_approved column to comments table
ALTER TABLE public.comments ADD COLUMN is_approved BOOLEAN DEFAULT false;

-- Update RLS policies for comments
DROP POLICY IF EXISTS "Anyone can view comments" ON public.comments;

-- Regular users see only approved comments, admins see all
CREATE POLICY "Users can view approved comments"
ON public.comments
FOR SELECT
USING (
  is_approved = true 
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Update insert policy to set is_approved to false by default
DROP POLICY IF EXISTS "Authenticated users can add comments" ON public.comments;

CREATE POLICY "Authenticated users can add comments"
ON public.comments
FOR INSERT
WITH CHECK (
  auth.uid() = user_id 
  AND is_approved = false
);

-- Admins can update comments (for approval/rejection)
CREATE POLICY "Admins can update comments"
ON public.comments
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));