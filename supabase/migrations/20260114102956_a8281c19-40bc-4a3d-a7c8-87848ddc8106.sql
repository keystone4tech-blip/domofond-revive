-- Drop existing SELECT policy
DROP POLICY IF EXISTS "FSM users can view relevant tasks" ON public.tasks;

-- Create new policy that allows all FSM users to view all tasks
CREATE POLICY "FSM users can view all tasks" ON public.tasks
FOR SELECT USING (
  has_fsm_role(auth.uid())
);