const { normalizeHomeCampus, STORAGE_KEY, CAMPUS_BAISHA } = require('../../../../utils/homeCampusStorage');

Page({
  data:{
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    registerCampus: CAMPUS_BAISHA,
    shopName: '',
    inviteCode: '',
    account: '',
    password: '',
    confirmPassword: ''
  },

  onLoad(options) {
    this.applyRegisterCampusFromOptions(options);
  },

  onShow() {
    if (this._campusLockedFromUrl) return;
    this.applyRegisterCampusFromOptions({});
  },

  applyRegisterCampusFromOptions(options) {
    let c = '';
    if (options && options.campus) {
      try {
        c = decodeURIComponent(options.campus);
      } catch (e) {
        c = options.campus;
      }
    }
    const fromUrl = normalizeHomeCampus(c);
    const fromStorage = normalizeHomeCampus(wx.getStorageSync(STORAGE_KEY));
    const campus = fromUrl || fromStorage || CAMPUS_BAISHA;
    if (fromUrl) {
      this._campusLockedFromUrl = true;
    }
    this._registerCampus = campus;
    this.setData({ registerCampus: campus });
  },
  
  onNameInput(e){ 
    this.setData({ shopName: e.detail.value }); 
  },
  
  onCodeInput(e){ 
    this.setData({ inviteCode: e.detail.value }); 
  },
  
  onAccountInput(e){ 
    this.setData({ account: e.detail.value }); 
  },
  
  onPasswordInput(e){ 
    this.setData({ password: e.detail.value }); 
  },
  
  onConfirmPasswordInput(e){ 
    this.setData({ confirmPassword: e.detail.value }); 
  },
  
  async onSubmit(){
    console.log('提交按钮被点击');
    console.log('店铺名称:', this.data.shopName);
    console.log('邀请码:', this.data.inviteCode);
    console.log('登录账号:', this.data.account);
    console.log('登录密码:', this.data.password);
    
    const inputShopName = this.data.shopName.trim();
    const inputInviteCode = this.data.inviteCode.trim();
    const inputAccount = this.data.account.trim();
    const inputPassword = this.data.password.trim();
    
    // 1. 如果店铺和邀请码都为空，但账号和密码都有值，尝试管理员登录
    if (!inputShopName && !inputInviteCode && inputAccount && inputPassword) {
      await this.tryAdminLogin(inputAccount, inputPassword);
      return;
    }
    
    // 2. 如果有店铺名称和邀请码，执行商家注册流程
    if (inputShopName && inputInviteCode) {
      // 验证账号密码（商家注册需要）
      if (!inputAccount) {
        wx.showToast({
          title: '请输入登录账号',
          icon: 'none',
          duration: 2000
        });
        return;
      }
      
      if (!inputPassword) {
        wx.showToast({
          title: '请输入登录密码',
          icon: 'none',
          duration: 2000
        });
        return;
      }
      
      if (inputPassword.length < 6) {
        wx.showToast({
          title: '密码至少需要6位',
          icon: 'none',
          duration: 2000
        });
        return;
      }
      
      // 验证确认密码
      const inputConfirmPassword = this.data.confirmPassword.trim();
      if (!inputConfirmPassword) {
        wx.showToast({
          title: '请输入确认密码',
          icon: 'none',
          duration: 2000
        });
        return;
      }
      
      // 验证两次密码是否一致
      if (inputPassword !== inputConfirmPassword) {
        wx.showToast({
          title: '两次密码不相同，请重新输入',
          icon: 'none',
          duration: 2000
        });
        return;
      }
      
      await this.registerMerchant();
      return;
    }
    
    // 3. 其他情况：提示用户输入必要信息
    if (!inputShopName && !inputInviteCode) {
      wx.showToast({
        title: '请填写店铺名称和邀请码进行商家注册，或填写账号密码登录管理端',
        icon: 'none',
        duration: 3000
      });
      return;
    }
    
    if (!inputShopName) {
      wx.showToast({
        title: '商家注册需要输入店铺名称',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    if (!inputInviteCode) {
      wx.showToast({
        title: '商家注册需要输入邀请码',
        icon: 'none',
        duration: 2000
      });
      return;
    }
  },
  
  // 尝试管理员登录
  async tryAdminLogin(account, password) {
    wx.showLoading({ title: '登录中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'adminManage',
        data: {
          action: 'adminLogin',
          data: {
            username: account, // 使用账号作为管理员用户名
            password: password  // 使用密码进行验证
          }
        }
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.code === 200) {
        console.log('管理员登录成功，准备跳转管理后台');
        
        const d = res.result.data || {};
        const sessionToken = d.sessionToken;
        if (!sessionToken) {
          wx.showToast({ title: '登录数据异常，请更新云函数', icon: 'none' });
          return;
        }
        wx.setStorageSync('adminToken', sessionToken);
        wx.setStorageSync('adminInfo', {
          username: (d.admin && d.admin.username) || account,
          role: (d.admin && d.admin.role) || 'super_admin',
          permissions: (d.admin && d.admin.permissions) || [],
          expireTime: d.expiresAt || Date.now() + 24 * 60 * 60 * 1000
        });
        
        // 显示成功提示
        wx.showToast({
          title: '登录成功，跳转管理后台',
          icon: 'success',
          duration: 1500
        });
        
        // 延迟跳转（管理后台非 tabBar 页，需用 reLaunch）
        setTimeout(() => {
          wx.reLaunch({
            url: '/subpackages/admin/pages/admin-dashboard/index',
            success: () => {
              console.log('跳转管理后台成功');
            },
            fail: (err) => {
              console.error('跳转失败:', err);
              wx.showToast({
                title: '跳转失败: ' + err.errMsg,
                icon: 'none',
                duration: 3000
              });
            }
          });
        }, 1500);
      } else {
        wx.showToast({
          title: res.result.message || '登录失败，请检查账号密码',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('管理员登录失败:', error);
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 商家注册
  async registerMerchant() {
    // 商家注册需要店铺名称
    if(!this.data.shopName.trim()){
      wx.showToast({ title:'商家注册需要输入店铺名称', icon:'none' });
      return;
    }
    
    wx.showLoading({ title: '注册中...' });
    
    try {
      const campus = this._registerCampus || normalizeHomeCampus(wx.getStorageSync(STORAGE_KEY)) || CAMPUS_BAISHA;
      const res = await wx.cloud.callFunction({
        name: 'merchantRegister',
        data: {
          shopName: this.data.shopName.trim(),
          inviteCode: this.data.inviteCode.trim(),
          account: this.data.account.trim(),
          password: this.data.password.trim(),
          campus
        }
      });
      
      wx.hideLoading();
      
      console.log('注册结果:', res.result);
      
      if (res.result && res.result.code === 200) {
        // 保存商家身份标识和完整信息
        wx.setStorageSync('isMerchant', true);
        wx.setStorageSync('merchantInfo', res.result.data.merchant);
        wx.setStorageSync('userInfo', res.result.data.user);
        
        wx.showToast({
          title: '注册成功',
          icon: 'success',
          duration: 2000
        });
        
        // 跳转到商家订单页面
        setTimeout(() => {
          wx.reLaunch({
            url: '/subpackages/merchant/pages/merchant-orders/index',
            success: () => {
              console.log('跳转商家端成功');
            }
          });
        }, 2000);
      } else {
        wx.showToast({
          title: res.result.message || '注册失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('商家注册失败:', err);
      wx.showToast({
        title: '注册失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },
  
  // 验证邀请码（已废弃，保留兼容性）
  verifyInviteCode() {
    console.log('此方法已废弃，请使用双重验证');
    // 普通邀请码验证（这里可以调用后端API）
    this.validateNormalInviteCode(this.data.inviteCode.trim());
  },
  
  // 验证普通邀请码
  validateNormalInviteCode(inviteCode) {
    // 模拟后端验证
    wx.showLoading({ title: '验证中...' });
    
    setTimeout(() => {
      wx.hideLoading();
      
      // 这里应该调用真实的云函数验证邀请码
      // 暂时模拟验证成功
      if (inviteCode.length >= 6) {
        wx.showToast({ 
          title: '邀请码验证成功，提交注册申请', 
          icon: 'success' 
        });
        
        // 这里可以调用云函数提交商家注册申请
        this.submitMerchantRegistration();
      } else {
        wx.showToast({ 
          title: '邀请码格式不正确', 
          icon: 'none' 
        });
      }
    }, 1500);
  },
  
  // 提交商家注册申请
  submitMerchantRegistration() {
    // 调用云函数提交注册申请
    wx.cloud.callFunction({
      name: 'merchantRegister',
      data: {
        shopName: this.data.shopName,
        inviteCode: this.data.inviteCode
      },
      success: (res) => {
        console.log('注册申请提交成功:', res);
        setTimeout(() => { 
          wx.navigateBack(); 
        }, 1500);
      },
      fail: (err) => {
        console.error('注册申请提交失败:', err);
        wx.showToast({ 
          title: '提交失败，请重试', 
          icon: 'none' 
        });
      }
    });
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


