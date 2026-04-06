// 校园兼职中心：申请、缴纳保证金、状态、申请退还
Page({
  data: {
    status: 'loading',
    depositAmountYuan: '100',
    canRefund: false,
    refundableAfter: '',
    depositPaidAt: ''
  },

  onLoad() {
    this.loadStatus();
  },

  onShow() {
    this.loadStatus();
  },

  async loadStatus() {
    this.setData({ status: 'loading' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'campusPartnerManage',
        data: { action: 'getStatus' }
      });
      const result = res.result || {};
      if (result.code !== 200) {
        this.setData({ status: 'none' });
        return;
      }
      const d = result.data || {};
      this.setData({
        status: d.status || 'none',
        depositAmountYuan: d.depositAmountYuan || '100',
        canRefund: !!d.canRefund,
        refundableAfter: d.refundableAfter ? this.formatRefundable(d.refundableAfter) : '',
        depositPaidAt: d.depositPaidAt ? this.formatDate(d.depositPaidAt) : ''
      });
    } catch (e) {
      console.error('校园兼职 getStatus 失败', e);
      this.setData({ status: 'none' });
    }
  },

  formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  formatRefundable(iso) {
    const d = new Date(iso);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  },

  async onApply() {
    wx.showLoading({ title: '提交中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'campusPartnerManage',
        data: { action: 'apply' }
      });
      wx.hideLoading();
      const result = res.result || {};
      if (result.code === 200) {
        wx.showToast({ title: '申请成功，请缴纳保证金', icon: 'success' });
        this.loadStatus();
      } else {
        wx.showToast({ title: result.message || '申请失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '网络异常', icon: 'none' });
    }
  },

  async onConfirmDeposit() {
    wx.showModal({
      title: '确认缴纳保证金',
      content: `将缴纳保证金 ¥${this.data.depositAmountYuan}，满 30 天后可申请退还。确认去支付？`,
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '获取支付参数...' });
        try {
          const createRes = await wx.cloud.callFunction({
            name: 'campusPartnerManage',
            data: { action: 'createDepositPayment' }
          });
          const createResult = createRes.result || {};
          if (createResult.code !== 200 || !createResult.data || !createResult.data.payment) {
            wx.hideLoading();
            wx.showToast({ title: createResult.message || '获取支付参数失败', icon: 'none' });
            return;
          }
          const { depositOrderId, payment } = createResult.data;
          wx.hideLoading();
          await new Promise((resolve, reject) => {
            wx.requestPayment({
              ...payment,
              success: resolve,
              fail: reject
            });
          });
          wx.showLoading({ title: '确认开通中...' });
          const confirmRes = await wx.cloud.callFunction({
            name: 'campusPartnerManage',
            data: { action: 'confirmDeposit', data: { depositOrderId } }
          });
          wx.hideLoading();
          const confirmResult = confirmRes.result || {};
          if (confirmResult.code === 200) {
            wx.showToast({ title: confirmResult.message || '开通成功', icon: 'success' });
            this.loadStatus();
          } else {
            wx.showToast({ title: confirmResult.message || '确认失败', icon: 'none' });
          }
        } catch (e) {
          wx.hideLoading();
          if (e.errMsg && e.errMsg.indexOf('requestPayment:fail cancel') !== -1) {
            wx.showToast({ title: '已取消支付', icon: 'none' });
          } else {
            wx.showToast({ title: e.message || e.errMsg || '网络异常', icon: 'none' });
          }
        }
      }
    });
  },

  async onRequestRefund() {
    wx.showModal({
      title: '申请退还保证金',
      content: '退还后将解除校园兼职身份，无法再接单。确定申请？',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '提交中...' });
        try {
          const call = await wx.cloud.callFunction({
            name: 'campusPartnerManage',
            data: { action: 'requestRefund' }
          });
          wx.hideLoading();
          const result = call.result || {};
          console.log('申请退还保证金 云函数返回:', result);
          const msg = (result.data && result.data.message) || result.message;
          const showMsg = (msg && msg !== 'ok') ? msg : (result.code === 200 ? '已提交，请查看页面状态' : '操作失败');
          if (result.code === 200) {
            wx.showToast({ title: showMsg, icon: 'success' });
            this.loadStatus();
          } else {
            wx.showToast({ title: showMsg, icon: 'none' });
          }
        } catch (e) {
          wx.hideLoading();
          wx.showToast({ title: '网络异常', icon: 'none' });
        }
      }
    });
  },

  goTaskHall() {
    wx.navigateTo({ url: '/subpackages/order/pages/receive-order/index' });
  },

  goRiderHome() {
    wx.navigateTo({ url: '/subpackages/rider/pages/rider-home/index' });
  }
});
