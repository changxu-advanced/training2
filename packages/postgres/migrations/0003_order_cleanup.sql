ALTER TABLE public.orders ADD COLUMN deleted_at timestamptz;
ALTER TABLE public.orders ADD CONSTRAINT orders_deleted_cancelled CHECK (deleted_at IS NULL OR status = 'cancelled');
CREATE INDEX orders_visible_owner_created_idx ON public.orders (owner_sub, created_at DESC, id DESC) WHERE deleted_at IS NULL;
