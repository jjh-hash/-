Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    // 设置项
    autoRefresh: true // 自动刷新抢单大厅
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
          autoRefresh: settings.autoRefresh !== undefined ? settings.autoRefresh : true
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
        autoRefresh: this.data.autoRefresh
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


  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  }
});

