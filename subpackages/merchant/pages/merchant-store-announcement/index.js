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
  async loadAnnouncement() {
    wx.showLoading({ title: '加载中...' });
    
    try {
      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      
      const res = await wx.cloud.callFunction({
        name: 'storeManage',
        data: {
          action: 'getStoreInfo',
          data: {
            merchantId: merchantId // 传递商家ID，优先使用
          }
        }
      });
      
      wx.hideLoading();
      
      console.log('【店铺公告】加载结果:', res.result);
      
      if (res.result && res.result.code === 200) {
        const storeInfo = res.result.data.storeInfo;
        this.setData({
          announcementText: storeInfo.announcement || ''
        });
      } else {
        this.setData({
          announcementText: ''
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('【店铺公告】加载失败:', err);
      this.setData({
        announcementText: ''
      });
    }
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
  async saveAnnouncementToCloud(announcement) {
    try {
      console.log('【店铺公告】准备保存公告:', announcement);
      
      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      
      const res = await wx.cloud.callFunction({
        name: 'storeManage',
        data: {
          action: 'updateStoreAnnouncement',
          data: {
            announcement: announcement.trim(),
            merchantId: merchantId // 传递商家ID，优先使用
          }
        }
      });
      
      console.log('【店铺公告】保存结果:', res.result);
      
      if (res.result && res.result.code === 200) {
        return res.result.data;
      } else {
        throw new Error(res.result.message || '保存失败');
      }
    } catch (error) {
      console.error('【店铺公告】保存失败:', error);
      throw error;
    }
  }
});
