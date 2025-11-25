Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    // 设置项
    autoRefresh: true, // 自动刷新抢单大厅
    maxOrders: 6, // 同时接单量
    
    // 弹窗状态
    showMaxOrdersModal: false,
    
    // 同时接单量选项
    maxOrdersOptions: [
      { value: 1, label: '1单' },
      { value: 2, label: '2单' },
      { value: 3, label: '3单' },
      { value: 4, label: '4单' },
      { value: 5, label: '5单' },
      { value: 6, label: '6单(最大)' }
    ]
  },

  onLoad(options) {
    // 加载设置数据
    this.loadSettings();
  },

  onShow() {
    // 页面显示时刷新设置
    this.loadSettings();
  },

  // 加载设置
  async loadSettings() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'riderManage',
        data: {
          action: 'getRiderSettings',
          data: {}
        }
      });

      if (res.result && res.result.code === 200) {
        const settings = res.result.data || {};
        this.setData({
          autoRefresh: settings.autoRefresh !== undefined ? settings.autoRefresh : true,
          maxOrders: settings.maxOrders || 6
        });
      } else {
        // 如果获取失败，使用默认值
        console.log('获取设置失败，使用默认值');
      }
    } catch (error) {
      console.error('加载设置失败:', error);
      // 使用默认值
    }
  },

  // 保存设置
  async saveSettings() {
    try {
      const settings = {
        autoRefresh: this.data.autoRefresh,
        maxOrders: this.data.maxOrders
      };

      const res = await wx.cloud.callFunction({
        name: 'riderManage',
        data: {
          action: 'saveRiderSettings',
          data: settings
        }
      });

      if (res.result && res.result.code === 200) {
        console.log('设置保存成功');
      } else {
        console.error('保存设置失败:', res.result);
      }
    } catch (error) {
      console.error('保存设置异常:', error);
    }
  },

  // 返回
  onBack() {
    wx.navigateBack();
  },

  // 自动刷新开关变化
  onAutoRefreshChange(e) {
    const value = e.detail.value;
    this.setData({
      autoRefresh: value
    });
    this.saveSettings();
    
    // 更新描述文字
    if (value) {
      wx.showToast({
        title: '已开启自动刷新',
        icon: 'success',
        duration: 1500
      });
    } else {
      wx.showToast({
        title: '已关闭自动刷新',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 设置同时接单量
  onSetMaxOrders(e) {
    console.log('点击设置同时接单量');
    this.setData({
      showMaxOrdersModal: true
    });
  },

  // 关闭同时接单量弹窗
  onCloseMaxOrdersModal() {
    this.setData({
      showMaxOrdersModal: false
    });
  },

  // 选择同时接单量
  onSelectMaxOrders(e) {
    const value = parseInt(e.currentTarget.dataset.value);
    console.log('选择同时接单量:', value);
    
    if (!value || value < 1 || value > 6) {
      wx.showToast({
        title: '请选择有效的接单量',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      maxOrders: value,
      showMaxOrdersModal: false
    });
    
    // 保存设置
    this.saveSettings();
    
    wx.showToast({
      title: `已设置为${value}单`,
      icon: 'success',
      duration: 1500
    });
  },

  // 显示同时接单量帮助
  onShowMaxOrdersHelp() {
    wx.showModal({
      title: '同时接单量说明',
      content: '同时接单量是指您当前正在处理的订单总数，包括待取货和待送达的订单。当达到上限时，系统将不再为您分配新订单。',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  }
});

