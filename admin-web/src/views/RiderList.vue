<template>
  <div class="page">
    <h2>骑手设置</h2>
    <div class="toolbar">
      <label>
        状态
        <select v-model="status" class="select" @change="reload">
          <option value="">全部</option>
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已拒绝</option>
        </select>
      </label>
      <label>
        关键词
        <input v-model="keyword" class="input" placeholder="姓名/手机" @keyup.enter="reload" />
      </label>
      <button type="button" class="btn-sm" @click="reload">搜索</button>
    </div>
    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="err" class="error">{{ err }}</p>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>姓名</th>
            <th>手机</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in riders" :key="r._id">
            <td>{{ r.name }}</td>
            <td>{{ r.phone }}</td>
            <td>{{ r.status }}</td>
            <td>
              <router-link v-if="r.openid" class="link" :to="'/users/' + r.openid">用户详情</router-link>
              <button
                v-if="r.status === 'pending'"
                type="button"
                class="btn-sm primary"
                @click="audit(r, 'approved')"
              >
                通过
              </button>
              <button
                v-if="r.status === 'pending'"
                type="button"
                class="btn-sm danger"
                @click="audit(r, 'rejected')"
              >
                拒绝
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="riders.length === 0" class="muted">暂无数据</p>
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
import { riderManage } from '../api/admin'

const loading = ref(true)
const err = ref('')
const riders = ref([])
const page = ref(1)
const pageSize = 20
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
    const res = await riderManage.getRiderList({
      page: page.value,
      pageSize,
      status: status.value,
      keyword: keyword.value
    })
    if (res && res.code === 200 && res.data) {
      riders.value = res.data.riders || []
      total.value = res.data.total || 0
    } else {
      err.value = (res && res.message) || '加载失败'
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

async function audit(rider, st) {
  if (!window.confirm(st === 'approved' ? '通过该骑手？' : '拒绝该骑手？')) return
  const res = await riderManage.auditRider({
    riderId: rider._id,
    status: st
  })
  if (res && res.code === 200) {
    alert(res.message || '成功')
    load()
  } else {
    alert((res && res.message) || '失败')
  }
}
</script>
