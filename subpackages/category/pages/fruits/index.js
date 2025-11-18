Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    searchValue: '',
    merchants: [],
    loading: false,
    page: 1,
    pageSize: 20,
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
          storeCategory: '生鲜水果' // 按店铺分类筛选，只显示"生鲜水果"分类的店铺
        }
      });
      
      console.log('【生鲜水果】加载商家列表:', res.result);
      
      if (res.result && res.result.code === 200) {
        // 额外筛选：确保只显示"生鲜水果"分类的店铺
        const list = res.result.data.list || [];
        console.log('【生鲜水果】原始店铺列表:', list.map(s => ({ name: s.name, category: s.storeCategory || '(未设置)' })));
        
        const filteredList = list.filter(store => {
          const category = store.storeCategory || '';
          const match = category === '生鲜水果';
          if (!match && store.name) {
            console.log(`【生鲜水果】店铺"${store.name}"被过滤，分类为: "${category}"`);
          }
          return match;
        });
        
        console.log('【生鲜水果】筛选前店铺数量:', list.length);
        console.log('【生鲜水果】筛选后店铺数量:', filteredList.length);
        
        const stores = filteredList.map(store => {
          return {
            id: store._id || store.storeId,
            _id: store._id || store.storeId,
            name: store.name,
            logo: this.formatImageUrl(store.logoUrl || store.img || ''),
            rating: store.ratingAvg || store.score || 0,
            monthlySales: store.monthlySales || store.month || store.sales || 0,
            minOrder: store.minOrderAmount || store.start || 20,
            deliveryFee: store.deliveryFee || store.delivery || 3,
            deliveryTime: 30 + Math.floor(Math.random() * 30),
            distance: (Math.random() * 5).toFixed(1),
            products: []
          };
        });
        
        const merchants = this.data.page === 1 
          ? stores 
          : [...this.data.merchants, ...stores];
        
        this.setData({
          merchants: merchants,
          hasMore: merchants.length < res.result.data.total,
          loading: false,
          loadingStores: false
        });
      } else {
        this.setData({
          loading: false,
          loadingStores: false
        });
      }
    } catch (err) {
      console.error('【生鲜水果】加载商家列表失败:', err);
      this.setData({
        loading: false,
        loadingStores: false
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

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingStores) {
      this.setData({
        page: this.data.page + 1
      });
      this.loadStores();
    }
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
      merchants: []
    });
    this.loadStores();
  },

  // 商家点击
  onMerchantTap(e) {
    const id = e.currentTarget.dataset.id;
    console.log('点击商家:', id);
    wx.navigateTo({
      url: `/pages/store-detail/index?storeId=${id}`
    });
  },

  // 商品点击
  onProductTap(e) {
    const productId = e.currentTarget.dataset.productId;
    const merchantId = e.currentTarget.dataset.merchantId;
    console.log('点击商品:', productId, '商家:', merchantId);
  },

  // 返回
  onBackTap() {
    wx.navigateBack();
  }
});
