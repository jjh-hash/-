<template>
  <div class="page">
    <h2>财务管理</h2>
    <div class="toolbar">
      <label>
        时间范围
        <select v-model="dateRange" class="select" @change="load">
          <option value="week">近一周</option>
          <option value="month">近一月</option>
          <option value="quarter">近一季</option>
        </select>
      </label>
      <button type="button" class="btn-sm" @click="load">刷新</button>
    </div>
    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="err" class="error">{{ err }}</p>
    <div v-else class="grid">
      <div class="stat">
        <div class="label">平台总收入</div>
        <div class="value">{{ fs.platformTotalRevenue }}</div>
      </div>
      <div class="stat">
        <div class="label">商家总收入</div>
        <div class="value">{{ fs.merchantTotalRevenue }}</div>
      </div>
      <div class="stat">
        <div class="label">用户总消费</div>
        <div class="value">{{ fs.userTotalConsumption }}</div>
      </div>
      <div class="stat">
        <div class="label">退款金额 / 笔数</div>
        <div class="value">{{ fs.totalRefundAmount }} / {{ fs.totalRefundCount }}</div>
      </div>
      <div class="stat">
        <div class="label">平台净收入</div>
        <div class="value">{{ fs.netPlatformRevenue }}</div>
      </div>
      <div class="stat">
        <div class="label">订单数 / 客单价</div>
        <div class="value">{{ fs.orderCount }} / {{ fs.avgOrderValue }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { statistics } from '../api/admin'

const loading = ref(true)
const err = ref('')
const dateRange = ref('week')
const fs = ref({
  platformTotalRevenue: '—',
  merchantTotalRevenue: '—',
  userTotalConsumption: '—',
  totalRefundAmount: '—',
  totalRefundCount: '—',
  netPlatformRevenue: '—',
  orderCount: '—',
  avgOrderValue: '—'
})

onMounted(load)

async function load() {
  loading.value = true
  err.value = ''
  try {
    const res = await statistics.getAdminFinanceStats({ dateRange: dateRange.value })
    if (res && res.code === 200 && res.data) {
      const d = res.data
      const oc = d.orderCount || 0
      const utc = d.userTotalConsumption || 0
      const avg = oc > 0 ? (utc / oc).toFixed(2) : '0.00'
      fs.value = {
        platformTotalRevenue: d.platformTotalRevenue ?? '—',
        merchantTotalRevenue: d.merchantTotalRevenue ?? '—',
        userTotalConsumption: d.userTotalConsumption ?? '—',
        totalRefundAmount: d.totalRefundAmount ?? '—',
        totalRefundCount: d.totalRefundCount ?? '—',
        netPlatformRevenue: d.netPlatformRevenue ?? '—',
        orderCount: oc,
        avgOrderValue: avg
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
