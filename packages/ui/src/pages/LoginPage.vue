<script setup lang="ts">
import { signIn, signOut } from "@training2/auth/browser";
import { screens } from "@training2/screen-contracts";
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { clearSession, session, useRuntime } from "../context.ts";
import { safeReturnTo } from "../helpers.ts";

const runtime = useRuntime();
const route = useRoute();
const username = ref("");
const password = ref("");
const pending = ref(false);
const failure = ref("");
const denied = computed(
  () =>
    route.query.denied === "1" ||
    (runtime.scope === "private" &&
      session.sub &&
      !session.groups.includes("admin")),
);
async function login() {
  if (!username.value.trim() || !password.value) {
    failure.value = "请填写邮箱和密码。";
    return;
  }
  pending.value = true;
  failure.value = "";
  try {
    await signOut();
    clearSession(!session.sub);
    runtime.queryClient.clear();
    const result = await signIn({
      username: username.value.trim(),
      password: password.value,
      options: { authFlowType: "USER_PASSWORD_AUTH" },
    });
    if (!result.isSignedIn) {
      failure.value = "登录需要进一步验证，请联系管理员。";
      return;
    }
    await runtime.refreshSession();
    runtime.queryClient.clear();
    if (runtime.scope === "private" && !session.groups.includes("admin")) {
      failure.value = "当前账号没有管理权限，请使用管理员账号。";
      return;
    }
    const manifest = {
      scope: runtime.scope,
      status: "implemented" as const,
      routes: screens
        .filter((s) => s.scope === runtime.scope)
        .map((s) => ({ screenId: s.id, path: s.path })),
      redirects: [],
    };
    await runtime.router.replace(safeReturnTo(route.query.returnTo, manifest));
  } catch {
    failure.value = "登录失败，请检查邮箱和密码后重试。";
  } finally {
    password.value = "";
    pending.value = false;
  }
}
</script>
<template><section class="login-layout"><div class="login-story"><p class="eyebrow">{{runtime.scope==='private'?'YOUR WORKSPACE':'WELCOME TO TRAINING STORE'}}</p><h1><template v-if="runtime.scope==='private'">好商品，<br/>从这里开始。</template><template v-else>把喜欢的，<br/>带回日常。</template></h1><p class="story-copy">{{runtime.scope==='private'?'统一管理商品信息、价格与库存。登录管理员账号，进入你的工作台。':'探索心仪商品，查看实时库存。登录后，管理属于你的每一笔订单。'}}</p><div class="illustration" aria-hidden="true"><div class="orb"></div><div class="bag"><div class="handle"></div><span>t²</span></div><div class="mini-bag"><span>↗</span></div><span class="spark">✦</span></div><div class="story-note"><span>01 /</span> 简单、清晰的购物体验</div></div>
<div class="login-card"><span class="mini-label">{{runtime.scope==='private'?'管理端':'买家端'}}账户</span><h2>{{runtime.scope==='private'?'登录工作台':'欢迎回来'}}</h2><p class="muted">使用已准备好的账户继续</p><el-alert v-if="denied" title="当前账号没有管理权限" type="warning" :closable="false" show-icon/><el-alert v-if="route.query.expired" title="登录已失效，请重新登录" type="warning" :closable="false" show-icon/><el-alert v-if="failure" :title="failure" type="error" :closable="false" show-icon/>
<el-form label-position="top" @submit.prevent="login"><el-form-item label="邮箱" for="login-email"><el-input id="login-email" v-model="username" placeholder="请输入邮箱" autocomplete="username" :disabled="pending"/></el-form-item><el-form-item label="密码" for="login-password"><el-input id="login-password" v-model="password" type="password" placeholder="请输入密码" autocomplete="current-password" show-password :disabled="pending"/></el-form-item><el-button class="wide-button" type="primary" native-type="submit" :loading="pending">{{runtime.scope==='private'?'登录管理端':'登录买家端'}}</el-button></el-form>
<p class="local-help">本地体验账号<br/><strong>{{runtime.scope==='private'?'admin@training2.test':'buyer@training2.test'}}</strong><br/>开发密码：Training2-local-2026!</p><router-link v-if="runtime.scope==='public'" to="/products" class="quiet-link">先逛逛商品 →</router-link></div></section></template>