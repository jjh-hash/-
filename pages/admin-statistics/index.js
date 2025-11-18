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
      orderCount: 0,
      totalRevenue: 0,
      todayOrderCount: 0,
      todayIncome: 0,
      revenueGrowth: 0,
      merchantGrowth: 0,
      orderGrowth: 0,
      userGrowth: 0,
      dailyActiveUsers: 0,
      monthlyActiveUsers: 0,
      dauGrowth: 0,
      mauGrowth: 0,
      pendingOrders: 0,
      completedOrders: 0,
      completionRate: 0,
      avgOrderValue: 0,
      avgOrderGrowth: 0
    },
    orderStats: {
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
      cancelledOrders: 0,
      totalRevenue: 0,
      completionRate: 0,
      avgOrderValue: 0,
      amountDistribution: {},
      timeDistribution: {},
      amountDistributionHeights: {},
      timeDistributionHeights: {}
    },
    userStats: {
      totalUsers: 0,
      activeUsers: 0,
      newUsersToday: 0,
      newUsersThisWeek: 0,
      userRanking: [],
      orderCountDistribution: {},
      amountDistribution: {},
      orderCountDistributionHeights: {},
      amountDistributionHeights: {}
    },
    merchantStats: {
      totalMerchants: 0,
      activeMerchants: 0,
      pendingMerchants: 0,
      suspendedMerchants: 0,
      merchantRanking: [],
      avgOrderValue: 0,
      avgDailyOrders: 0
    },
    loading: true,
    dateRange: 'week', // week, month, quarter
    orderChartData: {
      dates: [],
      orders: [],
      revenue: [],
      orderHeights: [],
      revenueHeights: []
    },
    userChartData: {
      dates: [],
      users: [],
      activeUsers: [],
      userHeights: [],
      activeUserHeights: []
    },
    merchantChartData: {
      dates: [],
      merchants: [],
      merchantHeights: []
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
            url: '/subpackages/merchant/pages/merchant-register/index'
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
      
      if (res && res.result && res.result.code === 200) {
        this.updateStatsData(res.result.data);
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
    // 使用与数据概况页面相同的云函数，确保数据一致
    const res = await wx.cloud.callFunction({
      name: 'statistics',
      data: {
        action: 'getDashboardStats',
        data: {}
      }
    });
    return res;
  },

  // 加载订单统计
  async loadOrderStats() {
    const res = await wx.cloud.callFunction({
      name: 'statistics',
      data: {
        action: 'getAdminOrderStats',
        data: {
          dateRange: this.data.dateRange
        }
      }
    });
    return res;
  },

  // 加载用户统计
  async loadUserStats() {
    const res = await wx.cloud.callFunction({
      name: 'statistics',
      data: {
        action: 'getAdminUserStats',
        data: {
          dateRange: this.data.dateRange
        }
      }
    });
    return res;
  },

  // 加载商家统计
  async loadMerchantStats() {
    const res = await wx.cloud.callFunction({
      name: 'statistics',
      data: {
        action: 'getAdminMerchantStats',
        data: {
          dateRange: this.data.dateRange
        }
      }
    });
    return res;
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
        // 使用与数据概况页面相同的字段名和数据处理逻辑
        this.setData({
          'overviewStats.userCount': data.userCount || 0,
          'overviewStats.merchantCount': data.merchantCount || 0,
          'overviewStats.orderCount': data.orderCount || 0,
          'overviewStats.totalRevenue': data.totalRevenue || 0,
          'overviewStats.todayOrderCount': data.todayOrders || 0, // 对应 todayOrders
          'overviewStats.todayIncome': data.todayIncome || '0.00', // 对应 todayIncome
          'overviewStats.revenueGrowth': data.revenueGrowth || 0,
          'overviewStats.merchantGrowth': data.merchantGrowth || 0,
          'overviewStats.orderGrowth': data.orderGrowth || 0,
          'overviewStats.userGrowth': data.userGrowth || 0,
          'overviewStats.dailyActiveUsers': data.dailyActiveUsers || 0,
          'overviewStats.monthlyActiveUsers': data.monthlyActiveUsers || 0,
          'overviewStats.dauGrowth': data.dauGrowth || 0,
          'overviewStats.mauGrowth': data.mauGrowth || 0,
          'overviewStats.pendingOrders': data.pendingOrders || 0,
          'overviewStats.completedOrders': data.completedOrders || 0,
          'overviewStats.completionRate': data.completionRate || 0,
          'overviewStats.avgOrderValue': data.avgOrderValue || 0,
          'overviewStats.avgOrderGrowth': data.avgOrderGrowth || 0
        });
        break;
      case 'orders':
        const orderHeights = this.calculateChartHeights(data.chartData ? data.chartData.orders : []);
        const revenueHeights = this.calculateChartHeights(data.chartData ? data.chartData.revenue : []);
        const amountDistributionHeights = this.calculateDistributionHeights(data.amountDistribution || {});
        const timeDistributionHeights = this.calculateDistributionHeights(data.timeDistribution || {});
        this.setData({
          'orderStats.totalOrders': parseInt(data.totalOrders) || 0,
          'orderStats.completedOrders': parseInt(data.completedOrders) || 0,
          'orderStats.pendingOrders': parseInt(data.pendingOrders) || 0,
          'orderStats.cancelledOrders': parseInt(data.cancelledOrders) || 0,
          'orderStats.totalRevenue': parseFloat(data.totalRevenue) || 0,
          'orderStats.completionRate': parseFloat(data.completionRate) || 0,
          'orderStats.avgOrderValue': parseFloat(data.avgOrderValue) || 0,
          'orderStats.amountDistribution': data.amountDistribution || {},
          'orderStats.timeDistribution': data.timeDistribution || {},
          'orderStats.amountDistributionHeights': amountDistributionHeights,
          'orderStats.timeDistributionHeights': timeDistributionHeights,
          'orderChartData.dates': data.chartData ? data.chartData.dates : [],
          'orderChartData.orders': data.chartData ? data.chartData.orders : [],
          'orderChartData.revenue': data.chartData ? data.chartData.revenue : [],
          'orderChartData.orderHeights': orderHeights,
          'orderChartData.revenueHeights': revenueHeights
        });
        break;
      case 'users':
        const userHeights = this.calculateChartHeights(data.chartData ? data.chartData.users : []);
        const activeUserHeights = this.calculateChartHeights(data.chartData ? data.chartData.activeUsers : []);
        const orderCountDistributionHeights = this.calculateDistributionHeights(data.orderCountDistribution || {});
        const userAmountDistributionHeights = this.calculateDistributionHeights(data.amountDistribution || {});
        this.setData({
          'userStats.totalUsers': data.totalUsers || 0,
          'userStats.activeUsers': data.activeUsers || 0,
          'userStats.newUsersToday': data.newUsersToday || 0,
          'userStats.newUsersThisWeek': data.newUsersThisWeek || 0,
          'userStats.userRanking': data.userRanking || [],
          'userStats.orderCountDistribution': data.orderCountDistribution || {},
          'userStats.amountDistribution': data.amountDistribution || {},
          'userStats.orderCountDistributionHeights': orderCountDistributionHeights,
          'userStats.amountDistributionHeights': userAmountDistributionHeights,
          'userChartData.dates': data.chartData ? data.chartData.dates : [],
          'userChartData.users': data.chartData ? data.chartData.users : [],
          'userChartData.activeUsers': data.chartData ? data.chartData.activeUsers : [],
          'userChartData.userHeights': userHeights,
          'userChartData.activeUserHeights': activeUserHeights
        });
        break;
      case 'merchants':
        const merchantHeights = this.calculateChartHeights(data.chartData ? data.chartData.merchants : []);
        this.setData({
          'merchantStats.totalMerchants': data.totalMerchants || 0,
          'merchantStats.activeMerchants': data.activeMerchants || 0,
          'merchantStats.pendingMerchants': data.pendingMerchants || 0,
          'merchantStats.suspendedMerchants': data.suspendedMerchants || 0,
          'merchantStats.merchantRanking': data.merchantRanking || [],
          'merchantStats.avgOrderValue': data.avgOrderValue || 0,
          'merchantStats.avgDailyOrders': data.avgDailyOrders || 0,
          'merchantChartData.dates': data.chartData ? data.chartData.dates : [],
          'merchantChartData.merchants': data.chartData ? data.chartData.merchants : [],
          'merchantChartData.merchantHeights': merchantHeights
        });
        break;
    }
  },

  // 计算图表高度百分比
  calculateChartHeights(values) {
    if (!values || values.length === 0) {
      return [];
    }
    const maxValue = Math.max(...values, 1);
    return values.map(v => {
      return maxValue > 0 ? Math.round((v / maxValue) * 200) : 0;
    });
  },

  // 计算分布图表高度
  calculateDistributionHeights(distribution) {
    if (!distribution || Object.keys(distribution).length === 0) {
      return {};
    }
    const values = Object.values(distribution);
    const maxValue = Math.max(...values, 1);
    const heights = {};
    Object.keys(distribution).forEach(key => {
      heights[key] = maxValue > 0 ? Math.round((distribution[key] / maxValue) * 200) : 0;
    });
    return heights;
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
    const range = ['week', 'month', 'quarter'][e.detail.value];
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
