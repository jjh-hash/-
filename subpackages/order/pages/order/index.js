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
      { id: 'reward', name: '悬赏', icon: '💰' }
    ],
    watchOrder: null,        // watch监听器
    refreshTimer: null,      // 防抖定时器
    reconnectTimer: null,    // 重连定时器
    pollingTimer: null,      // 轮询定时器
    reconnectCount: 0,       // 重连次数
    watchConnected: false,   // watch是否连接
    pollingActive: false,    // 是否在轮询
    lastRefreshTime: 0,      // 上次刷新时间
    lastScrollTime: 0,       // 上次滚动时间
    isScrolling: false,      // 是否正在滚动
    scrollTop: 0            // 当前滚动位置
  },

  onLoad() {
    console.log('【用户订单页面】页面加载');
    this.loadOrders();
    // 启动订单实时监听
    this.startOrderWatch();
  },

  onShow() {
    console.log('【用户订单页面】页面显示，刷新订单');
    this.loadOrders();
    // 重新启动订单监听
    this.startOrderWatch();
    
    // 如果watch未连接，启动轮询作为保障
    setTimeout(() => {
      if (!this.data.watchConnected && !this.data.pollingActive) {
        console.log('【用户订单页面】Watch未连接，启动轮询保障');
        this.startPolling();
      }
    }, 2000);
  },

  onHide() {
    console.log('【用户订单页面】页面隐藏，停止订单监听和轮询');
    // 停止订单监听和轮询
    this.stopOrderWatch();
    this.stopPolling();
  },

  onUnload() {
    console.log('【用户订单页面】页面卸载，停止订单监听和轮询');
    // 停止订单监听和轮询
    this.stopOrderWatch();
    this.stopPolling();
    // 清理所有定时器
    if (this.data.refreshTimer) {
      clearTimeout(this.data.refreshTimer);
      this.data.refreshTimer = null;
    }
    if (this.data.reconnectTimer) {
      clearTimeout(this.data.reconnectTimer);
      this.data.reconnectTimer = null;
    }
    if (this.data.scrollTimer) {
      clearTimeout(this.data.scrollTimer);
      this.data.scrollTimer = null;
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
      console.log('【用户订单页面】启动订单实时监听');
      
      const db = wx.cloud.database();
      
      // 获取当前用户的openid
      wx.cloud.callFunction({
        name: 'loginUser',
        data: {}
      }).then(res => {
        const openid = res.result?.openid;
        if (!openid) {
          console.warn('【用户订单页面】无法启动订单监听：缺少openid，降级到轮询');
          this.startPolling();
          return;
        }
        
        // 监听当前用户的订单变化（移除orderBy，watch不支持）
        this.data.watchOrder = db.collection('orders')
          .where({
            userOpenid: openid
          })
          .watch({
            onChange: (snapshot) => {
              console.log('【用户订单页面】订单数据变化:', snapshot);
              
              // 标记watch已连接
              if (!this.data.watchConnected) {
                this.setData({ watchConnected: true });
                console.log('【用户订单页面】Watch连接成功');
                // 连接成功后停止轮询
                this.stopPolling();
              }
              
              // 如果有数据变化，且不在加载中，则刷新订单列表
              if (snapshot.docChanges && snapshot.docChanges.length > 0) {
                this.handleOrderChange();
              }
            },
            onError: (err) => {
              console.error('【用户订单页面】订单监听错误:', err);
              this.handleWatchError(err);
            }
          });
          
        console.log('【用户订单页面】Watch监听已启动');
      }).catch(err => {
        console.error('【用户订单页面】获取openid失败:', err);
        // 获取openid失败，降级到轮询
        this.startPolling();
      });
    } catch (error) {
      console.error('【用户订单页面】启动订单监听失败:', error);
      // 启动失败，降级到轮询
      this.startPolling();
    }
  },

  // 处理订单变化（防抖+滚动检测）
  handleOrderChange() {
    // 防抖：1秒内最多刷新1次
    const now = Date.now();
    if (now - this.data.lastRefreshTime < 1000) {
      console.log('【用户订单页面】防抖：跳过本次刷新');
      return;
    }
    
    if (this.data.loading) {
      console.log('【用户订单页面】正在加载中，跳过刷新');
      return;
    }
    
    // 检查用户是否在滚动（3秒内滚动过，则延迟刷新）
    const timeSinceScroll = now - (this.data.lastScrollTime || 0);
    if (timeSinceScroll < 3000) {
      console.log('【用户订单页面】用户正在浏览，延迟刷新');
      // 延迟到用户停止滚动后3秒再刷新
      if (this.data.refreshTimer) {
        clearTimeout(this.data.refreshTimer);
      }
      this.data.refreshTimer = setTimeout(() => {
        this.handleOrderChange();
      }, 3000 - timeSinceScroll + 2000);
      return;
    }
    
    // 检查滚动位置：如果不在顶部（滚动超过100px），延迟刷新
    if (this.data.scrollTop > 100) {
      console.log('【用户订单页面】用户已滚动，延迟刷新');
      if (this.data.refreshTimer) {
        clearTimeout(this.data.refreshTimer);
      }
      this.data.refreshTimer = setTimeout(() => {
        // 再次检查是否还在滚动
        const timeSinceLastScroll = Date.now() - (this.data.lastScrollTime || 0);
        if (timeSinceLastScroll >= 3000) {
          this.handleOrderChange();
        }
      }, 3000);
      return;
    }
    
    console.log('【用户订单页面】检测到订单变化，自动刷新');
    this.setData({ lastRefreshTime: now });
    
    // 延迟刷新，避免频繁刷新
    if (this.data.refreshTimer) {
      clearTimeout(this.data.refreshTimer);
    }
    
    this.data.refreshTimer = setTimeout(() => {
      if (!this.data.loading) {
        this.loadOrders();
      }
    }, 500);
  },

  // 处理watch错误并重连
  handleWatchError(err) {
    this.setData({ watchConnected: false });
    
    const reconnectCount = this.data.reconnectCount || 0;
    const maxReconnect = 3;
    
    if (reconnectCount >= maxReconnect) {
      console.warn('【用户订单页面】Watch重连次数已达上限，降级到轮询');
      this.startPolling();
      return;
    }
    
    // 重连间隔递增：1秒、3秒、5秒
    const intervals = [1000, 3000, 5000];
    const delay = intervals[reconnectCount] || 5000;
    
    console.log(`【用户订单页面】Watch错误，${delay/1000}秒后尝试重连（${reconnectCount + 1}/${maxReconnect}）`);
    
    this.setData({ reconnectCount: reconnectCount + 1 });
    
    this.data.reconnectTimer = setTimeout(() => {
      this.startOrderWatch();
    }, delay);
  },

  // 启动智能轮询（降级方案）
  startPolling() {
    // 如果已经在轮询，不重复启动
    if (this.data.pollingActive) {
      return;
    }
    
    console.log('【用户订单页面】启动智能轮询');
    this.setData({ pollingActive: true });
    
    // 立即执行一次
    this.pollOrders();
    
    // 设置定时轮询
    this.data.pollingTimer = setInterval(() => {
      this.pollOrders();
    }, this.getPollingInterval());
  },

  // 停止轮询
  stopPolling() {
    if (this.data.pollingTimer) {
      clearInterval(this.data.pollingTimer);
      this.data.pollingTimer = null;
    }
    this.setData({ pollingActive: false });
    console.log('【用户订单页面】轮询已停止');
  },

  // 轮询订单
  pollOrders() {
    // 检查是否有进行中的订单
    const hasActiveOrders = this.data.allOrders.some(order => {
      const status = order.orderStatus;
      return status === 'pending' || status === 'confirmed' || 
             status === 'preparing' || status === 'delivering';
    });
    
    // 如果没有进行中的订单，停止轮询
    if (!hasActiveOrders) {
      console.log('【用户订单页面】没有进行中的订单，停止轮询');
      this.stopPolling();
      return;
    }
    
    // 检查用户是否在滚动（3秒内滚动过，则跳过本次刷新）
    const now = Date.now();
    const timeSinceScroll = now - (this.data.lastScrollTime || 0);
    if (timeSinceScroll < 3000) {
      console.log('【用户订单页面】用户正在浏览，跳过轮询刷新');
      return;
    }
    
    // 检查滚动位置：如果不在顶部，跳过刷新
    if (this.data.scrollTop > 100) {
      console.log('【用户订单页面】用户已滚动，跳过轮询刷新');
      return;
    }
    
    // 如果不在加载中，则刷新订单
    if (!this.data.loading) {
      console.log('【用户订单页面】轮询刷新订单');
      this.loadOrders();
    }
  },

  // 获取轮询间隔（根据订单状态）
  getPollingInterval() {
    // 检查是否有进行中的订单
    const hasActiveOrders = this.data.allOrders.some(order => {
      const status = order.orderStatus;
      return status === 'pending' || status === 'confirmed' || 
             status === 'preparing' || status === 'delivering';
    });
    
    // 有进行中的订单：30秒轮询一次（减少刷新频率，提升体验）
    // 没有进行中的订单：不轮询（由pollOrders判断）
    return 30000;
  },

  // 处理滚动事件（记录滚动时间和位置）
  onScroll(e) {
    const now = Date.now();
    const scrollTop = e.detail.scrollTop || 0;
    this.setData({ 
      lastScrollTime: now,
      scrollTop: scrollTop,
      isScrolling: true
    });
    
    // 停止滚动后3秒，标记为静止
    if (this.data.scrollTimer) {
      clearTimeout(this.data.scrollTimer);
    }
    this.data.scrollTimer = setTimeout(() => {
      this.setData({ isScrolling: false });
    }, 3000);
  },

  // 停止订单监听
  stopOrderWatch() {
    if (this.data.watchOrder) {
      try {
        this.data.watchOrder.close();
        console.log('【用户订单页面】订单监听已停止');
      } catch (error) {
        console.error('【用户订单页面】停止订单监听失败:', error);
      }
      this.data.watchOrder = null;
    }
    this.setData({ watchConnected: false });
    
    // 清理重连定时器
    if (this.data.reconnectTimer) {
      clearTimeout(this.data.reconnectTimer);
      this.data.reconnectTimer = null;
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    console.log('【用户订单页面】下拉刷新');
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

  // 加载订单列表
  async loadOrders(isPullRefresh = false) {
    // 如果已经在加载中，则跳过（避免重复请求）
    if (this.data.loading) {
      return Promise.resolve();
    }
    
    this.setData({ loading: true });

    try {
      // 下拉刷新时不显示loading，使用下拉刷新的原生动画
      if (!isPullRefresh) {
        wx.showLoading({ title: '加载中...' });
      }

      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getOrderList',
          data: {
            page: 1,
            pageSize: 50
          }
        }
      });

      // 下拉刷新时不隐藏loading（因为没显示）
      if (!isPullRefresh) {
        wx.hideLoading();
      }

      console.log('【用户订单页面】云函数返回结果:', res.result);

      if (res.result && res.result.code === 200) {
        // 确保 data.list 存在且是数组
        const orderList = res.result.data?.list || [];
        
        if (!Array.isArray(orderList)) {
          console.error('【用户订单页面】订单列表格式错误:', orderList);
          wx.showToast({
            title: '订单数据格式错误',
            icon: 'none'
          });
          this.setData({ loading: false });
          return;
        }

        // 先查询所有订单的退款信息
        let refundsMap = {}; // {orderId: refundInfo}
        try {
          const refundRes = await wx.cloud.callFunction({
            name: 'refundManage',
            data: {
              action: 'getRefundList',
              data: {
                page: 1,
                pageSize: 100
              }
            }
          });

          if (refundRes.result && refundRes.result.code === 200) {
            const refundList = refundRes.result.data?.list || [];
            // 为每个订单建立退款信息映射
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
          console.error('【用户订单页面】查询退款信息失败:', error);
        }

        const orders = orderList.map(order => {
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
              name: `${order.category || '悬赏任务'}`,
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
              storeName = '悬赏';
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
            status: this.getStatusText(order.orderStatus, order.riderOpenid),
            statusClass: this.getStatusClass(order.orderStatus),
            orderStatus: order.orderStatus,
            img: order.items && order.items[0] ? order.items[0].image : (order.images && order.images[0] ? order.images[0] : ''),
            total: this.formatAmount(order.amountPayable || order.amountTotal || '0.00'),
            amountGoods: this.formatAmount(order.amountGoods || '0.00'),
            amountDelivery: this.formatAmount(order.amountDelivery || '0.00'),
            platformFee: this.formatAmount(order.platformFee || '0.00'),
            expiredAt: order.expiredAt || null,
            expiredMinutes: order.expiredMinutes || null,
            readyAt: order.readyAt || null,
            completedAt: order.completedAt || null, // 订单完成时间
            canRefund: this.canRefund(order.orderStatus, order.completedAt), // 是否可以申请退款
            estimatedDeliveryTime: order.estimatedDeliveryTime || null,
            estimatedDeliveryTimeRange: estimatedDeliveryTimeRange, // 预计到达时间范围
            items: orderItems,
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

        this.setData({
          orders: orders,
          allOrders: orders, // 保存所有订单
          filteredOrders: orders, // 初始显示所有订单
          loading: false
        });

        // 根据当前选中的分类过滤订单
        this.filterOrdersByCategory();

        console.log('【用户订单页面】订单加载成功，共', orders.length, '条');
      } else {
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      }

    } catch (error) {
      // 下拉刷新时不隐藏loading（因为没显示）
      if (!isPullRefresh) {
        wx.hideLoading();
      }
      console.error('【用户订单页面】加载异常:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 根据分类过滤订单
  filterOrdersByCategory() {
    const { allOrders, selectedCategory } = this.data;
    
    let filteredOrders = [];
    
    if (selectedCategory === 'all') {
      // 全部订单
      filteredOrders = allOrders;
    } else if (selectedCategory === 'express') {
      // 代拿快递订单
      filteredOrders = allOrders.filter(order => order.orderType === 'express');
    } else if (selectedCategory === 'gaming') {
      // 游戏陪玩订单 - 根据订单类型或店铺名称判断
      filteredOrders = allOrders.filter(order => 
        order.orderType === 'gaming' || 
        (order.storeName && order.storeName.includes('游戏'))
      );
    } else if (selectedCategory === 'reward') {
      // 悬赏订单 - 根据订单类型或店铺名称判断
      filteredOrders = allOrders.filter(order => 
        order.orderType === 'reward' || 
        (order.storeName && order.storeName.includes('悬赏'))
      );
    }
    
    this.setData({
      filteredOrders: filteredOrders
    });
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

  // 获取状态文本（根据订单状态和骑手接单情况）
  getStatusText(status, riderOpenid) {
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
    
    // 根据订单状态显示对应文本
    const statusMap = {
      'pending': '待确认',
      'confirmed': '商家已确认',
      'preparing': '制作中',
      'delivering': '骑手正在配送',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status] || '未知状态';
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
      
      console.log('【取消订单】返回结果:', res.result);
      
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
      console.error('【取消订单】异常:', error);
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

  // 点击订单卡片，跳转到订单详情
  onOrderTap(e) {
    const orderId = e.currentTarget.dataset.id;
    if (orderId) {
      wx.navigateTo({
        url: `/subpackages/order/pages/order-detail/index?orderId=${orderId}`,
        fail: (err) => {
          console.error('跳转到订单详情失败:', err);
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
              console.error('【联系商家】获取商家信息失败:', err);
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
            console.log('【联系商家】拨打电话成功:', contactPhone);
          },
          fail: (err) => {
            console.error('【联系商家】拨打电话失败:', err);
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
      console.error('【联系商家】异常:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },

  // 判断是否可以申请退款
  canRefund(orderStatus, completedAt) {
    // 只有已完成的订单才能申请退款
    if (orderStatus !== 'completed') {
      return false;
    }
    
    // 如果没有完成时间，不允许退款（可能是旧数据）
    if (!completedAt) {
      return false;
    }
    
    try {
      // 解析完成时间
      let completedTime;
      if (completedAt instanceof Date) {
        completedTime = completedAt;
      } else if (completedAt.getTime && typeof completedAt.getTime === 'function') {
        completedTime = new Date(completedAt.getTime());
      } else if (typeof completedAt === 'string') {
        // 处理字符串格式的日期
        let dateStr = completedAt;
        if (dateStr.includes(' ') && !dateStr.includes('T')) {
          const hasTimezone = dateStr.endsWith('Z') || 
                             /[+-]\d{2}:?\d{2}$/.test(dateStr) ||
                             dateStr.match(/[+-]\d{4}$/);
          
          if (!hasTimezone) {
            dateStr = dateStr.replace(' ', 'T') + 'Z';
          } else {
            dateStr = dateStr.replace(' ', 'T');
          }
        }
        completedTime = new Date(dateStr);
      } else {
        completedTime = new Date(completedAt);
      }
      
      // 检查日期是否有效
      if (isNaN(completedTime.getTime())) {
        console.warn('【判断退款】完成时间格式无效:', completedAt);
        return false;
      }
      
      // 计算时间差（毫秒）
      const now = new Date();
      const diffMs = now.getTime() - completedTime.getTime();
      
      // 1天 = 24小时 = 24 * 60 * 60 * 1000 毫秒
      const oneDayMs = 24 * 60 * 60 * 1000;
      
      // 如果超过1天，不允许退款
      if (diffMs > oneDayMs) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('【判断退款】计算时间差失败:', error);
      return false;
    }
  },

  // 申请退款
  onRefund(e) {
    const orderId = e.currentTarget.dataset.id;
    if (orderId) {
      wx.navigateTo({
        url: `/subpackages/order/pages/refund-apply/index?orderId=${orderId}`,
        fail: (err) => {
          console.error('跳转到退款申请页面失败:', err);
          wx.showToast({
            title: '跳转失败',
            icon: 'none'
          });
        }
      });
    } else {
      wx.showToast({
        title: '订单信息缺失',
        icon: 'none'
      });
    }
  },

  // 再来一单
  async onOrderAgain(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.filteredOrders.find(o => o.id === orderId);
    
    if (!order) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none'
      });
      return;
    }
    
    // 根据订单类型处理
    if (order.orderType === 'express') {
      // 代拿快递订单，跳转到代拿快递页面
      wx.navigateTo({
        url: '/pages/express/index'
      });
    } else if (order.orderType === 'gaming') {
      // 游戏陪玩订单，跳转到游戏陪玩页面
      wx.navigateTo({
        url: '/pages/gaming/index'
      });
    } else if (order.orderType === 'reward') {
      // 悬赏订单，跳转到悬赏页面
      wx.navigateTo({
        url: '/pages/reward/index'
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
              console.error('跳转失败:', err);
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
        console.error('再来一单失败:', error);
        wx.showToast({
          title: '操作失败，请重试',
          icon: 'none'
        });
      }
    }
  },

  onTabTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === 'home') {
      wx.reLaunch({
        url: '/pages/home/index'
      });
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
  }
});
