Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    orders: [],
    allOrders: [], // 存储所有订单
    filteredOrders: [], // 过滤后的订单
    loading: false,
    refreshing: false, // 下拉刷新状态
    selectedCategory: 'all', // 当前选中的分类
    categories: [
      { id: 'all', name: '全部订单', icon: '✓' },
      { id: 'express', name: '代拿快递', icon: '📦' },
      { id: 'gaming', name: '游戏陪玩', icon: '🎮' },
      { id: 'reward', name: '悬赏', icon: '💰' }
    ]
  },

  onLoad() {
    console.log('【历史订单页面】页面加载');
    this.loadOrders();
  },

  onShow() {
    console.log('【历史订单页面】页面显示，刷新订单');
    this.loadOrders();
  },

  // 下拉刷新
  onPullDownRefresh() {
    console.log('【历史订单页面】下拉刷新');
    this.setData({ refreshing: true });
    
    this.loadOrders(true).finally(() => {
      this.setData({ refreshing: false });
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      });
    });
  },

  // 加载订单列表
  async loadOrders(isPullRefresh = false) {
    if (this.data.loading) {
      return Promise.resolve();
    }
    
    this.setData({ loading: true });

    try {
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

      if (!isPullRefresh) {
        wx.hideLoading();
      }

      console.log('【历史订单页面】云函数返回结果:', res.result);

      if (res.result && res.result.code === 200) {
        const orderList = res.result.data?.list || [];
        
        if (!Array.isArray(orderList)) {
          console.error('【历史订单页面】订单列表格式错误:', orderList);
          wx.showToast({
            title: '订单数据格式错误',
            icon: 'none'
          });
          this.setData({ loading: false });
          return;
        }

        // 查询退款信息
        let refundsMap = {};
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
          console.error('【历史订单页面】查询退款信息失败:', error);
        }

        const orders = orderList.map(order => {
          // 处理订单商品列表
          let orderItems = [];
          
          if (order.orderType === 'express') {
            if (order.packageSizes && Array.isArray(order.packageSizes)) {
              orderItems = order.packageSizes.map(pkg => ({
                name: `${pkg.name}(${pkg.description}) x${pkg.quantity}`,
                spec: '',
                quantity: pkg.quantity
              }));
            }
          } else if (order.orderType === 'gaming') {
            const requirements = order.selectedRequirements && order.selectedRequirements.length > 0 
              ? order.selectedRequirements.join('、') 
              : (order.requirements || '');
            orderItems = [{
              name: `${order.gameType} - ${order.sessionDuration}小时`,
              spec: requirements ? `要求：${requirements}` : '',
              quantity: 1
            }];
          } else if (order.orderType === 'reward') {
            orderItems = [{
              name: `${order.category || '悬赏任务'}`,
              spec: order.helpContent ? `内容：${order.helpContent}` : '',
              quantity: 1
            }];
          } else {
            if (order.items && Array.isArray(order.items)) {
              orderItems = order.items.map(item => ({
                productId: item.productId,
                productName: item.productName || item.name || '商品',
                name: `${item.productName || item.name || '商品'}${item.spec ? '(' + item.spec + ')' : ''} x${item.quantity || 1}`,
                spec: item.spec || '',
                quantity: item.quantity || 1,
                price: item.price ? (item.price >= 100 ? item.price / 100 : item.price) : 0,
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
            storeId: order.storeId,
            storeName: storeName,
            orderType: order.orderType || 'normal',
            date: this.formatDate(order.createdAt),
            status: this.getStatusText(order.orderStatus, order.riderOpenid, order.payStatus || 'unpaid'),
            statusClass: this.getStatusClass(order.orderStatus),
            orderStatus: order.orderStatus,
            payStatus: order.payStatus || 'unpaid',
            img: order.items && order.items[0] ? order.items[0].image : (order.images && order.images[0] ? order.images[0] : ''),
            total: this.formatAmount(order.amountPayable || order.amountTotal || '0.00'),
            amountGoods: this.formatAmount(order.amountGoods || '0.00'),
            amountDelivery: this.formatAmount(order.amountDelivery || '0.00'),
            platformFee: this.formatAmount(order.platformFee || '0.00'),
            items: orderItems,
            rawItems: order.items || [],
            address: order.address ? {
              fullAddress: `${order.address.buildingName || ''}${order.address.houseNumber || ''}${order.address.addressDetail || ''}`,
              name: order.address.name,
              phone: order.address.phone
            } : null,
            pickupLocation: order.pickupLocation || null,
            deliveryLocation: order.deliveryLocation || null,
            pickupCode: order.pickupCode || null,
            gameType: order.gameType || null,
            sessionDuration: order.sessionDuration || null,
            requirements: order.requirements || null,
            helpLocation: order.helpLocation || null,
            helpContent: order.helpContent || null,
            category: order.category || null,
            refundStatus: refundStatus,
            refundStatusText: refundStatusText,
            refundStatusClass: refundStatusClass,
            refundInfo: refundInfo || null
          };
        });

        this.setData({
          orders: orders,
          allOrders: orders,
          filteredOrders: orders,
          loading: false
        });

        this.filterOrdersByCategory();

        console.log('【历史订单页面】订单加载成功，共', orders.length, '条');
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
      console.error('【历史订单页面】加载异常:', error);
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
      filteredOrders = allOrders;
    } else if (selectedCategory === 'express') {
      filteredOrders = allOrders.filter(order => order.orderType === 'express');
    } else if (selectedCategory === 'gaming') {
      filteredOrders = allOrders.filter(order => 
        order.orderType === 'gaming' || 
        (order.storeName && order.storeName.includes('游戏'))
      );
    } else if (selectedCategory === 'reward') {
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
      return;
    }
    
    this.setData({
      selectedCategory: categoryId
    });
    
    this.filterOrdersByCategory();
  },

  // 格式化金额
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

  // 格式化日期
  formatDate(date) {
    if (!date) return '';
    
    if (typeof date === 'string') {
      const formattedPattern = /^(\d{4})-(\d{2})-(\d{2})( \d{2}:\d{2}(:\d{2})?)?$/;
      const match = date.match(formattedPattern);
      if (match && !date.includes('T') && !date.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(date)) {
        const year = match[1];
        const month = match[2];
        const day = match[3];
        return `${year}.${month}.${day}`;
      }
    }
    
    let d;
    
    if (date && typeof date === 'object' && date.getTime && typeof date.getTime === 'function') {
      d = new Date(date.getTime());
    } else if (date && typeof date === 'object' && date.getFullYear) {
      d = date;
    } else if (typeof date === 'string') {
      let dateStr = date;
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
      if (dateStr.includes('-') && !dateStr.includes('T') && !dateStr.includes('Z')) {
        dateStr = dateStr.replace(/(\d{4})-(\d{2})-(\d{2})/, '$1/$2/$3');
      }
      d = new Date(dateStr);
    } else if (typeof date === 'object' && date.type === 'date') {
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
    
    const chinaTimeOffset = 8 * 60 * 60 * 1000;
    const chinaTime = new Date(d.getTime() + chinaTimeOffset);
    
    const year = chinaTime.getUTCFullYear();
    const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(chinaTime.getUTCDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  },

  // 获取状态文本
  getStatusText(status, riderOpenid, payStatus) {
    if (payStatus === 'unpaid' && status !== 'cancelled') {
      return '待支付';
    }
    
    if (status === 'confirmed' && riderOpenid) {
      return '骑手已接单';
    }
    
    const statusMap = {
      'pending': '待确认',
      'confirmed': '已确认',
      'preparing': '制作中',
      'ready': '待配送',
      'delivering': '配送中',
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

  // 点击订单
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

  // 返回
  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/pages/profile/index' });
    }
  }
});

