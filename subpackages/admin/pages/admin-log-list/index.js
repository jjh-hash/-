// pages/admin-log-list/index.js
Page({
  data: {
    statusBarHeight: wx.getWindowInfo().statusBarHeight || 20,
    logs: [],
    loading: false, // 初始为false，避免首次加载被拦截
    page: 1,
    pageSize: 20,
    total: 0,
    hasMore: true
  },

  onLoad() {
    console.log('操作日志列表页面加载');
    this.verifyAdminAccess();
    // 延迟一点加载，确保页面渲染完成
    setTimeout(() => {
      this.loadLogs();
    }, 100);
  },

  onShow() {
    // 页面显示时不自动刷新，避免重复加载
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

  // 加载操作日志列表
  async loadLogs(isLoadMore = false) {
    // 防止重复加载（仅非首次加载时检查）
    if (this.data.loading) {
      console.log('正在加载中，跳过重复请求', { isLoadMore, loading: this.data.loading });
      return;
    }
    
    console.log('开始加载日志，isLoadMore:', isLoadMore, '当前page:', this.data.page);
    this.setData({ loading: true });
    
    try {
      wx.showLoading({ title: '加载中...' });

      // 计算要加载的页码
      const loadPage = isLoadMore ? this.data.page : 1;
      console.log('调用云函数，page:', loadPage, 'pageSize:', this.data.pageSize, 'isLoadMore:', isLoadMore);
      
      const res = await wx.cloud.callFunction({
        name: 'adminLogManage',
        data: {
          action: 'getList',
          data: {
            page: loadPage,
            pageSize: this.data.pageSize
          }
        }
      });

      wx.hideLoading();

      console.log('操作日志列表返回:', res.result);

      if (res.result && res.result.code === 200 && res.result.data) {
        const list = res.result.data.list || [];
        console.log('获取到的日志列表:', list.length, '条');
        console.log('日志数据示例:', list[0]);
        
        const logs = list.map(log => {
          const formattedLog = {
            id: log._id || '',
            action: log.action || '未知操作',
            target: log.target || '',
            targetType: log.targetType || 'system',
            time: this.formatTime(log.createdAt),
            result: this.formatResult(log.result),
            details: log.details || {}
          };
          return formattedLog;
        });

        const newLogs = isLoadMore ? [...this.data.logs, ...logs] : logs;
        const total = res.result.data.total || 0;
        
        console.log('准备设置数据:', {
          newLogsLength: newLogs.length,
          total: total,
          isLoadMore: isLoadMore,
          currentPage: this.data.page
        });
        
        // 更新页码（如果不是加载更多，重置为1）
        const nextPage = isLoadMore ? this.data.page : 1;
        
        this.setData({
          logs: newLogs,
          total: total,
          hasMore: newLogs.length < total,
          loading: false,
          page: nextPage
        }, () => {
          console.log('✅ 数据设置完成！');
          console.log('当前logs数量:', this.data.logs.length);
          console.log('当前loading状态:', this.data.loading);
          console.log('当前page:', this.data.page);
          console.log('总计:', this.data.total);
        });

        console.log('加载操作日志成功，本次', logs.length, '条，共', newLogs.length, '条，总计', total, '条');
      } else {
        console.error('加载失败:', res.result);
        wx.showToast({
          title: res.result?.message || '加载失败',
          icon: 'none',
          duration: 2000
        });
        this.setData({ 
          loading: false,
          logs: [],
          total: 0
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('加载操作日志异常:', error);
      wx.showToast({
        title: '加载失败：' + (error.message || '网络错误'),
        icon: 'none',
        duration: 2000
      });
      this.setData({ 
        loading: false,
        logs: [],
        total: 0
      });
    }
  },

  // 格式化时间
  formatTime(date) {
    if (!date) {
      console.warn('formatTime收到空日期');
      return '';
    }
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        console.warn('formatTime日期解析失败:', date);
        return '';
      }
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hour = String(d.getHours()).padStart(2, '0');
      const minute = String(d.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day} ${hour}:${minute}`;
    } catch (error) {
      console.error('formatTime异常:', error, date);
      return '';
    }
  },

  // 格式化操作结果
  formatResult(result) {
    const resultMap = {
      'success': '成功',
      'failed': '失败',
      'approved': '通过',
      'rejected': '拒绝',
      'completed': '完成',
      'cancelled': '取消',
      'suspended': '暂停',
      'resumed': '恢复'
    };
    return resultMap[result] || result;
  },

  // 加载更多
  onLoadMore() {
    if (!this.data.hasMore || this.data.loading) {
      console.log('无法加载更多:', { hasMore: this.data.hasMore, loading: this.data.loading });
      return;
    }
    
    const nextPage = this.data.page + 1;
    console.log('加载第', nextPage, '页');
    
    this.setData({
      page: nextPage
    });
    
    this.loadLogs(true);
  },

  // 返回
  onBack() {
    wx.navigateBack();
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      page: 1,
      logs: [],
      hasMore: true
    });
    this.loadLogs().then(() => {
      wx.stopPullDownRefresh();
    });
  }
});

