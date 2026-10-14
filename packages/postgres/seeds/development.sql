INSERT INTO public.products(id, code, name, description, price_jpy, stock) VALUES
  ('10000000-0000-4000-8000-000000000001', 'DEMO-001', 'サンプルノート', 'ローカル開発用のサンプル商品', 500, 20),
  ('10000000-0000-4000-8000-000000000002', 'DEMO-002', 'サンプルマグカップ', '在庫不足の検証用サンプル商品', 1200, 1)
ON CONFLICT DO NOTHING;
