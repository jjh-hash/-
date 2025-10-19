Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    searchValue: '',
    activeCategory: 0,
    categories: ['全部', '数码电子', '服装配饰', '图书文具', '生活用品', '运动器材', '其他'],
    activeSort: 0,
    sortOptions: ['综合排序', '价格', '时间', '距离'],
    products: [
      {
        id: 1,
        title: 'iPhone 13 Pro 128GB 深空灰',
        price: 4500,
        originalPrice: 7999,
        images: ['https://picsum.photos/seed/product1/200/200'],
        category: '数码电子',
        location: '宿舍楼A座',
        publishTime: '2小时前',
        seller: {
          name: '小明',
          avatar: 'https://picsum.photos/seed/avatar1/40/40',
          rating: 4.8
        },
        description: '9成新，无磕碰，配件齐全，可小刀',
        tags: ['包邮', '可议价']
      },
      {
        id: 2,
        title: 'Nike Air Force 1 白色 42码',
        price: 380,
        originalPrice: 699,
        images: ['https://picsum.photos/seed/product2/200/200'],
        category: '服装配饰',
        location: '宿舍楼B座',
        publishTime: '1天前',
        seller: {
          name: '小红',
          avatar: 'https://picsum.photos/seed/avatar2/40/40',
          rating: 4.9
        },
        description: '只穿过几次，几乎全新，鞋盒还在',
        tags: ['包邮', '可议价']
      },
      {
        id: 3,
        title: '高等数学教材 同济版',
        price: 25,
        originalPrice: 45,
        images: ['https://picsum.photos/seed/product3/200/200'],
        category: '图书文具',
        location: '图书馆附近',
        publishTime: '3天前',
        seller: {
          name: '学霸',
          avatar: 'https://picsum.photos/seed/avatar3/40/40',
          rating: 5.0
        },
        description: '教材很新，有少量笔记，适合考研复习',
        tags: ['包邮']
      },
      {
        id: 4,
        title: '小米电饭煲 3L容量',
        price: 120,
        originalPrice: 199,
        images: ['https://picsum.photos/seed/product4/200/200'],
        category: '生活用品',
        location: '宿舍楼C座',
        publishTime: '1周前',
        seller: {
          name: '生活家',
          avatar: 'https://picsum.photos/seed/avatar4/40/40',
          rating: 4.7
        },
        description: '功能正常，清洗干净，适合宿舍使用',
        tags: ['可议价']
      }
    ]
  },

  onLoad() {
    // 页面加载时的逻辑
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
  },

  // 分类切换
  onCategoryTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeCategory: index
    });
  },

  // 排序切换
  onSortTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeSort: index
    });
  },

  // 商品点击
  onProductTap(e) {
    const id = e.currentTarget.dataset.id;
    console.log('点击商品:', id);
    // 跳转到商品详情页
  },

  // 发布商品
  onPublishTap() {
    wx.showToast({
      title: '发布功能开发中',
      icon: 'none'
    });
  },

  // 返回
  onBackTap() {
    wx.navigateBack();
  }
});
