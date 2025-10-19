Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    // 店铺管理
    businessHours: '09:00 - 22:00',
    deliveryArea: '校园内配送',
    minOrderAmount: '20.00',
    
    // 订单管理
    autoAccept: false,
    
    // 通知设置
    pushEnabled: true,
    soundEnabled: true,
    
    // 安全设置
    loginVerification: false,
    
    // 系统设置
    language: '简体中文',
    theme: '浅色模式',
    version: '1.0.0'
  },

  onLoad() {
    this.loadSettings();
  },

  onShow() {
    this.loadSettings();
  },

  // 加载设置数据
  loadSettings() {
    // TODO: 从云数据库加载设置数据
    // wx.cloud.callFunction({
    //   name: 'merchant/getSettings',
    //   data: {
    //     storeId: 'your_store_id'
    //   }
    // }).then(res => {
    //   if (res.result.code === 0) {
    //     this.setData(res.result.data);
    //   }
    // }).catch(err => {
    //   console.error('加载设置失败:', err);
    // });
    
    // 模拟加载数据
    console.log('加载设置数据');
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 点击设置项
  onSettingTap(e) {
    const type = e.currentTarget.dataset.type;
    
    switch (type) {
      case 'store-info':
        wx.navigateTo({
          url: '/pages/merchant-store-info/index'
        });
        break;
      case 'business-hours':
        this.showBusinessHoursPicker();
        break;
      case 'delivery-area':
        this.showDeliveryAreaPicker();
        break;
      case 'min-order':
        this.showMinOrderPicker();
        break;
      case 'order-reminder':
        this.showOrderReminderSettings();
        break;
      case 'print-settings':
        this.showPrintSettings();
        break;
      case 'payment-methods':
        this.showPaymentMethods();
        break;
      case 'settlement':
        this.showSettlementSettings();
        break;
      case 'change-password':
        this.showChangePassword();
        break;
      case 'language':
        this.showLanguagePicker();
        break;
      case 'theme':
        this.showThemePicker();
        break;
      case 'about':
        this.showAbout();
        break;
      default:
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        });
    }
  },

  // 自动接单开关
  onAutoAcceptChange(e) {
    this.setData({ autoAccept: e.detail.value });
    this.saveSetting('autoAccept', e.detail.value);
  },

  // 推送开关
  onPushChange(e) {
    this.setData({ pushEnabled: e.detail.value });
    this.saveSetting('pushEnabled', e.detail.value);
  },

  // 声音开关
  onSoundChange(e) {
    this.setData({ soundEnabled: e.detail.value });
    this.saveSetting('soundEnabled', e.detail.value);
  },

  // 登录验证开关
  onLoginVerificationChange(e) {
    this.setData({ loginVerification: e.detail.value });
    this.saveSetting('loginVerification', e.detail.value);
  },

  // 清理缓存
  onClearCache() {
    wx.showModal({
      title: '清理缓存',
      content: '确定要清理缓存吗？这将删除临时文件，但不会影响您的数据。',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '清理中...' });
          
          // 模拟清理缓存
          setTimeout(() => {
            wx.hideLoading();
            wx.showToast({
              title: '清理完成',
              icon: 'success'
            });
          }, 1500);
        }
      }
    });
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          // TODO: 调用云函数清除登录状态
          // wx.cloud.callFunction({
          //   name: 'auth/logout'
          // }).then(() => {
          //   wx.reLaunch({
          //     url: '/pages/merchant-login/index'
          //   });
          // });
          
          // 模拟退出登录
          wx.reLaunch({
            url: '/pages/merchant-login/index'
          });
        }
      }
    });
  },

  // 营业时间选择
  showBusinessHoursPicker() {
    wx.showActionSheet({
      itemList: ['09:00 - 22:00', '08:00 - 23:00', '10:00 - 21:00', '24小时营业'],
      success: (res) => {
        const times = ['09:00 - 22:00', '08:00 - 23:00', '10:00 - 21:00', '24小时营业'];
        this.setData({ businessHours: times[res.tapIndex] });
        this.saveSetting('businessHours', times[res.tapIndex]);
      }
    });
  },

  // 配送范围选择
  showDeliveryAreaPicker() {
    wx.showActionSheet({
      itemList: ['校园内配送', '校园周边1公里', '校园周边3公里', '全城配送'],
      success: (res) => {
        const areas = ['校园内配送', '校园周边1公里', '校园周边3公里', '全城配送'];
        this.setData({ deliveryArea: areas[res.tapIndex] });
        this.saveSetting('deliveryArea', areas[res.tapIndex]);
      }
    });
  },

  // 起送金额选择
  showMinOrderPicker() {
    wx.showActionSheet({
      itemList: ['¥15.00', '¥20.00', '¥25.00', '¥30.00', '¥50.00'],
      success: (res) => {
        const amounts = ['15.00', '20.00', '25.00', '30.00', '50.00'];
        this.setData({ minOrderAmount: amounts[res.tapIndex] });
        this.saveSetting('minOrderAmount', amounts[res.tapIndex]);
      }
    });
  },

  // 订单提醒设置
  showOrderReminderSettings() {
    wx.showModal({
      title: '订单提醒设置',
      content: '新订单提醒功能已开启，您将在有新订单时收到通知。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 打印设置
  showPrintSettings() {
    wx.showModal({
      title: '打印设置',
      content: '打印机配置功能开发中，敬请期待。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 支付方式
  showPaymentMethods() {
    wx.showModal({
      title: '支付方式',
      content: '当前支持微信支付和校园卡支付。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 结算设置
  showSettlementSettings() {
    wx.showActionSheet({
      itemList: ['日结算', '周结算', '月结算'],
      success: (res) => {
        const cycles = ['日结算', '周结算', '月结算'];
        this.setData({ settlementCycle: cycles[res.tapIndex] });
        this.saveSetting('settlementCycle', cycles[res.tapIndex]);
      }
    });
  },

  // 修改密码
  showChangePassword() {
    wx.showModal({
      title: '修改密码',
      content: '密码修改功能开发中，敬请期待。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 语言选择
  showLanguagePicker() {
    wx.showActionSheet({
      itemList: ['简体中文', 'English', '繁體中文'],
      success: (res) => {
        const languages = ['简体中文', 'English', '繁體中文'];
        this.setData({ language: languages[res.tapIndex] });
        this.saveSetting('language', languages[res.tapIndex]);
      }
    });
  },

  // 主题选择
  showThemePicker() {
    wx.showActionSheet({
      itemList: ['浅色模式', '深色模式', '跟随系统'],
      success: (res) => {
        const themes = ['浅色模式', '深色模式', '跟随系统'];
        this.setData({ theme: themes[res.tapIndex] });
        this.saveSetting('theme', themes[res.tapIndex]);
      }
    });
  },

  // 关于我们
  showAbout() {
    wx.showModal({
      title: '关于我们',
      content: '校园外卖商家端 v1.0.0\n\n为校园商家提供便捷的外卖管理服务。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 保存设置
  saveSetting(key, value) {
    // TODO: 调用云函数保存设置
    // wx.cloud.callFunction({
    //   name: 'merchant/updateSetting',
    //   data: {
    //     storeId: 'your_store_id',
    //     key: key,
    //     value: value
    //   }
    // }).then(res => {
    //   if (res.result.code === 0) {
    //     wx.showToast({
    //       title: '设置已保存',
    //       icon: 'success',
    //       duration: 1000
    //     });
    //   }
    // }).catch(err => {
    //   console.error('保存设置失败:', err);
    // });
    
    // 模拟保存成功
    console.log('保存设置:', key, value);
    wx.showToast({
      title: '设置已保存',
      icon: 'success',
      duration: 1000
    });
  }
});
