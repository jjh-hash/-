Page({
  data:{
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    activeTab: 0,
    bottomActive: 'receive',
    orders: [],
    loading: true,
    tabs: ['全部', '待确认', '已完成', '已取消']
  },

  onLoad() {
    console.log('【接单页面】主包页面加载，统一重定向至分包任务大厅');
    wx.redirectTo({
      url: '/subpackages/order/pages/receive-order/index',
      fail: () => { this.loadOrders(); }
    });
  },

  onShow() {
    console.log('【接单页面】页面显示，刷新订单');
    this.loadOrders();
  },

  // 加载订单列表
  async loadOrders(status = null) {
    this.setData({ loading: true });

    try {
      wx.showLoading({ title: '加载中...' });

      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getReceiveOrders',
          data: {
            page: 1,
            pageSize: 50,
            status: status
          }
        }
      });

      wx.hideLoading();

      console.log('【接单页面】云函数返回结果:', res.result);

      if (res.result && res.result.code === 200) {
        const orders = res.result.data.list.map(order => ({
          id: order._id,
          orderNo: order.orderNo,
          orderType: order.orderType, // 订单类型
          statusText: this.getStatusText(order.orderStatus),
          statusClass: this.getStatusClass(order.orderStatus),
          orderStatus: order.orderStatus,
          remark: order.remark || order.remarks || '',
          address: order.address ? {
            name: order.address.name,
            phone: order.address.phone,
            addressDetail: order.address.addressDetail || order.address.address || '',
            buildingName: order.address.buildingName || '',
            houseNumber: order.address.houseNumber || '',
            fullAddress: `${order.address.buildingName || ''}${order.address.houseNumber || ''}${order.address.addressDetail || order.address.address || ''}`
          } : null,
          items: order.items || [],
          amountTotal: order.amountTotal || order.amountPayable || '0.00',
          amountGoods: order.amountGoods || '0.00',
          amountDelivery: order.amountDelivery || '0.00',
          platformFee: order.platformFee || '0.00',
          amountDiscount: order.amountDiscount || 0,
          expiredAt: order.expiredAt || null,
          expiredMinutes: order.expiredMinutes || null,
          readyAt: order.readyAt || null,
          createdAt: order.createdAt,
          // 订单特有信息
          userInfo: order.userInfo || null,
          gameType: order.gameType || null,
          sessionDuration: order.sessionDuration || null,
          requirements: order.requirements || null,
          helpLocation: order.helpLocation || null,
          helpContent: order.helpContent || null,
          category: order.category || null,
          pickupLocation: order.pickupLocation || null,
          deliveryLocation: order.deliveryLocation || null
        }));

        this.setData({
          orders: orders,
          loading: false
        });

        console.log('【接单页面】订单加载成功，共', orders.length, '条');
      } else {
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('【接单页面】加载异常:', error);
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
      'completed': 'completed',
      'cancelled': 'cancelled'
    };
    return classMap[status] || 'normal';
  },

  onBottomTap(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === 'home') {
      wx.reLaunch({
        url: '/pages/home/index'
      });
    } else if (tab === 'order') {
      wx.reLaunch({
        url: '/subpackages/order/pages/order/index'
      });
    } else if (tab === 'receive') {
      // 接单功能正在开发中
      wx.showToast({
        title: '正在开发中',
        icon: 'none',
        duration: 2000
      });
      // 当前页面，不跳转
      // return;
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
  },

onTabTap(e){
    const tabIndex = Number(e.currentTarget.dataset.index);
    this.setData({ activeTab: tabIndex });
    
    // 根据tab索引获取对应状态
    let status = null;
    switch(tabIndex) {
      case 0: // 全部
        status = null;
        break;
      case 1: // 待确认
        status = 'pending';
        break;
      case 2: // 已完成
        status = 'completed';
        break;
      case 3: // 已取消
        status = 'cancelled';
        break;
    }
    
    // 重新加载对应状态的订单
    this.loadOrders(status);
  },

  // 联系用户
  async onContactUser(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o.id === orderId);
    
    if (!order) {
      wx.showToast({
        title: '订单不存在',
        icon: 'none'
      });
      return;
    }

    const toUserId = order.userId || order.address?.userId;
    const toUserName = order.userName || order.address?.name || '用户';
    const contactPhone = order.address?.phone || '';
    
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
            contactPhone: contactPhone,
            contactAction: 'message'
          }
        }
      });
    } catch (err) {
      console.error('【接单页面】创建消息记录失败:', err);
      // 即使创建失败也继续跳转
    }
    
    // 跳转到聊天页面
    wx.navigateTo({
      url: `/subpackages/common/pages/chat/index?toUserId=${toUserId}&toUserName=${encodeURIComponent(toUserName)}&messageType=${messageType}&relatedId=${orderId}&relatedTitle=${encodeURIComponent(`订单 ${order.orderNo || orderId}`)}`
    });
  },

  // 确认订单（pending -> confirmed）
  async onConfirmOrder(e) {
    let orderId = e.currentTarget.dataset.id;
    
    if (!orderId && this.data.detail && this.data.detail.id) {
      orderId = this.data.detail.id;
    }
    
    if (!orderId && this.data.detail && this.data.detail.orderNo) {
      const order = this.data.orders.find(o => o.orderNo === this.data.detail.orderNo);
      if (order) {
        orderId = order.id;
      }
    }
    
    console.log('【接单页面】确认订单，orderId:', orderId);
    
    if (!orderId) {
      wx.showToast({
        title: '缺少订单ID',
        icon: 'none'
      });
      console.error('【接单页面】无法获取订单ID');
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
          title: '已接单',
          icon: 'success'
        });
        
        this.setData({ showDetail: false });
        
        this.loadOrders();
      } else {
        wx.showToast({
          title: res.result?.message || '操作失败',
          icon: 'none'
        });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('【接单页面】确认订单异常:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
  },

  // 已出餐（confirmed -> completed）
  async onCompleteOrder(e) {
    let orderId = e.currentTarget.dataset.id;
    
    if (!orderId && this.data.detail && this.data.detail.id) {
      orderId = this.data.detail.id;
    }
    
    if (!orderId && this.data.detail && this.data.detail.orderNo) {
      const order = this.data.orders.find(o => o.orderNo === this.data.detail.orderNo);
      if (order) {
        orderId = order.id;
      }
    }
    
    console.log('【接单页面】完成订单，orderId:', orderId);
    
    if (!orderId) {
      wx.showToast({
        title: '缺少订单ID',
        icon: 'none'
      });
      console.error('【接单页面】无法获取订单ID');
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
            status: 'completed'
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '已完成',
          icon: 'success'
        });
        
        this.setData({ showDetail: false });
        
        this.loadOrders();
      } else {
        wx.showToast({
          title: res.result?.message || '操作失败',
          icon: 'none'
        });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('【接单页面】完成订单异常:', error);
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
      console.error('【接单页面】订单不存在，id:', id);
      return;
    }
    
    const detail = {
      id: order.id,
      orderId: order.id,
      orderStatus: order.orderStatus,
      deskNo: order.orderNo ? order.orderNo.substring(order.orderNo.length - 3) : '001',
      statusText: order.statusText,
      orderNo: order.orderNo,
      remark: order.remark,
      items: order.items.map(item => ({
        name: item.productName,
        img: item.image || '',
        price: item.price,
        qty: item.quantity
      })),
      address: order.address,
      amountGoods: order.amountGoods || '0.00',
      amountDelivery: order.amountDelivery || '0.00',
      platformFee: order.platformFee || '0.00',
      amountDiscount: order.amountDiscount || 0,
      amountTotal: order.amountTotal || order.amountPayable || '0.00',
      expiredAt: order.expiredAt || null,
      expiredMinutes: order.expiredMinutes || null,
      readyAt: order.readyAt || null,
      createdAt: this.formatDateTime(order.createdAt)
    };
    
    this.setData({ showDetail: true, detail: detail });
  },
  
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

  onCloseDetail(){ 
    this.setData({ showDetail: false }); 
  },

  onCancelOrder(){ 
    wx.showToast({ title:'已取消', icon:'none' }); 
    this.setData({ showDetail:false }); 
  },

  // 底部导航切换
  onBottomTap(e){
    const tab = e.currentTarget.dataset.tab;
    this.setData({ bottomActive: tab });
    if(tab === 'home'){
      wx.reLaunch({ url: '/pages/home/index' });
    } else if(tab === 'order'){
      wx.reLaunch({ url: '/subpackages/order/pages/order/index' });
    } else if(tab === 'receive'){
      // 当前页面，无需跳转
    } else if(tab === 'profile'){
      wx.reLaunch({ url: '/pages/profile/index' });
    }
  }
});
