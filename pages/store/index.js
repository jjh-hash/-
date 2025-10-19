Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    activeTab: 0,
    tabs: ['商品', '评论⁹', '商家'],
    activeCategory: 0,
    sortBy: 'sales', // sales 或 price
    sortOrder: 'desc', // asc 或 desc
    cartItems: [],
    cartTotal: 0,
    storeInfo: {
      name: '河工零食铺子',
      deliveryTime: '约30分钟',
      minOrder: 10.0,
      deliveryFee: 1,
      announcement: '本店暂无公告'
    },
    categories: [
      { id: 0, name: '军训特价商品' },
      { id: 1, name: '槟榔' },
      { id: 2, name: '泡面' },
      { id: 3, name: '拌面凉面' },
      { id: 4, name: '干吃面' },
      { id: 5, name: '辣条' },
      { id: 6, name: '来口肉' },
      { id: 7, name: '香肠' },
      { id: 8, name: '面包' },
      { id: 9, name: '糖' },
      { id: 10, name: '饮品' }
    ],
    products: [
      {
        id: 1,
        name: '纯悦12瓶',
        description: '整箱购更优惠',
        price: 12,
        originalPrice: null,
        image: 'https://picsum.photos/seed/product1/120/120',
        category: 0,
        sales: 0,
        likes: 0,
        tags: []
      },
      {
        id: 2,
        name: '蓝标24瓶',
        description: '',
        price: 15,
        originalPrice: null,
        image: 'https://picsum.photos/seed/product2/120/120',
        category: 0,
        sales: 3,
        likes: 0,
        tags: []
      },
      {
        id: 3,
        name: '康师傅大食桶番茄鸡蛋面',
        description: '',
        price: 5.2,
        originalPrice: 6,
        image: 'https://picsum.photos/seed/product3/120/120',
        category: 0,
        sales: 18,
        likes: 0,
        tags: ['8.67折', '超级会员专享']
      },
      {
        id: 4,
        name: '丹江水500ml',
        description: '',
        price: 2.5,
        originalPrice: null,
        image: 'https://picsum.photos/seed/product4/120/120',
        category: 0,
        sales: 120,
        likes: 1,
        tags: ['特价商品']
      }
    ]
  },

  onLoad() {
    this.calculateCartTotal();
  },

  // 切换标签
  onTabTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeTab: index
    });
  },

  // 切换分类
  onCategoryTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeCategory: index
    });
  },

  // 切换排序
  onSortTap() {
    const sortBy = this.data.sortBy;
    const sortOrder = this.data.sortOrder;
    
    if (sortBy === 'sales') {
      this.setData({
        sortBy: 'price',
        sortOrder: 'asc'
      });
    } else {
      this.setData({
        sortBy: 'sales',
        sortOrder: 'desc'
      });
    }
  },

  // 添加到购物车
  onAddToCart(e) {
    const productId = e.currentTarget.dataset.id;
    const product = this.data.products.find(p => p.id === productId);
    
    if (product) {
      const cartItems = [...this.data.cartItems];
      const existingItem = cartItems.find(item => item.id === productId);
      
      if (existingItem) {
        existingItem.quantity += 1;
      } else {
        cartItems.push({
          ...product,
          quantity: 1
        });
      }
      
      this.setData({
        cartItems: cartItems
      });
      
      this.calculateCartTotal();
      
      wx.showToast({
        title: '已添加到购物车',
        icon: 'success',
        duration: 1000
      });
    }
  },

  // 计算购物车总价
  calculateCartTotal() {
    const total = this.data.cartItems.reduce((sum, item) => {
      return sum + (item.price * item.quantity);
    }, 0);
    
    this.setData({
      cartTotal: total
    });
  },

  // 获取当前分类的商品
  getCurrentCategoryProducts() {
    return this.data.products.filter(product => product.category === this.data.activeCategory);
  },

  // 返回
  onBackTap() {
    wx.navigateBack();
  }
});
