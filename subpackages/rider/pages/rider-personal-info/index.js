Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    refreshing: false,
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
    accountInfo: {
      createdAt: '',
      lastLoginAt: ''
    }
  },

  onLoad() {
    this.loadRiderInfo();
  },

  onShow() {
    // 页面显示时刷新数据
    this.loadRiderInfo();
  },

  // 加载骑手信息
  loadRiderInfo() {
    const app = getApp();
    let userInfo = null;
    
    // 优先从全局数据获取
    if (app.globalData.isLoggedIn && app.globalData.userInfo) {
      userInfo = app.globalData.userInfo;
    } else {
      // 从本地存储获取
      userInfo = wx.getStorageSync('userInfo');
    }
    
    // 获取本地存储的骑手信息
    const localRiderInfo = wx.getStorageSync('riderInfo') || {};
    
    // 合并用户信息和骑手信息
    const riderInfo = {
      name: localRiderInfo.name || userInfo?.nickname || '微信用户',
      nickname: userInfo?.nickname || '微信用户',
      avatar: userInfo?.avatar || '',
      phone: localRiderInfo.phone || userInfo?.phone || '未绑定',
      gender: localRiderInfo.gender || '',
      vehicle: localRiderInfo.vehicle || '未填写',
      status: localRiderInfo.status || 'pending'
    };
    
    // 格式化日期为中国时间（UTC+8）
    const formatDate = (date) => {
      if (!date) return '未知';
      if (typeof date === 'string' && date !== '未知' && date !== '从未登录') {
        // 如果已经是格式化好的字符串，检查是否需要转换
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

  // 下拉刷新
  onPullDownRefresh() {
    console.log('【个人信息】下拉刷新');
    this.setData({
      refreshing: true
    });
    
    this.loadRiderInfo();
    
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
  }
});

