Page({
  data: {
    statusBarHeight: 20
  },

  onLoad() {
    try {
      const systemInfo = wx.getSystemInfoSync();
      this.setData({
        statusBarHeight: systemInfo.statusBarHeight || 20
      });
    } catch (error) {
      console.error('【骑手端】获取状态栏高度失败:', error);
      this.setData({ statusBarHeight: 20 });
    }
  },

  onGoRegister() {
    wx.navigateTo({
      url: '/subpackages/rider/pages/rider-register/index',
      fail: (err) => {
        console.error('跳转骑手注册失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  onGoLogin() {
    wx.navigateTo({
      url: '/subpackages/rider/pages/rider-login/index',
      fail: (err) => {
        console.error('跳转骑手登录失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  onBackTap() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({
        url: '/pages/profile/index',
        fail: () => {
          wx.reLaunch({ url: '/pages/home/index' });
        }
      });
    }
  }
});


