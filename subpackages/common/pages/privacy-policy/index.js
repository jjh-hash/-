Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20
  },
  onLoad() {},
  onBack() {
    wx.navigateBack();
  }
});
