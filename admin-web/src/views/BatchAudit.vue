<template>
  <div class="page">
    <h2>批量审核</h2>
    <div class="tabs">
      <button type="button" :class="{ active: tab === 'product' }" @click="tab = 'product'; load()">商品</button>
      <button type="button" :class="{ active: tab === 'merchant' }" @click="tab = 'merchant'; load()">商家</button>
    </div>

    <template v-if="tab === 'product'">
      <div class="toolbar">
        <label>
          状态
          <select v-model="productStatus" class="select" @change="reloadProduct">
            <option value="">全部</option>
            <option value="pending">待审核</option>
            <option value="approved">已通过</option>
            <option value="rejected">已拒绝</option>
          </select>
        </label>
      </div>
      <p v-if="loading" class="muted">加载中…</p>
      <div v-else class="table-wrap">
        <p class="muted">已选 {{ selectedProducts.length }} 个</p>
        <table class="table">
          <thead>
            <tr>
              <th><input type="checkbox" @change="toggleAllProducts" /></th>
              <th>商品</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in products" :key="p.id">
              <td>
                <input
                  type="checkbox"
                  :checked="selectedProducts.includes(p.id)"
                  @change="toggleProduct(p.id)"
                />
              </td>
              <td>{{ p.name || p.title || p.id }}</td>
              <td>{{ p.auditStatus }}</td>
            </tr>
          </tbody>
        </table>
        <div class="pager">
          <button type="button" class="btn-sm" :disabled="productPage <= 1" @click="productPage--; loadProducts()">上一页</button>
          <button
            type="button"
            class="btn-sm"
            :disabled="products.length < productPageSize"
            @click="productPage++; loadProducts()"
          >
            下一页
          </button>
        </div>
        <button type="button" class="btn-sm primary" @click="batchProducts('approved')">批量通过</button>
        <button type="button" class="btn-sm danger" @click="batchProducts('rejected')">批量拒绝</button>
      </div>
    </template>

    <template v-else>
      <div class="toolbar">
        <label>
          商家状态
          <select v-model="merchantStatus" class="select" @change="reloadMerchant">
            <option value="pending">待审核</option>
            <option value="active">已通过</option>
            <option value="">全部</option>
          </select>
        </label>
      </div>
      <p v-if="loading" class="muted">加载中…</p>
      <div v-else class="table-wrap">
        <p class="muted">已选 {{ selectedMerchants.length }} 个</p>
        <table class="table">
          <thead>
            <tr>
              <th><input type="checkbox" @change="toggleAllMerchants" /></th>
              <th>店名</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in merchants" :key="m._id">
              <td>
                <input
                  type="checkbox"
                  :checked="selectedMerchants.includes(m._id)"
                  @change="toggleMerchant(m._id)"
                />
              </td>
              <td>{{ m.merchantName }}</td>
              <td>{{ m.status }}</td>
            </tr>
          </tbody>
        </table>
        <div class="pager">
          <button type="button" class="btn-sm" :disabled="merchantPage <= 1" @click="merchantPage--; loadMerchants()">
            上一页
          </button>
          <button
            type="button"
            class="btn-sm"
            :disabled="merchants.length < merchantPageSize"
            @click="merchantPage++; loadMerchants()"
          >
            下一页
          </button>
        </div>
        <button type="button" class="btn-sm primary" @click="batchMerchants('active')">批量通过</button>
        <button type="button" class="btn-sm danger" @click="batchMerchants('rejected')">批量拒绝</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { productManage, merchantManage } from '../api/admin'

const tab = ref('product')
const loading = ref(false)

const products = ref([])
const productPage = ref(1)
const productPageSize = 20
const productStatus = ref('pending')
const selectedProducts = ref([])

const merchants = ref([])
const merchantPage = ref(1)
const merchantPageSize = 20
const merchantStatus = ref('pending')
const selectedMerchants = ref([])

onMounted(load)

function load() {
  selectedProducts.value = []
  selectedMerchants.value = []
  if (tab.value === 'product') {
    reloadProduct()
  } else {
    reloadMerchant()
  }
}

function reloadProduct() {
  productPage.value = 1
  loadProducts()
}

function reloadMerchant() {
  merchantPage.value = 1
  loadMerchants()
}

async function loadProducts() {
  loading.value = true
  try {
    const res = await productManage.getProductsForAudit({
      auditStatus: productStatus.value,
      page: productPage.value,
      pageSize: productPageSize
    })
    if (res && res.code === 200 && res.data) {
      products.value = res.data.products || []
    } else {
      products.value = []
    }
  } finally {
    loading.value = false
  }
}

async function loadMerchants() {
  loading.value = true
  try {
    const res = await merchantManage.getList({
      page: merchantPage.value,
      pageSize: merchantPageSize,
      status: merchantStatus.value
    })
    if (res && res.code === 200 && res.data) {
      merchants.value = res.data.list || []
    } else {
      merchants.value = []
    }
  } finally {
    loading.value = false
  }
}

function toggleProduct(id) {
  const i = selectedProducts.value.indexOf(id)
  if (i >= 0) {
    selectedProducts.value.splice(i, 1)
  } else {
    selectedProducts.value.push(id)
  }
}

function toggleAllProducts(e) {
  if (e.target.checked) {
    selectedProducts.value = products.value.map((p) => p.id).filter(Boolean)
  } else {
    selectedProducts.value = []
  }
}

function toggleMerchant(id) {
  const i = selectedMerchants.value.indexOf(id)
  if (i >= 0) {
    selectedMerchants.value.splice(i, 1)
  } else {
    selectedMerchants.value.push(id)
  }
}

function toggleAllMerchants(e) {
  if (e.target.checked) {
    selectedMerchants.value = merchants.value.map((m) => m._id)
  } else {
    selectedMerchants.value = []
  }
}

async function batchProducts(auditStatus) {
  if (!selectedProducts.value.length) {
    alert('请选择商品')
    return
  }
  let auditReason = ''
  if (auditStatus === 'rejected') {
    auditReason = window.prompt('拒绝原因（可选）', '') || ''
  }
  if (!window.confirm('确认批量操作？')) return
  const res = await productManage.batchAuditProducts({
    productIds: selectedProducts.value,
    auditStatus,
    auditReason
  })
  if (res && res.code === 200) {
    alert(res.message || '成功')
    selectedProducts.value = []
    loadProducts()
  } else {
    alert((res && res.message) || '失败')
  }
}

async function batchMerchants(status) {
  if (!selectedMerchants.value.length) {
    alert('请选择商家')
    return
  }
  if (!window.confirm('确认批量操作？（将逐个请求）')) return
  const action = status === 'active' ? 'approve' : 'reject'
  let ok = 0
  let fail = 0
  for (const merchantId of selectedMerchants.value) {
    try {
      const fn = action === 'approve' ? merchantManage.approve : merchantManage.reject
      const res = await fn(merchantId)
      if (res && res.code === 200) {
        ok++
      } else {
        fail++
      }
    } catch {
      fail++
    }
  }
  alert(`成功 ${ok}，失败 ${fail}`)
  selectedMerchants.value = []
  loadMerchants()
}
</script>
