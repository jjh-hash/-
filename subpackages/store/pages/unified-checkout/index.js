// 统一结算页：多店一次付款，平台统一收款，每笔订单归属商户清晰
const cartUtil = require('../../../../utils/cart.js');
const subscribeMessage = require('../../../../utils/subscribeMessage.js');

Page({
  data: {
    statusBarHeight: (wx.getWindowInfo && wx.getWindowInfo().statusBarHeight) || 20,
    storeList: [],
    address: null,
    hasAddress: false,
    totalFeeFen: 0,
    totalFeeYuan: '0.00',
    totalFeeText: '¥0.00', // 合计展示文案，避免 WXML 表达式不生效
    submitting: false
  },

  onLoad() {
    if (!getApp().globalData.isLoggedIn) {
      wx.showToast({ title: '请先登录后再下单', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    const raw = wx.getStorageSync('unifiedCheckoutCart');
    const storeList = (raw && Array.isArray(raw)) ? raw : [];
    if (storeList.length === 0) {
      wx.showToast({ title: '购物车为空', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }
    this.setData({ storeList }, () => this.recalculateUnifiedTotal());
    this.loadUserAddress();
    subscribeMessage.preloadOrderStatusTemplateId();
  },

  extractFloorFromAddress(addressObj) {
    const houseNumber = String(addressObj?.houseNumber || '').trim();
    const firstDigitMatch = houseNumber.match(/^([1-6])\d{2}$/);
    if (firstDigitMatch) return Number(firstDigitMatch[1]);
    const text = `${addressObj?.buildingName || ''}${houseNumber}${addressObj?.addressDetail || ''}${addressObj?.address || ''}`;
    const floorMatch = text.match(/([1-6])\s*楼/);
    if (floorMatch) return Number(floorMatch[1]);
    return 0;
  },

  getDeliveryFeeByFloor(floor) {
    if (floor >= 1 && floor <= 3) return 1.5;
    if (floor >= 4 && floor <= 6) return 2.0;
    return 2.0;
  },

  recalculateUnifiedTotal() {
    const storeList = this.data.storeList || [];
    const hasAddress = this.data.hasAddress && this.data.address;
    if (!storeList.length || !hasAddress) {
      this.setData({ totalFeeFen: 0, totalFeeYuan: '0.00', totalFeeText: '¥0.00' });
      return;
    }
    const floor = this.extractFloorFromAddress(this.data.address);
    const perOrderFee = this.getDeliveryFeeByFloor(floor);
    const totalFeeFen = Math.round(perOrderFee * 100) * storeList.length;
    const totalFeeYuan = (totalFeeFen / 100).toFixed(2);
    this.setData({ totalFeeFen, totalFeeYuan, totalFeeText: '¥' + totalFeeYuan });
  },

  async loadUserAddress() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'addressManage',
        data: { action: 'getAddressList', data: {} }
      });
      if (res.result && res.result.code === 200 && res.result.data.list && res.result.data.list.length > 0) {
        const defaultAddr = res.result.data.list.find(a => a.isDefault) || res.result.data.list[0];
        const address = {
          name: defaultAddr.name,
          phone: defaultAddr.phone,
          address: defaultAddr.addressDetail || '',
          addressDetail: defaultAddr.addressDetail || '',
          buildingName: defaultAddr.buildingName || '',
          houseNumber: defaultAddr.houseNumber || ''
        };
        this.setData({ address, hasAddress: true }, () => this.recalculateUnifiedTotal());
      }
    } catch (e) {
      this.setData({ hasAddress: false }, () => this.recalculateUnifiedTotal());
    }
  },

  onShow() {
    if (this.data.storeList.length === 0) return;
    const from = this.data.fromAddressPage;
    if (from) this.setData({ fromAddressPage: false });
    this.loadUserAddress();
    subscribeMessage.preloadOrderStatusTemplateId();
  },

  onSelectAddress() {
    wx.navigateTo({
      url: '/subpackages/common/pages/address/index?from=unifiedCheckout'
    });
    this.setData({ fromAddressPage: true });
  },

  onSubmit() {
    if (this.data.submitting) return;
    if (!this.data.hasAddress || !this.data.address) {
      wx.showToast({ title: '请先选择收货地址', icon: 'none' });
      return;
    }
    const storeList = this.data.storeList;
    if (!storeList.length) {
      wx.showToast({ title: '购物车为空', icon: 'none' });
      return;
    }
    for (const s of storeList) {
      const minOrder = (s.storeInfo && s.storeInfo.minOrder) || 0;
      if ((s.cartTotal || 0) < minOrder) {
        wx.showToast({ title: `「${(s.storeInfo && s.storeInfo.name) || '店铺'}」未达起送 ¥${minOrder}`, icon: 'none' });
        return;
      }
      if ((s.storeInfo && s.storeInfo.businessStatus) && s.storeInfo.businessStatus !== 'open') {
        wx.showToast({ title: `「${(s.storeInfo && s.storeInfo.name) || '店铺'}」休息中`, icon: 'none' });
        return;
      }
    }

    const tmplIds = subscribeMessage.getCheckoutTemplateIds();
    if (tmplIds.length === 0) {
      wx.showToast({ title: '加载中，请 2 秒后再试', icon: 'none' });
      subscribeMessage.preloadOrderStatusTemplateId();
      return;
    }

    this.setData({ submitting: true });
    subscribeMessage.triggerSubscribeSync(tmplIds).then(() => this._doUnifiedSubmit(storeList)).catch(() => this._doUnifiedSubmit(storeList));
  },

  async _doUnifiedSubmit(storeList) {
    const address = this.data.address;
    const stores = storeList.map(s => ({
      storeId: s.storeId,
      storeInfo: s.storeInfo || {},
      cartItems: s.items || [],
      cartTotal: s.cartTotal || 0,
      deliveryType: (s.deliveryType || 'delivery')
    }));

    try {
      const createRes = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'createUnifiedOrders',
          data: {
            address,
            remark: '',
            needCutlery: true,
            cutleryQuantity: 1,
            stores
          }
        }
      });
      if (!createRes.result || createRes.result.code !== 200) {
        this.setData({ submitting: false });
        wx.showToast({ title: createRes.result?.message || '创建订单失败', icon: 'none' });
        return;
      }
      const { unifiedPaymentId, totalFeeFen } = createRes.result.data;

      wx.showLoading({ title: '正在调起支付...' });
      const payRes = await wx.cloud.callFunction({
        name: 'paymentManage',
        data: {
          action: 'unifiedPrepay',
          data: { unifiedPaymentId }
        }
      });
      wx.hideLoading();
      if (!payRes.result || payRes.result.code !== 200) {
        this.setData({ submitting: false });
        wx.showToast({ title: payRes.result?.message || '预下单失败', icon: 'none' });
        return;
      }
      const payParams = payRes.result.data;

      wx.requestPayment({
        ...payParams,
        success: async () => {
          try {
            await wx.cloud.callFunction({
              name: 'orderManage',
              data: {
                action: 'updateUnifiedPaymentPaid',
                data: { unifiedPaymentId }
              }
            });
          } catch (e) {}
          storeList.forEach(s => cartUtil.removeStoreFromCart(s.storeId));
          wx.removeStorageSync('unifiedCheckoutCart');
          wx.showToast({ title: '支付成功', icon: 'success' });
          setTimeout(() => {
            wx.redirectTo({ url: '/subpackages/order/pages/order/index?from=pay' });
          }, 1500);
        },
        fail: (err) => {
          this.setData({ submitting: false });
          wx.showToast({ title: '支付失败', icon: 'none' });
        }
      });
    } catch (err) {
      this.setData({ submitting: false });
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    }
  }
});
