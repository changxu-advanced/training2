<script setup lang="ts">
import {apiMessage} from "../helpers.ts";
import { useMutation, useQuery } from "@tanstack/vue-query";
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useRuntime } from "../context.ts";

const runtime = useRuntime();
const route = useRoute();
const id = computed(() => String(route.params.id));
const order = useQuery({
  queryKey: ["order", id],
  queryFn: () => runtime.publicClient.getOrder({ path: { id: id.value } }),
});
const operation = useMutation({
  mutationFn: (action: "confirm" | "cancel") =>
    action === "confirm"
      ? runtime.publicClient.confirmOrder({ path: { id: id.value } })
      : runtime.publicClient.cancelOrder({ path: { id: id.value } }),
  onSuccess: async updated => {
    runtime.queryClient.setQueryData(["order",id.value],updated);
    await runtime.queryClient.invalidateQueries({ queryKey: ["products"] });
  },
});
function act(action:"confirm"|"cancel"){if(!operation.isPending.value)operation.mutate(action);}
const labels = { draft: "草稿", confirmed: "已确认", cancelled: "已取消" };
</script><template><section class="form-page"><div class="page-heading"><div><p class="eyebrow">YOUR ORDER</p><h1>订单详情</h1><p class="muted">查看明细、确认订单或取消订单。</p><p class="muted">订单编号：{{id}}</p></div><router-link to="/products" class="quiet-link">← 返回商品页</router-link></div><div class="content-card"><el-skeleton v-if="order.isPending.value" :rows="5" animated/><div v-else-if="order.isError.value" class="empty-panel"><h3>暂时无法查看订单</h3><p>{{apiMessage(order.error.value)}}</p><el-button @click="order.refetch()">重试</el-button></div><template v-else-if="order.data.value"><div class="card-heading"><h2>{{labels[order.data.value.status]}}</h2><span class="muted">{{order.data.value.createdAt}}</span></div><el-alert v-if="operation.isError.value" :title="apiMessage(operation.error.value)" type="error" :closable="false"/><div v-for="item in order.data.value.items" :key="item.productId" class="order-line"><strong>{{item.productName}}</strong><span>¥{{item.unitPriceJpy}} × {{item.quantity}}</span></div><h2 class="total">合计 ¥{{order.data.value.totalJpy.toLocaleString('ja-JP')}}</h2><p v-if="operation.isPending.value && operation.variables.value==='cancel'" class="order-action-status muted" role="status">正在取消订单…</p><div v-else-if="order.data.value.status!=='cancelled'" class="order-actions"><el-button v-if="order.data.value.status==='draft'" type="primary" :loading="operation.isPending.value" @click="act('confirm')">确认订单</el-button><el-button class="order-cancel-button" :disabled="operation.isPending.value" @click="act('cancel')">取消订单</el-button></div></template></div></section></template>