<script setup lang="ts">
import { useCatalog } from "./catalog.ts";
import { computed, ref } from "vue";
import companyLogo from "./assets/company-logo.svg";
import { session, useRuntime } from "./context.ts";

const runtime = useRuntime();
runtime.catalogConnected = useCatalog(runtime.queryClient);
const admin = computed(() => session.groups.includes("admin"));
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
<div class="site-shell" :class="{'admin-shell':runtime.scope==='private'}">
<header class="topbar"><router-link to="/products" class="brand"><span><img :src="companyLogo" class="company-logo" alt="アドバンスト・ソフト" width="909" height="149"/><small>{{runtime.scope==='private'?'管理画面':'オンラインストア'}}</small></span></router-link>
<nav aria-label="メインナビゲーション"><router-link v-if="runtime.scope==='public'||admin" to="/products">{{runtime.scope==='private'?'商品一覧':'商品を見る'}}</router-link><router-link v-if="runtime.scope==='private'&&admin" to="/products/new">商品登録</router-link><router-link v-if="runtime.scope==='public'" to="/orders/new">注文作成</router-link></nav>
<div class="account"><span v-if="session.sub" class="account-email">{{session.email}}</span><span v-if="admin" class="role-pill">管理者</span><el-button v-if="session.sub" :loading="loggingOut" @click="logout">ログアウト</el-button><router-link v-else to="/login" class="login-link">{{runtime.scope==='private'?'管理者ログイン':'ログイン'}} <span>↗</span></router-link></div></header>
<main class="page-body"><router-view /></main><footer><span>アドバンスト・ソフト</span><span>在庫は注文確定時に確認されます</span></footer>
</div>
</template>