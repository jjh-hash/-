Page({
  data:{
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    cats: [],
    startX: 0,
    currentSwipeId: null
  },
  
  onLoad() {
    this.loadCategories();
  },
  
  onShow() {
    this.loadCategories();
  },
  
  // 加载分类列表
  loadCategories() {
    wx.showLoading({ title: '加载中...' });
    
    // 获取当前登录的商家信息
    const merchantInfo = wx.getStorageSync('merchantInfo');
    const merchantId = merchantInfo?._id || null;
    const storeId = merchantInfo?.storeId || null;
    
    console.log('【商品分类】加载分类，商家ID:', merchantId, '店铺ID:', storeId);
    
    wx.cloud.callFunction({
      name: 'categoryManage',
      data: {
        action: 'getCategories',
        data: {
          merchantId: merchantId, // 传递商家ID，优先使用
          storeId: storeId // 传递店铺ID
        }
      }
    }).then(res => {
      wx.hideLoading();
      
      console.log('【商品分类】加载结果:', res.result);
      
      if (res.result.code === 200) {
        this.setData({
          cats: res.result.data.categories
        });
        console.log('【商品分类】加载成功，共', res.result.data.categories.length, '个分类');
      } else {
        console.error('【商品分类】加载失败:', res.result.message);
        wx.showToast({
          title: res.result.message || '加载失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('【商品分类】加载失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },
  
  onBack(){ wx.navigateBack(); },
  
  onAdd(){ 
    wx.showModal({
      title: '添加分类',
      editable: true,
      placeholderText: '请输入分类名称',
      success: (res) => {
        if (res.confirm && res.content.trim()) {
          this.addCategory(res.content.trim());
        }
      }
    });
  },
  
  // 添加分类
  addCategory(name) {
    wx.showLoading({ title: '添加中...' });
    
    // 获取当前登录的商家信息
    const merchantInfo = wx.getStorageSync('merchantInfo');
    const merchantId = merchantInfo?._id || null;
    
    wx.cloud.callFunction({
      name: 'categoryManage',
      data: {
        action: 'addCategory',
        data: {
          name: name,
          merchantId: merchantId // 传递商家ID，优先使用
        }
      }
    }).then(res => {
      wx.hideLoading();
      
      console.log('【商品分类】添加结果:', res.result);
      
      if (res.result.code === 200) {
        wx.showToast({ 
          title: '添加成功', 
          icon: 'success' 
        });
        
        // 重新加载分类列表
        this.loadCategories();
      } else {
        console.error('【商品分类】添加失败:', res.result.message);
        wx.showToast({
          title: res.result.message || '添加失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('【商品分类】添加失败:', err);
      wx.showToast({
        title: '添加失败',
        icon: 'none'
      });
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
      const currentItem = this.data.cats.find(item => item.id === id);
      const currentOffset = currentItem ? currentItem.swipeOffset : 0;
      swipeOffset = Math.min(currentOffset + deltaX, 0);
    }
    
    const cats = this.data.cats.map(item => {
      if (item.id === id) {
        return { ...item, swipeOffset: swipeOffset };
      }
      return { ...item, swipeOffset: 0 }; // 其他项复位
    });
    
    this.setData({ cats });
  },
  
  onTouchEnd(e) {
    const id = e.currentTarget.dataset.id;
    const currentX = e.changedTouches[0].clientX;
    const deltaX = currentX - this.data.startX;
    
    const cats = this.data.cats.map(item => {
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
    
    this.setData({ cats, currentSwipeId: null });
  },
  
  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    const category = this.data.cats.find(item => item.id === id);
    wx.showModal({
      title: '编辑分类',
      editable: true,
      placeholderText: '请输入分类名称',
      content: category.name,
      success: (res) => {
        if (res.confirm && res.content.trim()) {
          this.updateCategory(id, res.content.trim());
        }
      }
    });
  },
  
  // 更新分类
  updateCategory(categoryId, name) {
    wx.showLoading({ title: '更新中...' });
    
    // 获取当前登录的商家信息
    const merchantInfo = wx.getStorageSync('merchantInfo');
    const merchantId = merchantInfo?._id || null;
    
    wx.cloud.callFunction({
      name: 'categoryManage',
      data: {
        action: 'updateCategory',
        data: {
          categoryId: categoryId,
          name: name,
          merchantId: merchantId // 传递商家ID，优先使用
        }
      }
    }).then(res => {
      wx.hideLoading();
      
      console.log('【商品分类】更新结果:', res.result);
      
      if (res.result.code === 200) {
        wx.showToast({ 
          title: '编辑成功', 
          icon: 'success' 
        });
        
        // 重新加载分类列表
        this.loadCategories();
      } else {
        console.error('【商品分类】更新失败:', res.result.message);
        wx.showToast({
          title: res.result.message || '编辑失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('【商品分类】更新失败:', err);
      wx.showToast({
        title: '编辑失败',
        icon: 'none'
      });
    });
  },
  
  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const category = this.data.cats.find(item => item.id === id);
    wx.showModal({
      title: '确认删除',
      content: `确定要删除分类"${category.name}"吗？`,
      success: (res) => {
        if (res.confirm) {
          this.deleteCategory(id);
        }
      }
    });
  },
  
  // 删除分类
  deleteCategory(categoryId) {
    wx.showLoading({ title: '删除中...' });
    
    // 获取当前登录的商家信息
    const merchantInfo = wx.getStorageSync('merchantInfo');
    const merchantId = merchantInfo?._id || null;
    
    wx.cloud.callFunction({
      name: 'categoryManage',
      data: {
        action: 'deleteCategory',
        data: {
          categoryId: categoryId,
          merchantId: merchantId // 传递商家ID，优先使用
        }
      }
    }).then(res => {
      wx.hideLoading();
      
      console.log('【商品分类】删除结果:', res.result);
      
      if (res.result.code === 200) {
        wx.showToast({ 
          title: '删除成功', 
          icon: 'success' 
        });
        
        // 重新加载分类列表
        this.loadCategories();
      } else {
        console.error('【商品分类】删除失败:', res.result.message);
        wx.showToast({
          title: res.result.message || '删除失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('【商品分类】删除失败:', err);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    });
  },
  
  // 点击列表区域，自动复原所有展开的项
  onListAreaTap(e) {
    // 如果点击的不是分类项，则复原所有展开的项
    if (!e.target.dataset.id) {
      const cats = this.data.cats.map(item => ({
        ...item,
        swipeOffset: 0
      }));
      this.setData({ cats });
    }
  }
});


