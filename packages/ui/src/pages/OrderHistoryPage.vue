<script setup lang="ts">
import { useQuery } from "@tanstack/vue-query";
import { ref } from "vue";
import { session, useRuntime } from "../context.ts";
import { apiMessage } from "../helpers.ts";
import { useOrderActions } from "../order-actions.ts";
const runtime=useRuntime();
const status=ref<""|"draft"|"confirmed"|"cancelled">("");
const page=ref(1);
const orders=useQuery({queryKey:["orders",session.sub,status,page],queryFn:()=>runtime.publicClient.listOrders({query:{page:page.value,pageSize:20,...(status.value?{status:status.value}:{})}})});
const actions=useOrderActions();
const labels={draft:"未確定",confirmed:"確定済み",cancelled:"キャンセル済み"};
const dates=new Intl.DateTimeFormat("ja-JP",{dateStyle:"medium",timeStyle:"short"});
function allowed(id:string,action:"confirm"|"cancel"){
 const row=orders.data.value?.items.find(item=>item.id===id);
 return !!row && !orders.isError.value && (action==="confirm"?row.status==="draft"&&row.canConfirm:row.status!=="cancelled");
}
</script>
<template>
<section class="orders-page">
  <div class="page-heading"><div><p class="eyebrow">ご注文の管理</p><h1>注文管理</h1><p class="muted">ご注文の確認・確定・キャンセルができます。</p></div></div>
  <div class="content-card">
    <div class="card-heading"><h2>あなたの注文</h2><span class="muted">{{orders.data.value ? orders.data.value.total+' 件' : ''}}</span></div>
    <el-radio-group v-model="status" class="order-filters" aria-label="注文状態" @change="page=1"><el-radio-button value="">すべて</el-radio-button><el-radio-button value="draft">未確定</el-radio-button><el-radio-button value="confirmed">確定済み</el-radio-button><el-radio-button value="cancelled">キャンセル済み</el-radio-button></el-radio-group>
    <el-alert v-if="actions.error.value" :title="actions.error.value" type="error" :closable="false"/>
    <el-skeleton v-if="orders.isPending.value" :rows="4" animated/>
    <div v-else-if="orders.isError.value&&!orders.data.value" class="empty-panel"><h3>注文を読み込めません</h3><p>{{apiMessage(orders.error.value)}}</p><el-button @click="orders.refetch()">再読み込み</el-button></div>
    <el-empty v-else-if="!orders.data.value?.items.length" :description="status ? 'この状態の注文はありません' : 'まだ注文はありません。商品を選んで注文を作成しましょう。'"/>
    <template v-else>
      <article v-for="item in orders.data.value.items" :key="item.id" class="history-order" :data-order-id="item.id">
        <div class="history-order-heading"><router-link :to="'/orders/'+item.id" class="history-order-title">注文 #{{item.id.slice(0,8).toUpperCase()}}</router-link><el-tag :type="item.status==='draft'?'warning':item.status==='confirmed'?'primary':'info'">{{labels[item.status]}}</el-tag></div>
        <p class="muted">{{dates.format(new Date(item.createdAt))}}</p>
        <div class="history-order-items"><p v-for="line in item.items.slice(0,3)" :key="line.productId">{{line.productName}} <span class="muted">× {{line.quantity}}</span></p><p v-if="item.items.length>3" class="muted">ほか {{item.items.length-3}} 件の商品</p></div>
        <p v-if="item.status==='draft'&&!item.canConfirm" class="stock-empty">在庫が不足しているため、確定できません。</p>
        <div class="history-order-bottom"><strong>合計 ¥{{item.totalJpy.toLocaleString('ja-JP')}}</strong><div class="history-order-controls"><router-link :to="'/orders/'+item.id" class="quiet-link">詳細を見る</router-link>
          <span v-if="actions.operation.isPending.value&&actions.operation.variables.value?.id===item.id&&actions.operation.variables.value.action==='cancel'" class="muted" role="status">注文をキャンセルしています…</span>
          <template v-else-if="item.status!=='cancelled'"><el-button v-if="item.status==='draft'" type="primary" :disabled="actions.busy.value||!allowed(item.id,'confirm')" @click="actions.request(item.id,'confirm',()=>allowed(item.id,'confirm'))">注文を確定</el-button><el-button class="order-cancel-button" :disabled="actions.busy.value||!allowed(item.id,'cancel')" @click="actions.request(item.id,'cancel',()=>allowed(item.id,'cancel'))">注文をキャンセル</el-button></template>
        </div></div>
      </article>
      <el-pagination v-model:current-page="page" :page-size="20" :total="orders.data.value.total" layout="prev, pager, next"/>
    </template>
    <p v-if="orders.isError.value&&orders.data.value" class="stock-empty">最新の注文を取得できません。再接続後に更新します。</p>
    <div class="new-order-action"><router-link to="/products"><el-button type="primary" size="large">新しい注文を作成</el-button></router-link><p class="muted">商品一覧で商品を選択してください。</p></div>
  </div>
</section>
</template>
