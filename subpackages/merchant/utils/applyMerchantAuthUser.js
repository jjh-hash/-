/**
 * 商家登录/注册后写回本地 userInfo。
 * 云函数 `merchantLogin` 曾只返回裁剪字段，缺少 openid，会导致「我的」页按 openid 判登录时误判未登录、反复要求微信登录。
 */
function applyMerchantAuthUserToStorage(user, merchant) {
  if (!user || typeof user !== 'object') return;
  const app = getApp();
  const u = Object.assign({}, user);
  if (!u.openid && merchant && merchant.openid) {
    u.openid = merchant.openid;
  }
  wx.setStorageSync('userInfo', u);
  app.globalData.userInfo = u;
  if (wx.getStorageSync('userToken')) {
    app.globalData.isLoggedIn = true;
  }
}

module.exports = {
  applyMerchantAuthUserToStorage
};
