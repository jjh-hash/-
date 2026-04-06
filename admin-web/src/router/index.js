import { createRouter, createWebHistory } from 'vue-router'
import { getStoredSessionToken } from '../cloud'

import Login from '../views/Login.vue'
import AdminLayout from '../layouts/AdminLayout.vue'
import Dashboard from '../views/Dashboard.vue'
import OrderList from '../views/OrderList.vue'
import OrderDetail from '../views/OrderDetail.vue'
import RefundDetail from '../views/RefundDetail.vue'
import MerchantList from '../views/MerchantList.vue'
import MerchantDetail from '../views/MerchantDetail.vue'
import UserList from '../views/UserList.vue'
import UserDetail from '../views/UserDetail.vue'
import RiderList from '../views/RiderList.vue'
import Finance from '../views/Finance.vue'
import Statistics from '../views/Statistics.vue'
import Settings from '../views/Settings.vue'
import BannerEdit from '../views/BannerEdit.vue'
import AnnouncementManage from '../views/AnnouncementManage.vue'
import BatchAudit from '../views/BatchAudit.vue'
import LogList from '../views/LogList.vue'
import ChangePassword from '../views/ChangePassword.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: Login },
    {
      path: '/',
      component: AdminLayout,
      meta: { requiresAuth: true },
      children: [
        { path: '', name: 'dashboard', component: Dashboard, meta: { title: '数据概况' } },
        { path: 'orders', name: 'orders', component: OrderList, meta: { title: '订单管理' } },
        {
          path: 'orders/:orderId',
          name: 'order-detail',
          component: OrderDetail,
          meta: { title: '订单详情' }
        },
        {
          path: 'refunds/:refundId',
          name: 'refund-detail',
          component: RefundDetail,
          meta: { title: '退款详情' }
        },
        { path: 'merchants', name: 'merchants', component: MerchantList, meta: { title: '商家管理' } },
        {
          path: 'merchants/:id',
          name: 'merchant-detail',
          component: MerchantDetail,
          meta: { title: '商家详情' }
        },
        { path: 'users', name: 'users', component: UserList, meta: { title: '用户管理' } },
        { path: 'users/:id', name: 'user-detail', component: UserDetail, meta: { title: '用户详情' } },
        { path: 'riders', name: 'riders', component: RiderList, meta: { title: '骑手设置' } },
        { path: 'finance', name: 'finance', component: Finance, meta: { title: '财务管理' } },
        { path: 'statistics', name: 'statistics', component: Statistics, meta: { title: '数据统计' } },
        { path: 'settings', name: 'settings', component: Settings, meta: { title: '系统设置' } },
        {
          path: 'banners/edit',
          name: 'banner-edit',
          component: BannerEdit,
          meta: { title: '轮播图编辑' }
        },
        {
          path: 'announcements',
          name: 'announcements',
          component: AnnouncementManage,
          meta: { title: '公告管理' }
        },
        { path: 'batch-audit', name: 'batch-audit', component: BatchAudit, meta: { title: '批量审核' } },
        { path: 'logs', name: 'logs', component: LogList, meta: { title: '操作日志' } },
        {
          path: 'change-password',
          name: 'change-password',
          component: ChangePassword,
          meta: { title: '修改密码' }
        }
      ]
    }
  ]
})

router.beforeEach((to) => {
  if (!to.matched.some((r) => r.meta.requiresAuth)) {
    return true
  }
  if (!getStoredSessionToken()) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router
