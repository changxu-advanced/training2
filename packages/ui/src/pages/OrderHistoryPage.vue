<script setup lang="ts">
import NavButton from "../components/NavButton.vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useMutation, useQuery } from "@tanstack/vue-query";
import { ref } from "vue";
import { session, useRuntime } from "../context.ts";
import { apiMessage } from "../helpers.ts";
import { useOrderActions } from "../order-actions.ts";
const runtime=useRuntime();
const status=ref<""|"draft"|"confirmed"|"cancelled">("");
const page=ref(1);
const orders=useQuery({queryKey:["orders",session.sub,status,page],queryFn:()=>runtime.publicClient.listOrders({query:{page:page.value,pageSize:20,...(status.value?{status:status.value}:{})}})});
const actions=useOrderActions();
const cleanupAsking=ref(false);
const cleanupError=ref("");
const cleanup=useMutation({
 mutationFn:()=>runtime.publicClient.deleteCancelledOrders(),
 onSuccess:async result=>{
   page.value=1;
   runtime.queryClient.removeQueries({queryKey:["order"]});
   await runtime.queryClient.invalidateQueries({queryKey:["orders"]});
   ElMessage.success(result.deletedCount ? result.deletedCount+" 件のキャンセル済み注文を削除しました。" : "削除するキャンセル済み注文はありません。");
 },
 onError:failure=>{cleanupError.value=apiMessage(failure);void runtime.queryClient.invalidateQueries({queryKey:["orders"]});},
});
async function removeCancelled(){
 if(cleanupAsking.value||cleanup.isPending.value||actions.busy.value||orders.isError.value)return;
 const owner=session.sub;
 cleanupAsking.value=true;cleanupError.value="";
 try{
  await ElMessageBox.confirm("ご自身のキャンセル済み注文を、すべてのページから削除しますか？未確定・確定済みの注文は削除されません。削除した注文は一覧に戻せません。","キャンセル済み注文の削除",{confirmButtonText:"削除する",cancelButtonText:"戻る",type:"warning",closeOnClickModal:false});
 }catch{cleanupAsking.value=false;return;}
 cleanupAsking.value=false;
 if(owner!==session.sub||orders.isError.value||actions.busy.value)return;
 cleanup.mutate();
}
const labels={draft:"未確定",confirmed:"確定済み",cancelled:"キャンセル済み"};
const dates=new Intl.DateTimeFormat("ja-JP",{dateStyle:"medium",timeStyle:"short"});
function allowed(id:string,action:"confirm"|"cancel"){
 const row=orders.data.value?.items.find(item=>item.id===id);
 return !!row && !cleanupAsking.value && !cleanup.isPending.value && !orders.isError.value && (action==="confirm"?row.status==="draft"&&row.canConfirm:row.status!=="cancelled");
}
</script>
<template>
<section class="orders-page">
  <div class="page-heading"><div><p class="eyebrow">ご注文の管理</p><h1>注文管理</h1><p class="muted">ご注文の確認・確定・キャンセルができます。</p></div></div>
  <div class="content-card">
    <div class="card-heading"><h2>あなたの注文</h2><span class="muted">{{orders.data.value ? orders.data.value.total+' 件' : ''}}</span></div>
    <div class="order-toolbar"><el-radio-group v-model="status" class="order-filters" aria-label="注文状態" @change="page=1"><el-radio-button value="">すべて</el-radio-button><el-radio-button value="draft">未確定</el-radio-button><el-radio-button value="confirmed">確定済み</el-radio-button><el-radio-button value="cancelled">キャンセル済み</el-radio-button></el-radio-group><div class="order-toolbar-actions"><el-button class="order-cancel-button" :disabled="cleanupAsking||cleanup.isPending.value||actions.busy.value||orders.isPending.value||orders.isError.value" :loading="cleanup.isPending.value" @click="removeCancelled">キャンセル済み注文を削除</el-button><router-link to="/products"><el-button type="primary">新しい注文を作成</el-button></router-link></div></div>
    <el-alert v-if="cleanupError" :title="cleanupError" type="error" :closable="false"/>
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
        <div class="history-order-bottom"><strong>合計 ¥{{item.totalJpy.toLocaleString('ja-JP')}}</strong><div class="history-order-controls"><NavButton :to="'/orders/'+item.id">詳細を見る</NavButton>
          <span v-if="actions.operation.isPending.value&&actions.operation.variables.value?.id===item.id&&actions.operation.variables.value.action==='cancel'" class="muted" role="status">注文をキャンセルしています…</span>
          <template v-else-if="item.status!=='cancelled'"><el-button v-if="item.status==='draft'" type="primary" :disabled="actions.busy.value||!allowed(item.id,'confirm')" @click="actions.request(item.id,'confirm',()=>allowed(item.id,'confirm'))">注文を確定</el-button><el-button class="order-cancel-button" :disabled="actions.busy.value||!allowed(item.id,'cancel')" @click="actions.request(item.id,'cancel',()=>allowed(item.id,'cancel'))">注文をキャンセル</el-button></template>
        </div></div>
      </article>
      <el-pagination v-model:current-page="page" :page-size="20" :total="orders.data.value.total" layout="prev, pager, next"/>
    </template>
    <p v-if="orders.isError.value&&orders.data.value" class="stock-empty">最新の注文を取得できません。再接続後に更新します。</p>
  </div>
</section>
</template>
