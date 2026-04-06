<template>
  <div class="page">
    <h2>系统设置</h2>
    <p v-if="loading" class="muted">加载中…</p>
    <template v-else>
      <div class="section-block">
        <h3>平台参数</h3>
        <div class="form-grid">
          <label>服务费（%） <input v-model.number="cfg.platformFeePercent" class="input" type="number" step="0.1" /></label>
          <label>配送费（元） <input v-model.number="cfg.deliveryFeeYuan" class="input" type="number" step="0.01" /></label>
          <label>最低订单（元） <input v-model.number="cfg.minOrderYuan" class="input" type="number" step="0.01" /></label>
          <label>预计送达（分钟） <input v-model.number="cfg.estimatedDeliveryMinutes" class="input" type="number" /></label>
          <label>订单超时（分钟） <input v-model.number="cfg.orderTimeoutMinutes" class="input" type="number" /></label>
        </div>
        <button type="button" class="btn-sm primary" style="margin-top: 0.75rem" @click="saveConfig">保存平台配置</button>
      </div>

      <div class="section-block">
        <h3>邀请码</h3>
        <button type="button" class="btn-sm" @click="createInvite">生成邀请码</button>
        <div class="table-wrap" style="margin-top: 0.75rem">
          <table class="table">
            <thead>
              <tr>
                <th>码</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in inviteCodes" :key="c._id">
                <td>{{ c.code }}</td>
                <td>{{ c.status || '—' }}</td>
                <td>
                  <button type="button" class="btn-sm danger" @click="removeInvite(c._id)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="section-block">
        <h3>轮播图</h3>
        <router-link class="link btn-sm" to="/banners/edit?mode=add" style="display: inline-block">新增轮播</router-link>
        <div class="table-wrap" style="margin-top: 0.75rem">
          <table class="table">
            <thead>
              <tr>
                <th>图片</th>
                <th>链接</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="b in banners" :key="b._id">
                <td><span class="muted">{{ b.imageUrl }}</span></td>
                <td>{{ b.linkUrl || '—' }}</td>
                <td>{{ b.status }}</td>
                <td>
                  <router-link class="link" :to="'/banners/edit?mode=edit&bannerId=' + b._id">编辑</router-link>
                  <button type="button" class="btn-sm danger" @click="removeBanner(b._id)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="section-block">
        <h3>公告（简要列表）</h3>
        <p class="muted">完整编辑请使用侧栏「公告管理」</p>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>标题</th>
                <th>范围</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="a in announcements" :key="a._id">
                <td>{{ a.title }}</td>
                <td>{{ a.targetType }}</td>
                <td>
                  <button type="button" class="btn-sm danger" @click="removeAnn(a._id)">删除</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import {
  platformConfig,
  inviteCodeManage,
  bannerManage,
  announcementManage
} from '../api/admin'

const loading = ref(true)
const cfg = ref({
  platformFeePercent: 8,
  deliveryFeeYuan: 3,
  minOrderYuan: 20,
  estimatedDeliveryMinutes: 30,
  orderTimeoutMinutes: 15
})
const inviteCodes = ref([])
const banners = ref([])
const announcements = ref([])

onMounted(loadAll)

async function loadAll() {
  loading.value = true
  try {
    const cr = await platformConfig.getConfig({})
    if (cr && cr.code === 200 && cr.data) {
      const c = cr.data
      cfg.value = {
        platformFeePercent: (c.platformFeeRate || 0.08) * 100,
        deliveryFeeYuan: (c.deliveryFee || 300) / 100,
        minOrderYuan: (c.minOrderAmountLimit || 2000) / 100,
        estimatedDeliveryMinutes: c.estimatedDeliveryMinutes || 30,
        orderTimeoutMinutes: c.orderTimeoutMinutes || 15
      }
    }
    const ir = await inviteCodeManage.getList({})
    if (ir && ir.code === 200 && ir.data) {
      inviteCodes.value = ir.data.list || []
    }
    const br = await bannerManage.getList({})
    if (br && br.code === 200 && br.data) {
      banners.value = br.data.list || []
    }
    const ar = await announcementManage.getList({})
    if (ar && ar.code === 200 && ar.data) {
      announcements.value = ar.data.list || []
    }
  } finally {
    loading.value = false
  }
}

async function saveConfig() {
  const v = cfg.value
  const res = await platformConfig.updateConfig({
    platformFeeRate: v.platformFeePercent / 100,
    deliveryFee: String(v.deliveryFeeYuan),
    minOrderAmountLimit: String(v.minOrderYuan),
    estimatedDeliveryMinutes: v.estimatedDeliveryMinutes,
    orderTimeoutMinutes: v.orderTimeoutMinutes
  })
  if (res && res.code === 200) {
    alert('保存成功')
    loadAll()
  } else {
    alert((res && res.message) || '保存失败')
  }
}

function randomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let s = ''
  for (let i = 0; i < 8; i++) {
    s += chars[Math.floor(Math.random() * chars.length)]
  }
  return s
}

async function createInvite() {
  const daysStr = window.prompt('有效天数', '30')
  const days = parseInt(daysStr, 10)
  if (!days || days <= 0) {
    alert('请输入有效天数')
    return
  }
  const code = randomCode()
  const res = await inviteCodeManage.create({
    code,
    maxUses: 1,
    description: '平台邀请码',
    expiredDays: days
  })
  if (res && res.code === 200) {
    alert(`创建成功：${code}，${days} 天有效`)
    loadAll()
  } else {
    alert((res && res.message) || '失败')
  }
}

async function removeInvite(codeId) {
  if (!window.confirm('删除该邀请码？')) return
  const res = await inviteCodeManage.delete(codeId)
  if (res && res.code === 200) {
    loadAll()
  } else {
    alert((res && res.message) || '失败')
  }
}

async function removeBanner(bannerId) {
  if (!window.confirm('删除该轮播？')) return
  const res = await bannerManage.delete(bannerId)
  if (res && res.code === 200) {
    loadAll()
  } else {
    alert((res && res.message) || '失败')
  }
}

async function removeAnn(announcementId) {
  if (!window.confirm('删除该公告？')) return
  const res = await announcementManage.delete(announcementId)
  if (res && res.code === 200) {
    loadAll()
  } else {
    alert((res && res.message) || '失败')
  }
}
</script>

<style scoped>
.form-grid {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  max-width: 360px;
}
.form-grid label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: #8b949e;
}
</style>
