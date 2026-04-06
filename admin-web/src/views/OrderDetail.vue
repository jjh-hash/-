<template>
  <div class="page">
    <p>
      <router-link class="link" to="/orders">← 返回订单列表</router-link>
    </p>
    <h2>订单详情</h2>
    <p v-if="loading" class="muted">加载中…</p>
    <p v-else-if="err" class="error">{{ err }}</p>
    <div v-else-if="order" class="detail-grid">
      <div><span class="k">订单号</span> {{ order.orderNo || order.id }}</div>
      <div><span class="k">状态</span> {{ order.statusText || order.orderStatus }}</div>
      <div><span class="k">店铺</span> {{ order.storeName || '—' }}</div>
      <div><span class="k">应付金额</span> {{ order.amountPayable ?? '—' }}</div>
      <div><span class="k">地址</span> {{ addressText || '—' }}</div>
      <div><span class="k">创建时间</span> {{ order.createdAt || '—' }}</div>
      <div v-if="order.refundInfo && order.refundInfo.refundId" class="section-block" style="grid-column: 1 / -1">
        <router-link
          class="link"
          :to="'/refunds/' + order.refundInfo.refundId"
        >
          查看退款详情
        </router-link>
      </div>
      <div style="grid-column: 1 / -1; margin-top: 1rem">
        <button type="button" class="btn-sm primary" @click="doComplete">完成订单</button>
        <button type="button" class="btn-sm danger" @click="doCancel">取消订单</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { orderManage, refundManage } from '../api/admin'
import { isAdminOk } from '../utils/result'

const route = useRoute()
const loading = ref(true)
const err = ref('')
const order = ref(null)
const refundDetail = ref(null)

const addressText = computed(() => {
  const o = order.value
  if (!o) return ''
  if (o.addressText) return o.addressText
  const addr = o.address
  if (!addr && o.storeAddress) return o.storeAddress
  if (!addr) return ''
  const parts = []
  if (addr.buildingName) parts.push(addr.buildingName)
  if (addr.houseNumber) parts.push(addr.houseNumber)
  if (addr.addressDetail) parts.push(addr.addressDetail)
  if (!addr.addressDetail && addr.address) parts.push(addr.address)
  return parts.join('')
})

onMounted(load)

async function load() {
  const orderId = route.params.orderId
  loading.value = true
  err.value = ''
  try {
    const res = await orderManage.getAdminOrderList({
      orderId,
      page: 1,
      pageSize: 1
    })
    if (isAdminOk(res) && res.data) {
      const list = res.data.list || []
      const row = list[0]
      if (!row || (row.id !== orderId && row._id !== orderId)) {
        err.value = '订单不存在'
        order.value = null
        return
      }
      order.value = row
      if (row.refundInfo && row.refundInfo.refundId) {
        try {
          const r = await refundManage.getRefundDetail({
            refundId: row.refundInfo.refundId
          })
          if (r && r.code === 200) {
            refundDetail.value = r.data
          }
        } catch (_) {
          /* optional */
        }
      }
    } else {
      err.value = (res && res.message) || '加载失败'
    }
  } catch (e) {
    err.value = e.message || '请求异常'
  } finally {
    loading.value = false
  }
}

async function doCancel() {
  if (!order.value) return
  const id = order.value.id || order.value._id
  if (!window.confirm('确定取消该订单？')) return
  const res = await orderManage.cancelOrder({ orderId: id })
  if (isAdminOk(res)) {
    alert('已取消')
    load()
  } else {
    alert((res && res.message) || '失败')
  }
}

async function doComplete() {
  if (!order.value) return
  const id = order.value.id || order.value._id
  if (!window.confirm('确定完成该订单？')) return
  const res = await orderManage.completeOrder({ orderId: id })
  if (isAdminOk(res)) {
    alert('已完成')
    load()
  } else {
    alert((res && res.message) || '失败')
  }
}
</script>
