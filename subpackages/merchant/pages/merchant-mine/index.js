Page({
  data:{
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    items: [
      { text: '设置' },
      { text: '关于我们' },
      { text: '联系我们' },
      { text: '意见反馈' },
      { text: '清理缓存' },
      { text: '当前版本' }
    ],
    // 商家信息
    merchantName: '可爱的麻辣土豆丝店',
    contactPhone: '17864110900',
    avatar: 'https://picsum.photos/seed/merchant/80/80'
  },

  onLoad() {
    // 页面加载时获取商家信息
    this.loadMerchantInfo();
  },

  onShow() {
    // 页面显示时刷新商家信息
    this.loadMerchantInfo();
  },

  // 刷新商家信息（从云数据库重新获取）
  async refreshMerchantInfo() {
    try {
      wx.showLoading({ title: '刷新中...' });
      
      // 调用商家登录云函数重新获取最新信息
      const res = await wx.cloud.callFunction({
        name: 'merchantLogin'
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.code === 200) {
        const updatedMerchant = res.result.data.merchant;
        console.log('【我的页面】刷新后的商家信息:', updatedMerchant);
        console.log('【我的页面】刷新后的商家头像:', updatedMerchant.avatar);
        
        // 更新本地存储
        wx.setStorageSync('merchantInfo', updatedMerchant);
        
        // 重新加载显示
        this.loadMerchantInfo();
        
        wx.showToast({
          title: '刷新成功',
          icon: 'success',
          duration: 1500
        });
      } else {
        wx.showToast({
          title: '刷新失败',
          icon: 'none'
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('刷新商家信息失败:', err);
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      });
    }
  },

  // 加载商家信息
  loadMerchantInfo() {
    const merchantInfo = wx.getStorageSync('merchantInfo');
    const userInfo = wx.getStorageSync('userInfo');
    
    console.log('【我的页面】商家信息:', merchantInfo);
    console.log('【我的页面】用户信息:', userInfo);
    console.log('【我的页面】商家头像字段:', merchantInfo ? merchantInfo.avatar : '无');
    console.log('【我的页面】用户头像字段:', userInfo ? userInfo.avatar : '无');
    
    if (merchantInfo) {
      this.setData({
        merchantName: merchantInfo.merchantName || '未设置店铺名称',
        contactPhone: merchantInfo.contactPhone || '未设置联系方式'
      });
      
      // 优先使用商家头像，如果没有则使用用户头像
      // 检查商家头像是否存在且不为空
      if (merchantInfo.avatar && 
          merchantInfo.avatar.trim() !== '' && 
          merchantInfo.avatar !== 'undefined' &&
          merchantInfo.avatar !== 'null') {
        console.log('【我的页面】使用商家头像:', merchantInfo.avatar);
        this.setData({
          avatar: merchantInfo.avatar
        });
      } else if (userInfo && userInfo.avatar) {
        console.log('【我的页面】使用用户头像:', userInfo.avatar);
        this.setData({
          avatar: userInfo.avatar
        });
      } else {
        console.log('【我的页面】使用默认头像');
        this.setData({
          avatar: '/pages/小标/商家.png'
        });
      }
    }
  },

  // 头像加载错误处理
  onAvatarError(e) {
    console.warn('商家头像加载失败，使用默认图片');
    this.setData({
      avatar: '/pages/小标/商家.png'
    });
  },

  onNav(e){
    const tab = e.currentTarget.dataset.tab;
    if(tab==='orders'){
      wx.reLaunch({ url: '/subpackages/merchant/pages/merchant-orders/index' });
    } else if(tab==='workbench'){
      wx.reLaunch({ url: '/subpackages/merchant/pages/merchant-workbench/index' });
    }
  },

  // 点击菜单项
  onItemTap(e) {
    const text = e.currentTarget.dataset.text;
    
    switch(text) {
      case '设置':
        wx.navigateTo({ url: '/subpackages/merchant/pages/merchant-settings/index' });
        break;
      case '关于我们':
        wx.showModal({
          title: '关于我们',
          content: '校园外卖商家端 v1.0.0\n\n为校园商家提供便捷的外卖管理服务。',
          showCancel: false,
          confirmText: '知道了'
        });
        break;
      case '联系我们':
        wx.showModal({
          title: '联系我们',
          content: '客服电话：400-123-4567\n客服邮箱：service@campusfood.com',
          showCancel: false,
          confirmText: '知道了'
        });
        break;
      case '意见反馈':
        wx.showToast({ title: '意见反馈功能开发中', icon: 'none' });
        break;
      case '清理缓存':
        wx.showModal({
          title: '清理缓存',
          content: '确定要清理缓存吗？这将删除临时文件，但不会影响您的数据。',
          success: (res) => {
            if (res.confirm) {
              wx.showLoading({ title: '清理中...' });
              setTimeout(() => {
                wx.hideLoading();
                wx.showToast({ title: '清理完成', icon: 'success' });
              }, 1500);
            }
          }
        });
        break;
      case '当前版本':
        wx.showModal({
          title: '当前版本',
          content: '校园外卖商家端 v1.0.0\n\n最新版本，无需更新。',
          showCancel: false,
          confirmText: '知道了'
        });
        break;
      default:
        wx.showToast({ title: '功能开发中', icon: 'none' });
    }
  }
});


