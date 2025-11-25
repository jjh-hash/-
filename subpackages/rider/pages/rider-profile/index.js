Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    riderInfo: {
      name: '',
      avatar: ''
    },
    todayStats: {
      orders: 0,
      income: '0.00'
    }
  },

  onLoad() {
    this.loadRiderInfo();
    this.loadTodayStats();
  },

  onShow() {
    // 页面显示时刷新数据
    this.loadRiderInfo();
    this.loadTodayStats();
    
    // 添加调试日志
    console.log('【骑手个人中心】onShow 刷新统计数据');
  },

  // 加载骑手信息（使用客户端用户信息，与 pages/profile/index 保持一致）
  loadRiderInfo() {
    const app = getApp();
    let userInfo = null;
    
    // 优先从全局数据获取（与客户端个人中心页面逻辑一致）
    if (app.globalData.isLoggedIn && app.globalData.userInfo) {
      userInfo = app.globalData.userInfo;
    } else {
      // 从本地存储获取
      userInfo = wx.getStorageSync('userInfo');
    }
    
    // 直接使用 userInfo，与客户端个人中心页面保持一致
    if (userInfo) {
      this.setData({
        riderInfo: {
          name: userInfo.nickname || '微信用户',
          avatar: userInfo.avatar || ''
        }
      });
    } else {
      // 如果没有用户信息，使用默认值（与客户端保持一致）
      this.setData({
        riderInfo: {
          name: '微信用户',
          avatar: ''
        }
      });
    }
  },

  // 加载今日统计数据
  async loadTodayStats() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getRiderTodayStats',
          data: {}
        }
      });
      
      if (res.result && res.result.code === 200) {
        this.setData({
          todayStats: {
            orders: res.result.data.orders || 0,
            income: res.result.data.income || '0.00'
          }
        });
      } else {
        // 如果获取失败，使用默认值
        this.setData({
          todayStats: {
            orders: 0,
            income: '0.00'
          }
        });
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
      // 如果出错，使用默认值
      this.setData({
        todayStats: {
          orders: 0,
          income: '0.00'
        }
      });
    }
  },

  // 返回上一页
  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({
        url: '/subpackages/rider/pages/rider-home/index'
      });
    }
  },

  // 设置按钮
  onSetting() {
    wx.showToast({
      title: '设置功能开发中',
      icon: 'none'
    });
    // TODO: 跳转到设置页面
  },

  // 今日接单
  onTodayOrders() {
    wx.showToast({
      title: '订单列表开发中',
      icon: 'none'
    });
    // TODO: 跳转到订单列表页面
    // wx.navigateTo({
    //   url: '/subpackages/rider/pages/rider-orders/index'
    // });
  },

  // 今日收入
  onTodayIncome() {
    wx.showToast({
      title: '钱包功能开发中',
      icon: 'none'
    });
    // TODO: 跳转到钱包页面
    // wx.navigateTo({
    //   url: '/subpackages/rider/pages/rider-wallet/index'
    // });
  },

  // 体验反馈
  onFeedback() {
    wx.showToast({
      title: '反馈功能开发中',
      icon: 'none'
    });
    // TODO: 跳转到反馈页面
    // wx.navigateTo({
    //   url: '/subpackages/rider/pages/rider-feedback/index'
    // });
  },

  // 退出接单端
  onLogout() {
    wx.showModal({
      title: '退出接单端',
      content: '确定要退出接单端吗？',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          // 只清除骑手相关存储，不清除客户端用户信息
          // 注意：不调用 app.logoutUser()，因为这会清除客户端用户信息
          wx.removeStorageSync('riderInfo');
          wx.removeStorageSync('riderToken');
          
          // 清除骑手相关的全局数据（如果有）
          const app = getApp();
          if (app && app.globalData) {
            // 只清除骑手相关数据，保留客户端用户信息
            if (app.globalData.riderInfo) {
              app.globalData.riderInfo = null;
            }
            if (app.globalData.riderToken) {
              app.globalData.riderToken = null;
            }
          }
          
          wx.showToast({
            title: '已退出',
            icon: 'success',
            duration: 1500
          });
          
          // 跳转到客户端个人中心页面，保持用户登录状态
          setTimeout(() => {
            wx.reLaunch({
              url: '/pages/profile/index'
            });
          }, 1500);
        }
      }
    });
  }
});

