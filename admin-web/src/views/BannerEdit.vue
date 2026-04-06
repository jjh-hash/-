<template>
  <div class="page">
    <p><router-link class="link" to="/settings">← 返回系统设置</router-link></p>
    <h2>{{ isEdit ? '编辑轮播' : '新增轮播' }}</h2>
    <div class="form-block">
      <label class="file-line">
        图片
        <input type="file" accept="image/*" @change="onFile" />
      </label>
      <p v-if="uploading" class="muted">上传中…</p>
      <p v-if="previewUrl" class="preview">
        <img :src="previewUrl" alt="预览" style="max-width: 320px; border-radius: 8px" />
      </p>
      <p v-if="form.imageUrl" class="muted">fileID: {{ form.imageUrl }}</p>
      <label>
        跳转链接
        <input v-model="form.linkUrl" class="input" style="width: 100%; max-width: 480px" />
      </label>
      <label class="chk">
        <input v-model="active" type="checkbox" />
        启用
      </label>
      <div style="margin-top: 1rem">
        <button type="button" class="btn-sm primary" :disabled="saving || !form.imageUrl" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { bannerManage } from '../api/admin'
import { uploadBannerImageFile, getTempFileUrls } from '../cloud'

const route = useRoute()
const router = useRouter()

const mode = computed(() => (route.query.mode === 'edit' ? 'edit' : 'add'))
const bannerId = computed(() => route.query.bannerId || '')
const isEdit = computed(() => mode.value === 'edit' && bannerId.value)

const form = ref({
  imageUrl: '',
  linkUrl: '',
  status: 'active'
})
const active = ref(true)
const previewUrl = ref('')
const uploading = ref(false)
const saving = ref(false)

onMounted(async () => {
  if (isEdit.value) {
    const res = await bannerManage.getList({})
    if (res && res.code === 200 && res.data) {
      const b = (res.data.list || []).find((x) => x._id === bannerId.value)
      if (b) {
        form.value = {
          imageUrl: b.imageUrl || '',
          linkUrl: b.linkUrl || '',
          status: b.status || 'active'
        }
        active.value = b.status !== 'inactive'
        if (b.imageUrl && String(b.imageUrl).startsWith('cloud://')) {
          const urls = await getTempFileUrls([b.imageUrl])
          previewUrl.value = urls[0] || ''
        } else if (b.imageUrl) {
          previewUrl.value = b.imageUrl
        }
      }
    }
  }
})

async function onFile(e) {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  uploading.value = true
  try {
    const fileID = await uploadBannerImageFile(file)
    form.value.imageUrl = fileID
    const urls = await getTempFileUrls([fileID])
    previewUrl.value = urls[0] || URL.createObjectURL(file)
  } catch (err) {
    alert(err.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function save() {
  form.value.status = active.value ? 'active' : 'inactive'
  saving.value = true
  try {
    let res
    if (isEdit.value) {
      res = await bannerManage.update({
        bannerId: bannerId.value,
        ...form.value
      })
    } else {
      res = await bannerManage.create({ ...form.value })
    }
    if (res && res.code === 200) {
      alert('保存成功')
      router.push('/settings')
    } else {
      alert((res && res.message) || '保存失败')
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.form-block {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 520px;
}
.file-line {
  font-size: 0.9rem;
  color: #8b949e;
}
.chk {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}
</style>
