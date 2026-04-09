const log = require('../../../../utils/logger.js');
const subscribeMessage = require('../../../../utils/subscribeMessage.js');

const CACHE_KEY_ORDERS = 'order_list_cache';
const CACHE_EXPIRE_TIME = 5 * 60 * 1000; // 5分钟缓存过期

// 带超时的云函数调用
function callFunctionWithTimeout(options, timeout = 10000) {
  return Promise.race([
    wx.cloud.callFunction(options),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('请求超时')), timeout);
    })
  ]);
}

// 带重试的云函数调用
async function callFunctionWithRetry(options, maxRetries = 2, timeout = 10000) {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await callFunctionWithTimeout(options, timeout);
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }
  throw lastError;
}

Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    orders: [],
    allOrders: [], // 存储所有订单
    filteredOrders: [], // 过滤后的订单
    loading: false, // 初始状态为false，允许首次加载
    refreshing: false, // 下拉刷新状态
    selectedCategory: 'all', // 当前选中的分类
    categories: [
      { id: 'all', name: '全部订单', icon: '✓' },
      { id: 'express', name: '代拿快递', icon: '📦' },
      { id: 'gaming', name: '游戏陪玩', icon: '🎮' },
      { id: 'reward', name: '跑腿', icon: '💰' }
    ],
    watchOrder: null,        // watch监听器
    pollingTimer: null,       // 轮询定时器（仅 id 存 data 便于清理）
    reconnectCount: 0,       // 重连次数
    watchConnected: false,   // watch是否连接
    pollingActive: false,    // 是否在轮询
    lastRefreshTime: 0,      // 上次刷新时间
    lastScrollTime: 0,       // 上次滚动时间
    isScrolling: false,      // 是否正在滚动
    scrollTop: 0,            // 当前滚动位置
    highlightOrderId: null,  // 支付成功跳转时高亮的订单 ID
    orderPage: 1,           // 当前已加载到第几页（用于分页）
    orderPageSize: 20,       // 每页条数
    hasMoreOrders: true,    // 是否还有更多订单
    payingOrderId: null,    // 支付防重复
    loadError: false,
    errorMessage: ''
  },

  onLoad(options) {
    log.log('【用户订单页面】页面加载', options);
    this._loadOptions = options || {};
    const fromPay = this._loadOptions.from === 'pay';
    const orderId = this._loadOptions.orderId ? decodeURIComponent(this._loadOptions.orderId) : '';
    if (fromPay && orderId) {
      this.setData({ highlightOrderId: orderId });
      setTimeout(() => this.setData({ highlightOrderId: null }), 4000);
    }
    
    // 优先加载订单数据
    this.loadOrders();
    
    // 延迟执行非关键操作
    setTimeout(() => {
      subscribeMessage.preloadOrderStatusTemplateId();
      this.startOrderWatch();
    }, 500);
  },

  onShow() {
    log.log('【用户订单页面】页面显示');
    const opts = this._loadOptions || {};
    if (opts.from === 'pay' && opts.orderId && !this._payToastShown) {
      this._payToastShown = true;
      wx.showToast({ title: '订单已更新，可在列表中查看', icon: 'none', duration: 2000 });
    }
    
    // 防重：仅无数据或超过 60s 时拉取
    const now = Date.now();
    if (!this._ordersLastLoadTime || now - this._ordersLastLoadTime > 60000 || this.data.orders.length === 0) {
      this.loadOrders();
    }
    
    // 延迟启动订单监听，避免与订单加载冲突
    setTimeout(() => {
      this.startOrderWatch();
      setTimeout(() => {
        if (!this.data.watchConnected && !this.data.pollingActive) {
          log.log('【用户订单页面】Watch未连接，启动轮询保障');
          this.startPolling();
        }
      }, 1000);
    }, 300);
  },

  onHide() {
    log.log('【用户订单页面】页面隐藏，停止订单监听和轮询');
    this.stopOrderWatch();
    this.stopPolling();
    this._clearTimers();
  },

  onUnload() {
    log.log('【用户订单页面】页面卸载，停止订单监听和轮询');
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

  // 启动订单实时监听
  startOrderWatch() {
    // 先停止之前的监听和轮询
    this.stopOrderWatch();
    this.stopPolling();
    
    // 重置重连次数
    this.setData({ reconnectCount: 0 });
    
    try {
      log.log('【用户订单页面】启动订单实时监听');
      const db = wx.cloud.database();
      wx.cloud.callFunction({ name: 'loginUser', data: {} }).then(res => {
        const data = res.result?.data;
        const openid = data?.userInfo?.openid || res.result?.openid || (wx.getStorageSync('userInfo') && wx.getStorageSync('userInfo').openid);
        if (!openid) {
          log.warn('【用户订单页面】无法启动订单监听：缺少openid，降级到轮询');
          this.startPolling();
          return;
        }
        // 确保watchOrder为null
        this.data.watchOrder = null;
        try {
          this.data.watchOrder = db.collection('orders')
            .where({ userOpenid: openid })
            .watch({
              onChange: (snapshot) => {
                if (!this.data.watchConnected) {
                  this.setData({ watchConnected: true });
                  log.log('【用户订单页面】Watch连接成功');
                  this.stopPolling();
                }
                if (snapshot.docChanges && snapshot.docChanges.length > 0) {
                  this.handleOrderChange();
                }
              },
              onError: (err) => {
                log.error('【用户订单页面】订单监听错误:', err);
                // 忽略已关闭状态的错误
                if (!err.message || !err.message.includes('CLOSED')) {
                  // 检查是否是网络错误
                  if (err.message && (err.message.includes('realtime listener reconnect ws fail') || err.message.includes('Failed to fetch'))) {
                    log.warn('【用户订单页面】网络错误，降级到轮询');
                    this.startPolling();
                  } else {
                    this.handleWatchError(err);
                  }
                }
              }
            });
          log.log('【用户订单页面】Watch监听已启动');
        } catch (watchError) {
          log.error('【用户订单页面】创建监听实例失败:', watchError);
          this.startPolling();
        }
      }).catch(err => {
        log.error('【用户订单页面】获取openid失败:', err);
        this.startPolling();
      });
    } catch (error) {
      log.error('【用户订单页面】启动订单监听失败:', error);
      this.startPolling();
    }
  },

  handleOrderChange() {
    const now = Date.now();
    if (now - this.data.lastRefreshTime < 1000) return;
    if (this.data.loading) return;
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
      if (!this.data.loading) this.loadOrders();
    }, 500);
  },

  handleWatchError(err) {
    // 忽略已关闭状态的错误
    if (err.message && err.message.includes('CLOSED')) {
      log.warn('【用户订单页面】忽略已关闭状态的错误');
      return;
    }
    
    // 检查是否是网络错误
    if (err.message && (err.message.includes('realtime listener reconnect ws fail') || err.message.includes('Failed to fetch'))) {
      log.warn('【用户订单页面】网络错误，直接降级到轮询');
      this.startPolling();
      return;
    }
    
    this.setData({ watchConnected: false });
    const reconnectCount = this.data.reconnectCount || 0;
    const maxReconnect = 3;
    if (reconnectCount >= maxReconnect) {
      log.warn('【用户订单页面】Watch重连次数已达上限，降级到轮询');
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
    log.log('【用户订单页面】启动智能轮询');
    this.setData({ pollingActive: true });
    // 延迟执行第一次轮询，避免与页面初始化冲突
    this._pollTimeout = setTimeout(() => this.pollOrders(), 3000);
    const timerId = setInterval(() => this.pollOrders(), this.getPollingInterval());
    this.setData({ pollingTimer: timerId });
  },

  stopPolling() {
    const id = this.data.pollingTimer;
    if (id) {
      clearInterval(id);
      this.setData({ pollingTimer: null });
    }
    if (this._pollTimeout) {
      clearTimeout(this._pollTimeout);
      this._pollTimeout = null;
    }
    this.setData({ pollingActive: false });
  },

  pollOrders() {
    // 检查是否有活跃订单
    const hasActiveOrders = this.data.allOrders.some(order => {
      const s = order.orderStatus;
      return s === 'pending' || s === 'confirmed' || s === 'preparing' || s === 'delivering';
    });
    if (!hasActiveOrders) {
      this.stopPolling();
      return;
    }
    
    // 检查网络状况
    wx.getNetworkType({
      success: (res) => {
        const networkType = res.networkType;
        if (networkType === 'none') {
          // 无网络，暂停轮询
          log.warn('【用户订单页面】网络断开，暂停轮询');
          return;
        }
        
        // 节流：避免短时间内多次轮询
        const now = Date.now();
        if (now - (this.data.lastRefreshTime || 0) < 8000) return; // 增加节流时间
        if (now - (this.data.lastScrollTime || 0) < 3000) return;
        if (this.data.scrollTop > 100) return;
        if (!this.data.loading) {
          this.setData({ lastRefreshTime: now });
          // 只更新活跃订单，减少数据传输
          this.loadActiveOrders();
        }
      }
    });
  },

  getPollingInterval() {
    // 动态调整轮询间隔，根据订单状态和网络状况
    const hasActiveOrders = this.data.allOrders.some(order => {
      const s = order.orderStatus;
      return s === 'pending' || s === 'confirmed' || s === 'preparing' || s === 'delivering';
    });
    
    // 默认间隔
    let interval = hasActiveOrders ? 10000 : 30000; // 活跃订单10秒，否则30秒
    
    // 检查网络状况，调整间隔
    wx.getNetworkType({
      success: (res) => {
        const networkType = res.networkType;
        switch (networkType) {
          case '2g':
            interval *= 2; // 2G网络，间隔加倍
            break;
          case '3g':
            interval *= 1.5; // 3G网络，间隔增加50%
            break;
          case '4g':
          case '5g':
          case 'wifi':
            // 高速网络，使用默认间隔
            break;
          default:
            // 未知网络，使用默认间隔
            break;
        }
      }
    });
    
    return interval;
  },

  // 只加载活跃订单，减少数据传输
  async loadActiveOrders() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getActiveOrders',
          data: {}
        }
      });

      if (res.result && res.result.code === 200) {
        const activeOrders = res.result.data?.list || [];
        if (activeOrders.length > 0) {
          // 更新本地订单数据
          const updatedOrders = this.data.allOrders.map(order => {
            const activeOrder = activeOrders.find(ao => ao._id === order.id);
            return activeOrder ? {
              ...order,
              status: this.getStatusText(activeOrder.orderStatus, activeOrder.riderOpenid, activeOrder.payStatus || 'unpaid'),
              statusClass: this.getStatusClass(activeOrder.orderStatus),
              statusBadgeClass: this.getStatusBadgeClass(activeOrder.orderStatus, activeOrder.payStatus || 'unpaid'),
              orderStatus: activeOrder.orderStatus,
              payStatus: activeOrder.payStatus || 'unpaid'
            } : order;
          });

          this.setData({
            orders: updatedOrders,
            allOrders: updatedOrders,
            filteredOrders: this._filterByCategory(updatedOrders, this.data.selectedCategory)
          });
        }
      }
    } catch (error) {
      log.error('【用户订单页面】加载活跃订单失败:', error);
    }
  },

  onScroll(e) {
    const now = Date.now();
    const scrollTop = e.detail.scrollTop || 0;
    this.setData({ lastScrollTime: now, scrollTop, isScrolling: true });
    if (this._scrollTimer) clearTimeout(this._scrollTimer);
    this._scrollTimer = setTimeout(() => this.setData({ isScrolling: false }), 3000);
  },

  stopOrderWatch() {
    if (this.data.watchOrder) {
      try {
        this.data.watchOrder.close();
      } catch (error) {
        // 忽略关闭已关闭实例的错误
        if (!error.message || !error.message.includes('CLOSED')) {
          log.error('【用户订单页面】停止订单监听失败:', error);
        }
      }
      this.data.watchOrder = null;
    }
    this.setData({ watchConnected: false });
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  },

  onPullDownRefresh() {
    // 设置刷新状态
    this.setData({ refreshing: true });
    
    // 下拉刷新时不显示loading，使用下拉刷新的原生动画
    this.loadOrders(true).finally(() => {
      // 停止刷新动画
      this.setData({ refreshing: false });
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      });
    });
  },

  onReachBottom() {
    if (!this.data.loading && this.data.hasMoreOrders) {
      this.loadOrders(false, true);
    }
  },

  // 加载订单列表（isPullRefresh 下拉刷新，isLoadMore 上拉加载更多）
  async loadOrders(isPullRefresh = false, isLoadMore = false) {
    if (this.data.loading) return Promise.resolve();

    const pageSize = this.data.orderPageSize || 20;
    const page = isLoadMore ? this.data.orderPage : 1;

    // 检查缓存
    if (!isPullRefresh && !isLoadMore) {
      const cachedData = this.getOrderCache();
      if (cachedData) {
        this.setData({
          orders: cachedData.allOrders,
          allOrders: cachedData.allOrders,
          filteredOrders: cachedData.filteredOrders,
          orderPage: cachedData.orderPage,
          hasMoreOrders: cachedData.hasMoreOrders,
          loading: false,
          loadError: false
        });
        this._ordersLastLoadTime = Date.now();
        // 异步更新缓存数据
        this.updateOrderCacheAsync();
        return Promise.resolve();
      }
    }

    this.setData({ loading: true });

    try {
      if (!isPullRefresh && !isLoadMore) {
        wx.showLoading({ title: '加载中...' });
      }

      const res = await callFunctionWithRetry({
        name: 'orderManage',
        data: {
          action: 'getOrderList',
          data: {
            page: page,
            pageSize: pageSize
          }
        }
      }, 2, 15000);

      if (!isPullRefresh && !isLoadMore) wx.hideLoading();

      if (res.result && res.result.code === 200) {
        const orderList = res.result.data?.list || [];
        const total = res.result.data?.total ?? 0;

        if (!Array.isArray(orderList)) {
          log.error('【用户订单页面】订单列表格式错误:', orderList);
          wx.showToast({ title: '订单数据格式错误', icon: 'none' });
          this.setData({ loading: false });
          return;
        }

        let refundsMap = {};
        if (!isLoadMore) {
          try {
            const refundRes = await callFunctionWithRetry({
              name: 'refundManage',
              data: {
                action: 'getRefundList',
                data: { page: 1, pageSize: 100 }
              }
            }, 1, 10000);
            if (refundRes.result && refundRes.result.code === 200) {
              const refundList = refundRes.result.data?.list || [];
              refundList.forEach(refund => {
                if (refund.orderId && !refundsMap[refund.orderId]) {
                  refundsMap[refund.orderId] = {
                    status: refund.status,
                    refundAmount: refund.refundAmount,
                    refundNo: refund.refundNo,
                    remark: refund.remark || '',
                    createdAt: refund.createdAt
                  };
                }
              });
            }
          } catch (error) {
            log.error('【用户订单页面】查询退款信息失败:', error);
          }
        }

        const newOrders = orderList.map(order => {
          // 处理订单商品列表 - 兼容普通订单、代拿快递订单、游戏陪玩订单和悬赏订单
          let orderItems = [];
          
          if (order.orderType === 'express') {
            // 代拿快递订单，使用 packageSizes
            if (order.packageSizes && Array.isArray(order.packageSizes)) {
              orderItems = order.packageSizes.map(pkg => ({
                name: `${pkg.name}(${pkg.description}) x${pkg.quantity}`,
                spec: '',
                quantity: pkg.quantity
              }));
            }
          } else if (order.orderType === 'gaming') {
            // 游戏陪玩订单，显示游戏信息
            const requirements = order.selectedRequirements && order.selectedRequirements.length > 0 
              ? order.selectedRequirements.join('、') 
              : (order.requirements || '');
            orderItems = [{
              name: `${order.gameType} - ${order.sessionDuration}小时`,
              spec: requirements ? `要求：${requirements}` : '',
              quantity: 1
            }];
          } else if (order.orderType === 'reward') {
            // 悬赏订单，显示悬赏信息
            orderItems = [{
              name: `${order.category || '跑腿任务'}`,
              spec: order.helpContent ? `内容：${order.helpContent}` : '',
              quantity: 1
            }];
          } else {
            // 普通订单，使用 items
            if (order.items && Array.isArray(order.items)) {
              orderItems = order.items.map(item => ({
                productId: item.productId, // 保存商品ID，用于再来一单
                productName: item.productName || item.name || '商品',
                name: `${item.productName || item.name || '商品'}${item.spec ? '(' + item.spec + ')' : ''} x${item.quantity || 1}`,
                spec: item.spec || '',
                quantity: item.quantity || 1,
                price: item.price ? (item.price >= 100 ? item.price / 100 : item.price) : 0, // 价格从分转换为元
                image: item.image || ''
              }));
            }
          }

          // 确定店铺名称
          let storeName = order.storeName;
          if (!storeName) {
            if (order.orderType === 'express') {
              storeName = '代拿快递';
            } else if (order.orderType === 'gaming') {
              storeName = '游戏陪玩';
            } else if (order.orderType === 'reward') {
              storeName = '跑腿';
            } else {
              storeName = '商家订单';
            }
          }

          // 计算预计到达时间范围（配置值 ~ 配置值+15分钟）
          let estimatedDeliveryTimeRange = null;
          if (order.estimatedDeliveryMinutes) {
            const minMinutes = order.estimatedDeliveryMinutes;
            const maxMinutes = minMinutes + 15;
            estimatedDeliveryTimeRange = `${minMinutes}~${maxMinutes}分钟`;
          }

          // 获取退款信息
          const refundInfo = refundsMap[order._id];
          let refundStatus = null;
          let refundStatusText = '';
          let refundStatusClass = '';
          
          if (refundInfo) {
            const status = refundInfo.status;
            if (status === 'pending' || status === 'processing') {
              refundStatus = 'pending';
              refundStatusText = '待退款';
              refundStatusClass = 'refund-pending';
            } else if (status === 'approved' || status === 'completed') {
              refundStatus = 'success';
              refundStatusText = '退款成功';
              refundStatusClass = 'refund-success';
            } else if (status === 'rejected') {
              refundStatus = 'rejected';
              refundStatusText = '商家拒绝退款';
              refundStatusClass = 'refund-rejected';
            }
          }
          
          return {
            id: order._id,
            orderNo: order.orderNo,
            storeId: order.storeId, // 保存店铺ID，用于再来一单
            storeName: storeName,
            orderType: order.orderType || 'normal', // 订单类型
            date: this.formatDate(order.createdAt),
            status: this.getStatusText(order.orderStatus, order.riderOpenid, order.payStatus || 'unpaid'),
            statusClass: this.getStatusClass(order.orderStatus),
            statusBadgeClass: this.getStatusBadgeClass(order.orderStatus, order.payStatus || 'unpaid'),
            orderStatus: order.orderStatus,
            payStatus: order.payStatus || 'unpaid', // 保存支付状态
            img: order.items && order.items[0] ? order.items[0].image : (order.images && order.images[0] ? order.images[0] : ''),
            total: this.formatAmount(order.amountPayable || order.amountTotal || '0.00'),
            amountGoods: this.formatAmount(order.amountGoods || '0.00'),
            amountDelivery: this.formatAmount(order.amountDelivery || '0.00'),
            platformFee: this.formatAmount(order.platformFee || '0.00'),
            expiredAt: order.expiredAt || null,
            expiredMinutes: order.expiredMinutes || null,
            readyAt: order.readyAt || null,
            completedAt: order.completedAt || null, // 订单完成时间
            canRefund: this.canRefund(order.orderStatus, order.completedAt, order.riderOpenid), // 骑手未取餐前可退
            estimatedDeliveryTime: order.estimatedDeliveryTime || null,
            estimatedDeliveryTimeRange: estimatedDeliveryTimeRange, // 预计到达时间范围
            items: orderItems,
            displayItems: orderItems.slice(0, 2), // 列表最多展示 2 行
            itemsLength: orderItems.length,
            rawItems: order.items || [], // 保存原始商品数据，用于再来一单
            address: order.address ? {
              fullAddress: `${order.address.buildingName || ''}${order.address.houseNumber || ''}${order.address.addressDetail || ''}`,
              name: order.address.name,
              phone: order.address.phone
            } : null,
            // 代拿快递订单特有信息
            pickupLocation: order.pickupLocation || null,
            deliveryLocation: order.deliveryLocation || null,
            pickupCode: order.pickupCode || null,
            // 游戏陪玩订单特有信息
            gameType: order.gameType || null,
            sessionDuration: order.sessionDuration || null,
            requirements: order.requirements || null,
            // 悬赏订单特有信息
            helpLocation: order.helpLocation || null,
            helpContent: order.helpContent || null,
            category: order.category || null,
            // 退款信息
            refundStatus: refundStatus,
            refundStatusText: refundStatusText,
            refundStatusClass: refundStatusClass,
            refundInfo: refundInfo || null
          };
        });

        const allOrders = isLoadMore
          ? [...(this.data.allOrders || []), ...newOrders]
          : newOrders;
        const filteredOrders = this._filterByCategory(allOrders, this.data.selectedCategory);
        const hasMoreOrders = (page * pageSize) < total;

        // 合并setData调用，减少渲染次数
        this.setData({
          orders: allOrders,
          allOrders: allOrders,
          filteredOrders,
          orderPage: page + 1,
          hasMoreOrders,
          loading: false,
          loadError: false
        });
        
        if (!isLoadMore) {
          this._ordersLastLoadTime = Date.now();
          // 保存缓存
          this.setOrderCache({
            allOrders,
            filteredOrders,
            orderPage: page + 1,
            hasMoreOrders
          });
        }
      } else {
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      }

    } catch (error) {
      if (!isPullRefresh) {
        wx.hideLoading();
      }
      log.error('【用户订单页面】加载异常:', error);
      if (!isLoadMore) {
        this.setData({ loadError: true, errorMessage: error.message || '加载失败' });
      } else {
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
      this.setData({ loading: false });
    }
  },

  // 获取订单缓存
  getOrderCache() {
    try {
      const cache = wx.getStorageSync(CACHE_KEY_ORDERS);
      if (cache && (Date.now() - cache.timestamp) < CACHE_EXPIRE_TIME) {
        return cache.data;
      }
    } catch (error) {
      log.error('【用户订单页面】获取缓存失败:', error);
    }
    return null;
  },

  // 设置订单缓存
  setOrderCache(data) {
    try {
      wx.setStorageSync(CACHE_KEY_ORDERS, {
        data,
        timestamp: Date.now()
      });
    } catch (error) {
      log.error('【用户订单页面】设置缓存失败:', error);
    }
  },

  // 异步更新缓存
  async updateOrderCacheAsync() {
    try {
      await this.loadOrders(true, false);
    } catch (error) {
      log.error('【用户订单页面】异步更新缓存失败:', error);
    }
  },

  onRetryLoad() {
    this.setData({ loadError: false });
    this.loadOrders();
  },

  _filterByCategory(allOrders, selectedCategory) {
    if (!allOrders || !allOrders.length) return [];
    if (selectedCategory === 'all') return allOrders;
    
    // 使用单个遍历替代多个filter操作，减少计算开销
    return allOrders.filter(order => {
      if (selectedCategory === 'express') {
        return order.orderType === 'express';
      } else if (selectedCategory === 'gaming') {
        return order.orderType === 'gaming' || (order.storeName && order.storeName.includes('游戏'));
      } else if (selectedCategory === 'reward') {
        return order.orderType === 'reward' || (order.storeName && order.storeName.includes('跑腿'));
      }
      return true;
    });
  },

  filterOrdersByCategory() {
    const filtered = this._filterByCategory(this.data.allOrders, this.data.selectedCategory);
    this.setData({ filteredOrders: filtered });
  },

  // 切换分类
  onCategoryTap(e) {
    const categoryId = e.currentTarget.dataset.id;
    if (categoryId === this.data.selectedCategory) {
      return; // 如果点击的是当前选中的分类，不做处理
    }
    
    this.setData({
      selectedCategory: categoryId
    });
    
    // 过滤订单
    this.filterOrdersByCategory();
  },

  // 格式化金额（确保是字符串格式）
  formatAmount(amount) {
    if (typeof amount === 'number') {
      return amount.toFixed(2);
    }
    if (typeof amount === 'string') {
      const num = parseFloat(amount);
      if (isNaN(num)) {
        return '0.00';
      }
      return num.toFixed(2);
    }
    return '0.00';
  },

  // 格式化日期为中国时间（UTC+8）
  formatDate(date) {
    if (!date) return '';
    
    // 如果已经是格式化好的字符串（格式：YYYY-MM-DD HH:mm 或 YYYY-MM-DD HH:mm:ss），且没有时区信息
    // 说明云函数已经转换为中国时间了，直接提取日期部分并转换格式
    if (typeof date === 'string') {
      const formattedPattern = /^(\d{4})-(\d{2})-(\d{2})( \d{2}:\d{2}(:\d{2})?)?$/;
      const match = date.match(formattedPattern);
      if (match && !date.includes('T') && !date.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(date)) {
        // 已经是格式化好的中国时间，提取日期部分并转换格式
        const year = match[1];
        const month = match[2];
        const day = match[3];
        return `${year}.${month}.${day}`;
      }
    }
    
    let d;
    
    // 处理服务器日期对象（有getTime方法）
    if (date && typeof date === 'object' && date.getTime && typeof date.getTime === 'function') {
      d = new Date(date.getTime());
    } else if (date && typeof date === 'object' && date.getFullYear) {
      d = date;
    } else if (typeof date === 'string') {
      // 处理字符串日期
      let dateStr = date;
      // 兼容 "2025-11-01 07:32" 格式，转换为 ISO 格式
      if (dateStr.includes(' ') && !dateStr.includes('T')) {
        // 检查是否有时区信息
        const hasTimezone = dateStr.endsWith('Z') || 
                           /[+-]\d{2}:?\d{2}$/.test(dateStr) ||
                           dateStr.match(/[+-]\d{4}$/);
        
        if (!hasTimezone) {
          // 如果没有时区信息，假设是UTC时间（云数据库通常返回UTC时间），添加Z后缀
          dateStr = dateStr.replace(' ', 'T') + 'Z';
        } else {
          dateStr = dateStr.replace(' ', 'T');
        }
      }
      // 兼容 iOS 格式
      if (dateStr.includes('-') && !dateStr.includes('T') && !dateStr.includes('Z')) {
        dateStr = dateStr.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1/$2/$3');
      }
      d = new Date(dateStr);
    } else if (typeof date === 'object' && date.type === 'date') {
      // 处理云数据库的特殊日期对象格式
      if (date.date) {
        d = new Date(date.date);
      } else {
        d = new Date(date);
      }
    } else {
      d = new Date(date);
    }
    
    if (isNaN(d.getTime())) {
      return '';
    }
    
    // 云数据库通常返回UTC时间，需要转换为中国时间（UTC+8）
    // 获取UTC时间戳，然后加上8小时
    const chinaTimeOffset = 8 * 60 * 60 * 1000; // 8小时的毫秒数
    const chinaTime = new Date(d.getTime() + chinaTimeOffset);
    
    // 使用UTC方法获取时间组件（因为我们已经手动加上了时区偏移）
    const year = chinaTime.getUTCFullYear();
    const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(chinaTime.getUTCDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  },

  // 获取状态文本（根据订单状态、支付状态和骑手接单情况）
  getStatusText(status, riderOpenid, payStatus) {
    // 如果订单未支付，显示"待支付"（除非已取消）
    if (payStatus === 'unpaid' && status !== 'cancelled') {
      return '待支付';
    }
    
    // 如果订单状态是confirmed，且有骑手接单，显示"骑手已接单"
    if (status === 'confirmed' && riderOpenid) {
      return '骑手已接单';
    }
    
    // 如果订单状态是ready（商家已出餐）
    if (status === 'ready') {
      // 如果有骑手接单，显示"骑手已接单"
      if (riderOpenid) {
        return '骑手已接单';
      }
      // 如果没有骑手接单，显示"商家已出餐"
      return '商家已出餐';
    }
    
    // 根据订单状态显示对应文本（只有在已支付的情况下才显示"商家已确认"）
    const statusMap = {
      'pending': '待确认',
      'confirmed': payStatus === 'paid' ? '商家已确认' : '待支付',
      'preparing': '制作中',
      'delivering': '骑手正在配送',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status] || '未知状态';
  },

  // 获取状态徽章样式类（用于药丸形徽章）
  getStatusBadgeClass(orderStatus, payStatus) {
    if (orderStatus === 'cancelled') return 'cancelled';
    if (payStatus === 'unpaid') return 'pending'; // 待支付用橙色
    if (orderStatus === 'pending') return 'pending'; // 待确认用橙色
    return 'normal'; // 制作中、骑手配送中、已完成等用绿色
  },

  // 获取状态样式类
  getStatusClass(status) {
    const classMap = {
      'pending': 'pending',
      'confirmed': 'normal',
      'preparing': 'normal',
      'ready': 'normal',
      'delivering': 'normal',
      'completed': 'normal',
      'cancelled': 'cancelled'
    };
    return classMap[status] || 'normal';
  },

  // 取消订单
  async onCancelOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.filteredOrders.find(o => o.id === orderId);
    
    if (!order) {
      return;
    }
    
    // 显示确认对话框
    wx.showModal({
      title: '确认取消',
      content: '确定要取消这个订单吗？',
      success: async (res) => {
        if (res.confirm) {
          await this.cancelOrder(orderId);
        }
      }
    });
  },

  // 执行取消订单
  async cancelOrder(orderId) {
    try {
      wx.showLoading({ title: '处理中...' });
      
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'cancelOrder',
          data: {
            orderId: orderId
          }
        }
      });
      
      wx.hideLoading();
      
      log.log('【取消订单】返回结果:', res.result);

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '订单已取消',
          icon: 'success',
          duration: 2000
        });
        
        // 重新加载订单列表
        setTimeout(() => {
          this.loadOrders();
        }, 500);
      } else {
        wx.showToast({
          title: res.result?.message || '取消失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      wx.hideLoading();
      log.error('【取消订单】异常:', error);
      wx.showToast({
        title: '取消失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 跳转到首页
  onGoHome() {
    wx.reLaunch({
      url: '/pages/home/index'
    });
  },

  // 点击订单卡片，跳转到订单详情
  onOrderTap(e) {
    const orderId = e.currentTarget.dataset.id;
    if (orderId) {
      wx.navigateTo({
        url: `/subpackages/order/pages/order-detail/index?orderId=${orderId}`,
        fail: (err) => {
          log.error('跳转到订单详情失败:', err);
          wx.showToast({
            title: '跳转失败',
            icon: 'none'
          });
        }
      });
    }
  },

  // 联系商家
  async onContactMerchant(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.filteredOrders.find(o => o.id === orderId);
    
    if (!order) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none'
      });
      return;
    }
    
    if (!order.storeId) {
      wx.showToast({
        title: '店铺信息缺失',
        icon: 'none'
      });
      return;
    }
    
    try {
      wx.showLoading({ title: '加载中...' });
      
      // 通过storeId查询店铺信息，获取merchantId
      const storeRes = await wx.cloud.callFunction({
        name: 'storeManage',
        data: {
          action: 'getStoreDetail',
          data: {
            storeId: order.storeId
          }
        }
      });
      
      if (storeRes.result && storeRes.result.code === 200) {
        const storeInfo = storeRes.result.data.storeInfo || storeRes.result.data.store || {};
        // 获取商家手机号
        let contactPhone = storeInfo.contactPhone || null;
        
        // 如果没有手机号，通过merchantId查询商家信息
        if (!contactPhone || contactPhone === '未设置联系方式') {
          if (storeInfo.merchantId) {
            try {
              const merchantRes = await wx.cloud.callFunction({
                name: 'merchantManage',
                data: {
                  action: 'getDetail',
                  data: {
                    merchantId: storeInfo.merchantId
                  }
                }
              });
              
              if (merchantRes.result && merchantRes.result.code === 200) {
                const merchant = merchantRes.result.data.merchant || {};
                contactPhone = merchant.contactPhone || null;
              }
            } catch (err) {
              log.error('【联系商家】获取商家信息失败:', err);
            }
          }
        }
        
        wx.hideLoading();
        
        if (!contactPhone || contactPhone === '未设置联系方式') {
          wx.showToast({
            title: '商家未设置联系方式',
            icon: 'none'
          });
          return;
        }
        
        // 拨打电话
        wx.makePhoneCall({
          phoneNumber: contactPhone,
          success: () => {
            log.log('【联系商家】拨打电话成功:', contactPhone);
          },
          fail: (err) => {
            log.error('【联系商家】拨打电话失败:', err);
            wx.showToast({
              title: '拨打电话失败',
              icon: 'none'
            });
          }
        });
      } else {
        wx.hideLoading();
        wx.showToast({
          title: '获取店铺信息失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      log.error('【联系商家】异常:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 支付订单
  async onPayOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    if (this.data.payingOrderId) return;
    const order = this.data.filteredOrders.find(o => o.id === orderId);

    if (!order) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none'
      });
      return;
    }

    if (order.payStatus === 'paid') {
      wx.showToast({
        title: '订单已支付',
        icon: 'none'
      });
      return;
    }

    const tid = getApp().globalData.subscribeMessageOrderStatusTemplateId;
    if (!tid) {
      wx.showToast({ title: '加载中，请稍后再试', icon: 'none' });
      subscribeMessage.preloadOrderStatusTemplateId();
      return;
    }
    this.setData({ payingOrderId: orderId });
    subscribeMessage.triggerSubscribeSync(tid)
      .then(() => this._doPayOrder(orderId, order))
      .catch(() => this._doPayOrder(orderId, order));
  },

  async _doPayOrder(orderId, order) {
    wx.showLoading({ title: '正在支付...' });

    try {
      // 调用统一下单接口
      const res = await wx.cloud.callFunction({
        name: 'paymentManage',
        data: {
          action: 'unifiedOrder',
          data: {
            orderId: orderId,
            totalFee: Math.round(order.total * 100), // 转换为分
            description: `订单支付-${order.orderNo}`
          }
        }
      });

      wx.hideLoading();

      log.log('【支付】统一下单返回:', res.result);

      if (res.result && res.result.code === 200) {
        const paymentParams = res.result.data;

        // 调用微信支付
        wx.requestPayment({
          timeStamp: paymentParams.timeStamp,
          nonceStr: paymentParams.nonceStr,
          package: paymentParams.package,
          signType: paymentParams.signType,
          paySign: paymentParams.paySign,
          success: async (payRes) => {
            this.setData({ payingOrderId: null });
            log.log('【支付】成功:', payRes);

            // 支付成功后主动更新订单状态
            try {
              await wx.cloud.callFunction({
                name: 'orderManage',
                data: {
                  action: 'updateOrderPayStatus',
                  data: {
                    orderId: orderId,
                    payStatus: 'paid'
                  }
                }
              });
            } catch (updateError) {
              log.warn('【支付】更新订单状态失败:', updateError);
              // 不影响支付成功提示
            }
            wx.showToast({
              title: '支付成功',
              icon: 'success',
              duration: 2000
            });
            // 刷新订单列表
            setTimeout(() => {
              this.loadOrders();
            }, 500);
          },
          fail: (payErr) => {
            this.setData({ payingOrderId: null });
            log.error('【支付】失败:', payErr);
            wx.showToast({
              title: '支付失败',
              icon: 'none',
              duration: 2000
            });
          }
        });
      } else {
        this.setData({ payingOrderId: null });
        wx.showToast({
          title: res.result?.message || '统一下单失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (error) {
      wx.hideLoading();
      this.setData({ payingOrderId: null });
      log.error('【支付】异常:', error);
      wx.showToast({
        title: '支付异常，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 判断是否可以申请退款（骑手未取餐前可退，取餐后不可退）
  canRefund(orderStatus, completedAt, riderOpenid) {
    if (orderStatus === 'delivering') return false;
    if (orderStatus === 'completed' && riderOpenid) return false;
    if (orderStatus === 'cancelled') return false;
    // 仅允许：待确认、已确认、制作中、待取餐
    return ['pending', 'confirmed', 'preparing', 'ready'].includes(orderStatus);
  },

  // 申请退款（在用户点击时请求退款进度订阅，再跳转）
  onRefund(e) {
    const orderId = e.currentTarget.dataset.id;
    if (orderId) {
      const refundTid = subscribeMessage.getRefundTemplateId();
      const doNav = () => {
        wx.navigateTo({
          url: `/subpackages/order/pages/refund-apply/index?orderId=${orderId}`,
          fail: (err) => {
            log.error('跳转到退款申请页面失败:', err);
            wx.showToast({ title: '跳转失败', icon: 'none' });
          }
        });
      };
      if (refundTid) {
        subscribeMessage.triggerSubscribeSync(refundTid).then(doNav).catch(doNav);
      } else {
        doNav();
      }
    } else {
      wx.showToast({
        title: '订单信息缺失',
        icon: 'none'
      });
    }
  },

  // 再来一单
  async onOrderAgain(e) {
    if (!getApp().ensureLogin('请先登录后再下单')) return;
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.filteredOrders.find(o => o.id === orderId);
    
    if (!order) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none'
      });
      return;
    }
    
    // 根据订单类型处理（统一使用分包分类页）
    if (order.orderType === 'express') {
      wx.navigateTo({
        url: '/subpackages/category/pages/express/index'
      });
    } else if (order.orderType === 'gaming') {
      wx.navigateTo({
        url: '/subpackages/category/pages/gaming/index'
      });
    } else if (order.orderType === 'reward') {
      wx.navigateTo({
        url: '/subpackages/category/pages/reward/index'
      });
    } else {
      // 普通订单，跳转到店铺详情页面并添加商品到购物车
      if (!order.storeId) {
        wx.showToast({
          title: '店铺信息缺失',
          icon: 'none'
        });
        return;
      }
      
      // 构建购物车数据
      const cartItems = [];
      if (order.rawItems && order.rawItems.length > 0) {
        order.rawItems.forEach(item => {
          // 价格从分转换为元
          const price = item.price ? (item.price >= 100 ? item.price / 100 : item.price) : 0;
          
          cartItems.push({
            id: item.productId,
            name: item.productName || '商品',
            price: price,
            quantity: item.quantity || 1,
            image: item.image || '',
            spec: item.spec || '',
            selectedSpecs: item.spec ? [{ optionName: item.spec }] : []
          });
        });
      }
      
      // 计算购物车总价
      const cartTotal = cartItems.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);
      
      // 获取店铺信息（需要配送费和起送金额）
      try {
        wx.showLoading({ title: '加载中...' });
        
        const storeRes = await wx.cloud.callFunction({
          name: 'storeManage',
          data: {
            action: 'getStoreDetail',
            data: {
              storeId: order.storeId
            }
          }
        });
        
        wx.hideLoading();
        
        if (storeRes.result && storeRes.result.code === 200) {
          const storeInfo = storeRes.result.data.storeInfo || {};
          
          // 构建完整的购物车数据
          const cartData = {
            cartItems: cartItems,
            cartTotal: cartTotal,
            storeInfo: {
              storeId: order.storeId,
              _id: order.storeId,
              name: storeInfo.name || order.storeName,
              deliveryFee: storeInfo.deliveryFee || parseFloat(order.amountDelivery) || 2,
              minOrder: storeInfo.minOrder || 0
            }
          };
          
          // 跳转到结算页面
          wx.navigateTo({
            url: `/subpackages/store/pages/checkout/index?cartData=${encodeURIComponent(JSON.stringify(cartData))}`,
            fail: (err) => {
              log.error('跳转失败:', err);
              wx.showToast({
                title: '跳转失败',
                icon: 'none'
              });
            }
          });
        } else {
          wx.showToast({
            title: '获取店铺信息失败',
            icon: 'none'
          });
        }
      } catch (error) {
        wx.hideLoading();
        log.error('再来一单失败:', error);
        wx.showToast({
          title: '操作失败，请重试',
          icon: 'none'
        });
      }
    }
  },

  onTabTap(e) {
    const tab = (e.detail && e.detail.tab) ? e.detail.tab : (e.currentTarget && e.currentTarget.dataset.tab);
    if (!tab) return;
    if (tab === 'home') {
      wx.reLaunch({
        url: '/pages/home/index'
      });
    } else if (tab === 'cart') {
      wx.switchTab({ url: '/pages/cart/index' });
    } else if (tab === 'receive') {
      // 接单功能正在开发中
      wx.showToast({
        title: '正在开发中',
        icon: 'none',
        duration: 2000
      });
      // wx.reLaunch({
      //   url: '/pages/receive-order/index'
      // });
    } else if (tab === 'message') {
      // 消息功能正在开发中
      wx.showToast({
        title: '正在开发中',
        icon: 'none',
        duration: 2000
      });
      // wx.reLaunch({
      //   url: '/pages/message/index'
      // });
    } else if (tab === 'profile') {
      wx.reLaunch({
        url: '/pages/profile/index'
      });
    }
  }
  ,
  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/pages/home/index' });
    }
  },

  onGoHome() {
    wx.reLaunch({ url: '/pages/home/index' });
  }
});
