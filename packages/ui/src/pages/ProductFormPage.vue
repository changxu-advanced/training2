<script setup lang="ts">
import {apiMessage} from "../helpers.ts";
import { useMutation } from "@tanstack/vue-query";
import { productInput } from "@training2/api-contracts/inputs";
import { reactive, ref } from "vue";
import { useRuntime } from "../context.ts";

const runtime = useRuntime();
const form = reactive({
  code: "",
  name: "",
  description: "",
  priceJpy: 0,
  stock: 0,
});
const stockMax = 2000;
const priceMax = productInput.shape.priceJpy.maxValue ?? Number.MAX_SAFE_INTEGER;
const formInput = productInput.extend({ stock: productInput.shape.stock.max(stockMax) });
const validation = ref("");
const mutation = useMutation({
  mutationFn: (body: ReturnType<typeof productInput.parse>) =>
    runtime.privateClient.registerProduct({ body }),
  onSuccess: async () => {
    await runtime.queryClient.invalidateQueries({ queryKey: ["products"] });
    await runtime.router.push("/products");
  },
});
function limitNumber(event: Event, field: "priceJpy" | "stock") {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  const value = Number(input.value);
  const maximum = field === "stock" ? stockMax : priceMax;
  const next = Math.max(0, Math.min(maximum, Number.isFinite(value) ? Math.trunc(value) : 0));
  input.value = String(next);
  form[field] = next;
  validation.value = "";
  mutation.reset();
}
function submit() {
  if (mutation.isPending.value) return;
  const result = formInput.safeParse(form);
  if (!result.success) {
    validation.value = `次の項目をご確認ください：${[...new Set(result.error.issues.map((i) => ({code:"商品コード",name:"商品名",description:"商品説明",priceJpy:"価格",stock:"在庫"} as Record<string,string>)[String(i.path[0])]??"入力内容"))].join("、")}`;
    return;
  }
  validation.value = "";
  mutation.mutate(result.data);
}
</script><template><section class="form-page"><div class="page-heading"><div><p class="eyebrow">新しい商品</p><h1>商品登録</h1><p class="muted">商品情報を入力して、商品一覧に登録します。</p></div><router-link to="/products" class="quiet-link">← 一覧へ戻る</router-link></div><div class="content-card"><el-alert v-if="validation||mutation.isError.value" :title="validation||apiMessage(mutation.error.value)" type="error" :closable="false" show-icon/><el-form label-position="top" @submit.prevent="submit"><div class="form-grid"><el-form-item label="商品コード" for="product-code"><el-input id="product-code" v-model="form.code" placeholder="例：ABC-1" :disabled="mutation.isPending.value"/></el-form-item><el-form-item label="商品名" for="product-name"><el-input id="product-name" v-model="form.name" placeholder="商品名を入力" :disabled="mutation.isPending.value"/></el-form-item></div><el-form-item label="商品説明" for="product-description"><el-input id="product-description" v-model="form.description" type="textarea" :rows="4" placeholder="商品の特徴を入力" :disabled="mutation.isPending.value"/></el-form-item><div class="form-grid"><el-form-item label="価格 · JPY" for="product-price"><el-input-number id="product-price" v-model="form.priceJpy" :min="0" :max="priceMax" :precision="0" step-strictly :value-on-clear="0" @input.capture="limitNumber($event, 'priceJpy')" :disabled="mutation.isPending.value"/></el-form-item><el-form-item label="初期在庫" for="product-stock"><el-input-number id="product-stock" v-model="form.stock" :min="0" :max="stockMax" :precision="0" step-strictly :value-on-clear="0" @input.capture="limitNumber($event, 'stock')" :disabled="mutation.isPending.value"/><p class="subtle-note input-help">初期在庫は0～2000個まで登録できます。</p></el-form-item></div><div class="form-actions"><el-button type="primary" native-type="submit" :loading="mutation.isPending.value">商品登録</el-button><router-link to="/products"><el-button>キャンセル</el-button></router-link></div></el-form></div></section></template>