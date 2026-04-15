const log = require('../../../../utils/logger.js');
const { normalizeHomeCampus, STORAGE_KEY, CAMPUS_BAISHA } = require('../../../../utils/homeCampusStorage');

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
    canGrabOrder: false, // 是否可以接单
    grabbingOrderId: null,
    pickupOrderId: null,
    deliveringOrderId: null,
    watchOrder: null,
    pollingTimer: null,
    reconnectCount: 0,
    watchConnected: false,
    pollingActive: false,
    lastRefreshTime: 0,
    lastScrollTime: 0,
    scrollTop: 0,
    loadError: false,
    errorMessage: ''
  },

  onLoad() {
    try {
      const c = normalizeHomeCampus(wx.getStorageSync(STORAGE_KEY));
      if (c) this._riderCampusForApi = c;
    } catch (e) {}
    this.loadRiderStatus();
    this.loadOrdersByTab(this.data.activeTab);
    this.startOrderWatch();
  },

  /** 与首页 homeCurrentCampus 一致，供待抢单/抢单云函数校区隔离 */
  getRiderCampusForApi() {
    try {
      const s = normalizeHomeCampus(wx.getStorageSync(STORAGE_KEY));
      if (s) return s;
    } catch (e) {}
    return this._riderCampusForApi || CAMPUS_BAISHA;
  },

  onShow() {
    try {
      const c = normalizeHomeCampus(wx.getStorageSync(STORAGE_KEY));
      if (c) this._riderCampusForApi = c;
    } catch (e) {}
    this.loadRiderStatus();
    const now = Date.now();
    if (!this._ordersLastLoadTime || now - this._ordersLastLoadTime > 60000) {
      this.loadOrdersByTab(this.data.activeTab);
    }
    this.startOrderWatch();
    setTimeout(() => {
      if (!this.data.watchConnected && !this.data.pollingActive) {
        log.log('【骑手接单大厅】Watch未连接，启动轮询兜底');
        this.startPolling();
      }
    }, 2000);
  },

  onHide() {
    log.log('【骑手接单大厅】页面隐藏，停止监听和轮询');
    this.stopOrderWatch();
    this.stopPolling();
    this._clearTimers();
  },

  onUnload() {
    log.log('【骑手接单大厅】页面卸载，停止监听和轮询');
    this.stopOrderWatch();
    this.stopPolling();
    this._clearTimers();
  },

  _clearTimers() {
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._scrollTimer) {
      clearTimeout(this._scrollTimer);
      this._scrollTimer = null;
    }
  },

  startOrderWatch() {
    this.stopOrderWatch();
    this.stopPolling();
    this.setData({ reconnectCount: 0 });
    try {
      log.log('【骑手接单大厅】启动订单实时监听');
      const db = wx.cloud.database();
      wx.cloud.callFunction({ name: 'loginUser', data: {} }).then(res => {
        const data = res.result?.data;
        const openid = data?.userInfo?.openid || res.result?.openid || (wx.getStorageSync('userInfo') && wx.getStorageSync('userInfo').openid);
        if (!openid) {
          log.warn('【骑手接单大厅】无法启动Watch：缺少openid，降级到轮询');
          this.startPolling();
          return;
        }
        const _ = db.command;
        const whereCondition = _.or([
          {
            orderStatus: _.in(['ready', 'confirmed']),
            riderOpenid: _.exists(false),
            payStatus: 'paid'
          },
          { riderOpenid: openid }
        ]);
        this.data.watchOrder = db.collection('orders')
          .where(whereCondition)
          .watch({
            onChange: (snapshot) => {
              if (!this.data.watchConnected) {
                this.setData({ watchConnected: true });
                log.log('【骑手接单大厅】Watch连接成功');
                this.stopPolling();
              }
              if (snapshot.docChanges && snapshot.docChanges.length > 0) {
                this.handleOrderChange();
              }
            },
            onError: (err) => {
              log.error('【骑手接单大厅】Watch错误:', err);
              this.handleWatchError(err);
            }
          });
        log.log('【骑手接单大厅】Watch已启动');
      }).catch(err => {
        log.error('【骑手接单大厅】获取openid失败:', err);
        this.startPolling();
      });
    } catch (error) {
      log.error('【骑手接单大厅】启动Watch失败:', error);
      this.startPolling();
    }
  },

  handleOrderChange() {
    const now = Date.now();
    if (now - this.data.lastRefreshTime < 1000) return;
    if (this.data.loading || this.data.pickupLoading || this.data.deliverLoading) return;
    const timeSinceScroll = now - (this.data.lastScrollTime || 0);
    if (timeSinceScroll < 3000) {
      if (this._refreshTimer) clearTimeout(this._refreshTimer);
      this._refreshTimer = setTimeout(() => this.handleOrderChange(), 3000 - timeSinceScroll + 2000);
      return;
    }
    if (this.data.scrollTop > 100) {
      if (this._refreshTimer) clearTimeout(this._refreshTimer);
      this._refreshTimer = setTimeout(() => {
        if (Date.now() - (this.data.lastScrollTime || 0) >= 3000) this.handleOrderChange();
      }, 3000);
      return;
    }
    this.setData({ lastRefreshTime: now });
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => {
      if (!this.data.loading && !this.data.pickupLoading && !this.data.deliverLoading) {
        this.loadOrdersByTab(this.data.activeTab);
      }
    }, 500);
  },

  handleWatchError(err) {
    this.setData({ watchConnected: false });
    const reconnectCount = this.data.reconnectCount || 0;
    const maxReconnect = 3;
    if (reconnectCount >= maxReconnect) {
      log.warn('【骑手接单大厅】Watch重连达上限，降级到轮询');
      this.startPolling();
      return;
    }
    const intervals = [2000, 5000, 8000];
    const delay = intervals[reconnectCount] || 8000;
    this.setData({ reconnectCount: reconnectCount + 1 });
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => this.startOrderWatch(), delay);
  },

  startPolling() {
    if (this.data.pollingActive) return;
    log.log('【骑手接单大厅】启动轮询兜底');
    this.setData({ pollingActive: true });
    this.pollOrders();
    const timerId = setInterval(() => this.pollOrders(), 12000);
    this.setData({ pollingTimer: timerId });
  },

  stopPolling() {
    const id = this.data.pollingTimer;
    if (id) {
      clearInterval(id);
      this.setData({ pollingTimer: null });
    }
    this.setData({ pollingActive: false });
  },

  pollOrders() {
    const { activeTab, pickupOrders, deliverOrders } = this.data;
    const hasActive = (activeTab === 0) || (pickupOrders && pickupOrders.length > 0) || (deliverOrders && deliverOrders.length > 0);
    if (!hasActive) {
      this.stopPolling();
      return;
    }
    const now = Date.now();
    if (now - (this.data.lastScrollTime || 0) < 3000) return;
    if (this.data.scrollTop > 100) return;
    if (!this.data.loading && !this.data.pickupLoading && !this.data.deliverLoading) {
      this.loadOrdersByTab(this.data.activeTab);
    }
  },

  stopOrderWatch() {
    if (this.data.watchOrder) {
      try {
        this.data.watchOrder.close();
      } catch (error) {
        log.error('【骑手接单大厅】停止Watch失败:', error);
      }
      this.data.watchOrder = null;
    }
    this.setData({ watchConnected: false });
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  },

  onScroll(e) {
    const now = Date.now();
    const scrollTop = e.detail.scrollTop || 0;
    this.setData({ lastScrollTime: now, scrollTop });
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
    this.setData({ activeTab: index, loadError: false });
    
    // 切换标签时可以根据不同标签加载不同的订单数据
    this.loadOrdersByTab(index);
  },

  onRetryLoad() {
    this.setData({ loadError: false });
    this.loadOrdersByTab(this.data.activeTab);
  },

  // 根据标签加载订单
  async loadOrdersByTab(tabIndex) {
    if (tabIndex === 0) {
      // 待抢单
      this.setData({ loading: true });
      
      try {
        const campus = this.getRiderCampusForApi();
        const res = await wx.cloud.callFunction({
          name: 'orderManage',
          data: {
            action: 'getAvailableOrders',
            data: {
              page: 1,
              pageSize: 20,
              campus
            }
          }
        });
        
        if (res.result && res.result.code === 200) {
          const orders = res.result.data.list || [];
          this._ordersLastLoadTime = Date.now();
          this.setData({
            orders: orders,
            loading: false,
            loadError: false
          });
        } else {
          throw new Error(res.result?.message || '获取订单失败');
        }
      } catch (error) {
        console.error('加载订单失败:', error);
        if (!this.data.refreshing) {
          this.setData({ loadError: true, errorMessage: error.message || '加载失败' });
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
          this._ordersLastLoadTime = Date.now();
          this.setData({
            pickupOrders: pickupOrders,
            pickupLoading: false,
            loadError: false
          });
        } else {
          throw new Error(res.result?.message || '获取订单失败');
        }
      } catch (error) {
        console.error('加载待取货订单失败:', error);
        if (!this.data.refreshing) {
          this.setData({ loadError: true, errorMessage: error.message || '加载失败' });
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
          this._ordersLastLoadTime = Date.now();
          this.setData({
            deliverOrders: deliverOrders,
            deliverLoading: false,
            loadError: false
          });
        } else {
          throw new Error(res.result?.message || '获取订单失败');
        }
      } catch (error) {
        console.error('加载待送达订单失败:', error);
        if (!this.data.refreshing) {
          this.setData({ loadError: true, errorMessage: error.message || '加载失败' });
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
          if (this.data.grabbingOrderId) return;
          this.setData({ grabbingOrderId: orderId });
          try {
            wx.showLoading({ title: '抢单中...' });
            
            const result = await wx.cloud.callFunction({
              name: 'orderManage',
              data: {
                action: 'grabOrder',
                data: {
                  orderId: orderId,
                  campus: this.getRiderCampusForApi()
                }
              }
            });
            
            wx.hideLoading();
            this.setData({ grabbingOrderId: null });
            
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
              const msg = result.result?.message || '❌ 抢单失败';
              const isCampusRequired = result.result?.code === 403 && (msg.indexOf('校园兼职') !== -1 || msg.indexOf('保证金') !== -1);
              if (isCampusRequired) {
                this.setData({ grabbingOrderId: null });
                wx.showModal({
                  title: '无法抢单',
                  content: msg,
                  confirmText: '去开通',
                  success: (r) => {
                    if (r.confirm) {
                      wx.navigateTo({ url: '/subpackages/common/pages/campus-partner/index' });
                    }
                  }
                });
              } else {
                wx.showToast({ title: msg, icon: 'none', duration: 2000 });
              }
              this.setData({ grabbingOrderId: null });
              console.error('【骑手端】抢单失败:', result.result);
            }
          } catch (error) {
            wx.hideLoading();
            this.setData({ grabbingOrderId: null });
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
          if (this.data.pickupOrderId) return;
          this.setData({ pickupOrderId: orderId });
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
            this.setData({ pickupOrderId: null });
            
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
              this.setData({ pickupOrderId: null });
              wx.showToast({
                title: result.result?.message || '❌ 操作失败',
                icon: 'none',
                duration: 2000
              });
              console.error('【骑手端】取餐失败:', result.result);
            }
          } catch (error) {
            wx.hideLoading();
            this.setData({ pickupOrderId: null });
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
          if (this.data.deliveringOrderId) return;
          this.setData({ deliveringOrderId: orderId });
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
            this.setData({ deliveringOrderId: null });
            
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
                  title: '📊 今日接单+1，收入按楼层结算',
                  icon: 'none',
                  duration: 2000
                });
                }, 1000);
              }, 500);
            } else {
              this.setData({ deliveringOrderId: null });
              wx.showToast({
                title: result.result?.message || '❌ 操作失败',
                icon: 'none',
                duration: 2000
              });
              console.error('【骑手端】送达失败:', result.result);
            }
          } catch (error) {
            wx.hideLoading();
            this.setData({ deliveringOrderId: null });
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

  // 联系顾客
  onContactCustomer(e) {
    const phone = (e.currentTarget.dataset.phone || '').trim();
    const customerName = e.currentTarget.dataset.name || '顾客';
    if (!phone) {
      wx.showToast({
        title: '未获取到顾客电话',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '联系顾客',
      content: `是否拨打${customerName}电话：${phone}`,
      confirmText: '拨打',
      success: (res) => {
        if (!res.confirm) return;
        wx.makePhoneCall({
          phoneNumber: phone,
          fail: () => {
            wx.showToast({
              title: '拨号失败，请稍后重试',
              icon: 'none'
            });
          }
        });
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


