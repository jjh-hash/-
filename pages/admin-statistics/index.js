Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    currentTab: 'overview',
    tabs: [
      { key: 'overview', name: '数据概览' },
      { key: 'orders', name: '订单统计' },
      { key: 'users', name: '用户统计' },
      { key: 'merchants', name: '商家统计' }
    ],
    overviewStats: {
      userCount: 0,
      merchantCount: 0,
      todayOrderCount: 0,
      todayIncome: 0
    },
    orderStats: {
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
      cancelledOrders: 0,
      totalRevenue: 0
    },
    userStats: {
      totalUsers: 0,
      activeUsers: 0,
      newUsersToday: 0,
      newUsersThisWeek: 0
    },
    merchantStats: {
      totalMerchants: 0,
      activeMerchants: 0,
      pendingMerchants: 0,
      suspendedMerchants: 0
    },
    loading: true,
    dateRange: 'week', // week, month, quarter
    chartData: {
      dates: [],
      orders: [],
      revenue: []
    }
  },

  onLoad() {
    this.verifyAdminAccess();
    this.loadStatisticsData();
  },

  // 验证管理员权限
  verifyAdminAccess() {
    const adminToken = wx.getStorageSync('adminToken');
    if (!adminToken) {
      wx.showModal({
        title: '访问受限',
        content: '您没有管理员权限，请重新登录',
        showCancel: false,
        success: () => {
          wx.reLaunch({
            url: '/pages/merchant-register/index'
          });
        }
      });
      return;
    }
  },

  // 切换标签
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ currentTab: tab });
    this.loadStatisticsData();
  },

  // 加载统计数据
  async loadStatisticsData() {
    wx.showLoading({ title: '加载中...' });
    
    try {
      let res;
      
      switch(this.data.currentTab) {
        case 'overview':
          res = await this.loadOverviewStats();
          break;
        case 'orders':
          res = await this.loadOrderStats();
          break;
        case 'users':
          res = await this.loadUserStats();
          break;
        case 'merchants':
          res = await this.loadMerchantStats();
          break;
      }
      
      if (res && res.code === 200) {
        this.updateStatsData(res.data);
      } else {
        // 使用模拟数据
        this.loadMockData();
      }
    } catch (err) {
      console.error('加载统计数据失败:', err);
      this.loadMockData();
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  // 加载概览数据
  async loadOverviewStats() {
    return await wx.cloud.callFunction({
      name: 'statistics',
      data: { type: 'overview' }
    });
  },

  // 加载订单统计
  async loadOrderStats() {
    return await wx.cloud.callFunction({
      name: 'statistics',
      data: { 
        type: 'order',
        startDate: this.getDateRange().start,
        endDate: this.getDateRange().end
      }
    });
  },

  // 加载用户统计
  async loadUserStats() {
    return await wx.cloud.callFunction({
      name: 'statistics',
      data: { 
        type: 'user',
        startDate: this.getDateRange().start,
        endDate: this.getDateRange().end
      }
    });
  },

  // 加载商家统计
  async loadMerchantStats() {
    return await wx.cloud.callFunction({
      name: 'statistics',
      data: { type: 'merchant' }
    });
  },

  // 获取日期范围
  getDateRange() {
    const now = new Date();
    let start, end;
    
    switch(this.data.dateRange) {
      case 'week':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        end = now;
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
        break;
      case 'quarter':
        start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        end = now;
        break;
    }
    
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  },

  // 更新统计数据
  updateStatsData(data) {
    switch(this.data.currentTab) {
      case 'overview':
        this.setData({
          'overviewStats.userCount': data.userCount || 0,
          'overviewStats.merchantCount': data.merchantCount || 0,
          'overviewStats.todayOrderCount': data.todayOrderCount || 0,
          'overviewStats.todayIncome': data.todayIncome || 0
        });
        break;
      case 'orders':
        this.setData({
          'orderStats.totalOrders': data.totalOrders || 0,
          'orderStats.completedOrders': data.completedOrders || 0,
          'orderStats.pendingOrders': data.pendingOrders || 0,
          'orderStats.cancelledOrders': data.cancelledOrders || 0,
          'orderStats.totalRevenue': data.totalRevenue || 0
        });
        break;
      case 'users':
        this.setData({
          'userStats.totalUsers': data.totalUsers || 0,
          'userStats.activeUsers': data.activeUsers || 0,
          'userStats.newUsersToday': data.newUsersToday || 0,
          'userStats.newUsersThisWeek': data.newUsersThisWeek || 0
        });
        break;
      case 'merchants':
        this.setData({
          'merchantStats.totalMerchants': data.totalMerchants || 0,
          'merchantStats.activeMerchants': data.activeMerchants || 0,
          'merchantStats.pendingMerchants': data.pendingMerchants || 0,
          'merchantStats.suspendedMerchants': data.suspendedMerchants || 0
        });
        break;
    }
  },

  // 加载模拟数据
  loadMockData() {
    switch(this.data.currentTab) {
      case 'overview':
        this.setData({
          'overviewStats.userCount': 3421,
          'overviewStats.merchantCount': 156,
          'overviewStats.todayOrderCount': 89,
          'overviewStats.todayIncome': 12568.50
        });
        break;
      case 'orders':
        this.setData({
          'orderStats.totalOrders': 2847,
          'orderStats.completedOrders': 2654,
          'orderStats.pendingOrders': 123,
          'orderStats.cancelledOrders': 70,
          'orderStats.totalRevenue': 125680.50
        });
        break;
      case 'users':
        this.setData({
          'userStats.totalUsers': 3421,
          'userStats.activeUsers': 2890,
          'userStats.newUsersToday': 45,
          'userStats.newUsersThisWeek': 312
        });
        break;
      case 'merchants':
        this.setData({
          'merchantStats.totalMerchants': 156,
          'merchantStats.activeMerchants': 142,
          'merchantStats.pendingMerchants': 8,
          'merchantStats.suspendedMerchants': 6
        });
        break;
    }
  },

  // 日期范围选择
  onDateRangeChange(e) {
    const range = e.detail.value;
    this.setData({ dateRange: range });
    this.loadStatisticsData();
  },

  // 导出数据
  onExportData() {
    wx.showModal({
      title: '导出数据',
      content: '确定要导出当前统计数据吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({
            title: '导出功能开发中',
            icon: 'none'
          });
        }
      }
    });
  },

  // 刷新数据
  onRefresh() {
    this.loadStatisticsData();
    wx.showToast({
      title: '数据已刷新',
      icon: 'success',
      duration: 800
    });
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});
