// pages/admin-order-list/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    currentCategory: 'all', // 当前分类：all, restaurant, gaming, reward, express
    currentFilter: 'all', // 当前状态筛选：all, unpaid, paid, completed, cancelled
    orderList: [],
    loading: false,
    page: 1,
    pageSize: 20,
    hasMore: true,
    // 分类列表
    categories: [
      { id: 'all', name: '全部', icon: '🛍️' },
      { id: 'restaurant', name: '餐饮', icon: '🍽️' },
      { id: 'gaming', name: '游戏陪玩', icon: '🎮' },
      { id: 'reward', name: '悬赏', icon: '💰' },
      { id: 'express', name: '代拿快递', icon: '📦' }
    ],
    // 状态筛选列表
    filters: [
      { id: 'all', name: '全部' },
      { id: 'unpaid', name: '待支付' },
      { id: 'paid', name: '已支付' },
      { id: 'completed', name: '已完成' },
      { id: 'cancelled', name: '已取消' },
      { id: 'refunding', name: '退款中' },
      { id: 'refunded', name: '已退款' }
    ]
  },

  onLoad() {
    console.log('订单管理页面加载');
    this.verifyAdminAccess();
    this.loadOrderList();
  },

  onShow() {
    // 页面显示时刷新数据
    this.loadOrderList();
  },

  // 验证管理员访问权限
  verifyAdminAccess() {
    const adminToken = wx.getStorageSync('adminToken');
    if (!adminToken) {
      wx.showModal({
        title: '访问受限',
        content: '您没有管理员权限，请重新登录',
        showCancel: false,
        success: () => {
          wx.reLaunch({
            url: '/subpackages/merchant/pages/merchant-register/index'
          });
        }
      });
      return;
    }
  },

  // 加载订单列表
  async loadOrderList() {
    if (this.data.loading) return;
    
    this.setData({ loading: true });
    
    try {
      // 调用云函数获取订单列表
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getAdminOrderList',
          data: {
            category: this.data.currentCategory, // 订单类型分类
            filter: this.data.currentFilter, // 状态筛选
            page: this.data.page,
            pageSize: this.data.pageSize
          }
        }
      });
      
      console.log('【订单管理】云函数返回:', res.result);
      
      if (res.result && res.result.code === 0) {
        let { list, hasMore } = res.result.data;
        
        // 如果设置了分类，在前端再过滤一次（确保准确）
        if (this.data.currentCategory !== 'all') {
          list = list.filter(order => {
            if (this.data.currentCategory === 'restaurant') {
              // 餐饮：普通订单（有店铺的订单）
              return order.orderType === 'normal' || (!order.orderType && order.storeId);
            } else {
              // 其他分类：匹配订单类型
              return order.orderType === this.data.currentCategory;
            }
          });
        }
        
        // 确保数据格式正确
        const formattedList = list.map(order => ({
          ...order,
          // 确保金额是字符串格式
          amountGoods: String(order.amountGoods || '0.00'),
          amountDelivery: String(order.amountDelivery || '0.00'),
          amountPayable: String(order.amountPayable || '0.00'),
          // 确保商品列表存在
          items: order.items || []
        }));
        
        this.setData({
          orderList: this.data.page === 1 ? formattedList : [...this.data.orderList, ...formattedList],
          hasMore: hasMore,
          loading: false
        });
        
        console.log('【订单管理】订单列表加载成功，共', formattedList.length, '条');
      } else {
        // 使用模拟数据
        this.setData({
          orderList: this.getMockOrderList(),
          hasMore: false,
          loading: false
        });
      }
    } catch (error) {
      console.error('加载订单列表失败:', error);
      // 使用模拟数据
      this.setData({
        orderList: this.getMockOrderList(),
        hasMore: false,
        loading: false
      });
    }
  },

  // 获取模拟订单数据
  getMockOrderList() {
    return [
      {
        id: '1',
        orderNo: '202501030001',
        createdAt: '2025-01-03 18:30',
        payStatus: 'paid',
        statusText: '已支付',
        storeLogo: '/pages/小标/商家.png',
        storeName: '河工食堂',
        storeAddress: '河北工业大学北辰校区',
        amountGoods: 25.80,
        amountDelivery: 3.00,
        amountPayable: 28.80,
        items: [
          {
            id: '1',
            name: '宫保鸡丁',
            spec: '中辣',
            price: 12.80,
            quantity: 1
          },
          {
            id: '2',
            name: '米饭',
            spec: '',
            price: 2.00,
            quantity: 1
          },
          {
            id: '3',
            name: '可乐',
            spec: '冰镇',
            price: 3.00,
            quantity: 1
          }
        ]
      },
      {
        id: '2',
        orderNo: '202501030002',
        createdAt: '2025-01-03 17:45',
        payStatus: 'unpaid',
        statusText: '待支付',
        storeLogo: '/pages/小标/商家.png',
        storeName: '校园咖啡',
        storeAddress: '河北工业大学北辰校区',
        amountGoods: 18.50,
        amountDelivery: 2.00,
        amountPayable: 20.50,
        items: [
          {
            id: '4',
            name: '拿铁咖啡',
            spec: '大杯',
            price: 16.50,
            quantity: 1
          },
          {
            id: '5',
            name: '提拉米苏',
            spec: '',
            price: 2.00,
            quantity: 1
          }
        ]
      }
    ];
  },

  // 分类改变
  onCategoryChange(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      currentCategory: category,
      page: 1,
      orderList: []
    });
    this.loadOrderList();
  },

  // 筛选条件改变
  onFilterChange(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({
      currentFilter: filter,
      page: 1,
      orderList: []
    });
    this.loadOrderList();
  },

  // 刷新数据
  onRefresh() {
    this.setData({
      page: 1,
      orderList: []
    });
    this.loadOrderList();
    wx.showToast({
      title: '数据已刷新',
      icon: 'success',
      duration: 800
    });
  },

  // 返回上一页
  onBack() {
    wx.navigateBack();
  },

  // 订单详情
  onOrderDetail(e) {
    const order = e.currentTarget.dataset.order;
    if (!order || !order.id) return;
    
    // 跳转到订单详情页面
    wx.navigateTo({
      url: `/pages/admin-order-detail/index?orderId=${order.id}`
    });
  },

  // 订单操作
  onOrderAction(e) {
    const action = e.currentTarget.dataset.action;
    const order = e.currentTarget.dataset.order;
    
    if (!order || !order.id) {
      wx.showToast({
        title: '订单信息异常',
        icon: 'none'
      });
      return;
    }
    
    // 阻止事件冒泡
    e.stopPropagation();
    
    if (action === 'cancel') {
      wx.showModal({
        title: '确认取消',
        content: `确定要取消订单 ${order.orderNo} 吗？`,
        success: (res) => {
          if (res.confirm) {
            this.cancelOrder(order.id);
          }
        }
      });
    } else if (action === 'complete') {
      wx.showModal({
        title: '确认完成',
        content: `确定要完成订单 ${order.orderNo} 吗？`,
        success: (res) => {
          if (res.confirm) {
            this.completeOrder(order.id);
          }
        }
      });
    }
  },

  // 取消订单
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
      
      console.log('【取消订单】返回:', res.result);
      
      if (res.result && res.result.code === 200 || res.result.code === 0) {
        // 记录操作日志
        const order = this.data.orderList.find(o => o.id === orderId);
        await this.recordAdminLog('订单处理', order?.orderNo || `订单#${orderId}`, 'order', 'cancelled');
        
        wx.showToast({
          title: '订单已取消',
          icon: 'success'
        });
        this.loadOrderList();
      } else {
        wx.showToast({
          title: res.result.message || '操作失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('取消订单失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 完成订单
  async completeOrder(orderId) {
    try {
      wx.showLoading({ title: '处理中...' });
      
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'completeOrder',
          data: {
            orderId: orderId
          }
        }
      });
      
      console.log('【完成订单】返回:', res.result);
      
      if (res.result && res.result.code === 200 || res.result.code === 0) {
        // 记录操作日志
        const order = this.data.orderList.find(o => o.id === orderId);
        await this.recordAdminLog('订单处理', order?.orderNo || `订单#${orderId}`, 'order', 'completed');
        
        wx.showToast({
          title: '订单已完成',
          icon: 'success'
        });
        this.loadOrderList();
      } else {
        wx.showToast({
          title: res.result.message || '操作失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('完成订单失败:', error);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 记录管理员操作日志
  async recordAdminLog(action, target, targetType, result) {
    try {
      await wx.cloud.callFunction({
        name: 'adminLogManage',
        data: {
          action: 'record',
          data: {
            adminId: 'admin_123',
            action: action,
            target: target,
            targetType: targetType,
            result: result
          }
        }
      });
    } catch (error) {
      console.error('记录操作日志失败:', error);
    }
  },


  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({
        page: this.data.page + 1
      });
      this.loadOrderList();
    }
  }
});
