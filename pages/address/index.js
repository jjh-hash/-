Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    addresses: []
  },

  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.reLaunch({ url: '/pages/profile/index' });
  },

  onAdd() {
    wx.navigateTo({
      url: '/pages/add-address/index'
    });
  }
});

