// pages/admin-order-list/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    currentTab: 1, // 当前选中的底部导航标签
    currentFilter: 'all', // 当前筛选条件
    orderList: [],
    loading: false,
    page: 1,
    pageSize: 20,
    hasMore: true
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
            url: '/pages/merchant-register/index'
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
        name: 'admin',
        data: {
          action: 'getOrderList',
          filter: this.data.currentFilter,
          page: this.data.page,
          pageSize: this.data.pageSize
        }
      });
      
      if (res.result && res.result.code === 0) {
        const { list, hasMore } = res.result.data;
        this.setData({
          orderList: this.data.page === 1 ? list : [...this.data.orderList, ...list],
          hasMore: hasMore,
          loading: false
        });
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
    wx.showModal({
      title: '订单详情',
      content: `订单号：${order.orderNo}\n状态：${order.statusText}\n金额：¥${order.amountPayable}`,
      showCancel: false
    });
  },

  // 订单操作
  onOrderAction(e) {
    const action = e.currentTarget.dataset.action;
    const order = e.currentTarget.dataset.order;
    
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
        name: 'admin',
        data: {
          action: 'cancelOrder',
          orderId: orderId
        }
      });
      
      if (res.result && res.result.code === 0) {
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
        name: 'admin',
        data: {
          action: 'completeOrder',
          orderId: orderId
        }
      });
      
      if (res.result && res.result.code === 0) {
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

  // 底部导航切换
  onTabChange(e) {
    const index = e.detail.index;
    this.setData({
      currentTab: index
    });
    
    switch(index) {
      case 0:
        // 数据概况
        wx.navigateTo({
          url: '/pages/admin-dashboard/index'
        });
        break;
      case 1:
        // 管理系统 - 当前页面
        break;
      case 2:
        // 管理员信息
        wx.navigateTo({
          url: '/pages/admin-profile/index',
          fail: () => {
            wx.showToast({ title: '管理员信息页面开发中', icon: 'none' });
          }
        });
        break;
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
