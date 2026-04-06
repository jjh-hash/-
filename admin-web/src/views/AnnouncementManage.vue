<template>
  <div class="page">
    <h2>公告管理</h2>
    <div class="toolbar">
      <button type="button" class="btn-sm primary" @click="openCreate">新建公告</button>
      <button type="button" class="btn-sm" @click="load">刷新</button>
    </div>
    <p v-if="loading" class="muted">加载中…</p>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>标题</th>
            <th>范围</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in list" :key="a._id">
            <td>{{ a.title }}</td>
            <td>{{ a.targetType }}</td>
            <td>{{ a.status }}</td>
            <td>
              <button type="button" class="btn-sm" @click="edit(a)">编辑</button>
              <button type="button" class="btn-sm danger" @click="remove(a._id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showModal" class="modal-backdrop" @click.self="showModal = false">
      <div class="modal">
        <h3>{{ editing ? '编辑公告' : '新建公告' }}</h3>
        <label v-if="!editing">
          范围
          <select v-model="form.targetType" class="select">
            <option value="client">客户端</option>
            <option value="all">全部</option>
            <option value="merchant">商家端</option>
          </select>
        </label>
        <label>
          标题
          <input v-model="form.title" class="input" style="width: 100%" />
        </label>
        <label>
          内容
          <textarea v-model="form.content" class="textarea" rows="5" style="width: 100%" />
        </label>
        <label class="chk">
          <input v-model="formActive" type="checkbox" />
          启用
        </label>
        <div class="modal-actions">
          <button type="button" class="btn-sm" @click="showModal = false">取消</button>
          <button type="button" class="btn-sm primary" @click="submit">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { announcementManage } from '../api/admin'

const loading = ref(true)
const list = ref([])
const showModal = ref(false)
const editing = ref(false)
const formActive = ref(true)
const form = ref({
  title: '',
  content: '',
  status: 'active',
  priority: 0,
  targetType: 'all'
})
const editId = ref('')

const typeTitles = {
  client: '客户端公告',
  all: '全部公告',
  merchant: '商家端公告'
}

onMounted(load)

async function load() {
  loading.value = true
  try {
    const res = await announcementManage.getList({})
    if (res && res.code === 200 && res.data) {
      list.value = res.data.list || []
    }
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = false
  editId.value = ''
  form.value = {
    title: typeTitles.all,
    content: '',
    status: 'active',
    priority: 0,
    targetType: 'all'
  }
  formActive.value = true
  showModal.value = true
}

function edit(a) {
  editing.value = true
  editId.value = a._id
  form.value = {
    title: a.title,
    content: a.content,
    status: a.status || 'active',
    priority: a.priority || 0,
    targetType: a.targetType || 'all'
  }
  formActive.value = a.status !== 'inactive'
  showModal.value = true
}

async function submit() {
  form.value.status = formActive.value ? 'active' : 'inactive'
  if (!form.value.title?.trim() || !form.value.content?.trim()) {
    alert('请填写标题和内容')
    return
  }
  let res
  if (editing.value) {
    res = await announcementManage.update({
      announcementId: editId.value,
      ...form.value
    })
  } else {
    form.value.title = typeTitles[form.value.targetType] || form.value.title
    res = await announcementManage.create({ ...form.value })
  }
  if (res && res.code === 200) {
    showModal.value = false
    load()
  } else {
    alert((res && res.message) || '失败')
  }
}

async function remove(id) {
  if (!window.confirm('删除该公告？')) return
  const res = await announcementManage.delete(id)
  if (res && res.code === 200) {
    load()
  } else {
    alert((res && res.message) || '失败')
  }
}
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: 1rem;
}
.modal {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 1.25rem;
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.modal h3 {
  margin: 0;
}
.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
}
.chk {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: #8b949e;
}
</style>
