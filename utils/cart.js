/**
 * 全局购物车工具：本地存储 globalCart，按店铺分桶
 * 与《购物车交互逻辑设计》数据模型一致
 */
const CART_KEY = 'globalCart';

/**
 * 读取全局购物车
 * @returns {Object} { storeId: { storeId, storeInfo, deliveryType, items, cartTotal, updatedAt } }
 */
function getGlobalCart() {
  try {
    const raw = wx.getStorageSync(CART_KEY);
    return raw && typeof raw === 'object' ? raw : {};
  } catch (e) {
    return {};
  }
}

/**
 * 写入全局购物车（整表覆盖，慎用）
 * @param {Object} cart
 */
function setGlobalCart(cart) {
  try {
    wx.setStorageSync(CART_KEY, cart || {});
  } catch (e) {
    console.error('setGlobalCart error', e);
  }
}

/**
 * 获取某店购物车桶
 * @param {string} storeId
 * @returns {Object|null} { storeId, storeInfo, deliveryType, items, cartTotal, updatedAt }
 */
function getStoreCart(storeId) {
  if (!storeId) return null;
  const cart = getGlobalCart();
  return cart[storeId] || null;
}

/**
 * 计算 items 小计（与 store-detail calculateCartTotal 一致）
 * @param {Array} items
 * @returns {number}
 */
function computeCartTotal(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, item) => {
    const price = parseFloat(item.finalPrice || item.price) || 0;
    const qty = parseInt(item.quantity, 10) || 0;
    return sum + price * qty;
  }, 0);
}

/**
 * 更新某店购物车桶并写回存储
 * @param {string} storeId
 * @param {Object} payload { storeInfo, deliveryType, items } 至少包含 items；storeInfo/deliveryType 可选
 */
function setStoreCart(storeId, payload) {
  if (!storeId) return;
  const cart = getGlobalCart();
  const existing = cart[storeId] || {};
  const items = payload.items != null ? payload.items : (existing.items || []);
  const cartTotal = payload.cartTotal != null ? payload.cartTotal : computeCartTotal(items);
  cart[storeId] = {
    storeId,
    storeInfo: payload.storeInfo != null ? payload.storeInfo : (existing.storeInfo || {}),
    deliveryType: payload.deliveryType != null ? payload.deliveryType : (existing.deliveryType || 'delivery'),
    items,
    cartTotal,
    updatedAt: Date.now()
  };
  if (items.length === 0) {
    delete cart[storeId];
  }
  setGlobalCart(cart);
  updateTabBarBadge();
}

/**
 * 从全局购物车移除某店
 * @param {string} storeId
 */
function removeStoreFromCart(storeId) {
  if (!storeId) return;
  const cart = getGlobalCart();
  delete cart[storeId];
  setGlobalCart(cart);
  updateTabBarBadge();
}

/**
 * 全局购物车商品总件数（各店 items 的 quantity 之和）
 * @returns {number}
 */
function getCartTotalCount() {
  const cart = getGlobalCart();
  let count = 0;
  Object.keys(cart).forEach(key => {
    const bucket = cart[key];
    if (bucket && Array.isArray(bucket.items)) {
      bucket.items.forEach(item => {
        count += parseInt(item.quantity, 10) || 0;
      });
    }
  });
  return count;
}

/**
 * 更新 TabBar 购物车角标（index 2 为购物车）
 */
function updateTabBarBadge() {
  try {
    const count = getCartTotalCount();
    if (count > 0) {
      wx.setTabBarBadge({
        index: 2,
        text: count > 99 ? '99+' : String(count)
      });
    } else {
      wx.removeTabBarBadge({ index: 2 });
    }
  } catch (e) {
    // 忽略
  }
}

module.exports = {
  getGlobalCart,
  setGlobalCart,
  getStoreCart,
  setStoreCart,
  removeStoreFromCart,
  computeCartTotal,
  getCartTotalCount,
  updateTabBarBadge
};
