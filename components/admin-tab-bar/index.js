// 管理员端底部栏：数据概况 / 管理系统 / 管理员信息（因 tabBar 已用于用户端首页/订单/我的，管理员三页用 reLaunch 切换）
Component({
  properties: {
    active: {
      type: String,
      value: 'dashboard'
    }
  },
  data: {
    tabs: [
      { key: 'dashboard', label: '数据概况', icon: '/pages/小标/shouye.png', iconActive: '/pages/小标/shouye-copy.png', url: '/subpackages/admin/pages/admin-dashboard/index' },
      { key: 'management', label: '管理系统', icon: '/pages/小标/商家.png', iconActive: '/pages/小标/商家1.png', url: '/subpackages/admin/pages/admin-management/index' },
      { key: 'profile', label: '管理员信息', icon: '/pages/小标/wode.png', iconActive: '/pages/小标/wode-copy.png', url: '/subpackages/admin/pages/admin-profile/index' }
    ]
  },
  methods: {
    onTabTap(e) {
      const tab = e.currentTarget.dataset.tab;
      if (tab === this.properties.active) return;
      const item = this.data.tabs.find(t => t.key === tab);
      if (!item) return;
      wx.reLaunch({ url: item.url });
    }
  }
});
