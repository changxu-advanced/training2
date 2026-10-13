<script setup lang="ts">
import {apiMessage} from "../helpers.ts";
import { useQuery } from "@tanstack/vue-query";
import { ref } from "vue";
import { draft, useRuntime } from "../context.ts";

const runtime = useRuntime();
const code = ref("");
const name = ref("");
const page = ref(1);
const stockNotice=ref("");
async function refreshStock(productId:string){stockNotice.value="";try{const current=await runtime.publicClient.getStock({path:{id:productId}});runtime.queryClient.setQueryData(["products",runtime.scope,criteria.value,page.value],(previous:typeof products.data.value)=>previous?{...previous,items:previous.items.map(item=>item.id===productId?{...item,stock:current.stock}:item)}:previous);}catch(error){stockNotice.value=apiMessage(error);}}
const criteria = ref({ code: "", name: "" });
const products = useQuery({
  queryKey: ["products", runtime.scope, criteria, page],
  queryFn: () =>
    runtime.scope === "private"
      ? runtime.privateClient.listProducts({
          query: { page: page.value, pageSize: 20 },
        })
      : runtime.publicClient.searchProducts({
          query: { ...criteria.value, page: page.value, pageSize: 20 },
        }),
});
function search() {
  page.value = 1;
  criteria.value = { code: code.value.trim(), name: name.value.trim() };
}
function reset() {
  code.value = "";
  name.value = "";
  search();
}
function select(product: { id: string; code: string; name: string }) {
  if (!draft.items.some((i) => i.productId === product.id))
    draft.items.push({
      productId: product.id,
      productCode: product.code,
      productName: product.name,
      quantity: 1,
    });
  draft.key = "";
  void runtime.router.push("/orders/new");
}
</script>
<template><section><div class="page-heading"><div><p class="eyebrow">{{runtime.scope==='private'?'PRODUCT WORKSPACE':'THOUGHTFULLY SELECTED'}}</p><h1>{{runtime.scope==='private'?'商品管理':'发现日常好物'}}</h1><p class="muted">{{runtime.scope==='private'?'管理商品信息，掌握价格与库存。':'清晰的价格与库存，让每一次选择更从容。'}}</p></div><router-link v-if="runtime.scope==='private'" to="/products/new"><el-button type="primary">＋ 注册商品</el-button></router-link><span v-else class="heading-count">好物 / 日常 / 简单</span></div>
<div v-if="runtime.scope==='public'" class="search-panel"><el-form inline @submit.prevent="search"><el-form-item label="商品代码" for="search-code"><el-input id="search-code" v-model="code" placeholder="例如 ABC-1" clearable/></el-form-item><el-form-item label="商品名称" for="search-name"><el-input id="search-name" v-model="name" placeholder="搜索心仪商品" clearable/></el-form-item><el-button type="primary" native-type="submit">搜索商品</el-button><el-button @click="reset">重置</el-button></el-form></div>
<div class="content-card"><div class="card-heading"><h2>{{runtime.scope==='private'?'全部商品':'商品列表'}}</h2><span class="muted">{{products.data.value?products.data.value.total+' 件商品':'每页 20 件'}}</span></div>
<el-alert v-if="stockNotice" :title="stockNotice" type="error" :closable="false"/><el-skeleton v-if="products.isPending.value" :rows="5" animated/>
<div v-else-if="products.isError.value" class="empty-panel"><div class="empty-icon">◇</div><h3>暂时无法加载商品</h3><p>{{apiMessage(products.error.value)}}</p><el-button @click="products.refetch()">重新加载</el-button></div>
<el-empty v-else-if="!products.data.value?.items.length" description="没有匹配的商品，试试其他条件"/>
<el-table v-else :data="products.data.value.items"><el-table-column prop="code" label="代码"/><el-table-column prop="name" label="名称"/><el-table-column prop="description" label="说明"/><el-table-column label="价格"><template #default="{row}">¥{{row.priceJpy.toLocaleString('ja-JP')}}</template></el-table-column><el-table-column prop="stock" label="当前库存"/><el-table-column v-if="runtime.scope==='public'" label="操作"><template #default="{row}"><el-button @click="refreshStock(row.id)">刷新库存</el-button><el-button @click="select(row)">选择商品</el-button></template></el-table-column></el-table>
<el-pagination v-if="products.data.value" v-model:current-page="page" :page-size="20" :total="products.data.value.total" layout="prev, pager, next"/>
</div><div class="subtle-note"><span>↗</span> {{runtime.scope==='private'?'商品代码会自动转换为大写；价格单位为日元。':'库存是查询时的快照，最终可购买数量以确认订单时为准。'}}</div></section></template>