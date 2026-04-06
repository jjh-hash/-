<template>
  <div class="page">
    <h2>退款详情</h2>
    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="err" class="error">{{ err }}</p>
    <div v-else>
      <div class="detail-grid">
        <div><span class="k">退款单号</span> {{ refund._id || refund.refundId }}</div>
        <div><span class="k">状态</span> {{ refund.statusText || refund.status }}</div>
        <div><span class="k">原因</span> {{ refund.refundReason || '—' }}</div>
        <div><span class="k">金额</span> {{ refund.refundAmount ?? '—' }}</div>
      </div>
      <p v-if="order" class="section-block">
        <span class="k">关联订单：</span>
        <router-link class="link" :to="'/orders/' + (order.id || order._id)">
          {{ order.orderNo || order.id }}
        </router-link>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { refundManage, orderManage } from '../api/admin'
import { isAdminOk } from '../utils/result'

const route = useRoute()
const loading = ref(true)
const err = ref('')
const refund = ref({})
const order = ref(null)

const statusTextMap = {
  pending: '待处理',
  processing: '处理中',
  approved: '已同意',
  rejected: '已拒绝',
  completed: '已完成'
}

onMounted(load)

async function load() {
  const refundId = route.params.refundId
  loading.value = true
  err.value = ''
  try {
    const res = await refundManage.getRefundDetail({
      refundId,
      isAdmin: true
    })
    if (res && res.code === 200) {
      const raw = res.data?.refund || res.data
      if (!raw) {
        err.value = '退款信息不存在'
        return
      }
      refund.value = {
        ...raw,
        statusText: statusTextMap[raw.status] || raw.status
      }
      const oid = raw.orderId
      if (oid) {
        const ores = await orderManage.getAdminOrderList({
          orderId: oid,
          page: 1,
          pageSize: 1
        })
        if (isAdminOk(ores) && ores.data) {
          const list = ores.data.list || []
          order.value = list[0] || null
        }
      }
    } else {
      err.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    err.value = e.message || '请求异常'
  } finally {
    loading.value = false
  }
}
</script>
