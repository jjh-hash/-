App({
  onLaunch() {
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-7g0bpzkg04df43f9', // 云环境ID
        traceUser: true,
      });
    }
  },
  
  globalData: {
    userInfo: null,
    openid: null
  }
});

