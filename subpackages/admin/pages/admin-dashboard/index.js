// pages/admin-dashboard/index.js
const { verifyAdminPage } = require('../../utils/verifyAdminPage.js');

Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    
    // 核心统计数据
    stats: {
      totalRevenue: '125,680.50', // 总营收
      merchantCount: '156', // 商家总数
      orderCount: '8,432', // 订单总数
      userCount: '3,245', // 用户总数
      revenueGrowth: '12.5', // 营收增长率
      merchantGrowth: '8.3', // 商家增长率
      orderGrowth: '15.7', // 订单增长率
      userGrowth: '22.1', // 用户增长率
      dailyActiveUsers: '1,234', // 日活跃用户
      monthlyActiveUsers: '2,890', // 月活跃用户
      dauGrowth: '5.2', // 日活增长率
      mauGrowth: '18.6' // 月活增长率
    },
    
    // 订单统计数据
    orderStats: {
      todayOrders: '89', // 今日订单
      pendingOrders: '23', // 待处理订单
      completedOrders: '1,245', // 已完成订单
      completionRate: '94.2', // 完成率
      avgOrderValue: '28.50', // 平均订单金额
      avgOrderGrowth: '3.8' // 平均订单金额增长率
    },
    
    // 收入趋势图表数据
    revenueChart: [
      { label: '周一', value: '1,250', height: 58 },
      { label: '周二', value: '1,680', height: 78 },
      { label: '周三', value: '1,420', height: 68 },
      { label: '周四', value: '1,890', height: 88 },
      { label: '周五', value: '2,150', height: 95 },
      { label: '周六', value: '1,750', height: 82 },
      { label: '周日', value: '1,320', height: 63 }
    ]
  },

  onLoad() {
    if (!verifyAdminPage()) return;
    console.log('数据概况页面加载');
    this.loadDashboardData();
  },

  onShow() {
    // 页面显示时刷新数据
    this.loadDashboardData();
  },

  onBack() {
    wx.navigateBack();
  },

  onRefresh() {
    wx.showToast({
      title: '数据刷新中...',
      icon: 'loading',
      duration: 1000
    });
    
    // 模拟数据刷新
    setTimeout(() => {
      this.loadDashboardData();
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 500
      });
    }, 1000);
  },

  // 加载仪表板数据
  async loadDashboardData() {
    console.log('加载仪表板数据...');
    
    wx.showLoading({ title: '加载中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'statistics',
        data: {
          action: 'getDashboardStats',
          data: {}
        }
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.code === 200) {
        const data = res.result.data;
        
        // 格式化数据
        const stats = {
          totalRevenue: this.formatMoney(data.totalRevenue),
          merchantCount: this.formatNumber(data.merchantCount),
          orderCount: this.formatNumber(data.orderCount),
          userCount: this.formatNumber(data.userCount),
          revenueGrowth: data.revenueGrowth,
          merchantGrowth: data.merchantGrowth,
          orderGrowth: data.orderGrowth,
          userGrowth: data.userGrowth,
          dailyActiveUsers: this.formatNumber(data.dailyActiveUsers),
          monthlyActiveUsers: this.formatNumber(data.monthlyActiveUsers),
          dauGrowth: data.dauGrowth,
          mauGrowth: data.mauGrowth
        };
        
        const orderStats = {
          todayOrders: this.formatNumber(data.todayOrders),
          pendingOrders: this.formatNumber(data.pendingOrders),
          completedOrders: this.formatNumber(data.completedOrders),
          completionRate: data.completionRate,
          avgOrderValue: data.avgOrderValue,
          avgOrderGrowth: data.avgOrderGrowth,
          todayGrowth: data.orderGrowth // 今日订单增长率
        };
        
        // 格式化收入趋势图表
        const revenueChart = data.revenueChart.map(item => ({
          label: item.label,
          value: this.formatMoney(item.value),
          height: item.height
        }));
        
        this.setData({
          stats: stats,
          orderStats: orderStats,
          revenueChart: revenueChart
        });
        
        console.log('【数据概况】数据加载成功');
      } else {
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('【数据概况】加载数据失败:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 格式化金额（添加千分位）
  formatMoney(value) {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  // 格式化数字（添加千分位）
  formatNumber(value) {
    const num = parseInt(value) || 0;
    return num.toLocaleString('zh-CN');
  },


}); 
