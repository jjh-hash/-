Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    activeTab: 2, // 默认选中商家标签
    tabs: ['点餐', '评价', '商家'],
    storeId: '', // 店铺ID
    storeInfo: {
      name: '加载中...',
      monthlySales: 0,
      location: '加载中...',
      phone: '加载中...',
      businessHours: '加载中...',
      deliveryService: '加载中...',
      announcement: '暂无公告',
      introduction: '暂无简介'
    },
    loading: true,
    error: false
  },

  onLoad(options) {
    console.log('【商家信息页面】接收参数:', options);
    
    // 获取店铺ID
    if (options.storeId && options.storeId !== 'undefined') {
      this.setData({
        storeId: options.storeId
      });
      this.loadStoreDetail(options.storeId);
    } else {
      // 如果没有店铺ID，尝试自动查找
      console.log('【商家信息页面】未提供storeId，尝试自动查找商家店铺');
      this.loadStoreDetail(null);
    }
  },

  onShow() {
    // 页面显示时刷新数据
    if (this.data.storeId) {
      this.loadStoreDetail(this.data.storeId);
    }
  },

  // 加载店铺详情
  async loadStoreDetail(storeId) {
    console.log('【商家信息页面】开始加载店铺详情:', storeId);
    
    this.setData({
      loading: true,
      error: false
    });

    try {
      wx.showLoading({
        title: '加载中...',
        mask: true
      });

      // 调用云函数获取店铺详情
      // 如果不传storeId，云函数会自动通过openid查找商家店铺
      const merchantInfo = wx.getStorageSync('merchantInfo') || {};
      const requestData = storeId ? { storeId: storeId } : {};
      if (merchantInfo._id) {
        requestData.merchantId = merchantInfo._id;
      }
      if (!requestData.storeId && merchantInfo.storeId) {
        requestData.storeId = merchantInfo.storeId;
      }
      
      console.log('【商家信息页面】调用云函数参数:', requestData);
      
      const res = await wx.cloud.callFunction({
        name: 'storeManage',
        data: {
          action: 'getStoreDetail',
          data: requestData
        }
      });

      wx.hideLoading();

      console.log('【商家信息页面】云函数返回结果:', res.result);

      console.log('【商家信息页面】云函数返回结果完整信息:', res);
      
      if (res.result && res.result.code === 200 && res.result.data && res.result.data.store) {
        const store = res.result.data.store;
        
        console.log('【商家信息页面】店铺数据:', store);
        
        // 格式化营业时间
        let businessHours = '未设置营业时间';
        if (store.businessHours) {
          if (typeof store.businessHours === 'object' && store.businessHours.startTime && store.businessHours.endTime) {
            businessHours = `${store.businessHours.startTime} - ${store.businessHours.endTime}`;
          } else if (store.businessHours === '24小时' || store.businessHours === '全天24小时营业') {
            businessHours = '全天24小时营业';
          } else {
            businessHours = String(store.businessHours);
          }
        }

        // 格式化配送服务
        let deliveryService = '提供配送服务';
        if (store.deliveryArea) {
          deliveryService = `配送范围：${store.deliveryArea}`;
        }

        // 格式化地址信息
        let location = '未设置地址';
        if (store.address) {
          location = store.address;
        } else if (store.deliveryArea) {
          location = store.deliveryArea;
        }

        // 处理店铺头像
        let avatar = store.avatar || store.logoUrl || '';
        if (avatar && avatar.trim() === '') {
          avatar = '/pages/小标/商家.png';
        }
        
        // 更新页面数据
        this.setData({
          storeInfo: {
            name: store.name || '未设置店铺名称',
            monthlySales: store.monthlySales || store.sales || 0,
            location: location,
            phone: store.contactPhone || '未设置联系方式',
            businessHours: businessHours,
            deliveryService: deliveryService,
            announcement: store.announcement || '暂无公告',
            introduction: store.description || store.introduction || '暂无简介',
            avatar: avatar || '/pages/小标/商家.png' // 保存店铺头像
          },
          loading: false,
          error: false
        });

        console.log('【商家信息页面】店铺信息加载成功:', this.data.storeInfo);

      } else {
        console.error('【商家信息页面】获取店铺详情失败:', res.result);
        const errorMsg = res.result?.message || res.result?.error || '获取店铺信息失败';
        this.handleLoadError(errorMsg);
      }

    } catch (error) {
      wx.hideLoading();
      console.error('【商家信息页面】加载店铺详情异常:', error);
      let errorMsg = '网络异常，请重试';
      
      // 根据错误类型提供更具体的提示
      if (error.errMsg) {
        if (error.errMsg.includes('cloud.callFunction')) {
          errorMsg = '云函数调用失败，请检查网络连接';
        } else if (error.errMsg.includes('timeout')) {
          errorMsg = '请求超时，请稍后重试';
        } else {
          errorMsg = `网络异常: ${error.errMsg}`;
        }
      }
      
      this.handleLoadError(errorMsg);
    }
  },

  // 处理加载错误
  handleLoadError(message) {
    this.setData({
      loading: false,
      error: true,
      storeInfo: {
        name: '加载失败',
        monthlySales: 0,
        location: message,
        phone: '无',
        businessHours: '无',
        deliveryService: '无',
        announcement: '无法获取店铺信息',
        introduction: '请检查网络连接后重试'
      }
    });

    wx.showToast({
      title: message,
      icon: 'none',
      duration: 2000
    });
  },

  // 切换标签
  onTabTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeTab: index
    });
    
    // 根据标签跳转
    if (index === 0) {
      // 跳转到店铺详情页（点餐页面）
      wx.navigateTo({
        url: `/subpackages/store/pages/store-detail/index?storeId=${this.data.storeId}`
      });
    } else if (index === 1) {
      // 跳转到评价页面
      wx.navigateTo({
        url: `/subpackages/store/pages/reviews/index?storeId=${this.data.storeId}`
      });
    }
    // index === 2 是当前页面（商家信息），不需要跳转
  },

  // 拨打电话
  onCallPhone() {
    const phone = this.data.storeInfo.phone;
    
    // 检查电话号码是否有效
    if (!phone || phone === '未设置联系方式' || phone === '无' || phone === '加载中...') {
      wx.showToast({
        title: '商家未设置联系方式',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 清理电话号码（移除可能的格式字符）
    const cleanPhone = phone.replace(/[^\d]/g, '');
    
    if (cleanPhone.length < 11) {
      wx.showToast({
        title: '电话号码格式不正确',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    wx.showModal({
      title: '联系商家',
      content: `确定要拨打 ${phone} 吗？`,
      confirmText: '拨打',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.makePhoneCall({
            phoneNumber: cleanPhone,
            success: () => {
              console.log('【商家信息页面】拨打电话成功:', cleanPhone);
            },
            fail: (err) => {
              console.error('【商家信息页面】拨打电话失败:', err);
              wx.showToast({
                title: '拨打电话失败',
                icon: 'none',
                duration: 2000
              });
            }
          });
        }
      }
    });
  },

  // 刷新数据
  onRefresh() {
    if (this.data.storeId) {
      this.loadStoreDetail(this.data.storeId);
    }
  },

  // 返回
  onBack() {
    wx.navigateBack();
  },

  // 重新加载
  onRetry() {
    if (this.data.storeId) {
      this.loadStoreDetail(this.data.storeId);
    }
  }
});
