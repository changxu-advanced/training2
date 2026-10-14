<script setup lang="ts">
import {apiMessage} from "../helpers.ts";
import { useMutation, useQuery } from "@tanstack/vue-query";
import { productInput, restockInput } from "@training2/api-contracts/inputs";
import { computed, reactive, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useRuntime } from "../context.ts";

const runtime = useRuntime();
const form = reactive({
  code: "",
  name: "",
  description: "",
  priceJpy: 0,
  stock: 0,
});
const route=useRoute();
const restockId=computed(()=>typeof route.query.restock==="string"?route.query.restock:"");
const restocking=computed(()=>!!restockId.value);
let requestKey="";
let loadedId="";
const existing=useQuery({queryKey:["products","detail",restockId],enabled:restocking,queryFn:()=>runtime.privateClient.getProduct({path:{id:restockId.value}})});
watch(restockId,()=>{loadedId="";requestKey="";Object.assign(form,{code:"",name:"",description:"",priceJpy:0,stock:restocking.value?1:0});},{immediate:true});
watch(existing.data,data=>{if(data){Object.assign(form,{code:data.code,name:data.name,description:data.description,priceJpy:data.priceJpy});if(loadedId!==data.id){form.stock=1;loadedId=data.id;}}},{immediate:true});
const stockMax = 2000;
const priceMax = productInput.shape.priceJpy.maxValue ?? Number.MAX_SAFE_INTEGER;
const formInput = productInput.extend({ stock: productInput.shape.stock.max(stockMax) });
const validation = ref("");
const mutation = useMutation({
  mutationFn: (body: ReturnType<typeof productInput.parse>) =>
    restocking.value ? runtime.privateClient.restockProduct({path:{id:restockId.value},headers:{"idempotency-key":requestKey},body:{quantity:body.stock}}) : runtime.privateClient.registerProduct({ body }),
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
  const next = Math.max(field === "stock" && restocking.value ? 1 : 0, Math.min(maximum, Number.isFinite(value) ? Math.trunc(value) : 0));
  input.value = String(next);
  if(form[field]!==next)requestKey="";
  form[field] = next;
  validation.value = "";
  mutation.reset();
}
watch(()=>form.stock,()=>{requestKey="";});
function submit() {
  if (mutation.isPending.value || (restocking.value && (!existing.data.value || existing.isError.value))) return;
  if(restocking.value&&!restockInput.safeParse({quantity:form.stock}).success){validation.value="追加数量は1～2000個の整数で入力してください。";return;}
  if(restocking.value&&!requestKey)requestKey=crypto.randomUUID();
  const result = formInput.safeParse(form);
  if (!result.success) {
    validation.value = `次の項目をご確認ください：${[...new Set(result.error.issues.map((i) => ({code:"商品コード",name:"商品名",description:"商品説明",priceJpy:"価格",stock:"在庫"} as Record<string,string>)[String(i.path[0])]??"入力内容"))].join("、")}`;
    return;
  }
  validation.value = "";
  mutation.mutate(result.data);
}
</script><template><section class="form-page"><div class="page-heading"><div><p class="eyebrow">{{restocking?'登録済みの商品':'新しい商品'}}</p><h1>{{restocking?'在庫を追加':'商品登録'}}</h1><p class="muted">{{restocking?'商品情報を確認し、追加する数量を入力してください。現在の在庫に加算します。':'商品情報を入力して、商品一覧に登録します。'}}</p></div><router-link to="/products" class="quiet-link">← 一覧へ戻る</router-link></div><div class="content-card"><el-alert v-if="validation||mutation.isError.value" :title="validation||apiMessage(mutation.error.value)" type="error" :closable="false" show-icon/><el-alert v-if="restocking&&existing.isError.value" :title="apiMessage(existing.error.value)" type="error" :closable="false"/><el-skeleton v-if="restocking&&existing.isPending.value" :rows="3" animated/><el-form v-else label-position="top" @submit.prevent="submit"><div class="form-grid"><el-form-item label="商品コード" for="product-code"><el-input id="product-code" v-model="form.code" placeholder="例：ABC-1" :disabled="mutation.isPending.value||restocking"/></el-form-item><el-form-item label="商品名" for="product-name"><el-input id="product-name" v-model="form.name" placeholder="商品名を入力" :disabled="mutation.isPending.value||restocking"/></el-form-item></div><el-form-item label="商品説明" for="product-description"><el-input id="product-description" v-model="form.description" type="textarea" :rows="4" placeholder="商品の特徴を入力" :disabled="mutation.isPending.value||restocking"/></el-form-item><div class="form-grid"><el-form-item label="価格 · JPY" for="product-price"><el-input-number id="product-price" v-model="form.priceJpy" :min="0" :max="priceMax" :precision="0" step-strictly :value-on-clear="0" @input.capture="limitNumber($event, 'priceJpy')" :disabled="mutation.isPending.value||restocking"/></el-form-item><el-form-item :label="restocking?'追加数量':'初期在庫'" for="product-stock"><el-input-number id="product-stock" v-model="form.stock" :min="restocking?1:0" :max="stockMax" :precision="0" step-strictly :value-on-clear="restocking?1:0" @input.capture="limitNumber($event, 'stock')" :disabled="mutation.isPending.value||(restocking&&!existing.data.value)"/><p class="subtle-note input-help">{{restocking?'追加数量は1～2000個です。':'初期在庫は0～2000個まで登録できます。'}}</p></el-form-item></div><div class="form-actions"><el-button type="primary" native-type="submit" :loading="mutation.isPending.value" :disabled="restocking&&(!existing.data.value||existing.isError.value)">{{restocking?'在庫を追加':'商品登録'}}</el-button><router-link to="/products"><el-button>キャンセル</el-button></router-link></div></el-form></div></section></template>