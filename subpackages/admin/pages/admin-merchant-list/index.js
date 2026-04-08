const log = require('../../../../utils/logger.js');

Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    merchants: [],
    loading: true,
    page: 1,
    pageSize: 10,
    total: 0,
    statusIndex: 0, // 筛选状态索引
    status: '', // 筛选状态值
    keyword: '', // 搜索关键词
    showInviteCodeModal: false, // 显示邀请码生成弹窗
    newInviteCode: '', // 新生成的邀请码
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

  onShow() {
    // 避免重复加载，只在数据为空或超过30秒时刷新
    const lastLoadTime = this.lastLoadTime || 0;
    const now = Date.now();
    if (this.data.merchants.length === 0 || (now - lastLoadTime) > 30000) {
      this.loadMerchantList();
    }
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

  // 加载商家列表（优化版本：添加请求去重）
  async loadMerchantList() {
    // 防止重复请求
    if (this.loadingMerchants) {
      return;
    }
    
    this.loadingMerchants = true;
    wx.showLoading({ title: '加载中...' });
    
    try {
      const adminSessionToken = wx.getStorageSync('adminToken') || '';
      const res = await wx.cloud.callFunction({
        name: 'merchantManage',
        data: {
          action: 'getList',
          adminSessionToken,
          data: {
            page: this.data.page,
            pageSize: this.data.pageSize,
            status: this.data.status,
            keyword: this.data.keyword
          }
        }
      });

      log.log('【商家列表】云函数返回:', res.result);

      if (res.result && res.result.code === 200 && res.result.data) {
        const list = res.result.data.list || [];
        this.setData({
          merchants: list,
          total: res.result.data.total || 0,
          loading: false
        });
        this.lastLoadTime = Date.now();
      } else if (res.result && (res.result.code === 401 || res.result.code === 403)) {
        wx.showToast({
          title: res.result.message || '请重新登录管理端',
          icon: 'none'
        });
        this.setData({ merchants: [], total: 0, loading: false });
      } else {
        wx.showToast({
          title: (res.result && res.result.message) || '加载失败',
          icon: 'none'
        });
        this.setData({ merchants: [], total: 0, loading: false });
      }
    } catch (err) {
      log.error('加载商家列表失败:', err);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ merchants: [], total: 0, loading: false });
    } finally {
      wx.hideLoading();
      this.loadingMerchants = false;
    }
  },

  // 状态筛选
  onStatusChange(e) {
    const index = e.detail.value;
    const status = this.data.statusOptions[index].value;
    this.setData({ statusIndex: index, status, page: 1 });
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

  // 取消暂停商家
  onResume(e) {
    const merchantId = e.currentTarget.dataset.id;
    const merchantName = e.currentTarget.dataset.name;
    
    wx.showModal({
      title: '确认取消暂停',
      content: `确定要恢复商家"${merchantName}"的营业吗？`,
      success: (res) => {
        if (res.confirm) {
          this.updateMerchantStatus(merchantId, 'resume');
        }
      }
    });
  },

  // 删除商家
  onDelete(e) {
    const merchantId = e.currentTarget.dataset.id;
    const merchantName = e.currentTarget.dataset.name;
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除商家"${merchantName}"吗？\n\n此操作将删除该商家的所有数据，包括：\n• 商家账号和密码\n• 店铺信息\n• 所有商品\n• 所有分类\n• 店铺照片\n• 相关订单\n\n此操作不可恢复！`,
      confirmText: '确认删除',
      confirmColor: '#ff0000',
      success: (res) => {
        if (res.confirm) {
          this.deleteMerchant(merchantId, merchantName);
        }
      }
    });
  },

  // 更新商家状态
  async updateMerchantStatus(merchantId, status) {
    wx.showLoading({ title: '处理中...' });
    
    try {
      // 确定action类型
      let action = '';
      let logAction = '';
      let logResult = '';
      
      if (status === 'active') {
        action = 'approve';
        logAction = '商家审核';
        logResult = 'approved';
      } else if (status === 'rejected') {
        action = 'reject';
        logAction = '商家审核';
        logResult = 'rejected';
      } else if (status === 'suspended') {
        action = 'suspend';
        logAction = '暂停商家';
        logResult = 'suspended';
      } else if (status === 'resume') {
        action = 'resume';
        logAction = '取消暂停商家';
        logResult = 'resumed';
      }
      
      const res = await wx.cloud.callFunction({
        name: 'merchantManage',
        data: {
          action: action,
          adminSessionToken: wx.getStorageSync('adminToken') || '',
          data: { merchantId },
          adminId: 'admin_123'
        }
      });

      if (res.result && res.result.code === 200) {
        // 记录操作日志
        const merchant = this.data.merchants.find(m => m._id === merchantId);
        await this.recordAdminLog(logAction, merchant?.merchantName || '未知商家', 'merchant', logResult);
        
        wx.showToast({
          title: res.result.message || '操作成功',
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
      log.error('更新商家状态失败:', err);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  // 删除商家
  async deleteMerchant(merchantId, merchantName) {
    wx.showLoading({ title: '删除中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'merchantManage',
        data: {
          action: 'delete',
          adminSessionToken: wx.getStorageSync('adminToken') || '',
          data: { merchantId },
          adminId: 'admin_123'
        }
      });

      wx.hideLoading();

      if (res.result && res.result.code === 200) {
        // 记录操作日志
        await this.recordAdminLog('删除商家', merchantName, 'merchant', 'deleted');
        
        wx.showToast({
          title: '删除成功',
          icon: 'success',
          duration: 2000
        });
        
        // 刷新列表
        setTimeout(() => {
          this.loadMerchantList();
        }, 2000);
      } else {
        wx.showToast({
          title: res.result?.message || '删除失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (err) {
      wx.hideLoading();
      log.error('删除商家失败:', err);
      wx.showToast({
        title: '删除失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 记录管理员操作日志
  async recordAdminLog(action, target, targetType, result) {
    try {
      await wx.cloud.callFunction({
        name: 'adminLogManage',
        data: {
          action: 'record',
          data: {
            adminId: 'admin_123',
            action: action,
            target: target,
            targetType: targetType,
            result: result
          }
        }
      });
    } catch (error) {
      log.error('记录操作日志失败:', error);
    }
  },

  // 查看商家详情
  onViewDetail(e) {
    const merchantId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/subpackages/admin/pages/admin-merchant-detail/index?id=${merchantId}`
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

  // 生成邀请码
  async onCreateInviteCode() {
    // 生成随机邀请码
    const randomCode = this.generateRandomCode();
    
    wx.showLoading({ title: '生成中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'inviteCodeManage',
        data: {
          action: 'create',
          data: {
            code: randomCode,
            maxUses: 1,
            description: '商家注册邀请码',
            expiredDays: 30
          }
        }
      });
      
      wx.hideLoading();
      
      if (res.result && res.result.code === 200) {
        this.setData({
          showInviteCodeModal: true,
          newInviteCode: randomCode
        });
      } else {
        wx.showToast({
          title: res.result.message || '生成失败',
          icon: 'none'
        });
      }
    } catch (err) {
      wx.hideLoading();
      log.error('生成邀请码失败:', err);
      log.error('错误详情:', JSON.stringify(err, null, 2));
      
      let errorMessage = '生成失败';
      if (err.errMsg) {
        errorMessage = err.errMsg;
      }
      
      wx.showModal({
        title: '生成失败',
        content: errorMessage + '\n\n请检查：\n1. 云函数是否已部署\n2. 数据库集合是否已创建\n3. 查看控制台日志',
        showCancel: false,
        confirmText: '确定'
      });
    }
  },

  // 生成随机邀请码
  generateRandomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  // 复制邀请码
  onCopyInviteCode() {
    wx.setClipboardData({
      data: this.data.newInviteCode,
      success: () => {
        wx.showToast({
          title: '已复制到剪贴板',
          icon: 'success'
        });
      }
    });
  },

  // 关闭邀请码弹窗
  onCloseInviteCodeModal() {
    this.setData({
      showInviteCodeModal: false,
      newInviteCode: ''
    });
  },

  // 返回
  onBack() {
    wx.navigateBack();
  }
});
