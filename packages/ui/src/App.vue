<script setup lang="ts">
import NavButton from "./components/NavButton.vue";
import { useCatalog } from "./catalog.ts";
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import companyLogo from "./assets/company-logo.svg";
import { isAdministrator, session, useRuntime } from "./context.ts";

const runtime = useRuntime();
const route=useRoute();
const loginPage=computed(()=>route.path==="/login");
runtime.catalogConnected = useCatalog(runtime.queryClient);
const admin = isAdministrator;
const management = computed(() => runtime.scope === "private" || admin.value);
const loggingOut = ref(false);
async function logout() {
  loggingOut.value = true;
  try {
    await runtime.logout();
  } finally {
    loggingOut.value = false;
  }
}
</script>
<template>
<div class="site-shell" :class="{'admin-shell':management}">
<header class="topbar"><div class="brand"><span><img :src="companyLogo" class="company-logo" alt="アドバンスト・ソフト" width="909" height="149"/><small>{{management?'管理画面':'オンラインストア'}}</small></span></div>
<nav v-if="!loginPage" aria-label="メインナビゲーション"><router-link v-if="runtime.scope==='public'||admin" to="/products">{{management?'商品一覧':'商品を見る'}}</router-link><router-link v-if="admin" to="/products/new">商品登録</router-link><router-link v-if="runtime.scope==='public'&&!admin" to="/orders/new">注文管理</router-link></nav>
<div v-if="!loginPage" class="account"><span v-if="session.sub" class="account-email">{{session.email}}</span><span v-if="admin" class="role-pill">管理者</span><el-button v-if="session.sub" :loading="loggingOut" @click="logout">ログアウト</el-button><NavButton v-else to="/login">{{runtime.scope==='private'?'管理者ログイン':'ログイン'}} <span>↗</span></NavButton></div></header>
<main class="page-body"><router-view /></main><footer><span>アドバンスト・ソフト</span><span>在庫は注文確定時に確認されます</span></footer>
</div>
</template>