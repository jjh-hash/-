Page({
  data:{
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    storeOpen: true,
    // 账户余额相关
    accountBalance: '0.00',
    latestRevenue: '0.00',
    totalRevenue: '0.00',
    manageItems: [
      { icon: '📄', text: '店铺信息' },
      { icon: '📢', text: '店铺公告' },
      { icon: '🖼️', text: '店铺照片' },
      { icon: '🔖', text: '商品分类' },
      { icon: '🛒', text: '商品管理' },
      { icon: '⭐', text: '评价管理' },
      { icon: '📈', text: '销售统计' }
    ]
  },
  onStoreSwitch(e){
    const newStatus = e.detail.value;
    const statusText = newStatus ? '营业中' : '休息中';
    
    // 先更新UI状态
    this.setData({ storeOpen: newStatus });
    
    // 保存设置
    this.saveStoreSettings(newStatus, statusText);
  },

  onLoad(){
    this.loadStoreSettings();
    this.loadAccountBalance();
  },
  
  onShow(){
    this.loadStoreSettings();
    this.loadAccountBalance();
  },

  // 加载账户余额
  async loadAccountBalance() {
    try {
      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      
      console.log('【工作台】当前商家信息:', { merchantId });
      
      const res = await wx.cloud.callFunction({
        name: 'statistics',
        data: {
          action: 'getAccountBalance',
          data: {
            merchantId: merchantId // 传递商家ID，优先使用
          }
        }
      });
      
      if (res.result && res.result.code === 200) {
        const { accountBalance, latestRevenue, totalRevenue } = res.result.data;
        
        this.setData({
          accountBalance: this.formatMoney(accountBalance),
          latestRevenue: this.formatMoney(latestRevenue),
          totalRevenue: this.formatMoney(totalRevenue)
        });
        
        console.log('【工作台】账户余额加载成功:', {
          accountBalance,
          latestRevenue,
          totalRevenue
        });
      } else {
        console.error('【工作台】加载账户余额失败:', res.result);
      }
    } catch (err) {
      console.error('【工作台】加载账户余额异常:', err);
    }
  },
  
  // 格式化金额
  formatMoney(value) {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.00';
    }
    return Number(value).toFixed(2);
  },

  // 加载店铺设置
  async loadStoreSettings() {
    try {
      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      
      console.log('【工作台】加载店铺设置，商家ID:', merchantId);
      
      const res = await wx.cloud.callFunction({
        name: 'storeManage',
        data: {
          action: 'getStoreInfo',
          data: {
            merchantId: merchantId // 传递商家ID，优先使用
          }
        }
      });
      
      if (res.result && res.result.code === 200) {
        const storeInfo = res.result.data.storeInfo;
        this.setData({
          storeOpen: storeInfo.businessStatus === 'open'
        });
      }
    } catch (err) {
      console.error('加载店铺设置失败:', err);
    }
  },

  // 保存店铺设置（仅店铺状态）
  async saveStoreSettings(newStoreOpen, statusText) {
    const storeOpen = newStoreOpen !== undefined ? newStoreOpen : this.data.storeOpen;
    
    try {
      wx.showLoading({ title: '保存中...' });
      
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      
      const res = await wx.cloud.callFunction({
        name: 'storeManage',
        data: {
          action: 'updateBusinessStatus',
          data: {
            businessStatus: storeOpen ? 'open' : 'rest',
            merchantId: merchantId
          }
        }
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.code === 200) {
        const finalStatusText = statusText || (storeOpen ? '营业中' : '休息中');
        wx.showToast({
          title: `已切换为${finalStatusText}`,
          icon: 'success',
          duration: 1500
        });
        if (!storeOpen) {
          setTimeout(() => {
            wx.showToast({
              title: '休息中的店铺不会在首页显示',
              icon: 'none',
              duration: 2000
            });
          }, 1600);
        }
      } else {
        this.setData({ storeOpen: !storeOpen });
        wx.showToast({
          title: res.result?.message || '保存失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('保存店铺设置失败:', err);
      this.setData({ storeOpen: !storeOpen });
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },
  // 点击网格第一个入口：店铺信息
  handleGridTap(e){
    const text = e.currentTarget.dataset.text;
    if(text==='店铺信息'){
      wx.navigateTo({ url: '/subpackages/merchant/pages/merchant-store-info/index' });
    } else if(text==='商品管理'){
      wx.navigateTo({ url: '/subpackages/merchant/pages/merchant-goods/index' });
    } else if(text==='商品分类'){
      wx.navigateTo({ url: '/subpackages/merchant/pages/merchant-category/index' });
    } else if(text==='评价管理'){
      wx.navigateTo({ url: '/subpackages/merchant/pages/merchant-reviews/index' });
    } else if(text==='销售统计'){
      wx.navigateTo({ url: '/subpackages/merchant/pages/merchant-sales-stats/index' });
    } else if(text==='店铺公告'){
      wx.navigateTo({ url: '/subpackages/merchant/pages/merchant-store-announcement/index' });
    } else if(text==='店铺照片'){
      wx.navigateTo({ url: '/subpackages/merchant/pages/merchant-store-photos/index' });
    }
  },
  onNav(e){
    const tab = e.currentTarget.dataset.tab;
    if(tab==='orders'){
      wx.reLaunch({ url: '/subpackages/merchant/pages/merchant-orders/index' });
    } else if(tab==='mine') {
      wx.reLaunch({ url: '/subpackages/merchant/pages/merchant-mine/index' });
    }
  },
  
  // 提现
  onWithdraw() {
    wx.navigateTo({
      url: '/subpackages/merchant/pages/merchant-withdraw/index'
    });
  }
});


