Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    searchValue: '',
    activeCategory: 0,
    categories: ['全部', '数码电子', '服装配饰', '图书文具', '生活用品', '运动器材', '其他'],
    activeSort: 0,
    sortOptions: ['综合排序', '价格从低到高', '价格从高到低', '最新发布'],
    products: [],
    loading: false,
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true,
    loadingProducts: false
  },

  onLoad() {
    this.loadProducts();
  },

  onShow() {
    // 页面显示时检查是否需要刷新
    // 如果从发布页面返回，需要刷新列表
    const app = getApp();
    if (app.globalData && app.globalData.needRefreshSecondhandList) {
      app.globalData.needRefreshSecondhandList = false;
      // 重置页码并刷新
      this.setData({
        page: 1,
        products: []
      });
      this.loadProducts();
    }
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      searchValue: e.detail.value
    });
  },

  // 加载商品列表
  async loadProducts() {
    if (this.data.loadingProducts) {
      return;
    }

    this.setData({ loadingProducts: true, loading: true });

    try {
      // 确定分类
      const category = this.data.activeCategory === 0 
        ? undefined 
        : this.data.categories[this.data.activeCategory];

      // 确定排序
      let sort = 'time';
      switch (this.data.activeSort) {
        case 1:
          sort = 'price';
          break;
        case 2:
          sort = 'priceDesc';
          break;
        case 3:
        default:
          sort = 'time';
          break;
      }

      const res = await wx.cloud.callFunction({
        name: 'idleProductManage',
        data: {
          action: 'getList',
          data: {
            page: this.data.page,
            pageSize: this.data.pageSize,
            category: category,
            keyword: this.data.searchValue || undefined,
            sort: sort
          }
        }
      });

      console.log('【闲置出售】加载商品列表:', res.result);

      if (res.result && res.result.code === 200) {
        const products = (res.result.data.list || []).map(product => ({
          ...product,
          seller: {
            name: product.sellerName || '匿名用户',
            avatar: product.sellerAvatar || '/pages/小标/商家.png',
            rating: 5.0 // 暂时使用默认评分
          }
        }));

        // 如果是第一页，替换数据；否则追加
        const allProducts = this.data.page === 1 
          ? products 
          : [...this.data.products, ...products];

        this.setData({
          products: allProducts,
          total: res.result.data.total,
          hasMore: allProducts.length < res.result.data.total,
          loading: false,
          loadingProducts: false
        });
      } else {
        this.setData({
          loading: false,
          loadingProducts: false
        });
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (err) {
      console.error('【闲置出售】加载商品列表失败:', err);
      this.setData({
        loading: false,
        loadingProducts: false
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // 搜索提交
  onSearchSubmit() {
    console.log('搜索:', this.data.searchValue);
    this.setData({
      page: 1,
      products: []
    });
    this.loadProducts();
  },

  // 分类切换
  onCategoryTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeCategory: index,
      page: 1,
      products: []
    });
    this.loadProducts();
  },

  // 排序切换
  onSortTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeSort: index,
      page: 1,
      products: []
    });
    this.loadProducts();
  },

  // 商品点击
  onProductTap(e) {
    const id = e.currentTarget.dataset.id;
    console.log('点击商品:', id);
    // 跳转到商品详情页
    wx.navigateTo({
      url: `/subpackages/secondhand/pages/secondhand-detail/index?id=${id}`
    });
  },

  // 发布商品
  onPublishTap() {
    wx.navigateTo({
      url: '/subpackages/secondhand/pages/secondhand-publish/index'
    });
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingProducts) {
      this.setData({
        page: this.data.page + 1
      });
      this.loadProducts();
    }
  },

  // 返回
  onBackTap() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      // 如果没有上一页，跳转到首页
      wx.reLaunch({
        url: '/pages/home/index'
      });
    }
  }
});
