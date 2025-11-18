Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    online: false,
    currentArea: '待命区域',
    tabs: ['待抢单', '待取货', '待送达'],
    activeTab: 0,
    notice: '1项设置异常需要调整，点击查看',
    noticeVisible: true
  },

  onTabChange(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ activeTab: index });
  },

  onToggleOnline() {
    this.setData({ online: !this.data.online });
    wx.showToast({
      title: this.data.online ? '已上线' : '已下线',
      icon: 'none'
    });
  },

  onNoticeClose() {
    this.setData({ noticeVisible: false });
  },

  onEnableLocation() {
    wx.showModal({
      title: '定位权限',
      content: '请前往系统设置开启“始终允许”定位权限，以便接单导航。',
      confirmText: '去设置',
      success: (res) => {
        if (res.confirm) {
          wx.openSetting({
            success: () => {
              wx.showToast({ title: '请在设置中开启定位', icon: 'none' });
            }
          });
        }
      }
    });
  },

  onSettingTap() {
    wx.showToast({ title: '跑单设置开发中', icon: 'none' });
  },

  onCenterTap() {
    wx.showToast({ title: '跑单中心开发中', icon: 'none' });
  },

  onRefresh() {
    wx.showToast({ title: '正在刷新订单…', icon: 'none' });
    setTimeout(() => {
      wx.showToast({ title: '暂无新订单', icon: 'none' });
    }, 1000);
  },

  onHelperTap() {
    wx.showToast({ title: '小饼助手敬请期待', icon: 'none' });
  },

  onNoticeTap() {
    wx.showToast({ title: '通知中心开发中', icon: 'none' });
  },

  onMoreTap() {
    wx.showToast({ title: '更多功能开发中', icon: 'none' });
  }
});


