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
const validation = ref("");
const mutation = useMutation({
  mutationFn: (body: ReturnType<typeof productInput.parse>) =>
    runtime.privateClient.registerProduct({ body }),
  onSuccess: async () => {
    await runtime.queryClient.invalidateQueries({ queryKey: ["products"] });
    await runtime.router.push("/products");
  },
});
function submit() {
  const result = productInput.safeParse(form);
  if (!result.success) {
    validation.value = `请检查以下字段：${[...new Set(result.error.issues.map((i) => ({code:"商品代码",name:"商品名称",description:"商品说明",priceJpy:"价格",stock:"库存"} as Record<string,string>)[String(i.path[0])]??"输入内容"))].join("、")}`;
    return;
  }
  validation.value = "";
  mutation.mutate(result.data);
}
</script><template><section class="form-page"><div class="page-heading"><div><p class="eyebrow">ADD A NEW PRODUCT</p><h1>注册商品</h1><p class="muted">填好商品信息，让它出现在商品列表里。</p></div><router-link to="/products" class="quiet-link">← 返回列表</router-link></div><div class="content-card"><el-alert v-if="validation||mutation.isError.value" :title="validation||apiMessage(mutation.error.value)" type="error" :closable="false" show-icon/><el-form label-position="top" @submit.prevent="submit"><div class="form-grid"><el-form-item label="商品代码" for="product-code"><el-input id="product-code" v-model="form.code" placeholder="例如 ABC-1" :disabled="mutation.isPending.value"/></el-form-item><el-form-item label="商品名称" for="product-name"><el-input id="product-name" v-model="form.name" placeholder="请输入商品名称" :disabled="mutation.isPending.value"/></el-form-item></div><el-form-item label="商品说明" for="product-description"><el-input id="product-description" v-model="form.description" type="textarea" :rows="4" placeholder="介绍商品的特点" :disabled="mutation.isPending.value"/></el-form-item><div class="form-grid"><el-form-item label="价格 · JPY" for="product-price"><el-input-number id="product-price" v-model="form.priceJpy" :disabled="mutation.isPending.value"/></el-form-item><el-form-item label="初始库存" for="product-stock"><el-input-number id="product-stock" v-model="form.stock" :disabled="mutation.isPending.value"/></el-form-item></div><div class="form-actions"><el-button type="primary" native-type="submit" :loading="mutation.isPending.value">注册商品</el-button><router-link to="/products"><el-button>取消</el-button></router-link></div></el-form></div></section></template>