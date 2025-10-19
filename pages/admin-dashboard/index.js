// pages/admin-dashboard/index.js
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
  loadDashboardData() {
    // 模拟从云函数获取数据
    // 实际开发中这里会调用云函数获取真实数据
    console.log('加载仪表板数据...');
    
    // 模拟数据更新
    const newStats = {
      ...this.data.stats,
      totalRevenue: (Math.random() * 100000 + 100000).toFixed(2),
      merchantCount: Math.floor(Math.random() * 50 + 150).toString(),
      orderCount: Math.floor(Math.random() * 2000 + 8000).toString(),
      userCount: Math.floor(Math.random() * 1000 + 3000).toString()
    };
    
    this.setData({
      stats: newStats
    });
  },


}); 
