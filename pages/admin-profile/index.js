// pages/admin-profile/index.js
Page({
  data: {
    currentTab: 2 // 当前选中的底部导航标签
  },

  onLoad() {
    console.log('管理员信息页面加载');
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
        wx.navigateTo({
          url: '/pages/admin-dashboard/index'
        });
        break;
      case 1:
        // 管理系统
        wx.navigateTo({
          url: '/pages/admin-management/index'
        });
        break;
      case 2:
        // 管理员信息 - 当前页面
        break;
    }
  }
});