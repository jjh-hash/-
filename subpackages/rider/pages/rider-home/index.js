Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    currentArea: '待命区域',
    tabs: ['待抢单', '待取货', '待送达'],
    activeTab: 0, // 默认显示待抢单标签页
    refreshing: false, // 下拉刷新状态
    loading: false,
    orders: [], // 待抢单订单列表
    pickupLoading: false,
    pickupOrders: [], // 待取货订单列表
    deliverLoading: false,
    deliverOrders: [], // 待送达订单列表
    riderStatus: 'not_registered', // 骑手审核状态: not_registered, pending, approved, rejected
    canGrabOrder: false // 是否可以接单
  },

  onLoad() {
    // 页面加载时获取数据
    this.loadRiderStatus();
    this.loadOrdersByTab(this.data.activeTab);
  },

  onShow() {
    // 页面显示时刷新数据
    this.loadRiderStatus();
    this.loadOrdersByTab(this.data.activeTab);
  },

  // 加载骑手审核状态
  async loadRiderStatus() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'riderManage',
        data: {
          action: 'getRiderStatus',
          data: {}
        }
      });

      if (res.result && res.result.code === 200) {
        const statusData = res.result.data || {};
        const status = statusData.status || 'not_registered';
        const canGrabOrder = statusData.canGrabOrder || false;
        
        this.setData({
          riderStatus: status,
          canGrabOrder: canGrabOrder
        });

        // 更新本地存储的骑手信息
        if (statusData.riderInfo) {
          const localRiderInfo = wx.getStorageSync('riderInfo') || {};
          wx.setStorageSync('riderInfo', {
            ...localRiderInfo,
            ...statusData.riderInfo,
            status: status
          });
        }
      }
    } catch (error) {
      console.error('加载骑手状态失败:', error);
    }
  },


  onTabChange(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ activeTab: index });
    
    // 切换标签时可以根据不同标签加载不同的订单数据
    this.loadOrdersByTab(index);
  },

  // 根据标签加载订单
  async loadOrdersByTab(tabIndex) {
    if (tabIndex === 0) {
      // 待抢单
      this.setData({ loading: true });
      
      try {
        const res = await wx.cloud.callFunction({
          name: 'orderManage',
          data: {
            action: 'getAvailableOrders',
            data: {
              page: 1,
              pageSize: 20
            }
          }
        });
        
        if (res.result && res.result.code === 200) {
          const orders = res.result.data.list || [];
          this.setData({
            orders: orders,
            loading: false
          });
        } else {
          throw new Error(res.result?.message || '获取订单失败');
        }
      } catch (error) {
        console.error('加载订单失败:', error);
        if (!this.data.refreshing) {
        wx.showToast({
          title: error.message || '加载失败',
          icon: 'none'
        });
        }
        this.setData({
          orders: [],
          loading: false
        });
        throw error;
      }
    } else if (tabIndex === 1) {
      // 待取货
      this.setData({ pickupLoading: true });
      
      try {
        const res = await wx.cloud.callFunction({
          name: 'orderManage',
          data: {
            action: 'getPickupOrders',
            data: {
              page: 1,
              pageSize: 20
            }
          }
        });
        
        if (res.result && res.result.code === 200) {
          const pickupOrders = res.result.data.list || [];
          this.setData({
            pickupOrders: pickupOrders,
            pickupLoading: false
          });
        } else {
          throw new Error(res.result?.message || '获取订单失败');
        }
      } catch (error) {
        console.error('加载待取货订单失败:', error);
        if (!this.data.refreshing) {
        wx.showToast({
          title: error.message || '加载失败',
          icon: 'none'
        });
        }
        this.setData({
          pickupOrders: [],
          pickupLoading: false
        });
        throw error;
      }
    } else if (tabIndex === 2) {
      // 待送达
      this.setData({ deliverLoading: true });
      
      try {
        const res = await wx.cloud.callFunction({
          name: 'orderManage',
          data: {
            action: 'getDeliverOrders',
            data: {
              page: 1,
              pageSize: 20
            }
          }
        });
        
        if (res.result && res.result.code === 200) {
          const deliverOrders = res.result.data.list || [];
          this.setData({
            deliverOrders: deliverOrders,
            deliverLoading: false
          });
        } else {
          throw new Error(res.result?.message || '获取订单失败');
        }
      } catch (error) {
        console.error('加载待送达订单失败:', error);
        if (!this.data.refreshing) {
        wx.showToast({
          title: error.message || '加载失败',
          icon: 'none'
        });
        }
        this.setData({
          deliverOrders: [],
          deliverLoading: false
        });
        throw error;
      }
    } else {
      // 其他情况
      this.setData({
        orders: [],
        loading: false,
        pickupOrders: [],
        pickupLoading: false,
        deliverOrders: [],
        deliverLoading: false
      });
    }
  },
  
  // 切换餐品详情展开/收起（待抢单）
  onToggleItems(e) {
    const index = e.currentTarget.dataset.index;
    const orders = this.data.orders;
    orders[index].showItems = !orders[index].showItems;
    this.setData({ orders });
  },
  
  // 切换餐品详情展开/收起（待取货）
  onTogglePickupItems(e) {
    const index = e.currentTarget.dataset.index;
    const pickupOrders = this.data.pickupOrders;
    pickupOrders[index].showItems = !pickupOrders[index].showItems;
    this.setData({ pickupOrders });
  },
  
  // 切换餐品详情展开/收起（待送达）
  onToggleDeliverItems(e) {
    const index = e.currentTarget.dataset.index;
    const deliverOrders = this.data.deliverOrders;
    deliverOrders[index].showItems = !deliverOrders[index].showItems;
    this.setData({ deliverOrders });
  },
  
  // 抢单
  async onGrabOrder(e) {
    // 检查审核状态
    if (!this.data.canGrabOrder) {
      let message = '';
      if (this.data.riderStatus === 'not_registered') {
        message = '您还未注册骑手，请先注册';
      } else if (this.data.riderStatus === 'pending') {
        message = '您的申请正在审核中，审核通过后才能接单';
      } else if (this.data.riderStatus === 'rejected') {
        message = '您的申请未通过审核，请联系管理员';
      } else {
        message = '您暂无接单权限';
      }
      
      wx.showModal({
        title: '无法接单',
        content: message,
        showCancel: false,
        confirmText: '知道了',
        success: (res) => {
          if (this.data.riderStatus === 'not_registered') {
            wx.navigateTo({
              url: '/subpackages/rider/pages/rider-register/index'
            });
          }
        }
      });
      return;
    }

    const orderId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认抢单',
      content: '确定要抢这个订单吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '抢单中...' });
            
            const result = await wx.cloud.callFunction({
              name: 'orderManage',
              data: {
                action: 'grabOrder',
                data: {
                  orderId: orderId
                }
              }
            });
            
            wx.hideLoading();
            
            if (result.result && result.result.code === 200) {
              wx.showToast({
                title: '✅ 抢单成功！',
                icon: 'success',
                duration: 2000
              });
              
              console.log('【骑手端】抢单成功，订单ID:', orderId);
              
              // 延迟刷新订单列表，让用户看到提示
              setTimeout(() => {
                this.loadOrdersByTab(this.data.activeTab);
              }, 500);
            } else {
              wx.showToast({
                title: result.result?.message || '❌ 抢单失败',
                icon: 'none',
                duration: 2000
              });
              console.error('【骑手端】抢单失败:', result.result);
            }
          } catch (error) {
            wx.hideLoading();
            console.error('【骑手端】抢单异常:', error);
            wx.showToast({
              title: '❌ 抢单失败，请重试',
              icon: 'none',
              duration: 2000
            });
          }
        }
      }
    });
  },
  
  // 确认取餐
  async onConfirmPickup(e) {
    const orderId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认取餐',
      content: '确认已从商家处取到餐品？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '确认中...' });
            
            const result = await wx.cloud.callFunction({
              name: 'orderManage',
              data: {
                action: 'confirmPickup',
                data: {
                  orderId: orderId
                }
              }
            });
            
            wx.hideLoading();
            
            if (result.result && result.result.code === 200) {
              wx.showToast({
                title: '✅ 取餐成功！订单已开始配送',
                icon: 'success',
                duration: 2500
              });
              
              console.log('【骑手端】取餐成功，订单ID:', orderId);
              
              // 延迟刷新订单列表，让用户看到提示
              setTimeout(() => {
                this.loadOrdersByTab(this.data.activeTab);
              }, 500);
            } else {
              wx.showToast({
                title: result.result?.message || '❌ 操作失败',
                icon: 'none',
                duration: 2000
              });
              console.error('【骑手端】取餐失败:', result.result);
            }
          } catch (error) {
            wx.hideLoading();
            console.error('【骑手端】取餐异常:', error);
            wx.showToast({
              title: '❌ 操作失败，请重试',
              icon: 'none',
              duration: 2000
            });
          }
        }
      }
    });
  },
  
  // 确认送达
  async onConfirmDelivery(e) {
    const orderId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认送达',
      content: '确认已将餐品送达给用户？',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '确认中...' });
            
            const result = await wx.cloud.callFunction({
              name: 'orderManage',
              data: {
                action: 'confirmDelivery',
                data: {
                  orderId: orderId
                }
              }
            });
            
            wx.hideLoading();
            
            if (result.result && result.result.code === 200) {
              // 显示成功提示
              wx.showToast({
                title: '✅ 送达成功！订单已完成',
                icon: 'success',
                duration: 2000
              });
              
              console.log('【骑手端】送达成功，订单ID:', orderId);
              
              // 延迟刷新订单列表和统计数据
              setTimeout(async () => {
                // 刷新订单列表
                await this.loadOrdersByTab(this.data.activeTab);
                
                // 通知个人中心页面刷新统计数据（如果页面已打开）
                const pages = getCurrentPages();
                const profilePage = pages.find(page => page.route === 'subpackages/rider/pages/rider-profile/index');
                if (profilePage && typeof profilePage.loadTodayStats === 'function') {
                  // 等待一小段时间确保统计数据已更新
                  setTimeout(async () => {
                    await profilePage.loadTodayStats();
                  console.log('【骑手端】已通知个人中心页面刷新统计数据');
                  }, 500);
                }
              
                // 显示统计更新提示
              setTimeout(() => {
                wx.showToast({
                  title: '📊 今日接单+1，收入+2元',
                  icon: 'none',
                  duration: 2000
                });
                }, 1000);
              }, 500);
            } else {
              wx.showToast({
                title: result.result?.message || '❌ 操作失败',
                icon: 'none',
                duration: 2000
              });
              console.error('【骑手端】送达失败:', result.result);
            }
          } catch (error) {
            wx.hideLoading();
            console.error('【骑手端】送达异常:', error);
            wx.showToast({
              title: '❌ 操作失败，请重试',
              icon: 'none',
              duration: 2000
            });
          }
        }
      }
    });
  },

  onAvatarTap() {
    // 跳转到个人中心页面
    wx.navigateTo({
      url: '/subpackages/rider/pages/rider-profile/index',
      fail: (err) => {
        console.error('跳转个人中心失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  onGoRegister() {
    wx.navigateTo({
      url: '/subpackages/rider/pages/rider-register/index'
    });
  },

  onSettingTap() {
    wx.navigateTo({
      url: '/subpackages/rider/pages/rider-settings/index',
      fail: (err) => {
        console.error('跳转到跑单设置页面失败:', err);
    wx.showToast({ 
          title: '跳转失败',
      icon: 'none' 
        });
      }
    });
  },

  onRefresh() {
    wx.showLoading({ title: '刷新中...' });
    
    // 刷新订单数据
    this.loadOrdersByTab(this.data.activeTab);
    
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ 
        title: '刷新完成', 
        icon: 'success',
        duration: 1500
      });
    }, 1000);
  },

  // 下拉刷新
  onPullDownRefresh() {
    console.log('【下拉刷新】开始刷新');
    
    // 设置刷新状态
    this.setData({
      refreshing: true
    });
    
    // 刷新当前标签页的订单数据
    this.loadOrdersByTab(this.data.activeTab).then(() => {
      // 刷新完成，停止下拉刷新动画
      setTimeout(() => {
        this.setData({
          refreshing: false
        });
        wx.showToast({
          title: '刷新完成',
          icon: 'success',
          duration: 1500
        });
      }, 500);
    }).catch((error) => {
      console.error('【下拉刷新】刷新失败:', error);
      this.setData({
        refreshing: false
      });
      wx.showToast({
        title: '刷新失败',
        icon: 'none',
        duration: 1500
      });
    });
  }
});


