// pages/admin-profile/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    
    // 管理员信息
    adminInfo: {
      username: '超级管理员',
      role: 'super_admin',
      lastLoginTime: '2025-01-03 18:43',
      loginCount: 156,
      permissions: ['all']
    },
    
    // 系统信息
    systemInfo: {
      version: 'v1.0.0',
      buildTime: '2025-01-03',
      environment: 'production',
      uptime: '15天8小时'
    },
    
    // 操作日志
    operationLogs: [
      {
        id: 1,
        action: '商家审核',
        target: '河工零食',
        time: '2025-01-03 18:30',
        result: '通过'
      },
      {
        id: 2,
        action: '订单处理',
        target: '订单#202501030001',
        time: '2025-01-03 18:25',
        result: '完成'
      },
      {
        id: 3,
        action: '数据导出',
        target: '销售报表',
        time: '2025-01-03 18:20',
        result: '成功'
      }
    ]
  },

  onLoad() {
    console.log('管理员信息页面加载');
    this.loadAdminInfo();
  },

  onShow() {
    // 页面显示时刷新
  },

  onBack() {
    wx.navigateBack();
  },

  // 加载管理员信息
  loadAdminInfo() {
    // 模拟从云函数获取管理员信息
    console.log('加载管理员信息...');
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出管理后台吗？',
      success: (res) => {
        if (res.confirm) {
          // 清除管理员token
          wx.removeStorageSync('adminToken');
          
          wx.showToast({
            title: '已退出登录',
            icon: 'success'
          });
          
          // 跳转到商家注册页面
          setTimeout(() => {
            wx.navigateTo({
              url: '/pages/merchant-register/index'
            });
          }, 1500);
        }
      }
    });
  },

  // 修改密码
  onChangePassword() {
    wx.showModal({
      title: '修改密码',
      content: '此功能需要短信验证，是否继续？',
      success: (res) => {
        if (res.confirm) {
          wx.showToast({
            title: '功能开发中',
            icon: 'none'
          });
        }
      }
    });
  },

  // 查看操作日志
  onViewLogs() {
    wx.showToast({
      title: '操作日志功能开发中',
      icon: 'none'
    });
  },

  // 系统设置
  onSystemSettings() {
    wx.showToast({
      title: '系统设置功能开发中',
      icon: 'none'
    });
  },

  // 关于我们
  onAbout() {
    wx.showModal({
      title: '关于校园外卖管理端',
      content: '版本：v1.0.0\n开发团队：校园外卖项目组\n更新时间：2025-01-03',
      showCancel: false
    });
  }
});