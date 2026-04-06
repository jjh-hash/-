<template>
  <div class="page">
    <h2>数据统计</h2>
    <div class="tabs">
      <button type="button" :class="{ active: tab === 'overview' }" @click="setTab('overview')">数据概览</button>
      <button type="button" :class="{ active: tab === 'orders' }" @click="setTab('orders')">订单统计</button>
      <button type="button" :class="{ active: tab === 'users' }" @click="setTab('users')">用户统计</button>
      <button type="button" :class="{ active: tab === 'merchants' }" @click="setTab('merchants')">商家统计</button>
    </div>
    <div v-if="tab !== 'overview'" class="toolbar">
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
    <div v-else>
      <div v-if="tab === 'overview'" class="grid">
        <div v-for="(v, k) in flatOverview" :key="k" class="stat">
          <div class="label">{{ k }}</div>
          <div class="value">{{ v }}</div>
        </div>
      </div>
      <pre v-else class="json-dump">{{ jsonPreview }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { statistics } from '../api/admin'
import { isAdminOk } from '../utils/result'

const tab = ref('overview')
const dateRange = ref('week')
const loading = ref(true)
const err = ref('')
const raw = ref(null)

const flatOverview = computed(() => {
  const d = raw.value
  if (!d || typeof d !== 'object') return {}
  const out = {}
  for (const [k, v] of Object.entries(d)) {
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) continue
    out[k] = typeof v === 'number' ? v : v ?? '—'
  }
  return out
})

const jsonPreview = computed(() => {
  try {
    return JSON.stringify(raw.value, null, 2)
  } catch {
    return ''
  }
})

onMounted(load)

function setTab(t) {
  tab.value = t
  load()
}

async function load() {
  loading.value = true
  err.value = ''
  raw.value = null
  try {
    let res
    if (tab.value === 'overview') {
      res = await statistics.getDashboardStats({})
    } else if (tab.value === 'orders') {
      res = await statistics.getAdminOrderStats({ dateRange: dateRange.value })
    } else if (tab.value === 'users') {
      res = await statistics.getAdminUserStats({ dateRange: dateRange.value })
    } else {
      res = await statistics.getAdminMerchantStats({ dateRange: dateRange.value })
    }
    if (isAdminOk(res)) {
      raw.value = res.data || {}
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

<style scoped>
.json-dump {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 1rem;
  font-size: 0.75rem;
  overflow: auto;
  max-height: 70vh;
  color: #8b949e;
}
</style>
