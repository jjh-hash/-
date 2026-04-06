// pages/admin-user-detail/index.js
// 用户详情页面
const { verifyAdminPage } = require('../../utils/verifyAdminPage.js');

Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    userId: null,
    user: null,
    orderCount: 0,
    riderInfo: null,
    loading: true
  },

  onLoad(options) {
    if (!verifyAdminPage()) return;
    if (options.id) {
      this.setData({ userId: options.id });
      this.loadUserDetail();
    } else {
      wx.showToast({
        title: '用户ID不存在',
        icon: 'none'
      });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  // 加载用户详情
  async loadUserDetail() {
    wx.showLoading({ title: '加载中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'userManage',
        data: {
          action: 'getDetail',
          data: {
            userId: this.data.userId
          }
        }
      });

      wx.hideLoading();

      console.log('【用户详情】加载结果:', res.result);

      if (res.result && res.result.code === 200) {
        // 确保 riderInfo 有默认值
        const riderInfo = res.result.data.riderInfo || { isRider: false };
        
        this.setData({
          user: res.result.data.user,
          orderCount: res.result.data.orderCount || 0,
          riderInfo: riderInfo,
          loading: false
        });
        
        console.log('【用户详情】骑手信息:', riderInfo);
      } else {
        wx.showToast({
          title: res.result.message || '加载失败',
          icon: 'none'
        });
        setTimeout(() => wx.navigateBack(), 1500);
      }
    } catch (err) {
      wx.hideLoading();
      console.error('【用户详情】加载失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      setTimeout(() => wx.navigateBack(), 1500);
    }
  },

  // 预览头像
  onPreviewAvatar(e) {
    const avatar = this.data.user.avatar;
    if (avatar) {
      wx.previewImage({
        urls: [avatar],
        current: avatar
      });
    }
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});






