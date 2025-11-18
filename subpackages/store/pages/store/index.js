Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    searchValue: '',
    activeSort: 0,
    sortOptions: ['综合排序', '速度', '销量', '评分'],
    filters: [
      { text: '神券商家', active: false },
      { text: '点评高分', active: false }
    ],
    stores: [],
    loading: false,
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
    loadingStores: false
  },

  onLoad() {
    this.loadStores();
  },

  // 加载商家列表
  async loadStores() {
    // 防止重复请求
    if (this.data.loadingStores) {
      return;
    }
    
    this.setData({ loadingStores: true, loading: true });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'getStoreList',
        data: {
          page: this.data.page,
          pageSize: this.data.pageSize,
          keyword: this.data.searchValue || undefined,
          storeCategory: '校园超市' // 按店铺分类筛选，只显示"校园超市"分类的店铺
        }
      });
      
      console.log('【校园超市】加载商家列表:', res.result);
      
      if (res.result && res.result.code === 200) {
        // 额外筛选：确保只显示"校园超市"分类的店铺
        const filteredList = (res.result.data.list || []).filter(store => {
          const category = store.storeCategory || '';
          return category === '校园超市';
        });
        
        console.log('【校园超市】筛选前店铺数量:', res.result.data.list?.length || 0);
        console.log('【校园超市】筛选后店铺数量:', filteredList.length);
        
        const stores = filteredList.map(store => {
          return {
            id: store._id || store.storeId,
            _id: store._id || store.storeId,
            name: store.name,
            image: this.formatImageUrl(store.logoUrl || store.img || ''),
            logoUrl: this.formatImageUrl(store.logoUrl || store.img || ''),
            rating: store.ratingAvg || store.score || 0,
            monthlySales: store.monthlySales || store.month || store.sales || 0,
            avgPrice: store.avgPrice || 0,
            minOrder: store.minOrderAmount || store.start || 20,
            deliveryFee: store.deliveryFee || store.delivery || 3,
            deliveryTime: 30 + Math.floor(Math.random() * 30),
            distance: (Math.random() * 5).toFixed(1),
            tags: store.monthlySales > 1000 ? ['人气新店'] : [],
            activities: [],
            coupons: this.generateCoupons(store),
            businessStatus: store.businessStatus || 'open',
            ratingCount: store.ratingCount || 0,
            productCount: store.productCount || 0
          };
        });
        
        // 应用排序
        const sortedStores = this.sortStores(stores);
        
        // 如果是第一页，替换数据；否则追加
        const storeList = this.data.page === 1 
          ? sortedStores 
          : [...this.data.stores, ...sortedStores];
        
        this.setData({
          stores: storeList,
          total: res.result.data.total,
          hasMore: storeList.length < res.result.data.total,
          loading: false,
          loadingStores: false
        });
      } else {
        this.setData({
          loading: false,
          loadingStores: false
        });
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (err) {
      console.error('【校园超市】加载商家列表失败:', err);
      this.setData({
        loading: false,
        loadingStores: false
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 格式化图片URL
  formatImageUrl(url) {
    if (!url || url === 'undefined' || url === 'null') {
      return '';
    }
    if (url.startsWith('cloud://')) {
      return url;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return url;
  },

  // 生成优惠券信息
  generateCoupons(store) {
    const coupons = [];
    if (store.monthlySales > 500) {
      coupons.push(`神券 满${store.minOrderAmount || 20}减${Math.floor((store.minOrderAmount || 20) * 0.7)}`);
    }
    return coupons;
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchValue: e.detail.value
    });
  },

  // 搜索提交
  onSearchSubmit() {
    console.log('搜索:', this.data.searchValue);
    this.setData({
      page: 1,
      stores: []
    });
    this.loadStores();
  },

  // 筛选切换
  onFilterTap(e) {
    const index = e.currentTarget.dataset.index;
    const filters = this.data.filters;
    filters[index].active = !filters[index].active;
    this.setData({
      filters: filters
    });
  },

  // 排序切换
  onSortTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeSort: index
    });
    // 重新排序当前列表
    const sortedStores = this.sortStores(this.data.stores);
    this.setData({
      stores: sortedStores
    });
  },

  // 图片加载错误处理
  onImageError(e) {
    const index = e.currentTarget.dataset.index;
    const stores = this.data.stores;
    if (stores[index]) {
      stores[index].image = '/pages/小标/商家.png';
      this.setData({
        stores: stores
      });
    }
  },

  // 排序商家
  sortStores(stores) {
    const sortType = this.data.activeSort;
    const sorted = [...stores];
    
    switch (sortType) {
      case 0: // 综合排序（默认）
        return sorted;
      case 1: // 速度（按配送时间）
        return sorted.sort((a, b) => a.deliveryTime - b.deliveryTime);
      case 2: // 销量（按月销量）
        return sorted.sort((a, b) => b.monthlySales - a.monthlySales);
      case 3: // 评分（按评分）
        return sorted.sort((a, b) => b.rating - a.rating);
      default:
        return sorted;
    }
  },

  // 店铺点击
  onStoreTap(e) {
    const id = e.currentTarget.dataset.id;
    console.log('点击店铺:', id);
    wx.navigateTo({
      url: `/pages/store-detail/index?storeId=${id}`
    });
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingStores) {
      this.setData({
        page: this.data.page + 1
      });
      this.loadStores();
    }
  },

  // 返回
  onBackTap() {
    wx.navigateBack();
  }
});
