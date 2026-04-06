<template>
  <div class="page">
    <p><router-link class="link" to="/merchants">← 返回列表</router-link></p>
    <h2>商家详情</h2>
    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="err" class="error">{{ err }}</p>
    <div v-else-if="merchant">
      <div class="toolbar">
        <button v-if="merchant.status === 'pending'" type="button" class="btn-sm primary" @click="act('approve')">
          通过
        </button>
        <button v-if="merchant.status === 'pending'" type="button" class="btn-sm danger" @click="act('reject')">
          拒绝
        </button>
        <button v-if="merchant.status === 'active'" type="button" class="btn-sm" @click="act('suspend')">暂停</button>
        <button v-if="merchant.status === 'suspended'" type="button" class="btn-sm primary" @click="act('resume')">
          恢复
        </button>
      </div>
      <div class="detail-grid">
        <div><span class="k">店名</span> {{ merchant.merchantName }}</div>
        <div><span class="k">手机</span> {{ merchant.contactPhone }}</div>
        <div><span class="k">状态</span> {{ merchant.status }}</div>
        <div><span class="k">申请时间</span> {{ merchant.createdAt || '—' }}</div>
      </div>
      <div v-if="storeInfo" class="section-block">
        <h3>店铺信息</h3>
        <div class="detail-grid">
          <div><span class="k">名称</span> {{ storeInfo.storeName || storeInfo.name || '—' }}</div>
          <div><span class="k">地址</span> {{ storeInfo.address || '—' }}</div>
        </div>
      </div>
      <div v-if="products.length" class="section-block">
        <h3>商品（{{ products.length }}）</h3>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>名称</th>
                <th>价格</th>
                <th>审核</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in products" :key="p._id || p.id">
                <td>{{ p.name || p.title }}</td>
                <td>{{ p.price }}</td>
                <td>{{ p.auditStatus }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { merchantManage } from '../api/admin'

const route = useRoute()
const loading = ref(true)
const err = ref('')
const merchant = ref(null)
const storeInfo = ref(null)
const products = ref([])

onMounted(load)

async function load() {
  const merchantId = route.params.id
  loading.value = true
  err.value = ''
  try {
    const res = await merchantManage.getDetail({ merchantId })
    if (res && res.code === 200 && res.data) {
      merchant.value = res.data.merchant
      storeInfo.value = res.data.storeInfo
      products.value = res.data.products || []
    } else {
      err.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    err.value = e.message || '请求异常'
  } finally {
    loading.value = false
  }
}

async function act(type) {
  const id = route.params.id
  const map = {
    approve: () => merchantManage.approve(id),
    reject: () => merchantManage.reject(id),
    suspend: () => merchantManage.suspend(id),
    resume: () => merchantManage.resume(id)
  }
  if (!window.confirm('确认？')) return
  const res = await map[type]()
  if (res && res.code === 200) {
    alert(res.message || '成功')
    load()
  } else {
    alert((res && res.message) || '失败')
  }
}
</script>
