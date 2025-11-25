Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    orders: [],
    loading: false,
    refreshing: false,
    page: 1,
    pageSize: 20,
    hasMore: true
  },

  onLoad() {
    this.loadOrders();
  },

  onShow() {
    // 页面显示时刷新数据
    this.loadOrders(true);
  },

  // 加载订单列表
  async loadOrders(refresh = false) {
    if (this.data.loading) return;
    
    const page = refresh ? 1 : this.data.page;
    
    this.setData({
      loading: true,
      refreshing: refresh
    });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getRiderTodayOrders',
          data: {
            page: page,
            pageSize: this.data.pageSize
          }
        }
      });
      
      if (res.result && res.result.code === 200) {
        const newOrders = res.result.data.list || [];
        const total = res.result.data.total || 0;
        
        const orders = refresh ? newOrders : [...this.data.orders, ...newOrders];
        const hasMore = orders.length < total;
        
        this.setData({
          orders: orders,
          page: page + 1,
          hasMore: hasMore,
          loading: false,
          refreshing: false
        });
      } else {
        throw new Error(res.result?.message || '获取订单失败');
      }
    } catch (error) {
      console.error('加载订单失败:', error);
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      });
      this.setData({
        loading: false,
        refreshing: false
      });
    }
  },

  // 下拉刷新
  onRefresh() {
    this.loadOrders(true);
  },

  // 上拉加载更多
  onLoadMore() {
    if (!this.data.hasMore || this.data.loading) return;
    this.loadOrders();
  },

  // 切换餐品详情展开/收起
  onToggleItems(e) {
    const index = e.currentTarget.dataset.index;
    const orders = this.data.orders;
    orders[index].showItems = !orders[index].showItems;
    this.setData({ orders });
  },

  // 返回上一页
  onBack() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.reLaunch({
        url: '/subpackages/rider/pages/rider-home/index'
      });
    }
  },

  // 查看订单详情
  onOrderDetail(e) {
    const orderId = e.currentTarget.dataset.id;
    // TODO: 跳转到订单详情页面
    wx.showToast({
      title: '订单详情功能开发中',
      icon: 'none'
    });
  }
});

