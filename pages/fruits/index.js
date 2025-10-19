Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    searchValue: '爆款零食0.01元起',
    activeMainCategory: 2, // 水果分类默认选中
    mainCategories: [
      { name: '全部', icon: '🛍️' },
      { name: '生鲜菜场', icon: '🥬' },
      { name: '水果', icon: '🍎' },
      { name: '鲜活海鲜', icon: '🐟' },
      { name: '果切果捞', icon: '🍉' },
      { name: '葡提莓果', icon: '🍇' },
      { name: '热带水果', icon: '🥭' }
    ],
    activeSubCategory: 0,
    subCategories: [
      { name: '全部商家', icon: '✅' },
      { name: '果切果捞', icon: '🍊' },
      { name: '葡提莓果', icon: '🍓' },
      { name: '热带水果', icon: '🥭' },
      { name: '柑橘类', icon: '🍊' }
    ],
    merchants: [
      {
        id: 1,
        name: '切果果',
        brand: '品牌',
        description: '切果果・果切・水果捞・',
        logo: 'https://picsum.photos/seed/logo1/60/60',
        deliveryType: '商家自配',
        rating: 4.5,
        monthlySales: 800,
        minOrder: 19.9,
        deliveryFee: 0,
        deliveryTime: 65,
        distance: 2.3,
        guarantee: '坏必赔',
        quote: '"红彤彤的果肉看着就诱人"',
        coupons: ['神券 满20减17', '新人红包 20减17'],
        salesRank: 5,
        storeLocation: '中牟县水果店',
        products: [
          {
            id: 1,
            name: '【爆品】阳光玫',
            price: 0.01,
            originalPrice: null,
            image: 'https://picsum.photos/seed/product1/120/120',
            tag: null,
            isFirstItem: true
          },
          {
            id: 2,
            name: '切果 大自然的搬运工',
            subtitle: '【好吃推荐】招',
            price: 22.8,
            originalPrice: null,
            image: 'https://picsum.photos/seed/product2/120/120',
            tag: '新鲜现切'
          },
          {
            id: 3,
            name: '切果 大自然的搬运',
            subtitle: '【一果一盒】鲜',
            price: 4.2,
            originalPrice: null,
            image: 'https://picsum.photos/seed/product3/120/120',
            tag: '新鲜现切'
          }
        ]
      },
      {
        id: 2,
        name: '果吉配金枕榴莲・整果',
        brand: '品牌',
        description: '果吉配金枕榴莲・整果',
        logo: 'https://picsum.photos/seed/logo2/60/60',
        deliveryType: '商家自配',
        rating: 4.8,
        monthlySales: 200,
        minOrder: 30,
        deliveryFee: 0,
        deliveryTime: 90,
        distance: 11.3,
        guarantee: '坏必赔',
        quote: '"干净严实"',
        coupons: ['神券 立减17', '新人红包 立减17'],
        products: [
          {
            id: 4,
            name: '【空运】美国',
            price: 50,
            originalPrice: null,
            image: 'https://picsum.photos/seed/product4/120/120',
            tag: null,
            quantity: '10件总价'
          },
          {
            id: 5,
            name: '美国进口红车',
            price: 39,
            originalPrice: null,
            image: 'https://picsum.photos/seed/product5/120/120',
            tag: null,
            deliveryPrice: '到手价'
          },
          {
            id: 6,
            name: '【树上熟A级果',
            price: 10,
            originalPrice: null,
            image: 'https://picsum.photos/seed/product6/120/120',
            tag: null
          }
        ]
      },
      {
        id: 3,
        name: '果鲜达',
        brand: null,
        description: null,
        logo: 'https://picsum.photos/seed/logo3/60/60',
        deliveryType: '美团专送',
        rating: null,
        monthlySales: null,
        minOrder: 15,
        deliveryFee: 7,
        deliveryTime: 40,
        distance: 4.3,
        guarantee: null,
        quote: null,
        coupons: ['新人红包 20减17'],
        interested: 146,
        products: [
          {
            id: 7,
            name: '新鲜水果篮',
            price: 25.8,
            originalPrice: null,
            image: 'https://picsum.photos/seed/product7/120/120',
            tag: null
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

  // 主分类切换
  onMainCategoryTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeMainCategory: index
    });
  },

  // 子分类切换
  onSubCategoryTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeSubCategory: index
    });
  },

  // 商家点击
  onMerchantTap(e) {
    const id = e.currentTarget.dataset.id;
    console.log('点击商家:', id);
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
