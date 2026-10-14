<script setup lang="ts">
import { signIn, signOut } from "@training2/auth/browser";
import { screens } from "@training2/screen-contracts";
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { clearSession, draft, isAdministrator, session, useRuntime } from "../context.ts";
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
    failure.value = "メールアドレスとパスワードを入力してください。";
    return;
  }
  pending.value = true;
  failure.value = "";
  try {
    clearSession(!session.sub);
    runtime.queryClient.clear();
    await signOut();
    const result = await signIn({
      username: username.value.trim(),
      password: password.value,
      options: { authFlowType: "USER_PASSWORD_AUTH" },
    });
    if (!result.isSignedIn) {
      failure.value = "追加の認証が必要です。管理者にお問い合わせください。";
      return;
    }
    await runtime.refreshSession();
    runtime.queryClient.clear();
    if(isAdministrator.value){draft.items=[];draft.key="";}
    if (runtime.scope === "private" && !session.groups.includes("admin")) {
      failure.value = "管理権限がありません。管理者アカウントをご利用ください。";
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
    failure.value = "ログインできません。メールアドレスとパスワードをご確認ください。";
  } finally {
    password.value = "";
    pending.value = false;
  }
}
</script>
<template><section class="login-layout"><div class="login-story"><p class="eyebrow">{{runtime.scope==='private'?'管理者向け':'オンラインストア'}}</p><h1><template v-if="runtime.scope==='private'">商品の管理は、<br/>ここから。</template><template v-else>お気に入りを、<br/>毎日の暮らしに。</template></h1><p class="story-copy">{{runtime.scope==='private'?'商品情報・価格・在庫を管理できます。管理者アカウントでログインしてください。':'同じ入口からログインできます。ご利用権限に応じて、注文管理または商品管理の画面を表示します。'}}</p><div class="illustration" aria-hidden="true"><div class="orb"></div><div class="bag"><div class="handle"></div><span>暮らし</span></div><div class="mini-bag"><span>↗</span></div><span class="spark">✦</span></div><div class="story-note"><span>01 /</span> シンプルでわかりやすいお買い物</div></div>
<div class="login-card"><span class="mini-label">{{runtime.scope==='private'?'管理者':'共通'}}アカウント</span><h2>{{runtime.scope==='private'?'管理画面へログイン':'ログイン'}}</h2><p class="muted">アカウントを入力してログインしてください</p><el-alert v-if="denied" title="管理権限がありません" type="warning" :closable="false" show-icon/><el-alert v-if="route.query.expired" title="セッションの有効期限が切れました。再度ログインしてください" type="warning" :closable="false" show-icon/><el-alert v-if="failure" :title="failure" type="error" :closable="false" show-icon/>
<el-form label-position="top" @submit.prevent="login"><el-form-item label="メールアドレス" for="login-email"><el-input id="login-email" v-model="username" placeholder="メールアドレスを入力" autocomplete="username" :disabled="pending"/></el-form-item><el-form-item label="パスワード" for="login-password"><el-input id="login-password" v-model="password" type="password" placeholder="パスワードを入力" autocomplete="current-password" show-password :disabled="pending"/></el-form-item><el-button class="wide-button" type="primary" native-type="submit" :loading="pending">{{runtime.scope==='private'?'管理者ログイン':'ログイン'}}</el-button></el-form>
<p class="local-help">ローカルテスト用アカウント<br/><strong>{{runtime.scope==='private'?'admin@training2.test':'buyer@training2.test'}}</strong><br/>テスト用パスワード：Training2-local-2026!</p><router-link v-if="runtime.scope==='public'" to="/products" class="quiet-link">商品を見る →</router-link></div></section></template>