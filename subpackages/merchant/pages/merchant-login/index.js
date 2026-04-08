Page({
  data:{ 
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    account: '',
    password: ''
  },

  onLoad() {
    // 页面加载时检查是否已登录为商家
    this.checkMerchantLogin();
  },

  // 检查商家登录状态
  checkMerchantLogin() {
    const isMerchant = wx.getStorageSync('isMerchant');
    if (isMerchant) {
      console.log('已标记为商家，可以直接跳转');
    }
  },

  // 账户输入
  onAccountInput(e) {
    this.setData({
      account: e.detail.value
    });
  },

  // 密码输入
  onPasswordInput(e) {
    this.setData({
      password: e.detail.value
    });
  },

  // 账户密码登录
  async onAccountLogin() {
    const { account, password } = this.data;

    // 验证输入
    if (!account || !account.trim()) {
      wx.showToast({
        title: '请输入账号',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (!password || !password.trim()) {
      wx.showToast({
        title: '请输入密码',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    wx.showLoading({ title: '登录中...' });
    
    try {
      // 调用商家登录云函数（账户密码登录）
      const res = await wx.cloud.callFunction({
        name: 'merchantLogin',
        data: {
          loginType: 'account',
          account: account.trim(),
          password: password.trim()
        }
      });
      
      wx.hideLoading();
      
      console.log('商家账户登录结果:', res.result);
      
      if (res.result && res.result.code === 200) {
        // 清除旧的缓存数据，防止数据混乱
        wx.removeStorageSync('isMerchant');
        wx.removeStorageSync('merchantInfo');
        wx.removeStorageSync('userInfo');
        
        // 保存新的商家信息
        wx.setStorageSync('isMerchant', true);
        wx.setStorageSync('merchantInfo', res.result.data.merchant);
        if (res.result.data.user) {
          wx.setStorageSync('userInfo', res.result.data.user);
        }
        
        console.log('【商家登录】保存商家信息:', res.result.data.merchant);
        
        wx.showToast({ 
          title: '登录成功', 
          icon: 'success',
          duration: 1500
        });
        
        // 跳转到商家工作台（商家更常先看店铺状态与收益）
        setTimeout(() => {
          wx.reLaunch({ 
            url: '/subpackages/merchant/pages/merchant-workbench/index' 
          });
        }, 1500);
      } else {
        wx.showToast({
          title: res.result.message || '登录失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('商家账户登录失败:', err);
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 一键登录
  async onWxLogin(){
    wx.showLoading({ title: '登录中...' });
    
    try {
      // 调用商家登录云函数
      const res = await wx.cloud.callFunction({
        name: 'merchantLogin',
        data: {
          loginType: 'wx'
        }
      });
      
      wx.hideLoading();
      
      console.log('商家登录结果:', res.result);
      
      if (res.result && res.result.code === 200) {
        // 清除旧的缓存数据，防止数据混乱
        wx.removeStorageSync('isMerchant');
        wx.removeStorageSync('merchantInfo');
        wx.removeStorageSync('userInfo');
        
        // 保存新的商家信息
        wx.setStorageSync('isMerchant', true);
        wx.setStorageSync('merchantInfo', res.result.data.merchant);
        wx.setStorageSync('userInfo', res.result.data.user);
        
        console.log('【商家登录】保存商家信息:', res.result.data.merchant);
        
        wx.showToast({ 
          title: '登录成功', 
          icon: 'success',
          duration: 1500
        });
        
        // 跳转到商家工作台（商家更常先看店铺状态与收益）
        setTimeout(() => {
          wx.reLaunch({ 
            url: '/subpackages/merchant/pages/merchant-workbench/index' 
          });
        }, 1500);
      } else if (res.result && res.result.code === 201 && res.result.data && res.result.data.merchants) {
        wx.setStorageSync('merchantWxLoginPick', {
          merchants: res.result.data.merchants,
          user: res.result.data.user
        });
        wx.navigateTo({
          url: '/subpackages/merchant/pages/merchant-account-select/index'
        });
      } else if (res.result && res.result.code === 403) {
        // 未注册商家
        wx.showModal({
          title: '未注册商家',
          content: '您还不是商家，请先注册\n\n是否前往注册页面？',
          confirmText: '去注册',
          cancelText: '取消',
          success: (modalRes) => {
            if (modalRes.confirm) {
              wx.navigateTo({
                url: '/subpackages/merchant/pages/merchant-register/index'
              });
            }
          }
        });
      } else {
        wx.showToast({
          title: res.result.message || '登录失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('商家登录失败:', err);
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  onBackTap(){
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/subpackages/merchant/pages/merchant/index' });
    }
  }
});


