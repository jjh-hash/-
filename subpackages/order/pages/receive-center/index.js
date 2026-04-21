// 接单工作台：任务 | 配送 两 Tab 合并入口
const log = require('../../../../utils/logger.js');
const { normalizeHomeCampus, STORAGE_KEY, CAMPUS_BAISHA } = require('../../../../utils/homeCampusStorage');

const ORDER_TYPE_TEXT = { gaming: '游戏陪玩', reward: '跑腿', express: '代拿快递' };

Page({
  data: {
    mainTab: 'task', // task | delivery
    campusPartnerActive: false, // 是否已开通校园兼职
    // 任务 Tab
    taskOrders: [],
    taskLoading: false,
    taskPage: 1,
    taskPageSize: 20,
    hasMoreTask: true,
    // 配送 Tab：子 Tab 与骑手状态
    deliverySubTab: 0, // 0 待抢单 1 待取货 2 待送达
    deliveryOrders: [],
    pickupOrders: [],
    deliverOrders: [],
    deliveryLoading: false,
    pickupLoading: false,
    deliverLoading: false,
    riderStatus: 'not_registered',
    canGrabOrder: false,
    // Watch + 轮询（配送 Tab）
    watchOrder: null,
    pollingTimer: null,
    reconnectCount: 0,
    watchConnected: false,
    pollingActive: false,
    lastRefreshTime: 0,
    lastScrollTime: 0,
    scrollTop: 0,
    taskLoadError: false,
    deliveryLoadError: false,
    errorMessage: ''
  },

  onLoad() {
    let c = '';
    try {
      c = wx.getStorageSync('homeCurrentCampus');
    } catch (e) {}
    if (c !== '金水校区' && c !== '白沙校区') {
      const u = wx.getStorageSync('userInfo') || {};
      if (u.campus === '金水校区' || u.campus === '白沙校区') c = u.campus;
      else c = '白沙校区';
    }
    this._receiveOrderCampus = c;
    this.loadCampusPartnerStatus();
    this.loadTaskOrders();
  },

  onShow() {
    try {
      const c = wx.getStorageSync('homeCurrentCampus');
      if (c === '金水校区' || c === '白沙校区') this._receiveOrderCampus = c;
    } catch (e) {}
    this.loadCampusPartnerStatus();
    if (this.data.mainTab === 'task') {
      if (!this._taskLoadedAt || Date.now() - this._taskLoadedAt > 30000) this.loadTaskOrders();
    } else {
      this.loadRiderStatus();
      this.loadDeliveryBySubTab(this.data.deliverySubTab);
      this.startDeliveryWatch();
      setTimeout(() => {
        if (!this.data.watchConnected && !this.data.pollingActive) {
          log.log('【任务大厅配送】Watch未连接，启动轮询兜底');
          this.startDeliveryPolling();
        }
      }, 2000);
    }
  },

  onHide() {
    if (this.data.mainTab === 'delivery') {
      log.log('【任务大厅配送】页面隐藏，停止监听和轮询');
      this.stopDeliveryWatch();
      this.stopDeliveryPolling();
      this._clearDeliveryTimers();
    }
  },

  onUnload() {
    log.log('【任务大厅】页面卸载，停止配送监听和轮询');
    this.stopDeliveryWatch();
    this.stopDeliveryPolling();
    this._clearDeliveryTimers();
  },

  _clearDeliveryTimers() {
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
    }
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  },

  startDeliveryWatch() {
    if (this.data.mainTab !== 'delivery') return;
    this.stopDeliveryWatch();
    this.stopDeliveryPolling();
    this.setData({ reconnectCount: 0 });
    try {
      log.log('【任务大厅配送】启动订单实时监听');
      const db = wx.cloud.database();
      wx.cloud.callFunction({ name: 'loginUser', data: {} }).then(res => {
        const data = res.result?.data;
        const openid = data?.userInfo?.openid || res.result?.openid || (wx.getStorageSync('userInfo') && wx.getStorageSync('userInfo').openid);
        if (!openid) {
          log.warn('【任务大厅配送】无法启动Watch：缺少openid，降级到轮询');
          this.startDeliveryPolling();
          return;
        }
        const _ = db.command;
        const whereCondition = _.or([
          {
            orderStatus: _.in(['ready', 'confirmed']),
            riderOpenid: _.exists(false),
            payStatus: 'paid'
          },
          { riderOpenid: openid }
        ]);
        this.data.watchOrder = db.collection('orders')
          .where(whereCondition)
          .watch({
            onChange: (snapshot) => {
              if (!this.data.watchConnected) {
                this.setData({ watchConnected: true });
                log.log('【任务大厅配送】Watch连接成功');
                this.stopDeliveryPolling();
              }
              if (snapshot.docChanges && snapshot.docChanges.length > 0) {
                this.handleDeliveryOrderChange();
              }
            },
            onError: (err) => {
              log.error('【任务大厅配送】Watch错误:', err);
              this.handleDeliveryWatchError(err);
            }
          });
        log.log('【任务大厅配送】Watch已启动');
      }).catch(err => {
        log.error('【任务大厅配送】获取openid失败:', err);
        this.startDeliveryPolling();
      });
    } catch (error) {
      log.error('【任务大厅配送】启动Watch失败:', error);
      this.startDeliveryPolling();
    }
  },

  handleDeliveryOrderChange() {
    const now = Date.now();
    if (now - this.data.lastRefreshTime < 1000) return;
    if (this.data.deliveryLoading || this.data.pickupLoading || this.data.deliverLoading) return;
    const timeSinceScroll = now - (this.data.lastScrollTime || 0);
    if (timeSinceScroll < 3000) {
      if (this._refreshTimer) clearTimeout(this._refreshTimer);
      this._refreshTimer = setTimeout(() => this.handleDeliveryOrderChange(), 3000 - timeSinceScroll + 2000);
      return;
    }
    if (this.data.scrollTop > 100) {
      if (this._refreshTimer) clearTimeout(this._refreshTimer);
      this._refreshTimer = setTimeout(() => {
        if (Date.now() - (this.data.lastScrollTime || 0) >= 3000) this.handleDeliveryOrderChange();
      }, 3000);
      return;
    }
    this.setData({ lastRefreshTime: now });
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => {
      if (!this.data.deliveryLoading && !this.data.pickupLoading && !this.data.deliverLoading) {
        this.loadDeliveryBySubTab(this.data.deliverySubTab);
      }
    }, 500);
  },

  handleDeliveryWatchError(err) {
    this.setData({ watchConnected: false });
    const reconnectCount = this.data.reconnectCount || 0;
    const maxReconnect = 3;
    if (reconnectCount >= maxReconnect) {
      log.warn('【任务大厅配送】Watch重连达上限，降级到轮询');
      this.startDeliveryPolling();
      return;
    }
    const intervals = [2000, 5000, 8000];
    const delay = intervals[reconnectCount] || 8000;
    this.setData({ reconnectCount: reconnectCount + 1 });
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => this.startDeliveryWatch(), delay);
  },

  startDeliveryPolling() {
    if (this.data.mainTab !== 'delivery' || this.data.pollingActive) return;
    log.log('【任务大厅配送】启动轮询兜底');
    this.setData({ pollingActive: true });
    this.pollDeliveryOrders();
    const timerId = setInterval(() => this.pollDeliveryOrders(), 12000);
    this.setData({ pollingTimer: timerId });
  },

  stopDeliveryPolling() {
    const id = this.data.pollingTimer;
    if (id) {
      clearInterval(id);
      this.setData({ pollingTimer: null });
    }
    this.setData({ pollingActive: false });
  },

  pollDeliveryOrders() {
    if (this.data.mainTab !== 'delivery') {
      this.stopDeliveryPolling();
      return;
    }
    const { deliverySubTab, pickupOrders, deliverOrders } = this.data;
    const hasActive = (deliverySubTab === 0) || (pickupOrders && pickupOrders.length > 0) || (deliverOrders && deliverOrders.length > 0);
    if (!hasActive) {
      this.stopDeliveryPolling();
      return;
    }
    const now = Date.now();
    if (now - (this.data.lastScrollTime || 0) < 3000) return;
    if (this.data.scrollTop > 100) return;
    if (!this.data.deliveryLoading && !this.data.pickupLoading && !this.data.deliverLoading) {
      this.loadDeliveryBySubTab(this.data.deliverySubTab);
    }
  },

  stopDeliveryWatch() {
    if (this.data.watchOrder) {
      try {
        this.data.watchOrder.close();
      } catch (error) {
        log.error('【任务大厅配送】停止Watch失败:', error);
      }
      this.data.watchOrder = null;
    }
    this.setData({ watchConnected: false });
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
  },

  onDeliveryScroll(e) {
    const now = Date.now();
    const scrollTop = e.detail.scrollTop || 0;
    this.setData({ lastScrollTime: now, scrollTop });
  },

  async loadCampusPartnerStatus() {
    try {
      const res = await wx.cloud.callFunction({ name: 'campusPartnerManage', data: { action: 'getStatus' } });
      const d = res.result && res.result.data;
      const campusPartnerActive = !!(d && d.status === 'active');
      this.setData({ campusPartnerActive, canGrabOrder: campusPartnerActive });
    } catch (e) {
      this.setData({ campusPartnerActive: false, canGrabOrder: false });
    }
  },

  onPullDownRefresh() {
    if (this.data.mainTab === 'task') {
      this.loadTaskOrders(false).then(() => wx.stopPullDownRefresh()).catch(() => wx.stopPullDownRefresh());
    } else {
      this.loadRiderStatus();
      this.loadDeliveryBySubTab(this.data.deliverySubTab).then(() => wx.stopPullDownRefresh()).catch(() => wx.stopPullDownRefresh());
    }
  },

  onMainTab(e) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.mainTab) return;
    if (this.data.mainTab === 'delivery') {
      this.stopDeliveryWatch();
      this.stopDeliveryPolling();
      this._clearDeliveryTimers();
    }
    this.setData({ mainTab: tab });
    if (tab === 'task') this.loadTaskOrders();
    else {
      this.loadRiderStatus();
      this.loadDeliveryBySubTab(0);
      this.startDeliveryWatch();
    }
  },

  // ---------- 任务 Tab ----------
  async loadTaskOrders(isLoadMore) {
    if (this.data.taskLoading && !isLoadMore) return;
    if (!isLoadMore) this.setData({ taskLoading: true, taskOrders: [], taskPage: 1, hasMoreTask: true });
    const page = isLoadMore ? this.data.taskPage : 1;
    try {
      const res = await wx.cloud.callFunction({
        name: 'orderManage',
        data: {
          action: 'getReceiveOrders',
          data: {
            status: 'pending',
            page,
            pageSize: this.data.taskPageSize,
            campus: this._receiveOrderCampus || '白沙校区'
          }
        }
      });
      if (res.result && res.result.code === 200) {
        const list = (res.result.data.list || []).map(o => ({
          id: o._id,
          orderNo: o.orderNo,
          orderType: o.orderType,
          orderTypeText: ORDER_TYPE_TEXT[o.orderType] || '任务',
          amountTotal: o.amountTotal != null ? (o.amountTotal >= 100 ? (o.amountTotal / 100).toFixed(2) : o.amountTotal) : '0.00',
          bounty: o.bounty != null ? (o.bounty >= 100 ? (o.bounty / 100).toFixed(2) : o.bounty) : null,
          orderStatus: o.orderStatus
        }));
        const taskOrders = isLoadMore ? [...this.data.taskOrders, ...list] : list;
        const total = res.result.data.total || 0;
        this.setData({
          taskOrders,
          taskPage: page + 1,
          hasMoreTask: (page * this.data.taskPageSize) < total,
          taskLoading: false,
          taskLoadError: false
        });
        this._taskLoadedAt = Date.now();
      } else {
        this.setData({ taskLoading: false });
      }
    } catch (e) {
      log.error('接单工作台 loadTaskOrders', e);
      this.setData({ taskLoading: false, taskLoadError: true, errorMessage: e.message || '加载失败' });
    }
  },

  onRetryTaskLoad() {
    this.setData({ taskLoadError: false });
    this.loadTaskOrders();
  },

  onRetryDeliveryLoad() {
    this.setData({ deliveryLoadError: false });
    this.loadDeliveryBySubTab(this.data.deliverySubTab);
  },

  goTaskList() {
    wx.navigateTo({ url: '/subpackages/order/pages/receive-order/index' });
  },

  onTaskOrderTap(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/subpackages/order/pages/receive-order/index?orderId=${id}` });
  },

  onTaskReachBottom() {
    if (this.data.hasMoreTask && !this.data.taskLoading) this.loadTaskOrders(true);
  },

  // ---------- 配送 Tab ----------
  async loadRiderStatus() {
    try {
      const res = await wx.cloud.callFunction({ name: 'riderManage', data: { action: 'getRiderStatus', data: {} } });
      if (res.result && res.result.code === 200) {
        const d = res.result.data || {};
        this.setData({ riderStatus: d.status || 'not_registered' });
      }
    } catch (e) {
      console.error('loadRiderStatus', e);
    }
  },

  onDeliverySubTab(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ deliverySubTab: index });
    this.loadDeliveryBySubTab(index);
  },

  async loadDeliveryBySubTab(tabIndex) {
    if (tabIndex === 0) {
      this.setData({ deliveryLoading: true });
      try {
        const campus =
          normalizeHomeCampus(wx.getStorageSync(STORAGE_KEY)) ||
          this._receiveOrderCampus ||
          CAMPUS_BAISHA;
        const res = await wx.cloud.callFunction({
          name: 'orderManage',
          data: { action: 'getAvailableOrders', data: { page: 1, pageSize: 20, campus } }
        });
        const raw = (res.result && res.result.code === 200) ? (res.result.data.list || []) : [];
        const list = raw.map(o => ({
          id: o.id || o._id,
          orderNo: o.orderNo || '',
          price: o.price != null ? String(o.price) : '0.00',
          storeName: o.pickupStore || o.storeName || '店铺'
        }));
        this.setData({ deliveryOrders: list, deliveryLoading: false, deliveryLoadError: false });
      } catch (e) {
        this.setData({ deliveryOrders: [], deliveryLoading: false, deliveryLoadError: true, errorMessage: e.message || '加载失败' });
      }
    } else if (tabIndex === 1) {
      this.setData({ pickupLoading: true });
      try {
        const res = await wx.cloud.callFunction({
          name: 'orderManage',
          data: { action: 'getPickupOrders', data: { page: 1, pageSize: 20 } }
        });
        const raw = (res.result && res.result.code === 200) ? (res.result.data.list || []) : [];
        const list = raw.map(o => ({
          id: o.id || o._id,
          orderNo: o.orderNo || '',
          price: o.price != null ? String(o.price) : '0.00',
          storeName: o.pickupStore || o.storeName || '店铺'
        }));
        this.setData({ pickupOrders: list, pickupLoading: false, deliveryLoadError: false });
      } catch (e) {
        this.setData({ pickupOrders: [], pickupLoading: false, deliveryLoadError: true, errorMessage: e.message || '加载失败' });
      }
    } else {
      this.setData({ deliverLoading: true });
      try {
        const res = await wx.cloud.callFunction({
          name: 'orderManage',
          data: { action: 'getDeliverOrders', data: { page: 1, pageSize: 20 } }
        });
        const raw = (res.result && res.result.code === 200) ? (res.result.data.list || []) : [];
        const list = raw.map(o => ({
          id: o.id || o._id,
          orderNo: o.orderNo || '',
          price: o.price != null ? String(o.price) : '0.00',
          storeName: o.pickupStore || o.storeName || '店铺'
        }));
        this.setData({ deliverOrders: list, deliverLoading: false, deliveryLoadError: false });
      } catch (e) {
        this.setData({ deliverOrders: [], deliverLoading: false, deliveryLoadError: true, errorMessage: e.message || '加载失败' });
      }
    }
  },

  goRiderHome() {
    wx.navigateTo({ url: '/subpackages/rider/pages/rider-home/index' });
  },

  onDeliveryOrderTap() {
    this.goRiderHome();
  },

  goCampusPartner() {
    wx.navigateTo({ url: '/subpackages/common/pages/campus-partner/index' });
  }
});
