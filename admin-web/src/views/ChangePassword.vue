<template>
  <div class="page">
    <h2>修改密码</h2>
    <div class="login-card" style="margin: 1rem 0; max-width: 420px">
      <label>登录账号</label>
      <input v-model="username" type="text" class="input" autocomplete="username" />
      <label>旧密码</label>
      <input v-model="oldPassword" type="password" autocomplete="current-password" />
      <label>新密码（最多 10 位）</label>
      <input v-model="newPassword" type="password" autocomplete="new-password" />
      <label>确认新密码</label>
      <input v-model="confirmPassword" type="password" autocomplete="new-password" />
      <p v-if="error" class="error">{{ error }}</p>
      <button type="button" class="btn-primary" :disabled="loading" @click="submit">
        {{ loading ? '提交中…' : '保存' }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getStoredAdminUsername, adminLogoutCloud } from '../cloud'
import { adminManage } from '../api/admin'

const router = useRouter()
const username = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')

onMounted(() => {
  username.value = getStoredAdminUsername()
})

async function submit() {
  error.value = ''
  if (!oldPassword.value.trim()) {
    error.value = '请输入旧密码'
    return
  }
  if (!newPassword.value.trim()) {
    error.value = '请输入新密码'
    return
  }
  if (newPassword.value.length > 10) {
    error.value = '新密码不能超过 10 位'
    return
  }
  if (newPassword.value === oldPassword.value) {
    error.value = '新密码不能与旧密码相同'
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = '两次输入不一致'
    return
  }
  loading.value = true
  try {
    const res = await adminManage.changePassword({
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
      username: username.value.trim() || undefined
    })
    if (res && res.code === 200) {
      alert('密码已修改，请重新登录')
      await adminLogoutCloud()
      router.replace({ name: 'login' })
    } else {
      error.value = (res && res.message) || '修改失败'
    }
  } catch (e) {
    error.value = e.message || '网络异常'
  } finally {
    loading.value = false
  }
}
</script>
