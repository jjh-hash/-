App({
  onLaunch() {
    this._launchAt = Date.now();
    // 1. 最小化初始化：仅保留核心功能
    this.initCore();

    // 2. 将次要/后台任务放到首屏后分批执行，减少启动主路径耗时
    this.scheduleLaunchTasks();
  },

  scheduleLaunchTasks() {
    // 第一批：读取登录态（较轻量）
    this._secondaryTimer = setTimeout(() => {
      this.initSecondary();
    }, 700);

    // 第二批：公告/角标/订阅预拉（非首屏必需）
    this._backgroundTimer = setTimeout(() => {
      this.initBackground();
      try {
        const cost = Date.now() - this._launchAt;
        console.info('[perf] app launch staged init finished(ms):', cost);
      } catch (e) {}
    }, 1600);
  },
  
  // 核心初始化（必须在启动时执行的操作）
  initCore() {
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-7g0bpzkg04df43f9', // 云环境ID
        traceUser: true,
        // 启用lazy loading，减少启动时间
        lazy: true
      });
      
      // 管理端页面内发起的云函数自动附带服务端可校验的 adminSessionToken（普通用户页不注入）
      const _origCallFunction = wx.cloud.callFunction.bind(wx.cloud);
      wx.cloud.callFunction = function (options) {
        try {
          const token = wx.getStorageSync('adminToken');
          const pages = getCurrentPages();
          const route = pages.length ? pages[pages.length - 1].route || '' : '';
          const adminRoute =
            route.indexOf('admin') !== -1 ||
            route.indexOf('merchant-register') !== -1;
          if (
            token &&
            adminRoute &&
            options &&
            options.data &&
            typeof options.data === 'object' &&
            options.data.adminSessionToken === undefined
          ) {
            options = Object.assign({}, options, {
              data: Object.assign({}, options.data, { adminSessionToken: token })
            });
          }
        } catch (e) {}
        return _origCallFunction(options);
      };
    }
    
    // 内存告警：释放非必要资源，降低闪退风险
    wx.onMemoryWarning && wx.onMemoryWarning((res) => {
      console.warn('【内存告警】level:', res.level, 'lastResidentSize:', res.lastResidentSize);
      // 可在此释放非关键缓存，如首页列表缓存（用户重新进入会再拉）
      try {
        wx.removeStorage({ key: 'home_products_cache' });
      } catch (e) {}
    });
  },
  
  // 次要初始化（可以延迟执行的操作）
  initSecondary() {
    // 检查用户登录状态
    this.checkUserLogin();
  },
  
  // 后台任务（可以延后执行的操作）
  initBackground() {
    // 公告检查
    this.checkAnnouncement();

    // 购物车 Tab 角标、订阅消息预拉
    try {
      const cartUtil = require('./utils/cart.js');
      if (cartUtil && cartUtil.updateTabBarBadge) cartUtil.updateTabBarBadge();
    } catch (e) {}
    
    try {
      const subscribeMessage = require('./utils/subscribeMessage.js');
      if (subscribeMessage && subscribeMessage.preloadOrderStatusTemplateId) {
        subscribeMessage.preloadOrderStatusTemplateId();
      }
    } catch (e) {}
  },

  globalData: {
    userInfo: null,
    openid: null,
    userToken: null,
    lastAnnouncementShowTime: 0, // 上次显示公告的时间
    isLoggedIn: false,
    prefetchedStoreDetail: {}, // { storeId: Promise<result> } 供店铺详情页提前请求使用
    /** 从登录页返回未登录时，避免「我的」onShow 反复 navigateTo 登录页 */
    _fromUserLoginPageBack: false
  },

  /**
   * 检查用户登录状态（若有 token 但本地用户信息为默认，则异步从服务器拉取并回写，避免清理缓存后头像昵称丢失）
   * 使用异步 getStorage 避免阻塞启动路径
   */
  checkUserLogin() {
    const read = (key) => new Promise((resolve) => {
      wx.getStorage({ key, success: (r) => resolve(r.data), fail: () => resolve(null) });
    });
    Promise.all([read('userInfo'), read('userToken')]).then(([userInfo, userToken]) => {
      if (!userInfo || !userToken) return;
      this.globalData.userInfo = userInfo;
      this.globalData.userToken = userToken;
      this.globalData.isLoggedIn = true;
      this.globalData.openid = userInfo.openid;
      const isDefault = !userInfo.nickname || userInfo.nickname === '微信用户' || !userInfo.avatar;
      if (isDefault) {
        this.loginUser().then(res => {
          if (res && res.success && res.userInfo) {
            wx.setStorage({ key: 'userInfo', data: res.userInfo });
            this.globalData.userInfo = res.userInfo;
          }
        }).catch(() => {});
      }
    });
  },

  /**
   * 用户微信登录
   */
  async loginUser(options = {}) {
    try {
      // 1. 获取微信登录凭证
      const loginRes = await wx.login();
      if (loginRes.code) {
        // 2. 调用云函数进行登录（可选 campus：白沙校区 / 金水校区，写入 users.campus）
        const payload = { code: loginRes.code };
        if (options.campus) payload.campus = options.campus;
        const result = await wx.cloud.callFunction({
          name: 'loginUser',
          data: payload
        });

        console.log('云函数返回结果:', result.result);
        
        if (result.result.code === 0) {
          const {
            userInfo,
            token,
            isNewUser,
            hasMerchantPortal = false,
            hasRiderPortal = false
          } = result.result.data;
          
          // 3. 保存用户信息到本地存储
          wx.setStorageSync('userInfo', userInfo);
          wx.setStorageSync('userToken', token);
          
          // 4. 更新全局数据
          this.globalData.userInfo = userInfo;
          this.globalData.userToken = token;
          this.globalData.isLoggedIn = true;
          this.globalData.openid = userInfo.openid;

          console.log('用户登录成功:', userInfo);
          
          // 5. 如果是新用户，可以显示欢迎信息
          if (isNewUser) {
            wx.showToast({
              title: '欢迎使用校园外卖',
              icon: 'success',
              duration: 2000
            });
          }

          return {
            success: true,
            userInfo: userInfo,
            isNewUser: isNewUser,
            hasMerchantPortal: !!hasMerchantPortal,
            hasRiderPortal: !!hasRiderPortal
          };
        } else {
          console.error('云函数返回错误:', result.result);
          throw new Error(result.result.message || '登录失败');
        }
      } else {
        throw new Error('获取微信登录凭证失败');
      }
    } catch (error) {
      console.error('用户登录失败:', error);
      console.error('错误详情:', error);
      
      // 显示更详细的错误信息
      let errorMessage = '登录失败，请重试';
      if (error.message) {
        errorMessage = error.message;
      }
      
      wx.showModal({
        title: '登录失败',
        content: errorMessage,
        showCancel: false,
        confirmText: '确定'
      });
      
      return {
        success: false,
        error: error.message || '未知错误'
      };
    }
  },

  /**
   * 获取用户信息（如果未登录则自动登录）
   */
  async getUserInfo() {
    if (this.globalData.isLoggedIn) {
      return this.globalData.userInfo;
    } else {
      const loginResult = await this.loginUser();
      if (loginResult.success) {
        return loginResult.userInfo;
      } else {
        return null;
      }
    }
  },

  /**
   * 检查是否需要显示登录弹窗（使用异步 getStorage 避免阻塞）
   */
  checkLoginModal() {
    if (this.globalData.isLoggedIn) return;
    wx.getStorage({
      key: 'lastLoginModalTime',
      success: (res) => {
        const lastShowTime = res.data;
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        if (lastShowTime && (now - lastShowTime) < oneDay) return;
        setTimeout(() => this.showLoginModal(), 1000);
      },
      fail: () => {
        setTimeout(() => this.showLoginModal(), 1000);
      }
    });
  },

  /**
   * 显示登录注册弹窗
   */
  showLoginModal() {
    wx.showModal({
      title: '欢迎使用校园外卖',
      content: '请先登录或注册账号，享受更好的服务体验',
      confirmText: '立即登录',
      cancelText: '稍后再说',
      success: (res) => {
        if (res.confirm) {
          this.handleLoginFromModal();
        } else {
          wx.setStorage({ key: 'lastLoginModalTime', data: Date.now() });
        }
      },
      fail: () => {
        wx.setStorage({ key: 'lastLoginModalTime', data: Date.now() });
      }
    });
  },

  /**
   * 登录后若未登记校区，引导选择并二次调用 loginUser 写入云端
   */
  async promptCampusAfterLoginIfMissing(userInfo) {
    const { normalizeHomeCampus, writeHomeCurrentCampus, CAMPUS_BAISHA, CAMPUS_JINSHUI } = require('./utils/homeCampusStorage');
    let current = userInfo;
    for (let loopGuard = 0; loopGuard < 32; loopGuard++) {
      if (normalizeHomeCampus(current && current.campus)) {
        writeHomeCurrentCampus(current.campus);
        return current;
      }
      const picked = await new Promise((resolve) => {
        wx.showActionSheet({
          itemList: [CAMPUS_BAISHA, CAMPUS_JINSHUI],
          success: (r) => resolve(r.tapIndex === 0 ? CAMPUS_BAISHA : CAMPUS_JINSHUI),
          fail: () => resolve('')
        });
      });
      if (picked) {
        wx.showLoading({ title: '保存校区...', mask: true });
        try {
          const r2 = await this.loginUser({ campus: picked });
          wx.hideLoading();
          if (r2 && r2.success && r2.userInfo) {
            writeHomeCurrentCampus(r2.userInfo.campus);
            return r2.userInfo;
          }
        } catch (e) {
          wx.hideLoading();
        }
        wx.showToast({ title: '保存校区失败，请重试', icon: 'none' });
        current = this.globalData.userInfo || current;
        continue;
      }
      // iOS 等机型：ActionSheet 关闭后立即 showModal 可能不弹出，短暂延迟
      await new Promise((resolve) => setTimeout(resolve, 300));
      const retry = await new Promise((resolve) => {
        wx.showModal({
          title: '完善校区信息',
          content: '建议在「我的」页点头像或此处补选校区；登记所在校区后，在其他校区仅可浏览、不可下单。',
          confirmText: '重新选择',
          cancelText: '稍后',
          success: (m) => resolve(!!m.confirm),
          fail: () => resolve(false)
        });
      });
      if (!retry) {
        wx.showToast({ title: '可在「我的」页随时补选校区', icon: 'none', duration: 2200 });
        return current;
      }
    }
    wx.showToast({ title: '请稍后在「我的」页补选校区', icon: 'none' });
    return current;
  },

  /**
   * 从弹窗触发的登录
   */
  async handleLoginFromModal() {
    try {
      wx.showLoading({
        title: '登录中...',
        mask: true
      });

      const result = await this.loginUser();
      
      wx.hideLoading();

      if (result.success) {
        // 登录成功，清除弹窗记录
        wx.removeStorageSync('lastLoginModalTime');

        const finalUser = await this.promptCampusAfterLoginIfMissing(result.userInfo);
        
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 2000
        });

        // 触发登录成功事件
        this.onLoginSuccess(finalUser, result.isNewUser);
      } else {
        // 登录失败，重新显示弹窗
        setTimeout(() => {
          this.showLoginModal();
        }, 2000);
      }
    } catch (error) {
      wx.hideLoading();
      console.error('弹窗登录失败:', error);
      
      // 登录失败，重新显示弹窗
      setTimeout(() => {
        this.showLoginModal();
      }, 2000);
    }
  },

  /**
   * 登录成功回调
   * 不再强制弹窗/跳转用户信息设置，使用默认头像、昵称、手机号，用户可稍后在「个人中心」或「用户信息设置」页自行修改。
   */
  onLoginSuccess(userInfo, isNewUser) {
    console.log('用户登录成功:', userInfo);
    console.log('用户头像:', userInfo.avatar);
    console.log('用户昵称:', userInfo.nickname);
    // 不再调用 showUserInfoModal，让用户先浏览体验，需要时再在设置页修改
  },

  /**
   * 显示用户信息设置弹窗
   */
  showUserInfoModal() {
    // 通过页面获取用户信息弹窗组件
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    
    if (currentPage && currentPage.selectComponent && currentPage.selectComponent('#userInfoModal')) {
      const modal = currentPage.selectComponent('#userInfoModal');
      modal.setData({
        show: true,
        userInfo: this.globalData.userInfo
      });
    } else {
      // 如果当前页面没有弹窗组件，跳转到用户信息设置页面
      wx.navigateTo({
        url: '/subpackages/common/pages/user-info-setting/index'
      });
    }
  },

  /**
   * 更新用户信息
   */
  updateUserInfo(userInfo) {
    // 更新本地存储
    wx.setStorageSync('userInfo', userInfo);
    
    // 更新全局数据
    this.globalData.userInfo = userInfo;
  },

  /**
   * 手动触发登录弹窗（供页面调用）
   */
  showLoginModalManually() {
    this.showLoginModal();
  },

  /**
   * 核心操作前校验登录：未登录则弹出登录框并返回 false，已登录返回 true
   * @param {string} tip 未登录时的提示（可选）
   * @returns {boolean}
   */
  ensureLogin(tip) {
    if (this.globalData.isLoggedIn) return true;
    if (tip) wx.showToast({ title: tip, icon: 'none', duration: 2000 });
    this.showLoginModal();
    return false;
  },

  /**
   * 检查系统公告
   */
  async checkAnnouncement() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'announcementManage',
        data: {
          action: 'getActive',
          data: {
            targetType: 'client' // 客户端使用
          }
        }
      });
      
      if (res.result && res.result.code === 200 && res.result.data.announcement) {
        const announcement = res.result.data.announcement;
        
        // 每次登录或进入都显示公告（移除已读检查）
        // 延迟显示公告弹窗，确保页面已加载完成
        setTimeout(() => {
          this.showAnnouncementModal(announcement);
        }, 1500);
      }
    } catch (err) {
      console.error('检查公告失败:', err);
    }
  },

  /**
   * 显示公告弹窗
   */
  showAnnouncementModal(announcement) {
    // 防止重复弹出：如果3秒内已经显示过，则不重复显示
    const now = Date.now();
    const lastShowTime = this.globalData.lastAnnouncementShowTime || 0;
    if (now - lastShowTime < 3000) {
      console.log('公告已显示，跳过重复弹出');
      return;
    }
    
    // 记录显示时间
    this.globalData.lastAnnouncementShowTime = now;
    
    // 通过页面获取公告弹窗组件
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    
    if (currentPage && currentPage.selectComponent && currentPage.selectComponent('#announcementModal')) {
      const modal = currentPage.selectComponent('#announcementModal');
      // 检查弹窗是否已经显示
      if (modal.data && modal.data.showModal) {
        console.log('公告弹窗已显示，跳过重复弹出');
        return;
      }
      modal.setData({
        show: true,
        announcement: announcement
      });
    } else {
      // 如果当前页面没有弹窗组件，使用全局弹窗
      wx.showModal({
        title: '📢 系统公告',
        content: announcement.title + '\n\n' + announcement.content,
        showCancel: false,
        confirmText: '我知道了'
        // 移除已读标记，让公告每次都显示
      });
    }
  }
});

