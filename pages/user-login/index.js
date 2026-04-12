const { runLoginAndCampus } = require('../../utils/studentLoginFlow');
const { navigateAfterStudentLogin } = require('../../utils/afterStudentLoginNavigate');

Page({
  data: {
    statusBarHeight: 20,
    logging: false
  },

  /** 为 true 时 onUnload 不置位「从登录页离开」，避免「暂不登录」后下次点「我的」被误判 */
  _leaveWithoutProfileGate: false,

  onLoad() {
    const win = wx.getWindowInfo ? wx.getWindowInfo() : null;
    const sys = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
    this.setData({
      statusBarHeight: (win && win.statusBarHeight) || sys.statusBarHeight || 20
    });
    if (this._isLoggedInSync()) {
      wx.switchTab({ url: '/pages/profile/index' });
    }
  },

  onUnload() {
    if (this._leaveWithoutProfileGate) return;
    const app = getApp();
    if (!this._isLoggedInSync()) {
      app.globalData._fromUserLoginPageBack = true;
    }
  },

  _isLoggedInSync() {
    try {
      const t = wx.getStorageSync('userToken');
      if (!t) return false;
      const u = wx.getStorageSync('userInfo');
      return !!(u && u.openid);
    } catch (e) {
      return false;
    }
  },

  async onTapWeixinLogin() {
    if (this.data.logging) return;
    this.setData({ logging: true });
    const app = getApp();
    const result = await runLoginAndCampus(app);
    this.setData({ logging: false });
    if (result.ok && result.userInfo) {
      this._leaveWithoutProfileGate = true;
      navigateAfterStudentLogin(result);
      return;
    }
    if (result.code === 'needCampus' && result.userInfo) {
      wx.showToast({ title: '请选择所属校区后再进入首页', icon: 'none' });
      this._leaveWithoutProfileGate = true;
      wx.switchTab({ url: '/pages/profile/index' });
      return;
    }
    if (result.message) {
      wx.showToast({ title: result.message, icon: 'none' });
    }
  },

  onTapLater() {
    this._leaveWithoutProfileGate = true;
    wx.switchTab({ url: '/pages/home/index' });
  }
});
