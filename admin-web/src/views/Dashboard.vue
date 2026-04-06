<template>
  <div class="page">
    <h2>数据概况</h2>
    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="err" class="error">{{ err }}</p>
    <div v-else class="grid">
      <div class="stat">
        <div class="label">总营收（元）</div>
        <div class="value">{{ stats.totalRevenue }}</div>
      </div>
      <div class="stat">
        <div class="label">商家数</div>
        <div class="value">{{ stats.merchantCount }}</div>
      </div>
      <div class="stat">
        <div class="label">订单数</div>
        <div class="value">{{ stats.orderCount }}</div>
      </div>
      <div class="stat">
        <div class="label">用户数</div>
        <div class="value">{{ stats.userCount }}</div>
      </div>
      <div class="stat">
        <div class="label">今日订单</div>
        <div class="value">{{ stats.todayOrderCount }}</div>
      </div>
      <div class="stat">
        <div class="label">待处理订单</div>
        <div class="value">{{ stats.pendingOrders }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { statistics } from '../api/admin'
import { isAdminOk } from '../utils/result'

const loading = ref(true)
const err = ref('')
const stats = ref({
  totalRevenue: '—',
  merchantCount: '—',
  orderCount: '—',
  userCount: '—',
  todayOrderCount: '—',
  pendingOrders: '—'
})

onMounted(load)

function mapOverview(d) {
  return {
    totalRevenue: d.totalRevenue ?? '—',
    merchantCount: d.merchantCount ?? '—',
    orderCount: d.orderCount ?? '—',
    userCount: d.userCount ?? '—',
    todayOrderCount: d.todayOrderCount ?? '—',
    pendingOrders: d.pendingOrders ?? '—'
  }
}

async function load() {
  loading.value = true
  err.value = ''
  try {
    let res = await statistics.getDashboardStats({})
    if (isAdminOk(res) && res.data) {
      stats.value = mapOverview(res.data)
      return
    }
    res = await statistics.getAdminOverviewStats({ dateRange: 'week' })
    if (isAdminOk(res) && res.data) {
      stats.value = mapOverview(res.data)
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
