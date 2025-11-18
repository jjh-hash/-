Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    activeTab: 0,
    tabs: ['点餐', '评价', '商家'],
    activeCategory: 0,
    storeId: '', // 店铺ID
    displayProducts: [], // 当前显示的商品列表（根据分类筛选）
    cartItems: [],
    cartTotal: 0,
    // 规格选择弹窗相关
    showSpecPopup: false,
    currentProduct: null,
    selectedSpecs: {}, // 存储每个规格组选中的规格项 { groupIndex: optionIndex } 或 { groupIndex: [optionIndex1, optionIndex2] }
    quantity: 1,
    selectedSpecsText: '', // 已选规格文字描述
    specTotalPrice: 0, // 规格选择弹窗中的总价格
    specSelectionMap: {}, // 规格选中状态映射（用于 WXML 显示）
    // 购物车相关
    showCartSummary: false,
    deliveryType: 'delivery', // 'delivery' 外送, 'pickup' 自取
    priceInfo: null, // 价格信息
    storeInfo: {
      name: '意大利特火小面条馆',
      description: '生活总是有很多的失败,就好比游戏的....',
      announcement: '失败了,就失败了,爬起来总结一下再继续',
      logo: 'https://picsum.photos/seed/store-logo/80/80',
      deliveryFee: 2,
      minOrder: 12,
      overallRating: 0,
      deliveryRating: 0,
      totalReviews: 0,
      ratingStars: [false, false, false, false, false]
    },
    // 评价相关
    reviews: [],
    reviewsLoading: false,
    // 商家信息相关
    merchantInfo: {
      monthlySales: 0,
      location: '',
      phone: '',
      businessHours: '',
      deliveryService: '',
      introduction: ''
    },
    merchantInfoLoading: false,
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
    console.log('【店铺详情】onLoad接收参数:', options);
    
    // 如果有传入的店铺ID，可以在这里获取店铺详情
    if (options.storeId) {
      this.setData({ storeId: options.storeId });
      this.loadStoreDetail(options.storeId);
    } else {
      // 如果没有传入storeId，使用模拟数据
      console.log('【店铺详情】未传入店铺ID，使用模拟数据');
    }
    this.calculateCartTotal();
    // 添加调试日志
    console.log('onLoad - Initial storeInfo.minOrder:', this.data.storeInfo.minOrder);
    console.log('onLoad - Initial cartTotal:', this.data.cartTotal);
  },

  // 页面显示时刷新店铺状态
  onShow() {
    // 如果已有店铺ID，刷新店铺状态（获取最新状态）
    if (this.data.storeId) {
      console.log('【店铺详情】onShow 刷新店铺状态，店铺ID:', this.data.storeId);
      this.loadStoreDetail(this.data.storeId);
    }
  },

  // 加载店铺详情
  async loadStoreDetail(storeId) {
    try {
      wx.showLoading({ title: '加载中...' });
      
      console.log('【店铺详情】加载店铺详情，店铺ID:', storeId);
      
      const res = await wx.cloud.callFunction({
        name: 'storeManage',
        data: {
          action: 'getStoreDetailWithProducts',
          data: {
            storeId: storeId
          }
        }
      });
      
      console.log('【店铺详情】云函数返回:', res.result);
      
      if (res.result && res.result.code === 200) {
        const { storeInfo, categories, products } = res.result.data;
        
        // 处理头像，优先使用avatar，然后是logo/logoUrl
        let avatar = storeInfo.avatar || storeInfo.logo || storeInfo.logoUrl || '';
        if (!avatar || avatar === 'undefined' || avatar === 'null' || avatar.trim() === '') {
          avatar = '/pages/小标/商家.png';
        }
        
        // 更新店铺信息，保留storeId
        this.setData({
          storeId: storeId, // 保存storeId到data中
          storeInfo: {
            storeId: storeId, // 添加到storeInfo中
            _id: storeId, // 兼容字段
            name: storeInfo.name,
            description: storeInfo.description,
            announcement: storeInfo.announcement,
            avatar: avatar, // 优先使用avatar字段
            logo: avatar, // 兼容字段
            logoUrl: avatar, // 兼容字段
            deliveryFee: storeInfo.deliveryFee,
            minOrder: storeInfo.minOrder,
            businessStatus: storeInfo.businessStatus || 'open' // 保存店铺状态
          },
          categories: categories,
          products: products,
          activeCategory: 0 // 确保默认选中第一个分类
        }, () => {
          console.log('【店铺详情】数据加载成功');
          console.log('【店铺详情】storeInfo:', this.data.storeInfo);
          console.log('【店铺详情】categories:', this.data.categories);
          console.log('【店铺详情】products:', this.data.products);
          
          // 数据加载完成后，根据第一个分类筛选商品
          this.filterProductsByCategory();
        });
      } else if (res.result && res.result.code === 403) {
        // 店铺休息中
        wx.hideLoading();
        wx.showModal({
          title: '提示',
          content: res.result.message || '店铺当前休息中，暂不提供服务',
          showCancel: false,
          success: () => {
            wx.navigateBack();
          }
        });
      } else {
        console.error('【店铺详情】加载失败:', res.result);
        wx.hideLoading();
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (err) {
      console.error('【店铺详情】加载异常:', err);
      wx.showToast({
        title: '加载异常',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 切换标签
  onTabTap(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      activeTab: index
    });
    
    // 根据标签加载对应数据
    if (index === 1) {
      // 切换到评价标签，加载评价数据
      if (this.data.reviews.length === 0 && !this.data.reviewsLoading) {
        this.loadReviewList(this.data.storeId);
        this.loadStoreRating(this.data.storeId);
      }
    } else if (index === 2) {
      // 切换到商家标签，加载商家信息
      if (!this.data.merchantInfo.location && !this.data.merchantInfoLoading) {
        this.loadMerchantInfo(this.data.storeId);
      }
    }
  },
  
  // 加载店铺评分
  async loadStoreRating(storeId) {
    if (!storeId) return;
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'reviewManage',
        data: {
          action: 'getStoreRating',
          data: {
            storeId: storeId
          }
        }
      });

      if (res.result && res.result.code === 200) {
        const ratingData = res.result.data || {};
        const overallRating = ratingData.overallRating || 0;
        const deliveryRating = ratingData.deliveryRating || 0;
        const totalReviews = ratingData.totalReviews || 0;
        
        // 计算星星数组
        const fullStars = Math.floor(overallRating);
        const ratingStars = [];
        for (let i = 0; i < 5; i++) {
          ratingStars.push(i < fullStars);
        }
        
        this.setData({
          'storeInfo.overallRating': overallRating,
          'storeInfo.deliveryRating': deliveryRating,
          'storeInfo.totalReviews': totalReviews,
          'storeInfo.ratingStars': ratingStars
        });
      }
    } catch (error) {
      console.error('加载店铺评分失败:', error);
    }
  },
  
  // 加载评论列表
  async loadReviewList(storeId) {
    if (!storeId || this.data.reviewsLoading) return;
    
    this.setData({ reviewsLoading: true });
    
    try {
      wx.showLoading({ title: '加载中...' });
      
      const res = await wx.cloud.callFunction({
        name: 'reviewManage',
        data: {
          action: 'getReviewList',
          data: {
            storeId: storeId,
            page: 1,
            pageSize: 20,
            filter: 'all'
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        const rawList = res.result.data?.list || [];
        
        // 格式化评论数据
        const reviews = rawList.map(review => {
          const rating = review.rating || 5;
          const stars = [];
          for (let i = 0; i < 5; i++) {
            stars.push(i < rating);
          }
          
          // 格式化日期
          let date = '';
          if (review.createdAt) {
            const d = new Date(review.createdAt);
            if (!isNaN(d.getTime())) {
              // 转换为中国时间
              const chinaTimeOffset = 8 * 60 * 60 * 1000;
              const chinaTime = new Date(d.getTime() + chinaTimeOffset);
              const year = chinaTime.getUTCFullYear();
              const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
              const day = String(chinaTime.getUTCDate()).padStart(2, '0');
              date = `${year}.${month}.${day}`;
            }
          }
          
          return {
            id: review._id,
            userName: review.userName || '用户',
            userAvatar: review.userAvatar || '/pages/小标/商家.png',
            rating: rating,
            stars: stars,
            content: review.content || '',
            images: review.images || [],
            hasMerchantReply: review.hasMerchantReply || false,
            merchantReply: review.merchantReply || '',
            date: date
          };
        });
        
        this.setData({
          reviews: reviews,
          reviewsLoading: false
        });
      } else {
        this.setData({ reviewsLoading: false });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('加载评论列表失败:', error);
      this.setData({ reviewsLoading: false });
    }
  },
  
  // 加载商家信息
  async loadMerchantInfo(storeId) {
    if (!storeId || this.data.merchantInfoLoading) return;
    
    this.setData({ merchantInfoLoading: true });
    
    try {
      wx.showLoading({ title: '加载中...' });
      
      const res = await wx.cloud.callFunction({
        name: 'storeManage',
        data: {
          action: 'getStoreDetail',
          data: {
            storeId: storeId
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200 && res.result.data && res.result.data.store) {
        const store = res.result.data.store;
        
        // 格式化营业时间
        let businessHours = '未设置营业时间';
        if (store.businessHours) {
          if (typeof store.businessHours === 'object' && store.businessHours.startTime && store.businessHours.endTime) {
            businessHours = `${store.businessHours.startTime} - ${store.businessHours.endTime}`;
          } else if (store.businessHours === '24小时' || store.businessHours === '全天24小时营业') {
            businessHours = '全天24小时营业';
          } else {
            businessHours = String(store.businessHours);
          }
        }

        // 格式化配送服务
        let deliveryService = '提供配送服务';
        if (store.deliveryArea) {
          deliveryService = `配送范围：${store.deliveryArea}`;
        }
        
        this.setData({
          merchantInfo: {
            monthlySales: store.monthlySales || 0,
            location: store.location || store.address || '未设置地址',
            phone: store.phone || store.contactPhone || '未设置电话',
            businessHours: businessHours,
            deliveryService: deliveryService,
            introduction: store.introduction || store.description || '暂无简介'
          },
          merchantInfoLoading: false
        });
      } else {
        this.setData({ merchantInfoLoading: false });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('加载商家信息失败:', error);
      this.setData({ merchantInfoLoading: false });
    }
  },

  // 切换分类
  onCategoryTap(e) {
    const index = e.currentTarget.dataset.index;
    console.log('【分类切换】点击分类索引:', index);
    
    this.setData({
      activeCategory: index
    }, () => {
      console.log('【分类切换】activeCategory 更新为:', this.data.activeCategory);
      // 筛选商品并更新显示
      this.filterProductsByCategory();
    });
  },

  // 根据当前分类筛选商品
  filterProductsByCategory() {
    const { categories, products, activeCategory } = this.data;
    
    console.log('【筛选商品】当前activeCategory:', activeCategory);
    console.log('【筛选商品】所有分类:', categories);
    console.log('【筛选商品】所有商品:', products);
    
    // 如果没有商品，显示空列表
    if (!products || products.length === 0) {
      console.log('【筛选商品】商品列表为空');
      this.setData({
        displayProducts: []
      });
      return;
    }
    
    // 如果没有分类，显示所有商品
    if (!categories || categories.length === 0) {
      console.log('【筛选商品】分类列表为空，显示所有商品');
      this.setData({
        displayProducts: products
      });
      return;
    }
    
    // 确保activeCategory在有效范围内
    const validCategoryIndex = Math.max(0, Math.min(activeCategory || 0, categories.length - 1));
    const currentCategory = categories[validCategoryIndex];
    
    if (!currentCategory) {
      console.log('【筛选商品】当前分类不存在，显示所有商品');
      this.setData({
        displayProducts: products,
        activeCategory: 0 // 重置为第一个分类
      });
      return;
    }
    
    console.log('【筛选商品】当前选中分类:', currentCategory);
    console.log('【筛选商品】分类ID:', currentCategory.id);
    
    // 如果是默认分类或全部商品，返回所有商品
    if (currentCategory.id === 'default' || currentCategory.name === '全部商品') {
      console.log('【筛选商品】选中"全部商品"，显示所有商品');
      this.setData({
        displayProducts: products
      });
      return;
    }
    
    // 否则筛选当前分类的商品
    const filteredProducts = products.filter(product => {
      // 兼容多种ID格式：categoryId可能是字符串或对象
      const productCategoryId = product.categoryId || product.category || '';
      const categoryId = currentCategory.id || currentCategory._id || '';
      
      // 转换为字符串进行比较
      const match = String(productCategoryId) === String(categoryId);
      
      if (match) {
        console.log(`✓ 匹配商品: ${product.name}, categoryId: ${productCategoryId}, 分类ID: ${categoryId}`);
      }
      
      return match;
    });
    
    console.log('【筛选商品】筛选结果:', filteredProducts.length, '个商品');
    console.log('【筛选商品】筛选后的商品列表:', filteredProducts.map(p => p.name));
    
    this.setData({
      displayProducts: filteredProducts.length > 0 ? filteredProducts : [],
      activeCategory: validCategoryIndex // 确保activeCategory是有效的索引
    });
  },

  // 获取当前分类的商品（保留用于其他用途）
  getCurrentCategoryProducts() {
    return this.data.displayProducts || this.data.products;
  },

  // 添加到购物车
  onAddToCart(e) {
    // 检查店铺状态：只有营业中的店铺才能添加商品到购物车
    if (this.data.storeInfo.businessStatus && this.data.storeInfo.businessStatus !== 'open') {
      wx.showToast({
        title: '店铺当前休息中，暂不提供服务',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
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
      
      // 同时更新displayProducts，保持数量同步
      const displayProducts = this.data.displayProducts.map(p => {
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
        displayProducts: displayProducts, // 更新显示的商品列表
        cartItems: cartItems
      }, () => {
        this.calculateCartTotal();
        console.log('onAddToCart - After setData, cartItems:', this.data.cartItems);
        console.log('onAddToCart - After setData, cartTotal:', this.data.cartTotal);
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
    
    // 同时更新displayProducts
    const displayProducts = this.data.displayProducts.map(product => {
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
      displayProducts: displayProducts, // 更新显示的商品列表
      cartItems: cartItems
    });
    
    this.calculateCartTotal();
  },

  // 选择规格
  onSelectSpec(e) {
    const productId = e.currentTarget.dataset.id;
    const product = this.data.products.find(p => p.id === productId);
    
    if (product && product.specifications && product.specifications.length > 0) {
      // 初始化选中规格：根据类型设置默认值
      const selectedSpecs = {};
      product.specifications.forEach((group, groupIndex) => {
        if (group.options && group.options.length > 0) {
          const type = group.type || 'single'; // 默认为单选
          console.log(`【打开规格弹窗】规格组 ${groupIndex} (${group.name}): type=${type}`);
          if (type === 'required' || type === 'single') {
            // 必选和单选：默认选择第一个选项
            selectedSpecs[groupIndex] = 0;
          } else if (type === 'multiple') {
            // 多选：默认不选择（空数组）
            selectedSpecs[groupIndex] = [];
          }
        }
      });
      
      console.log('【打开规格弹窗】product:', product);
      console.log('【打开规格弹窗】product.specifications:', product.specifications);
      console.log('【打开规格弹窗】初始化的selectedSpecs:', selectedSpecs);
      
      const specSelectionMap = this.calculateSpecSelectionMap(product, selectedSpecs);
      this.setData({
        showSpecPopup: true,
        currentProduct: product,
        selectedSpecs: selectedSpecs,
        quantity: 1,
        specSelectionMap: specSelectionMap
      }, () => {
        // 初始化时计算价格和文字
        this.updateSpecDisplay();
      });
    }
  },

  // 关闭规格弹窗
  onCloseSpecPopup() {
    this.setData({
      showSpecPopup: false,
      currentProduct: null,
      selectedSpecs: {},
      quantity: 1
    });
  },

  // 选择规格项
  onSelectSpecOption(e) {
    const groupIndex = parseInt(e.currentTarget.dataset.groupIndex);
    const optionIndex = parseInt(e.currentTarget.dataset.optionIndex);
    
    const { currentProduct, selectedSpecs: currentSelectedSpecs } = this.data;
    if (!currentProduct || !currentProduct.specifications || !currentProduct.specifications[groupIndex]) {
      return;
    }
    
    const group = currentProduct.specifications[groupIndex];
    const type = group.type || 'single'; // 默认为单选
    const selectedSpecs = { ...currentSelectedSpecs };
    
    console.log('【选择规格】groupIndex:', groupIndex, 'optionIndex:', optionIndex, 'type:', type);
    
    if (type === 'required') {
      // 必选：只能切换选项，不能取消
      // 如果点击已选中的选项，不执行任何操作（保持选中状态）
      if (selectedSpecs[groupIndex] !== optionIndex) {
        selectedSpecs[groupIndex] = optionIndex;
        console.log(`【选择规格】必选规格组 ${groupIndex} 切换到选项 ${optionIndex}`);
      } else {
        console.log(`【选择规格】必选规格组 ${groupIndex} 已选中选项 ${optionIndex}，不允许取消`);
        // 必选规格组不允许取消，直接返回
        return;
      }
    } else if (type === 'single') {
      // 单选：点击已选中的选项则取消，点击其他选项则切换
      if (selectedSpecs[groupIndex] === optionIndex) {
        selectedSpecs[groupIndex] = undefined; // 取消选择
      } else {
        selectedSpecs[groupIndex] = optionIndex; // 切换选择
      }
    } else if (type === 'multiple') {
      // 多选：切换选中状态
      if (!Array.isArray(selectedSpecs[groupIndex])) {
        selectedSpecs[groupIndex] = [];
      }
      const selectedArray = [...selectedSpecs[groupIndex]];
      const index = selectedArray.indexOf(optionIndex);
      if (index > -1) {
        // 已选中，移除
        selectedArray.splice(index, 1);
      } else {
        // 未选中，添加
        selectedArray.push(optionIndex);
      }
      selectedSpecs[groupIndex] = selectedArray;
    }
    
    console.log('【选择规格】更新后的selectedSpecs:', selectedSpecs);
    
    this.setData({
      selectedSpecs: selectedSpecs
    }, () => {
      // 更新显示值
      this.updateSpecDisplay();
    });
  },
  
  // 更新规格显示的文本和价格
  updateSpecDisplay() {
    const selectedSpecsText = this.getSelectedSpecsText();
    const specTotalPrice = this.calculateSpecPrice();
    const specSelectionMap = this.getSpecSelectionMap();
    this.setData({
      selectedSpecsText: selectedSpecsText,
      specTotalPrice: specTotalPrice.toFixed(2),
      specSelectionMap: specSelectionMap
    });
  },

  // 获取规格选中状态映射（用于 WXML 显示）
  getSpecSelectionMap() {
    const { currentProduct, selectedSpecs } = this.data;
    return this.calculateSpecSelectionMap(currentProduct, selectedSpecs);
  },

  // 计算规格选中状态映射（辅助方法）
  calculateSpecSelectionMap(product, selectedSpecs) {
    if (!product || !product.specifications) {
      return {};
    }
    
    const map = {};
    product.specifications.forEach((group, groupIndex) => {
      const type = group.type || 'single';
      const selectedValue = selectedSpecs[groupIndex];
      
      if (type === 'multiple') {
        // 多选：为每个选项创建选中状态
        map[groupIndex] = {};
        if (Array.isArray(selectedValue)) {
          selectedValue.forEach(optionIndex => {
            map[groupIndex][optionIndex] = true;
          });
        }
      } else {
        // 单选/必选：直接使用选中索引
        map[groupIndex] = selectedValue;
      }
    });
    
    return map;
  },

  // 计算当前选中的总价格
  calculateSpecPrice() {
    const { currentProduct, selectedSpecs, quantity } = this.data;
    if (!currentProduct || !currentProduct.specifications) {
      return 0;
    }
    
    const basePrice = parseFloat(currentProduct.price) || 0;
    let additionalPrice = 0;
    
    console.log('【计算价格】basePrice:', basePrice);
    console.log('【计算价格】selectedSpecs:', selectedSpecs);
    console.log('【计算价格】quantity:', quantity);
    
    // 计算所有选中规格项的加价
    currentProduct.specifications.forEach((group, groupIndex) => {
      const type = group.type || 'single'; // 默认为单选
      const selectedValue = selectedSpecs[groupIndex];
      console.log(`【计算价格】规格组 ${groupIndex} (type: ${type}): selectedValue=`, selectedValue);
      
      if (type === 'multiple') {
        // 多选：累加所有选中选项的价格
        if (Array.isArray(selectedValue) && selectedValue.length > 0) {
          selectedValue.forEach(optionIndex => {
            if (group.options && group.options[optionIndex]) {
              const option = group.options[optionIndex];
              const optionPrice = parseFloat(option.price) || 0;
              additionalPrice += optionPrice;
              console.log(`【计算价格】多选选项 ${optionIndex} (${option.name}): +${optionPrice}, 累计加价: ${additionalPrice}`);
            }
          });
        }
      } else {
        // 单选/必选：累加单个选中选项的价格
        if (selectedValue !== undefined && group.options && group.options[selectedValue]) {
          const option = group.options[selectedValue];
          const optionPrice = parseFloat(option.price) || 0;
          additionalPrice += optionPrice;
          console.log(`【计算价格】选项 ${selectedValue} (${option.name}): +${optionPrice}, 累计加价: ${additionalPrice}`);
        }
      }
    });
    
    const totalPrice = (basePrice + additionalPrice) * quantity;
    console.log('【计算价格】最终价格:', totalPrice, '= (', basePrice, '+', additionalPrice, ') *', quantity);
    
    return totalPrice;
  },

  // 获取已选规格的文字描述
  getSelectedSpecsText() {
    const { currentProduct, selectedSpecs } = this.data;
    if (!currentProduct || !currentProduct.specifications) {
      return '';
    }
    
    const selectedTexts = [];
    currentProduct.specifications.forEach((group, groupIndex) => {
      const type = group.type || 'single'; // 默认为单选
      const selectedValue = selectedSpecs[groupIndex];
      
      if (type === 'multiple') {
        // 多选：显示所有选中选项
        if (Array.isArray(selectedValue) && selectedValue.length > 0) {
          selectedValue.forEach(optionIndex => {
            if (group.options && group.options[optionIndex]) {
              selectedTexts.push(group.options[optionIndex].name);
            }
          });
        }
      } else {
        // 单选/必选：显示单个选中选项
        if (selectedValue !== undefined && group.options && group.options[selectedValue]) {
          selectedTexts.push(group.options[selectedValue].name);
        }
      }
    });
    
    return selectedTexts.join('、');
  },

  // 增加数量（规格弹窗中）
  onIncreaseQuantity() {
    this.setData({
      quantity: this.data.quantity + 1
    });
    this.updateSpecDisplay();
  },

  // 减少数量（规格弹窗中）
  onDecreaseQuantity() {
    if (this.data.quantity > 1) {
      this.setData({
        quantity: this.data.quantity - 1
      });
      this.updateSpecDisplay();
    }
  },

  // 确认选择规格
  onConfirmSpec() {
    const { currentProduct, selectedSpecs, quantity } = this.data;
    
    if (!currentProduct) {
      return;
    }
    
    // 验证必选规格组是否已选择
    if (currentProduct.specifications && currentProduct.specifications.length > 0) {
      for (let i = 0; i < currentProduct.specifications.length; i++) {
        const group = currentProduct.specifications[i];
        const type = group.type || 'single'; // 默认为单选
        if (type === 'required') {
          const selectedValue = selectedSpecs[i];
          if (selectedValue === undefined || selectedValue === null) {
            wx.showToast({
              title: `请选择${group.name || '规格'}`,
              icon: 'none'
            });
            return;
          }
        }
      }
    }
    
    // 计算最终价格
    const basePrice = parseFloat(currentProduct.price) || 0;
    let additionalPrice = 0;
    const selectedOptions = [];
    
    // 收集选中的规格项信息
    currentProduct.specifications.forEach((group, groupIndex) => {
      const type = group.type || 'single'; // 默认为单选
      const selectedValue = selectedSpecs[groupIndex];
      
      if (type === 'multiple') {
        // 多选：收集所有选中选项
        if (Array.isArray(selectedValue) && selectedValue.length > 0) {
          selectedValue.forEach(optionIndex => {
            if (group.options && group.options[optionIndex]) {
              const option = group.options[optionIndex];
              additionalPrice += parseFloat(option.price) || 0;
              selectedOptions.push({
                groupName: group.name,
                optionName: option.name,
                price: parseFloat(option.price) || 0
              });
            }
          });
        }
      } else {
        // 单选/必选：收集单个选中选项
        if (selectedValue !== undefined && group.options && group.options[selectedValue]) {
          const option = group.options[selectedValue];
          additionalPrice += parseFloat(option.price) || 0;
          selectedOptions.push({
            groupName: group.name,
            optionName: option.name,
            price: parseFloat(option.price) || 0
          });
        }
      }
    });
    
    const finalPrice = basePrice + additionalPrice;
    
    // 更新商品数量
    const products = this.data.products.map(product => {
      if (product.id === currentProduct.id) {
        return {
          ...product,
          quantity: product.quantity + quantity,
          selectedSpecs: selectedOptions,
          finalPrice: finalPrice
        };
      }
      return product;
    });
    
    // 添加到购物车
    const existingCartItem = this.data.cartItems.find(item => {
      if (item.id !== currentProduct.id) return false;
      // 如果已有相同的规格组合，则合并
      if (JSON.stringify(item.selectedSpecs) === JSON.stringify(selectedOptions)) {
        return true;
      }
      return false;
    });
    
    let cartItems = [...this.data.cartItems];
    
    if (existingCartItem) {
      cartItems = cartItems.map(item => {
        if (item.id === currentProduct.id && JSON.stringify(item.selectedSpecs) === JSON.stringify(selectedOptions)) {
          return {
            ...item,
            quantity: item.quantity + quantity,
            finalPrice: finalPrice
          };
        }
        return item;
      });
    } else {
      cartItems.push({
        ...currentProduct,
        quantity: quantity,
        selectedSpecs: selectedOptions,
        finalPrice: finalPrice,
        price: finalPrice.toFixed(2) // 更新价格为最终价格
      });
    }
    
    // 同时更新displayProducts
    const displayProducts = this.data.displayProducts.map(product => {
      if (product.id === currentProduct.id) {
        return {
          ...product,
          quantity: product.quantity + quantity,
          selectedSpecs: selectedOptions,
          finalPrice: finalPrice
        };
      }
      return product;
    });
    
    this.setData({
      products: products,
      displayProducts: displayProducts,
      cartItems: cartItems,
      showSpecPopup: false,
      currentProduct: null,
      selectedSpecs: {},
      quantity: 1
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
      // 使用finalPrice（如果有），否则使用原price
      const price = parseFloat(item.finalPrice || item.price) || 0;
      const quantity = parseInt(item.quantity) || 0;
      const itemTotal = price * quantity;
      console.log(`商品 ${item.name}: 价格=${price}, 数量=${quantity}, 小计=${itemTotal}`);
      return sum + itemTotal;
    }, 0);
    
    console.log('购物车总价计算:', total);
    
    this.setData({
      cartTotal: total
    }, () => {
      // 重新计算价格信息
      if (this.data.showCartSummary) {
        const priceInfo = this.getFinalPrice();
        this.setData({
          priceInfo: priceInfo
        });
      }
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
      // 打开弹窗时重新计算总价
      const priceInfo = this.getFinalPrice();
      this.setData({
        showCartSummary: !this.data.showCartSummary,
        priceInfo: priceInfo
      });
    } else {
      wx.showToast({
        title: '购物车是空的',
        icon: 'none',
        duration: 1500
      });
    }
  },

  // 关闭购物车弹窗
  onCloseCartSummary() {
    this.setData({
      showCartSummary: false
    });
  },

  // 切换配送方式
  onToggleDeliveryType(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({
      deliveryType: type
    });
    // 更新价格信息
    const priceInfo = this.getFinalPrice();
    this.setData({
      priceInfo: priceInfo
    });
  },

  // 计算最终价格
  getFinalPrice() {
    const cartTotal = this.data.cartTotal;
    const deliveryFee = this.data.deliveryType === 'delivery' ? (this.data.storeInfo.deliveryFee || 0) : 0;
    
    const finalPrice = cartTotal + deliveryFee;
    
    return {
      originalPrice: cartTotal,
      deliveryFee: deliveryFee,
      finalPrice: finalPrice > 0 ? finalPrice : 0,
      finalPriceFormatted: (finalPrice > 0 ? finalPrice : 0).toFixed(1)
    };
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
    
    // 同时更新displayProducts，保持数量同步
    const displayProducts = this.data.displayProducts.map(product => {
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
      products: products,
      displayProducts: displayProducts // 更新显示的商品列表
    });
    
    this.calculateCartTotal();
    
    // 如果弹窗打开，更新价格信息
    if (this.data.showCartSummary) {
      const priceInfo = this.getFinalPrice();
      this.setData({
        priceInfo: priceInfo
      });
    }
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
    
    // 同时更新displayProducts，保持数量同步
    const displayProducts = this.data.displayProducts.map(product => {
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
      products: products,
      displayProducts: displayProducts // 更新显示的商品列表
    });
    
    this.calculateCartTotal();
    
    // 如果弹窗打开，更新价格信息
    if (this.data.showCartSummary) {
      const priceInfo = this.getFinalPrice();
      this.setData({
        priceInfo: priceInfo
      });
    }
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
          
          // 同时更新displayProducts，保持数量同步
          const displayProducts = this.data.displayProducts.map(product => ({
            ...product,
            quantity: 0
          }));
          
          this.setData({
            cartItems: [],
            products: products,
            displayProducts: displayProducts, // 更新显示的商品列表
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

  // 从购物车弹窗结算
  onCheckoutFromCart() {
    // 关闭购物车弹窗
    this.setData({
      showCartSummary: false
    });
    // 调用结算方法
    this.onCheckout();
  },

  // 结算
  onCheckout() {
    // 检查店铺状态：只有营业中的店铺才能下单
    if (this.data.storeInfo.businessStatus && this.data.storeInfo.businessStatus !== 'open') {
      wx.showToast({
        title: '店铺当前休息中，暂不接收订单',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    if (this.data.cartTotal < this.data.storeInfo.minOrder) {
      wx.showToast({
        title: `满¥${this.data.storeInfo.minOrder}起送`,
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    console.log('【店铺详情】准备跳转到结算页面');
    console.log('【店铺详情】当前storeInfo:', this.data.storeInfo);
    console.log('【店铺详情】当前storeId:', this.data.storeId);
    
    // 计算最终价格信息
    const priceInfo = this.getFinalPrice();
    
    // 跳转到结算页面，传递购物车数据
    const cartData = {
      cartItems: this.data.cartItems,
      cartTotal: this.data.cartTotal,
      deliveryType: this.data.deliveryType,
      priceInfo: priceInfo,
      storeInfo: {
        ...this.data.storeInfo,
        storeId: this.data.storeId || this.data.storeInfo.storeId || this.data.storeInfo._id,
        _id: this.data.storeId || this.data.storeInfo.storeId || this.data.storeInfo._id
      }
    };
    
    console.log('【店铺详情】传递的cartData:', cartData);
    
    wx.navigateTo({
      url: `/subpackages/store/pages/checkout/index?cartData=${encodeURIComponent(JSON.stringify(cartData))}`,
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

  // Logo加载错误处理
  onLogoError(e) {
    console.warn('店铺Logo加载失败，使用默认图片');
    console.warn('失败的头像URL:', this.data.storeInfo.avatar || this.data.storeInfo.logo || this.data.storeInfo.logoUrl);
    this.setData({
      'storeInfo.avatar': '/pages/小标/商家.png',
      'storeInfo.logo': '/pages/小标/商家.png',
      'storeInfo.logoUrl': '/pages/小标/商家.png'
    });
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
  },
  
  // 预览评价图片
  onPreviewReviewImage(e) {
    const images = e.currentTarget.dataset.images;
    const index = e.currentTarget.dataset.index;
    
    if (images && images.length > 0) {
      wx.previewImage({
        urls: images,
        current: images[index] || images[0]
      });
    }
  },
  
  // 拨打电话
  onCallPhone() {
    const phone = this.data.merchantInfo.phone;
    if (phone && phone !== '未设置电话') {
      wx.makePhoneCall({
        phoneNumber: phone,
        fail: (err) => {
          console.error('拨打电话失败:', err);
          wx.showToast({
            title: '拨打电话失败',
            icon: 'none'
          });
        }
      });
    } else {
      wx.showToast({
        title: '暂无联系电话',
        icon: 'none'
      });
    }
  },
  
  // 点击编写评论按钮
  onSubmitReviewTap() {
    // 检查是否登录
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再发表评论',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/user-login/index'
            });
          }
        }
      });
      return;
    }

    // 检查是否有店铺ID
    if (!this.data.storeId) {
      wx.showToast({
        title: '店铺信息错误',
        icon: 'none'
      });
      return;
    }

    // 直接跳转到提交评论页面，让提交评论页面处理订单选择
    wx.navigateTo({
      url: `/subpackages/store/pages/submit-review/index?storeId=${this.data.storeId}`,
      fail: (err) => {
        console.error('跳转到提交评论页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  }
});
