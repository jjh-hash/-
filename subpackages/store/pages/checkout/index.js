Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    cartItems: [],
    cartTotal: 0,
    storeInfo: {},
    deliveryFee: 2,
    totalAmount: 0,
    userInfo: {
      name: '',
      phone: '',
      address: ''
    },
    hasAddress: false, // 是否有地址
    paymentMethod: 'wechat',
    remark: '',
    addressSelected: false, // 是否已选择地址（用于防止onShow时覆盖用户选择的地址）
    needCutlery: true, // 是否需要餐具，默认需要
    cutleryQuantity: 1, // 餐具数量，默认1份
    estimatedDeliveryTimeRange: '30~45分钟' // 预计到达时间范围，默认值
  },

  onLoad(options) {
    console.log('【结算页面】接收参数:', options);
    
    // 获取传递的购物车数据
    if (options.cartData) {
      try {
        const cartData = JSON.parse(decodeURIComponent(options.cartData));
        
        console.log('【结算页面】解析购物车数据:', cartData);
        
        // 从storeInfo中获取配送费
        const deliveryFee = cartData.storeInfo?.deliveryFee || 2;
        
        this.setData({
          cartItems: cartData.cartItems || [],
          cartTotal: cartData.cartTotal || 0,
          storeInfo: cartData.storeInfo || {},
          deliveryFee: deliveryFee,
          deliveryType: cartData.deliveryType || 'delivery' // 保存配送方式
        });
        
        // 计算总金额（商品金额 + 配送费）
        const totalAmount = this.data.cartTotal + deliveryFee;
        this.setData({
          totalAmount: totalAmount
        });
        
        console.log('【结算页面】设置完成:', {
          cartItems: this.data.cartItems,
          cartTotal: this.data.cartTotal,
          storeInfo: this.data.storeInfo,
          deliveryFee: this.data.deliveryFee,
          totalAmount: this.data.totalAmount
        });
      } catch (error) {
        console.error('【结算页面】解析购物车数据失败:', error);
        wx.showToast({
          title: '数据加载失败',
          icon: 'none'
        });
      }
    } else {
      console.error('【结算页面】未接收到购物车数据');
      wx.showToast({
        title: '数据加载失败',
        icon: 'none'
      });
    }
    
    // 加载用户地址
    this.loadUserAddress();
    
    // 加载平台配置，获取预计配送时间
    this.loadPlatformConfig();
  },
  
  // 加载平台配置
  async loadPlatformConfig() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'platformConfig',
        data: {
          action: 'getConfig'
        }
      });
      
      console.log('【结算页面】平台配置:', res.result);
      
      if (res.result && res.result.code === 200) {
        const config = res.result.data;
        const estimatedDeliveryMinutes = config.estimatedDeliveryMinutes || 30;
        
        // 计算预计到达时间范围（配置值 ~ 配置值+15分钟）
        const minMinutes = estimatedDeliveryMinutes;
        const maxMinutes = minMinutes + 15;
        const estimatedDeliveryTimeRange = `${minMinutes}~${maxMinutes}分钟`;
        
        this.setData({
          estimatedDeliveryTimeRange: estimatedDeliveryTimeRange
        });
        
        console.log('【结算页面】预计到达时间范围:', estimatedDeliveryTimeRange);
      }
    } catch (error) {
      console.error('【结算页面】加载平台配置失败:', error);
      // 如果加载失败，使用默认值
    }
  },

  // 加载用户地址
  async loadUserAddress() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'addressManage',
        data: {
          action: 'getAddressList',
          data: {}
        }
      });

      console.log('【结算页面】地址列表:', res.result);

      if (res.result && res.result.code === 200 && res.result.data.list.length > 0) {
        // 获取默认地址或第一个地址
        const defaultAddress = res.result.data.list.find(addr => addr.isDefault) || res.result.data.list[0];
        
        this.setData({
          userInfo: {
            name: defaultAddress.name,
            phone: defaultAddress.phone,
            address: `${defaultAddress.addressDetail}${defaultAddress.buildingName ? defaultAddress.buildingName : ''}${defaultAddress.houseNumber ? defaultAddress.houseNumber : ''}`
          },
          hasAddress: true
        });
        
        console.log('【结算页面】设置默认地址:', this.data.userInfo);
      } else {
        // 没有地址，设置为空
        this.setData({
          userInfo: {
            name: '',
            phone: '',
            address: ''
          },
          hasAddress: false
        });
        console.log('【结算页面】用户没有地址');
      }
    } catch (error) {
      console.error('【结算页面】加载地址失败:', error);
      // 如果加载失败，设置为没有地址
      this.setData({
        userInfo: {
          name: '',
          phone: '',
          address: ''
        },
        hasAddress: false
      });
    }
  },

  // 返回
  onBack() {
    wx.navigateBack();
  },

  // 选择支付方式
  onSelectPayment(e) {
    const method = e.currentTarget.dataset.method;
    this.setData({
      paymentMethod: method
    });
  },

  // 输入备注
  onRemarkInput(e) {
    this.setData({
      remark: e.detail.value
    });
  },

  // 切换餐具选择
  onToggleCutlery() {
    this.setData({
      needCutlery: !this.data.needCutlery,
      cutleryQuantity: !this.data.needCutlery ? 1 : this.data.cutleryQuantity // 如果切换到需要餐具，默认1份
    });
  },

  // 减少餐具数量
  onDecreaseCutlery() {
    if (this.data.cutleryQuantity > 1) {
      this.setData({
        cutleryQuantity: this.data.cutleryQuantity - 1
      });
    }
  },

  // 增加餐具数量
  onIncreaseCutlery() {
    if (this.data.cutleryQuantity < 10) { // 最多10份
      this.setData({
        cutleryQuantity: this.data.cutleryQuantity + 1
      });
    } else {
      wx.showToast({
        title: '最多选择10份',
        icon: 'none'
      });
    }
  },

  // 提交订单
  onSubmitOrder() {
    if (this.data.cartItems.length === 0) {
      wx.showToast({
        title: '购物车为空',
        icon: 'none'
      });
      return;
    }

    // 检查是否有地址
    if (!this.data.hasAddress) {
      wx.showToast({
        title: '请先添加收货地址',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 显示确认对话框
    wx.showModal({
      title: '确认下单',
      content: `总金额：¥${this.data.totalAmount}`,
      success: (res) => {
        if (res.confirm) {
          this.placeOrder();
        }
      }
    });
  },

  // 下单
  async placeOrder() {
    wx.showLoading({
      title: '正在下单...'
    });

    try {
      // 验证必要参数
      const storeId = this.data.storeInfo.storeId || this.data.storeInfo._id;
      
      console.log('【下单】准备下单的数据:', {
        storeId: storeId,
        cartItems: this.data.cartItems,
        cartTotal: this.data.cartTotal,
        storeInfo: this.data.storeInfo,
        userInfo: this.data.userInfo,
        remark: this.data.remark,
        deliveryFee: this.data.deliveryFee,
        deliveryType: this.data.deliveryType,
        needCutlery: this.data.needCutlery,
        cutleryQuantity: this.data.cutleryQuantity
      });
      
      if (!storeId) {
        wx.hideLoading();
        wx.showToast({
          title: '店铺信息缺失',
          icon: 'none'
        });
        return;
      }
      
      if (!this.data.cartItems || this.data.cartItems.length === 0) {
        wx.hideLoading();
        wx.showToast({
          title: '购物车为空',
          icon: 'none'
        });
        return;
      }
      
      // 调用云函数创建订单
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'createOrder',
          data: {
            storeId: storeId,
            cartItems: this.data.cartItems,
            cartTotal: this.data.cartTotal,
            storeInfo: this.data.storeInfo,
            address: this.data.userInfo,
            remark: this.data.remark,
            deliveryFee: this.data.deliveryFee,
            deliveryType: this.data.deliveryType || 'delivery',
            needCutlery: this.data.needCutlery,
            cutleryQuantity: this.data.needCutlery ? this.data.cutleryQuantity : 0
          }
        }
      });

      wx.hideLoading();

      console.log('【下单】云函数返回结果:', res.result);

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '下单成功',
          icon: 'success',
          duration: 2000
        });

        // 延迟跳转到订单页面
        setTimeout(() => {
          wx.redirectTo({
            url: '/subpackages/order/pages/order/index',
            fail: (err) => {
              console.error('跳转到订单页面失败:', err);
              // 如果redirectTo失败，尝试使用reLaunch
              wx.reLaunch({
                url: '/subpackages/order/pages/order/index'
              });
            }
          });
        }, 2000);
      } else if (res.result && res.result.code === 403) {
        // 店铺休息中
        wx.showToast({
          title: res.result.message || '店铺当前休息中，暂不接收订单',
          icon: 'none',
          duration: 3000
        });
      } else {
        wx.showToast({
          title: res.result?.message || '下单失败',
          icon: 'none',
          duration: 2000
        });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('【下单】异常:', error);
      wx.showToast({
        title: '下单失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 修改地址
  onEditAddress() {
    // 如果没有地址，跳转到添加地址页面
    if (!this.data.hasAddress) {
      wx.navigateTo({
        url: '/subpackages/common/pages/add-address/index?from=checkout'
      });
    } else {
      // 有地址，跳转到地址列表页面，传递来源参数
      wx.navigateTo({
        url: '/subpackages/common/pages/address/index?from=checkout'
      });
    }
  },

  // 页面显示时刷新地址（从地址页面返回时）
  onShow() {
    // 如果用户已经手动选择了地址，不要重新加载默认地址
    // 如果之前没有地址，或者从地址页面返回，则刷新地址
    // 从添加地址页面返回时，需要刷新地址列表
    if (!this.data.addressSelected) {
      this.loadUserAddress();
    }
  }
});
