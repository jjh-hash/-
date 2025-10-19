Page({
  data:{
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    storeOpen: true,
    autoAccept: false,
    manageItems: [
      { icon: '📄', text: '店铺信息' },
      { icon: '📢', text: '店铺公告' },
      { icon: '🖼️', text: '店铺照片' },
      { icon: '🔖', text: '商品分类' },
      { icon: '🛒', text: '商品管理' },
      { icon: '📦', text: '配送方案' },
      { icon: '⭐', text: '评价管理' },
      { icon: '📈', text: '销售统计' }
    ]
  },
  onStoreSwitch(e){
    this.setData({ storeOpen: e.detail.value });
    this.saveStoreSettings();
  },

  onAutoAcceptSwitch(e){
    this.setData({ autoAccept: e.detail.value });
    this.saveStoreSettings();
  },
  onLoad(){
    this.loadStoreSettings();
  },
  
  onShow(){
    this.loadStoreSettings();
  },

  // 加载店铺设置
  loadStoreSettings() {
    // TODO: 从云数据库加载店铺设置
    // wx.cloud.callFunction({
    //   name: 'merchant/getStoreSettings',
    //   data: {
    //     storeId: 'your_store_id'
    //   }
    // }).then(res => {
    //   if (res.result.code === 0) {
    //     this.setData({
    //       storeOpen: res.result.data.businessStatus === 'open',
    //       autoAccept: res.result.data.autoAccept || false
    //     });
    //   }
    // }).catch(err => {
    //   console.error('加载店铺设置失败:', err);
    // });
    
    // 模拟加载数据
    console.log('加载店铺设置');
  },

  // 保存店铺设置
  saveStoreSettings() {
    const { storeOpen, autoAccept } = this.data;
    
    // TODO: 调用云函数保存店铺设置
    // wx.cloud.callFunction({
    //   name: 'merchant/updateStoreSettings',
    //   data: {
    //     storeId: 'your_store_id',
    //     businessStatus: storeOpen ? 'open' : 'closed',
    //     autoAccept: autoAccept
    //   }
    // }).then(res => {
    //   if (res.result.code === 0) {
    //     wx.showToast({
    //       title: '设置已保存',
    //       icon: 'success',
    //       duration: 1000
    //     });
    //   } else {
    //     wx.showToast({
    //       title: '保存失败',
    //       icon: 'error'
    //     });
    //   }
    // }).catch(err => {
    //   console.error('保存店铺设置失败:', err);
    //   wx.showToast({
    //     title: '保存失败',
    //     icon: 'error'
    //   });
    // });
    
    // 模拟保存成功
    console.log('保存店铺设置:', { storeOpen, autoAccept });
    wx.showToast({
      title: '设置已保存',
      icon: 'success',
      duration: 1000
    });
  },
  // 点击网格第一个入口：店铺信息
  handleGridTap(e){
    const text = e.currentTarget.dataset.text;
    if(text==='店铺信息'){
      wx.navigateTo({ url: '/pages/merchant-store-info/index' });
    } else if(text==='商品管理'){
      wx.navigateTo({ url: '/pages/merchant-goods/index' });
    } else if(text==='商品分类'){
      wx.navigateTo({ url: '/pages/merchant-category/index' });
    } else if(text==='评价管理'){
      wx.navigateTo({ url: '/pages/merchant-reviews/index' });
    } else if(text==='销售统计'){
      wx.navigateTo({ url: '/pages/merchant-sales-stats/index' });
    } else if(text==='配送方案'){
      wx.navigateTo({ url: '/pages/merchant-delivery-plan/index' });
    } else if(text==='店铺公告'){
      wx.navigateTo({ url: '/pages/merchant-store-announcement/index' });
    } else if(text==='店铺照片'){
      wx.navigateTo({ url: '/pages/merchant-store-photos/index' });
    }
  },
  onNav(e){
    const tab = e.currentTarget.dataset.tab;
    if(tab==='orders'){
      wx.reLaunch({ url: '/pages/merchant-orders/index' });
    } else if(tab==='mine') {
      wx.reLaunch({ url: '/pages/merchant-mine/index' });
    }
  }
});


