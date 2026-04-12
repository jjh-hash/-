const { normalizeHomeCampus, STORAGE_KEY, CAMPUS_BAISHA } = require('../../../../utils/homeCampusStorage');

Page({
  data: {
    statusBarHeight: 20
  },

  onLoad(options) {
    // 页面加载时初始化
    console.log('【商家端页面】页面加载完成');
    try {
      // 获取系统信息，确保状态栏高度正确设置
      const systemInfo = wx.getSystemInfoSync();
      this.setData({
        statusBarHeight: systemInfo.statusBarHeight || 20
      });
      console.log('【商家端页面】状态栏高度:', systemInfo.statusBarHeight);
    } catch (error) {
      console.error('【商家端页面】初始化失败:', error);
      // 设置默认值
      this.setData({
        statusBarHeight: 20
      });
    }
  },

  onShow() {
    // 页面显示时刷新
    console.log('【商家端页面】页面显示');
  },

  onReady() {
    // 页面渲染完成
    console.log('【商家端页面】页面渲染完成');
  },

  onGoRegister() {
    const c = encodeURIComponent(normalizeHomeCampus(wx.getStorageSync(STORAGE_KEY)) || CAMPUS_BAISHA);
    wx.navigateTo({ 
      url: `/subpackages/merchant/pages/merchant-register/index?campus=${c}`,
      fail: (err) => {
        console.error('跳转到注册页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  onGoLogin() {
    wx.navigateTo({ 
      url: '/subpackages/merchant/pages/merchant-login/index',
      fail: (err) => {
        console.error('跳转到登录页面失败:', err);
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
        fail: (err) => {
          console.error('返回失败:', err);
          wx.reLaunch({ url: '/pages/home/index' });
        }
      });
    }
  }
});
