Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    searchValue: '',
    activeCategory: 1, // 奶茶果汁默认选中
    categories: ['全部', '奶茶果汁', '醒脑咖啡', '面包糕点', '冰凉甜品'],
    activeSort: 0,
    sortOptions: ['综合排序', '速度', '全部筛选'],
    stores: [
      {
        id: 1,
        name: 'coco mm茶饮',
        fullName: 'coco mm茶饮(第1风味+北…',
        logo: 'https://picsum.photos/seed/store1/80/80',
        rating: 4.0,
        monthlySales: 65,
        avgPrice: 14,
        deliveryType: '美团快送',
        minOrder: 18,
        deliveryFee: 9.1,
        deliveryTime: 37,
        distance: 6.5,
        tags: ['"一直回购"'],
        coupons: ['收藏领1元券'],
        products: [
          {
            id: 1,
            name: '杨枝甘露',
            price: 15.8,
            image: 'https://picsum.photos/seed/product1/80/80',
            tag: '冷'
          },
          {
            id: 2,
            name: '醇香红豆奶茶',
            price: 11.8,
            image: 'https://picsum.photos/seed/product2/80/80',
            tag: '冷热'
          },
          {
            id: 3,
            name: '草莓酸奶',
            price: 15.8,
            image: 'https://picsum.photos/seed/product3/80/80',
            tag: '冷'
          },
          {
            id: 4,
            name: '布丁奶茶',
            price: 1,
            image: 'https://picsum.photos/seed/product4/80/80',
            tag: '冷热'
          }
        ]
      },
      {
        id: 2,
        name: '喜悦果・霸王茶BANGWANG…',
        fullName: '喜悦果・霸王茶BANGWANG…',
        logo: 'https://picsum.photos/seed/store2/80/80',
        rating: 4.9,
        monthlySales: 300,
        avgPrice: 23,
        deliveryType: '美团快送',
        minOrder: 0,
        deliveryFee: 10.1,
        deliveryTime: 44,
        distance: 6.5,
        tags: [],
        coupons: ['收藏领1元券'],
        products: [
          {
            id: 5,
            name: '【首杯9.9】柠檬茶',
            price: 19,
            image: 'https://picsum.photos/seed/product5/80/80',
            tag: '冷'
          },
          {
            id: 6,
            name: '【超大杯】霸王茶',
            price: 25,
            image: 'https://picsum.photos/seed/product6/80/80',
            tag: '冷热'
          },
          {
            id: 7,
            name: '霸王・芒果茶',
            price: 30,
            image: 'https://picsum.photos/seed/product7/80/80',
            tag: '冷'
          },
          {
            id: 8,
            name: '霸王・柠檬茶',
            price: 22,
            image: 'https://picsum.photos/seed/product8/80/80',
            tag: '冷热'
          }
        ]
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

  // 商家点击
  onStoreTap(e) {
    const id = e.currentTarget.dataset.id;
    console.log('点击商家:', id);
  },

  // 商品点击
  onProductTap(e) {
    const productId = e.currentTarget.dataset.productId;
    const storeId = e.currentTarget.dataset.storeId;
    console.log('点击商品:', productId, '商家:', storeId);
  },

  // 返回
  onBackTap() {
    wx.navigateBack();
  }
});
