// pages/login-modal-demo/index.js
const LoginModal = require('../../utils/loginModal');
const UserAuth = require('../../utils/userAuth');

Page({
  data: {
    userInfo: null,
    isLoggedIn: false
  },

  onLoad() {
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const isLoggedIn = UserAuth.isLoggedIn();
    const userInfo = UserAuth.getUserInfo();
    
    this.setData({
      isLoggedIn: isLoggedIn,
      userInfo: userInfo
    });
  },

  /**
   * 手动显示登录弹窗
   */
  showLoginModal() {
    LoginModal.show();
  },

  /**
   * 检查登录示例
   */
  checkLoginExample() {
    LoginModal.checkLogin(
      () => {
        console.log('用户选择登录');
        wx.showToast({
          title: '正在登录...',
          icon: 'loading'
        });
      },
      (userInfo) => {
        console.log('用户已登录:', userInfo);
        wx.showToast({
          title: '已登录',
          icon: 'success'
        });
      }
    );
  },

  /**
   * 强制登录示例
   */
  forceLoginExample() {
    LoginModal.forceLogin('查看订单需要登录', (userInfo) => {
      console.log('登录成功，可以查看订单:', userInfo);
      wx.showToast({
        title: '登录成功，可以查看订单',
        icon: 'success'
      });
      
      // 更新页面状态
      this.checkLoginStatus();
    });
  },

  /**
   * 静默登录示例
   */
  async silentLoginExample() {
    wx.showLoading({
      title: '静默登录中...',
      mask: true
    });

    try {
      const result = await LoginModal.silentLogin();
      
      wx.hideLoading();
      
      if (result.success) {
        wx.showToast({
          title: '静默登录成功',
          icon: 'success'
        });
        this.checkLoginStatus();
      } else {
        wx.showToast({
          title: '静默登录失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({
        title: '登录异常',
        icon: 'none'
      });
    }
  },

  /**
   * 清除弹窗记录（测试用）
   */
  clearModalRecord() {
    LoginModal.clearModalRecord();
    wx.showToast({
      title: '已清除弹窗记录',
      icon: 'success'
    });
  },

  /**
   * 设置弹窗间隔
   */
  setModalInterval() {
    wx.showActionSheet({
      itemList: ['1小时', '6小时', '12小时', '24小时', '48小时'],
      success: (res) => {
        const hours = [1, 6, 12, 24, 48][res.tapIndex];
        LoginModal.setModalInterval(hours);
        wx.showToast({
          title: `已设置为${hours}小时`,
          icon: 'success'
        });
      }
    });
  },

  /**
   * 用户登出
   */
  logout() {
    UserAuth.logout();
    this.checkLoginStatus();
  }
});
