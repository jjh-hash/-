// pages/admin-user-list/index.js
// 用户管理页面
const log = require('../../../../utils/logger.js');
const { debounce } = require('../../../utils/debounce.js');

Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    users: [],
    loading: true,
    page: 1,
    pageSize: 20,
    total: 0,
    statusIndex: 0,
    status: '',
    keyword: '',
    campusIndex: 0,
    campus: '',
    statusOptions: [
      { value: '', label: '全部状态' },
      { value: 'active', label: '正常' },
      { value: 'banned', label: '已封禁' }
    ],
    campusOptions: [
      { value: '', label: '全部' },
      { value: 'unset', label: '未设置' },
      { value: '白沙校区', label: '白沙校区' },
      { value: '金水校区', label: '金水校区' }
    ]
  },

  onLoad() {
    log.log('用户管理页面加载');
    this.verifyAdminAccess();
    this.loadUserList();
    this.onSearchDebounced = debounce(this._onSearch, 400);
  },

  onShow() {
    this.loadUserList();
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

  async loadUserList() {
    wx.showLoading({ title: '加载中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'userManage',
        data: {
          action: 'getList',
          data: {
            page: this.data.page,
            pageSize: this.data.pageSize,
            status: this.data.status,
            keyword: this.data.keyword,
            campus: this.data.campus
          }
        }
      });

      log.log('【用户列表】云函数返回:', res.result);

      if (res.result && res.result.code === 200) {
        this.setData({
          users: res.result.data.list,
          total: res.result.data.total,
          loading: false
        });
      } else {
        log.log('【用户列表】使用模拟数据');
        this.setData({
          users: this.getMockUsers(),
          total: 4,
          loading: false
        });
      }
    } catch (err) {
      log.error('加载用户列表失败:', err);
      this.setData({
        users: this.getMockUsers(),
        total: 4,
        loading: false
      });
    } finally {
      wx.hideLoading();
    }
  },

  getMockUsers() {
    return [
      {
        _id: '1',
        nickname: '小明',
        avatar: '',
        phone: '13800138001',
        email: 'xiaoming@example.com',
        campus: '北辰校区',
        status: 'active',
        createdAt: '2025-01-01 10:00',
        lastLoginAt: '2025-01-03 15:30'
      },
      {
        _id: '2',
        nickname: '小红',
        avatar: '',
        phone: '13800138002',
        email: 'xiaohong@example.com',
        campus: '红桥校区',
        status: 'active',
        createdAt: '2025-01-02 09:00',
        lastLoginAt: '2025-01-03 14:20'
      },
      {
        _id: '3',
        nickname: '小李',
        avatar: '',
        phone: '13800138003',
        email: 'xiaoli@example.com',
        campus: '北辰校区',
        status: 'banned',
        createdAt: '2025-01-03 08:00',
        lastLoginAt: '2025-01-03 12:00'
      },
      {
        _id: '4',
        nickname: '小张',
        avatar: '',
        phone: '13800138004',
        email: 'xiaozhang@example.com',
        campus: '其他',
        status: 'active',
        createdAt: '2025-01-03 11:00',
        lastLoginAt: '2025-01-03 16:00'
      }
    ];
  },

  onStatusChange(e) {
    const index = e.detail.value;
    const status = this.data.statusOptions[index].value;
    this.setData({ statusIndex: index, status, page: 1 });
    this.loadUserList();
  },

  onCampusChange(e) {
    const index = e.detail.value;
    const campus = this.data.campusOptions[index].value;
    this.setData({ campusIndex: index, campus, page: 1 });
    this.loadUserList();
  },

  _onSearch() {
    this.setData({ page: 1 });
    this.loadUserList();
  },
  onSearch(e) {
    const keyword = e.detail.value;
    this.setData({ keyword });
    this.onSearchDebounced();
  },

  onBanUser(e) {
    const userId = e.currentTarget.dataset.id;
    const nickname = e.currentTarget.dataset.name;
    
    wx.showModal({
      title: '确认封禁',
      content: `确定要封禁用户"${nickname}"吗？`,
      editable: true,
      placeholderText: '请输入封禁原因（可选）',
      success: (res) => {
        if (res.confirm) {
          this.banUser(userId, res.content);
        }
      }
    });
  },

  onUnbanUser(e) {
    const userId = e.currentTarget.dataset.id;
    const nickname = e.currentTarget.dataset.name;
    
    wx.showModal({
      title: '确认解封',
      content: `确定要解封用户"${nickname}"吗？`,
      success: (res) => {
        if (res.confirm) {
          this.unbanUser(userId);
        }
      }
    });
  },

  async banUser(userId, reason) {
    wx.showLoading({ title: '处理中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'userManage',
        data: {
          action: 'banUser',
          data: { userId, reason }
        }
      });

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '封禁成功',
          icon: 'success'
        });
        this.loadUserList();
      } else {
        wx.showToast({
          title: res.result.message || '操作失败',
          icon: 'none'
        });
      }
    } catch (err) {
      log.error('封禁用户失败:', err);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  async unbanUser(userId) {
    wx.showLoading({ title: '处理中...' });
    
    try {
      const res = await wx.cloud.callFunction({
        name: 'userManage',
        data: {
          action: 'unbanUser',
          data: { userId }
        }
      });

      if (res.result && res.result.code === 200) {
        wx.showToast({
          title: '解封成功',
          icon: 'success'
        });
        this.loadUserList();
      } else {
        wx.showToast({
          title: res.result.message || '操作失败',
          icon: 'none'
        });
      }
    } catch (err) {
      log.error('解封用户失败:', err);
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      });
    } finally {
      wx.hideLoading();
    }
  },

  onViewDetail(e) {
    const userId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/subpackages/admin/pages/admin-user-detail/index?id=${userId}`
    });
  },

  onBack() {
    wx.navigateBack();
  },

  onPullDownRefresh() {
    this.setData({ page: 1 });
    this.loadUserList();
    wx.stopPullDownRefresh();
  },

  onReachBottom() {
    if (this.data.users.length < this.data.total) {
      this.setData({ page: this.data.page + 1 });
      this.loadUserList();
    }
  }
});
