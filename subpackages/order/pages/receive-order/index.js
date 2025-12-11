Page({
  data:{
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    bottomActive: 'order',
    orders: [],
    allOrders: [], // 存储所有订单用于筛选
    loading: true,
    searchKeyword: '', // 搜索关键词
    selectedService: '', // 选中的服务类型
    selectedStatus: '', // 选中的状态
    selectedLocation: '', // 选中的地点
    selectedGender: '', // 选中的性别
    showServiceFilter: false, // 显示服务筛选弹窗
    showStatusFilter: false, // 显示状态筛选弹窗
    showLocationFilter: false, // 显示地点筛选弹窗
    serviceOptions: ['全部服务', '游戏陪玩', '悬赏', '代拿快递'],
    statusOptions: ['全部', '待接单', '进行中', '已完成'],
    locationOptions: ['全部地点', '图书馆', '宿舍楼', '教学楼', '食堂', '体育馆', '其他地点'],
    genderOptions: ['全部性别', '男生', '女生'],
    currentUserOpenid: null, // 当前用户的openid
    currentTime: '', // 当前时间显示
    timeTimer: null // 定时器
  },

  onLoad() {
    console.log('【接单页面】页面加载');
    // 获取当前用户openid
    this.getCurrentUserOpenid();
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
        // 如果本地没有，尝试从云函数获取
        const app = getApp();
        if (app.globalData.userInfo && app.globalData.userInfo.openid) {
          this.setData({
            currentUserOpenid: app.globalData.userInfo.openid
          });
        }
      }
    } catch (error) {
      console.error('【接单页面】获取用户openid失败:', error);
    }
  },

  onShow() {
    console.log('【接单页面】页面显示，刷新订单');
    // 更新当前时间
    this.updateCurrentTime();
    // 检查并自动取消超时订单
    this.checkAndCancelExpiredOrders();
    this.loadOrders();
    // 启动定时器，每秒更新当前时间
    if (this.data.timeTimer) {
      clearInterval(this.data.timeTimer);
    }
    const timer = setInterval(() => {
      this.updateCurrentTime();
      // 更新订单列表中的倒计时显示
      this.updateExpiredAtDisplay();
    }, 1000);
    this.setData({ timeTimer: timer });
  },

  onHide() {
    // 页面隐藏时清除定时器
    if (this.data.timeTimer) {
      clearInterval(this.data.timeTimer);
      this.setData({ timeTimer: null });
    }
  },

  onUnload() {
    // 页面卸载时清除定时器
    if (this.data.timeTimer) {
      clearInterval(this.data.timeTimer);
      this.setData({ timeTimer: null });
    }
  },

  // 更新当前时间
  updateCurrentTime() {
    const timeDisplay = this.getCurrentTimeDisplay();
    this.setData({ currentTime: timeDisplay });
  },

  // 更新订单列表中的截止时间显示
  updateExpiredAtDisplay() {
    const orders = this.data.orders.map(order => {
      if (order.expiredAt) {
        return {
          ...order,
          expiredAtDisplay: this.formatExpiredAtDisplay(order.expiredAt)
        };
      }
      return order;
    });
    this.setData({ orders: orders });
  },

  // 检查并自动取消超时订单
  async checkAndCancelExpiredOrders() {
    try {
      await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'autoCancelExpiredOrders',
          data: {}
        }
      });
    } catch (error) {
      console.error('【接单页面】检查超时订单失败:', error);
      // 静默失败，不影响主流程
    }
  },

  // 加载订单列表（加载所有状态的订单，包括待接单、进行中、已完成）
  async loadOrders() {
    this.setData({ loading: true });

    try {
      wx.showLoading({ title: '加载中...' });

      // 不传 status 参数，查询所有状态的订单（待接单、进行中、已完成）
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getReceiveOrders',
          data: {
            page: 1,
            pageSize: 50
            // 不传 status，查询所有状态的订单
          }
        }
      });

      wx.hideLoading();

      console.log('【任务大厅】云函数返回结果:', res.result);

      if (res.result && res.result.code === 200) {
        const orders = res.result.data.list.map(order => ({
          id: order._id,
          orderNo: order.orderNo,
          orderType: order.orderType,
          orderTypeText: this.getOrderTypeText(order.orderType),
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
          expiredAtDisplay: this.formatExpiredAtDisplay(order.expiredAt), // 格式化后的截止时间显示
          readyAt: order.readyAt || null,
          createdAt: order.createdAt,
          userInfo: order.userInfo || null,
          userOpenid: order.userOpenid || null, // 下单者的openid
          gameType: order.gameType || null,
          sessionDuration: order.sessionDuration || null,
          requirements: order.requirements || null,
          selectedRequirements: order.selectedRequirements || null,
          helpLocation: order.helpLocation || null,
          helpContent: order.helpContent || null,
          category: order.category || null,
          pickupLocation: order.pickupLocation || null,
          deliveryLocation: order.deliveryLocation || null,
          pickupCode: order.pickupCode || null,
          packageSizes: order.packageSizes || null,
          images: order.images || null,
          bounty: order.bounty ? (order.bounty >= 100 ? order.bounty / 100 : order.bounty) : null,
          // 接单者信息
          receiverOpenid: order.receiverOpenid || null,
          receiverId: order.receiverId || null,
          receiverInfo: order.receiverInfo || null,
          receiverConfirmedAt: order.receiverConfirmedAt || null,
          receiverCompletedAt: order.receiverCompletedAt || null,
          userConfirmedAt: order.userConfirmedAt || null,
          // 用于搜索和筛选的字段
          searchText: `${order.orderNo} ${order.orderTypeText} ${order.helpContent || order.requirements || ''} ${order.address ? order.address.fullAddress : ''} ${order.pickupLocation || ''} ${order.helpLocation || ''}`.toLowerCase()
        }));

        this.setData({
          allOrders: orders,
          orders: orders,
          loading: false
        });

        // 应用筛选
        this.applyFilters();

        console.log('【任务大厅】订单加载成功，共', orders.length, '条');
      } else {
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      }

    } catch (error) {
      wx.hideLoading();
      console.error('【任务大厅】加载异常:', error);
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

  // 应用筛选
  applyFilters() {
    let filteredOrders = [...this.data.allOrders];

    // 搜索筛选
    if (this.data.searchKeyword) {
      const keyword = this.data.searchKeyword.toLowerCase();
      filteredOrders = filteredOrders.filter(order => 
        order.searchText.includes(keyword)
      );
    }

    // 服务类型筛选
    if (this.data.selectedService) {
      const serviceMap = {
        '游戏陪玩': 'gaming',
        '悬赏': 'reward',
        '代拿快递': 'express'
      };
      const orderType = serviceMap[this.data.selectedService];
      if (orderType) {
        filteredOrders = filteredOrders.filter(order => order.orderType === orderType);
      }
    }

    // 状态筛选
    if (this.data.selectedStatus) {
      const statusMap = {
        '待接单': 'pending',
        '进行中': 'confirmed',
        '已完成': 'completed'
      };
      const orderStatus = statusMap[this.data.selectedStatus];
      if (orderStatus) {
        filteredOrders = filteredOrders.filter(order => order.orderStatus === orderStatus);
      }
    }

    // 地点筛选
    if (this.data.selectedLocation) {
      filteredOrders = filteredOrders.filter(order => {
        // 检查地址信息中是否包含选中的地点
        if (order.address && order.address.fullAddress) {
          return order.address.fullAddress.includes(this.data.selectedLocation);
        }
        // 检查代拿快递的取件位置
        if (order.pickupLocation && order.pickupLocation.includes(this.data.selectedLocation)) {
          return true;
        }
        // 检查悬赏的帮助地点
        if (order.helpLocation && order.helpLocation.includes(this.data.selectedLocation)) {
          return true;
        }
        return false;
      });
    }

    // 性别筛选
    if (this.data.selectedGender) {
      filteredOrders = filteredOrders.filter(order => {
        // 检查用户信息中的性别
        if (order.userInfo && order.userInfo.gender !== undefined) {
          const genderMap = {
            '男生': 1,
            '女生': 2
          };
          return order.userInfo.gender === genderMap[this.data.selectedGender];
        }
        // 如果没有用户信息，检查订单备注或其他字段
        if (order.remark && order.remark.includes(this.data.selectedGender)) {
          return true;
        }
        return false;
      });
    }

    this.setData({
      orders: filteredOrders
    });
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchKeyword: e.detail.value
    });
    this.applyFilters();
  },

  // 搜索提交
  onSearchSubmit() {
    this.applyFilters();
  },

  // 服务类型筛选
  onServiceFilterTap() {
    this.setData({
      showServiceFilter: true
    });
  },

  // 选择服务类型
  onSelectService(e) {
    const service = e.currentTarget.dataset.service;
    this.setData({
      selectedService: service === '全部服务' ? '' : service,
      showServiceFilter: false
    });
    this.applyFilters();
  },

  // 关闭服务筛选弹窗
  onCloseServiceFilter() {
    this.setData({
      showServiceFilter: false
    });
  },

  // 状态筛选
  onStatusFilterTap() {
    this.setData({
      showStatusFilter: true
    });
  },

  // 选择状态
  onSelectStatus(e) {
    const status = e.currentTarget.dataset.status;
    this.setData({
      selectedStatus: status === '全部' ? '' : status,
      showStatusFilter: false
    });
    this.applyFilters();
  },

  // 关闭状态筛选弹窗
  onCloseStatusFilter() {
    this.setData({
      showStatusFilter: false
    });
  },

  // 重置服务筛选
  onResetService() {
    this.setData({
      selectedService: ''
    });
    this.applyFilters();
  },

  // 重置状态筛选
  onResetStatus() {
    this.setData({
      selectedStatus: ''
    });
    this.applyFilters();
  },

  // 地点筛选
  onLocationFilterTap() {
    this.setData({
      showLocationFilter: true
    });
  },

  // 选择地点
  onSelectLocation(e) {
    const location = e.currentTarget.dataset.location;
    this.setData({
      selectedLocation: location === '全部地点' ? '' : location,
      showLocationFilter: false
    });
    this.applyFilters();
  },

  // 关闭地点筛选弹窗
  onCloseLocationFilter() {
    this.setData({
      showLocationFilter: false
    });
  },

  // 重置地点筛选
  onResetLocation() {
    this.setData({
      selectedLocation: ''
    });
    this.applyFilters();
  },

  // 性别筛选
  onGenderFilterTap() {
    this.setData({
      showGenderFilter: true
    });
  },

  // 选择性别
  onSelectGender(e) {
    const gender = e.currentTarget.dataset.gender;
    this.setData({
      selectedGender: gender === '全部性别' ? '' : gender,
      showGenderFilter: false
    });
    this.applyFilters();
  },

  // 关闭性别筛选弹窗
  onCloseGenderFilter() {
    this.setData({
      showGenderFilter: false
    });
  },

  // 重置性别筛选
  onResetGender() {
    this.setData({
      selectedGender: ''
    });
    this.applyFilters();
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
      
      // 处理云数据库日期格式
      if (isNaN(expiredDate.getTime())) {
        // 尝试其他格式
        if (typeof expiredAt === 'string') {
          const dateString = expiredAt.includes(' ') ? expiredAt.replace(' ', 'T') + 'Z' : expiredAt;
          expiredDate = new Date(dateString);
        }
        if (isNaN(expiredDate.getTime())) {
          return '';
        }
      }
      
      const now = new Date();
      // 处理时区偏移（云数据库通常返回UTC时间）
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

  // 获取当前时间显示（用于接单按钮旁）
  getCurrentTimeDisplay() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 判断是否为接单者
  isReceiver(order) {
    if (!order || !this.data.currentUserOpenid) return false;
    return order.receiverOpenid === this.data.currentUserOpenid;
  },

  // 判断是否为下单者
  isOrderPlacer(order) {
    if (!order || !this.data.currentUserOpenid) return false;
    return order.userOpenid === this.data.currentUserOpenid;
  },

  // 获取状态文本
  getStatusText(status) {
    const statusMap = {
      'pending': '待接单',
      'received': '已接单',
      'confirmed_by_receiver': '进行中',
      'waiting_user_confirm': '待确认完成',
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
      'received': 'normal',
      'confirmed_by_receiver': 'normal',
      'waiting_user_confirm': 'normal',
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
      // 当前页面，不跳转
      return;
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
      url: `/pages/chat/index?toUserId=${toUserId}&toUserName=${encodeURIComponent(toUserName)}&messageType=${messageType}&relatedId=${orderId}&relatedTitle=${encodeURIComponent(`订单 ${order.orderNo || orderId}`)}`
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

  // 接单者完成订单（confirmed_by_receiver -> waiting_user_confirm）
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
    
    console.log('【接单页面】接单者完成订单，orderId:', orderId);
    
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
          action: 'receiverCompleteOrder',
          data: {
            orderId: orderId
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '完成成功，等待用户确认',
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
      console.error('【接单页面】接单者完成订单异常:', error);
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
    
    // 处理地址信息，确保 fullAddress 字段存在
    let address = null;
    if (order.address) {
      address = {
        name: order.address.name || '',
        phone: order.address.phone || '',
        addressDetail: order.address.addressDetail || order.address.address || '',
        buildingName: order.address.buildingName || '',
        houseNumber: order.address.houseNumber || '',
        fullAddress: order.address.fullAddress || `${order.address.buildingName || ''}${order.address.houseNumber || ''}${order.address.addressDetail || order.address.address || ''}`
      };
    } else if (order.userInfo) {
      // 如果没有地址信息，使用用户信息构建地址
      address = {
        name: order.userInfo.nickname || order.userInfo.userName || '用户',
        phone: order.userInfo.phone || '',
        addressDetail: '未设置地址',
        buildingName: '',
        houseNumber: '',
        fullAddress: '未设置地址'
      };
    }
    
    const detail = {
      id: order.id,
      orderId: order.id,
      orderStatus: order.orderStatus,
      deskNo: order.orderNo ? order.orderNo.substring(order.orderNo.length - 3) : '001',
      statusText: order.statusText,
      orderNo: order.orderNo,
      remark: order.remark,
      items: order.items && order.items.length > 0 ? order.items.map(item => ({
        name: item.productName || item.name || '商品',
        img: item.image || item.img || '',
        price: item.price || '0.00',
        qty: item.quantity || item.qty || 1
      })) : [],
      address: address,
      userInfo: order.userInfo || null,
      orderType: order.orderType,
      gameType: order.gameType,
      sessionDuration: order.sessionDuration,
      requirements: order.requirements,
      selectedRequirements: order.selectedRequirements,
      helpLocation: order.helpLocation,
      helpContent: order.helpContent,
      category: order.category,
      pickupLocation: order.pickupLocation,
      deliveryLocation: order.deliveryLocation,
      pickupCode: order.pickupCode,
      packageSizes: order.packageSizes,
      images: order.images,
      bounty: order.bounty,
      amountGoods: order.amountGoods || '0.00',
      amountDelivery: order.amountDelivery || '0.00',
      platformFee: order.platformFee || '0.00',
      amountDiscount: order.amountDiscount || 0,
      amountTotal: order.amountTotal || order.amountPayable || '0.00',
      expiredAt: order.expiredAt || null,
      expiredMinutes: order.expiredMinutes || null,
      readyAt: order.readyAt || null,
      createdAt: this.formatDateTime(order.createdAt),
      receiverOpenid: order.receiverOpenid || null,
      receiverId: order.receiverId || null,
      receiverInfo: order.receiverInfo || null,
      receiverConfirmedAt: order.receiverConfirmedAt || null,
      receiverCompletedAt: order.receiverCompletedAt || null,
      userConfirmedAt: order.userConfirmedAt || null,
      userOpenid: order.userOpenid || null
    };
    
    this.setData({ showDetail: true, detail: detail });
  },

  // 用户确认订单完成（waiting_user_confirm -> completed）
  async onUserConfirmComplete(e) {
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
    
    console.log('【接单页面】用户确认订单完成，orderId:', orderId);
    
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
      console.error('【接单页面】用户确认订单完成异常:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    }
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

  // 点击地址信息
  onAddressTap(e) {
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    console.log('【接单页面】点击地址信息，detail:', this.data.detail);
    
    if (!this.data.detail) {
      console.log('【接单页面】详情信息不存在');
      wx.showToast({
        title: '订单信息不存在',
        icon: 'none'
      });
      return;
    }
    
    // 优先使用地址信息，如果没有则使用用户信息
    let address = this.data.detail.address;
    let userInfo = this.data.detail.userInfo;
    
    if (!address && userInfo) {
      // 如果没有地址但有用户信息，使用用户信息
      address = {
        name: userInfo.nickname || userInfo.userName || '用户',
        phone: userInfo.phone || '',
        fullAddress: '未设置地址'
      };
    }
    
    if (!address) {
      console.log('【接单页面】地址和用户信息都不存在');
      wx.showToast({
        title: '暂无地址信息',
        icon: 'none'
      });
      return;
    }
    
    const fullAddress = address.fullAddress || `${address.buildingName || ''}${address.houseNumber || ''}${address.addressDetail || address.address || ''}` || '未设置地址';
    const phone = address.phone || '';
    
    console.log('【接单页面】地址信息:', { fullAddress, phone, name: address.name });
    
    const actionList = [];
    if (fullAddress && fullAddress !== '未设置地址') {
      actionList.push('复制地址');
    }
    if (phone) {
      actionList.push('复制电话');
    }
    if (fullAddress && fullAddress !== '未设置地址') {
      actionList.push('打开地图');
    }
    
    if (actionList.length === 0) {
      wx.showToast({
        title: '暂无可用操作',
        icon: 'none'
      });
      return;
    }
    
    wx.showActionSheet({
      itemList: actionList,
      success: (res) => {
        const action = actionList[res.tapIndex];
        if (action === '复制地址') {
          // 复制地址
          wx.setClipboardData({
            data: fullAddress,
            success: () => {
              wx.showToast({
                title: '地址已复制',
                icon: 'success'
              });
            }
          });
        } else if (action === '复制电话') {
          // 复制电话
          wx.setClipboardData({
            data: phone,
            success: () => {
              wx.showToast({
                title: '电话已复制',
                icon: 'success'
              });
            }
          });
        } else if (action === '打开地图') {
          // 打开地图
          wx.openLocation({
            latitude: 0,
            longitude: 0,
            name: fullAddress,
            address: fullAddress,
            fail: () => {
              wx.showToast({
                title: '请手动搜索地址',
                icon: 'none'
              });
            }
          });
        }
      },
      fail: (err) => {
        console.error('【接单页面】显示操作菜单失败:', err);
      }
    });
  },

  // 点击用户信息
  onUserInfoTap(e) {
    e.stopPropagation && e.stopPropagation();
    
    if (!this.data.detail || !this.data.detail.userInfo) {
      console.log('【接单页面】用户信息不存在');
      return;
    }
    
    const userInfo = this.data.detail.userInfo;
    const phone = userInfo.phone || '';
    
    if (!phone) {
      wx.showToast({
        title: '用户未设置电话',
        icon: 'none'
      });
      return;
    }
    
    console.log('【接单页面】点击用户信息:', userInfo);
    
    wx.showActionSheet({
      itemList: ['复制电话', '拨打电话'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 复制电话
          wx.setClipboardData({
            data: phone,
            success: () => {
              wx.showToast({
                title: '电话已复制',
                icon: 'success'
              });
            }
          });
        } else if (res.tapIndex === 1) {
          // 拨打电话
          wx.makePhoneCall({
            phoneNumber: phone,
            fail: () => {
              wx.showToast({
                title: '拨打失败',
                icon: 'none'
              });
            }
          });
        }
      },
      fail: (err) => {
        console.error('【接单页面】显示操作菜单失败:', err);
      }
    });
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
      wx.reLaunch({ url: '/pages/order/index' });
    } else if(tab === 'receive'){
      // 当前页面，无需跳转
    } else if(tab === 'profile'){
      wx.reLaunch({ url: '/pages/profile/index' });
    }
  }
});
