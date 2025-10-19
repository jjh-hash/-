Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    announcementText: ''
  },

  onLoad() {
    // 页面加载时获取当前公告内容
    this.loadAnnouncement();
  },

  onShow() {
    // 页面显示时刷新数据
  },

  // 加载公告内容
  loadAnnouncement() {
    // TODO: 从云数据库获取当前店铺公告
    // wx.cloud.callFunction({
    //   name: 'merchant/getStoreAnnouncement',
    //   data: {
    //     storeId: 'your_store_id'
    //   }
    // }).then(res => {
    //   if (res.result.code === 0) {
    //     this.setData({
    //       announcementText: res.result.data.announcement || ''
    //     });
    //   }
    // }).catch(err => {
    //   console.error('加载公告失败:', err);
    // });
    
    // 模拟加载数据
    this.setData({
      announcementText: ''
    });
  },

  // 文本输入事件
  onTextInput(e) {
    const text = e.detail.value;
    this.setData({
      announcementText: text
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  },

  // 保存公告
  saveAnnouncement() {
    const { announcementText } = this.data;
    
    // 检查是否有内容
    if (announcementText.trim().length === 0) {
      wx.showToast({
        title: '请输入公告内容',
        icon: 'none'
      });
      return;
    }

    // 显示加载提示
    wx.showLoading({
      title: '保存中...'
    });

    // TODO: 调用云函数保存公告
    this.saveAnnouncementToCloud(announcementText)
      .then(() => {
        wx.hideLoading();
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        
        // 延迟返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      })
      .catch((error) => {
        wx.hideLoading();
        wx.showToast({
          title: '保存失败',
          icon: 'error'
        });
        console.error('保存公告失败:', error);
      });
  },

  // 保存公告到云数据库
  saveAnnouncementToCloud(announcement) {
    return new Promise((resolve, reject) => {
      // TODO: 实现云函数调用
      // wx.cloud.callFunction({
      //   name: 'merchant/updateStoreAnnouncement',
      //   data: {
      //     storeId: 'your_store_id',
      //     announcement: announcement.trim()
      //   }
      // }).then(res => {
      //   if (res.result.code === 0) {
      //     resolve(res.result.data);
      //   } else {
      //     reject(new Error(res.result.message));
      //   }
      // }).catch(reject);
      
      // 模拟保存成功
      setTimeout(() => {
        console.log('保存公告:', announcement);
        resolve();
      }, 1000);
    });
  }
});
