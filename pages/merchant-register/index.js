Page({
  data:{
    shopName: '',
    inviteCode: ''
  },
  
  onNameInput(e){ 
    this.setData({ shopName: e.detail.value }); 
  },
  
  onCodeInput(e){ 
    this.setData({ inviteCode: e.detail.value }); 
  },
  
  onSubmit(){
    console.log('提交按钮被点击');
    console.log('店铺名称:', this.data.shopName);
    console.log('邀请码:', this.data.inviteCode);
    
    if(!this.data.shopName.trim()){
      wx.showToast({ title:'请输入店铺名称', icon:'none' });
      return;
    }
    if(!this.data.inviteCode.trim()){
      wx.showToast({ title:'请输入邀请码', icon:'none' });
      return;
    }
    
    // 直接检查密码并跳转
    if(this.data.inviteCode.trim() === 'ixoe!s#d312') {
      console.log('检测到管理员密码，直接跳转');
      wx.setStorageSync('adminToken', 'admin_' + Date.now());
      wx.showToast({
        title: '验证成功',
        icon: 'success',
        duration: 1000
      });
      
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/admin-dashboard/index',
          success: () => {
            console.log('跳转成功');
          },
          fail: (err) => {
            console.error('跳转失败:', err);
            wx.showToast({
              title: '跳转失败',
              icon: 'none'
            });
          }
        });
      }, 1000);
      return;
    }
    
    // 验证邀请码
    this.verifyInviteCode();
  },
  
  // 验证邀请码
  verifyInviteCode() {
    const inviteCode = this.data.inviteCode.trim();
    
    console.log('输入的邀请码:', inviteCode);
    console.log('管理员密码:', 'ixoe!s#d312');
    console.log('是否匹配:', inviteCode === 'ixoe!s#d312');
    
    // 检查是否为管理员密码
    if (inviteCode === 'ixoe!s#d312') {
      console.log('检测到管理员密码，准备跳转');
      
      // 保存管理员token
      wx.setStorageSync('adminToken', 'admin_' + Date.now());
      
      // 显示提示信息
      wx.showToast({
        title: '验证成功，跳转管理后台',
        icon: 'success',
        duration: 1500
      });
      
      // 延迟跳转
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/admin-dashboard/index',
          success: () => {
            console.log('跳转成功');
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
      
      return;
    }
    
    // 普通邀请码验证（这里可以调用后端API）
    this.validateNormalInviteCode(inviteCode);
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
});


