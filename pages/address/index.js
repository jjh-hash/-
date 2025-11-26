Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    addresses: [],
    loading: true,
    loadingPromise: null, // 防止重复请求
    fromExpress: false, // 是否从express页面跳转过来
    fromCheckout: false // 是否从结算页面跳转过来
  },

  onLoad(options) {
    console.log('【地址列表页面】页面加载', options);
    // 检查是否从express页面、gaming页面或reward页面跳转过来
    if (options.from === 'express' || options.from === 'gaming' || options.from === 'reward') {
      this.setData({
        fromExpress: true // 复用这个字段，表示需要选择地址
      });
    }
    // 检查是否从结算页面跳转过来
    if (options.from === 'checkout') {
      this.setData({
        fromCheckout: true // 表示需要选择地址并返回结算页面
      });
    }
    this.loadAddresses();
  },

  onShow() {
    console.log('【地址列表页面】页面显示');
    // 只有在数据为空或超过30秒才刷新，避免重复请求
    const lastLoadTime = this.lastLoadTime || 0;
    const now = Date.now();
    if (this.data.addresses.length === 0 || (now - lastLoadTime) > 30000) {
      this.loadAddresses();
    }
  },

  // 加载地址列表（优化版本：添加请求去重）
  async loadAddresses() {
    // 如果正在加载，直接返回Promise，避免重复请求
    if (this.data.loadingPromise) {
      return this.data.loadingPromise;
    }

    this.setData({ loading: true });

    const loadPromise = (async () => {
      try {
        wx.showLoading({ title: '加载中...' });

        const res = await wx.cloud.callFunction({
          name: 'addressManage',
          data: {
            action: 'getAddressList',
            data: {}
          }
        });

        wx.hideLoading();

        console.log('【地址列表页面】云函数返回结果:', res.result);

        if (res.result && res.result.code === 200) {
          // 格式化地址数据，确保数据结构正确
          const formattedAddresses = (res.result.data.list || []).map(item => ({
            _id: item._id,
            name: item.name || '未设置姓名',
            phone: item.phone || '未设置电话',
            buildingName: item.buildingName || '',
            houseNumber: item.houseNumber || '',
            addressDetail: item.addressDetail || '',
            isDefault: item.isDefault || false,
            // 组合显示地址（保持原有顺序：楼栋名+门牌号+详细地址）
            fullAddress: `${item.buildingName || ''}${item.houseNumber || ''}${item.addressDetail || ''}`.trim() || '地址未填写',
            detail: `${item.buildingName || ''}${item.houseNumber || ''}${item.addressDetail || ''}`.trim() || '地址未填写'
          }));
          
          this.setData({
            addresses: formattedAddresses,
            loading: false,
            loadingPromise: null
          });

          this.lastLoadTime = Date.now(); // 记录加载时间

          console.log('【地址列表页面】地址加载成功，共', formattedAddresses.length, '条');
        } else {
          wx.showToast({
            title: res.result?.message || '加载失败',
            icon: 'none'
          });
          this.setData({ 
            loading: false,
            loadingPromise: null
          });
        }

      } catch (error) {
        wx.hideLoading();
        console.error('【地址列表页面】加载异常:', error);
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
        this.setData({ 
          loading: false,
          loadingPromise: null
        });
      }
    })();

    this.setData({ loadingPromise: loadPromise });
    return loadPromise;
  },

  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) wx.navigateBack();
    else wx.reLaunch({ url: '/pages/profile/index' });
  },

  onAdd() {
    wx.navigateTo({
      url: '/pages/add-address/index'
    });
  },

  // 删除地址（优化版本：本地更新而非全量刷新）
  async onDelete(e) {
    const addressId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个地址吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });

            const result = await wx.cloud.callFunction({
              name: 'addressManage',
              data: {
                action: 'deleteAddress',
                data: {
                  addressId: addressId
                }
              }
            });

            wx.hideLoading();

            if (result.result && result.result.code === 200) {
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              });
              
              // 本地更新，避免全量刷新
              const addresses = this.data.addresses.filter(addr => addr._id !== addressId);
              this.setData({ addresses });
            } else {
              wx.showToast({
                title: result.result?.message || '删除失败',
                icon: 'none'
              });
            }

          } catch (error) {
            wx.hideLoading();
            console.error('【地址列表页面】删除异常:', error);
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 选择地址（从express页面或结算页面跳转过来时使用）
  onSelectAddress(e) {
    // 如果是从express页面或结算页面跳转过来的，才执行选择地址逻辑
    // 否则不做任何处理，保持原有的地址管理功能不变
    if (!this.data.fromExpress && !this.data.fromCheckout) {
      return;
    }
    
    const addressId = e.currentTarget.dataset.id;
    const selectedAddress = this.data.addresses.find(addr => addr._id === addressId);
    
    if (selectedAddress) {
      const pages = getCurrentPages();
      if (pages.length >= 2) {
        const prevPage = pages[pages.length - 2];
        
        if (this.data.fromCheckout) {
          // 从结算页面来的，更新结算页面的地址信息
          // 地址格式：详细地址+楼栋名+门牌号（与结算页面loadUserAddress中的格式保持一致）
          const addressText = `${selectedAddress.addressDetail || ''}${selectedAddress.buildingName || ''}${selectedAddress.houseNumber || ''}`;
          
          console.log('【地址列表页面】选择地址，更新结算页面:', {
            selectedAddress: selectedAddress,
            addressText: addressText
          });
          
          prevPage.setData({
            userInfo: {
              name: selectedAddress.name,
              phone: selectedAddress.phone,
              address: addressText
            },
            hasAddress: true,
            addressSelected: true // 标记已选择地址，防止onShow时覆盖
          });
        } else if (this.data.fromExpress) {
          // 从express页面来的，更新express页面的地址
          prevPage.setData({
            address: selectedAddress
          });
        }
      }
      
      wx.navigateBack();
    }
  },

  // 设置默认地址（优化版本：本地更新而非全量刷新）
  async onSetDefault(e) {
    const addressId = e.currentTarget.dataset.id;
    
    try {
      wx.showLoading({ title: '设置中...' });

      const res = await wx.cloud.callFunction({
        name: 'addressManage',
        data: {
          action: 'setDefaultAddress',
          data: {
            addressId: addressId
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '设置成功',
          icon: 'success'
        });
        
        // 本地更新，避免全量刷新
        const addresses = this.data.addresses.map(addr => ({
          ...addr,
          isDefault: addr._id === addressId
        }));
        // 默认地址排在前面
        addresses.sort((a, b) => b.isDefault - a.isDefault);
        this.setData({ addresses });
      } else {
        wx.showToast({
          title: res.result?.message || '设置失败',
          icon: 'none'
        });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('【地址列表页面】设置默认地址异常:', error);
      wx.showToast({
        title: '设置失败',
        icon: 'none'
      });
    }
  }
});

