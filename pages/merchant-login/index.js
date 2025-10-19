Page({
  data:{ statusBarHeight: wx.getWindowInfo().statusBarHeight || 20 },
  onWxLogin(){
    wx.showToast({ title:'登录成功（模拟）', icon:'success' });
    setTimeout(()=>{ wx.reLaunch({ url: '/pages/merchant-orders/index' }); }, 800);
  },
  onBackTap(){
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/pages/merchant/index' });
    }
  }
});


