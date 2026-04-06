<template>
  <div class="page">
    <h2>操作日志</h2>
    <p v-if="loading" class="muted">加载中…</p>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>时间</th>
            <th>操作</th>
            <th>目标</th>
            <th>结果</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log._id">
            <td>{{ formatTime(log.createdAt) }}</td>
            <td>{{ log.action }}</td>
            <td>{{ log.target }}</td>
            <td>{{ log.result }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="logs.length === 0" class="muted">暂无记录</p>
      <div class="pager">
        <button type="button" class="btn-sm" :disabled="page <= 1" @click="prev">上一页</button>
        <span>第 {{ page }} 页，共 {{ total }} 条</span>
        <button type="button" class="btn-sm" :disabled="page * pageSize >= total" @click="next">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { adminLogManage } from '../api/admin'

const loading = ref(true)
const logs = ref([])
const page = ref(1)
const pageSize = 20
const total = ref(0)

onMounted(load)

function formatTime(createdAt) {
  if (!createdAt) return '—'
  try {
    const d = new Date(createdAt)
    if (isNaN(d.getTime())) return String(createdAt)
    return d.toLocaleString()
  } catch {
    return String(createdAt)
  }
}

async function load() {
  loading.value = true
  try {
    const res = await adminLogManage.getList({
      page: page.value,
      pageSize
    })
    if (res && res.code === 200 && res.data) {
      logs.value = res.data.list || []
      total.value = res.data.total || 0
    }
  } finally {
    loading.value = false
  }
}

function prev() {
  if (page.value <= 1) return
  page.value--
  load()
}

function next() {
  if (page.value * pageSize >= total.value) return
  page.value++
  load()
}
</script>
