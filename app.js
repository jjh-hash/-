App({
  onLaunch() {
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-7g0bpzkg04df43f9', // 云环境ID
        traceUser: true,
      });
    }
    
    // 立即执行的关键初始化
    this.checkUserLogin();
    
    // 延迟执行非关键操作，提升启动速度
    setTimeout(() => {
      this.checkLoginModal();
    }, 500);
    
    // 公告检查延迟更久，避免影响页面加载
    setTimeout(() => {
      this.checkAnnouncement();
    }, 2000);
  },
  
  globalData: {
    userInfo: null,
    openid: null,
    userToken: null,
    lastAnnouncementShowTime: 0, // 上次显示公告的时间
    isLoggedIn: false
  },

  /**
   * 检查用户登录状态
   */
  checkUserLogin() {
    const userInfo = wx.getStorageSync('userInfo');
    const userToken = wx.getStorageSync('userToken');
    
    if (userInfo && userToken) {
      this.globalData.userInfo = userInfo;
      this.globalData.userToken = userToken;
      this.globalData.isLoggedIn = true;
      this.globalData.openid = userInfo.openid;
    }
  },

  /**
   * 用户微信登录
   */
  async loginUser() {
    try {
      // 1. 获取微信登录凭证
      const loginRes = await wx.login();
      if (loginRes.code) {
        // 2. 调用云函数进行登录
        const result = await wx.cloud.callFunction({
          name: 'loginUser',
          data: {
            code: loginRes.code
          }
        });

        console.log('云函数返回结果:', result.result);
        
        if (result.result.code === 0) {
          const { userInfo, token, isNewUser } = result.result.data;
          
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
            isNewUser: isNewUser
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
   * 用户登出
   */
  logoutUser() {
    // 清除本地存储
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('userToken');
    
    // 重置全局数据
    this.globalData.userInfo = null;
    this.globalData.userToken = null;
    this.globalData.isLoggedIn = false;
    this.globalData.openid = null;
    
    console.log('用户已登出');
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
   * 检查是否需要显示登录弹窗
   */
  checkLoginModal() {
    // 检查是否已经登录
    if (this.globalData.isLoggedIn) {
      return;
    }

    // 检查是否已经显示过登录弹窗（24小时内不重复显示）
    const lastShowTime = wx.getStorageSync('lastLoginModalTime');
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000; // 24小时

    if (lastShowTime && (now - lastShowTime) < oneDay) {
      return;
    }

    // 延迟显示弹窗，确保页面加载完成
    setTimeout(() => {
      this.showLoginModal();
    }, 1000);
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
          // 用户点击立即登录
          this.handleLoginFromModal();
        } else {
          // 用户点击稍后再说，记录时间
          wx.setStorageSync('lastLoginModalTime', Date.now());
        }
      },
      fail: () => {
        // 弹窗显示失败，记录时间避免重复
        wx.setStorageSync('lastLoginModalTime', Date.now());
      }
    });
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
        
        wx.showToast({
          title: '登录成功',
          icon: 'success',
          duration: 2000
        });

        // 触发登录成功事件
        this.onLoginSuccess(result.userInfo, result.isNewUser);
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
   */
  onLoginSuccess(userInfo, isNewUser) {
    console.log('用户登录成功:', userInfo);
    console.log('用户头像:', userInfo.avatar);
    console.log('用户昵称:', userInfo.nickname);
    
    // 可以在这里添加登录成功后的逻辑
    // 比如：跳转到特定页面、发送统计数据等
    
    if (isNewUser) {
      // 新用户特殊处理
      console.log('欢迎新用户:', userInfo.nickname);
      
      // 新用户登录后，弹出用户信息设置弹窗
      setTimeout(() => {
        this.showUserInfoModal();
      }, 500);
    } else {
      // 老用户检查是否需要更新头像昵称
      const needUpdate = !userInfo.avatar || 
                        !userInfo.nickname || 
                        userInfo.nickname === '微信用户' ||
                        userInfo.nickname.trim() === '';
      
      console.log('是否需要更新用户信息:', needUpdate);
      
      if (needUpdate) {
        setTimeout(() => {
          this.showUserInfoModal();
        }, 500);
      }
    }
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
        url: '/pages/user-info-setting/index'
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

