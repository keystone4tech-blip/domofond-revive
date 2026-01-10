-- Добавляем поля для записи кто и когда принял задачу
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES public.employees(id),
ADD COLUMN IF NOT EXISTS accepted_at timestamp with time zone;