Page({
  data:{
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    activeTab: 0,
    bottomActive: 'orders',
    orders: [],
    loading: false, // 初始状态为false，允许首次加载
    refreshing: false, // 下拉刷新状态
    tabs: ['待确认', '制作中', '待配送', '已完成'],
    watchOrder: null,        // watch监听器
    refreshTimer: null,      // 防抖定时器
    reconnectTimer: null,    // 重连定时器
    pollingTimer: null,      // 轮询定时器
    scrollTimer: null,       // 滚动检测定时器
    reconnectCount: 0,       // 重连次数
    watchConnected: false,   // watch是否连接
    pollingActive: false,    // 是否在轮询
    lastRefreshTime: 0,      // 上次刷新时间
    lastScrollTime: 0,       // 上次滚动时间
    isScrolling: false,     // 是否正在滚动
    scrollTop: 0            // 当前滚动位置
  },

  onLoad() {
    console.log('【商家订单页面】页面加载');
    this.loadOrders();
    // 启动订单实时监听
    this.startOrderWatch();
  },

  onShow() {
    console.log('【商家订单页面】页面显示，刷新订单');
    // 根据当前选中的标签重新加载订单
    const { activeTab } = this.data;
    let status = null;
    let filterRefund = false;
    
    switch(activeTab) {
      case 0: // 全部
        status = null;
        filterRefund = false;
        break;
      case 1: // 待确认
        status = 'pending';
        filterRefund = false;
        break;
      case 2: // 已完成
        status = 'completed';
        filterRefund = false;
        break;
      case 3: // 已取消
        status = 'cancelled';
        filterRefund = false;
        break;
      case 4: // 待退款
        status = null;
        filterRefund = true;
        break;
    }
    
    this.loadOrders(status, filterRefund);
    
    // 重新启动订单监听
    this.startOrderWatch();
    
    // 如果watch未连接，启动轮询作为保障
    setTimeout(() => {
      if (!this.data.watchConnected && !this.data.pollingActive) {
        console.log('【商家订单页面】Watch未连接，启动轮询保障');
        this.startPolling(status, filterRefund);
      }
    }, 2000);
  },

  onHide() {
    console.log('【商家订单页面】页面隐藏，停止订单监听和轮询');
    // 停止订单监听和轮询
    this.stopOrderWatch();
    this.stopPolling();
  },

  onUnload() {
    console.log('【商家订单页面】页面卸载，停止订单监听和轮询');
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

  // 手动刷新
  onManualRefresh() {
    console.log('【商家订单页面】手动刷新');
    const { activeTab } = this.data;
    let status = null;
    let filterRefund = false;
    
    switch(activeTab) {
      case 0: status = null; filterRefund = false; break;
      case 1: status = 'pending'; filterRefund = false; break;
      case 2: status = 'completed'; filterRefund = false; break;
      case 3: status = 'cancelled'; filterRefund = false; break;
      case 4: status = null; filterRefund = true; break;
    }
    
    this.loadOrders(status, filterRefund);
    
    wx.showToast({
      title: '刷新成功',
      icon: 'success',
      duration: 1000
    });
  },

  // 启动订单实时监听
  startOrderWatch() {
    // 先停止之前的监听和轮询
    this.stopOrderWatch();
    this.stopPolling();
    
    // 重置重连次数
    this.setData({ reconnectCount: 0 });
    
    try {
      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const storeId = merchantInfo?.storeId || null;
      
      if (!storeId) {
        console.warn('【商家订单页面】无法启动订单监听：缺少店铺ID，降级到轮询');
        const { activeTab } = this.data;
        let status = null;
        let filterRefund = false;
        this.getStatusFromTab(activeTab, (s, f) => {
          status = s;
          filterRefund = f;
        });
        this.startPolling(status, filterRefund);
        return;
      }
      
      console.log('【商家订单页面】启动订单实时监听，店铺ID:', storeId);
      
      const db = wx.cloud.database();
      
      // 监听该店铺的订单变化（移除orderBy，watch不支持）
      this.data.watchOrder = db.collection('orders')
        .where({
          storeId: storeId
        })
        .watch({
          onChange: (snapshot) => {
            console.log('【商家订单页面】订单数据变化:', snapshot);
            
            // 标记watch已连接
            if (!this.data.watchConnected) {
              this.setData({ watchConnected: true });
              console.log('【商家订单页面】Watch连接成功');
              // 连接成功后停止轮询
              this.stopPolling();
            }
            
            // 如果有数据变化，则刷新订单列表
            if (snapshot.docChanges && snapshot.docChanges.length > 0) {
              this.handleOrderChange();
            }
          },
          onError: (err) => {
            console.error('【商家订单页面】订单监听错误:', err);
            this.handleWatchError(err);
          }
        });
        
      console.log('【商家订单页面】Watch监听已启动');
    } catch (error) {
      console.error('【商家订单页面】启动订单监听失败:', error);
      // 启动失败，降级到轮询
      const { activeTab } = this.data;
      let status = null;
      let filterRefund = false;
      this.getStatusFromTab(activeTab, (s, f) => {
        status = s;
        filterRefund = f;
      });
      this.startPolling(status, filterRefund);
    }
  },

  // 从标签获取状态
  getStatusFromTab(activeTab, callback) {
    let status = null;
    let filterRefund = false;
    
    switch(activeTab) {
      case 0: status = null; filterRefund = false; break;
      case 1: status = 'pending'; filterRefund = false; break;
      case 2: status = 'completed'; filterRefund = false; break;
      case 3: status = 'cancelled'; filterRefund = false; break;
      case 4: status = null; filterRefund = true; break;
    }
    
    callback(status, filterRefund);
  },

  // 处理订单变化（防抖+滚动检测）
  handleOrderChange() {
    // 防抖：1秒内最多刷新1次
    const now = Date.now();
    if (now - this.data.lastRefreshTime < 1000) {
      console.log('【商家订单页面】防抖：跳过本次刷新');
      return;
    }
    
    if (this.data.loading) {
      console.log('【商家订单页面】正在加载中，跳过刷新');
      return;
    }
    
    // 检查用户是否在滚动（3秒内滚动过，则延迟刷新）
    const timeSinceScroll = now - (this.data.lastScrollTime || 0);
    if (timeSinceScroll < 3000) {
      console.log('【商家订单页面】用户正在浏览，延迟刷新');
      // 延迟到用户停止滚动后3秒再刷新
      if (this.data.refreshTimer) {
        clearTimeout(this.data.refreshTimer);
      }
      const { activeTab } = this.data;
      let status = null;
      let filterRefund = false;
      this.getStatusFromTab(activeTab, (s, f) => {
        status = s;
        filterRefund = f;
      });
      this.data.refreshTimer = setTimeout(() => {
        this.handleOrderChange();
      }, 3000 - timeSinceScroll + 2000);
      return;
    }
    
    // 检查滚动位置：如果不在顶部（滚动超过100px），延迟刷新
    if (this.data.scrollTop > 100) {
      console.log('【商家订单页面】用户已滚动，延迟刷新');
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
    
    console.log('【商家订单页面】检测到订单变化，自动刷新');
    this.setData({ lastRefreshTime: now });
    
    const { activeTab } = this.data;
    let status = null;
    let filterRefund = false;
    this.getStatusFromTab(activeTab, (s, f) => {
      status = s;
      filterRefund = f;
    });
    
    // 延迟刷新，避免频繁刷新
    if (this.data.refreshTimer) {
      clearTimeout(this.data.refreshTimer);
    }
    
    this.data.refreshTimer = setTimeout(() => {
      if (!this.data.loading) {
        this.loadOrders(status, filterRefund);
      }
    }, 500);
  },

  // 处理watch错误并重连
  handleWatchError(err) {
    this.setData({ watchConnected: false });
    
    const reconnectCount = this.data.reconnectCount || 0;
    const maxReconnect = 3;
    
    if (reconnectCount >= maxReconnect) {
      console.warn('【商家订单页面】Watch重连次数已达上限，降级到轮询');
      const { activeTab } = this.data;
      let status = null;
      let filterRefund = false;
      this.getStatusFromTab(activeTab, (s, f) => {
        status = s;
        filterRefund = f;
      });
      this.startPolling(status, filterRefund);
      return;
    }
    
    // 重连间隔递增：1秒、3秒、5秒
    const intervals = [1000, 3000, 5000];
    const delay = intervals[reconnectCount] || 5000;
    
    console.log(`【商家订单页面】Watch错误，${delay/1000}秒后尝试重连（${reconnectCount + 1}/${maxReconnect}）`);
    
    this.setData({ reconnectCount: reconnectCount + 1 });
    
    this.data.reconnectTimer = setTimeout(() => {
      this.startOrderWatch();
    }, delay);
  },

  // 启动智能轮询（降级方案）
  startPolling(status = null, filterRefund = false) {
    // 如果已经在轮询，不重复启动
    if (this.data.pollingActive) {
      return;
    }
    
    console.log('【商家订单页面】启动智能轮询');
    this.setData({ pollingActive: true });
    
    // 立即执行一次
    this.pollOrders(status, filterRefund);
    
    // 设置定时轮询
    this.data.pollingTimer = setInterval(() => {
      this.pollOrders(status, filterRefund);
    }, this.getPollingInterval());
  },

  // 停止轮询
  stopPolling() {
    if (this.data.pollingTimer) {
      clearInterval(this.data.pollingTimer);
      this.data.pollingTimer = null;
    }
    this.setData({ pollingActive: false });
    console.log('【商家订单页面】轮询已停止');
  },

  // 轮询订单
  pollOrders(status = null, filterRefund = false) {
    // 检查是否有进行中的订单
    const hasActiveOrders = this.data.orders.some(order => {
      const orderStatus = order.orderStatus;
      return orderStatus === 'pending' || orderStatus === 'confirmed' || 
             orderStatus === 'preparing' || orderStatus === 'delivering';
    });
    
    // 如果没有进行中的订单，停止轮询
    if (!hasActiveOrders) {
      console.log('【商家订单页面】没有进行中的订单，停止轮询');
      this.stopPolling();
      return;
    }
    
    // 检查用户是否在滚动（3秒内滚动过，则跳过本次刷新）
    const now = Date.now();
    const timeSinceScroll = now - (this.data.lastScrollTime || 0);
    if (timeSinceScroll < 3000) {
      console.log('【商家订单页面】用户正在浏览，跳过轮询刷新');
      return;
    }
    
    // 检查滚动位置：如果不在顶部，跳过刷新
    if (this.data.scrollTop > 100) {
      console.log('【商家订单页面】用户已滚动，跳过轮询刷新');
      return;
    }
    
    // 如果不在加载中，则刷新订单
    if (!this.data.loading) {
      console.log('【商家订单页面】轮询刷新订单');
      // 从当前标签获取状态
      const { activeTab } = this.data;
      let currentStatus = null;
      let currentFilterRefund = false;
      this.getStatusFromTab(activeTab, (s, f) => {
        currentStatus = s;
        currentFilterRefund = f;
      });
      this.loadOrders(currentStatus, currentFilterRefund);
    }
  },

  // 获取轮询间隔（根据订单状态）
  getPollingInterval() {
    // 检查是否有进行中的订单
    const hasActiveOrders = this.data.orders.some(order => {
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
        console.log('【商家订单页面】订单监听已停止');
      } catch (error) {
        console.error('【商家订单页面】停止订单监听失败:', error);
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
    console.log('【商家订单页面】下拉刷新');
    // 设置刷新状态
    this.setData({ refreshing: true });
    
    const { activeTab } = this.data;
    let status = null;
    let filterRefund = false;
    
    switch(activeTab) {
      case 0: status = null; filterRefund = false; break;
      case 1: status = 'pending'; filterRefund = false; break;
      case 2: status = 'completed'; filterRefund = false; break;
      case 3: status = 'cancelled'; filterRefund = false; break;
      case 4: status = null; filterRefund = true; break;
    }
    
    // 下拉刷新时不显示loading，使用下拉刷新的原生动画
    this.loadOrders(status, filterRefund, true).finally(() => {
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
  async loadOrders(status = null, filterRefund = false, isPullRefresh = false) {
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

      // 获取当前登录的商家信息
      const merchantInfo = wx.getStorageSync('merchantInfo');
      const merchantId = merchantInfo?._id || null;
      const storeId = merchantInfo?.storeId || null;
      
      console.log('【商家订单页面】当前商家信息:', { merchantId, storeId });
      
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getMerchantOrders',
          data: {
            page: 1,
            pageSize: 100, // 增加数量以确保能获取所有订单
            status: status, // 传递状态参数
            merchantId: merchantId, // 传递商家ID，优先使用
            storeId: storeId // 传递店铺ID
          }
        }
      });

      // 下拉刷新时不隐藏loading（因为没显示）
      if (!isPullRefresh) {
        wx.hideLoading();
      }

      console.log('【商家订单页面】云函数返回结果:', res.result);

      if (res.result && res.result.code === 200) {
        let orders = res.result.data.list.map(order => ({
          id: order._id,
          orderNo: order.orderNo,
          statusText: this.getStatusText(order.orderStatus),
          statusClass: this.getStatusClass(order.orderStatus),
          orderStatus: order.orderStatus,
          remark: order.remark || '',
          deliveryType: order.deliveryType || 'delivery', // 配送方式
          address: order.address ? {
            name: order.address.name,
            phone: order.address.phone,
            addressDetail: order.address.addressDetail || '',
            buildingName: order.address.buildingName || '',
            houseNumber: order.address.houseNumber || '',
            fullAddress: `${order.address.buildingName || ''}${order.address.houseNumber || ''}${order.address.addressDetail || ''}`
          } : null,
          items: (order.items || []).map(item => {
            // 保存原始价格数据（分），用于详情页计算
            const rawPrice = item.price;
            
            // 处理价格：从分转换为元（用于列表显示）
            // 数据库中商品价格统一以分存储，需要除以100转换为元
            let price = item.price;
            if (typeof price === 'number') {
              // 如果价格 >= 100，肯定是分，除以100
              // 如果价格 < 100，可能是分（如96分），也可能是元（旧数据），但商品价格通常 >= 1元 = 100分
              if (price >= 100) {
                price = price / 100;
              } else if (price > 0 && price < 100) {
                // 1-99之间的整数，很可能是分（因为商品价格通常 >= 1元 = 100分）
                price = price / 100;
              }
              // 如果 price < 1，可能已经是元了，直接使用
            } else if (typeof price === 'string') {
              price = parseFloat(price) || 0;
              // 同样的逻辑
              if (price >= 100) {
                price = price / 100;
              } else if (price > 0 && price < 100) {
                price = price / 100;
              }
            }
            
            return {
              ...item,
              _rawPrice: rawPrice, // 保存原始价格
              price: typeof price === 'number' ? price.toFixed(2) : price
            };
          }),
          amountTotal: this.formatAmount(order.amountTotal || order.amountPayable || 0),
          amountGoods: this.formatAmount(order.amountGoods || 0),
          amountDelivery: this.formatAmount(order.amountDelivery || 0),
          // 平台服务费特殊处理：如果值异常或为0，尝试重新计算
          platformFee: (() => {
            const rawFee = order.platformFee || 0;
            const rawGoods = order.amountGoods || 0;
            const platformFeeRate = order.platformFeeRate || 0.08;
            
            // 转换为数字（处理字符串格式的数据）
            let feeNum = typeof rawFee === 'number' ? rawFee : parseFloat(rawFee) || 0;
            let goodsNum = typeof rawGoods === 'number' ? rawGoods : parseFloat(rawGoods) || 0;
            
            // 判断数据单位：如果 rawGoods 是字符串格式的元（如 "65.00"），需要转换为分
            // 或者如果数值 < 1000，可能是元，需要转换为分
            if (typeof rawGoods === 'string' && rawGoods.includes('.')) {
              // 字符串格式且包含小数点，很可能是元，转换为分
              goodsNum = Math.round(goodsNum * 100);
            } else if (goodsNum > 0 && goodsNum < 1000 && goodsNum % 1 !== 0) {
              // 是小数且 < 1000，可能是元，转换为分
              goodsNum = Math.round(goodsNum * 100);
            }
            
            // 同样的逻辑处理平台服务费
            if (typeof rawFee === 'string' && rawFee.includes('.')) {
              feeNum = Math.round(feeNum * 100);
            } else if (feeNum > 0 && feeNum < 1000 && feeNum % 1 !== 0) {
              feeNum = Math.round(feeNum * 100);
            }
            
            // 如果平台服务费为0或异常（大于商品金额），尝试重新计算
            if ((feeNum === 0 || feeNum > goodsNum) && goodsNum > 0) {
              console.warn('【订单列表】平台服务费异常，尝试重新计算:', { 
                originalRawFee: rawFee, 
                originalRawGoods: rawGoods,
                convertedFeeNum: feeNum,
                convertedGoodsNum: goodsNum,
                platformFeeRate 
              });
              // 使用订单中存储的平台服务费比例重新计算（分）
              const recalculatedFee = Math.round(goodsNum * platformFeeRate);
              return this.formatAmount(recalculatedFee);
            }
            
            return this.formatAmount(rawFee);
          })(),
          merchantIncome: this.calculateMerchantIncome(order.amountGoods || 0, order.platformFee || 0, order.merchantIncome), // 商家收入
          amountDiscount: order.amountDiscount || 0,
          expiredAt: order.expiredAt || null,
          expiredMinutes: order.expiredMinutes || null,
          readyAt: order.readyAt || null,
          createdAt: order.createdAt,
          refundInfo: order.refundInfo || null // 退款申请信息
        }));

        // 如果筛选退款订单，只显示有退款申请的订单
        if (filterRefund) {
          orders = orders.filter(order => {
            return order.refundInfo && 
                   (order.refundInfo.status === 'pending' || 
                    order.refundInfo.status === 'processing' || 
                    order.refundInfo.status === 'approved');
          });
        }

        this.setData({
          orders: orders,
          loading: false
        });

        console.log('【商家订单页面】订单加载成功，共', orders.length, '条');
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
      console.error('【商家订单页面】加载异常:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'pending': '待确认',
      'confirmed': '制作中',
      'preparing': '制作中',
      'ready': '商家已出餐',
      'delivering': '骑手正在配送中',
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
      'completed': 'completed',
      'cancelled': 'cancelled'
    };
    return classMap[status] || 'normal';
  },

  onTabTap(e){
    const tabIndex = Number(e.currentTarget.dataset.index);
    this.setData({ activeTab: tabIndex });
    
    // 根据tab索引获取对应状态
    let status = null;
    let filterRefund = false;
    
    switch(tabIndex) {
      case 0: // 全部
        status = null;
        filterRefund = false;
        break;
      case 1: // 待确认
        status = 'pending';
        filterRefund = false;
        break;
      case 2: // 已完成
        status = 'completed';
        filterRefund = false;
        break;
      case 3: // 已取消
        status = 'cancelled';
        filterRefund = false;
        break;
      case 4: // 待退款
        status = null; // 不限制订单状态，只筛选有退款申请的
        filterRefund = true;
        break;
    }
    
    // 重新加载对应状态的订单
    this.loadOrders(status, filterRefund);
  },
  // 联系用户
  onContactUser(e) {
    const orderId = e.currentTarget.dataset.id;
    
    // 优先从订单列表查找
    let order = this.data.orders.find(o => o.id === orderId);
    
    // 如果订单列表中没有，尝试从详情弹窗中获取
    if (!order && this.data.detail && this.data.detail.id === orderId) {
      order = this.data.detail;
    }
    
    if (!order) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none'
      });
      return;
    }

    // 从订单地址信息中获取客户手机号
    const contactPhone = order.address?.phone || '';
    
    if (!contactPhone) {
      wx.showToast({
        title: '客户未设置联系方式',
        icon: 'none'
      });
      return;
    }
    
    // 拨打电话
    wx.makePhoneCall({
      phoneNumber: contactPhone,
      success: () => {
        console.log('【联系用户】拨打电话成功:', contactPhone);
      },
      fail: (err) => {
        console.error('【联系用户】拨打电话失败:', err);
        wx.showToast({
          title: '拨打电话失败',
          icon: 'none'
        });
      }
    });
  },

  // 确认订单（pending -> confirmed）
  async onConfirmOrder(e) {
    // 优先从dataset获取，如果没有则从detail中获取（详情弹窗场景）
    let orderId = e.currentTarget.dataset.id;
    
    // 如果详情弹窗中没有订单ID，从detail中获取
    if (!orderId && this.data.detail && this.data.detail.id) {
      orderId = this.data.detail.id;
    }
    
    // 如果还是没有订单ID，尝试从当前显示的订单列表中查找
    if (!orderId && this.data.detail && this.data.detail.orderNo) {
      const order = this.data.orders.find(o => o.orderNo === this.data.detail.orderNo);
      if (order) {
        orderId = order.id;
      }
    }
    
    console.log('【商家订单页面】确认订单，orderId:', orderId);
    
    if (!orderId) {
      wx.showToast({
        title: '缺少订单ID',
        icon: 'none'
      });
      console.error('【商家订单页面】无法获取订单ID');
      return;
    }
    
    try {
      wx.showLoading({ title: '处理中...' });

      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'updateOrderStatus',
          data: {
            orderId: orderId,
            status: 'confirmed'
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '已确认',
          icon: 'success'
        });
        
        // 关闭详情弹窗
        this.setData({ showDetail: false });
        
        // 刷新订单列表，保持当前标签状态
        const { activeTab } = this.data;
        let status = null;
        let filterRefund = false;
        
        switch(activeTab) {
          case 0: status = null; filterRefund = false; break;
          case 1: status = 'pending'; filterRefund = false; break;
          case 2: status = 'completed'; filterRefund = false; break;
          case 3: status = 'cancelled'; filterRefund = false; break;
          case 4: status = null; filterRefund = true; break;
        }
        
        this.loadOrders(status, filterRefund);
      } else {
        wx.showToast({
          title: res.result?.message || '操作失败',
          icon: 'none'
        });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('【商家订单页面】确认订单异常:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  // 已出餐（confirmed/preparing -> ready）
  async onCompleteOrder(e) {
    // 优先从dataset获取，如果没有则从detail中获取（详情弹窗场景）
    let orderId = e.currentTarget.dataset.id;
    
    // 如果详情弹窗中没有订单ID，从detail中获取
    if (!orderId && this.data.detail && this.data.detail.id) {
      orderId = this.data.detail.id;
    }
    
    // 如果还是没有订单ID，尝试从当前显示的订单列表中查找
    if (!orderId && this.data.detail && this.data.detail.orderNo) {
      const order = this.data.orders.find(o => o.orderNo === this.data.detail.orderNo);
      if (order) {
        orderId = order.id;
      }
    }
    
    console.log('【商家订单页面】已出餐，orderId:', orderId);
    
    if (!orderId) {
      wx.showToast({
        title: '缺少订单ID',
        icon: 'none'
      });
      console.error('【商家订单页面】无法获取订单ID');
      return;
    }
    
    try {
      wx.showLoading({ title: '处理中...' });

      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'updateOrderStatus',
          data: {
            orderId: orderId,
            status: 'ready' // 商家出餐，订单状态更新为ready（商家已出餐）
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '已出餐',
          icon: 'success'
        });
        
        // 关闭详情弹窗（如果打开）
        this.setData({ showDetail: false });
        
        // 刷新订单列表
        this.loadOrders();
      } else {
        wx.showToast({
          title: res.result?.message || '操作失败',
          icon: 'none'
        });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('【商家订单页面】出餐异常:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },
  onOpenDetail(e){
    const id = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o=>o.id===id);
    
    if (!order) {
      console.error('【商家订单页面】订单不存在，id:', id);
      return;
    }
    
    // 格式化详情数据，保存订单ID以便后续操作使用
    const detail = {
      id: order.id, // 保存订单ID，用于详情弹窗中的操作
      orderId: order.id, // 兼容字段
      orderStatus: order.orderStatus, // 保存订单状态，用于判断显示哪个按钮
      deskNo: order.orderNo ? order.orderNo.substring(order.orderNo.length - 3) : '001',
      statusText: order.statusText,
      orderNo: order.orderNo,
      remark: order.remark,
      deliveryType: order.deliveryType || 'delivery', // 配送方式
      items: order.items.map(item => {
        // 处理价格：从分转换为元
        // 优先使用原始价格数据（_rawPrice），如果没有则使用已处理的价格
        let price = item._rawPrice !== undefined ? item._rawPrice : item.price;
        
        // 如果已经是格式化好的字符串（包含小数点），说明已经被处理过了
        // 需要从原始数据重新处理
        if (typeof price === 'string' && /^\d+\.\d{2}$/.test(price.trim())) {
          // 如果原始数据也是字符串格式，尝试解析
          const numPrice = parseFloat(price);
          if (!isNaN(numPrice)) {
            price = numPrice;
            // 如果解析后的值 < 100，可能是元（旧数据），需要乘以100转换为分再处理
            // 但如果值很大（>= 100），可能是分（错误存储）
            if (numPrice > 0 && numPrice < 100 && numPrice % 1 !== 0) {
              // 是小数且 < 100，可能是元，乘以100转换为分
              price = Math.round(numPrice * 100);
            }
          }
        }
        
        // 从分转换为元
        // 数据库中商品价格统一以分存储，需要除以100转换为元
        if (typeof price === 'number') {
          // 如果价格 >= 100，肯定是分，除以100
          // 如果价格 < 100，可能是分（如96分），也可能是元（旧数据），但商品价格通常 >= 1元 = 100分
          if (price >= 100) {
            price = price / 100;
          } else if (price > 0 && price < 100) {
            // 1-99之间的整数，很可能是分（因为商品价格通常 >= 1元 = 100分）
            price = price / 100;
          }
          // 如果 price < 1，可能已经是元了，直接使用
        } else if (typeof price === 'string') {
          price = parseFloat(price) || 0;
          // 同样的逻辑
          if (price >= 100) {
            price = price / 100;
          } else if (price > 0 && price < 100) {
            price = price / 100;
          }
        }
        
        return {
          name: item.productName,
          img: item.image || '',
          price: typeof price === 'number' ? price.toFixed(2) : price,
          qty: item.quantity,
          spec: item.spec || '' // 保留规格信息
        };
      }),
      address: order.address,
      amountGoods: this.formatAmount(order.amountGoods || 0),
      amountDelivery: this.formatAmount(order.amountDelivery || 0),
      // 平台服务费特殊处理：如果值异常或为0，尝试重新计算
      platformFee: (() => {
        const rawFee = order.platformFee || 0;
        const rawGoods = order.amountGoods || 0;
        const platformFeeRate = order.platformFeeRate || 0.08;
        
        // 转换为数字（处理字符串格式的数据）
        let feeNum = typeof rawFee === 'number' ? rawFee : parseFloat(rawFee) || 0;
        let goodsNum = typeof rawGoods === 'number' ? rawGoods : parseFloat(rawGoods) || 0;
        
        // 判断数据单位：如果 rawGoods 是字符串格式的元（如 "65.00"），需要转换为分
        // 或者如果数值 < 1000，可能是元，需要转换为分
        if (typeof rawGoods === 'string' && rawGoods.includes('.')) {
          // 字符串格式且包含小数点，很可能是元，转换为分
          goodsNum = Math.round(goodsNum * 100);
        } else if (goodsNum > 0 && goodsNum < 1000 && goodsNum % 1 !== 0) {
          // 是小数且 < 1000，可能是元，转换为分
          goodsNum = Math.round(goodsNum * 100);
        }
        
        // 同样的逻辑处理平台服务费
        if (typeof rawFee === 'string' && rawFee.includes('.')) {
          feeNum = Math.round(feeNum * 100);
        } else if (feeNum > 0 && feeNum < 1000 && feeNum % 1 !== 0) {
          feeNum = Math.round(feeNum * 100);
        }
        
        // 如果平台服务费为0或异常（大于商品金额），尝试重新计算
        if ((feeNum === 0 || feeNum > goodsNum) && goodsNum > 0) {
          console.warn('【订单详情】平台服务费异常，尝试重新计算:', { 
            originalRawFee: rawFee, 
            originalRawGoods: rawGoods,
            convertedFeeNum: feeNum,
            convertedGoodsNum: goodsNum,
            platformFeeRate 
          });
          // 使用订单中存储的平台服务费比例重新计算（分）
          const recalculatedFee = Math.round(goodsNum * platformFeeRate);
          return this.formatAmount(recalculatedFee);
        }
        
        return this.formatAmount(rawFee);
      })(),
      amountDiscount: order.amountDiscount || 0,
      amountTotal: this.formatAmount(order.amountTotal || order.amountPayable || 0),
      merchantIncome: this.calculateMerchantIncome(order.amountGoods || 0, order.platformFee || 0, order.merchantIncome), // 商家收入
      needCutlery: order.needCutlery !== undefined ? order.needCutlery : true, // 是否需要餐具
      cutleryQuantity: order.cutleryQuantity || 0, // 餐具数量
      expiredAt: order.expiredAt || null,
      expiredMinutes: order.expiredMinutes || null,
      readyAt: order.readyAt || null,
      createdAt: this.formatDateTime(order.createdAt),
      refundInfo: order.refundInfo || null // 退款申请信息
    };
    
    this.setData({ showDetail: true, detail: detail });
  },
  
  // 格式化金额（处理分和元的转换）
  formatAmount(amount) {
    if (typeof amount === 'number') {
      // 数据库中金额统一以分存储（整数）
      // 判断逻辑：
      // 1. 如果金额 >= 100，肯定是分，除以100
      // 2. 如果金额是整数且 >= 1，也认为是分（因为订单金额通常 >= 1元 = 100分，小于100的整数更可能是分）
      // 3. 如果金额是小数，已经是元了，直接使用
      if (amount === 0) {
        return '0.00';
      } else if (amount >= 100) {
        // 大于等于100，肯定是分，除以100
        return (amount / 100).toFixed(2);
      } else if (amount % 1 === 0 && amount >= 1) {
        // 1-99之间的整数，认为是分（因为订单金额通常 >= 1元 = 100分）
        return (amount / 100).toFixed(2);
      } else {
        // 是小数或 < 1，已经是元了
        return amount.toFixed(2);
      }
    }
    if (typeof amount === 'string') {
      // 如果已经是格式化好的字符串（包含小数点），直接返回
      if (/^\d+\.\d{2}$/.test(amount.trim())) {
        return amount;
      }
      const numAmount = parseFloat(amount);
      if (isNaN(numAmount)) {
        return '0.00';
      }
      // 同样的逻辑
      if (numAmount === 0) {
        return '0.00';
      } else if (numAmount >= 100) {
        return (numAmount / 100).toFixed(2);
      } else if (numAmount % 1 === 0 && numAmount >= 1) {
        return (numAmount / 100).toFixed(2);
      } else {
        return numAmount.toFixed(2);
      }
    }
    return '0.00';
  },

  // 计算商家收入
  calculateMerchantIncome(amountGoods, platformFee, merchantIncome) {
    // 如果订单中已有商家收入字段，直接使用
    if (merchantIncome) {
      return this.formatAmount(merchantIncome);
    }
    
    // 否则计算：商家收入 = 商品金额 - 平台服务费
    // 先将分转换为元（使用formatAmount的逻辑）
    const convertToYuan = (value) => {
      if (typeof value === 'number') {
        if (value === 0) return 0;
        if (value >= 100) return value / 100;
        if (value % 1 === 0 && value >= 1) return value / 100;
        return value;
      }
      const num = parseFloat(value);
      if (isNaN(num)) return 0;
      if (num >= 100) return num / 100;
      if (num % 1 === 0 && num >= 1) return num / 100;
      return num;
    };
    
    const goodsAmount = convertToYuan(amountGoods);
    const feeAmount = convertToYuan(platformFee);
    const income = goodsAmount - feeAmount;
    return income.toFixed(2);
  },

  // 格式化日期时间
  formatDateTime(dateStr) {
    if (!dateStr) return '';
    
    let d;
    
    // 处理云数据库的Date对象（有getTime方法）
    if (dateStr.getTime && typeof dateStr.getTime === 'function') {
      d = new Date(dateStr.getTime());
    } else if (dateStr instanceof Date) {
      d = dateStr;
    } else if (typeof dateStr === 'string') {
      // 处理字符串格式的日期
      let dateString = dateStr;
      // 兼容ISO格式和空格格式
      if (dateString.includes(' ') && !dateString.includes('T')) {
        // 检查是否有时区信息（Z结尾或包含时区偏移如+08:00）
        const hasTimezone = dateString.endsWith('Z') || 
                           /[+-]\d{2}:?\d{2}$/.test(dateString) ||
                           dateString.match(/[+-]\d{4}$/);
        
        if (!hasTimezone) {
          // 如果没有时区信息，假设是UTC时间（云数据库通常返回UTC时间），添加Z后缀
          dateString = dateString.replace(' ', 'T') + 'Z';
        } else {
          dateString = dateString.replace(' ', 'T');
        }
      }
      d = new Date(dateString);
    } else if (typeof dateStr === 'object' && dateStr.type === 'date') {
      // 处理云数据库的特殊日期对象格式
      if (dateStr.date) {
        d = new Date(dateStr.date);
      } else {
        d = new Date(dateStr);
      }
    } else {
      d = new Date(dateStr);
    }
    
    // 验证日期是否有效
    if (isNaN(d.getTime())) {
      console.warn('【格式化日期时间】无效的日期:', dateStr);
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
    const hours = String(chinaTime.getUTCHours()).padStart(2, '0');
    const minutes = String(chinaTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(chinaTime.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  },
  onCloseDetail(){ this.setData({ showDetail: false }); },
  onCancelOrder(){ wx.showToast({ title:'已取消', icon:'none' }); this.setData({ showDetail:false }); },
  
  // 同意退款
  async onApproveRefund() {
    const refundInfo = this.data.detail?.refundInfo;
    if (!refundInfo || !refundInfo.refundId) {
      wx.showToast({
        title: '退款信息不存在',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认同意退款',
      content: `确定同意退款申请吗？退款金额：¥${refundInfo.refundAmount}`,
      success: async (res) => {
        if (res.confirm) {
          await this.updateRefundStatus(refundInfo.refundId, 'approved');
        }
      }
    });
  },

  // 拒绝退款
  async onRejectRefund() {
    const refundInfo = this.data.detail?.refundInfo;
    if (!refundInfo || !refundInfo.refundId) {
      wx.showToast({
        title: '退款信息不存在',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认拒绝退款',
      content: '确定拒绝退款申请吗？',
      success: async (res) => {
        if (res.confirm) {
          await this.updateRefundStatus(refundInfo.refundId, 'rejected');
        }
      }
    });
  },

  // 更新退款状态
  async updateRefundStatus(refundId, status) {
    try {
      wx.showLoading({ title: '处理中...' });

      const res = await wx.cloud.callFunction({
        name: 'refundManage',
        data: {
          action: 'updateRefundStatus',
          data: {
            refundId: refundId,
            status: status,
            remark: status === 'approved' ? '商家已同意退款' : '商家已拒绝退款'
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: status === 'approved' ? '已同意退款' : '已拒绝退款',
          icon: 'success'
        });

        // 关闭详情弹窗
        this.setData({ showDetail: false });

        // 刷新订单列表，保持当前标签状态
        const { activeTab } = this.data;
        let status = null;
        let filterRefund = false;
        
        switch(activeTab) {
          case 0: status = null; filterRefund = false; break;
          case 1: status = 'pending'; filterRefund = false; break;
          case 2: status = 'completed'; filterRefund = false; break;
          case 3: status = 'cancelled'; filterRefund = false; break;
          case 4: status = null; filterRefund = true; break;
        }
        
        this.loadOrders(status, filterRefund);
      } else {
        wx.showToast({
          title: res.result?.message || '操作失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('【商家订单页面】更新退款状态异常:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  // 查看退款申请（点击申请退款按钮）
  onViewRefund(e) {
    const orderId = e.currentTarget.dataset.id;
    if (orderId) {
      wx.navigateTo({
        url: `/subpackages/merchant/pages/merchant-refund-detail/index?orderId=${orderId}`,
        fail: (err) => {
          console.error('跳转到商家退款详情页面失败:', err);
          // 如果subpackage路径失败，尝试主包路径
          wx.navigateTo({
            url: `/pages/merchant-refund-detail/index?orderId=${orderId}`,
            fail: (err2) => {
              console.error('跳转到商家退款详情页面失败（主包路径）:', err2);
              wx.showToast({
                title: '跳转失败',
                icon: 'none'
              });
            }
          });
        }
      });
    } else {
      wx.showToast({
        title: '订单ID缺失',
        icon: 'none'
      });
    }
  },

  // 预览退款图片
  onPreviewRefundImage(e) {
    const index = e.currentTarget.dataset.index;
    const refundInfo = this.data.detail?.refundInfo;
    if (refundInfo && refundInfo.images && refundInfo.images.length > 0) {
      wx.previewImage({
        current: refundInfo.images[index],
        urls: refundInfo.images
      });
    }
  },
  
  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },
  
  onBottomTap(e){
    const tab = e.currentTarget.dataset.tab;
    this.setData({ bottomActive: tab });
    if(tab==='workbench'){
      wx.reLaunch({ url: '/subpackages/merchant/pages/merchant-workbench/index' });
    } else if(tab==='mine'){
      wx.reLaunch({ url: '/subpackages/merchant/pages/merchant-mine/index' });
    }
  }
});


