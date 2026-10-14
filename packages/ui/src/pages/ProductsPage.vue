<script setup lang="ts">
import {apiMessage} from "../helpers.ts";
import { useQuery } from "@tanstack/vue-query";
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { draft, isAdministrator, session, useRuntime } from "../context.ts";

const runtime = useRuntime();
const route = useRoute();
const management = computed(() => runtime.scope === "private" || isAdministrator.value);
const code = ref("");
const name = ref("");
const page = ref(1);
const inStock = ref(false);
function toggleStock() { inStock.value = !inStock.value; page.value = 1; }
const criteria = ref({ code: "", name: "" });
const products = useQuery({
  queryKey: ["products", runtime.scope, management, computed(() => session.sub), criteria, inStock, page],
  queryFn: () =>
    management.value
      ? runtime.privateClient.listProducts({
          query: { page: page.value, pageSize: 20 },
        })
      : runtime.publicClient.searchProducts({
          query: { ...criteria.value, page: page.value, pageSize: 20, ...(inStock.value ? { inStock: "true" as const } : {}) },
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
function select(product: { id: string; code: string; name: string; stock: number }) {
  if (management.value || product.stock < 1) return;
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
<template><section><el-alert v-if="route.query.denied==='admin'" title="商品登録は管理者のみ利用できます。" type="warning" :closable="false"/><div class="page-heading"><div><p class="eyebrow">{{management?'管理者向け':'オンラインストア'}}</p><h1>{{management?'商品一覧':'毎日の暮らしに、いいものを。'}}</h1><p class="muted">{{management?'商品情報・価格・在庫を確認できます。':'価格と在庫を確認しながら、商品をお選びください。'}}</p></div><router-link v-if="management" to="/products/new"><el-button type="primary">＋ 商品登録</el-button></router-link><span v-else class="heading-count">日々の暮らしに</span></div>
<div v-if="!management" class="search-panel"><el-form inline @submit.prevent="search"><el-form-item label="商品コード" for="search-code"><el-input id="search-code" v-model="code" placeholder="例：ABC-1" clearable/></el-form-item><el-form-item label="商品名" for="search-name"><el-input id="search-name" v-model="name" placeholder="商品名で検索" clearable/></el-form-item><el-button type="primary" native-type="submit">商品を検索</el-button><el-button @click="reset">リセット</el-button></el-form></div>
<div class="content-card"><div class="card-heading"><h2>{{management?'すべての商品':'商品一覧'}}</h2><div class="product-heading-actions"><el-button v-if="!management" :type="inStock?'primary':'default'" :aria-pressed="inStock" @click="toggleStock">在庫ありのみ</el-button><span class="muted">{{products.data.value?products.data.value.total+' 件の商品':'1ページ20件'}}</span></div></div>
<p class="inventory-status">{{runtime.catalogConnected.value ? "在庫は自動で更新されます" : "自動更新に再接続中です。在庫は定期的に確認します。"}}</p><el-skeleton v-if="products.isPending.value" :rows="5" animated/>
<div v-else-if="products.isError.value && !products.data.value" class="empty-panel"><div class="empty-icon">◇</div><h3>商品を読み込めません</h3><p>{{apiMessage(products.error.value)}}</p><el-button @click="products.refetch()">再読み込み</el-button></div>
<el-empty v-else-if="!products.data.value?.items.length" description="該当する商品はありません。条件を変えてお試しください"/>
<el-table v-else class="product-table" stripe row-key="id" :data="products.data.value.items"><el-table-column prop="code" label="コード"/><el-table-column prop="name" label="名称"/><el-table-column prop="description" label="説明"/><el-table-column label="価格"><template #default="{row}">¥{{row.priceJpy.toLocaleString('ja-JP')}}</template></el-table-column><el-table-column label="現在の在庫"><template #default="{row}"><span :class="row.stock < 1 ? 'stock-empty' : 'stock-value'">{{row.stock < 1 ? '在庫なし' : row.stock}}</span></template></el-table-column><el-table-column v-if="management" label="操作"><template #default="{row}"><router-link :to="{path:'/products/new',query:{restock:row.id}}"><el-button type="primary" plain>在庫を追加</el-button></router-link></template></el-table-column><el-table-column v-if="!management" label="操作"><template #default="{row}"><el-button type="primary" :disabled="row.stock < 1" @click="select(row)">商品を選択</el-button></template></el-table-column></el-table>
<p v-if="products.isError.value && products.data.value" class="stock-empty">最新の在庫を取得できません。再接続後に更新します。</p><el-pagination v-if="products.data.value" v-model:current-page="page" :page-size="20" :total="products.data.value.total" layout="prev, pager, next"/>
</div><div class="subtle-note"><span>↗</span> {{management?'商品コードは大文字に変換されます。価格は日本円です。':'在庫は表示時点の情報です。購入可能な数量は注文確定時に確認されます。'}}</div></section></template>