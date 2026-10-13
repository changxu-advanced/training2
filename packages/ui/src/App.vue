<script setup lang="ts">
import { computed, ref } from "vue";
import { session, useRuntime } from "./context.ts";

const runtime = useRuntime();
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
<header class="topbar"><router-link to="/products" class="brand"><span class="brand-icon">t<span>²</span></span><span>training<span class="brand-light"> store</span><small>{{runtime.scope==='private'?'管理工作台':'让好物，走进日常。'}}</small></span></router-link>
<nav aria-label="主导航"><router-link v-if="runtime.scope==='public'||admin" to="/products">{{runtime.scope==='private'?'商品列表':'探索商品'}}</router-link><router-link v-if="runtime.scope==='private'&&admin" to="/products/new">注册商品</router-link><router-link v-if="runtime.scope==='public'" to="/orders/new">创建订单</router-link></nav>
<div class="account"><span v-if="session.sub" class="account-email">{{session.email}}</span><span v-if="admin" class="role-pill">管理员</span><el-button v-if="session.sub" :loading="loggingOut" @click="logout">退出登录</el-button><router-link v-else to="/login" class="login-link">{{runtime.scope==='private'?'管理员登录':'登录账户'}} <span>↗</span></router-link></div></header>
<main class="page-body"><router-view /></main><footer><span>training store · 日常好物</span><span>商品与订单已开放 · 库存以确认结果为准</span></footer>
</div>
</template>