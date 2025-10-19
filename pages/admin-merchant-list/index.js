Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    merchants: [],
    loading: true,
    page: 1,
    pageSize: 10,
    total: 0,
    status: '', // 筛选状态
    keyword: '', // 搜索关键词
    statusOptions: [
      { value: '', label: '全部状态' },
      { value: 'pending', label: '待审核' },
      { value: 'active', label: '已通过' },
      { value: 'suspended', label: '已暂停' },
      { value: 'rejected', label: '已拒绝' }
    ]
  },

  onLoad() {
    this.verifyAdminAccess();
    this.loadMerchantList();
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
            url: '/pages/merchant-register/index'
          });
        }
      });
      return;
    }
  },

  // 加载商家列表
  async loadMerchantList() {
    wx.showLoading({ title: '加载中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'merchantManage',
        data: {
          action: 'getList',
          data: {
            page: this.data.page,
            pageSize: this.data.pageSize,
            status: this.data.status,
            keyword: this.data.keyword
          }
        }
      });

      if (res.result && res.result.code === 200) {
        this.setData({
          merchants: res.result.data.list,
          total: res.result.data.total,
          loading: false
        });
      } else {
        // 使用模拟数据
        this.setData({
          merchants: this.getMockMerchants(),
          total: 25,
          loading: false
        });
      }
    } catch (err) {
      console.error('加载商家列表失败:', err);
      // 使用模拟数据
      this.setData({
        merchants: this.getMockMerchants(),
        total: 25,
        loading: false
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 模拟商家数据
  getMockMerchants() {
    return [
      {
        _id: '1',
        merchantName: '河工零食',
        contactPhone: '13800138001',
        status: 'pending',
        qualificationStatus: 'pending',
        createdAt: '2025-01-03T10:30:00Z',
        storeInfo: {
          name: '河工零食店',
          businessStatus: 'open'
        }
      },
      {
        _id: '2',
        merchantName: '校园咖啡',
        contactPhone: '13800138002',
        status: 'active',
        qualificationStatus: 'approved',
        createdAt: '2025-01-02T15:20:00Z',
        storeInfo: {
          name: '校园咖啡厅',
          businessStatus: 'open'
        }
      },
      {
        _id: '3',
        merchantName: '快餐王',
        contactPhone: '13800138003',
        status: 'suspended',
        qualificationStatus: 'approved',
        createdAt: '2025-01-01T09:15:00Z',
        storeInfo: {
          name: '快餐王餐厅',
          businessStatus: 'closed'
        }
      }
    ];
  },

  // 状态筛选
  onStatusChange(e) {
    const status = e.detail.value;
    this.setData({ status, page: 1 });
    this.loadMerchantList();
  },

  // 搜索
  onSearch(e) {
    const keyword = e.detail.value;
    this.setData({ keyword, page: 1 });
    this.loadMerchantList();
  },

  // 审核商家
  onApprove(e) {
    const merchantId = e.currentTarget.dataset.id;
    const merchantName = e.currentTarget.dataset.name;
    
    wx.showModal({
      title: '确认审核',
      content: `确定要通过商家"${merchantName}"的申请吗？`,
      success: (res) => {
        if (res.confirm) {
          this.updateMerchantStatus(merchantId, 'active');
        }
      }
    });
  },

  // 拒绝商家
  onReject(e) {
    const merchantId = e.currentTarget.dataset.id;
    const merchantName = e.currentTarget.dataset.name;
    
    wx.showModal({
      title: '确认拒绝',
      content: `确定要拒绝商家"${merchantName}"的申请吗？`,
      success: (res) => {
        if (res.confirm) {
          this.updateMerchantStatus(merchantId, 'rejected');
        }
      }
    });
  },

  // 暂停商家
  onSuspend(e) {
    const merchantId = e.currentTarget.dataset.id;
    const merchantName = e.currentTarget.dataset.name;
    
    wx.showModal({
      title: '确认暂停',
      content: `确定要暂停商家"${merchantName}"的营业吗？`,
      success: (res) => {
        if (res.confirm) {
          this.updateMerchantStatus(merchantId, 'suspended');
        }
      }
    });
  },

  // 更新商家状态
  async updateMerchantStatus(merchantId, status) {
    wx.showLoading({ title: '处理中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'merchantManage',
        data: {
          action: status === 'active' ? 'approve' : status === 'rejected' ? 'reject' : 'suspend',
          data: { merchantId },
          adminId: 'admin_123'
        }
      });

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '操作成功',
          icon: 'success'
        });
        this.loadMerchantList();
      } else {
        wx.showToast({
          title: res.result.message || '操作失败',
          icon: 'none'
        });
      }
    } catch (err) {
      console.error('更新商家状态失败:', err);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 查看商家详情
  onViewDetail(e) {
    const merchantId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin-merchant-detail/index?id=${merchantId}`,
      fail: () => {
        wx.showToast({
          title: '商家详情页面开发中',
          icon: 'none'
        });
      }
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ page: 1 });
    this.loadMerchantList();
    wx.stopPullDownRefresh();
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.merchants.length < this.data.total) {
      this.setData({ page: this.data.page + 1 });
      this.loadMerchantList();
    }
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});
