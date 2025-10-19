// pages/admin-order-list/index.js
Page({
  data: {
    currentTab: 1, // 当前选中的底部导航标签
    
    orders: [],
    loading: true,
    page: 1,
    pageSize: 10,
    total: 0,
    status: '', // 筛选状态
    keyword: '', // 搜索关键词
    statusIndex: 0, // 状态选择器索引
    payStatusIndex: 0, // 支付状态选择器索引
    currentStatusLabel: '全部状态', // 当前状态标签
    currentPayStatusLabel: '全部支付状态', // 当前支付状态标签
    statusOptions: [
      { value: '', label: '全部状态' },
      { value: 'created', label: '已创建' },
      { value: 'accepted', label: '已接单' },
      { value: 'making', label: '制作中' },
      { value: 'delivering', label: '配送中' },
      { value: 'completed', label: '已完成' },
      { value: 'cancelled', label: '已取消' }
    ],
    payStatusOptions: [
      { value: '', label: '全部支付状态' },
      { value: 'unpaid', label: '未支付' },
      { value: 'paid', label: '已支付' },
      { value: 'refunding', label: '退款中' },
      { value: 'refunded', label: '已退款' }
    ]
  },

  onLoad() {
    this.verifyAdminAccess();
    this.loadOrderList();
  },

  onShow() {
    // 页面显示时刷新数据
    this.loadOrderList();
  },

  // 验证管理员权限
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
    wx.showLoading({ title: '加载中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getList',
          data: {
            page: this.data.page,
            pageSize: this.data.pageSize,
            status: this.data.status,
            keyword: this.data.keyword
          }
        }
      });

      if (res.result && res.result.code === 200) {
        this.setData({
          orders: res.result.data.list,
          total: res.result.data.total,
          loading: false
        });
      } else {
        // 使用模拟数据
        this.setData({
          orders: this.getMockOrders(),
          total: 35,
          loading: false
        });
      }
    } catch (err) {
      console.error('加载订单列表失败:', err);
      // 使用模拟数据
      this.setData({
        orders: this.getMockOrders(),
        total: 35,
        loading: false
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 模拟订单数据
  getMockOrders() {
    const orders = [
      {
        _id: '1',
        orderNo: '202501030001',
        userId: 'user_001',
        storeId: 'store_001',
        amountGoods: 2580,
        amountDelivery: 300,
        amountPayable: 2880,
        payStatus: 'paid',
        orderStatus: 'completed',
        createdAt: '2025-01-03T10:30:00Z',
        userInfo: {
          nickname: '张三',
          phone: '13800138001'
        },
        storeInfo: {
          name: '河工零食店'
        }
      },
      {
        _id: '2',
        orderNo: '202501030002',
        userId: 'user_002',
        storeId: 'store_002',
        amountGoods: 1880,
        amountDelivery: 300,
        amountPayable: 2180,
        payStatus: 'paid',
        orderStatus: 'delivering',
        createdAt: '2025-01-03T11:15:00Z',
        userInfo: {
          nickname: '李四',
          phone: '13800138002'
        },
        storeInfo: {
          name: '校园咖啡厅'
        }
      },
      {
        _id: '3',
        orderNo: '202501030003',
        userId: 'user_003',
        storeId: 'store_003',
        amountGoods: 3280,
        amountDelivery: 300,
        amountPayable: 3580,
        payStatus: 'unpaid',
        orderStatus: 'created',
        createdAt: '2025-01-03T12:00:00Z',
        userInfo: {
          nickname: '王五',
          phone: '13800138003'
        },
        storeInfo: {
          name: '快餐王餐厅'
        }
      }
    ];

    // 为每个订单添加格式化金额
    return orders.map(order => ({
      ...order,
      formattedAmount: (order.amountPayable / 100).toFixed(2)
    }));
  },

  // 状态筛选
  onStatusChange(e) {
    const index = parseInt(e.detail.value);
    const status = this.data.statusOptions[index].value;
    const currentStatusLabel = this.data.statusOptions[index].label;
    this.setData({ 
      statusIndex: index,
      status: status,
      currentStatusLabel: currentStatusLabel,
      page: 1 
    });
    this.loadOrderList();
  },

  // 支付状态筛选
  onPayStatusChange(e) {
    const index = parseInt(e.detail.value);
    const payStatus = this.data.payStatusOptions[index].value;
    const currentPayStatusLabel = this.data.payStatusOptions[index].label;
    this.setData({ 
      payStatusIndex: index,
      payStatus: payStatus,
      currentPayStatusLabel: currentPayStatusLabel,
      page: 1 
    });
    this.loadOrderList();
  },

  // 搜索
  onSearch(e) {
    const keyword = e.detail.value;
    this.setData({ keyword, page: 1 });
    this.loadOrderList();
  },

  // 查看订单详情
  onViewDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin-order-detail/index?id=${orderId}`,
      fail: () => {
        wx.showToast({
          title: '订单详情页面开发中',
          icon: 'none'
        });
      }
    });
  },

  // 处理订单
  onProcessOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    const orderNo = e.currentTarget.dataset.orderNo;
    
    wx.showModal({
      title: '处理订单',
      content: `确定要处理订单"${orderNo}"吗？`,
      success: (res) => {
        if (res.confirm) {
          this.updateOrderStatus(orderId, 'accepted');
        }
      }
    });
  },

  // 取消订单
  onCancelOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    const orderNo = e.currentTarget.dataset.orderNo;
    
    wx.showModal({
      title: '取消订单',
      content: `确定要取消订单"${orderNo}"吗？`,
      success: (res) => {
        if (res.confirm) {
          this.updateOrderStatus(orderId, 'cancelled');
        }
      }
    });
  },

  // 更新订单状态
  async updateOrderStatus(orderId, status) {
    wx.showLoading({ title: '处理中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'updateStatus',
          data: { orderId, status },
          adminId: 'admin_123'
        }
      });

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '操作成功',
          icon: 'success'
        });
        this.loadOrderList();
      } else {
        wx.showToast({
          title: res.result.message || '操作失败',
          icon: 'none'
        });
      }
    } catch (err) {
      console.error('更新订单状态失败:', err);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ page: 1 });
    this.loadOrderList();
    wx.stopPullDownRefresh();
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.orders.length < this.data.total) {
      this.setData({ page: this.data.page + 1 });
      this.loadOrderList();
    }
  },

  // 底部导航切换
  onTabChange(e) {
    const index = parseInt(e.currentTarget.dataset.index);
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
        // 订单管理 - 当前页面
        break;
      case 2:
        // 管理员信息
        wx.navigateTo({
          url: '/pages/admin-profile/index'
        });
        break;
    }
  },

});