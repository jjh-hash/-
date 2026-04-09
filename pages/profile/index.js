let cloudImages = {};
try {
  cloudImages = require('../../config/cloudImages.js');
} catch (e) {
  console.error('加载云图片配置失败:', e);
}

Page({
  data: {
    statusBarHeight: 20,
    isLoggedIn: false,
    userInfo: {
      nickname: "",
      avatar: ""
    },
    showUserInfoModal: false,
    menuSections: []
  },

  onLoad() {
    const win = wx.getWindowInfo ? wx.getWindowInfo() : null;
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
    this.setData({
      statusBarHeight: (win && win.statusBarHeight) || sys.statusBarHeight || 20
    });
    this.buildMenuSections();
    this.loadUserInfo();
  },

  onShow() {
    this.buildMenuSections();
    this.loadUserInfo();
  },

  /**
   * 构建「我的」菜单（管理端已迁至 Web，不在此展示入口）
   */
  buildMenuSections() {
    const moreServiceItems = [
      { type: 'campus-partner', icon: '/pages/小标/接单.png', text: '校园兼职' },
      { type: 'switch-merchant', icon: '/pages/小标/商家.png', text: '商家端' }
    ];
    // 管理端已迁移至独立 Web 后台，不在学生端小程序展示入口（见 admin-web / 商家注册页管理员登录）
    const menuSections = [
      { title: '个人', cols: 3, items: [
          { type: 'user-info', icon: '/pages/小标/姓名.png', text: '我的信息' },
          { type: 'reviews', icon: '/pages/小标/待评价.png', text: '我的评价' },
          { type: 'address', icon: '/pages/小标/地址.png', text: '我的地址' }
        ]
      },
      { title: '帮助与关于', cols: 2, items: [
          { type: 'about', icon: '/pages/小标/关于我们.png', text: '关于我们' },
          { type: 'service', icon: '/pages/小标/联系客服.png', text: '联系客服' }
        ]
      },
      { title: '法律与协议', cols: 2, items: [
          { type: 'user-agreement', icon: '/pages/小标/关于我们.png', text: '用户协议' },
          { type: 'privacy-policy', icon: cloudImages.profilePrivacyPolicyIcon, text: '隐私政策' }
        ]
      },
      { title: '更多服务', cols: moreServiceItems.length === 3 ? 3 : 2, items: moreServiceItems },
      { title: '账号', cols: 1, items: [
          { type: 'logout', icon: cloudImages.profileLogoutIcon, text: '退出登录' }
        ]
      }
    ];
    this.setData({ menuSections });
  },

  /**
   * 加载用户信息（若本地为默认且已登录，则从服务器拉取一次，避免清理缓存后头像昵称丢失）
   */
  async loadUserInfo() {
    const app = getApp();
    let userInfo = null;
    const hasToken = !!wx.getStorageSync('userToken');
    if (app.globalData.isLoggedIn && app.globalData.userInfo && hasToken) {
      userInfo = app.globalData.userInfo;
    } else {
      const storedUserInfo = wx.getStorageSync('userInfo');
      if (storedUserInfo && hasToken) {
        userInfo = storedUserInfo;
        app.globalData.userInfo = userInfo;
        app.globalData.isLoggedIn = true;
      } else {
        app.globalData.isLoggedIn = false;
      }
    }
    this.setData({
      isLoggedIn: !!(userInfo && hasToken),
      userInfo: userInfo || { nickname: '', avatar: '' }
    });
    // 若当前显示为默认（微信用户/无头像）且本地有登录态，从服务器拉取最新用户信息并回写
    const isDefault = !userInfo || !userInfo.nickname || userInfo.nickname === '微信用户' || !userInfo.avatar;
    if (isDefault && hasToken) {
      try {
        const res = await app.loginUser();
        if (res && res.success && res.userInfo) {
          wx.setStorageSync('userInfo', res.userInfo);
          app.globalData.userInfo = res.userInfo;
          this.setData({
            userInfo: res.userInfo,
            isLoggedIn: true
          });
        }
      } catch (e) {
        console.warn('从服务器恢复用户信息失败', e);
      }
    }
  },

  onTabTap(e) {
    const tab = (e.detail && e.detail.tab) ? e.detail.tab : (e.currentTarget && e.currentTarget.dataset.tab);
    if (tab === 'home') {
      wx.reLaunch({
        url: '/pages/home/index'
      });
    } else if (tab === 'order') {
      wx.reLaunch({
        url: '/subpackages/order/pages/order/index'
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
      case 'campus-partner':
        wx.navigateTo({
          url: '/subpackages/common/pages/campus-partner/index',
          fail: (err) => {
            console.error('跳转校园兼职失败:', err);
            wx.showToast({ title: '跳转失败，请重试', icon: 'none' });
          }
        });
        break;
      case 'user-info':
        wx.navigateTo({
          url: '/subpackages/common/pages/user-info-setting/index'
        });
        break;
      case 'reviews':
        wx.navigateTo({
          url: '/subpackages/store/pages/my-reviews/index'
        });
        break;
      case 'address':
        if (!getApp().ensureLogin('请先登录后管理地址')) return;
        wx.navigateTo({ url: '/subpackages/common/pages/address/index' });
        break;
      case 'about':
        wx.navigateTo({
          url: '/subpackages/common/pages/about/index'
        });
        break;
      case 'service':
        wx.makePhoneCall({
          phoneNumber: '15890121731',
          fail: (err) => {
            console.error('拨打电话失败:', err);
            wx.showToast({ title: '拨打失败，请重试', icon: 'none' });
          }
        });
        break;
      case 'user-agreement':
        wx.navigateTo({ url: '/subpackages/common/pages/user-agreement/index' });
        break;
      case 'privacy-policy':
        wx.navigateTo({ url: '/subpackages/common/pages/privacy-policy/index' });
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
      case 'admin':
        // 管理端入口（未登录时由管理端页内校验并提示）
        wx.reLaunch({
          url: '/subpackages/admin/pages/admin-dashboard/index',
          fail: (err) => {
            console.error('跳转到管理端失败:', err);
            wx.showToast({ title: '跳转失败，请重试', icon: 'none' });
          }
        });
        break;
      case 'logout':
        // 退出登录
        wx.showModal({
          title: '退出登录',
          content: '确定要退出登录吗？',
          success: (res) => {
            if (res.confirm) {
              const app = getApp();
              wx.removeStorageSync('userInfo');
              wx.removeStorageSync('userToken');
              app.globalData.userInfo = null;
              app.globalData.userToken = null;
              app.globalData.isLoggedIn = false;
              app.globalData.openid = null;
              wx.showToast({
                title: '已退出登录',
                icon: 'success',
                duration: 2000
              });
              // 刷新页面，显示默认用户信息
              this.loadUserInfo();
            }
          }
        });
        break;

    }
  },

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
  async editUserInfo() {
    if (!this.data.isLoggedIn) {
      const app = getApp();
      wx.showLoading({
        title: '登录中...',
        mask: true
      });
      try {
        const res = await app.loginUser();
        wx.hideLoading();
        if (res && res.success && res.userInfo) {
          this.setData({
            isLoggedIn: true,
            userInfo: res.userInfo,
            showUserInfoModal: true
          });
          return;
        }
        wx.showToast({
          title: (res && res.error) || '登录失败，请重试',
          icon: 'none'
        });
      } catch (e) {
        wx.hideLoading();
        console.error('我的页登录失败:', e);
        wx.showToast({
          title: '登录失败，请重试',
          icon: 'none'
        });
      }
      return;
    }
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
