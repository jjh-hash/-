// 主包购物车 Tab 页：读取全局购物车，按店展示，支持改数量、删除、去结算、去店铺
const cartUtil = require('../../utils/cart.js');
const campusTradeGuard = require('../../utils/campusTradeGuard');

const TAB_BAR_HEIGHT = 50; // 底部 tabBar 高度（px）

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const context = this;
    const later = () => {
      clearTimeout(timeout);
      func.apply(context, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

Page({
  data: {
    statusBarHeight: (wx.getWindowInfo && wx.getWindowInfo().statusBarHeight) || 20,
    scrollHeight: 400, // 真机兼容：scroll-view 需明确高度，onLoad 中会更新
    storeList: [], // [ { storeId, storeInfo, items, cartTotal, deliveryType } ]
    isEmpty: true,
    totalAmount: 0, // 多店合计（元），用于统一付款展示
    totalAmountText: '0.00' // 合计展示文案（WXML 不能调 .toFixed）
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    const statusBar = (wx.getWindowInfo && wx.getWindowInfo().statusBarHeight) || sys.statusBarHeight || 20;
    const winH = sys.windowHeight || 500;
    const scrollH = Math.max(200, winH - statusBar - TAB_BAR_HEIGHT);
    this.setData({ scrollHeight: scrollH });
  },

  onShow() {
    this.loadCart();
  },

  /** 从本地全局购物车读取并按店组装列表 */
  loadCart: debounce(function() {
    try {
      const cart = cartUtil.getGlobalCart();
      const storeList = [];
      let totalAmount = 0;
      
      // 遍历购物车数据，按店铺分组
      Object.keys(cart).forEach(storeId => {
        const bucket = cart[storeId];
        if (bucket && bucket.items && bucket.items.length > 0) {
          // 复用已计算的cartTotal，避免重复计算
          const cartTotal = bucket.cartTotal != null ? bucket.cartTotal : cartUtil.computeCartTotal(bucket.items);
          const deliveryFee = (bucket.storeInfo && bucket.storeInfo.deliveryFee) != null ? bucket.storeInfo.deliveryFee : 2;
          
          // 构建店铺数据
          const storeData = {
            storeId: bucket.storeId || storeId,
            storeInfo: bucket.storeInfo || {},
            items: bucket.items,
            cartTotal,
            deliveryType: bucket.deliveryType || 'delivery'
          };
          
          storeList.push(storeData);
          // 计算总金额
          totalAmount += (cartTotal || 0) + Number(deliveryFee);
        }
      });
      
      const totalAmountText = (typeof totalAmount === 'number' && !isNaN(totalAmount)) ? totalAmount.toFixed(2) : '0.00';
      
      // 批量更新数据，减少setData调用
      this.setData({
        storeList,
        isEmpty: storeList.length === 0,
        totalAmount,
        totalAmountText
      });
    } catch (error) {
      console.error('加载购物车失败:', error);
      // 出错时重置购物车数据
      this.setData({
        storeList: [],
        isEmpty: true,
        totalAmount: 0,
        totalAmountText: '0.00'
      });
    }
  }, 100),

  /** 统一付款：跳转统一结算页 */
  onUnifiedPay() {
    if (this.data.isEmpty) return;
    if (!getApp().ensureLogin('请先登录后再下单')) return;
    const tradeGate = campusTradeGuard.canTransactInCurrentBrowseCampus();
    if (!tradeGate.ok) {
      campusTradeGuard.showTransactBlockedToast(tradeGate);
      return;
    }
    wx.setStorageSync('unifiedCheckoutCart', this.data.storeList);
    wx.navigateTo({
      url: '/subpackages/store/pages/unified-checkout/index'
    });
  },

  /** 某店某商品 +1 */
  onIncrease(e) {
    const { storeIndex, itemIndex } = e.currentTarget.dataset;
    const storeList = this.data.storeList;
    const store = storeList[storeIndex];
    if (!store) return;
    const items = store.items.map((it, i) => {
      if (i !== itemIndex) return it;
      return { ...it, quantity: (it.quantity || 0) + 1 };
    });
    const cartTotal = cartUtil.computeCartTotal(items);
    cartUtil.setStoreCart(store.storeId, {
      storeInfo: store.storeInfo,
      deliveryType: store.deliveryType,
      items,
      cartTotal
    });
    this.loadCart();
  },

  /** 某店某商品 -1，若为 0 则移除该项 */
  onDecrease(e) {
    const { storeIndex, itemIndex } = e.currentTarget.dataset;
    const storeList = this.data.storeList;
    const store = storeList[storeIndex];
    if (!store) return;
    const items = store.items.map((it, i) => {
      if (i !== itemIndex) return it;
      const qty = Math.max(0, (it.quantity || 0) - 1);
      return { ...it, quantity: qty };
    }).filter(it => (it.quantity || 0) > 0);
    if (items.length === 0) {
      cartUtil.removeStoreFromCart(store.storeId);
    } else {
      const cartTotal = cartUtil.computeCartTotal(items);
      cartUtil.setStoreCart(store.storeId, {
        storeInfo: store.storeInfo,
        deliveryType: store.deliveryType,
        items,
        cartTotal
      });
    }
    this.loadCart();
  },

  /** 删除某店某商品（单条） */
  onDeleteItem(e) {
    const { storeIndex, itemIndex } = e.currentTarget.dataset;
    const storeList = this.data.storeList;
    const store = storeList[storeIndex];
    if (!store) return;
    const items = store.items.filter((_, i) => i !== itemIndex);
    if (items.length === 0) {
      cartUtil.removeStoreFromCart(store.storeId);
    } else {
      const cartTotal = cartUtil.computeCartTotal(items);
      cartUtil.setStoreCart(store.storeId, {
        storeInfo: store.storeInfo,
        deliveryType: store.deliveryType,
        items,
        cartTotal
      });
    }
    this.loadCart();
    wx.showToast({ title: '已移除', icon: 'none' });
  },

  /** 去结算（某店） */
  onCheckout(e) {
    const storeIndex = e.currentTarget.dataset.storeIndex;
    const storeList = this.data.storeList;
    const store = storeList[storeIndex];
    if (!store) return;

    const minOrder = (store.storeInfo && store.storeInfo.minOrder) || 0;
    if (store.cartTotal < minOrder) {
      wx.showToast({
        title: minOrder ? `满¥${minOrder}起送` : '未达起送价',
        icon: 'none'
      });
      return;
    }

    const businessStatus = store.storeInfo && store.storeInfo.businessStatus;
    if (businessStatus && businessStatus !== 'open') {
      wx.showToast({
        title: '店铺当前休息中，暂不可结算',
        icon: 'none'
      });
      return;
    }

    const storeId = store.storeId || (store.storeInfo && (store.storeInfo._id || store.storeInfo.storeId));
    if (!getApp().ensureLogin('请先登录后再下单')) return;
    const tradeGate = campusTradeGuard.canTransactInCurrentBrowseCampus();
    if (!tradeGate.ok) {
      campusTradeGuard.showTransactBlockedToast(tradeGate);
      return;
    }

    const cartData = {
      cartItems: store.items,
      cartTotal: store.cartTotal,
      deliveryType: store.deliveryType,
      storeInfo: {
        ...store.storeInfo,
        storeId: storeId,
        _id: storeId
      }
    };

    wx.navigateTo({
      url: `/subpackages/store/pages/checkout/index?cartData=${encodeURIComponent(JSON.stringify(cartData))}`
    });
  },

  /** 去店铺 */
  onGoStore(e) {
    const storeId = e.currentTarget.dataset.storeId;
    if (!storeId) return;
    wx.navigateTo({
      url: `/subpackages/store/pages/store-detail/index?storeId=${storeId}`
    });
  }
});
