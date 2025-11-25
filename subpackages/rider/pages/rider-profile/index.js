Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    refreshing: false, // 下拉刷新状态
    loading: false,
    riderInfo: {
      name: '',
      avatar: '',
      nickname: '',
      phone: '',
      gender: '',
      vehicle: '',
      status: 'pending'
    },
    todayStats: {
      orders: 0,
      income: '0.00'
    },
    totalStats: {
      orders: 0,
      income: '0.00'
    },
    accountInfo: {
      createdAt: '',
      lastLoginAt: ''
    }
  },

  onLoad() {
    this.loadRiderInfo();
    this.loadTodayStats();
    this.loadTotalStats();
  },

  onShow() {
    // 页面显示时刷新数据
    this.loadRiderInfo();
    // 延迟一点加载统计数据，确保数据已更新
    setTimeout(() => {
      this.loadTodayStats();
      this.loadTotalStats();
      console.log('【骑手个人中心】onShow 刷新统计数据');
    }, 300);
  },

  // 加载骑手信息（使用客户端用户信息和本地存储的骑手信息）
  async loadRiderInfo() {
    const app = getApp();
    let userInfo = null;
    
    // 优先从全局数据获取（与客户端个人中心页面逻辑一致）
    if (app.globalData.isLoggedIn && app.globalData.userInfo) {
      userInfo = app.globalData.userInfo;
    } else {
      // 从本地存储获取
      userInfo = wx.getStorageSync('userInfo');
    }
    
    // 从云函数获取骑手审核状态
    let riderStatus = 'not_registered';
    let riderInfoFromCloud = null;
    try {
      const res = await wx.cloud.callFunction({
        name: 'riderManage',
        data: {
          action: 'getRiderStatus',
          data: {}
        }
      });
      
      if (res.result && res.result.code === 200) {
        riderStatus = res.result.data.status || 'not_registered';
        riderInfoFromCloud = res.result.data.riderInfo || null;
      }
    } catch (error) {
      console.error('获取骑手状态失败:', error);
    }
    
    // 获取本地存储的骑手信息
    const localRiderInfo = wx.getStorageSync('riderInfo') || {};
    
    // 合并用户信息和骑手信息
    const riderInfo = {
      name: riderInfoFromCloud?.name || localRiderInfo.name || userInfo?.nickname || '微信用户',
      nickname: userInfo?.nickname || '微信用户',
      avatar: userInfo?.avatar || '',
      phone: riderInfoFromCloud?.phone || localRiderInfo.phone || userInfo?.phone || '未绑定',
      gender: riderInfoFromCloud?.gender || localRiderInfo.gender || '',
      vehicle: riderInfoFromCloud?.vehicle || localRiderInfo.vehicle || '未填写',
      status: riderStatus
    };
    
    // 更新本地存储
    wx.setStorageSync('riderInfo', {
      ...localRiderInfo,
      ...riderInfo,
      status: riderStatus
    });
    
    // 格式化日期为中国时间（UTC+8）
    const formatDate = (date) => {
      if (!date) return '未知';
      if (typeof date === 'string' && date !== '未知' && date !== '从未登录') {
        // 如果已经是格式化好的字符串，检查是否需要转换
        // 如果是UTC时间字符串，需要转换
        if (date.includes('T') || date.includes('Z') || /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          try {
            let dateStr = date;
            if (dateStr.includes(' ') && !dateStr.includes('T')) {
              const hasTimezone = dateStr.endsWith('Z') || 
                                 /[+-]\d{2}:?\d{2}$/.test(dateStr) ||
                                 dateStr.match(/[+-]\d{4}$/);
              if (!hasTimezone) {
                dateStr = dateStr.replace(' ', 'T') + 'Z';
              } else {
                dateStr = dateStr.replace(' ', 'T');
              }
            }
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
              // 转换为中国时间（UTC+8）
              const chinaTimeOffset = 8 * 60 * 60 * 1000;
              const chinaTime = new Date(d.getTime() + chinaTimeOffset);
              const year = chinaTime.getUTCFullYear();
              const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
              const day = String(chinaTime.getUTCDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            }
          } catch (e) {
            // 如果转换失败，返回原字符串
          }
        }
        return date;
      }
      try {
        let d;
        if (date && typeof date === 'object' && date.getTime && typeof date.getTime === 'function') {
          d = new Date(date.getTime());
        } else if (date && typeof date === 'object' && date.getFullYear) {
          d = date;
        } else if (typeof date === 'string') {
          let dateStr = date;
          if (dateStr.includes(' ') && !dateStr.includes('T')) {
            const hasTimezone = dateStr.endsWith('Z') || 
                               /[+-]\d{2}:?\d{2}$/.test(dateStr) ||
                               dateStr.match(/[+-]\d{4}$/);
            if (!hasTimezone) {
              dateStr = dateStr.replace(' ', 'T') + 'Z';
            } else {
              dateStr = dateStr.replace(' ', 'T');
            }
          }
          d = new Date(dateStr);
        } else if (typeof date === 'object' && date.type === 'date') {
          if (date.date) {
            d = new Date(date.date);
          } else {
            d = new Date(date);
          }
        } else {
          d = new Date(date);
        }
        
        if (isNaN(d.getTime())) return '未知';
        
        // 转换为中国时间（UTC+8）- 假设云数据库返回的是UTC时间
        const chinaTimeOffset = 8 * 60 * 60 * 1000;
        const chinaTime = new Date(d.getTime() + chinaTimeOffset);
        const year = chinaTime.getUTCFullYear();
        const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(chinaTime.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      } catch (e) {
        return '未知';
      }
    };
    
    this.setData({
      riderInfo: riderInfo,
      accountInfo: {
        createdAt: formatDate(localRiderInfo.createdAt),
        lastLoginAt: userInfo?.lastLoginAt ? formatDate(userInfo.lastLoginAt) : '从未登录'
      }
    });
  },

  // 加载今日统计数据
  async loadTodayStats() {
    try {
      console.log('【骑手个人中心】开始加载今日统计数据');
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getRiderTodayStats',
          data: {}
        }
      });
      
      console.log('【骑手个人中心】统计数据返回:', res.result);
      
      if (res.result && res.result.code === 200) {
        const orders = res.result.data.orders || 0;
        const income = res.result.data.income || '0.00';
        
        console.log('【骑手个人中心】设置统计数据 - 接单数:', orders, '收入:', income);
        
        this.setData({
          todayStats: {
            orders: orders,
            income: income
          }
        });
      } else {
        // 如果获取失败，使用默认值
        console.log('【骑手个人中心】获取统计数据失败，使用默认值');
        this.setData({
          todayStats: {
            orders: 0,
            income: '0.00'
          }
        });
      }
    } catch (error) {
      console.error('【骑手个人中心】加载统计数据失败:', error);
      // 如果出错，使用默认值
      this.setData({
        todayStats: {
          orders: 0,
          income: '0.00'
        }
      });
    }
  },

  // 加载总统计数据
  async loadTotalStats() {
    try {
      console.log('【骑手个人中心】开始加载总统计数据');
      
      // 使用云函数获取总统计数据
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getRiderTotalStats',
          data: {}
        }
      });
      
      console.log('【骑手个人中心】总统计数据返回:', res.result);
      
      if (res.result && res.result.code === 200) {
        const orders = res.result.data.orders || 0;
        const income = res.result.data.income || '0.00';
        
        this.setData({
          totalStats: {
            orders: orders,
            income: income
          }
        });
      } else {
        // 如果获取失败，使用默认值
        console.log('【骑手个人中心】获取总统计数据失败，使用默认值');
        this.setData({
          totalStats: {
            orders: 0,
            income: '0.00'
          }
        });
      }
    } catch (error) {
      console.error('【骑手个人中心】加载总统计数据失败:', error);
      // 如果出错，使用默认值
      this.setData({
        totalStats: {
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
    wx.navigateTo({
      url: '/subpackages/rider/pages/rider-orders/index'
    });
  },

  // 今日收入
  onTodayIncome() {
    wx.navigateTo({
      url: '/subpackages/rider/pages/rider-income/index'
    });
  },

  // 体验反馈
  onFeedback() {
    wx.navigateTo({
      url: '/subpackages/rider/pages/rider-feedback/index',
      fail: (err) => {
        console.error('跳转到反馈页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 个人信息
  onPersonalInfo() {
    wx.navigateTo({
      url: '/subpackages/rider/pages/rider-personal-info/index',
      fail: (err) => {
        console.error('跳转到个人信息页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 统计数据
  onStatistics() {
    wx.navigateTo({
      url: '/subpackages/rider/pages/rider-statistics/index',
      fail: (err) => {
        console.error('跳转到统计数据页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    console.log('【骑手个人中心】下拉刷新');
    this.setData({
      refreshing: true
    });
    
    // 刷新数据
    Promise.all([
      this.loadRiderInfo(),
      this.loadTodayStats(),
      this.loadTotalStats()
    ]).then(() => {
      setTimeout(() => {
        this.setData({
          refreshing: false
        });
        wx.showToast({
          title: '刷新完成',
          icon: 'success',
          duration: 1500
        });
      }, 500);
    }).catch((error) => {
      console.error('【骑手个人中心】刷新失败:', error);
      this.setData({
        refreshing: false
      });
      wx.showToast({
        title: '刷新失败',
        icon: 'none',
        duration: 1500
      });
    });
  },

  // 预览头像
  onPreviewAvatar() {
    const avatar = this.data.riderInfo.avatar;
    if (avatar) {
      wx.previewImage({
        urls: [avatar],
        current: avatar
      });
    }
  },

  // 格式化身份证号（中间部分隐藏）
  formatIdNumber(idNumber) {
    if (!idNumber || idNumber === '未填写') {
      return idNumber;
    }
    if (idNumber.length <= 8) {
      return idNumber;
    }
    return idNumber.substring(0, 4) + '****' + idNumber.substring(idNumber.length - 4);
  },

  // 格式化手机号（中间部分隐藏）
  formatPhone(phone) {
    if (!phone || phone === '未绑定') {
      return phone;
    }
    if (phone.length === 11) {
      return phone.substring(0, 3) + '****' + phone.substring(7);
    }
    return phone;
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

