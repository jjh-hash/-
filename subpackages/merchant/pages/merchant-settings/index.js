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
    version: '1.0.0'
  },

  onLoad() {
    this.loadSettings();
  },

  onShow() {
    this.loadSettings();
  },

  // 加载设置数据
  async loadSettings() {
    try {
      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      
      console.log('【设置页面】加载设置，商家ID:', merchantId);
      
      // 从店铺信息中加载起送金额
      const res = await wx.cloud.callFunction({
        name: 'storeManage',
        data: {
          action: 'getStoreInfo',
          data: {
            merchantId: merchantId // 传递商家ID，优先使用
          }
        }
      });
      
      if (res.result && res.result.code === 200) {
        const storeInfo = res.result.data.storeInfo;
        
        // 设置起送金额（从店铺信息中的minOrderAmount获取，与起步价保持一致）
        if (storeInfo.minOrderAmount !== undefined && storeInfo.minOrderAmount !== null) {
          // 确保格式化为两位小数
          const minOrderAmount = parseFloat(storeInfo.minOrderAmount).toFixed(2);
          this.setData({ minOrderAmount });
          console.log('【设置页面】加载起送金额:', minOrderAmount);
        }
        
        // 设置其他店铺信息
        if (storeInfo.businessHours) {
          const businessHours = `${storeInfo.businessHours.startTime} - ${storeInfo.businessHours.endTime}`;
          this.setData({ businessHours });
        }
        
        if (storeInfo.deliveryArea) {
          this.setData({ deliveryArea: storeInfo.deliveryArea });
        }
      }
    } catch (err) {
      console.error('加载设置失败:', err);
    }
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
          url: '/subpackages/merchant/pages/merchant-store-info/index'
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
            url: '/subpackages/merchant/pages/merchant-login/index'
          });
        }
      }
    });
  },

  // 营业时间选择
  async showBusinessHoursPicker() {
    wx.showActionSheet({
      itemList: ['09:00 - 22:00', '08:00 - 23:00', '10:00 - 21:00', '24小时营业'],
      success: async (res) => {
        const times = ['09:00 - 22:00', '08:00 - 23:00', '10:00 - 21:00', '24小时营业'];
        const selectedTime = times[res.tapIndex];
        this.setData({ businessHours: selectedTime });
        
        // 解析时间并保存
        if (selectedTime === '24小时营业') {
          await this.saveBusinessHours('00:00', '23:59');
        } else {
          const [startTime, endTime] = selectedTime.split(' - ');
          await this.saveBusinessHours(startTime, endTime);
        }
      }
    });
  },

  // 配送范围选择
  async showDeliveryAreaPicker() {
    wx.showActionSheet({
      itemList: ['校园内配送', '校园周边1公里', '校园周边3公里', '全城配送'],
      success: async (res) => {
        const areas = ['校园内配送', '校园周边1公里', '校园周边3公里', '全城配送'];
        const selectedArea = areas[res.tapIndex];
        this.setData({ deliveryArea: selectedArea });
        await this.saveDeliveryArea(selectedArea);
      }
    });
  },
  
  // 保存营业时间
  async saveBusinessHours(startTime, endTime) {
    try {
      wx.showLoading({ title: '保存中...' });
      
      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      
      const res = await wx.cloud.callFunction({
        name: 'storeManage',
        data: {
          action: 'updateBusinessHours',
          data: {
            startTime: startTime,
            endTime: endTime,
            merchantId: merchantId // 传递商家ID，优先使用
          }
        }
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '设置已保存',
          icon: 'success',
          duration: 1000
        });
      } else {
        wx.showToast({
          title: res.result?.message || '保存失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('保存营业时间失败:', err);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },
  
  // 保存配送范围
  async saveDeliveryArea(area) {
    try {
      wx.showLoading({ title: '保存中...' });
      
      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      
      const res = await wx.cloud.callFunction({
        name: 'storeManage',
        data: {
          action: 'updateStoreInfo',
          data: {
            deliveryArea: area,
            merchantId: merchantId // 传递商家ID，优先使用
          }
        }
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '设置已保存',
          icon: 'success',
          duration: 1000
        });
      } else {
        wx.showToast({
          title: res.result?.message || '保存失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('保存配送范围失败:', err);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 起送金额选择
  async showMinOrderPicker() {
    try {
      // 先获取平台设置的最低订单金额下限
      let minLimit = 20; // 默认下限20元
      try {
        const configRes = await wx.cloud.callFunction({
          name: 'platformConfig',
          data: {
            action: 'getConfig',
            data: {}
          }
        });
        
        if (configRes.result && configRes.result.code === 200) {
          minLimit = (configRes.result.data.minOrderAmountLimit || 2000) / 100; // 转换为元
        }
      } catch (err) {
        console.warn('获取平台配置失败，使用默认值:', err);
      }
      
      // 获取当前设置
      const currentAmount = parseFloat(this.data.minOrderAmount || '20');
      
      // 如果当前设置低于下限，提示并自动设置为下限
      if (currentAmount < minLimit) {
        wx.showModal({
          title: '提示',
          content: `平台设置的最低订单金额下限为¥${minLimit.toFixed(2)}，已自动调整为下限值`,
          showCancel: false,
          success: async () => {
            await this.saveMinOrderAmount(minLimit.toFixed(2));
            this.setData({ minOrderAmount: minLimit.toFixed(2) });
          }
        });
        return;
      }
      
      // 生成选项列表（从下限开始，每次增加5元）
      const options = [];
      const amounts = [];
      for (let i = minLimit; i <= minLimit + 30; i += 5) {
        options.push(`¥${i.toFixed(2)}`);
        amounts.push(i.toFixed(2));
      }
      
      wx.showActionSheet({
        itemList: options,
        success: async (res) => {
          const selectedAmount = amounts[res.tapIndex];
          const amountValue = parseFloat(selectedAmount);
          
          // 再次验证不能低于下限
          if (amountValue < minLimit) {
            wx.showToast({
              title: `不能低于¥${minLimit.toFixed(2)}`,
              icon: 'none'
            });
            return;
          }
          
          this.setData({ minOrderAmount: selectedAmount });
          await this.saveMinOrderAmount(selectedAmount);
        }
      });
    } catch (err) {
      console.error('显示起送金额选择器失败:', err);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  // 订单提醒设置
  showOrderReminderSettings() {
    wx.showToast({
      title: '正在开发中',
      icon: 'none'
    });
  },

  // 打印设置
  showPrintSettings() {
    wx.showToast({
      title: '正在开发中',
      icon: 'none'
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
    wx.navigateTo({
      url: '/subpackages/merchant/pages/merchant-change-password/index'
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

  // 保存起送金额（同步更新店铺信息）
  async saveMinOrderAmount(amount) {
    try {
      wx.showLoading({ title: '保存中...' });
      
      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      
      console.log('【设置页面】保存起送金额，商家ID:', merchantId);
      
      const res = await wx.cloud.callFunction({
        name: 'storeManage',
        data: {
          action: 'updateStoreInfo',
          data: {
            minOrderAmount: amount,
            merchantId: merchantId // 传递商家ID，优先使用
          }
        }
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '设置已保存',
          icon: 'success',
          duration: 1000
        });
      } else {
        wx.showToast({
          title: res.result?.message || '保存失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('保存起送金额失败:', err);
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 保存设置
  saveSetting(key, value) {
    // 如果是起送金额，使用专门的保存方法
    if (key === 'minOrderAmount') {
      this.saveMinOrderAmount(value);
      return;
    }
    
    // TODO: 调用云函数保存其他设置
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
