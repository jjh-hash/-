<template>
  <div class="page">
    <h2>用户管理</h2>
    <div class="toolbar">
      <label>
        状态
        <select v-model="status" class="select" @change="reload">
          <option value="">全部</option>
          <option value="active">正常</option>
          <option value="banned">已封禁</option>
        </select>
      </label>
      <label>
        校区
        <select v-model="campus" class="select" @change="reload">
          <option value="">全部</option>
          <option value="unset">未设置</option>
          <option value="白沙校区">白沙校区</option>
          <option value="金水校区">金水校区</option>
        </select>
      </label>
      <label>
        关键词
        <input v-model="keyword" class="input" placeholder="昵称/手机" @keyup.enter="reload" />
      </label>
      <button type="button" class="btn-sm" @click="reload">搜索</button>
    </div>
    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="err" class="error">{{ err }}</p>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>昵称</th>
            <th>手机</th>
            <th>校区</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u._id">
            <td>
              <router-link class="link" :to="'/users/' + u._id">{{ u.nickname || '—' }}</router-link>
            </td>
            <td>{{ u.phone || '—' }}</td>
            <td>{{ u.campus || '—' }}</td>
            <td>{{ u.status }}</td>
            <td>
              <button
                v-if="u.status !== 'banned'"
                type="button"
                class="btn-sm danger"
                @click="ban(u._id)"
              >
                封禁
              </button>
              <button v-else type="button" class="btn-sm primary" @click="unban(u._id)">解封</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="users.length === 0" class="muted">暂无数据</p>
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
import { userManage } from '../api/admin'

const loading = ref(true)
const err = ref('')
const users = ref([])
const page = ref(1)
const pageSize = 20
const total = ref(0)
const status = ref('')
const campus = ref('')
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
    const res = await userManage.getList({
      page: page.value,
      pageSize,
      status: status.value,
      campus: campus.value,
      keyword: keyword.value
    })
    if (res && res.code === 200 && res.data) {
      users.value = res.data.list || []
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

async function ban(userId) {
  const reason = window.prompt('封禁原因（可选）', '') || ''
  if (!window.confirm('确认封禁该用户？')) return
  const res = await userManage.banUser({ userId, reason })
  if (res && res.code === 200) {
    alert('已封禁')
    load()
  } else {
    alert((res && res.message) || '失败')
  }
}

async function unban(userId) {
  if (!window.confirm('确认解封？')) return
  const res = await userManage.unbanUser({ userId })
  if (res && res.code === 200) {
    alert('已解封')
    load()
  } else {
    alert((res && res.message) || '失败')
  }
}
</script>
