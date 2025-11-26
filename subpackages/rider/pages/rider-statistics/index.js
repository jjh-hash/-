Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    refreshing: false,
    loading: false,
    totalStats: {
      orders: 0,
      income: '0.00'
    },
    todayStats: {
      orders: 0,
      income: '0.00'
    },
    weekStats: {
      orders: 0,
      income: '0.00'
    },
    monthStats: {
      orders: 0,
      income: '0.00'
    },
    todayDate: '',
    weekDateRange: '',
    monthDateRange: ''
  },

  onLoad() {
    this.initDates();
    this.loadStatistics();
  },

  // 初始化日期显示
  initDates() {
    const now = new Date();
    
    // 今日日期
    const todayStr = `${now.getMonth() + 1}月${now.getDate()}日`;
    
    // 本周日期范围
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekRange = `${weekStart.getMonth() + 1}/${weekStart.getDate()}-${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
    
    // 本月日期范围
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthRange = `${monthStart.getMonth() + 1}/${monthStart.getDate()}-${monthEnd.getMonth() + 1}/${monthEnd.getDate()}`;
    
    this.setData({
      todayDate: todayStr,
      weekDateRange: weekRange,
      monthDateRange: monthRange
    });
  },

  onShow() {
    // 页面显示时刷新数据
    this.loadStatistics();
  },

  // 加载统计数据
  async loadStatistics() {
    try {
      // 加载今日统计
      await this.loadTodayStats();
      // 加载总统计
      await this.loadTotalStats();
      // 加载本周统计
      await this.loadWeekStats();
      // 加载本月统计
      await this.loadMonthStats();
    } catch (error) {
      console.error('【统计数据】加载失败:', error);
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
      }
    } catch (error) {
      console.error('【统计数据】加载今日统计失败:', error);
    }
  },

  // 加载总统计数据
  async loadTotalStats() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getRiderTotalStats',
          data: {}
        }
      });
      
      if (res.result && res.result.code === 200) {
        this.setData({
          totalStats: {
            orders: res.result.data.orders || 0,
            income: res.result.data.income || '0.00'
          }
        });
      } else {
        console.log('【统计数据】获取总统计失败:', res.result);
      }
    } catch (error) {
      console.error('【统计数据】加载总统计失败:', error);
    }
  },

  // 加载本周统计数据
  async loadWeekStats() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getRiderWeekStats',
          data: {}
        }
      });
      
      if (res.result && res.result.code === 200) {
        this.setData({
          weekStats: {
            orders: res.result.data.orders || 0,
            income: res.result.data.income || '0.00'
          }
        });
      } else {
        this.setData({
          weekStats: {
            orders: 0,
            income: '0.00'
          }
        });
      }
    } catch (error) {
      console.error('【统计数据】加载本周统计失败:', error);
      this.setData({
        weekStats: {
          orders: 0,
          income: '0.00'
        }
      });
    }
  },

  // 加载本月统计数据
  async loadMonthStats() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getRiderMonthStats',
          data: {}
        }
      });
      
      if (res.result && res.result.code === 200) {
        this.setData({
          monthStats: {
            orders: res.result.data.orders || 0,
            income: res.result.data.income || '0.00'
          }
        });
      } else {
        this.setData({
          monthStats: {
            orders: 0,
            income: '0.00'
          }
        });
      }
    } catch (error) {
      console.error('【统计数据】加载本月统计失败:', error);
      this.setData({
        monthStats: {
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

  // 下拉刷新
  onPullDownRefresh() {
    console.log('【统计数据】下拉刷新');
    this.setData({
      refreshing: true
    });
    
    this.loadStatistics().then(() => {
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
      console.error('【统计数据】刷新失败:', error);
      this.setData({
        refreshing: false
      });
      wx.showToast({
        title: '刷新失败',
        icon: 'none',
        duration: 1500
      });
    });
  }
});

