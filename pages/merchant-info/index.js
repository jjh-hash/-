Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    activeTab: 2, // 默认选中商家标签
    tabs: ['点餐', '评价', '商家'],
    storeInfo: {
      name: '意大利特火小面条馆',
      monthlySales: 401,
      location: '学校名称+校区+大概/精准位置',
      phone: '130****7854',
      businessHours: '全天24小时营业',
      deliveryService: '提供配送服务',
      announcement: '公告星系公告星系公告星系公告星系公告星系',
      introduction: '简介简介简介简介简介简介简介简介'
    }
  },

  onLoad(options) {
    // 如果有传入的店铺ID，可以在这里获取店铺详情
    if (options.storeId) {
      this.loadStoreDetail(options.storeId);
    }
  },

  // 加载店铺详情
  loadStoreDetail(storeId) {
    console.log('加载店铺详情:', storeId);
  },

  // 切换标签
  onTabTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeTab: index
    });
    
    // 根据标签跳转
    if (index === 0) {
      wx.navigateTo({
        url: '/pages/store-detail/index'
      });
    } else if (index === 1) {
      wx.navigateTo({
        url: '/pages/reviews/index?storeId=1'
      });
    }
  },

  // 拨打电话
  onCallPhone() {
    wx.makePhoneCall({
      phoneNumber: '13012347854',
      success: () => {
        console.log('拨打电话成功');
      },
      fail: (err) => {
        console.error('拨打电话失败:', err);
        wx.showToast({
          title: '拨打电话失败',
          icon: 'none'
        });
      }
    });
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});
