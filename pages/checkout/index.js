Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    cartItems: [],
    cartTotal: 0,
    storeInfo: {},
    deliveryFee: 2,
    totalAmount: 0,
    userInfo: {
      name: '张三',
      phone: '138****8888',
      address: '北京市朝阳区某某街道123号'
    },
    paymentMethod: 'wechat',
    remark: ''
  },

  onLoad(options) {
    // 获取传递的购物车数据
    if (options.cartData) {
      try {
        const cartData = JSON.parse(decodeURIComponent(options.cartData));
        this.setData({
          cartItems: cartData.cartItems || [],
          cartTotal: cartData.cartTotal || 0,
          storeInfo: cartData.storeInfo || {}
        });
        
        // 计算总金额（商品金额 + 配送费）
        const totalAmount = this.data.cartTotal + this.data.deliveryFee;
        this.setData({
          totalAmount: totalAmount
        });
        
        console.log('结算页面加载购物车数据:', cartData);
      } catch (error) {
        console.error('解析购物车数据失败:', error);
        wx.showToast({
          title: '数据加载失败',
          icon: 'none'
        });
      }
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

  // 提交订单
  onSubmitOrder() {
    if (this.data.cartItems.length === 0) {
      wx.showToast({
        title: '购物车为空',
        icon: 'none'
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
  placeOrder() {
    wx.showLoading({
      title: '正在下单...'
    });

    // 模拟下单过程
    setTimeout(() => {
      wx.hideLoading();
      
      wx.showToast({
        title: '下单成功',
        icon: 'success',
        duration: 2000
      });

      // 延迟跳转到订单页面
      setTimeout(() => {
        wx.redirectTo({
          url: '/pages/order/index'
        });
      }, 2000);
    }, 1500);
  },

  // 修改地址
  onEditAddress() {
    wx.navigateTo({
      url: '/pages/address/index'
    });
  }
});
