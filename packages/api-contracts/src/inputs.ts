import { z } from "zod";
export const productInput = z.strictObject({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{1,32}$/),
  name: z
    .string()
    .trim()
    .regex(/^[\s\S]{1,100}$/u),
  description: z
    .string()
    .regex(/^[\s\S]{0,2000}$/u)
    .default(""),
  priceJpy: z.number().int().min(0).max(100000000),
  stock: z.number().int().min(0).max(1000000),
});
export const orderInput = z.strictObject({
  items: z
    .array(
      z.strictObject({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1).max(1000),
      }),
    )
    .min(1)
    .max(50),
});
export const restockInput = z.strictObject({
  quantity: z.number().int().min(1).max(2000),
});
export type ProductInput = z.infer<typeof productInput>;
export type OrderInput = z.infer<typeof orderInput>;
