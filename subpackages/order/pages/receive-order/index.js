const log = require('../../../../utils/logger.js');

Page({
  data:{
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    bottomActive: 'task-hall', // 任务大厅为独立页，当前 Tab 为「任务大厅」非「订单」
    orders: [],
    allOrders: [], // 存储所有订单用于筛选
    loading: false, // 初始 false，避免 loadOrders 首行 if(this.data.loading)return 导致首次不请求
    orderPage: 1,
    orderPageSize: 20,
    hasMoreOrders: true,
    searchKeyword: '', // 搜索关键词
    selectedService: '', // 选中的服务类型
    selectedStatus: '', // 选中的状态
    selectedLocation: '', // 选中的地点
    selectedGender: '', // 选中的性别
    showServiceFilter: false, // 显示服务筛选弹窗
    showStatusFilter: false, // 显示状态筛选弹窗
    showLocationFilter: false, // 显示地点筛选弹窗
    serviceOptions: ['全部服务', '游戏陪玩', '跑腿', '代拿快递'],
    statusOptions: ['全部', '待接单', '进行中', '已完成'],
    locationOptions: ['全部地点', '图书馆', '宿舍楼', '教学楼', '食堂', '体育馆', '其他地点'],
    genderOptions: ['全部性别', '男生', '女生'],
    currentUserOpenid: null, // 当前用户的openid
    currentTime: '', // 当前时间显示
    showContactInfo: false, // 显示联系信息弹窗
    contactInfo: { // 联系信息
      wechat: '', // 微信号
      phone: '', // 电话号
      userName: '' // 用户名称
    }
  },

  onLoad(options) {
    this._pendingOrderId = options.orderId || null;
    let c = '';
    try {
      c = wx.getStorageSync('homeCurrentCampus');
    } catch (e) {}
    if (c !== '金水校区' && c !== '白沙校区') {
      const u = wx.getStorageSync('userInfo') || {};
      if (u.campus === '金水校区' || u.campus === '白沙校区') c = u.campus;
      else c = '白沙校区';
    }
    this._receiveOrderCampus = c;
    this.getCurrentUserOpenid();
    this.loadOrders();
  },

  // 获取当前用户openid
  async getCurrentUserOpenid() {
    try {
      // 优先从本地存储获取
      const userInfo = wx.getStorageSync('userInfo');
      if (userInfo && userInfo.openid) {
        log.log('【接单页面】从本地存储获取用户openid:', userInfo.openid);
        this.setData({
          currentUserOpenid: userInfo.openid
        });
        return;
      }
      
      // 如果本地没有，尝试从全局数据获取
      const app = getApp();
      if (app.globalData.userInfo && app.globalData.userInfo.openid) {
        log.log('【接单页面】从全局数据获取用户openid:', app.globalData.userInfo.openid);
        this.setData({
          currentUserOpenid: app.globalData.userInfo.openid
        });
        return;
      }
      
      // 如果都没有，尝试从云函数获取
      try {
        const res = await wx.cloud.callFunction({
          name: 'loginUser',
          data: {}
        });
        if (res.result && res.result.code === 0 && res.result.data && res.result.data.userInfo) {
          const openid = res.result.data.userInfo.openid;
          log.log('【接单页面】从云函数获取用户openid:', openid);
          this.setData({
            currentUserOpenid: openid
          });
        }
      } catch (err) {
        log.error('【接单页面】从云函数获取用户openid失败:', err);
      }
    } catch (error) {
      log.error('【接单页面】获取用户openid失败:', error);
    }
  },

  onShow() {
    try {
      const c = wx.getStorageSync('homeCurrentCampus');
      if (c === '金水校区' || c === '白沙校区') this._receiveOrderCampus = c;
    } catch (e) {}
    this.getCurrentUserOpenid();
    this.updateCurrentTime();
    this.checkAndCancelExpiredOrders();
    const now = Date.now();
    if (!this._ordersLastLoadTime || now - this._ordersLastLoadTime > 30000 || this.data.orders.length === 0) {
      this.loadOrders();
    }
    if (this._timeTimer) clearInterval(this._timeTimer);
    this._timeTimer = setInterval(() => {
      this.updateCurrentTime();
      this.updateExpiredAtDisplay();
    }, 1000);
  },

  async onPullDownRefresh() {
    try {
      // 更新当前时间
      this.updateCurrentTime();
      // 检查并自动取消超时订单
      await this.checkAndCancelExpiredOrders();
      // 重新加载订单列表（不显示加载提示，因为下拉刷新本身已有动画）
      await this.loadOrders(false);
    } catch (error) {
      log.error('【接单页面】下拉刷新失败:', error);
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      });
    } finally {
      // 停止下拉刷新动画
      wx.stopPullDownRefresh();
    }
  },

  onHide() {
    if (this._timeTimer) {
      clearInterval(this._timeTimer);
      this._timeTimer = null;
    }
  },

  onUnload() {
    if (this._timeTimer) {
      clearInterval(this._timeTimer);
      this._timeTimer = null;
    }
  },

  // 更新当前时间
  updateCurrentTime() {
    const timeDisplay = this.getCurrentTimeDisplay();
    this.setData({ currentTime: timeDisplay });
  },

  // 更新订单列表中的截止时间显示（仅传变更路径，减少 setData 数据量）
  updateExpiredAtDisplay() {
    const orders = this.data.orders;
    const hasExpired = orders.some(o => o.expiredAt);
    if (!hasExpired) return;
    const updates = {};
    orders.forEach((order, i) => {
      if (order.expiredAt) {
        updates[`orders[${i}].expiredAtDisplay`] = this.formatExpiredAtDisplay(order.expiredAt);
      }
    });
    if (Object.keys(updates).length > 0) this.setData(updates);
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
      log.error('【接单页面】检查超时订单失败:', error);
      // 静默失败，不影响主流程
    }
  },

  onReachBottom() {
    if (!this.data.loading && this.data.hasMoreOrders) {
      this.loadOrders(false, true);
    }
  },

  // 加载订单列表（showLoading 是否显示 loading，isLoadMore 是否上拉加载更多）
  async loadOrders(showLoading = true, isLoadMore = false) {
    if (this.data.loading) return;

    const pageSize = this.data.orderPageSize || 20;
    const page = isLoadMore ? this.data.orderPage : 1;

    this.setData({ loading: true });

    try {
      if (showLoading && !isLoadMore) {
        wx.showLoading({ title: '加载中...' });
      }

      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getReceiveOrders',
          data: {
            page: page,
            pageSize: pageSize,
            campus: this._receiveOrderCampus || '白沙校区'
          }
        }
      });

      if (showLoading && !isLoadMore) wx.hideLoading();

      log.log('【任务大厅】云函数返回结果:', res.result);

      if (res.result && res.result.code === 200) {
        const total = res.result.data.total ?? 0;
        const newOrders = res.result.data.list.map(order => ({
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
          taskDuration: order.taskDuration || null,
          taskDurationUnit: order.taskDurationUnit || 'hour',
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

        const allOrders = isLoadMore
          ? [...(this.data.allOrders || []), ...newOrders]
          : newOrders;
        const hasMoreOrders = (page * pageSize) < total;

        this.setData({
          allOrders,
          orders: allOrders,
          orderPage: page + 1,
          hasMoreOrders,
          loading: false
        }, () => {
          if (this._pendingOrderId) {
            const order = allOrders.find(o => o.id === this._pendingOrderId);
            if (order) this.onOpenDetail({ currentTarget: { dataset: { id: order.id } } });
            this._pendingOrderId = null;
          }
        });
        this._ordersLastLoadTime = Date.now();
        this.applyFilters();
      } else {
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      }

    } catch (error) {
      wx.hideLoading();
      log.error('【任务大厅】加载异常:', error);
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
      'reward': '跑腿',
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
        '跑腿': 'reward',
        '代拿快递': 'express'
      };
      const orderType = serviceMap[this.data.selectedService];
      if (orderType) {
        filteredOrders = filteredOrders.filter(order => order.orderType === orderType);
      }
    }

    // 状态筛选
    if (this.data.selectedStatus) {
      if (this.data.selectedStatus === '待接单') {
        filteredOrders = filteredOrders.filter(order => order.orderStatus === 'pending');
      } else if (this.data.selectedStatus === '进行中') {
        // 进行中包括：已接单(received)、接单者已确认(confirmed_by_receiver)
        filteredOrders = filteredOrders.filter(order => 
          order.orderStatus === 'received' || order.orderStatus === 'confirmed_by_receiver'
        );
      } else if (this.data.selectedStatus === '已完成') {
        filteredOrders = filteredOrders.filter(order => order.orderStatus === 'completed');
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
      
      // 获取当前UTC时间
      const now = new Date();
      // 计算中国时区偏移（UTC+8，即比UTC快8小时）
      const chinaTimeOffset = 8 * 60 * 60 * 1000;
      // 将UTC时间转换为中国时区时间
      const expiredChinaTime = new Date(expiredDate.getTime() + chinaTimeOffset);
      const nowChinaTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + chinaTimeOffset);
      
      const diff = expiredChinaTime.getTime() - nowChinaTime.getTime();
      
      // 不再显示已过期，订单不会过期
      // if (diff < 0) {
      //   return '已过期';
      // }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      // 使用UTC方法获取中国时区的日期时间（因为已经加上了偏移）
      const month = expiredChinaTime.getUTCMonth() + 1;
      const date = expiredChinaTime.getUTCDate();
      const hoursStr = String(expiredChinaTime.getUTCHours()).padStart(2, '0');
      const minutesStr = String(expiredChinaTime.getUTCMinutes()).padStart(2, '0');
      
      if (days === 0) {
        return `今天 ${hoursStr}:${minutesStr}截止`;
      } else if (days === 1) {
        return `明天 ${hoursStr}:${minutesStr}截止`;
      } else {
        return `${month}/${date} ${hoursStr}:${minutesStr}截止`;
      }
    } catch (error) {
      log.error('格式化截止时间失败:', error, expiredAt);
      return '';
    }
  },

  // 获取当前时间显示（用于接单按钮旁）- 使用中国时区
  getCurrentTimeDisplay() {
    const now = new Date();
    // 计算中国时区偏移（UTC+8，即比UTC快8小时）
    const chinaTimeOffset = 8 * 60 * 60 * 1000;
    // 获取当前中国时区时间
    const nowChinaTime = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + chinaTimeOffset);
    const hours = String(nowChinaTime.getUTCHours()).padStart(2, '0');
    const minutes = String(nowChinaTime.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 阻止触摸移动事件（防止弹窗滚动穿透）
  preventTouchMove() {
    // 空函数，用于阻止弹窗内的滚动穿透到背景页面
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
      'received': '进行中', // 接单后显示为"进行中"
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

    // 获取下单者的openid
    const userOpenid = order.userOpenid;
    
    if (!userOpenid) {
      wx.showToast({
        title: '暂无联系方式',
        icon: 'none'
      });
      return;
    }

    try {
      wx.showLoading({ title: '加载中...' });

      // 直接查询数据库获取用户的完整信息（包括微信号和电话号）
      const db = wx.cloud.database();
      const userQuery = await db.collection('users')
        .where({
          openid: userOpenid
        })
        .get();

      wx.hideLoading();

      let wechat = '';
      let phone = '';
      let userName = '';

      if (userQuery.data && userQuery.data.length > 0) {
        const userData = userQuery.data[0];
        wechat = userData.wechat || '';
        phone = userData.phone || order.address?.phone || order.userInfo?.phone || '';
        userName = userData.nickname || order.address?.name || order.userInfo?.nickname || order.userInfo?.userName || '用户';
      } else {
        // 如果查询失败，尝试使用订单中的信息
        phone = order.address?.phone || order.userInfo?.phone || '';
        userName = order.address?.name || order.userInfo?.nickname || order.userInfo?.userName || '用户';
      }

      // 如果既没有微信号也没有电话号，提示用户
      if (!wechat && !phone) {
        wx.showToast({
          title: '用户未设置联系方式',
          icon: 'none'
        });
        return;
      }

      // 显示联系信息弹窗
      this.setData({
        showContactInfo: true,
        contactInfo: {
          wechat: wechat,
          phone: phone,
          userName: userName
        }
      });
    } catch (error) {
      wx.hideLoading();
      log.error('【接单页面】获取用户信息失败:', error);
      
      // 如果获取失败，尝试使用订单中的信息
      const phone = order.address?.phone || order.userInfo?.phone || '';
      const userName = order.address?.name || order.userInfo?.nickname || order.userInfo?.userName || '用户';

      if (!phone) {
        wx.showToast({
          title: '获取联系方式失败',
          icon: 'none'
        });
        return;
      }

      this.setData({
        showContactInfo: true,
        contactInfo: {
          wechat: '',
          phone: phone,
          userName: userName
        }
      });
    }
  },

  // 关闭联系信息弹窗
  onCloseContactInfo() {
    this.setData({
      showContactInfo: false
    });
  },

  // 复制微信号
  onCopyWechat() {
    const wechat = this.data.contactInfo.wechat;
    if (!wechat) {
      wx.showToast({
        title: '微信号为空',
        icon: 'none'
      });
      return;
    }
    wx.setClipboardData({
      data: wechat,
      success: () => {
        wx.showToast({
          title: '微信号已复制',
          icon: 'success'
        });
      }
    });
  },

  // 复制电话号
  onCopyPhone() {
    const phone = this.data.contactInfo.phone;
    if (!phone) {
      wx.showToast({
        title: '电话号为空',
        icon: 'none'
      });
      return;
    }
    wx.setClipboardData({
      data: phone,
      success: () => {
        wx.showToast({
          title: '电话号已复制',
          icon: 'success'
        });
      }
    });
  },

  // 拨打电话
  onCallPhone() {
    const phone = this.data.contactInfo.phone;
    if (!phone) {
      wx.showToast({
        title: '电话号为空',
        icon: 'none'
      });
      return;
    }
    wx.makePhoneCall({
      phoneNumber: phone,
      fail: (err) => {
        log.error('拨打电话失败:', err);
        wx.showToast({
          title: '拨打电话失败',
          icon: 'none'
        });
      }
    });
  },

  // 接单函数
  async onConfirmOrder(e) {
    let orderId = e.currentTarget.dataset.id;
    
    // 如果从事件中获取不到，尝试从详情中获取
    if (!orderId && this.data.detail && this.data.detail.id) {
      orderId = this.data.detail.id;
    }
    
    if (!orderId && this.data.detail && this.data.detail.orderNo) {
      const order = this.data.orders.find(o => o.orderNo === this.data.detail.orderNo);
      if (order) {
        orderId = order.id;
      }
    }
    
    log.log('【接单页面】点击接单，orderId:', orderId);
    
    if (!orderId) {
      wx.showToast({
        title: '缺少订单ID',
        icon: 'none'
      });
      log.error('【接单页面】无法获取订单ID');
      return;
    }
    
    // 检查是否是自己的订单
    const order = this.data.orders.find(o => o.id === orderId);
    if (order && order.userOpenid === this.data.currentUserOpenid) {
      wx.showToast({
        title: '不能接自己的订单',
        icon: 'none'
      });
      return;
    }
    
    try {
      wx.showLoading({ title: '处理中...' });

      // 调用云函数接单
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'acceptOrder',
          data: {
            orderId: orderId
          }
        }
      });

      wx.hideLoading();

      log.log('【接单页面】接单云函数返回:', res.result);

      if (res.result && res.result.code === 200) {
        // 接单成功后，弹出确认弹窗
        wx.showModal({
          title: '确认接单',
          content: '是否确认接单？确认后将开始服务。',
          confirmText: '确认',
          cancelText: '取消',
          success: async (modalRes) => {
            if (modalRes.confirm) {
              // 用户点击确认，调用接单者确认接口
              await this.onReceiverConfirmAfterAccept(orderId);
            } else {
              // 用户点击取消，取消接单，订单恢复为待接单状态
              log.log('【接单页面】用户点击取消，取消接单');
              await this.onCancelAcceptOrder(orderId);
            }
          },
          fail: (err) => {
            // 如果弹窗操作失败，也取消接单
            log.log('【接单页面】弹窗操作失败，取消接单:', err);
            this.onCancelAcceptOrder(orderId).catch(error => {
              log.error('【接单页面】取消接单异常:', error);
              this.setData({ showDetail: false });
              setTimeout(() => {
                this.loadOrders();
              }, 300);
            });
          }
        });
      } else {
        const msg = res.result?.message || '接单失败';
        const isCampusRequired = res.result?.code === 403 && (msg.indexOf('校园兼职') !== -1 || msg.indexOf('保证金') !== -1);
        if (isCampusRequired) {
          wx.showModal({
            title: '无法接单',
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
      }

    } catch (error) {
      wx.hideLoading();
      log.error('【接单页面】接单异常:', error);
      wx.showToast({
        title: '接单失败',
        icon: 'none'
      });
    }
  },

  // 接单者完成订单
  async onCompleteOrder(e) {
    let orderId = e.currentTarget.dataset.id;
    
    // 如果从事件中获取不到，尝试从详情中获取
    if (!orderId && this.data.detail && this.data.detail.id) {
      orderId = this.data.detail.id;
    }
    
    if (!orderId && this.data.detail && this.data.detail.orderNo) {
      const order = this.data.orders.find(o => o.orderNo === this.data.detail.orderNo);
      if (order) {
        orderId = order.id;
      }
    }
    
    log.log('【接单页面】点击完成订单，orderId:', orderId);
    
    if (!orderId) {
      wx.showToast({
        title: '缺少订单ID',
        icon: 'none'
      });
      log.error('【接单页面】无法获取订单ID');
      return;
    }
    
    // 确认操作
    wx.showModal({
      title: '确认完成',
      content: '确认已完成订单？完成后将等待用户确认。',
      confirmText: '确认完成',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '处理中...' });

            // 调用云函数：接单者完成订单
            const result = await wx.cloud.callFunction({
              name: 'orderManage',
              data: {
                action: 'receiverCompleteOrder',
                data: {
                  orderId: orderId
                }
              }
            });

            wx.hideLoading();

            log.log('【接单页面】完成订单云函数返回:', result.result);

            if (result.result && result.result.code === 200) {
              wx.showToast({
                title: '完成成功，等待用户确认',
                icon: 'success',
                duration: 2000
              });
              
              // 关闭详情弹层
              this.setData({ showDetail: false });
              
              // 重新加载订单列表
              setTimeout(() => {
                this.loadOrders();
              }, 500);
            } else {
              wx.showToast({
                title: result.result?.message || '操作失败',
                icon: 'none',
                duration: 2000
              });
            }

          } catch (error) {
            wx.hideLoading();
            log.error('【接单页面】完成订单异常:', error);
            wx.showToast({
              title: '操作失败',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 接单后确认接单（received -> confirmed_by_receiver）
  async onReceiverConfirmAfterAccept(orderId) {
    try {
      wx.showLoading({ title: '确认中...' });

      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'receiverConfirmOrder',
          data: {
            orderId: orderId
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '接单成功',
          icon: 'success'
        });
        
        // 关闭详情弹窗
        this.setData({ showDetail: false });
        
        // 刷新订单列表，此时订单状态已变为 confirmed_by_receiver，会显示联系用户按钮
        this.loadOrders();
      } else {
        wx.showToast({
          title: res.result?.message || '确认失败',
          icon: 'none',
          duration: 2000
        });
      }

    } catch (error) {
      wx.hideLoading();
      log.error('【接单页面】确认接单异常:', error);
      wx.showToast({
        title: '确认失败',
        icon: 'none'
      });
    }
  },

  // 取消接单（received -> pending）
  async onCancelAcceptOrder(orderId) {
    try {
      log.log('【接单页面】开始取消接单，orderId:', orderId);
      
      if (!orderId) {
        log.error('【接单页面】取消接单缺少订单ID');
        this.setData({ showDetail: false });
        setTimeout(() => {
          this.loadOrders();
        }, 300);
        return;
      }
      
      wx.showLoading({ title: '取消中...' });
      
      // 调用云函数取消接单
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'cancelReceiverOrderByReceiver',
          data: {
            orderId: orderId
          }
        }
      });

      wx.hideLoading();

      log.log('【接单页面】取消接单云函数返回:', res.result);

      // 检查取消结果
      if (res.result && res.result.code === 200) {
        // 取消成功，关闭弹窗并刷新订单列表
        log.log('【接单页面】取消接单成功，订单已重回待接单状态');
        this.setData({ showDetail: false });
        // 延迟一下再刷新，确保数据库更新完成
        setTimeout(() => {
          this.loadOrders();
        }, 500);
      } else {
        // 取消失败，记录日志
        log.error('【接单页面】取消接单失败:', res.result?.message || '未知错误');
        // 即使失败也关闭弹窗并刷新，让用户看到最新状态
        this.setData({ showDetail: false });
        setTimeout(() => {
          this.loadOrders();
        }, 500);
      }

    } catch (error) {
      wx.hideLoading();
      // 异常时也关闭弹窗并刷新列表
      log.error('【接单页面】取消接单异常:', error);
      this.setData({ showDetail: false });
      setTimeout(() => {
        this.loadOrders();
      }, 500);
    }
  },

  onOpenDetail(e){
    const id = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o=>o.id===id);
    
    if (!order) {
      log.error('【接单页面】订单不存在，id:', id);
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
      taskDuration: order.taskDuration,
      taskDurationUnit: order.taskDurationUnit || 'hour',
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

  // 用户确认订单完成（下单者在任务大厅/详情中点击）
  async onUserConfirmComplete(e) {
    const orderId = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.orderId) || (this.data.detail && this.data.detail.id);
    if (!orderId) {
      wx.showToast({ title: '订单信息异常', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '确认中...' });
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: { action: 'userConfirmComplete', data: { orderId } }
      });
      wx.hideLoading();
      const result = res.result;
      if (result && result.code === 200) {
        wx.showToast({ title: '已确认完成', icon: 'success' });
        this.setData({ showDetail: false });
        this.loadOrders();
        return;
      }
      wx.showToast({ title: (result && result.message) || '确认失败', icon: 'none' });
    } catch (err) {
      wx.hideLoading();
      log.error('【任务大厅】用户确认订单完成异常:', err);
      wx.showToast({ title: '网络异常', icon: 'none' });
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
      log.warn('【格式化日期时间】无效的日期:', dateStr);
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
    
    log.log('【接单页面】点击地址信息，detail:', this.data.detail);
    
    if (!this.data.detail) {
      log.log('【接单页面】详情信息不存在');
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
      log.log('【接单页面】地址和用户信息都不存在');
      wx.showToast({
        title: '暂无地址信息',
        icon: 'none'
      });
      return;
    }
    
    const fullAddress = address.fullAddress || `${address.buildingName || ''}${address.houseNumber || ''}${address.addressDetail || address.address || ''}` || '未设置地址';
    const phone = address.phone || '';
    
    log.log('【接单页面】地址信息:', { fullAddress, phone, name: address.name });
    
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
        log.error('【接单页面】显示操作菜单失败:', err);
      }
    });
  },

  // 点击用户信息
  onUserInfoTap(e) {
    e.stopPropagation && e.stopPropagation();
    
    if (!this.data.detail || !this.data.detail.userInfo) {
      log.log('【接单页面】用户信息不存在');
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
    
    log.log('【接单页面】点击用户信息:', userInfo);
    
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
        log.error('【接单页面】显示操作菜单失败:', err);
      }
    });
  },

  onCancelOrder(){ 
    wx.showToast({ title:'已取消', icon:'none' }); 
    this.setData({ showDetail:false }); 
  },

  // 点击我的订单
  onMyOrderTap() {
    wx.navigateTo({
      url: '/subpackages/order/pages/my-published-orders/index',
      fail: (err) => {
        log.error('跳转到我的订单页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 底部导航切换（user-tab-bar 组件触发，detail.tab）
  onBottomTap(e) {
    const tab = (e.detail && e.detail.tab) ? e.detail.tab : (e.currentTarget && e.currentTarget.dataset.tab);
    if (!tab) return;
    if (tab === 'home') {
      wx.reLaunch({ url: '/pages/home/index' });
    } else if (tab === 'task-hall') {
      // 当前即任务大厅，无需跳转
    } else if (tab === 'profile') {
      wx.reLaunch({ url: '/pages/profile/index' });
    }
  }
});
