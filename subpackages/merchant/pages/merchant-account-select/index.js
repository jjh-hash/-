const STORAGE_KEY = 'merchantWxLoginPick';

Page({
  data: {
    merchants: [],
    count: 0,
    selectedId: ''
  },

  onLoad() {
    const raw = wx.getStorageSync(STORAGE_KEY);
    wx.removeStorageSync(STORAGE_KEY);

    if (!raw || !raw.merchants || !raw.merchants.length) {
      wx.showToast({ title: '暂无账号数据', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    const merchants = raw.merchants;
    const last = merchants.find((m) => m.isLastLogin);
    const selectedId = (last && last._id) || merchants[0]._id;

    this.setData({
      merchants,
      count: merchants.length,
      selectedId
    });
  },

  onSelect(e) {
    const id = e.currentTarget.dataset.id;
    if (id) {
      this.setData({ selectedId: id });
    }
  },

  onSwitchLogin() {
    wx.navigateBack();
  },

  async onContinue() {
    const { selectedId } = this.data;
    if (!selectedId) return;

    wx.showLoading({ title: '登录中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'merchantLogin',
        data: {
          loginType: 'wx',
          merchantId: selectedId
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.removeStorageSync('isMerchant');
        wx.removeStorageSync('merchantInfo');
        wx.removeStorageSync('userInfo');

        wx.setStorageSync('isMerchant', true);
        wx.setStorageSync('merchantInfo', res.result.data.merchant);
        if (res.result.data.user) {
          wx.setStorageSync('userInfo', res.result.data.user);
        }

        wx.showToast({ title: '登录成功', icon: 'success', duration: 1500 });

        setTimeout(() => {
          wx.reLaunch({
            url: '/subpackages/merchant/pages/merchant-workbench/index'
          });
        }, 1500);
      } else {
        wx.showToast({
          title: (res.result && res.result.message) || '登录失败',
          icon: 'none'
        });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  }
});
