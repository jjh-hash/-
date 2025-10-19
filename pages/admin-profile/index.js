// pages/admin-profile/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    
    // 登录信息
    loginInfo: {
      lastLoginTime: '2025-01-03 18:43:25',
      lastLoginIP: '192.168.1.100',
      loginDevice: 'iPhone 15 Pro',
      onlineDuration: '2小时30分钟'
    },
    
    // 操作记录
    operationLogs: [
      {
        icon: '👥',
        title: '审核商家申请',
        description: '审核通过"河工零食"商家入驻申请',
        time: '2025-01-03 18:30'
      },
      {
        icon: '📦',
        title: '处理订单异常',
        description: '处理订单#202501030001的退款申请',
        time: '2025-01-03 17:45'
      },
      {
        icon: '💰',
        title: '查看财务报表',
        description: '查看本月平台收益统计报表',
        time: '2025-01-03 16:20'
      },
      {
        icon: '⚙️',
        title: '系统设置更新',
        description: '更新平台公告和活动配置',
        time: '2025-01-03 15:10'
      }
    ]
  },

  onLoad() {
    console.log('管理员信息页面加载');
  },

  onShow() {
    // 页面显示时刷新数据
    this.loadAdminData();
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
      this.loadAdminData();
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 500
      });
    }, 1000);
  },

  // 加载管理员数据
  loadAdminData() {
    // 模拟从云函数获取数据
    console.log('加载管理员数据...');
    
    // 模拟数据更新
    const newLoginInfo = {
      ...this.data.loginInfo,
      lastLoginTime: new Date().toLocaleString(),
      onlineDuration: Math.floor(Math.random() * 10 + 1) + '小时' + Math.floor(Math.random() * 60) + '分钟'
    };
    
    this.setData({
      loginInfo: newLoginInfo
    });
  },

  // 设置项点击
  onSettingClick(e) {
    const setting = e.currentTarget.dataset.setting;
    
    switch(setting) {
      case 'password':
        wx.showModal({
          title: '修改密码',
          content: '修改密码功能开发中，将包含：\n• 密码强度验证\n• 短信验证码\n• 安全设置',
          showCancel: false,
          confirmText: '知道了'
        });
        break;
      case 'notification':
        wx.showModal({
          title: '通知设置',
          content: '通知设置功能开发中，将包含：\n• 系统通知\n• 邮件通知\n• 短信通知\n• 推送设置',
          showCancel: false,
          confirmText: '知道了'
        });
        break;
      case 'security':
        wx.showModal({
          title: '安全设置',
          content: '安全设置功能开发中，将包含：\n• 登录验证\n• 操作日志\n• 权限管理\n• 安全策略',
          showCancel: false,
          confirmText: '知道了'
        });
        break;
      case 'logout':
        wx.showModal({
          title: '退出登录',
          content: '确定要退出当前账号吗？',
          showCancel: true,
          cancelText: '取消',
          confirmText: '确定',
          success: (res) => {
            if (res.confirm) {
              // 清除本地存储的管理员信息
              wx.removeStorageSync('adminToken');
              wx.showToast({
                title: '已退出登录',
                icon: 'success'
              });
              
              // 跳转到登录页面
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            }
          }
        });
        break;
      default:
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        });
    }
  }
});