Page({
  data:{
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    activeTab: 0, // 0:上架中, 1:下架中
    activeCat: 0,
    categories: [],
    goods: [],
    startX: 0,
    currentSwipeId: null
  },
  
  onLoad() {
    // 先加载分类，分类加载完成后再加载商品
    this.loadCategories().then(() => {
      // 分类加载完成后，再加载商品列表
      this.loadProducts();
    }).catch(err => {
      console.error('【商品管理】分类加载失败:', err);
      // 即使分类加载失败，也尝试加载商品（不按分类筛选）
      this.loadProducts();
    });
  },
  
  onShow() {
    // 页面显示时，如果分类已加载，则重新加载商品
    if (this.data.categories && this.data.categories.length > 0) {
      this.loadProducts();
    } else {
      // 如果分类未加载，先加载分类
      this.loadCategories().then(() => {
        this.loadProducts();
      });
    }
  },
  
  // 加载分类列表（返回 Promise）
  loadCategories() {
    // 获取当前登录的商家信息
    const merchantInfo = wx.getStorageSync('merchantInfo');
    const merchantId = merchantInfo?._id || null;
    const storeId = merchantInfo?.storeId || null;
    
    return wx.cloud.callFunction({
      name: 'categoryManage',
      data: {
        action: 'getCategories',
        data: {
          merchantId: merchantId, // 传递商家ID，优先使用
          storeId: storeId // 传递店铺ID
        }
      }
    }).then(res => {
      console.log('【商品管理】分类加载结果:', res.result);
      
      if (res.result.code === 200) {
        this.setData({
          categories: res.result.data.categories
        });
        console.log('【商品管理】分类加载成功，共', res.result.data.categories.length, '个分类');
      }
      return res;
    }).catch(err => {
      console.error('【商品管理】分类加载失败:', err);
      throw err;
    });
  },
  
  // 加载商品列表
  loadProducts() {
    wx.showLoading({ title: '加载中...' });
    
    const { activeTab, activeCat, categories } = this.data;
    const status = activeTab === 0 ? 'on' : 'off';
    const categoryId = categories[activeCat] ? categories[activeCat].id : null;
    
    // 获取当前登录的商家信息
    const merchantInfo = wx.getStorageSync('merchantInfo');
    const merchantId = merchantInfo?._id || null;
    
    console.log('【商品管理】加载商品，商家ID:', merchantId);
    
    wx.cloud.callFunction({
      name: 'productManage',
      data: {
        action: 'getProducts',
        data: {
          categoryId: categoryId,
          status: status,
          merchantId: merchantId // 传递商家ID，优先使用
        }
      }
    }).then(res => {
      wx.hideLoading();
      
      console.log('【商品管理】商品加载结果:', res.result);
      
      if (res.result.code === 200) {
        this.setData({
          goods: res.result.data.products
        });
        console.log('【商品管理】商品加载成功，共', res.result.data.products.length, '个商品');
      } else {
        wx.showToast({
          title: res.result.message || '加载失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('【商品管理】商品加载失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },
  
  onBack(){ wx.navigateBack(); },
  
  onTab(e){ 
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ activeTab: index });
    this.loadProducts();
  },
  
  onCat(e){ 
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ activeCat: index });
    this.loadProducts();
  },
  onAdd(){ 
    wx.navigateTo({ 
      url: '/subpackages/merchant/pages/merchant-add-product/index' 
    }); 
  },
  
  // 滑动相关方法
  onTouchStart(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ 
      startX: e.touches[0].clientX,
      currentSwipeId: id
    });
  },
  
  onTouchMove(e) {
    const id = e.currentTarget.dataset.id;
    const currentX = e.touches[0].clientX;
    const deltaX = currentX - this.data.startX;
    
    // 允许向左滑动（显示操作按钮）和向右滑动（复原）
    const maxSwipe = 120; // 最大滑动距离
    let swipeOffset = 0;
    
    if (deltaX < 0) {
      // 向左滑动，显示操作按钮
      swipeOffset = Math.max(deltaX, -maxSwipe);
    } else if (deltaX > 0) {
      // 向右滑动，从当前状态开始复原
      const currentItem = this.data.goods.find(item => item.id === id);
      const currentOffset = currentItem ? currentItem.swipeOffset : 0;
      swipeOffset = Math.min(currentOffset + deltaX, 0);
    }
    
    const goods = this.data.goods.map(item => {
      if (item.id === id) {
        return { ...item, swipeOffset: swipeOffset };
      }
      return { ...item, swipeOffset: 0 }; // 其他项复位
    });
    
    this.setData({ goods });
  },
  
  onTouchEnd(e) {
    const id = e.currentTarget.dataset.id;
    const currentX = e.changedTouches[0].clientX;
    const deltaX = currentX - this.data.startX;
    
    const goods = this.data.goods.map(item => {
      if (item.id === id) {
        // 如果向左滑动距离超过60px，保持展开状态
        // 如果向右滑动距离超过30px，或者总滑动距离小于30px，则复位
        if (deltaX < -60) {
          return { ...item, swipeOffset: -120 };
        } else if (deltaX > 30 || Math.abs(deltaX) < 30) {
          return { ...item, swipeOffset: 0 };
        } else {
          // 保持当前状态
          return item;
        }
      }
      return item;
    });
    
    this.setData({ goods, currentSwipeId: null });
  },
  
  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    
    // 跳转到编辑页面，只传递商品ID
    wx.navigateTo({
      url: `/pages/merchant-add-product/index?id=${id}`
    });
  },
  
  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const product = this.data.goods.find(item => item.id === id);
    
    if (product) {
      wx.showModal({
        title: '确认删除',
        content: `确定要删除商品"${product.name}"吗？`,
        confirmColor: '#ff4d4f',
        success: (res) => {
          if (res.confirm) {
            this.deleteProduct(id);
          }
        }
      });
    }
  },
  
  // 删除商品
  deleteProduct(productId) {
    wx.showLoading({ title: '删除中...' });
    
    wx.cloud.callFunction({
      name: 'productManage',
      data: {
        action: 'deleteProduct',
        data: {
          productId: productId
        }
      }
    }).then(res => {
      wx.hideLoading();
      
      console.log('【商品管理】删除结果:', res.result);
      
      if (res.result.code === 200) {
        wx.showToast({ 
          title: '删除成功', 
          icon: 'success' 
        });
        
        // 重新加载商品列表
        this.loadProducts();
      } else {
        wx.showToast({
          title: res.result.message || '删除失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('【商品管理】删除失败:', err);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    });
  },
  
  // 点击商品区域，自动复原所有展开的项
  onGoodsAreaTap(e) {
    // 如果点击的不是商品项，则复原所有展开的项
    if (!e.target.dataset.id) {
      const goods = this.data.goods.map(item => ({
        ...item,
        swipeOffset: 0
      }));
      this.setData({ goods });
    }
  }
});


