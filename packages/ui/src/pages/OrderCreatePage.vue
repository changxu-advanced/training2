<script setup lang="ts">
import { useMutation, useQuery } from "@tanstack/vue-query";
import { orderInput } from "@training2/api-contracts/inputs";
import { ElMessageBox } from "element-plus";
import { computed, ref, watch } from "vue";
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
  draft.items.length > 0 && !stock.isFetching.value && !stock.isError.value &&
  draft.items.every(item => maximum(item) >= 1),
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
    runtime.queryClient.setQueryData(["order", order.id], order);
    draft.items = [];
    draft.key = "";
    runtime.queryClient.removeQueries({queryKey: ["selection-stock"]});
    await runtime.router.push(`/orders/${order.id}`);
  },
});
watch(stock.data, () => {
  if (mutation.isPending.value) return;
  for (const item of draft.items) {
    const next = quantity(item, item.quantity);
    if (item.quantity !== next) {
      item.quantity = next;
      changed();
    }
  }
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
  <section class="form-page">
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
        <p v-if="stock.isFetching.value" class="muted">在庫を確認しています…</p>
        <div v-for="item in draft.items" :key="item.productId" class="order-line">
          <div>
            <strong>{{item.productName}}</strong><p class="muted">{{item.productCode}}</p>
            <p v-if="stock.data.value" class="muted">{{ maximum(item) > 0 ? '現在の在庫 ' + stock.data.value[item.productId] + ' · 選択可能 1–' + maximum(item) + ' 件' : '在庫がありません。商品一覧で選び直してください。' }}</p>
          </div>
          <el-input-number v-if="stock.data.value && !stock.isFetching.value" :key="maximum(item)" v-model="item.quantity" :aria-label="item.productName + '数量'"
            :min="1" :max="Math.max(1, maximum(item))" :step="1" step-strictly :precision="0" :value-on-clear="1"
            :disabled="mutation.isPending.value || cancelling || !ready"
            @input.capture="limitInput($event, item)" @change="changed"/>
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
