// pages/admin-batch-audit/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    currentTab: 'product', // product 或 merchant
    // 商品相关
    products: [],
    selectedProducts: [], // 选中的商品ID
    productPage: 1,
    productPageSize: 20,
    productTotal: 0,
    productStatus: 'pending', // 筛选状态，默认只显示待审核商品
    productStatusIndex: 1, // 筛选状态索引
    productStatusOptions: [
      { value: '', label: '全部商品' },
      { value: 'pending', label: '待审核' },
      { value: 'approved', label: '已通过' },
      { value: 'rejected', label: '已拒绝' }
    ],
    // 商家相关
    merchants: [],
    selectedMerchants: [], // 选中的商家ID
    merchantPage: 1,
    merchantPageSize: 20,
    merchantTotal: 0,
    merchantStatus: 'pending', // 筛选状态
    loading: false
  },

  onLoad() {
    this.verifyAdminAccess();
    this.loadData();
  },

  // 验证管理员权限
  verifyAdminAccess() {
    const adminToken = wx.getStorageSync('adminToken');
    if (!adminToken) {
      wx.showModal({
        title: '访问受限',
        content: '您没有管理员权限，请重新登录',
        showCancel: false,
        success: () => {
          wx.reLaunch({
            url: '/subpackages/merchant/pages/merchant-register/index'
          });
        }
      });
      return;
    }
  },

  // 切换标签页
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ 
      currentTab: tab,
      selectedProducts: [],
      selectedMerchants: []
    });
    this.loadData();
  },

  // 商品状态筛选
  onProductStatusChange(e) {
    const index = e.detail.value;
    const status = this.data.productStatusOptions[index].value;
    this.setData({ 
      productStatusIndex: index,
      productStatus: status,
      productPage: 1,
      selectedProducts: []
    });
    this.loadProducts();
  },

  // 加载数据
  loadData() {
    if (this.data.currentTab === 'product') {
      this.loadProducts();
    } else {
      this.loadMerchants();
    }
  },

  // 加载商品列表
  async loadProducts() {
    wx.showLoading({ title: '加载中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'productManage',
        data: {
          action: 'getProductsForAudit',
          data: {
            auditStatus: this.data.productStatus,
            page: this.data.productPage,
            pageSize: this.data.productPageSize
          }
        }
      });

      if (res.result && res.result.code === 200) {
        // 为每个商品添加选中状态
        const products = res.result.data.products.map(p => ({
          ...p,
          _isSelected: this.data.selectedProducts.indexOf(p.id) > -1
        }));
        
        this.setData({
          products: products,
          productTotal: res.result.data.total
        });
      } else {
        wx.showToast({
          title: res.result.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (err) {
      console.error('加载商品列表失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 加载商家列表
  async loadMerchants() {
    wx.showLoading({ title: '加载中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'merchantManage',
        data: {
          action: 'getList',
          data: {
            page: this.data.merchantPage,
            pageSize: this.data.merchantPageSize,
            status: this.data.merchantStatus
          }
        }
      });

      if (res.result && res.result.code === 200) {
        // 为每个商家添加选中状态
        const merchants = res.result.data.list.map(m => ({
          ...m,
          _isSelected: this.data.selectedMerchants.indexOf(m._id) > -1
        }));
        
        this.setData({
          merchants: merchants,
          merchantTotal: res.result.data.total
        });
      } else {
        wx.showToast({
          title: res.result.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (err) {
      console.error('加载商家列表失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 选择/取消选择商品
  onToggleProduct(e) {
    const productId = e.currentTarget.dataset.id;
    const selectedProducts = [...this.data.selectedProducts];
    const index = selectedProducts.indexOf(productId);
    
    if (index > -1) {
      selectedProducts.splice(index, 1);
    } else {
      selectedProducts.push(productId);
    }
    
    // 更新商品选中状态
    const products = this.data.products.map(p => ({
      ...p,
      _isSelected: selectedProducts.indexOf(p.id) > -1
    }));
    
    this.setData({ 
      selectedProducts,
      products
    });
  },

  // 选择/取消选择商家
  onToggleMerchant(e) {
    const merchantId = e.currentTarget.dataset.id;
    const selectedMerchants = [...this.data.selectedMerchants];
    const index = selectedMerchants.indexOf(merchantId);
    
    if (index > -1) {
      selectedMerchants.splice(index, 1);
    } else {
      selectedMerchants.push(merchantId);
    }
    
    // 更新商家选中状态
    const merchants = this.data.merchants.map(m => ({
      ...m,
      _isSelected: selectedMerchants.indexOf(m._id) > -1
    }));
    
    this.setData({ 
      selectedMerchants,
      merchants
    });
  },

  // 全选/取消全选商品
  onToggleAllProducts() {
    let selectedProducts = [];
    let products = [];
    
    if (this.data.selectedProducts.length === this.data.products.length && this.data.products.length > 0) {
      // 取消全选
      products = this.data.products.map(p => ({ ...p, _isSelected: false }));
    } else {
      // 全选
      selectedProducts = this.data.products.map(p => p.id);
      products = this.data.products.map(p => ({ ...p, _isSelected: true }));
    }
    
    this.setData({ 
      selectedProducts,
      products
    });
  },

  // 全选/取消全选商家
  onToggleAllMerchants() {
    let selectedMerchants = [];
    let merchants = [];
    
    if (this.data.selectedMerchants.length === this.data.merchants.length && this.data.merchants.length > 0) {
      // 取消全选
      merchants = this.data.merchants.map(m => ({ ...m, _isSelected: false }));
    } else {
      // 全选
      selectedMerchants = this.data.merchants.map(m => m._id);
      merchants = this.data.merchants.map(m => ({ ...m, _isSelected: true }));
    }
    
    this.setData({ 
      selectedMerchants,
      merchants
    });
  },

  // 批量审核商品 - 通过
  onBatchApproveProducts() {
    if (this.data.selectedProducts.length === 0) {
      wx.showToast({
        title: '请选择要审核的商品',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认审核',
      content: `确定要通过选中的${this.data.selectedProducts.length}个商品吗？`,
      success: (res) => {
        if (res.confirm) {
          this.batchAuditProducts('approved');
        }
      }
    });
  },

  // 批量审核商品 - 拒绝
  onBatchRejectProducts() {
    if (this.data.selectedProducts.length === 0) {
      wx.showToast({
        title: '请选择要审核的商品',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认拒绝',
      content: `确定要拒绝选中的${this.data.selectedProducts.length}个商品吗？`,
      editable: true,
      placeholderText: '请输入拒绝原因（可选）',
      success: (res) => {
        if (res.confirm) {
          this.batchAuditProducts('rejected', res.content);
        }
      }
    });
  },

  // 执行批量审核商品
  async batchAuditProducts(auditStatus, auditReason = '') {
    wx.showLoading({ title: '审核中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'productManage',
        data: {
          action: 'batchAuditProducts',
          data: {
            productIds: this.data.selectedProducts,
            auditStatus: auditStatus,
            auditReason: auditReason
          }
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: res.result.message,
          icon: 'success'
        });
        
        // 清空选择，重新加载数据
        this.setData({ 
          selectedProducts: [],
          productPage: 1
        });
        this.loadProducts();
      } else {
        wx.showToast({
          title: res.result.message || '审核失败',
          icon: 'none'
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('批量审核商品失败:', err);
      wx.showToast({
        title: '审核失败',
        icon: 'none'
      });
    }
  },

  // 批量审核商家 - 通过
  onBatchApproveMerchants() {
    if (this.data.selectedMerchants.length === 0) {
      wx.showToast({
        title: '请选择要审核的商家',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认审核',
      content: `确定要通过选中的${this.data.selectedMerchants.length}个商家吗？`,
      success: (res) => {
        if (res.confirm) {
          this.batchAuditMerchants('active');
        }
      }
    });
  },

  // 批量审核商家 - 拒绝
  onBatchRejectMerchants() {
    if (this.data.selectedMerchants.length === 0) {
      wx.showToast({
        title: '请选择要审核的商家',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '确认拒绝',
      content: `确定要拒绝选中的${this.data.selectedMerchants.length}个商家吗？`,
      success: (res) => {
        if (res.confirm) {
          this.batchAuditMerchants('rejected');
        }
      }
    });
  },

  // 执行批量审核商家
  async batchAuditMerchants(status) {
    wx.showLoading({ title: '审核中...' });
    
    try {
      const merchantIds = this.data.selectedMerchants;
      let successCount = 0;
      let failCount = 0;

      // 逐个处理商家
      for (const merchantId of merchantIds) {
        try {
          const action = status === 'active' ? 'approve' : 'reject';
          const res = await wx.cloud.callFunction({
            name: 'merchantManage',
            data: {
              action: action,
              data: { merchantId },
              adminId: 'admin_123'
            }
          });

          if (res.result && res.result.code === 200) {
            successCount++;
          } else {
            failCount++;
          }
        } catch (err) {
          failCount++;
        }
      }

      wx.hideLoading();

      if (successCount > 0) {
        wx.showToast({
          title: `成功${successCount}个，失败${failCount}个`,
          icon: 'success'
        });
        
        // 清空选择，重新加载数据
        this.setData({ 
          selectedMerchants: [],
          merchantPage: 1
        });
        this.loadMerchants();
      } else {
        wx.showToast({
          title: '全部审核失败',
          icon: 'none'
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('批量审核商家失败:', err);
      wx.showToast({
        title: '审核失败',
        icon: 'none'
      });
    }
  },

  // 返回
  onBack() {
    wx.navigateBack();
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.currentTab === 'product') {
      if (this.data.products.length < this.data.productTotal) {
        this.setData({ productPage: this.data.productPage + 1 });
        this.loadProducts();
      }
    } else {
      if (this.data.merchants.length < this.data.merchantTotal) {
        this.setData({ merchantPage: this.data.merchantPage + 1 });
        this.loadMerchants();
      }
    }
  }
});

