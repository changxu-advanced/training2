<script setup lang="ts">
import OrderHistoryPage from "./OrderHistoryPage.vue";
import { useMutation, useQuery } from "@tanstack/vue-query";
import { orderInput } from "@training2/api-contracts/inputs";
import { ElMessageBox } from "element-plus";
import { computed, ref } from "vue";
import { draft, type Selection, useRuntime } from "../context.ts";
import { apiMessage } from "../helpers.ts";

const runtime = useRuntime();
const validation = ref("");
const cancelling = ref(false);
const stock = useQuery({
  queryKey: ["selection-stock", computed(() => draft.items.map(item => item.productId))],
  enabled: computed(() => draft.items.length > 0),
  staleTime: 0,
  queryFn: async () => Object.fromEntries(await Promise.all(
    draft.items.map(async item => {
      const snapshot = await runtime.publicClient.getStock({path: {id: item.productId}});
      return [item.productId, snapshot.stock] as const;
    }),
  )),
});
function maximum(item: Selection) {
  return Math.min(1000, stock.data.value?.[item.productId] ?? 0);
}
const ready = computed(() =>
  draft.items.length > 0 && !stock.isPending.value && !stock.isError.value &&
  draft.items.every(item => maximum(item) >= 1 && item.quantity <= maximum(item)),
);
function quantity(item: Selection, value: number) {
  return Math.max(1, Math.min(Math.max(1, maximum(item)), Number.isFinite(value) ? Math.trunc(value) : 1));
}
function changed() {
  draft.key = "";
  validation.value = "";
  mutation.reset();
}
function limitInput(event: Event, item: Selection) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const next = quantity(item, Number(input.value));
  input.value = String(next);
  if (item.quantity !== next) {
    item.quantity = next;
    changed();
  }
}
const mutation = useMutation({
  mutationFn: () => {
    const body = orderInput.parse({
      items: draft.items.map(i => ({productId: i.productId, quantity: i.quantity})),
    });
    if (new Set(body.items.map(i => i.productId.toLowerCase())).size !== body.items.length)
      throw new Error("Duplicate products");
    draft.key ||= crypto.randomUUID();
    return runtime.publicClient.createOrder({body, headers: {"idempotency-key": draft.key}});
  },
  onSuccess: async order => {
    void runtime.queryClient.invalidateQueries({queryKey:["orders"]});
    runtime.queryClient.setQueryData(["order", order.id], order);
    draft.items = [];
    draft.key = "";
    runtime.queryClient.removeQueries({queryKey: ["selection-stock"]});
    await runtime.router.push(`/orders/${order.id}`);
  },
});
function submit() {
  if (mutation.isPending.value || cancelling.value || !ready.value) return;
  const parsed = orderInput.safeParse({
    items: draft.items.map(i => ({productId: i.productId, quantity: i.quantity})),
  });
  if (!parsed.success) {
    validation.value = "商品と数量をご確認ください。";
    return;
  }
  validation.value = "";
  mutation.mutate();
}
async function cancelSelection() {
  if (mutation.isPending.value || cancelling.value) return;
  cancelling.value = true;
  try {
    await ElMessageBox.confirm(
      "選択した商品を取り消しますか？商品と数量をクリアして商品一覧へ戻ります。",
      "商品選択を取り消す",
      {confirmButtonText: "取り消す", cancelButtonText: "選択を続ける", type: "warning"},
    );
  } catch {
    cancelling.value = false;
    return;
  }
  draft.items = [];
  draft.key = "";
  runtime.queryClient.removeQueries({queryKey: ["selection-stock"]});
  await runtime.router.push("/products");
  cancelling.value = false;
}
</script>
<template>
  <OrderHistoryPage v-if="!draft.items.length"/>
  <section v-else class="form-page">
    <div class="page-heading">
      <div><p class="eyebrow">ご注文の商品</p><h1>注文作成</h1><p class="muted">商品と数量をご確認ください。金額は注文作成時に計算されます。</p></div>
      <router-link to="/products" class="quiet-link">← 買い物を続ける</router-link>
    </div>
    <div class="content-card">
      <el-empty v-if="!draft.items.length" description="商品が選択されていません">
        <router-link to="/products"><el-button type="primary">商品を選ぶ</el-button></router-link>
      </el-empty>
      <template v-else>
        <el-alert v-if="validation || mutation.isError.value" :title="validation || apiMessage(mutation.error.value)" type="error" :closable="false"/>
        <el-alert v-if="stock.isError.value" title="現在の在庫を取得できません。再試行してください。" type="error" :closable="false"/>
        <el-button v-if="stock.isError.value" @click="stock.refetch()">在庫を再取得</el-button>
        <p v-if="stock.isPending.value" class="muted">在庫を確認しています…</p>
        <div v-for="item in draft.items" :key="item.productId" class="order-line">
          <div>
            <strong>{{item.productName}}</strong><p class="muted">{{item.productCode}}</p>
            <p v-if="stock.data.value" class="muted">{{ maximum(item) > 0 ? '現在の在庫 ' + stock.data.value[item.productId] + ' · 選択可能 1–' + maximum(item) + ' 件' : '在庫がありません。商品一覧で選び直してください。' }}</p>
          <p v-if="stock.data.value && item.quantity > maximum(item) && maximum(item) > 0" class="stock-empty">在庫が不足しています。数量を変更してください。</p>
          </div>
          <div class="quantity-control">
            <button type="button" :aria-label="item.productName + '数量を減らす'" :disabled="mutation.isPending.value || cancelling || maximum(item)<1 || item.quantity<=1" @click="item.quantity=quantity(item,item.quantity-1);changed()">−</button>
            <input type="number" :aria-label="item.productName + '数量'" :value="item.quantity" min="1" :max="Math.max(1,maximum(item))" :aria-valuemin="1" :aria-valuemax="maximum(item)" :aria-valuenow="item.quantity" step="1" :disabled="mutation.isPending.value || cancelling || maximum(item)<1" @input="limitInput($event,item)"/>
            <button type="button" :aria-label="item.productName + '数量を増やす'" :disabled="mutation.isPending.value || cancelling || maximum(item)<1 || item.quantity>=maximum(item)" @click="item.quantity=quantity(item,item.quantity+1);changed()">＋</button>
          </div>
        </div>
        <div class="form-actions">
          <el-button type="primary" :disabled="!ready || cancelling" :loading="mutation.isPending.value" @click="submit">注文を作成</el-button>
          <el-button :disabled="mutation.isPending.value || cancelling" @click="cancelSelection">商品選択を取り消す</el-button>
        </div>
      </template>
    </div>
    <p class="subtle-note">注文の作成時には在庫を減らしません。注文確定時に在庫を確保します。</p>
  </section>
</template>
