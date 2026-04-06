<template>
  <div class="page">
    <h2>商家管理</h2>
    <div class="toolbar">
      <label>
        状态
        <select v-model="status" class="select" @change="reload">
          <option value="">全部</option>
          <option value="pending">待审核</option>
          <option value="active">已通过</option>
          <option value="suspended">已暂停</option>
          <option value="rejected">已拒绝</option>
        </select>
      </label>
      <label>
        关键词
        <input v-model="keyword" class="input" placeholder="店名/手机" @keyup.enter="reload" />
      </label>
      <button type="button" class="btn-sm" @click="reload">搜索</button>
    </div>
    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="err" class="error">{{ err }}</p>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>店名</th>
            <th>手机</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in merchants" :key="m._id">
            <td>
              <router-link class="link" :to="'/merchants/' + m._id">{{ m.merchantName }}</router-link>
            </td>
            <td>{{ m.contactPhone || '—' }}</td>
            <td>{{ m.status }}</td>
            <td>
              <button v-if="m.status === 'pending'" type="button" class="btn-sm primary" @click="act(m._id, 'approve')">
                通过
              </button>
              <button v-if="m.status === 'pending'" type="button" class="btn-sm danger" @click="act(m._id, 'reject')">
                拒绝
              </button>
              <button v-if="m.status === 'active'" type="button" class="btn-sm" @click="act(m._id, 'suspend')">暂停</button>
              <button v-if="m.status === 'suspended'" type="button" class="btn-sm primary" @click="act(m._id, 'resume')">
                恢复
              </button>
              <button type="button" class="btn-sm danger" @click="del(m)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="merchants.length === 0" class="muted">暂无数据</p>
      <div class="pager">
        <button type="button" class="btn-sm" :disabled="page <= 1" @click="prevPage">上一页</button>
        <span>第 {{ page }} 页 / 共 {{ total }} 条</span>
        <button type="button" class="btn-sm" :disabled="page * pageSize >= total" @click="nextPage">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { merchantManage } from '../api/admin'

const loading = ref(true)
const err = ref('')
const merchants = ref([])
const page = ref(1)
const pageSize = 10
const total = ref(0)
const status = ref('')
const keyword = ref('')

onMounted(load)

function reload() {
  page.value = 1
  load()
}

async function load() {
  loading.value = true
  err.value = ''
  try {
    const res = await merchantManage.getList({
      page: page.value,
      pageSize,
      status: status.value,
      keyword: keyword.value
    })
    if (res && res.code === 200 && res.data) {
      merchants.value = res.data.list || []
      total.value = res.data.total || 0
    } else {
      err.value = (res && res.message) || '加载失败'
      merchants.value = []
    }
  } catch (e) {
    err.value = e.message || '请求异常'
  } finally {
    loading.value = false
  }
}

function prevPage() {
  if (page.value <= 1) return
  page.value -= 1
  load()
}

function nextPage() {
  if (page.value * pageSize >= total.value) return
  page.value += 1
  load()
}

async function act(merchantId, type) {
  const map = {
    approve: () => merchantManage.approve(merchantId),
    reject: () => merchantManage.reject(merchantId),
    suspend: () => merchantManage.suspend(merchantId),
    resume: () => merchantManage.resume(merchantId)
  }
  if (!window.confirm('确认执行该操作？')) return
  const res = await map[type]()
  if (res && res.code === 200) {
    alert(res.message || '成功')
    load()
  } else {
    alert((res && res.message) || '失败')
  }
}

async function del(m) {
  if (!window.confirm(`确定删除商家「${m.merchantName}」？`)) return
  const res = await merchantManage.delete(m._id)
  if (res && res.code === 200) {
    alert('已删除')
    load()
  } else {
    alert((res && res.message) || '失败')
  }
}
</script>
