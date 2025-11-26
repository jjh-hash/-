// 登录功能示例页面
const UserAuth = require('../../utils/userAuth');

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    loading: false
  },

  onLoad() {
    console.log('登录示例页面加载');
    this.checkLoginStatus();
  },

  onShow() {
    this.checkLoginStatus();
  },

  /**
   * 检查登录状态
   */
  checkLoginStatus() {
    const isLoggedIn = UserAuth.isLoggedIn();
    const userInfo = UserAuth.getUserInfo();
    
    console.log('当前登录状态:', { isLoggedIn, userInfo });
    
    this.setData({
      isLoggedIn: isLoggedIn,
      userInfo: userInfo
    });
  },

  /**
   * 用户登录
   */
  async handleLogin() {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    try {
      const result = await UserAuth.login(true);
      
      if (result.success) {
        console.log('登录成功:', result.userInfo);
        
        this.setData({
          isLoggedIn: true,
          userInfo: result.userInfo
        });
        
        wx.showToast({
          title: result.isNewUser ? '欢迎新用户' : '登录成功',
          icon: 'success',
          duration: 2000
        });
      } else {
        console.error('登录失败:', result.error);
        wx.showToast({
          title: result.error || '登录失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      console.error('登录异常:', error);
      wx.showToast({
        title: '登录异常，请重试',
        icon: 'none',
        duration: 2000
      });
    } finally {
      this.setData({ loading: false });
    }
  },

  /**
   * 用户登出
   */
  handleLogout() {
    wx.showModal({
      title: '确认登出',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          UserAuth.logout();
          this.setData({
            isLoggedIn: false,
            userInfo: null
          });
        }
      }
    });
  },

  /**
   * 获取用户信息（自动登录）
   */
  async handleGetUserInfo() {
    try {
      wx.showLoading({
        title: '获取中...',
        mask: true
      });

      const userInfo = await UserAuth.ensureLogin(true);
      
      wx.hideLoading();
      
      if (userInfo) {
        this.setData({
          isLoggedIn: true,
          userInfo: userInfo
        });
        
        wx.showToast({
          title: '获取成功',
          icon: 'success',
          duration: 1500
        });
      } else {
        wx.showToast({
          title: '获取失败',
          icon: 'none',
          duration: 1500
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('获取用户信息失败:', error);
      wx.showToast({
        title: '获取失败',
        icon: 'none',
        duration: 1500
      });
    }
  },

  /**
   * 需要登录的操作示例
   */
  async handleRequireLoginAction() {
    const result = await UserAuth.requireLogin(async () => {
      // 这里是要执行的登录后操作
      wx.showToast({
        title: '执行登录后操作成功',
        icon: 'success',
        duration: 1500
      });
      
      return '操作完成';
    }, {
      modalTitle: '需要登录',
      modalContent: '此操作需要登录后才能执行，是否立即登录？'
    });
    
    console.log('登录后操作结果:', result);
  },

  /**
   * 显示登录弹窗
   */
  handleShowLoginModal() {
    UserAuth.showLoginModal();
  },

  /**
   * 复制用户信息到剪贴板
   */
  handleCopyUserInfo() {
    if (!this.data.userInfo) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    const userInfoStr = JSON.stringify(this.data.userInfo, null, 2);
    
    wx.setClipboardData({
      data: userInfoStr,
      success: () => {
        wx.showToast({
          title: '用户信息已复制',
          icon: 'success',
          duration: 1500
        });
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'none',
          duration: 1500
        });
      }
    });
  },

  /**
   * 跳转到其他页面测试
   */
  handleGoToOtherPage() {
    wx.navigateTo({
      url: '/pages/home/index',
      fail: () => {
        wx.showToast({
          title: '页面不存在',
          icon: 'none',
          duration: 1500
        });
      }
    });
  }
});