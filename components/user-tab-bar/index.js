// 用户端底部栏：首页/个人中心/订单页/任务大厅共用，保证高亮与跳转一致
Component({
  properties: {
    // 当前选中的 tab：'home' | 'order' | 'profile'（variant=user）或 'home' | 'task-hall' | 'profile'（variant=task）
    active: {
      type: String,
      value: 'home'
    },
    // 变体：'user' = 首页|订单|我的，'task' = 首页|任务大厅|我的
    variant: {
      type: String,
      value: 'user'
    }
  },

  data: {
    tabsUser: [
      { key: 'home', label: '首页', icon: '/pages/小标/shouyeweixuan.png', iconActive: '/pages/小标/shouyeyixuan.png' },
      { key: 'order', label: '订单', icon: '/pages/小标/qucanweixuan.png', iconActive: '/pages/小标/qucanyixuan.png' },
      { key: 'cart', label: '购物车', icon: '/pages/小标/diandanweixuan.png', iconActive: '/pages/小标/diandanyixuan.png' },
      { key: 'profile', label: '我的', icon: '/pages/小标/wodeweixuan.png', iconActive: '/pages/小标/wodeyixuan.png' }
    ],
    tabsTask: [
      { key: 'home', label: '首页', icon: '/pages/小标/shouyeweixuan.png', iconActive: '/pages/小标/shouyeyixuan.png' },
      { key: 'task-hall', label: '任务大厅', icon: '/pages/小标/接单.png', iconActive: '/pages/小标/接单.png' },
      { key: 'profile', label: '我的', icon: '/pages/小标/wodeweixuan.png', iconActive: '/pages/小标/wodeyixuan.png' }
    ]
  },

  methods: {
    onTabTap(e) {
      const tab = e.currentTarget.dataset.tab;
      if (!tab) return;
      this.triggerEvent('tabtap', { tab });
    }
  }
});
