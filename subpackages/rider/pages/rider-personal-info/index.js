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
    
    // 格式化日期
    const formatDate = (date) => {
      if (!date) return '未知';
      if (typeof date === 'string' && date !== '未知' && date !== '从未登录') {
        return date;
      }
      try {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '未知';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
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

