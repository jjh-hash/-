<template>
  <div class="page">
    <p><router-link class="link" to="/users">← 返回列表</router-link></p>
    <h2>用户详情</h2>
    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="err" class="error">{{ err }}</p>
    <div v-else-if="user">
      <div class="toolbar">
        <button
          v-if="user.status !== 'banned'"
          type="button"
          class="btn-sm danger"
          @click="ban"
        >
          封禁
        </button>
        <button v-else type="button" class="btn-sm primary" @click="unban">解封</button>
      </div>
      <div class="detail-grid">
        <div><span class="k">昵称</span> {{ user.nickname }}</div>
        <div><span class="k">手机</span> {{ user.phone || '—' }}</div>
        <div><span class="k">校区</span> {{ user.campus || '—' }}</div>
        <div><span class="k">状态</span> {{ user.status }}</div>
        <div><span class="k">订单数</span> {{ orderCount }}</div>
      </div>
      <div v-if="riderInfo && riderInfo.isRider" class="section-block">
        <h3>骑手信息</h3>
        <div class="detail-grid">
          <div><span class="k">姓名</span> {{ riderInfo.name }}</div>
          <div><span class="k">手机</span> {{ riderInfo.phone }}</div>
          <div><span class="k">审核状态</span> {{ riderInfo.status }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { userManage } from '../api/admin'

const route = useRoute()
const loading = ref(true)
const err = ref('')
const user = ref(null)
const orderCount = ref(0)
const riderInfo = ref(null)

onMounted(load)

async function load() {
  const userId = route.params.id
  loading.value = true
  err.value = ''
  try {
    const res = await userManage.getDetail({ userId })
    if (res && res.code === 200 && res.data) {
      user.value = res.data.user
      orderCount.value = res.data.orderCount || 0
      riderInfo.value = res.data.riderInfo || { isRider: false }
    } else {
      err.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    err.value = e.message || '请求异常'
  } finally {
    loading.value = false
  }
}

async function ban() {
  const reason = window.prompt('封禁原因', '') || ''
  const res = await userManage.banUser({ userId: route.params.id, reason })
  if (res && res.code === 200) {
    alert('已封禁')
    load()
  } else {
    alert((res && res.message) || '失败')
  }
}

async function unban() {
  const res = await userManage.unbanUser({ userId: route.params.id })
  if (res && res.code === 200) {
    alert('已解封')
    load()
  } else {
    alert((res && res.message) || '失败')
  }
}
</script>
