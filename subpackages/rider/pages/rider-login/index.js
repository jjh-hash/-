let timer = null;
let loginTimeout = null;

Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    phone: '',
    code: '',
    countdown: 0
  },

  onHide() {
    this.clearTimer();
  },

  onUnload() {
    this.clearTimer();
    if (loginTimeout) {
      clearTimeout(loginTimeout);
      loginTimeout = null;
    }
  },

  onPhoneInput(e) {
    this.setData({ phone: e.detail.value });
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value });
  },

  onSendCode() {
    const { phone, countdown } = this.data;
    if (countdown > 0) return;

    if (!/^1\d{10}$/.test(phone.trim())) {
      wx.showToast({ title: '请输入正确手机号', icon: 'none' });
      return;
    }

    wx.showToast({ title: '验证码已发送', icon: 'success' });
    this.setData({ countdown: 60 });
    timer = setInterval(() => {
      const next = this.data.countdown - 1;
      if (next <= 0) {
        this.clearTimer();
        this.setData({ countdown: 0 });
      } else {
        this.setData({ countdown: next });
      }
    }, 1000);
  },

  onLogin() {
    wx.showToast({
      title: '即将进入骑手端',
      icon: 'success',
      duration: 800
    });
    if (loginTimeout) clearTimeout(loginTimeout);
    loginTimeout = setTimeout(() => {
      loginTimeout = null;
      wx.reLaunch({
        url: '/subpackages/rider/pages/rider-home/index'
      });
    }, 800);
  },

  onBackTap() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({
        url: '/subpackages/rider/pages/rider/index'
      });
    }
  },

  clearTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }
});


