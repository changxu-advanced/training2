INSERT INTO public.products(id, code, name, description, price_jpy, stock) VALUES
  ('10000000-0000-4000-8000-000000000001', 'DEMO-001', '练习用笔记本', '用于本地开发的示例商品', 500, 20),
  ('10000000-0000-4000-8000-000000000002', 'DEMO-002', '练习用马克杯', '用于验证库存不足场景', 1200, 1)
ON CONFLICT DO NOTHING;
