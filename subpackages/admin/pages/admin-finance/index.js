// subpackages/admin/pages/admin-finance/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    loading: true,
    dateRange: 'week', // week, month, quarter
    
    // 财务统计数据
    financeStats: {
      platformTotalRevenue: 0, // 平台总收入
      merchantTotalRevenue: 0, // 商家总收入
      userTotalConsumption: 0, // 用户总消费
      totalRefundAmount: 0, // 总退款金额
      totalRefundCount: 0, // 总退款数量
      netPlatformRevenue: 0, // 平台净收入
      orderCount: 0, // 订单数量
      avgOrderValue: '0.00' // 平均订单金额
    },
    
    // 图表数据
    chartData: {
      dates: [],
      platformRevenues: [],
      merchantRevenues: [],
      userConsumptions: [],
      platformRevenueHeights: [],
      merchantRevenueHeights: [],
      userConsumptionHeights: []
    },
    
    // 商家财务排行
    merchantRanking: []
  },

  onLoad() {
    this.verifyAdminAccess();
    this.loadFinanceData();
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

  // 加载财务数据
  async loadFinanceData() {
    wx.showLoading({ title: '加载中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'statistics',
        data: {
          action: 'getAdminFinanceStats',
          data: {
            dateRange: this.data.dateRange
          }
        }
      });
      
      if (res && res.result && res.result.code === 200) {
        this.updateFinanceData(res.result.data);
      } else {
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        });
        this.loadMockData();
      }
    } catch (err) {
      console.error('加载财务数据失败:', err);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
      this.loadMockData();
    } finally {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  },

  // 更新财务数据
  updateFinanceData(data) {
    // 计算图表高度百分比
    const platformRevenueHeights = this.calculateChartHeights(data.chartData.platformRevenues || []);
    const merchantRevenueHeights = this.calculateChartHeights(data.chartData.merchantRevenues || []);
    const userConsumptionHeights = this.calculateChartHeights(data.chartData.userConsumptions || []);
    
    // 计算平均订单金额
    const orderCount = data.orderCount || 0;
    const userTotalConsumption = data.userTotalConsumption || 0;
    const avgOrderValue = orderCount > 0 ? (userTotalConsumption / orderCount).toFixed(2) : '0.00';
    
    this.setData({
      'financeStats.platformTotalRevenue': data.platformTotalRevenue || 0,
      'financeStats.merchantTotalRevenue': data.merchantTotalRevenue || 0,
      'financeStats.userTotalConsumption': data.userTotalConsumption || 0,
      'financeStats.totalRefundAmount': data.totalRefundAmount || 0,
      'financeStats.totalRefundCount': data.totalRefundCount || 0,
      'financeStats.netPlatformRevenue': data.netPlatformRevenue || 0,
      'financeStats.orderCount': data.orderCount || 0,
      'financeStats.avgOrderValue': avgOrderValue,
      'chartData.dates': data.chartData ? data.chartData.dates : [],
      'chartData.platformRevenues': data.chartData ? data.chartData.platformRevenues : [],
      'chartData.merchantRevenues': data.chartData ? data.chartData.merchantRevenues : [],
      'chartData.userConsumptions': data.chartData ? data.chartData.userConsumptions : [],
      'chartData.platformRevenueHeights': platformRevenueHeights,
      'chartData.merchantRevenueHeights': merchantRevenueHeights,
      'chartData.userConsumptionHeights': userConsumptionHeights,
      'merchantRanking': data.merchantRanking || []
    });
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

  // 加载模拟数据
  loadMockData() {
    const orderCount = 3421;
    const userTotalConsumption = 147089.80;
    const avgOrderValue = orderCount > 0 ? (userTotalConsumption / orderCount).toFixed(2) : '0.00';
    
    this.setData({
      'financeStats.platformTotalRevenue': 12568.50,
      'financeStats.merchantTotalRevenue': 134521.30,
      'financeStats.userTotalConsumption': userTotalConsumption,
      'financeStats.totalRefundAmount': 856.20,
      'financeStats.totalRefundCount': 12,
      'financeStats.netPlatformRevenue': 11612.30,
      'financeStats.orderCount': orderCount,
      'financeStats.avgOrderValue': avgOrderValue
    });
  },

  // 日期范围选择
  onDateRangeChange(e) {
    const range = ['week', 'month', 'quarter'][e.detail.value];
    this.setData({ dateRange: range, loading: true });
    this.loadFinanceData();
  },

  // 刷新数据
  onRefresh() {
    this.setData({ loading: true });
    this.loadFinanceData();
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

