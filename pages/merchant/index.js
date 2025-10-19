Page({
  data:{
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20
  },

  onGoRegister(){
    wx.navigateTo({ url: '/pages/merchant-register/index' });
  },

  onGoLogin(){
    wx.navigateTo({ url: '/pages/merchant-login/index' });
  },

  onBackTap(){
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/pages/profile/index' });
    }
  }
});


