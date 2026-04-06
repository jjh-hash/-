<template>
  <div class="admin-shell">
    <aside class="sidebar">
      <div class="sidebar-brand">校园外卖 · 管理端</div>
      <nav class="side-nav">
        <router-link to="/">数据概况</router-link>
        <router-link to="/merchants">商家管理</router-link>
        <router-link to="/orders">订单管理</router-link>
        <router-link to="/users">用户管理</router-link>
        <router-link to="/finance">财务管理</router-link>
        <router-link to="/statistics">数据统计</router-link>
        <router-link to="/riders">骑手设置</router-link>
        <router-link to="/settings">系统设置</router-link>
        <div class="nav-divider" />
        <router-link to="/batch-audit">批量审核</router-link>
        <router-link to="/announcements">公告管理</router-link>
        <router-link to="/logs">操作日志</router-link>
        <router-link to="/change-password">修改密码</router-link>
      </nav>
    </aside>
    <div class="admin-main-col">
      <header class="admin-top">
        <span class="top-title">{{ title }}</span>
        <button type="button" class="btn-text" @click="onLogout">退出登录</button>
      </header>
      <main class="admin-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminLogoutCloud } from '../cloud'

const route = useRoute()
const router = useRouter()

const title = computed(() => (route.meta && route.meta.title) || '管理后台')

async function onLogout() {
  await adminLogoutCloud()
  router.replace({ name: 'login' })
}
</script>
