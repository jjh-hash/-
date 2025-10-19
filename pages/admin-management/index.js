// pages/admin-management/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    
    // 商家管理统计数据
    merchantStats: {
      total: '156',
      pending: '12',
      active: '144'
    },
    
    // 用户管理统计数据
    userStats: {
      total: '3,245',
      active: '2,890'
    },
    
    // 订单管理统计数据
    orderStats: {
      total: '8,432',
      pending: '23'
    },
    
    // 财务管理统计数据
    financeStats: {
      totalRevenue: '125,680.50',
      todayRevenue: '2,340.80'
    },
    
    // 平台管理统计数据
    platformStats: {
      activeAnnouncements: '3',
      activeActivities: '2'
    }
  },

  onLoad() {
    console.log('管理系统页面加载');
    this.loadManagementData();
  },

  onShow() {
    // 页面显示时刷新数据
    this.loadManagementData();
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
      this.loadManagementData();
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 500
      });
    }, 1000);
  },

  // 加载管理数据
  loadManagementData() {
    // 模拟从云函数获取数据
    console.log('加载管理数据...');
    
    // 模拟数据更新
    const newMerchantStats = {
      total: (Math.floor(Math.random() * 50 + 150)).toString(),
      pending: (Math.floor(Math.random() * 20 + 5)).toString(),
      active: (Math.floor(Math.random() * 50 + 140)).toString()
    };
    
    const newUserStats = {
      total: (Math.floor(Math.random() * 1000 + 3000)).toString(),
      active: (Math.floor(Math.random() * 500 + 2500)).toString()
    };
    
    const newOrderStats = {
      total: (Math.floor(Math.random() * 2000 + 8000)).toString(),
      pending: (Math.floor(Math.random() * 30 + 10)).toString()
    };
    
    const newFinanceStats = {
      totalRevenue: (Math.random() * 100000 + 100000).toFixed(2),
      todayRevenue: (Math.random() * 5000 + 1000).toFixed(2)
    };
    
    this.setData({
      merchantStats: newMerchantStats,
      userStats: newUserStats,
      orderStats: newOrderStats,
      financeStats: newFinanceStats
    });
  },

  // 功能模块点击
  onFunctionClick(e) {
    const function = e.currentTarget.dataset.function;
    
    switch(function) {
      case 'merchant':
        wx.showModal({
          title: '商家管理',
          content: '商家管理功能开发中，将包含：\n• 商家列表查看\n• 商家审核\n• 状态管理\n• 资质审核\n• 商家统计',
          showCancel: false,
          confirmText: '知道了'
        });
        break;
      case 'user':
        wx.showModal({
          title: '用户管理',
          content: '用户管理功能开发中，将包含：\n• 用户列表查看\n• 用户信息管理\n• 权限控制\n• 状态管理\n• 用户统计',
          showCancel: false,
          confirmText: '知道了'
        });
        break;
      case 'order':
        wx.showModal({
          title: '订单管理',
          content: '订单管理功能开发中，将包含：\n• 订单列表查看\n• 订单状态管理\n• 退款处理\n• 异常订单处理\n• 订单统计',
          showCancel: false,
          confirmText: '知道了'
        });
        break;
      case 'finance':
        wx.showModal({
          title: '财务管理',
          content: '财务管理功能开发中，将包含：\n• 收益统计\n• 分账管理\n• 财务报表\n• 结算管理\n• 财务分析',
          showCancel: false,
          confirmText: '知道了'
        });
        break;
      case 'platform':
        wx.showModal({
          title: '平台管理',
          content: '平台管理功能开发中，将包含：\n• 系统设置\n• 公告管理\n• 活动管理\n• 系统监控\n• 平台统计',
          showCancel: false,
          confirmText: '知道了'
        });
        break;
      default:
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        });
    }
  },

  // 快速操作
  onQuickAction(e) {
    const action = e.currentTarget.dataset.action;
    
    switch(action) {
      case 'approve_merchants':
        wx.showModal({
          title: '批量审核商家',
          content: '是否要批量审核所有待审核的商家？',
          showCancel: true,
          cancelText: '取消',
          confirmText: '确定',
          success: (res) => {
            if (res.confirm) {
              wx.showLoading({ title: '处理中...' });
              setTimeout(() => {
                wx.hideLoading();
                wx.showToast({
                  title: '批量审核完成',
                  icon: 'success'
                });
              }, 2000);
            }
          }
        });
        break;
      case 'process_orders':
        wx.showModal({
          title: '处理待办订单',
          content: '是否要处理所有待办的订单？',
          showCancel: true,
          cancelText: '取消',
          confirmText: '确定',
          success: (res) => {
            if (res.confirm) {
              wx.showLoading({ title: '处理中...' });
              setTimeout(() => {
                wx.hideLoading();
                wx.showToast({
                  title: '订单处理完成',
                  icon: 'success'
                });
              }, 2000);
            }
          }
        });
        break;
      case 'view_reports':
        wx.showModal({
          title: '查看报表',
          content: '报表功能开发中，将包含：\n• 销售报表\n• 用户报表\n• 财务报表\n• 商家报表',
          showCancel: false,
          confirmText: '知道了'
        });
        break;
      case 'system_settings':
        wx.showModal({
          title: '系统设置',
          content: '系统设置功能开发中，将包含：\n• 基本设置\n• 支付设置\n• 通知设置\n• 安全设置',
          showCancel: false,
          confirmText: '知道了'
        });
        break;
      default:
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        });
    }
  },

});