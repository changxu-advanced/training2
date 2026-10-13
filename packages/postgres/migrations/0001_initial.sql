CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TYPE public.order_status AS ENUM ('draft', 'confirmed', 'cancelled');

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text COLLATE "C" NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_jpy bigint NOT NULL,
  stock integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT products_code_format CHECK (code ~ '^[A-Z0-9_-]{1,32}$'),
  CONSTRAINT products_name_length CHECK (char_length(name) BETWEEN 1 AND 100 AND name = btrim(name)),
  CONSTRAINT products_description_length CHECK (char_length(description) <= 2000),
  CONSTRAINT products_price_range CHECK (price_jpy BETWEEN 0 AND 100000000),
  CONSTRAINT products_stock_range CHECK (stock BETWEEN 0 AND 1000000)
);
CREATE INDEX products_name_search_idx ON public.products USING gin (lower(name) gin_trgm_ops);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_sub text NOT NULL,
  idempotency_key uuid NOT NULL,
  request_items jsonb NOT NULL,
  status public.order_status NOT NULL DEFAULT 'draft',
  total_jpy bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  CONSTRAINT orders_owner_key_unique UNIQUE (owner_sub, idempotency_key),
  CONSTRAINT orders_owner_length CHECK (char_length(owner_sub) BETWEEN 1 AND 255 AND owner_sub = btrim(owner_sub)),
  CONSTRAINT orders_request_items_shape CHECK (CASE WHEN jsonb_typeof(request_items) = 'array' THEN jsonb_array_length(request_items) BETWEEN 1 AND 50 ELSE false END),
  CONSTRAINT orders_total_range CHECK (total_jpy BETWEEN 0 AND 5000000000000),
  CONSTRAINT orders_status_timestamps CHECK (
    (status = 'draft' AND confirmed_at IS NULL AND cancelled_at IS NULL)
    OR (status = 'confirmed' AND confirmed_at IS NOT NULL AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
  ),
  CONSTRAINT orders_timestamp_order CHECK (
    (confirmed_at IS NULL OR confirmed_at >= created_at)
    AND (cancelled_at IS NULL OR cancelled_at >= created_at)
    AND (confirmed_at IS NULL OR cancelled_at IS NULL OR cancelled_at >= confirmed_at)
  )
);
CREATE INDEX orders_owner_created_idx ON public.orders (owner_sub, created_at DESC, id);

CREATE TABLE public.order_items (
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_code text COLLATE "C" NOT NULL,
  product_name text NOT NULL,
  unit_price_jpy bigint NOT NULL,
  quantity integer NOT NULL,
  PRIMARY KEY (order_id, product_id),
  CONSTRAINT order_items_code_format CHECK (product_code ~ '^[A-Z0-9_-]{1,32}$'),
  CONSTRAINT order_items_name_length CHECK (char_length(product_name) BETWEEN 1 AND 100 AND product_name = btrim(product_name)),
  CONSTRAINT order_items_price_range CHECK (unit_price_jpy BETWEEN 0 AND 100000000),
  CONSTRAINT order_items_quantity_range CHECK (quantity BETWEEN 1 AND 1000)
);
CREATE INDEX order_items_product_idx ON public.order_items (product_id);

CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
