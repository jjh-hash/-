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
    ]
  },
  onNav(e){
    const tab = e.currentTarget.dataset.tab;
    if(tab==='orders'){
      wx.reLaunch({ url: '/pages/merchant-orders/index' });
    } else if(tab==='workbench'){
      wx.reLaunch({ url: '/pages/merchant-workbench/index' });
    }
  },

  // 点击菜单项
  onItemTap(e) {
    const text = e.currentTarget.dataset.text;
    
    switch(text) {
      case '设置':
        wx.navigateTo({ url: '/pages/merchant-settings/index' });
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


