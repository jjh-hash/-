<template>
  <div class="page">
    <h2>订单管理</h2>
    <div class="toolbar">
      <label>
        类型
        <select v-model="category" class="select" @change="reload">
          <option value="all">全部</option>
          <option value="restaurant">餐饮</option>
          <option value="gaming">游戏陪玩</option>
          <option value="reward">跑腿</option>
          <option value="express">代拿快递</option>
        </select>
      </label>
      <label>
        状态
        <select v-model="filter" class="select" @change="reload">
          <option value="all">全部</option>
          <option value="unpaid">待支付</option>
          <option value="paid">已支付</option>
          <option value="completed">已完成</option>
          <option value="cancelled">已取消</option>
          <option value="refunding">退款中</option>
          <option value="refunded">已退款</option>
        </select>
      </label>
      <button type="button" class="btn-sm" @click="reload">刷新</button>
    </div>
    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="err" class="error">{{ err }}</p>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>订单号</th>
            <th>店铺</th>
            <th>状态</th>
            <th>金额</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td>
              <router-link class="link" :to="'/orders/' + row.id">{{ row.orderNo }}</router-link>
            </td>
            <td>{{ row.storeName }}</td>
            <td>{{ row.statusText }}</td>
            <td>{{ row.amountPayable }}</td>
            <td>{{ row.createdAt }}</td>
            <td>
              <button type="button" class="btn-sm" @click="doComplete(row.id)">完成</button>
              <button type="button" class="btn-sm danger" @click="doCancel(row.id)">取消</button>
            </td>
          </tr>
        </tbody>
      </table>
      <p v-if="rows.length === 0" class="muted">暂无数据</p>
      <div class="pager">
        <button type="button" class="btn-sm" :disabled="page <= 1" @click="prevPage">上一页</button>
        <span>第 {{ page }} 页</span>
        <button type="button" class="btn-sm" :disabled="!hasMore" @click="nextPage">下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { orderManage } from '../api/admin'
import { isAdminOk } from '../utils/result'

const loading = ref(true)
const err = ref('')
const rows = ref([])
const page = ref(1)
const pageSize = 20
const hasMore = ref(false)
const category = ref('all')
const filter = ref('all')

onMounted(load)

function reload() {
  page.value = 1
  load()
}

async function load() {
  loading.value = true
  err.value = ''
  try {
    const res = await orderManage.getAdminOrderList({
      category: category.value,
      filter: filter.value,
      page: page.value,
      pageSize
    })
    if (isAdminOk(res) && res.data) {
      let list = res.data.list || []
      if (category.value !== 'all') {
        list = list.filter((order) => {
          if (category.value === 'restaurant') {
            return order.orderType === 'normal' || (!order.orderType && order.storeId)
          }
          return order.orderType === category.value
        })
      }
      rows.value = list.map((o) => ({
        id: o.id || o._id,
        orderNo: o.orderNo || o.id,
        storeName: o.storeName || '—',
        statusText: o.statusText || o.orderStatus || '—',
        amountPayable: o.amountPayable != null ? o.amountPayable : '—',
        createdAt: o.createdAt || '—'
      }))
      hasMore.value = !!res.data.hasMore
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
  if (!hasMore.value) return
  page.value += 1
  load()
}

async function doCancel(orderId) {
  if (!window.confirm('确定取消该订单？')) return
  const res = await orderManage.cancelOrder({ orderId })
  if (isAdminOk(res)) {
    alert('订单已取消')
    load()
  } else {
    alert((res && res.message) || '操作失败')
  }
}

async function doComplete(orderId) {
  if (!window.confirm('确定将订单标为已完成？')) return
  const res = await orderManage.completeOrder({ orderId })
  if (isAdminOk(res)) {
    alert('订单已完成')
    load()
  } else {
    alert((res && res.message) || '操作失败')
  }
}
</script>
