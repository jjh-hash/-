<template>
  <div class="login-card">
    <h1>管理员登录</h1>
    <p class="hint">使用与小程序管理端相同的账号密码（云函数 adminManage / admin_accounts）</p>
    <label>账号</label>
    <input v-model="username" type="text" autocomplete="username" placeholder="用户名" />
    <label>密码</label>
    <input v-model="password" type="password" autocomplete="current-password" placeholder="密码" />
    <p v-if="error" class="error">{{ error }}</p>
    <button type="button" class="btn-primary" :disabled="loading" @click="submit">
      {{ loading ? '登录中…' : '登录' }}
    </button>
    <p class="foot-note">
      部署后请在微信云开发控制台将本站域名加入「Web 安全域名」，并开启「匿名登录」以便浏览器调用云函数。
    </p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminPasswordLogin, getStoredSessionToken } from '../cloud'

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const route = useRoute()
const router = useRouter()

onMounted(() => {
  if (getStoredSessionToken()) {
    const r = route.query.redirect
    const path = typeof r === 'string' && r.startsWith('/') ? r : '/'
    router.replace(path)
  }
})

async function submit() {
  error.value = ''
  if (!password.value) {
    error.value = '请输入密码'
    return
  }
  loading.value = true
  try {
    const res = await adminPasswordLogin(username.value || undefined, password.value)
    if (res && res.code === 200) {
      const redir = route.query.redirect
      const path = typeof redir === 'string' && redir.startsWith('/') ? redir : '/'
      router.replace(path)
    } else {
      error.value = (res && res.message) || '登录失败'
    }
  } catch (e) {
    error.value = e.message || '网络异常'
  } finally {
    loading.value = false
  }
}
</script>
