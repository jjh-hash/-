// pages/admin-management/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    
    // 管理功能菜单
    managementMenus: [
      {
        id: 'merchant',
        title: '商家管理',
        icon: '/pages/小标/商家.png',
        description: '审核商家、管理店铺状态',
        color: '#4CAF50'
      },
      {
        id: 'order',
        title: '订单管理',
        icon: '/pages/小标/dingdan.png',
        description: '查看订单、处理异常',
        color: '#FF9800'
      },
      {
        id: 'user',
        title: '用户管理',
        icon: '/pages/小标/wode.png',
        description: '用户信息、权限管理',
        color: '#2196F3'
      },
      {
        id: 'finance',
        title: '财务管理',
        icon: '/pages/小标/关于我们.png',
        description: '收益统计、分账管理',
        color: '#9C27B0'
      },
      {
        id: 'statistics',
        title: '数据统计',
        icon: '/pages/小标/shouye.png',
        description: '销售分析、趋势报告',
        color: '#F44336'
      },
      {
        id: 'settings',
        title: '系统设置',
        icon: '/pages/小标/联系客服.png',
        description: '系统配置、公告管理',
        color: '#607D8B'
      }
    ]
  },

  onLoad() {
    console.log('管理系统页面加载');
  },

  onShow() {
    // 页面显示时刷新
  },

  onBack() {
    wx.navigateBack();
  },

  // 点击管理功能
  onMenuTap(e) {
    const menuId = e.currentTarget.dataset.id;
    
    switch(menuId) {
      case 'merchant':
        wx.navigateTo({
          url: '/subpackages/admin/pages/admin-merchant-list/index'
        });
        break;
      case 'order':
        wx.navigateTo({
          url: '/subpackages/admin/pages/admin-order-list/index'
        });
        break;
      case 'user':
        wx.navigateTo({
          url: '/subpackages/admin/pages/admin-user-list/index'
        });
        break;
      case 'finance':
        wx.navigateTo({
          url: '/subpackages/admin/pages/admin-finance/index'
        });
        break;
      case 'statistics':
        wx.navigateTo({
          url: '/subpackages/admin/pages/admin-statistics/index'
        });
        break;
      case 'settings':
        wx.navigateTo({
          url: '/subpackages/admin/pages/admin-settings/index'
        });
        break;
      default:
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        });
    }
  },

  // 快捷操作
  onQuickAction(e) {
    const action = e.currentTarget.dataset.action;
    
    switch(action) {
      case 'approve':
        wx.navigateTo({
          url: '/subpackages/admin/pages/admin-batch-audit/index'
        });
        break;
      
      case 'export':
        wx.showToast({
          title: '数据导出功能开发中',
          icon: 'none'
        });
        break;
      
      case 'notice':
        // 跳转到系统设置页面发布公告
        wx.navigateTo({
          url: '/subpackages/admin/pages/admin-settings/index?action=publishAnnouncement'
        });
        break;
      
      case 'backup':
        wx.showToast({
          title: '数据备份功能开发中',
          icon: 'none'
        });
        break;
      
      default:
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        });
    }
  }
});