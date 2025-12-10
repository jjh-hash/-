Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    userInfo: {},
    contactInfo: {
      phone: '',
      wechat: '',
      qq: ''
    }
  },

  onLoad(options) {
    console.log('【联系信息页面】页面加载', options);
    this.loadUserInfo();
  },

  // 加载用户信息
  async loadUserInfo() {
    try {
      wx.showLoading({ title: '加载中...' });

      // 从本地存储获取用户信息
      const localUserInfo = wx.getStorageSync('userInfo');
      if (localUserInfo) {
        this.setData({
          userInfo: localUserInfo,
          contactInfo: {
            phone: localUserInfo.phone || '',
            wechat: localUserInfo.wechat || '',
            qq: localUserInfo.qq || ''
          }
        });
        wx.hideLoading();
        return;
      }

      // 如果本地没有，尝试从全局数据获取
      const app = getApp();
      if (app.globalData.userInfo) {
        this.setData({
          userInfo: app.globalData.userInfo,
          contactInfo: {
            phone: app.globalData.userInfo.phone || '',
            wechat: app.globalData.userInfo.wechat || '',
            qq: app.globalData.userInfo.qq || ''
          }
        });
        wx.hideLoading();
      } else {
        wx.hideLoading();
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('【联系信息页面】加载用户信息失败:', error);
      // 尝试从全局数据获取
      const app = getApp();
      if (app.globalData.userInfo) {
        this.setData({
          userInfo: app.globalData.userInfo,
          contactInfo: {
            phone: app.globalData.userInfo.phone || '',
            wechat: app.globalData.userInfo.wechat || '',
            qq: app.globalData.userInfo.qq || ''
          }
        });
      }
    }
  },

  // 输入电话号码
  onPhoneInput(e) {
    this.setData({
      'contactInfo.phone': e.detail.value
    });
  },

  // 输入微信号
  onWechatInput(e) {
    this.setData({
      'contactInfo.wechat': e.detail.value
    });
  },

  // 输入QQ号
  onQQInput(e) {
    this.setData({
      'contactInfo.qq': e.detail.value
    });
  },

  // 保存联系信息
  async onSave() {
    const { contactInfo, userInfo } = this.data;

    // 至少需要填写一种联系方式（选填一个即可）
    if (!contactInfo.phone && !contactInfo.wechat && !contactInfo.qq) {
      wx.showToast({
        title: '请至少填写一种联系方式',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    try {
      wx.showLoading({ title: '保存中...' });

      // 调用云函数更新用户信息
      const res = await wx.cloud.callFunction({
        name: 'updateUserInfo',
        data: {
          phone: contactInfo.phone || '',
          wechat: contactInfo.wechat || '',
          qq: contactInfo.qq || ''
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 0) {
        const updatedUserInfo = res.result.data.userInfo;
        
        // 更新本地存储
        wx.setStorageSync('userInfo', updatedUserInfo);
        
        // 更新全局数据
        const app = getApp();
        app.globalData.userInfo = updatedUserInfo;

        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });

        // 延迟返回，确保提示显示
        setTimeout(() => {
          // 如果是从其他页面跳转过来的，返回并传递联系信息
          const pages = getCurrentPages();
          const prevPage = pages[pages.length - 2];
          if (prevPage) {
            // 将联系信息传递给上一页
            prevPage.setData({
              contactInfo: {
                ...contactInfo,
                name: updatedUserInfo.nickname || '微信用户',
                avatar: updatedUserInfo.avatar || ''
              }
            });
          }
          wx.navigateBack();
        }, 1500);
      } else {
        wx.showToast({
          title: res.result?.message || '保存失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('【联系信息页面】保存失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    }
  },

  onBack() {
    wx.navigateBack();
  }
});

