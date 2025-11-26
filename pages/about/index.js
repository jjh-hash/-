Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20
  },

  onLoad() {
    // 页面加载
  },

  onBack() {
    wx.navigateBack();
  }
});

