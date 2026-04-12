const log = require('../../../../utils/logger.js');
const subscribeMessage = require('../../../../utils/subscribeMessage.js');
const campusTradeGuard = require('../../../../utils/campusTradeGuard');

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
    estimatedDeliveryTimeRange: '30~45分钟', // 预计到达时间范围，默认值
    announcementExpanded: false, // 公告是否展开
    announcementNeedExpand: false, // 是否需要展开按钮（文字超过一定长度时）
    submitting: false // 提交订单防重复
  },

  // 从地址文本中提取楼层（仅支持 1~6 楼）
  extractFloorFromAddress(addressObj) {
    const text = [
      addressObj?.buildingName,
      addressObj?.houseNumber,
      addressObj?.addressDetail,
      addressObj?.address
    ].filter(Boolean).join(' ');
    if (!text) return null;

    const floorMatch = text.match(/([1-6])\s*楼/);
    if (floorMatch) return parseInt(floorMatch[1], 10);

    const roomMatch = text.match(/\b([1-6])\d{2,3}\b/);
    if (roomMatch) return parseInt(roomMatch[1], 10);
    return null;
  },

  // 根据楼层计算配送费：1-3楼 1.5 元；4-6楼 2 元；无法识别默认 2 元
  getDeliveryFeeByAddress(addressObj) {
    const floor = this.extractFloorFromAddress(addressObj);
    if (floor >= 1 && floor <= 3) return 1.5;
    if (floor >= 4 && floor <= 6) return 2;
    return 2;
  },

  // 当前业务仅收配送费，餐费由骑手垫付后线下转给骑手
  updateSettlementAmountByAddress(addressObj) {
    const deliveryFee = this.getDeliveryFeeByAddress(addressObj);
    this.setData({
      deliveryFee,
      totalAmount: deliveryFee
    });
  },

  onLoad(options) {
    if (!getApp().globalData.isLoggedIn) {
      wx.showToast({ title: '请先登录后再下单', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    log.log('【结算页面】接收参数:', options);
    
    // 获取传递的购物车数据
    if (options.cartData) {
      try {
        const cartData = JSON.parse(decodeURIComponent(options.cartData));
        
        log.log('【结算页面】解析购物车数据:', cartData);
        
        this.setData({
          cartItems: cartData.cartItems || [],
          cartTotal: cartData.cartTotal || 0,
          storeInfo: cartData.storeInfo || {},
          deliveryFee: 2,
          deliveryType: cartData.deliveryType || 'delivery' // 保存配送方式
        }, () => {
          // 检查公告是否需要展开按钮
          this.checkAnnouncementLength();
        });
        this.updateSettlementAmountByAddress(this.data.userInfo);
        
        log.log('【结算页面】设置完成:', {
          cartItems: this.data.cartItems,
          cartTotal: this.data.cartTotal,
          storeInfo: this.data.storeInfo,
          deliveryFee: this.data.deliveryFee,
          totalAmount: this.data.totalAmount
        });
      } catch (error) {
        log.error('【结算页面】解析购物车数据失败:', error);
        wx.showToast({
          title: '数据加载失败',
          icon: 'none'
        });
      }
    } else {
      log.error('【结算页面】未接收到购物车数据');
      wx.showToast({
        title: '数据加载失败',
        icon: 'none'
      });
    }
    
    // 加载用户地址
    this.loadUserAddress();
    // 预拉订阅模板 ID，支付点击时同步弹窗（真机要求同一次点击链路）
    subscribeMessage.preloadOrderStatusTemplateId();
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
      
      log.log('【结算页面】平台配置:', res.result);
      
      if (res.result && res.result.code === 200) {
        const config = res.result.data;
        const g = getApp().globalData;
        if (config.subscribeMessageOrderStatusTemplateId) g.subscribeMessageOrderStatusTemplateId = config.subscribeMessageOrderStatusTemplateId;
        if (config.subscribeMessageRefundTemplateId !== undefined) g.subscribeMessageRefundTemplateId = config.subscribeMessageRefundTemplateId || '';
        if (config.subscribeMessageReviewTemplateId !== undefined) g.subscribeMessageReviewTemplateId = config.subscribeMessageReviewTemplateId || '';
        const estimatedDeliveryMinutes = config.estimatedDeliveryMinutes || 30;
        
        // 计算预计到达时间范围（配置值 ~ 配置值+15分钟）
        const minMinutes = estimatedDeliveryMinutes;
        const maxMinutes = minMinutes + 15;
        const estimatedDeliveryTimeRange = `${minMinutes}~${maxMinutes}分钟`;
        
        this.setData({
          estimatedDeliveryTimeRange: estimatedDeliveryTimeRange
        });
        
        log.log('【结算页面】预计到达时间范围:', estimatedDeliveryTimeRange);
      }
    } catch (error) {
      log.error('【结算页面】加载平台配置失败:', error);
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

      log.log('【结算页面】地址列表:', res.result);

      if (res.result && res.result.code === 200 && res.result.data.list.length > 0) {
        // 获取默认地址或第一个地址
        const defaultAddress = res.result.data.list.find(addr => addr.isDefault) || res.result.data.list[0];
        
        this.setData({
          userInfo: {
            name: defaultAddress.name,
            phone: defaultAddress.phone,
            address: `${defaultAddress.addressDetail}${defaultAddress.buildingName ? defaultAddress.buildingName : ''}${defaultAddress.houseNumber ? defaultAddress.houseNumber : ''}`,
            addressDetail: defaultAddress.addressDetail || '',
            buildingName: defaultAddress.buildingName || '',
            houseNumber: defaultAddress.houseNumber || ''
          },
          hasAddress: true
        });
        this.updateSettlementAmountByAddress(defaultAddress);
        
        log.log('【结算页面】设置默认地址:', this.data.userInfo);
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
        log.log('【结算页面】用户没有地址');
      }
    } catch (error) {
      log.error('【结算页面】加载地址失败:', error);
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

  // 提交订单（直接创建订单并支付）
  onSubmitOrder() {
    if (this.data.submitting) return;
    if (this.data.cartItems.length === 0) {
      wx.showToast({ title: '购物车为空', icon: 'none' });
      return;
    }
    if (!this.data.hasAddress) {
      wx.showToast({ title: '请先添加收货地址', icon: 'none', duration: 2000 });
      return;
    }

    const tradeGate = campusTradeGuard.canTransactInCurrentBrowseCampus();
    if (!tradeGate.ok) {
      wx.showToast({ title: tradeGate.message, icon: 'none' });
      return;
    }

    const tmplIds = subscribeMessage.getCheckoutTemplateIds();
    if (tmplIds.length === 0) {
      wx.showToast({ title: '加载中，请稍后再试', icon: 'none' });
      subscribeMessage.preloadOrderStatusTemplateId();
      return;
    }

    this.setData({ submitting: true });
    subscribeMessage.triggerSubscribeSync(tmplIds)
      .then(() => this.createOrderAndPay())
      .catch(() => this.createOrderAndPay());
  },

  // 创建订单并支付
  async createOrderAndPay() {
    if (!getApp().globalData.isLoggedIn) {
      getApp().showLoginModal();
      this.setData({ submitting: false });
      return;
    }
    const tradeGate = campusTradeGuard.canTransactInCurrentBrowseCampus();
    if (!tradeGate.ok) {
      this.setData({ submitting: false });
      wx.showToast({ title: tradeGate.message, icon: 'none' });
      return;
    }
    wx.showLoading({
      title: '正在下单...'
    });

    try {
      // 验证必要参数
      const storeId = this.data.storeInfo.storeId || this.data.storeInfo._id;
      
      log.log('【下单】准备下单的数据:', {
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
        this.setData({ submitting: false });
        wx.showToast({
          title: '店铺信息缺失',
          icon: 'none'
        });
        return;
      }
      
      if (!this.data.cartItems || this.data.cartItems.length === 0) {
        wx.hideLoading();
        this.setData({ submitting: false });
        wx.showToast({
          title: '购物车为空',
          icon: 'none'
        });
        return;
      }
      
      // 准备订单数据
      const orderData = {
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
      };

      // 调用云函数创建订单
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'createOrder',
          data: orderData
        }
      });

      wx.hideLoading();

      log.log('【下单】云函数返回结果:', res.result);

      if (res.result && res.result.code === 200) {
        const orderData = res.result.data;
        const orderId = orderData?.orderId;
        const orderNo = orderData?.orderNo;
        // 使用页面计算的金额转换为分（更可靠）
        const totalAmountFen = Math.round(this.data.totalAmount * 100);
        
        log.log('【下单】订单创建成功，订单号:', orderNo, '订单ID:', orderId, '支付金额（分）:', totalAmountFen);
        
        wx.hideLoading();
        await this.payOrder(orderId, orderNo, totalAmountFen);
      } else if (res.result && res.result.code === 403) {
        // 店铺休息中
        this.setData({ submitting: false });
        wx.showToast({
          title: res.result.message || '店铺当前休息中，暂不接收订单',
          icon: 'none',
          duration: 3000
        });
      } else {
        this.setData({ submitting: false });
        wx.showToast({
          title: res.result?.message || '下单失败',
          icon: 'none',
          duration: 2000
        });
      }

    } catch (error) {
      wx.hideLoading();
      this.setData({ submitting: false });
      log.error('【下单】异常:', error);
      log.error('【下单】错误详情:', {
        message: error.message,
        stack: error.stack,
        error: error
      });
      
      wx.showToast({
        title: '下单失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 支付订单（由 createOrderAndPay 在订单创建后调用，不再在此处请求订阅）
  async payOrder(orderId, orderNo, totalAmount) {
    wx.showLoading({ title: '正在支付...' });

    try {
      // 调用统一下单接口
      const res = await wx.cloud.callFunction({
        name: 'paymentManage',
        data: {
          action: 'unifiedOrder',
          data: {
            orderId: orderId,
            totalFee: totalAmount, // 金额（分）
            description: `订单支付-${orderNo}`
          }
        }
      });

      wx.hideLoading();

      log.log('【支付】统一下单返回:', res.result);

      if (res.result && res.result.code === 200) {
        const paymentParams = res.result.data;

        // 调用微信支付
        wx.requestPayment({
          timeStamp: paymentParams.timeStamp,
          nonceStr: paymentParams.nonceStr,
          package: paymentParams.package,
          signType: paymentParams.signType,
          paySign: paymentParams.paySign,
          success: async (payRes) => {
            log.log('【支付】成功:', payRes);

            // 支付成功后主动更新订单状态
            try {
              const updateRes = await wx.cloud.callFunction({
                name: 'orderManage',
                data: {
                  action: 'updateOrderPayStatus',
                  data: {
                    orderId: orderId,
                    payStatus: 'paid'
                  }
                }
              });
            } catch (updateError) {
              log.warn('【支付】更新订单状态失败:', updateError);
              // 不影响支付成功提示
            }
            wx.showToast({
              title: '支付成功',
              icon: 'success',
              duration: 2000
            });

            // 跳转到订单页面（带 from=pay 与 orderId 便于订单页高亮/提示）
            const orderListUrl = `/subpackages/order/pages/order/index?from=pay&orderId=${encodeURIComponent(orderId)}`;
            setTimeout(() => {
              wx.redirectTo({
                url: orderListUrl,
                fail: (err) => {
                  log.error('跳转到订单页面失败:', err);
                  wx.reLaunch({ url: orderListUrl });
                }
              });
            }, 2000);
          },
          fail: (payErr) => {
            this.setData({ submitting: false });
            log.error('【支付】失败:', payErr);
            wx.showToast({
              title: '支付失败',
              icon: 'none',
              duration: 2000
            });
            // 支付失败后，跳转到订单页面，用户可以重新支付
            setTimeout(() => {
              wx.redirectTo({
                url: '/subpackages/order/pages/order/index'
              });
            }, 2000);
          }
        });
      } else {
        this.setData({ submitting: false });
        wx.showToast({
          title: res.result?.message || '统一下单失败',
          icon: 'none',
          duration: 2000
        });
        // 统一下单失败，跳转到订单页面
        setTimeout(() => {
          wx.redirectTo({
            url: '/subpackages/order/pages/order/index'
          });
        }, 2000);
      }
    } catch (error) {
      wx.hideLoading();
      this.setData({ submitting: false });
      log.error('【支付】异常:', error);
      wx.showToast({
        title: '支付异常，请重试',
        icon: 'none',
        duration: 2000
      });
      // 支付异常，跳转到订单页面
      setTimeout(() => {
        wx.redirectTo({
          url: '/subpackages/order/pages/order/index'
        });
      }, 2000);
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

  // 检查公告长度，判断是否需要展开按钮
  checkAnnouncementLength() {
    const announcement = this.data.storeInfo.announcement || '';
    // 如果公告超过50个字符，显示展开按钮
    const needExpand = announcement.length > 50;
    this.setData({
      announcementNeedExpand: needExpand
    });
  },

  // 切换公告展开/收起
  onToggleAnnouncement() {
    this.setData({
      announcementExpanded: !this.data.announcementExpanded
    });
  },

  // 页面显示时刷新地址（从地址页面返回时）
  onShow() {
    // 如果用户已经手动选择了地址，不要重新加载默认地址
    // 如果之前没有地址，或者从地址页面返回，则刷新地址
    // 从添加地址页面返回时，需要刷新地址列表
    if (!this.data.addressSelected) {
      this.loadUserAddress();
      return;
    }
    this.updateSettlementAmountByAddress(this.data.userInfo);
  }
});
