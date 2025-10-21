Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    activeTab: 0,
    tabs: ['点餐', '评价', '商家'],
    activeCategory: 0,
    cartItems: [],
    cartTotal: 0,
    // 规格选择弹窗相关
    showSpecPopup: false,
    currentProduct: null,
    selectedSpiciness: '微辣',
    selectedPortion: '小份',
    quantity: 1,
    // 购物车相关
    showCartSummary: false,
    cartItems: [],
    storeInfo: {
      name: '意大利特火小面条馆',
      description: '生活总是有很多的失败,就好比游戏的....',
      announcement: '失败了,就失败了,爬起来总结一下再继续',
      logo: 'https://picsum.photos/seed/store-logo/80/80',
      deliveryFee: 2,
      minOrder: 12
    },
    categories: [
      { id: 0, name: '麻辣香锅' },
      { id: 1, name: '麻辣香锅' },
      { id: 2, name: '麻辣香锅' },
      { id: 3, name: '麻辣香锅' },
      { id: 4, name: '麻辣香锅' },
      { id: 5, name: '麻辣香锅' },
      { id: 6, name: '麻辣香锅' },
      { id: 7, name: '麻辣香锅' },
      { id: 8, name: '麻辣香锅' },
      { id: 9, name: '麻辣香锅' },
      { id: 10, name: '麻辣香锅 微辣' }
    ],
    products: [
      {
        id: 1,
        name: '意大利特火小面条200g来点',
        price: 17,
        image: 'https://picsum.photos/seed/product1/120/120',
        category: 0,
        quantity: 0
      },
      {
        id: 2,
        name: '意大利特火小面条200g来点',
        price: 17,
        image: 'https://picsum.photos/seed/product2/120/120',
        category: 0,
        quantity: 0
      },
      {
        id: 3,
        name: '意大利特火小面条200g来点',
        price: 17,
        image: 'https://picsum.photos/seed/product3/120/120',
        category: 0,
        quantity: 0,
        hasSpec: true
      },
      {
        id: 4,
        name: '意大利特火小面条200g来点',
        price: 17,
        image: 'https://picsum.photos/seed/product4/120/120',
        category: 0,
        quantity: 0
      }
    ]
  },

  onLoad(options) {
    // 如果有传入的店铺ID，可以在这里获取店铺详情
    if (options.storeId) {
      this.loadStoreDetail(options.storeId);
    }
    this.calculateCartTotal();
    // 添加调试日志
    console.log('onLoad - Initial storeInfo.minOrder:', this.data.storeInfo.minOrder);
    console.log('onLoad - Initial cartTotal:', this.data.cartTotal);
  },

  // 加载店铺详情
  loadStoreDetail(storeId) {
    // 这里可以调用云函数获取店铺详情
    console.log('加载店铺详情:', storeId);
  },

  // 切换标签
  onTabTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeTab: index
    });
    
    // 如果点击评价标签，跳转到评价页面
    if (index === 1) {
      wx.navigateTo({
        url: '/pages/reviews/index?storeId=1'
      });
    }
    // 如果点击商家标签，跳转到商家信息页面
    else if (index === 2) {
      wx.navigateTo({
        url: '/pages/merchant-info/index?storeId=1'
      });
    }
  },

  // 切换分类
  onCategoryTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeCategory: index
    });
  },

  // 添加到购物车
  onAddToCart(e) {
    const productId = e.currentTarget.dataset.id;
    const product = this.data.products.find(p => p.id === productId);
    
    if (product) {
      // 更新商品数量
      const products = this.data.products.map(p => {
        if (p.id === productId) {
          return {
            ...p,
            quantity: p.quantity + 1
          };
        }
        return p;
      });
      
      // 添加到购物车列表
      const existingCartItem = this.data.cartItems.find(item => item.id === productId);
      let cartItems = [...this.data.cartItems];
      
      if (existingCartItem) {
        cartItems = cartItems.map(item => {
          if (item.id === productId) {
            return {
              ...item,
              quantity: item.quantity + 1
            };
          }
          return item;
        });
      } else {
        cartItems.push({
          ...product,
          quantity: 1,
          selectedSpec: product.selectedSpec || { spiciness: '微辣', portion: '小份' }
        });
      }
      
      this.setData({
        products: products,
        cartItems: cartItems
      }, () => {
        this.calculateCartTotal();
        // 添加调试日志
        console.log('onAddToCart - After setData, cartItems:', this.data.cartItems);
        console.log('onAddToCart - After setData, cartTotal:', this.data.cartTotal);
        console.log('onAddToCart - After setData, storeInfo.minOrder:', this.data.storeInfo.minOrder);
        console.log('onAddToCart - Condition (cartTotal >= minOrder):', this.data.cartTotal >= this.data.storeInfo.minOrder);
      });
      
      wx.showToast({
        title: '已添加到购物车',
        icon: 'success',
        duration: 1000
      });
    }
  },

  // 减少商品数量
  onRemoveFromCart(e) {
    const productId = e.currentTarget.dataset.id;
    
    // 更新商品数量
    const products = this.data.products.map(product => {
      if (product.id === productId && product.quantity > 0) {
        return {
          ...product,
          quantity: product.quantity - 1
        };
      }
      return product;
    });
    
    // 更新购物车
    let cartItems = [...this.data.cartItems];
    cartItems = cartItems.map(item => {
      if (item.id === productId && item.quantity > 0) {
        return {
          ...item,
          quantity: item.quantity - 1
        };
      }
      return item;
    }).filter(item => item.quantity > 0);
    
    this.setData({
      products: products,
      cartItems: cartItems
    });
    
    this.calculateCartTotal();
  },

  // 选择规格
  onSelectSpec(e) {
    const productId = e.currentTarget.dataset.id;
    const product = this.data.products.find(p => p.id === productId);
    
    if (product) {
      this.setData({
        showSpecPopup: true,
        currentProduct: product,
        selectedSpiciness: '微辣',
        selectedPortion: '小份',
        quantity: 1
      });
    }
  },

  // 关闭规格弹窗
  onCloseSpecPopup() {
    this.setData({
      showSpecPopup: false,
      currentProduct: null
    });
  },

  // 选择辣度
  onSelectSpiciness(e) {
    const spiciness = e.currentTarget.dataset.spiciness;
    this.setData({
      selectedSpiciness: spiciness
    });
  },

  // 选择分量
  onSelectPortion(e) {
    const portion = e.currentTarget.dataset.portion;
    this.setData({
      selectedPortion: portion
    });
  },

  // 增加数量
  onIncreaseQuantity() {
    this.setData({
      quantity: this.data.quantity + 1
    });
  },

  // 减少数量
  onDecreaseQuantity() {
    if (this.data.quantity > 1) {
      this.setData({
        quantity: this.data.quantity - 1
      });
    }
  },

  // 确认选择规格
  onConfirmSpec() {
    const { currentProduct, selectedSpiciness, selectedPortion, quantity } = this.data;
    
    // 更新商品数量
    const products = this.data.products.map(product => {
      if (product.id === currentProduct.id) {
        return {
          ...product,
          quantity: product.quantity + quantity,
          selectedSpec: {
            spiciness: selectedSpiciness,
            portion: selectedPortion
          }
        };
      }
      return product;
    });
    
    // 添加到购物车
    const existingCartItem = this.data.cartItems.find(item => item.id === currentProduct.id);
    let cartItems = [...this.data.cartItems];
    
    if (existingCartItem) {
      cartItems = cartItems.map(item => {
        if (item.id === currentProduct.id) {
          return {
            ...item,
            quantity: item.quantity + quantity,
            selectedSpec: {
              spiciness: selectedSpiciness,
              portion: selectedPortion
            }
          };
        }
        return item;
      });
    } else {
      cartItems.push({
        ...currentProduct,
        quantity: quantity,
        selectedSpec: {
          spiciness: selectedSpiciness,
          portion: selectedPortion
        }
      });
    }
    
    this.setData({
      products: products,
      cartItems: cartItems,
      showSpecPopup: false,
      currentProduct: null
    });
    
    this.calculateCartTotal();
    
    wx.showToast({
      title: '已添加到购物车',
      icon: 'success',
      duration: 1000
    });
  },

  // 计算购物车总价
  calculateCartTotal() {
    const total = this.data.cartItems.reduce((sum, item) => {
      // 确保价格和数量都是数字
      const price = parseFloat(item.price) || 0;
      const quantity = parseInt(item.quantity) || 0;
      const itemTotal = price * quantity;
      console.log(`商品 ${item.name}: 价格=${price}, 数量=${quantity}, 小计=${itemTotal}`);
      return sum + itemTotal;
    }, 0);
    
    console.log('购物车总价计算:', total);
    
    this.setData({
      cartTotal: total
    }, () => {
      // 添加调试日志
      console.log('calculateCartTotal - Updated cartTotal:', this.data.cartTotal);
      console.log('calculateCartTotal - Current storeInfo.minOrder:', this.data.storeInfo.minOrder);
      console.log('calculateCartTotal - Condition (cartTotal >= minOrder):', this.data.cartTotal >= this.data.storeInfo.minOrder);
      console.log('calculateCartTotal - cartItems.length:', this.data.cartItems.length);
    });
  },

  // 切换购物车弹窗显示
  onToggleCartSummary() {
    if (this.data.cartItems.length > 0) {
      this.setData({
        showCartSummary: !this.data.showCartSummary
      });
    } else {
      wx.showToast({
        title: '购物车是空的',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 购物车中增加商品数量
  onCartIncrease(e) {
    const productId = e.currentTarget.dataset.id;
    const cartItems = this.data.cartItems.map(item => {
      if (item.id === productId) {
        return {
          ...item,
          quantity: item.quantity + 1
        };
      }
      return item;
    });
    
    // 同步更新商品列表
    const products = this.data.products.map(product => {
      if (product.id === productId) {
        return {
          ...product,
          quantity: product.quantity + 1
        };
      }
      return product;
    });
    
    this.setData({
      cartItems: cartItems,
      products: products
    });
    
    this.calculateCartTotal();
  },

  // 购物车中减少商品数量
  onCartDecrease(e) {
    const productId = e.currentTarget.dataset.id;
    let cartItems = this.data.cartItems.map(item => {
      if (item.id === productId && item.quantity > 0) {
        return {
          ...item,
          quantity: item.quantity - 1
        };
      }
      return item;
    }).filter(item => item.quantity > 0);
    
    // 同步更新商品列表
    const products = this.data.products.map(product => {
      if (product.id === productId && product.quantity > 0) {
        return {
          ...product,
          quantity: product.quantity - 1
        };
      }
      return product;
    });
    
    this.setData({
      cartItems: cartItems,
      products: products
    });
    
    this.calculateCartTotal();
  },

  // 清空购物车
  onClearCart() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空购物车吗？',
      success: (res) => {
        if (res.confirm) {
          const products = this.data.products.map(product => ({
            ...product,
            quantity: 0
          }));
          
          this.setData({
            cartItems: [],
            products: products,
            showCartSummary: false
          });
          
          this.calculateCartTotal();
          
          wx.showToast({
            title: '购物车已清空',
            icon: 'success',
            duration: 1000
          });
        }
      }
    });
  },

  // 结算
  onCheckout() {
    if (this.data.cartTotal < this.data.storeInfo.minOrder) {
      wx.showToast({
        title: `满¥${this.data.storeInfo.minOrder}起送`,
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 跳转到结算页面，传递购物车数据
    const cartData = {
      cartItems: this.data.cartItems,
      cartTotal: this.data.cartTotal,
      storeInfo: this.data.storeInfo
    };
    
    wx.navigateTo({
      url: `/pages/checkout/index?cartData=${encodeURIComponent(JSON.stringify(cartData))}`,
      success: () => {
        console.log('跳转到结算页面成功');
      },
      fail: (err) => {
        console.error('跳转到结算页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 获取当前分类的商品
  getCurrentCategoryProducts() {
    return this.data.products.filter(product => product.category === this.data.activeCategory);
  },

  // 返回
  onBackTap() {
    wx.navigateBack();
  },

  // 更多选项
  onMoreTap() {
    wx.showActionSheet({
      itemList: ['分享店铺', '收藏店铺', '联系客服'],
      success: (res) => {
        console.log('选择了:', res.tapIndex);
      }
    });
  }
});
