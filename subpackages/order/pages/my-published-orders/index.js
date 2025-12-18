Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    orders: [],
    loading: false,
    refreshing: false,
    currentUserOpenid: null
  },

  onLoad() {
    console.log('【我发布的订单页面】页面加载');
    this.getCurrentUserOpenid();
    this.loadOrders();
  },

  onShow() {
    console.log('【我发布的订单页面】页面显示，刷新订单');
    this.loadOrders();
  },

  // 获取当前用户openid
  async getCurrentUserOpenid() {
    try {
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo && userInfo.openid) {
        this.setData({
          currentUserOpenid: userInfo.openid
        });
      } else {
        const app = getApp();
        if (app.globalData.userInfo && app.globalData.userInfo.openid) {
          this.setData({
            currentUserOpenid: app.globalData.userInfo.openid
          });
        }
      }
    } catch (error) {
      console.error('【我发布的订单页面】获取用户openid失败:', error);
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    console.log('【我发布的订单页面】下拉刷新');
    this.setData({ refreshing: true });
    this.loadOrders(true).finally(() => {
      this.setData({ refreshing: false });
      wx.stopPullDownRefresh();
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
          action: 'getMyPublishedOrders',
          data: {
            page: 1,
            pageSize: 50
          }
        }
      });

      if (!isPullRefresh) {
        wx.hideLoading();
      }

      console.log('【我发布的订单页面】云函数返回结果:', res.result);

      if (res.result && res.result.code === 200) {
        const orderList = res.result.data?.list || [];
        
        const orders = orderList.map(order => ({
          id: order._id,
          orderNo: order.orderNo,
          orderType: order.orderType,
          orderTypeText: this.getOrderTypeText(order.orderType),
          statusText: this.getStatusText(order.orderStatus),
          statusClass: this.getStatusClass(order.orderStatus),
          orderStatus: order.orderStatus,
          createdAt: this.formatDateTime(order.createdAt),
          expiredAt: order.expiredAt || null,
          expiredMinutes: order.expiredMinutes || null,
          expiredAtDisplay: this.formatExpiredAtDisplay(order.expiredAt),
          amountTotal: order.amountTotal || '0.00',
          // 游戏陪玩订单信息
          gameType: order.gameType || null,
          sessionDuration: order.sessionDuration || null,
          requirements: order.requirements || null,
          selectedRequirements: order.selectedRequirements || null,
          // 悬赏订单信息
          category: order.category || null,
          helpLocation: order.helpLocation || null,
          helpContent: order.helpContent || null,
          images: order.images || null,
          // 代拿快递订单信息
          pickupLocation: order.pickupLocation || null,
          deliveryLocation: order.deliveryLocation || null,
          pickupCode: order.pickupCode || null,
          packageSizes: order.packageSizes || null,
          bounty: order.bounty || null,
          // 接单者信息
          receiverOpenid: order.receiverOpenid || null,
          receiverId: order.receiverId || null,
          receiverInfo: order.receiverInfo || null,
          receiverConfirmedAt: order.receiverConfirmedAt || null,
          receiverCompletedAt: order.receiverCompletedAt || null,
          userConfirmedAt: order.userConfirmedAt || null
        }));

        this.setData({
          orders: orders,
          loading: false
        });

        console.log('【我发布的订单页面】订单加载成功，共', orders.length, '条');
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
      console.error('【我发布的订单页面】加载异常:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 获取订单类型文本
  getOrderTypeText(orderType) {
    const typeMap = {
      'gaming': '游戏陪玩',
      'reward': '悬赏',
      'express': '代拿快递'
    };
    return typeMap[orderType] || '未知';
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'pending': '待接单',
      'received': '已接单',
      'confirmed_by_receiver': '进行中',
      'waiting_user_confirm': '待确认完成',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    return statusMap[status] || '未知状态';
  },

  // 获取状态样式类
  getStatusClass(status) {
    const classMap = {
      'pending': 'pending',
      'received': 'received',
      'confirmed_by_receiver': 'in-progress',
      'waiting_user_confirm': 'waiting-confirm',
      'completed': 'completed',
      'cancelled': 'cancelled'
    };
    return classMap[status] || 'normal';
  },

  // 格式化日期时间
  formatDateTime(dateStr) {
    if (!dateStr) return '';
    
    let d;
    if (dateStr.getTime && typeof dateStr.getTime === 'function') {
      d = new Date(dateStr.getTime());
    } else if (dateStr instanceof Date) {
      d = dateStr;
    } else if (typeof dateStr === 'string') {
      let dateString = dateStr;
      if (dateString.includes(' ') && !dateString.includes('T')) {
        const hasTimezone = dateString.endsWith('Z') || 
                           /[+-]\d{2}:?\d{2}$/.test(dateString) ||
                           dateString.match(/[+-]\d{4}$/);
        if (!hasTimezone) {
          dateString = dateString.replace(' ', 'T') + 'Z';
        } else {
          dateString = dateString.replace(' ', 'T');
        }
      }
      d = new Date(dateString);
    } else if (typeof dateStr === 'object' && dateStr.type === 'date') {
      if (dateStr.date) {
        d = new Date(dateStr.date);
      } else {
        d = new Date(dateStr);
      }
    } else {
      d = new Date(dateStr);
    }
    
    if (isNaN(d.getTime())) {
      return '';
    }
    
    const chinaTimeOffset = 8 * 60 * 60 * 1000;
    const chinaTime = new Date(d.getTime() + chinaTimeOffset);
    
    const year = chinaTime.getUTCFullYear();
    const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(chinaTime.getUTCDate()).padStart(2, '0');
    const hours = String(chinaTime.getUTCHours()).padStart(2, '0');
    const minutes = String(chinaTime.getUTCMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  },

  // 格式化截止时间显示
  formatExpiredAtDisplay(expiredAt) {
    if (!expiredAt) return '';
    
    try {
      let expiredDate;
      if (expiredAt instanceof Date) {
        expiredDate = expiredAt;
      } else if (expiredAt && expiredAt.getTime && typeof expiredAt.getTime === 'function') {
        expiredDate = new Date(expiredAt.getTime());
      } else if (typeof expiredAt === 'string') {
        expiredDate = new Date(expiredAt.replace(' ', 'T'));
      } else if (typeof expiredAt === 'object' && expiredAt.type === 'date') {
        expiredDate = new Date(expiredAt.date || expiredAt);
      } else {
        return '';
      }
      
      if (isNaN(expiredDate.getTime())) {
        if (typeof expiredAt === 'string') {
          const dateString = expiredAt.includes(' ') ? expiredAt.replace(' ', 'T') + 'Z' : expiredAt;
          expiredDate = new Date(dateString);
        }
        if (isNaN(expiredDate.getTime())) {
          return '';
        }
      }
      
      const now = new Date();
      const chinaTimeOffset = 8 * 60 * 60 * 1000;
      const expiredChinaTime = new Date(expiredDate.getTime() + chinaTimeOffset);
      const nowChinaTime = new Date(now.getTime());
      
      const diff = expiredChinaTime.getTime() - nowChinaTime.getTime();
      
      if (diff < 0) {
        return '已过期';
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const month = expiredChinaTime.getMonth() + 1;
      const date = expiredChinaTime.getDate();
      const hoursStr = String(expiredChinaTime.getHours()).padStart(2, '0');
      const minutesStr = String(expiredChinaTime.getMinutes()).padStart(2, '0');
      
      if (days === 0) {
        return `今天 ${hoursStr}:${minutesStr}截止`;
      } else if (days === 1) {
        return `明天 ${hoursStr}:${minutesStr}截止`;
      } else {
        return `${month}/${date} ${hoursStr}:${minutesStr}截止`;
      }
    } catch (error) {
      console.error('格式化截止时间失败:', error, expiredAt);
      return '';
    }
  },

  // 用户确认订单完成
  async onUserConfirmComplete(e) {
    const orderId = e.currentTarget.dataset.id;
    
    if (!orderId) {
      wx.showToast({
        title: '缺少订单ID',
        icon: 'none'
      });
      return;
    }
    
    try {
      wx.showLoading({ title: '处理中...' });

      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'userConfirmComplete',
          data: {
            orderId: orderId
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '确认完成成功',
          icon: 'success'
        });
        
        this.loadOrders();
      } else {
        wx.showToast({
          title: res.result?.message || '操作失败',
          icon: 'none'
        });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('【我发布的订单页面】用户确认订单完成异常:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  // 联系接单者
  async onContactReceiver(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o.id === orderId);
    
    if (!order || !order.receiverInfo) {
      wx.showToast({
        title: '暂无接单者信息',
        icon: 'none'
      });
      return;
    }

    const toUserId = order.receiverId;
    const toUserName = order.receiverInfo.nickname || '接单者';
    
    if (!toUserId) {
      wx.showToast({
        title: '暂无联系方式',
        icon: 'none'
      });
      return;
    }

    // 确定消息类型
    const messageType = order.orderType === 'express' ? 'express' : 
                       order.orderType === 'gaming' ? 'gaming' : 
                       order.orderType === 'reward' ? 'reward' : 'order';
    
    // 创建消息记录
    try {
      await wx.cloud.callFunction({
        name: 'messageManage',
        data: {
          action: 'createMessage',
          data: {
            toUserId: toUserId,
            toUserName: toUserName,
            messageType: messageType,
            relatedId: orderId,
            relatedTitle: `订单 ${order.orderNo || orderId}`,
            contactAction: 'message'
          }
        }
      });
    } catch (err) {
      console.error('【我发布的订单页面】创建消息记录失败:', err);
    }
    
    // 跳转到聊天页面
    wx.navigateTo({
      url: `/pages/chat/index?toUserId=${toUserId}&toUserName=${encodeURIComponent(toUserName)}&messageType=${messageType}&relatedId=${orderId}&relatedTitle=${encodeURIComponent(`订单 ${order.orderNo || orderId}`)}`
    });
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 返回
  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({ url: '/subpackages/order/pages/receive-order/index' });
    }
  }
});

