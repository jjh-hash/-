Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    userInfo: {
      nickname: "小二货",
      avatar: "https://picsum.photos/seed/avatar/120/120"
    }
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === 'home') {
      wx.navigateTo({
        url: '/pages/home/index'
      });
    } else if (tab === 'order') {
      wx.navigateTo({
        url: '/pages/order/index'
      });
    }
  },

  onMenuTap(e) {
    const type = e.currentTarget.dataset.type;
    switch(type) {
      case 'orders':
        wx.navigateTo({
          url: '/pages/order/index'
        });
        break;
      case 'reviews':
        wx.showToast({
          title: '我的评价功能待开发',
          icon: 'none'
        });
        break;
      case 'address':
        wx.navigateTo({ url: '/pages/address/index' });
        break;
      case 'about':
        wx.showToast({
          title: '关于我们功能待开发',
          icon: 'none'
        });
        break;
      case 'service':
        wx.showModal({
          title: '联系客服',
          content: '客服电话：400-959-8521',
          showCancel: false,
          confirmText: '确定'
        });
        break;
      case 'switch-merchant':
        wx.navigateTo({ url: '/pages/merchant/index' });
        break;
    }
  }
  ,
  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/pages/home/index' });
    }
  }
});
