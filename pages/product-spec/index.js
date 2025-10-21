Page({
  data: {
    statusBarHeight: 0,
    productInfo: {
      id: '',
      name: '',
      price: 0,
      image: ''
    },
    specOptions: [],
    selectedSpec: null,
    quantity: 1,
    remark: '',
    totalPrice: 0
  },

  onLoad(options) {
    // 获取系统信息
    const systemInfo = wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: systemInfo.statusBarHeight
    });

    // 获取商品信息
    if (options.productId) {
      this.loadProductInfo(options.productId);
    }
  },

  // 加载商品信息
  loadProductInfo(productId) {
    // 模拟数据，实际应该从云函数获取
    const mockProduct = {
      id: productId,
      name: '美味汉堡',
      price: 25.00,
      image: '/images/hamburger.jpg'
    };

    const mockSpecs = [
      { id: '1', name: '小份', price: 20.00 },
      { id: '2', name: '中份', price: 25.00 },
      { id: '3', name: '大份', price: 30.00 }
    ];

    this.setData({
      productInfo: mockProduct,
      specOptions: mockSpecs,
      selectedSpec: mockSpecs[1], // 默认选中中份
      totalPrice: mockSpecs[1].price
    });
  },

  // 选择规格
  selectSpec(e) {
    const spec = e.currentTarget.dataset.spec;
    this.setData({
      selectedSpec: spec,
      totalPrice: spec.price * this.data.quantity
    });
  },

  // 减少数量
  decreaseQuantity() {
    if (this.data.quantity > 1) {
      const newQuantity = this.data.quantity - 1;
      this.setData({
        quantity: newQuantity,
        totalPrice: this.data.selectedSpec.price * newQuantity
      });
    }
  },

  // 增加数量
  increaseQuantity() {
    const newQuantity = this.data.quantity + 1;
    this.setData({
      quantity: newQuantity,
      totalPrice: this.data.selectedSpec.price * newQuantity
    });
  },

  // 备注输入
  onRemarkInput(e) {
    this.setData({
      remark: e.detail.value
    });
  },

  // 返回上一页
  onBack() {
    wx.navigateBack();
  },

  // 加入购物车
  addToCart() {
    if (!this.data.selectedSpec) {
      wx.showToast({
        title: '请选择规格',
        icon: 'none'
      });
      return;
    }

    const cartItem = {
      productId: this.data.productInfo.id,
      specId: this.data.selectedSpec.id,
      specName: this.data.selectedSpec.name,
      price: this.data.selectedSpec.price,
      quantity: this.data.quantity,
      remark: this.data.remark,
      image: this.data.productInfo.image,
      name: this.data.productInfo.name
    };

    // 保存到本地存储
    let cart = wx.getStorageSync('cart') || [];
    cart.push(cartItem);
    wx.setStorageSync('cart', cart);

    wx.showToast({
      title: '已加入购物车',
      icon: 'success'
    });

    // 延迟返回
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  }
});
