<script setup lang="ts">
import {apiMessage} from "../helpers.ts";
import { useMutation } from "@tanstack/vue-query";
import { orderInput } from "@training2/api-contracts/inputs";
import { ref } from "vue";
import { draft, useRuntime } from "../context.ts";

const runtime = useRuntime();
const validation = ref("");
const mutation = useMutation({
  mutationFn: () => {
    const body = orderInput.parse({
      items: draft.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      })),
    });
    if(new Set(body.items.map(i=>i.productId.toLowerCase())).size!==body.items.length)throw new Error("Duplicate products");
    draft.key ||= crypto.randomUUID();
    return runtime.publicClient.createOrder({
      body,
      headers: { "idempotency-key": draft.key },
    });
  },
  onSuccess: async (order) => {
    runtime.queryClient.setQueryData(["order",order.id],order);
    draft.items = [];
    draft.key = "";
    await runtime.router.push(`/orders/${order.id}`);
  },
});
function submit() {
  if(mutation.isPending.value)return;
  const parsed = orderInput.safeParse({
    items: draft.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
    })),
  });
  if (!parsed.success) {
    validation.value = "请检查商品与数量。";
    return;
  }
  validation.value = "";
  mutation.mutate();
}
function changed() {
  draft.key = "";
}
</script><template><section class="form-page"><div class="page-heading"><div><p class="eyebrow">YOUR NEXT FAVORITES</p><h1>创建订单</h1><p class="muted">确认所选商品和数量，价格由服务器计算。</p></div><router-link to="/products" class="quiet-link">← 继续选购</router-link></div><div class="content-card"><el-empty v-if="!draft.items.length" description="还没有选择商品"><router-link to="/products"><el-button type="primary">去探索商品</el-button></router-link></el-empty><template v-else><el-alert v-if="validation||mutation.isError.value" :title="validation||apiMessage(mutation.error.value)" type="error" :closable="false"/><div v-for="item in draft.items" :key="item.productId" class="order-line"><div><strong>{{item.productName}}</strong><p class="muted">{{item.productCode}}</p></div><el-input-number v-model="item.quantity" :disabled="mutation.isPending.value" @change="changed"/></div><el-button type="primary" :loading="mutation.isPending.value" @click="submit">创建草稿订单</el-button></template></div><p class="subtle-note">创建草稿不会扣减库存；确认订单时才会引当库存。</p></section></template>