Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    userInfo: {
      nickname: "微信用户",
      avatar: ""
    },
    showUserInfoModal: false
  },

  onLoad() {
    // 页面加载时获取用户信息
    this.loadUserInfo();
  },

  onShow() {
    // 页面显示时刷新用户信息
    this.loadUserInfo();
  },

  /**
   * 加载用户信息
   */
  loadUserInfo() {
    const app = getApp();
    if (app.globalData.isLoggedIn && app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo
      });
    } else {
      // 未登录，从本地存储获取
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo) {
        this.setData({
          userInfo: userInfo
        });
      }
    }
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === 'home') {
      wx.reLaunch({
        url: '/pages/home/index'
      });
    } else if (tab === 'order') {
      wx.reLaunch({
        url: '/pages/order/index'
      });
    } else if (tab === 'receive') {
      // 接单功能正在开发中
      wx.showToast({
        title: '正在开发中',
        icon: 'none',
        duration: 2000
      });
      // wx.reLaunch({
      //   url: '/pages/receive-order/index'
      // });
    } else if (tab === 'message') {
      // 消息功能正在开发中
      wx.showToast({
        title: '正在开发中',
        icon: 'none',
        duration: 2000
      });
      // wx.reLaunch({
      //   url: '/pages/message/index'
      // });
    }
  },

  onMenuTap(e) {
    const type = e.currentTarget.dataset.type;
    switch(type) {
      case 'user-info':
        wx.navigateTo({
          url: '/pages/user-info-setting/index'
        });
        break;
      case 'reviews':
        wx.navigateTo({
          url: '/subpackages/store/pages/my-reviews/index'
        });
        break;
      case 'address':
        wx.navigateTo({ url: '/subpackages/common/pages/address/index' });
        break;
      case 'about':
        wx.navigateTo({
          url: '/subpackages/common/pages/about/index'
        });
        break;
      case 'service':
        wx.showModal({
          title: '联系客服',
          content: '+v 15890121731',
          showCancel: false,
          confirmText: '确定'
        });
        break;
      case 'switch-merchant':
        // 切换到商家端，使用 reLaunch 清空页面栈
        wx.reLaunch({ 
          url: '/subpackages/merchant/pages/merchant/index',
          fail: (err) => {
            console.error('跳转到商家端失败:', err);
            wx.showToast({
              title: '跳转失败，请重试',
              icon: 'none'
            });
          }
        });
        break;
      case 'switch-rider':
        // 切换到骑手端
        wx.reLaunch({
          url: '/subpackages/rider/pages/rider/index',
          fail: (err) => {
            console.error('跳转到骑手端失败:', err);
            wx.showToast({
              title: '跳转失败，请重试',
              icon: 'none'
            });
          }
        });
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
  },

  /**
   * 编辑用户信息
   */
  editUserInfo() {
    this.setData({
      showUserInfoModal: true
    });
  },

  /**
   * 关闭用户信息弹窗
   */
  onCloseUserInfoModal() {
    this.setData({
      showUserInfoModal: false
    });
  },

  /**
   * 更新用户信息
   */
  onUpdateUserInfo(e) {
    const { userInfo } = e.detail;
    this.setData({
      userInfo: userInfo,
      showUserInfoModal: false
    });
  }
});
