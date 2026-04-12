/**
 * 兼容错误启动路径 pages/home/home（正确应为 pages/home/index）。
 * 常见于小程序码/链接/后台配置的 path 写错；此处重定向到真实首页 Tab。
 */
Page({
  onLoad() {
    wx.switchTab({
      url: '/pages/home/index',
      fail: () => {
        wx.reLaunch({ url: '/pages/home/index' });
      }
    });
  }
});
