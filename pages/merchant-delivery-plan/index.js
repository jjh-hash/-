Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    deliveryMethod: 'platform', // 默认选择平台配送
    deliveryFee: 17 // 默认配送费
  },

  onLoad() {
    // 页面加载时获取当前配送设置
    this.loadDeliverySettings();
  },

  onShow() {
    // 页面显示时刷新数据
  },

  // 加载配送设置
  loadDeliverySettings() {
    // TODO: 从云数据库获取当前商家的配送设置
    // 这里先使用默认值
    this.setData({
      deliveryMethod: 'platform',
      deliveryFee: 17
    });
  },

  // 选择配送方式
  selectDeliveryMethod(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({
      deliveryMethod: method
    });
    
    // 根据配送方式调整配送费
    if (method === 'platform') {
      this.setData({
        deliveryFee: 17
      });
    } else if (method === 'merchant') {
      this.setData({
        deliveryFee: 0
      });
    }
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 确认设置
  confirmSettings() {
    const { deliveryMethod, deliveryFee } = this.data;
    
    // 显示加载提示
    wx.showLoading({
      title: '保存中...'
    });

    // TODO: 调用云函数保存配送设置
    this.saveDeliverySettings(deliveryMethod, deliveryFee)
      .then(() => {
        wx.hideLoading();
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        
        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      })
      .catch((error) => {
        wx.hideLoading();
        wx.showToast({
          title: '保存失败',
          icon: 'error'
        });
        console.error('保存配送设置失败:', error);
      });
  },

  // 保存配送设置到云数据库
  saveDeliverySettings(method, fee) {
    return new Promise((resolve, reject) => {
      // TODO: 实现云函数调用
      // 这里先模拟成功
      setTimeout(() => {
        console.log('保存配送设置:', { method, fee });
        resolve();
      }, 1000);
      
      // 实际实现应该是：
      // wx.cloud.callFunction({
      //   name: 'merchant/updateDeliverySettings',
      //   data: {
      //     deliveryMethod: method,
      //     deliveryFee: fee
      //   }
      // }).then(res => {
      //   if (res.result.code === 0) {
      //     resolve(res.result.data);
      //   } else {
      //     reject(new Error(res.result.message));
      //   }
      // }).catch(reject);
    });
  }
});
