-- Deliver invalidation hints only after commit; never publish order or buyer data.
CREATE FUNCTION public.notify_catalog_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('training2_catalog', 'changed');
  RETURN NULL;
END;
$$;
CREATE TRIGGER catalog_changed AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH STATEMENT EXECUTE FUNCTION public.notify_catalog_change();
