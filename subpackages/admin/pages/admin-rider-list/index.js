// pages/admin-rider-list/index.js
// 骑手管理页面
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    riders: [],
    loading: true,
    page: 1,
    pageSize: 20,
    total: 0,
    statusIndex: 0,
    status: '',
    keyword: '',
    statusOptions: [
      { value: '', label: '全部状态' },
      { value: 'pending', label: '待审核' },
      { value: 'approved', label: '已通过' },
      { value: 'rejected', label: '已拒绝' }
    ]
  },

  onLoad() {
    console.log('骑手管理页面加载');
    this.verifyAdminAccess();
    this.loadRiderList();
  },

  onShow() {
    this.loadRiderList();
  },

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
    }
  },

  // 加载骑手列表
  async loadRiderList() {
    this.setData({ loading: true });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'riderManage',
        data: {
          action: 'getRiderList',
          data: {
            page: this.data.page,
            pageSize: this.data.pageSize,
            status: this.data.status,
            keyword: this.data.keyword
          }
        }
      });

      console.log('【骑手管理】云函数返回:', res.result);

      if (res.result && res.result.code === 200) {
        const riders = res.result.data.riders || [];
        const total = res.result.data.total || 0;
        
        this.setData({
          riders: riders,
          total: total,
          loading: false
        });
        
        console.log('【骑手管理】骑手列表加载成功,共' + riders.length + '条');
      } else {
        wx.showToast({
          title: res.result.message || '加载失败',
          icon: 'none'
        });
        this.setData({ loading: false });
      }
    } catch (err) {
      console.error('【骑手管理】加载失败:', err);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },

  // 状态筛选
  onStatusChange(e) {
    const index = e.detail.value;
    const status = this.data.statusOptions[index].value;
    
    this.setData({
      statusIndex: index,
      status: status,
      page: 1
    });
    
    this.loadRiderList();
  },

  // 搜索
  onSearchInput(e) {
    this.setData({
      keyword: e.detail.value,
      page: 1
    });
  },

  onSearch() {
    this.loadRiderList();
  },

  // 查看骑手详情
  onViewRider(e) {
    const rider = e.currentTarget.dataset.rider;
    // 跳转到用户详情页面，通过 openid 查询
    wx.navigateTo({
      url: `/subpackages/admin/pages/admin-user-detail/index?id=${rider.openid}`
    });
  },

  // 审核骑手
  async onAuditRider(e) {
    const rider = e.currentTarget.dataset.rider;
    const action = e.currentTarget.dataset.action; // approve 或 reject
    
    const actionText = action === 'approve' ? '通过' : '拒绝';
    
    wx.showModal({
      title: `审核${actionText}`,
      content: `确定要${actionText}该骑手的申请吗？`,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' });
          
          try {
            const auditRes = await wx.cloud.callFunction({
              name: 'riderManage',
              data: {
                action: 'auditRider',
                data: {
                  riderId: rider._id,
                  status: action === 'approve' ? 'approved' : 'rejected'
                }
              }
            });

            wx.hideLoading();

            if (auditRes.result && auditRes.result.code === 200) {
              const successMessage = action === 'approve' 
                ? '审核通过，骑手可以接单' 
                : '审核拒绝，骑手可以重新提交申请';
              
              wx.showToast({
                title: successMessage,
                icon: 'success',
                duration: 2000
              });
              
              // 延迟刷新列表，让用户看到提示
              setTimeout(() => {
                this.loadRiderList();
              }, 500);
            } else {
              wx.showToast({
                title: auditRes.result.message || `${actionText}失败`,
                icon: 'none'
              });
            }
          } catch (err) {
            wx.hideLoading();
            console.error('【骑手管理】审核失败:', err);
            wx.showToast({
              title: `${actionText}失败`,
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});

