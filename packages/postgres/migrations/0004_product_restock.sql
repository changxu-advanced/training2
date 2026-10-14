CREATE TABLE public.product_restocks (
 owner_sub text NOT NULL CHECK (char_length(owner_sub) BETWEEN 1 AND 255),
 idempotency_key uuid NOT NULL,
 product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
 quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (owner_sub, idempotency_key)
);
