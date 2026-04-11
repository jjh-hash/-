// 商家提现页
const app = getApp();

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return y + '-' + m + '-' + day + ' ' + h + ':' + min;
}

const { normalizeMoneyInput } = require('../../../../utils/moneyInput');

Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    availableBalance: '0.00',
    minWithdrawYuan: '1.00',
    amountInput: '',
    remark: '',
    submitting: false,
    list: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loadingList: false
  },

  onLoad() {
    this.loadAvailableBalance();
    this.loadList();
  },

  onBack() {
    wx.navigateBack();
  },

  onAmountInput(e) {
    this.setData({ amountInput: normalizeMoneyInput(e.detail.value) });
  },

  onRemarkInput(e) {
    this.setData({ remark: e.detail.value });
  },

  async loadAvailableBalance() {
    const merchantInfo = wx.getStorageSync('merchantInfo') || {};
    const merchantId = merchantInfo._id || null;
    try {
      const res = await wx.cloud.callFunction({
        name: 'withdrawManage',
        data: {
          action: 'getAvailableBalance',
          data: { merchantId }
        }
      });
      if (res.result && res.result.code === 200) {
        const d = res.result.data;
        this.setData({
          availableBalance: d.availableBalanceYuan || '0.00',
          minWithdrawYuan: d.minWithdrawYuan || '1.00'
        });
      }
    } catch (err) {
      console.error('获取可提现余额失败:', err);
    }
  },

  async onSubmit() {
    const { amountInput, availableBalance, minWithdrawYuan, submitting } = this.data;
    if (submitting) return;
    const amount = parseFloat(amountInput);
    if (isNaN(amount) || amount <= 0) {
      wx.showToast({ title: '请输入有效金额', icon: 'none' });
      return;
    }
    if (amount < parseFloat(minWithdrawYuan)) {
      wx.showToast({ title: '提现金额不能低于 ' + minWithdrawYuan + ' 元', icon: 'none' });
      return;
    }
    if (amount > parseFloat(availableBalance)) {
      wx.showToast({ title: '可提现余额不足', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    const merchantInfo = wx.getStorageSync('merchantInfo') || {};
    const merchantId = merchantInfo._id || null;
    try {
      const res = await wx.cloud.callFunction({
        name: 'withdrawManage',
        data: {
          action: 'submitWithdrawal',
          data: {
            merchantId,
            amountYuan: amount,
            remark: this.data.remark
          }
        }
      });
      if (res.result && res.result.code === 200) {
        wx.showToast({ title: res.result.message || '提现成功', icon: 'success' });
        this.setData({ amountInput: '', remark: '', page: 1, list: [], hasMore: true });
        this.loadAvailableBalance();
        this.loadList();
      } else {
        wx.showToast({ title: res.result.message || '提交失败', icon: 'none' });
      }
    } catch (err) {
      console.error('提交提现失败:', err);
      wx.showToast({ title: '网络异常，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async loadList(append) {
    if (this.data.loadingList) return;
    if (!append && this.data.list.length > 0 && !this.data.hasMore) return;
    const page = append ? this.data.page : 1;
    if (!append) this.setData({ loadingList: true, page: 1 });

    const merchantInfo = wx.getStorageSync('merchantInfo') || {};
    const merchantId = merchantInfo._id || null;
    try {
      const res = await wx.cloud.callFunction({
        name: 'withdrawManage',
        data: {
          action: 'getWithdrawalList',
          data: {
            merchantId,
            page,
            pageSize: this.data.pageSize
          }
        }
      });
      if (res.result && res.result.code === 200) {
        const { list, hasMore } = res.result.data;
        const newList = (list || []).map(item => ({
          ...item,
          createdAtStr: formatDate(item.createdAt)
        }));
        const setData = {
          hasMore,
          loadingList: false,
          page: page + 1
        };
        if (append) {
          setData.list = this.data.list.concat(newList);
        } else {
          setData.list = newList;
        }
        this.setData(setData);
      } else {
        this.setData({ loadingList: false });
      }
    } catch (err) {
      console.error('加载提现记录失败:', err);
      this.setData({ loadingList: false });
    }
  },

  loadMore() {
    this.loadList(true);
  }
});
