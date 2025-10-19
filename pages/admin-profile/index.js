// pages/admin-profile/index.js
Page({
  data: {
    currentTab: 2 // 当前选中的底部导航标签
  },

  onLoad() {
    console.log('管理员信息页面加载');
  },

  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出管理后台吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('adminToken');
          wx.reLaunch({
            url: '/pages/merchant-register/index'
          });
        }
      }
    });
  },

  onMenuClick(e) {
    const menu = e.currentTarget.dataset.menu;
    
    switch(menu) {
      case 'merchant':
        wx.navigateTo({
          url: '/pages/admin-merchant-list/index'
        });
        break;
      case 'statistics':
        wx.navigateTo({
          url: '/pages/admin-statistics/index'
        });
        break;
      case 'settings':
        wx.showToast({
          title: '系统设置功能开发中',
          icon: 'none'
        });
        break;
      case 'logs':
        wx.showToast({
          title: '操作日志功能开发中',
          icon: 'none'
        });
        break;
      default:
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        });
    }
  },

  // 底部导航切换
  onTabChange(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    this.setData({
      currentTab: index
    });
    
    switch(index) {
      case 0:
        // 数据概况
        wx.redirectTo({
          url: '/pages/admin-dashboard/index'
        });
        break;
      case 1:
        // 订单管理
        wx.redirectTo({
          url: '/pages/admin-order-list/index'
        });
        break;
      case 2:
        // 管理员信息 - 当前页面
        break;
    }
  }
});